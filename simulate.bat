@echo off
rem Usage: simulate.bat [-38.04,144.47 ^| YMAV] [alt_ft] [track_degM] [gs_kt]
set POS=%~1& if "%POS%"=="" set POS=YMAV
set ALT=%~2& if "%ALT%"=="" set ALT=1500
set TRK=%~3
set GS=%~4& if "%GS%"=="" set GS=0
cd /d "%~dp0app"
start "" "http://localhost:8765/index.html?sim=%POS%&alt=%ALT%&trk=%TRK%&gs=%GS%"
python -m http.server 8765
