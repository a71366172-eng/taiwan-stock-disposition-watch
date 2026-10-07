$ErrorActionPreference = 'Stop'
$taskName = 'TaiwanStockPersonalGroupsDaily'
$runner = Join-Path $PSScriptRoot 'run_personal_groups_daily.ps1'
$powershell = (Get-Command powershell.exe -ErrorAction Stop).Source
$arguments = '-NoProfile -ExecutionPolicy RemoteSigned -WindowStyle Hidden -File "{0}"' -f $runner
$action = New-ScheduledTaskAction -Execute $powershell -Argument $arguments
$trigger = New-ScheduledTaskTrigger -Daily -At '20:00'
$user = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 10) -ExecutionTimeLimit (New-TimeSpan -Hours 1) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description '每天 20:00 更新台股自訂細產業分類；有變更時推送 GitHub 並觸發網站部署。' -Force | Out-Null
$task = Get-ScheduledTask -TaskName $taskName
Write-Output "已建立排程：$($task.TaskName)，每天 20:00（本機時間）；目前狀態：$($task.State)"
