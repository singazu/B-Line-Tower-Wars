param(
  [int]$StartPort = 5510,
  [int]$MaxPortTries = 20,
  [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"

function Find-AvailablePort {
  param(
    [int]$StartPort,
    [int]$MaxPortTries
  )

  for ($i = 0; $i -lt $MaxPortTries; $i++) {
    $candidatePort = $StartPort + $i
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $candidatePort)
    try {
      $listener.Start()
      return $candidatePort
    } catch {
    } finally {
      try {
        $listener.Stop()
      } catch {
      }
    }
  }

  throw "Could not find an open port between $StartPort and $($StartPort + $MaxPortTries - 1)."
}

function Wait-ForUrl {
  param(
    [string]$Url,
    [int]$TimeoutSeconds = 10
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
      if ($response.StatusCode -eq 200) {
        return $true
      }
    } catch {
    }
    Start-Sleep -Milliseconds 250
  }

  return $false
}

$rootPath = [System.IO.Path]::GetFullPath($PSScriptRoot)
$port = Find-AvailablePort -StartPort $StartPort -MaxPortTries $MaxPortTries
$url = "http://127.0.0.1:$port"

Write-Host "Launching Brian Line Tower Wars..." -ForegroundColor Cyan
Write-Host "Project folder: $rootPath"
Write-Host "Server URL: $url"
Write-Host ""

$serverProcess = Start-Process powershell `
  -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', '.\preview.ps1', '-Port', $port, '-MaxPortTries', 1 `
  -WorkingDirectory $rootPath `
  -PassThru

if (-not (Wait-ForUrl -Url $url -TimeoutSeconds 10)) {
  try {
    Stop-Process -Id $serverProcess.Id -Force
  } catch {
  }
  throw "The local preview server did not become ready at $url."
}

if (-not $NoBrowser) {
  Start-Process $url
}

Write-Host "Game ready at $url" -ForegroundColor Green
Write-Host "The preview server is running in its own PowerShell window."
