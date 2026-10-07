param(
    [string]$InputPath = 'D:\AI\trading\STOCK\觀察名單_概念股.csv',
    [switch]$ValidateOnly
)
$ErrorActionPreference = 'Stop'
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
    $staged = @(git -c "safe.directory=$repo" diff --cached --name-only)
    if ($LASTEXITCODE -ne 0) { throw '無法檢查 Git 暫存區。' }
    if ($staged.Count -gt 0) { throw "請先處理其他已暫存檔案：$($staged -join ', ')" }
    git -c "safe.directory=$repo" add -- data/personal-groups-source.txt
    if ($LASTEXITCODE -ne 0) { throw '無法暫存分類來源。' }
    git -c "safe.directory=$repo" diff --cached --quiet
    if ($LASTEXITCODE -eq 0) { Write-Output '分類內容沒有變動，不需要上傳。'; return }
    git -c "safe.directory=$repo" commit -m 'data: update personal industry groups'
    if ($LASTEXITCODE -ne 0) { throw '分類來源提交失敗。' }
    git -c "safe.directory=$repo" pull --rebase origin main
    if ($LASTEXITCODE -ne 0) { throw '無法與 GitHub 最新版本合併，請先處理 Git 衝突。' }
    git -c "safe.directory=$repo" push origin main
    if ($LASTEXITCODE -ne 0) { throw '上傳 GitHub 失敗。' }
    Write-Output '已上傳分類來源；GitHub Actions 將自動驗證、建置及部署。'
} finally {
    Pop-Location
}
