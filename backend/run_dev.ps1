# PowerShell script to activate venv and run Django dev server
Set-Location $PSScriptRoot
& .\venv\Scripts\Activate.ps1
python manage.py runserver
