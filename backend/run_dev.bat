@echo off
REM Activate venv and run Django dev server
cd /d "%~dp0"
call venv\Scripts\activate.bat
python manage.py runserver
pause
