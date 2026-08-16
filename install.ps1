# dsh-usage-meter 一键安装脚本
# 用法：powershell -ExecutionPolicy Bypass -File .\install.ps1 [-DshHome <path>]
# 功能：把本插件复制到 DSH web profile 的 node_modules，并加入 dsh.profile.bundles。
[CmdletBinding()]
param(
    [string]$DshHome = '',
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

if ($DshHome -eq '') {
    if ($env:DSH_HOME) { $DshHome = $env:DSH_HOME }
    else { $DshHome = Join-Path $HOME '.dsh' }
}
if (-not (Test-Path $DshHome)) { Write-Error "DSH_HOME 不存在：$DshHome"; exit 1 }

$profileDir = Join-Path $DshHome 'profiles\web'
if (-not (Test-Path $profileDir)) { Write-Error "未找到 DSH web profile：$profileDir"; exit 1 }

$pkgJsonPath = Join-Path $profileDir 'package.json'
$pluginDir = Join-Path $profileDir 'node_modules\@hunterchcl\dsh-usage-meter'
$srcDir = $PSScriptRoot

# 1) 备份 profile 的 package.json
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$bakPath = "$pkgJsonPath.bak-$stamp"
Copy-Item $pkgJsonPath $bakPath -Force
Write-Host "[dsh-usage-meter] 已备份 package.json -> $bakPath"

# 2) 复制插件文件到 profile node_modules
if (Test-Path $pluginDir) {
    if (-not $Force) {
        Write-Host "[dsh-usage-meter] 检测到已安装，将覆盖更新。"
    }
    Remove-Item $pluginDir -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $pluginDir | Out-Null
foreach ($f in @('package.json', 'host.js', 'client.js', 'cordis.patch.yml')) {
    Copy-Item (Join-Path $srcDir $f) (Join-Path $pluginDir $f) -Force
}
Write-Host "[dsh-usage-meter] 已复制插件到 $pluginDir"

# 3) 读取并更新 profile package.json 的 dsh.profile.bundles
$pkg = Get-Content $pkgJsonPath -Raw | ConvertFrom-Json
if (-not $pkg.dsh) { $pkg | Add-Member -NotePropertyName dsh -NotePropertyValue ([pscustomobject]@{}) -Force }
if (-not $pkg.dsh.profile) { $pkg.dsh | Add-Member -NotePropertyName profile -NotePropertyValue ([pscustomobject]@{}) -Force }
if (-not $pkg.dsh.profile.bundles) { $pkg.dsh.profile | Add-Member -NotePropertyName bundles -NotePropertyValue @() -Force }

$bundles = @($pkg.dsh.profile.bundles)
if ($bundles -notcontains '@hunterchcl/dsh-usage-meter') { $bundles += '@hunterchcl/dsh-usage-meter' }
$pkg.dsh.profile.bundles = @($bundles)

$json = $pkg | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText($pkgJsonPath, $json, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "[dsh-usage-meter] 已更新 bundles：$pkgJsonPath"

Write-Host ''
Write-Host '[dsh-usage-meter] 安装完成。重启 DSH web（或新开一个会话）后生效。'
Write-Host '  卸载：运行 .\uninstall.ps1'
Read-Host '按回车键退出...'
