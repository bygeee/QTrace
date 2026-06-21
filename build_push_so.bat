@echo off
setlocal

set "ROOT=%~dp0"
set "SO_PATH=%ROOT%nativelib\build\intermediates\stripped_native_libs\debug\out\lib\arm64-v8a\libnativelib.so"
set "REMOTE_PATH=/data/local/tmp/libnativelib.so"

cd /d "%ROOT%"

echo [1/3] Building nativelib debug so...
call "%ROOT%gradlew.bat" :nativelib:assembleDebug
if errorlevel 1 (
    echo Build failed.
    exit /b 1
)

if not exist "%SO_PATH%" (
    echo Built so not found:
    echo %SO_PATH%
    exit /b 1
)

if defined ADB (
    set "ADB_EXE=%ADB%"
) else if defined ANDROID_HOME (
    set "ADB_EXE=%ANDROID_HOME%\platform-tools\adb.exe"
) else if defined ANDROID_SDK_ROOT (
    set "ADB_EXE=%ANDROID_SDK_ROOT%\platform-tools\adb.exe"
) else (
    set "ADB_EXE=adb"
)

echo [2/3] Checking adb...
"%ADB_EXE%" version >nul 2>&1
if errorlevel 1 (
    echo adb not found. Set ADB, ANDROID_HOME, ANDROID_SDK_ROOT, or add adb to PATH.
    exit /b 1
)

echo [3/3] Pushing so to %REMOTE_PATH%...
"%ADB_EXE%" push "%SO_PATH%" "%REMOTE_PATH%"
if errorlevel 1 (
    echo adb push failed.
    exit /b 1
)

echo Done: %REMOTE_PATH%
endlocal
