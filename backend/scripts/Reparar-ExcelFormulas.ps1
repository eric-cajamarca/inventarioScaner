# Repara / reabre un .xlsx con Excel (COM): Workbooks.Open con CorruptLoad (reparar o extraer datos).
# Libros cifrados (p. ej. MSMAMARPCRYPT): Excel no los abre sin la contraseña correcta; pasa -Password "...".
# Nota: PowerShell enlaza mal Workbooks.Open con muchos argumentos; este script usa InvokeMember.
#
# powershell -ExecutionPolicy Bypass -File .\Reparar-ExcelFormulas.ps1
# powershell -ExecutionPolicy Bypass -File .\Reparar-ExcelFormulas.ps1 -Password "clave"

param(
    [string] $Entrada = "",
    [string] $Salida = "",
    [string] $Password = ""
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
if (-not $Entrada) {
    $Entrada = Join-Path $repoRoot "FORMULAS HS NEW 2025.xlsx"
}
if (-not $Salida) {
    $Salida = Join-Path $repoRoot "FORMULAS_HS_REPARADO.xlsx"
}

$pathIn = [string] $Entrada
$pathOut = [string] $Salida

if (-not (Test-Path -LiteralPath $pathIn)) {
    throw "No existe el archivo de entrada: $pathIn"
}

$dirOut = Split-Path $pathOut -Parent
if ($dirOut -and -not (Test-Path -LiteralPath $dirOut)) {
    New-Item -ItemType Directory -Path $dirOut -Force | Out-Null
}

$miss = [System.Type]::Missing
$modes = @(
    @{ Name = "xlRepairFile(1)"; Value = 1 },
    @{ Name = "xlExtractData(2)"; Value = 2 },
    @{ Name = "xlNormalLoad(0)"; Value = 0 }
)

function Open-WorkbookWithCorruptLoad {
    param(
        $Excel,
        [string] $Path,
        [int] $CorruptLoad,
        [string] $Pwd
    )
    $pwdArg = if ($Pwd) { $Pwd } else { $miss }
    # 15 argumentos (Filename + 14). Misma disposición que _test-excel-invoke.ps1; Password = índice 4 tras Filename.
    $openArgs = @(
        $Path,
        0,
        $false,
        $miss,
        $pwdArg,
        $miss,
        $true,
        $miss,
        $miss,
        $false,
        $false,
        $miss,
        $false,
        $miss,
        $CorruptLoad
    )
    return $Excel.Workbooks.GetType().InvokeMember(
        'Open',
        [System.Reflection.BindingFlags]::InvokeMethod,
        $null,
        $Excel.Workbooks,
        $openArgs
    )
}

$excel = $null
$wb = $null

try {
    Write-Host "Entrada:  $pathIn"
    Write-Host "Salida:   $pathOut"

    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    $excel.ScreenUpdating = $false

    $opened = $false
    $lastErr = ""

    foreach ($m in $modes) {
        Write-Host ""
        Write-Host "Intento: $($m.Name)"

        if ($null -ne $wb) {
            try { $wb.Close($false) } catch { }
            try { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($wb) } catch { }
            $wb = $null
        }

        try {
            $wb = Open-WorkbookWithCorruptLoad -Excel $excel -Path $pathIn -CorruptLoad $m.Value -Pwd $Password
            if ($null -eq $wb) {
                throw "Open devolvió null"
            }
            $opened = $true
            Write-Host "Apertura correcta con $($m.Name)"
            break
        } catch {
            $lastErr = $_.Exception.Message
            Write-Warning "Fallo: $lastErr"
        }
    }

    if (-not $opened) {
        throw "Excel no pudo abrir el archivo con ningún CorruptLoad. Último error: $lastErr"
    }

    $xlOpenXMLWorkbook = 51
    if (Test-Path -LiteralPath $pathOut) {
        Remove-Item -LiteralPath $pathOut -Force
    }

    $wb.SaveAs($pathOut, $xlOpenXMLWorkbook)
    $wb.Close($false)
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($wb)
    $wb = $null

    Write-Host ""
    Write-Host "OK: guardado en $pathOut"

    $head = [byte[]]::new(4)
    $fs = [System.IO.File]::OpenRead($pathOut)
    try {
        [void] $fs.Read($head, 0, 4)
    } finally {
        $fs.Dispose()
    }
    Write-Host "Primeros bytes: $([System.BitConverter]::ToString($head)) (esperado 50-4B-03-04 para .xlsx estándar)"
    exit 0
}
catch {
    Write-Error $_
    exit 1
}
finally {
    if ($null -ne $wb) {
        try { $wb.Close($false) } catch { }
        try { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($wb) } catch { }
    }
    if ($null -ne $excel) {
        try { $excel.Quit() } catch { }
        try { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) } catch { }
    }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
