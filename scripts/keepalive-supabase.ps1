<#
.SYNOPSIS
  Manual Supabase keepalive for BuddyNagar (Windows PowerShell).

.DESCRIPTION
  Loads NEXT_PUBLIC_SUPABASE_URL and (optionally) NEXT_PUBLIC_SUPABASE_ANON_KEY from the
  project root .env.local only, then:
    1) GET  .../auth/v1/health  (with anon apikey headers when NEXT_PUBLIC_SUPABASE_ANON_KEY is set)
    2) GET  .../rest/v1/        with apikey header only (Bearer breaks new publishable keys on PostgREST)

  Run manually, or schedule via Windows Task Scheduler every 12 hours.

  From repo root:
    powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\keepalive-supabase.ps1

  From anywhere:
    powershell -NoProfile -ExecutionPolicy Bypass -File "C:\path\to\buddiesnagar\scripts\keepalive-supabase.ps1"

  Env: only .env.local is read (production-style keys often live there on your machine — do not commit it).
#>

$ErrorActionPreference = "Stop"

function Import-DotEnvFile {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) { return }
  Get-Content -LiteralPath $Path -Encoding UTF8 | ForEach-Object {
    $line = $_.Trim()
    if ($line -eq "" -or $line.StartsWith("#")) { return }
    $idx = $line.IndexOf("=")
    if ($idx -lt 1) { return }
    $name = $line.Substring(0, $idx).Trim()
    $val = $line.Substring($idx + 1).Trim()
    if (
      ($val.StartsWith('"') -and $val.EndsWith('"')) -or
      ($val.StartsWith("'") -and $val.EndsWith("'"))
    ) {
      $val = $val.Substring(1, $val.Length - 2)
    }
    [System.Environment]::SetEnvironmentVariable($name, $val, "Process")
  }
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$envLocal = Join-Path $projectRoot ".env.local"

if (Test-Path -LiteralPath $envLocal) {
  Import-DotEnvFile $envLocal
  [Console]::WriteLine("Loaded env: $envLocal")
} else {
  Write-Error ".env.local not found under $projectRoot. Create it or set NEXT_PUBLIC_SUPABASE_* in the process before running."
  exit 1
}

$baseUrl = [System.Environment]::GetEnvironmentVariable("NEXT_PUBLIC_SUPABASE_URL", "Process")
if ([string]::IsNullOrWhiteSpace($baseUrl)) {
  Write-Error "NEXT_PUBLIC_SUPABASE_URL is not set in .env.local (or is empty)."
  exit 1
}

$baseUrl = $baseUrl.TrimEnd("/")
$anon = [System.Environment]::GetEnvironmentVariable("NEXT_PUBLIC_SUPABASE_ANON_KEY", "Process")
if (-not [string]::IsNullOrWhiteSpace($anon)) {
  $anon = $anon.Trim()
}

# --- 1) Auth health (Supabase hosted gateway often returns 401 without anon apikey) ---
$healthUrl = "$baseUrl/auth/v1/health"
$healthHeaders = $null
if (-not [string]::IsNullOrWhiteSpace($anon)) {
  $healthHeaders = @{
    "apikey"        = $anon
    "Authorization" = "Bearer $anon"
  }
  [Console]::WriteLine("GET $healthUrl (with apikey)")
} else {
  [Console]::WriteLine("GET $healthUrl (no apikey)")
}
try {
  if ($null -ne $healthHeaders) {
    $health = Invoke-RestMethod -Uri $healthUrl -Method Get -TimeoutSec 30 -Headers $healthHeaders
  } else {
    $health = Invoke-RestMethod -Uri $healthUrl -Method Get -TimeoutSec 30
  }
  [Console]::WriteLine("Auth health OK: " + ($health | ConvertTo-Json -Compress))
} catch {
  $hint = ""
  if ([string]::IsNullOrWhiteSpace($anon)) {
    $hint = " Add NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local - hosted Supabase usually requires it for /auth/v1/health."
  }
  Write-Error "Auth health failed: $($_.Exception.Message)$hint"
  exit 1
}

# --- 2) PostgREST + Storage (optional; apikey only on REST - Bearer + publishable key => 401 on PostgREST) ---
if (-not [string]::IsNullOrWhiteSpace($anon)) {
  $restHeaders = @{
    "apikey" = $anon
    "Accept" = "application/json"
  }
  $restRoot = "$baseUrl/rest/v1/"
  [Console]::WriteLine("GET $restRoot (apikey header only)")
  try {
    $null = Invoke-WebRequest -UseBasicParsing -Uri $restRoot -Method Get -TimeoutSec 30 -Headers $restHeaders
    [Console]::WriteLine("REST ping OK (HTTP success).")
  } catch {
    $storageUrl = "$baseUrl/storage/v1/version"
    [Console]::WriteLine("REST root failed; trying $storageUrl")
    try {
      $null = Invoke-WebRequest -UseBasicParsing -Uri $storageUrl -Method Get -TimeoutSec 30 -Headers $restHeaders
      [Console]::WriteLine("Storage ping OK (HTTP success). REST root may reject this key or route; keepalive still reached the API.")
    } catch {
      Write-Error "REST and Storage ping failed: $($_.Exception.Message)"
      exit 1
    }
  }
} else {
  [Console]::WriteLine("NEXT_PUBLIC_SUPABASE_ANON_KEY not set in .env.local - skipped REST ping (auth health alone ran).")
}

[Console]::WriteLine("Done at $(Get-Date -Format 'o')")
