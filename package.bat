@echo off
echo ===================================
echo Empacotando Gestor de Contas BETS
echo para distribuicao
echo ===================================

REM Build
echo Iniciando build...
call build_onefile.bat

REM Criar pasta de release
echo Criando pasta de release...
if not exist release mkdir release

REM Limpar pasta release anterior
del /Q release\*.* 2>nul

REM Copiar .exe para pasta de release
echo Copiando executavel...
copy dist\GestorContasBETS.exe release\

REM Criar arquivo de instrucoes
echo Criando arquivo de instrucoes...
(
echo Gestor de Contas BETS v1.0.0
echo.
echo ========================================
echo COMO INSTALAR
echo ========================================
echo.
echo 1. Baixe o arquivo GestorContasBETS.exe
echo 2. Mova para uma pasta de sua preferencia
echo    (ex: Documentos ou Desktop)
echo 3. Execute o arquivo .exe
echo 4. Na primeira vez, crie sua conta
echo.
echo ========================================
echo SEUS DADOS
echo ========================================
echo.
echo Seus dados serao salvos em:
echo %%APPDATA%%\GestorContasBETS\
echo.
echo Para acessar: Pressione Win+R, digite:
echo %%APPDATA%%\GestorContasBETS
echo.
echo ========================================
echo PARA ATUALIZAR
echo ========================================
echo.
echo 1. Feche o aplicativo
echo 2. Baixe a nova versao do .exe
echo 3. Substitua o .exe antigo pelo novo
echo 4. Seus dados serao mantidos automaticamente
echo.
echo ========================================
echo SUPORTE
echo ========================================
echo.
echo Em caso de problemas, entre em contato
echo com o desenvolvedor.
echo.
echo Versao: 1.0.0
echo Data: 2025-04-01
) > release\INSTRUCOES.txt

echo.
echo ===================================
echo Pacote criado com sucesso!
echo.
echo Arquivo: release\GestorContasBETS.exe
echo Instrucoes: release\INSTRUCOES.txt
echo.
echo Envie a pasta release\ para seus amigos
echo ===================================

REM Perguntar se quer criar ZIP
set /p create_zip=Deseja criar arquivo ZIP para facilitar o envio? (S/N):
if /i "%create_zip%"=="S" (
    echo.
    echo Criando arquivo ZIP...
    powershell Compress-Archive -Path release\ -DestinationPath GestorContasBETS-v1.0.0.zip -Force
    echo.
    echo ZIP criado: GestorContasBETS-v1.0.0.zip
    echo.
)

pause
