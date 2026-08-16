@echo off
rem ============================================
rem  打开 PowerShell 并切换到当前文件所在目录
rem ============================================

rem 获取当前批处理文件所在目录（%~dp0 末尾带反斜杠）
set "CURDIR=%~dp0"

rem 去掉末尾的反斜杠，避免引号/路径拼接问题
if "%CURDIR:~-1%"=="\" set "CURDIR=%CURDIR:~0,-1%"

rem 启动 PowerShell，并在其中切换到该目录
start "" powershell.exe -NoExit -Command "Set-Location -LiteralPath '%CURDIR%'"
