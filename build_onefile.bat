@echo off
echo ===================================
echo Criando Gestor de Contas BETS .exe
echo ===================================

REM Criar ambiente virtual se não existe
if not exist venv (
    echo Criando ambiente virtual...
    python -m venv venv
)

REM Ativar ambiente virtual
echo Ativando ambiente virtual...
call venv\Scripts\activate

REM Instalar dependências
echo Instalando dependências...
pip install -r requirements.txt
pip install pyinstaller

REM Limpar builds anteriores
echo Limpando builds anteriores...
rmdir /s /q build dist 2>nul

REM Criar executavel one-file (arquivo unico)
echo Criando executavel one-file...
pyinstaller --onefile --windowed ^
    --add-data "templates;templates" ^
    --add-data "static;static" ^
    --hidden-import werkzeug.security ^
    --hidden-import sqlite3 ^
    --name "GestorContasBETS" ^
    app.py

echo ===================================
echo Build concluido com sucesso!
echo Executavel: dist\GestorContasBETS.exe
echo ===================================
pause
