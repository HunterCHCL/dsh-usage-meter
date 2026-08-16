# dsh-usage-meter 一键卸载脚本
# 用法：powershell -ExecutionPolicy Bypass -File .\uninstall.ps1 [-DshHome <path>] [-RemoveData]
# 功能：从 dsh.profile.bundles 移除本插件、删除 node_modules 中的插件目录；
#       加 -RemoveData 时同时删除本机用量/计价数据文件。
[CmdletBinding()]
param(
    [string]$DshHome = '',
    [switch]$RemoveData
)

$ErrorActionPreference = 'Stop'

if ($DshHome -eq '') {
    if ($env:DSH_HOME) { $DshHome = $env:DSH_HOME }
    else { $DshHome = Join-Path $HOME '.dsh' }
}
if (-not (Test-Path $DshHome)) { Write-Host "[dsh-usage-meter] DSH_HOME 不存在：$DshHome（无需卸载）"; exit 0 }

$profileDir = Join-Path $DshHome 'profiles\web'
$pkgJsonPath = Join-Path $profileDir 'package.json'
$pluginDir = Join-Path $profileDir 'node_modules\@hunterchcl\dsh-usage-meter'

if (Test-Path $pkgJsonPath) {
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $bakPath = "$pkgJsonPath.bak-$stamp"
    Copy-Item $pkgJsonPath $bakPath -Force
    Write-Host "[dsh-usage-meter] 已备份 package.json -> $bakPath"

    $pkg = Get-Content $pkgJsonPath -Raw | ConvertFrom-Json
    if ($pkg.dsh -and $pkg.dsh.profile -and $pkg.dsh.profile.bundles) {
        $bundles = @($pkg.dsh.profile.bundles | Where-Object { $_ -ne '@hunterchcl/dsh-usage-meter' })
        $pkg.dsh.profile.bundles = @($bundles)
        $json = $pkg | ConvertTo-Json -Depth 10
        [System.IO.File]::WriteAllText($pkgJsonPath, $json, (New-Object System.Text.UTF8Encoding($false)))
        Write-Host "[dsh-usage-meter] 已从 bundles 移除。"
    }
}

if (Test-Path $pluginDir) {
    Remove-Item $pluginDir -Recurse -Force
    Write-Host "[dsh-usage-meter] 已删除 $pluginDir"
}

if ($RemoveData) {
    Remove-Item (Join-Path $DshHome 'dsh-client-usage.json') -Force -ErrorAction SilentlyContinue
    Remove-Item (Join-Path $DshHome 'dsh-client-pricing.json') -Force -ErrorAction SilentlyContinue
    Write-Host "[dsh-usage-meter] 已删除本机用量/计价数据文件。"
} else {
    Write-Host "[dsh-usage-meter] 保留数据文件（如需删除请加 -RemoveData）："
    Write-Host "  $DshHome\dsh-client-usage.json"
    Write-Host "  $DshHome\dsh-client-pricing.json"
}

Write-Host ''
Write-Host '[dsh-usage-meter] 卸载完成。重启 DSH web 后完全生效。'
Read-Host ' 按回车键退出...'
