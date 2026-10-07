param(
    [string]$InputPath = 'D:\AI\trading\STOCK\觀察名單_概念股.csv',
    [switch]$ValidateOnly
)
# Windows PowerShell 5.1 treats native Git stderr notices as terminating errors
# when this is Stop. Git exit codes are checked explicitly below.
$ErrorActionPreference = 'Continue'
$repo = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$sourcePath = Join-Path $repo 'data\personal-groups-source.txt'
if (-not (Test-Path -LiteralPath $InputPath)) { throw "找不到匯出檔：$InputPath" }

$bytes = [System.IO.File]::ReadAllBytes($InputPath)
try {
    $content = [System.Text.UTF8Encoding]::new($false, $true).GetString($bytes)
} catch [System.Text.DecoderFallbackException] {
    $content = [System.Text.Encoding]::GetEncoding(950).GetString($bytes)
}
$lines = $content -split '\r?\n'
$start = -1
$end = -1
for ($index = 0; $index -lt $lines.Length; $index++) {
    if ($start -lt 0 -and $lines[$index] -match '^矽光子.*[：:]\s*$') { $start = $index }
    if ($start -ge 0 -and $lines[$index].Trim() -eq '6757.TW') { $end = $index; break }
}
if ($start -lt 0 -or $end -le $start) { throw '找不到從矽光子至 6757.TW 台灣虎航的完整範圍。' }
[System.IO.File]::WriteAllText($sourcePath, (($lines[$start..$end] -join "`n") + "`n"), [System.Text.UTF8Encoding]::new($false))

$python = 'C:\Users\USER\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
if (-not (Test-Path -LiteralPath $python)) { $python = 'python' }
Push-Location $repo
try {
    & $python scripts/build_personal_groups.py --check
    if ($LASTEXITCODE -ne 0) { throw '分類資料驗證失敗，未上傳。' }
    if ($ValidateOnly) { Write-Output '分類格式驗證成功；未提交或上傳。'; return }
    $branch = (git -c "safe.directory=$repo" branch --show-current).Trim()
    if ($LASTEXITCODE -ne 0 -or $branch -ne 'main') { throw '請先切換到 main 分支，避免上傳到錯誤版本。' }
    $staged = @(git -c "safe.directory=$repo" diff --cached --name-only)
    if ($LASTEXITCODE -ne 0) { throw '無法檢查 Git 暫存區。' }
    if ($staged.Count -gt 0) { throw "請先處理其他已暫存檔案：$($staged -join ', ')" }
    $modified = @(git -c "safe.directory=$repo" diff --name-only | Where-Object { $_ -ne 'data/personal-groups-source.txt' })
    if ($LASTEXITCODE -ne 0 -or $modified.Count -gt 0) { throw "有其他尚未提交的檔案，已停止自動上傳：$($modified -join ', ')" }
    git -c "safe.directory=$repo" fetch origin main
    if ($LASTEXITCODE -ne 0) { throw '無法連上 GitHub，稍後會重試。' }
    $ahead = @(git -c "safe.directory=$repo" rev-list 'origin/main..HEAD')
    if ($LASTEXITCODE -ne 0) { throw '無法檢查本機版本。' }
    foreach ($commit in $ahead) {
        $subject = git -c "safe.directory=$repo" show -s --format=%s $commit
        $files = @(git -c "safe.directory=$repo" diff-tree --no-commit-id --name-only -r $commit)
        if ($subject -ne 'data: update personal industry groups' -or @($files | Where-Object { $_ -ne 'data/personal-groups-source.txt' }).Count -gt 0) {
            throw '本機 main 含其他未上傳提交，已停止自動上傳。'
        }
    }
    git -c "safe.directory=$repo" add -- data/personal-groups-source.txt
    if ($LASTEXITCODE -ne 0) { throw '無法暫存分類來源。' }
    git -c "safe.directory=$repo" diff --cached --quiet
    if ($LASTEXITCODE -ne 0) {
        git -c "safe.directory=$repo" commit -m 'data: update personal industry groups'
        if ($LASTEXITCODE -ne 0) { throw '分類來源提交失敗。' }
    } elseif ($ahead.Count -eq 0) { Write-Output '分類內容沒有變動，不需要上傳。'; return }
    git -c "safe.directory=$repo" pull --rebase origin main
    if ($LASTEXITCODE -ne 0) { throw '無法與 GitHub 最新版本合併，請先處理 Git 衝突。' }
    git -c "safe.directory=$repo" push origin main
    if ($LASTEXITCODE -ne 0) { throw '上傳 GitHub 失敗。' }
    Write-Output '已上傳分類來源；GitHub Actions 將自動驗證、建置及部署。'
} finally {
    Pop-Location
}
