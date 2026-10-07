$ErrorActionPreference = 'Stop'
$logPath = 'D:\AI\trading\STOCK\personal-groups-update.log'
$publisher = Join-Path $PSScriptRoot 'publish_personal_groups.ps1'
Add-Content -LiteralPath $logPath -Encoding UTF8 -Value "[$([datetime]::Now.ToString('yyyy-MM-dd HH:mm:ss'))] 開始每日分類更新。"
try {
    & $publisher *>> $logPath
    Add-Content -LiteralPath $logPath -Encoding UTF8 -Value "[$([datetime]::Now.ToString('yyyy-MM-dd HH:mm:ss'))] 每日分類更新完成。"
} catch {
    Add-Content -LiteralPath $logPath -Encoding UTF8 -Value "[$([datetime]::Now.ToString('yyyy-MM-dd HH:mm:ss'))] 更新失敗：$($_.Exception.Message)"
    exit 1
}
