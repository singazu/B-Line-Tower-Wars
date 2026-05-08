param(
  [int]$Port = 5500,
  [int]$MaxPortTries = 20
)

$ErrorActionPreference = "Stop"

function Get-ContentType {
  param([string]$FilePath)

  switch ([System.IO.Path]::GetExtension($FilePath).ToLowerInvariant()) {
    ".html" { return "text/html; charset=utf-8" }
    ".css" { return "text/css; charset=utf-8" }
    ".js" { return "application/javascript; charset=utf-8" }
    ".json" { return "application/json; charset=utf-8" }
    ".png" { return "image/png" }
    ".jpg" { return "image/jpeg" }
    ".jpeg" { return "image/jpeg" }
    ".gif" { return "image/gif" }
    ".svg" { return "image/svg+xml" }
    ".ico" { return "image/x-icon" }
    default { return "application/octet-stream" }
  }
}

function Send-HttpResponse {
  param(
    [Parameter(Mandatory = $true)]$Stream,
    [int]$StatusCode,
    [string]$Reason,
    [byte[]]$BodyBytes,
    [string]$ContentType = "text/plain; charset=utf-8"
  )

  $header = "HTTP/1.1 $StatusCode $Reason`r`nContent-Type: $ContentType`r`nContent-Length: $($BodyBytes.Length)`r`nConnection: close`r`n`r`n"
  $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
  $Stream.Write($headerBytes, 0, $headerBytes.Length)
  if ($BodyBytes.Length -gt 0) {
    $Stream.Write($BodyBytes, 0, $BodyBytes.Length)
  }
}

function Get-DefaultStatsJson {
  return @'
{
  "updatedAt": null,
  "unitScores": {
    "total": { "imp": 0, "runner": 0, "brute": 0, "wisp": 0, "tank": 0 },
    "player": { "imp": 0, "runner": 0, "brute": 0, "wisp": 0, "tank": 0 },
    "ai": { "imp": 0, "runner": 0, "brute": 0, "wisp": 0, "tank": 0 }
  },
  "towerKills": {
    "total": { "violet": 0, "yellow": 0, "red": 0, "green": 0, "blue": 0 },
    "player": { "violet": 0, "yellow": 0, "red": 0, "green": 0, "blue": 0 },
    "ai": { "violet": 0, "yellow": 0, "red": 0, "green": 0, "blue": 0 }
  },
  "matchUsage": {
    "attackers": {
      "used": { "imp": 0, "runner": 0, "brute": 0, "wisp": 0, "tank": 0 },
      "winningTeamUsed": { "imp": 0, "runner": 0, "brute": 0, "wisp": 0, "tank": 0 }
    },
    "towers": {
      "used": { "violet": 0, "yellow": 0, "red": 0, "green": 0, "blue": 0 },
      "winningTeamUsed": { "violet": 0, "yellow": 0, "red": 0, "green": 0, "blue": 0 }
    }
  }
}
'@
}

function Get-StatsPath {
  param([string]$RootPath)
  return Join-Path $RootPath "match-stats.json"
}

function Ensure-StatsFile {
  param([string]$RootPath)

  $statsPath = Get-StatsPath -RootPath $RootPath
  if (-not (Test-Path -LiteralPath $statsPath -PathType Leaf)) {
    [System.IO.File]::WriteAllText($statsPath, (Get-DefaultStatsJson), [System.Text.Encoding]::UTF8)
  }
  return $statsPath
}

$rootPath = [System.IO.Path]::GetFullPath($PSScriptRoot)

Write-Host "Starting local preview server for simple-clicker-game..." -ForegroundColor Cyan
Write-Host "Project folder: $rootPath"
Write-Host "Starting port: $Port"

$listener = $null
$activePort = $Port
$started = $false

for ($i = 0; $i -lt $MaxPortTries; $i++) {
  $candidatePort = $Port + $i
  $candidate = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $candidatePort)
  try {
    $candidate.Start()
    $listener = $candidate
    $activePort = $candidatePort
    $started = $true
    break
  } catch {
    $candidate.Stop()
  }
}

if (-not $started) {
  Write-Host ""
  Write-Host "Could not start local server on ports $Port to $($Port + $MaxPortTries - 1)." -ForegroundColor Red
  Write-Host "Try a different start port: .\preview.ps1 -Port 5600"
  exit 1
}

$url = "http://127.0.0.1:$activePort"
if ($activePort -ne $Port) {
  Write-Host "Port $Port was busy, switched to port $activePort."
}

Write-Host ""
Write-Host "Server is running. Keep this window open." -ForegroundColor Green
Write-Host "Open this URL in your browser: $url"
Write-Host "Press Ctrl + C to stop."
Write-Host ""

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()

    try {
      $stream = $client.GetStream()
      $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8, $false, 1024, $true)

      $requestLine = $reader.ReadLine()
      if ([string]::IsNullOrWhiteSpace($requestLine)) {
        continue
      }

      $parts = $requestLine.Split(" ")
      $method = "GET"
      $requestPath = "/"
      if ($parts.Length -ge 1) {
        $method = $parts[0].ToUpperInvariant()
      }
      if ($parts.Length -ge 2) {
        $requestPath = [Uri]::UnescapeDataString($parts[1])
        if ($requestPath -match '^https?://') {
          try {
            $requestPath = ([Uri]$requestPath).AbsolutePath
          } catch {
          }
        }
      }
      $requestPath = $requestPath.Trim()
      if ($requestPath.Length -gt 1) {
        $requestPath = $requestPath.TrimEnd("/")
      }
      if ([string]::IsNullOrWhiteSpace($requestPath)) {
        $requestPath = "/"
      }

      $headers = @{}
      while (($line = $reader.ReadLine()) -ne $null -and $line -ne "") {
        $separator = $line.IndexOf(":")
        if ($separator -gt 0) {
          $name = $line.Substring(0, $separator).Trim()
          $value = $line.Substring($separator + 1).Trim()
          $headers[$name] = $value
        }
      }

      $bodyText = ""
      $contentLength = 0
      if ($headers.ContainsKey("Content-Length")) {
        [int]::TryParse($headers["Content-Length"], [ref]$contentLength) | Out-Null
      }
      if ($contentLength -gt 0) {
        $buffer = New-Object char[] $contentLength
        $read = 0
        while ($read -lt $contentLength) {
          $count = $reader.Read($buffer, $read, $contentLength - $read)
          if ($count -le 0) {
            break
          }
          $read += $count
        }
        $bodyText = New-Object string($buffer, 0, $read)
      }

      if ($requestPath -eq "/stats") {
        $statsPath = Ensure-StatsFile -RootPath $rootPath

        if ($method -eq "GET") {
          $bytes = [System.IO.File]::ReadAllBytes($statsPath)
          Send-HttpResponse -Stream $stream -StatusCode 200 -Reason "OK" -BodyBytes $bytes -ContentType "application/json; charset=utf-8"
          continue
        }

        if ($method -eq "POST") {
          try {
            $null = $bodyText | ConvertFrom-Json
            [System.IO.File]::WriteAllText($statsPath, $bodyText, [System.Text.Encoding]::UTF8)
            $bytes = [System.Text.Encoding]::UTF8.GetBytes('{"ok":true}')
            Send-HttpResponse -Stream $stream -StatusCode 200 -Reason "OK" -BodyBytes $bytes -ContentType "application/json; charset=utf-8"
          } catch {
            $bytes = [System.Text.Encoding]::UTF8.GetBytes('{"ok":false,"error":"Invalid JSON"}')
            Send-HttpResponse -Stream $stream -StatusCode 400 -Reason "Bad Request" -BodyBytes $bytes -ContentType "application/json; charset=utf-8"
          }
          continue
        }

        $bytes = [System.Text.Encoding]::UTF8.GetBytes("405 Method Not Allowed")
        Send-HttpResponse -Stream $stream -StatusCode 405 -Reason "Method Not Allowed" -BodyBytes $bytes
        continue
      }

      if ($requestPath -eq "/") {
        $requestPath = "/index.html"
      }

      $relativePath = $requestPath.TrimStart("/").Replace("/", "\")
      $fullPath = [System.IO.Path]::GetFullPath((Join-Path $rootPath $relativePath))

      if (-not $fullPath.StartsWith($rootPath, [System.StringComparison]::OrdinalIgnoreCase)) {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes("403 Forbidden")
        Send-HttpResponse -Stream $stream -StatusCode 403 -Reason "Forbidden" -BodyBytes $bytes
        continue
      }

      if (Test-Path -LiteralPath $fullPath -PathType Leaf) {
        $bytes = [System.IO.File]::ReadAllBytes($fullPath)
        $contentType = Get-ContentType -FilePath $fullPath
        Send-HttpResponse -Stream $stream -StatusCode 200 -Reason "OK" -BodyBytes $bytes -ContentType $contentType
      } else {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
        Send-HttpResponse -Stream $stream -StatusCode 404 -Reason "Not Found" -BodyBytes $bytes
      }
    } finally {
      if ($client.Connected) {
        $client.Close()
      }
    }
  }
} finally {
  if ($listener) {
    $listener.Stop()
  }
}
