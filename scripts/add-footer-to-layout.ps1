$ErrorActionPreference = "Stop"

$layoutPath = Join-Path $PSScriptRoot "..\app\layout.tsx"
$footerPath = Join-Path $PSScriptRoot "..\components\SiteFooter.tsx"

if (!(Test-Path $footerPath)) {
  Write-Host "ERROR: components\SiteFooter.tsx was not found."
  exit 1
}

if (!(Test-Path $layoutPath)) {
  Write-Host "ERROR: app\layout.tsx was not found. Upload/send app\layout.tsx so it can be patched safely."
  exit 1
}

$content = Get-Content $layoutPath -Raw -Encoding UTF8
$original = $content

# Add import if missing
if ($content -notmatch 'SiteFooter') {
  $importLine = 'import SiteFooter from "@/components/SiteFooter";' + "`r`n"

  if ($content -match '(?s)^(\s*(?:import\s+[^;]+;\s*)+)') {
    $content = [regex]::Replace($content, '(?s)^(\s*(?:import\s+[^;]+;\s*)+)', '$1' + $importLine, 1)
  } else {
    $content = $importLine + $content
  }
}

# Add footer after {children} if not already used as JSX
if ($content -notmatch '<SiteFooter\s*/>') {
  if ($content -match '\{children\}') {
    $content = [regex]::Replace($content, '\{children\}', "{children}`r`n        <SiteFooter />", 1)
  } else {
    Write-Host "ERROR: Could not find {children} inside app\layout.tsx. Footer was not inserted."
    exit 1
  }
}

if ($content -ne $original) {
  Set-Content -Path $layoutPath -Value $content -Encoding UTF8
  Write-Host "SUCCESS: SiteFooter was added to app\layout.tsx"
} else {
  Write-Host "SKIPPED: SiteFooter already exists in app\layout.tsx"
}
