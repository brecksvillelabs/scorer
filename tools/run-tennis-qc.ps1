param(
    [switch]$SkipSync
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$testClass = "com.brecksvillelabs.scorer.TennisPresetQcTest"
$remoteArtifacts = "/sdcard/Download/scorer-qc/tennis-reference"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outputDir = Join-Path $repoRoot "android\qc-output\$timestamp-tennis"

function Resolve-Adb {
    $cmd = Get-Command adb -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $candidate = Join-Path $env:LOCALAPPDATA "Android\Sdk\platform-tools\adb.exe"
    if (Test-Path $candidate) { return $candidate }
    throw "adb was not found. Install Android SDK Platform Tools or add platform-tools to PATH."
}


function Test-Java21Home([string]$home) {
    if ([string]::IsNullOrWhiteSpace($home)) { return $false }
    $java = Join-Path $home "bin\java.exe"
    if (-not (Test-Path $java)) { return $false }
    $versionText = (& $java -version 2>&1 | Out-String)
    return $versionText -match '(?m)(java|openjdk) version "21([\.|"])'
}

function Resolve-Java21Home {
    if (Test-Java21Home $env:JAVA_HOME) { return $env:JAVA_HOME }

    $javaOnPath = Get-Command java -ErrorAction SilentlyContinue
    if ($javaOnPath) {
        $bin = Split-Path -Parent $javaOnPath.Source
        $home = Split-Path -Parent $bin
        if (Test-Java21Home $home) { return $home }
    }

    $candidates = @(
        "C:\Program Files\Android\Android Studio\jbr"
    )

    $adoptiumRoots = @(
        (Join-Path $env:LOCALAPPDATA "Programs\Eclipse Adoptium"),
        "C:\Program Files\Eclipse Adoptium"
    )

    foreach ($root in $adoptiumRoots) {
        if (Test-Path $root) {
            $candidates += Get-ChildItem $root -Directory -Filter "jdk-21*" -ErrorAction SilentlyContinue |
                Sort-Object Name -Descending |
                ForEach-Object { $_.FullName }
        }
    }

    foreach ($candidate in $candidates) {
        if (Test-Java21Home $candidate) { return $candidate }
    }

    throw "Java 21 was not found. Install/use a JDK 21 or Android Studio JBR 21 before running Tennis QC."
}

$adb = Resolve-Adb
$java21Home = Resolve-Java21Home
$env:JAVA_HOME = $java21Home
$env:Path = "$java21Home\bin;$env:Path"
Write-Host "Using Java 21: $java21Home"

Push-Location $repoRoot
try {
    Write-Host "Checking Android emulator..."
    $state = (& $adb get-state 2>$null)
    if ($LASTEXITCODE -ne 0 -or $state.Trim() -ne "device") {
        throw "No ready Android emulator/device was found. Start the Scorer QC emulator and run this script again."
    }

    $cordovaVars = Join-Path $repoRoot "android\capacitor-cordova-android-plugins\cordova.variables.gradle"
    if ($SkipSync -and -not (Test-Path $cordovaVars)) {
        Write-Host "Generated Capacitor Android files are missing; overriding -SkipSync."
        $SkipSync = $false
    }

    if (-not $SkipSync) {
        Write-Host "Syncing packaged web assets..."
        & npm.cmd run native:sync
        if ($LASTEXITCODE -ne 0) { throw "npm run native:sync failed." }
        if (-not (Test-Path $cordovaVars)) {
            throw "Capacitor sync completed but cordova.variables.gradle was not generated."
        }
    }

    Write-Host "Removing stale Tennis QC artifacts from the emulator..."
    & $adb shell "rm -rf '$remoteArtifacts'"

    Write-Host "Running Tennis multi-preset QC..."
    $gradle = Join-Path $repoRoot "android\gradlew.bat"
    & $gradle -p android connectedDebugAndroidTest "-Pandroid.testInstrumentationRunnerArguments.class=$testClass" --stacktrace
    $testExit = $LASTEXITCODE

    New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
    Write-Host "Pulling Tennis QC artifacts..."
    & $adb pull $remoteArtifacts $outputDir
    $pullExit = $LASTEXITCODE

    Write-Host ""
    Write-Host "QC artifacts: $outputDir"
    if (Test-Path $outputDir) {
        Get-ChildItem -Path $outputDir -Recurse -File |
            Sort-Object FullName |
            ForEach-Object { Write-Host ("  " + $_.FullName) }
    }

    if ($testExit -ne 0) {
        throw "Tennis QC failed. The available screenshots/test reports were still pulled for inspection."
    }
    if ($pullExit -ne 0) {
        throw "Tennis QC passed, but artifact pull failed."
    }

    Write-Host ""
    Write-Host "BADMINTON QC PASSED"
}
finally {
    Pop-Location
}
