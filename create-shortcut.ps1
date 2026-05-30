# Run this script once on any Windows machine to create a desktop shortcut
# Usage: Right-click -> "Run with PowerShell"

$projectPath = Split-Path -Parent $MyInvocation.MyCommand.Definition
$desktop     = [Environment]::GetFolderPath("Desktop")
$shortcutPath = "$desktop\GST Billing Dev.lnk"

$shell    = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath      = "cmd.exe"
$shortcut.Arguments       = "/k `"cd /d `"$projectPath`" && npm run dev`""
$shortcut.WorkingDirectory = $projectPath
$shortcut.WindowStyle     = 1
$shortcut.Description     = "Start GST Billing Dev Server"
$shortcut.Save()

Write-Host "Shortcut created at: $shortcutPath"
