# build_apk.ps1
# Automated Native Android Build & Toolchain Setup for AtomProtect Commander
$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  ATOMPROTECT NATIVE ANDROID BUILDER AND TOOLCHAIN SETUP  " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$WorkspaceRoot = $PSScriptRoot
$MobileDir = Join-Path $WorkspaceRoot "mobile"
$AndroidDir = Join-Path $MobileDir "android"
$TargetApkOutput = Join-Path $WorkspaceRoot "AtomProtect-Admin.apk"

# Step 1: Verify & Locate Java JDK 17
Write-Host "`n[1/6] Verifying Java Development Kit (JDK 17)..." -ForegroundColor Yellow

function Find-JavaHome {
    if ($env:JAVA_HOME -and (Test-Path "$env:JAVA_HOME\bin\javac.exe")) {
        return $env:JAVA_HOME
    }
    
    $commonPaths = @(
        "$env:LOCALAPPDATA\Programs\Java\jdk-17*",
        "C:\Program Files\Microsoft\jdk-17*",
        "C:\Program Files\Eclipse Adoptium\jdk-17*",
        "C:\Program Files\Java\jdk-17*",
        "C:\Program Files\Java\jdk-21*",
        "$env:LOCALAPPDATA\Programs\Eclipse Adoptium\jdk-17*"
    )
    
    foreach ($pattern in $commonPaths) {
        $found = Get-Item -Path $pattern -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($found -and (Test-Path "$($found.FullName)\bin\javac.exe")) {
            return $found.FullName
        }
    }
    return $null
}

$javaHome = Find-JavaHome

if (-not $javaHome) {
    Write-Host "JDK 17 not found. Attempting automated installation via winget..." -ForegroundColor Yellow
    try {
        winget install --id Microsoft.OpenJDK.17 --silent --accept-package-agreements --accept-source-agreements
        Start-Sleep -Seconds 3
        $javaHome = Find-JavaHome
    } catch {
        Write-Host "Winget install encountered an issue: $_" -ForegroundColor Red
    }
}

if ($javaHome) {
    $env:JAVA_HOME = $javaHome
    $env:PATH = "$javaHome\bin;$env:PATH"
    Write-Host "[OK] Found Java: $env:JAVA_HOME" -ForegroundColor Green
} else {
    Write-Host "[!] JDK 17 could not be automatically located." -ForegroundColor Yellow
    Write-Host "Please install OpenJDK 17 using: winget install Microsoft.OpenJDK.17" -ForegroundColor Yellow
}

# Step 2: Verify and Locate Android SDK
Write-Host "[2/6] Verifying Android SDK..." -ForegroundColor Yellow

$defaultSdkPath = "$env:LOCALAPPDATA\Android\Sdk"
if (-not $env:ANDROID_HOME -or -not (Test-Path $env:ANDROID_HOME)) {
    if (Test-Path $defaultSdkPath) {
        $env:ANDROID_HOME = $defaultSdkPath
    }
}

if ($env:ANDROID_HOME -and (Test-Path $env:ANDROID_HOME)) {
    Write-Host "[OK] Found Android SDK: $env:ANDROID_HOME" -ForegroundColor Green
} else {
    Write-Host "Android SDK directory not found at $defaultSdkPath." -ForegroundColor Yellow
    Write-Host "Setting target SDK location to $defaultSdkPath..." -ForegroundColor Yellow
    $env:ANDROID_HOME = $defaultSdkPath
    New-Item -ItemType Directory -Path $defaultSdkPath -Force | Out-Null
}

# Step 3: Build Web Assets with Vite
Write-Host "[3/6] Building Mobile Web Assets..." -ForegroundColor Yellow
Set-Location $MobileDir
cmd.exe /c "npm.cmd run build"
if ($LASTEXITCODE -ne 0) {
    throw "Vite build failed with exit code $LASTEXITCODE"
}
Write-Host "[OK] Web assets compiled to mobile/dist" -ForegroundColor Green

# Step 4: Sync Capacitor Android
Write-Host "[4/6] Initializing and Syncing Capacitor Android Project..." -ForegroundColor Yellow
if (-not (Test-Path $AndroidDir)) {
    Write-Host "Adding Android platform..." -ForegroundColor Yellow
    cmd.exe /c "npx.cmd cap add android"
}
cmd.exe /c "npx.cmd cap sync android"
if ($LASTEXITCODE -ne 0) {
    throw "Capacitor sync failed with exit code $LASTEXITCODE"
}
Write-Host "[OK] Android native project synced" -ForegroundColor Green

# Step 5: Check SDK and Compile APK with Gradle
Write-Host "[5/6] Compiling Native Android APK with Gradle..." -ForegroundColor Yellow
Set-Location $AndroidDir

# Ensure local.properties points to Android SDK
$localProperties = Join-Path $AndroidDir "local.properties"
$escapedSdk = $env:ANDROID_HOME.Replace("\", "\\")
"sdk.dir=$escapedSdk" | Set-Content -Path $localProperties -Encoding UTF8

if (Test-Path ".\gradlew.bat") {
    cmd.exe /c "gradlew.bat assembleDebug"
    $gradleExit = $LASTEXITCODE
    
    if ($gradleExit -eq 0) {
        $builtApk = Join-Path $AndroidDir "app\build\outputs\apk\debug\app-debug.apk"
        if (Test-Path $builtApk) {
            Copy-Item -Path $builtApk -Destination $TargetApkOutput -Force
            Write-Host "`n==========================================================" -ForegroundColor Green
            Write-Host "  [SUCCESS] COMPILED APK READY FOR DOWNLOAD:             " -ForegroundColor Green
            Write-Host "  $TargetApkOutput" -ForegroundColor White
            Write-Host "==========================================================" -ForegroundColor Green
        }
    } else {
        Write-Host "Gradle build finished with code $gradleExit." -ForegroundColor Yellow
        Write-Host "If Android SDK licenses or platforms are missing, you can also push to GitHub" -ForegroundColor Yellow
        Write-Host "to have GitHub Actions compile the APK automatically in the cloud!" -ForegroundColor Yellow
    }
} else {
    Write-Host "gradlew.bat not found in $AndroidDir." -ForegroundColor Red
}

Set-Location $WorkspaceRoot
