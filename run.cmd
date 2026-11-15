@echo off
setlocal

set "CSC=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if not exist "%CSC%" set "CSC=%WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe"
if not exist "%CSC%" (
    echo .NET Framework C# compiler was not found.
    exit /b 1
)

set "IMPORTER=%TEMP%\VistaDataImport.exe"
"%CSC%" /nologo /target:exe /r:System.IO.Compression.dll /r:System.IO.Compression.FileSystem.dll /r:System.Web.Extensions.dll /out:"%IMPORTER%" "%~dp0src\Vista.DataImport\Program.cs"
if errorlevel 1 exit /b 1
"%IMPORTER%" "%~dp0Doc\Product SKUs (68).xlsx" "%~dp0src\Vista.Web\data\products.json"
if errorlevel 1 exit /b 1

set "SERVER=%TEMP%\VistaServer.exe"
"%CSC%" /nologo /target:exe /out:"%SERVER%" ^
    "%~dp0src\Vista.Server\Program.cs" ^
    "%~dp0src\Vista.Server\Application\CurrentUser.cs" ^
    "%~dp0src\Vista.Server\Application\GetCurrentUser.cs" ^
    "%~dp0src\Vista.Server\Infrastructure\Http\DashboardRequestHandler.cs"
if errorlevel 1 exit /b 1

"%SERVER%" "%~dp0src\Vista.Web"
