@echo off
rem Build SRTM terrain tiles for the app. Example: fetch_srtm.bat --around=-38.15,144.36,300
python "%~dp0tools\fetch_srtm.py" %*
pause
