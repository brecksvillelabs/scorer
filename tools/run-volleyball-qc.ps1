param(
    [switch]$SkipSync
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$testClass = "com.brecksvillelabs.scorer.VolleyballRoundRobinQcTest"
$remoteArtifacts = "/sdcard/Download/scorer-qc/volleyball-reference"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outputDir = Join-Path $repoRoot "android\qc-output\$timestamp-volleyball"

Push-Location $repoRoot
try {
    Write-Host "Checking Android emulator..."
    $state = (& adb get-state 2>$null)
    if ($LASTEXITCODE -ne 0 -or $state.Trim() -ne "device") {
        throw "No ready Android emulator/device was found. Start the Scorer QC emulator and run this script again."
    }

    if (-not $SkipSync) {
        Write-Host "Syncing packaged web assets..."
        & npm run native:sync
        if ($LASTEXITCODE -ne 0) {
            throw "npm run native:sync failed."
        }
    }

    Write-Host "Removing stale Volleyball QC screenshots from the emulator..."
    & adb shell "rm -rf '$remoteArtifacts'"

    Write-Host "Running Volleyball round-robin QC..."
    $gradle = Join-Path $repoRoot "android\gradlew.bat"
    & $gradle -p android connectedDebugAndroidTest "-Pandroid.testInstrumentationRunnerArguments.class=$testClass" --stacktrace
    $testExit = $LASTEXITCODE

    New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
    Write-Host "Pulling Volleyball QC artifacts..."
    & adb pull $remoteArtifacts $outputDir
    $pullExit = $LASTEXITCODE

    Write-Host ""
    Write-Host "QC artifacts: $outputDir"
    if (Test-Path $outputDir) {
        Get-ChildItem -Path $outputDir -Recurse -File |
            Sort-Object FullName |
            ForEach-Object { Write-Host ("  " + $_.FullName) }
    }

    if ($testExit -ne 0) {
        throw "Volleyball QC failed. The available screenshots/test reports were still pulled for inspection."
    }
    if ($pullExit -ne 0) {
        throw "Volleyball QC passed, but artifact pull failed."
    }

    Write-Host ""
    Write-Host "VOLLEYBALL QC PASSED"
}
finally {
    Pop-Location
}
