$ErrorActionPreference = "Stop"

$pagePath = Join-Path $PSScriptRoot "..\app\page.tsx"

if (!(Test-Path $pagePath)) {
  Write-Host "ERROR: app\page.tsx was not found."
  exit 1
}

$lines = Get-Content $pagePath -Encoding UTF8
$newLines = New-Object System.Collections.Generic.List[string]
$removed = $false

for ($i = 0; $i -lt $lines.Count; $i++) {
  $line = $lines[$i]

  if ($line -match "\{\/\*\s*FOOTER\s*\*\/\}" -and ($i + 4) -lt $lines.Count -and ($lines[$i + 2] -match "إدارة المنصة" -or $lines[$i + 3] -match "جميع الحقوق محفوظة")) {
    # Skip the old compact footer block: comment + opening div + 2 inner divs + closing div
    $i += 4
    $removed = $true
    continue
  }

  $newLines.Add($line)
}

if ($removed) {
  Set-Content -Path $pagePath -Value $newLines -Encoding UTF8
  Write-Host "SUCCESS: Old home footer was removed from app\page.tsx"
} else {
  Write-Host "SKIPPED: Old footer block was not found or was already removed."
}
