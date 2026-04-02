# Instruções de Build - Gestor de Contas BETS (.exe)

## 🎯 Visão Geral

Este guia explica como compilar o aplicativo Flask em um executável .exe Windows standalone (offline).

## 📋 Pré-requisitos

- **Python 3.8+** instalado no Windows
- Acesso ao terminal/linha de comando
- Permissões para criar arquivos/pastas

## 🚀 Como Compilar

### Método 1: Usar o Script Automático (Recomendado)

1. **Abra o terminal** na pasta do projeto

2. **Execute o script de empacotamento:**
   ```batch
   package.bat
   ```

3. **Aguarde o processo:**
   - O script criará ambiente virtual automaticamente
   - Instalará todas as dependências
   - Compilará o .exe
   - Criará a pasta `release\` com o executável

4. **Resultado:**
   - `release\GestorContasBETS.exe` - Executável final
   - `release\INSTRUCOES.txt` - Instruções para usuários
   - `GestorContasBETS-v1.0.0.zip` (opcional) - Arquivo ZIP para distribuir

### Método 2: Passo a Passo (Manual)

1. **Criar ambiente virtual:**
   ```batch
   python -m venv venv
   ```

2. **Ativar ambiente virtual:**
   ```batch
   venv\Scripts\activate
   ```

3. **Instalar dependências:**
   ```batch
   pip install -r requirements.txt
   pip install pyinstaller
   ```

4. **Compilar o .exe:**
   ```batch
   pyinstaller --onefile --windowed --add-data "templates;templates" --add-data "static;static" --hidden-import werkzeug.security --hidden-import sqlite3 --name "GestorContasBETS" app.py
   ```

5. **Localizar o executável:**
   - O .exe estará em `dist\GestorContasBETS.exe`

## 📦 Como Distribuir

### Opção 1: Enviar o .exe Diretamente

1. Abra a pasta `release\`
2. Envie o arquivo `GestorContasBETS.exe` por WhatsApp/Email
3. Envie também o arquivo `INSTRUCOES.txt`

### Opção 2: Enviar Arquivo ZIP (Mais Profissional)

1. O script `package.bat` já cria o ZIP automaticamente
2. Envie o arquivo `GestorContasBETS-v1.0.0.zip`
3. O ZIP já contém o .exe e as instruções

## 🧪 Como Testar Antes de Distribuir

### Teste 1: Funcionamento Básico

1. Execute `dist\GestorContasBETS.exe`
2. O app deve abrir no navegador
3. Crie uma conta de teste
4. Crie algumas contas
5. Feche o app

### Teste 2: Persistência de Dados

1. Abra o .exe novamente
2. Faça login
3. **Suas contas devem estar lá** ✅
4. Isso confirma que os dados estão sendo salvos corretamente

### Teste 3: Atualização (Simulada)

1. Com o app aberto, crie mais algumas contas
2. Anote quantas contas você tem
3. Feche o app
4. **Simule uma atualização:** Renomeie o .exe para `.exe.old`
5. Execute o build novamente
6. Com o novo .exe, abra o app
7. **Todas as suas contas devem estar lá** ✅

### Teste 4: Backup Automático

1. Abra o .exe algumas vezes
2. Vá para `%APPDATA%\GestorContasBETS\backups\`
3. **Deve haver arquivos de backup** ✅
4. Formato: `bets_backup_YYYYMMDD_HHMMSS.db`

## 🔍 Troubleshooting

### Problema: O .exe não abre

**Solução 1:** Verifique se o antivírus bloqueou
- Desative temporariamente o antivírus
- Execute o build novamente
- Adicione o .exe à lista de exceções do antivírus

**Solução 2:** Execute como administrador
- Clique direito no .exe
- Execute como administrador

### Problema: Erro durante o build

**Solução 1:** Limpe builds anteriores
```batch
rmdir /s /q build dist venv
python -m venv venv
```

**Solução 2:** Verifique se Python está no PATH
```batch
python --version
```

Se não aparecer, instale o Python novamente e marque "Add Python to PATH".

### Problema: Dados não persistem

**Causa:** O banco de dados está sendo salvo em uma pasta temporária

**Solução:** Verifique se APP_DATA_DIR está configurado corretamente
- Abra o .exe
- Pressione F12 (console do navegador)
- Vá para a aba Console
- Deve mostrar: `[DEBUG] App data directory: C:\Users\SEU_USUARIO\AppData\Roaming\GestorContasBETS`

### Problema: Tamanho do .exe muito grande

**Normal:** O tamanho esperado é de 30-50 MB
- Isso é normal porque inclui Python + todas as bibliotecas
- PyInstaller empacota tudo em um único arquivo

**Se estiver muito maior (>100 MB):**
- Verifique se não há arquivos desnecessários em `static/` ou `templates/`
- Limpe a pasta `data/` antes do build

## 📊 Estrutura de Arquivos Após o Build

```
Projeto 02 - BETS/
├── build/              # Pasta temporária (pode deletar)
├── dist/
│   └── GestorContasBETS.exe  # ← Executável final
├── release/
│   ├── GestorContasBETS.exe  # ← Cópia para distribuir
│   └── INSTRUCOES.txt        # ← Instruções para usuários
├── venv/               # Ambiente virtual (não distribuir)
├── gestor_contas.spec  # Config do PyInstaller
├── build_onefile.bat   # Script de build
└── package.bat         # Script de empacotamento
```

## 🎯 Checklist de Distribuição

Antes de distribuir o .exe, confirme:

- [ ] App abre sem erros
- [ ] Registro de usuário funciona
- [ ] Login funciona
- [ ] Criar contas funciona
- [ ] Editar contas funciona
- [ ] Excluir contas funciona
- [ ] Dados persistem após fechar o app
- [ ] Backup automático funciona
- [ ] INSTRUCOES.txt está na pasta release
- [ ] Tamanho do .exe é razoável (30-50 MB)

## 💡 Dicas

1. **Primeira distribuição:** Comece distribuindo para 1-2 amigos para testar
2. **Coletar feedback:** Peça para testarem e reportarem problemas
3. **Versão de teste:** Marque como "v1.0.0-beta" antes da versão final
4. **Atualizações:** Sempre mantenha os dados salvos em APPDATA ao atualizar
5. **Suporte:** Esteja preparado para ajudar os amigos na instalação

## 📝 Notas Importantes

1. **Os dados do Supabase NÃO são migrados:** Começar do zero
2. **Cada usuário tem sua própria base:** Não compartilha dados entre usuários
3. **Backup manual é recomendado:** Sempre bom fazer backup do APPDATA antes de atualizar
4. **Antivírus pode alertar:** .exe não assinado digitalmente pode ser marcado como suspeito
5. **Teste antes de distribuir:** Sempre teste o .exe em uma máquina limpa

## 🎉 Próximos Passos

Após compilar e testar:

1. Distribua para alguns amigos
2. Colete feedback
3. Corrija problemas se houver
4. Faça um novo build com as correções
5. Distribua a versão atualizada

**Parabéns!** Seu aplicativo Flask agora é um executável .exe Windows standalone! 🚀
