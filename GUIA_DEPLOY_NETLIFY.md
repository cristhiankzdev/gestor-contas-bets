# 📋 GUIA PASSO A PASSO - DEPLOY NO NETLIFY

Este guia mostra exatamente como colocar seu sistema **ONLINE** na Netlify.

---

## 📋 PRÉ-REQUISITOS

Antes de começar, certifique-se de:

- [x] **Conta GitHub criada** (já existe: `cristhiankzdev/gestor-contas-bets`)
- [x] **Credenciais Supabase prontas** (você precisa criar projeto e obter URL/Chave)
- [x] **Arquivos de configurados** (`netlify.toml`, `app.py` protegidos)
- [x] **Servidor local funcional** (http://127.0.0.1:5000)

---

## 🚀 PASSO 1: CRIAR PROJETO NO SUPABASE

### Por que é necessário?
O sistema precisa de credenciais do Supabase para funcionar.

### Passos:

1. **Acesse o Supabase**:
   - Vá para: https://supabase.com/dashboard
   - Faça login com sua conta

2. **Criar novo projeto**:
   - Clique em "New Project"
   - Nome do projeto: `gestor-contas-bets` (ou outro nome de sua preferência)
   - Região: South America (ou a mais próxima)
   - Clique em "Create new project"
   - Aguarde 15-30 segundos

3. **Copie as credenciais**:

   Vá em "Settings" → "API"

   **Project URL** (copie isto!):
   ```
   https://[projeto].supabase.co
   ```

   **Anon Key** (crie uma nova!):
   - Clique em "Create new anon key"
   - Nome: Para uso na aplicação
   - Expiração: 1 ano (ou mais se preferir)
   - Clique em "Create"
   - **COPIE A CHAVE COMPLETA** (começa com `eyJ...`)

4. **Guarde essas informações** em lugar seguro

---

## 🚀 PASSO 2: CRIAR CONTA NO NETLIFY (Se já não tiver)

### Passos:

1. **Acesse o Netlify**:
   - Vá para: https://app.netlify.com
   - Faça login com sua conta GitHub

2. **Clique em "Add new site"**:
   - Escolha "Deploy with Git"

3. **Conecte seu GitHub**:
   - Clique em "GitHub"
   - Autorize com sua conta

4. **Importe o repositório**:
   - Selecione: `cristhiankzdev/gestor-contas-bets`
   - Clique em "Import site"

5. **Clique em "Deploy site"**:
   - Netlify detectará automaticamente `netlify.toml`
   - Aguarde alguns segundos

**Resultado**: Site criado no Netlify (ainda não publicado, apenas configurado)

---

## 🚀 PASSO 3: CONFIGURAR VARIÁVEIS DE AMBIENTE NO NETLIFY

### Por que é necessário?

Para que seu site funcione, o Netlify precisa das credenciais Supabase.

### Passos:

1. **Com o site criado aberto**, clique em:
   - "Site configuration" (ou clique no nome do site)
   - Vá em "Environment variables"

2. **Clique em "Add variable"** (primeira variável):
   ```
   Key: SUPABASE_URL
   Value: https://[projeto].supabase.co
   ```

3. **Clique em "Save variable"**

4. **Clique em "Add variable"** (segunda variável):
   ```
   Key: SUPABASE_ANON_KEY
   Value: eyJhbGciOiJIUzIj... (cole a chave completa que você copiou)
   ```

5. **Clique em "Save variable"**

**✅ Variáveis configuradas!**

---

## 🚀 PASSO 4: FAZER DEPLOY INICIAL

### Passos:

1. **Verifique se está tudo configurado**:
   - Site: ✅ Criado (PASSO 2)
   - Variáveis: ✅ Configuradas (PASSO 3)
   - Repositório: ✅ Atualizado

2. **Clique em "Deploy site"**:
   - Localize no painel do seu site
   - Clique no botão "Deploy site"
   - Confirme o deploy
   - Aguarde 30 segundos a 2 minutos

**O que acontece durante o deploy**:
- Netlify lê `netlify.toml`
- Copia todos os arquivos para a cloud
- **NÃO executa `python app.py`** (graças ao `publish = "."`)
- Configura as variáveis de ambiente
- Publica o site!

3. **Aguarde a mensagem de sucesso**

Você verá: "Your site is live!" ou similar.

---

## 🎯 SEU SITE ESTARÁ ONLINE!

Após o deploy bem-sucedido, seu site estará em:

```
https://[nome-que-escolher].netlify.app/
```

Se você ainda não escolheu um nome, o Netlify gerará um nome aleatório como `random-name-12345.netlify.app`.

---

## 🔧 CONFIGURAÇÕES EXPLICADAS

### Como o `netlify.toml` funciona?

```toml
[build]
  publish = "."              # Publica arquivos estáticos diretamente
                           # Sem comando de build, sem iniciar servidor Flask

[build.environment]
  PYTHON_VERSION = "3.13"  # Versão do Python para Netlify
```

**Por que funciona assim:**
1. **`publish = "."`** - Diz ao Netlify para publicar todos os arquivos do diretório raiz
2. **Arquivos publicados**:
   - `app.py` - Não é executado, apenas copiado
   - `templates/` - HTML templates copiados
   - `static/` - CSS e JS copiados
3. **Sem build command** - Evita erro do servidor Flask procurando `/dev/shm`
4. **Sem servidor rodando** - Netlify não precisa do Flask, apenas dos arquivos estáticos

---

## 🧪 PROTEÇÃO DO CÓDIGO

O `app.py` foi modificado com proteção:

```python
if __name__ == "__main__":
    import os
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    app.run(debug=debug, host="0.0.0.0", port=int(os.environ.get("PORT", "5000")))
```

**O que isso faz:**
1. Em **desenvolvimento local** (`FLASK_DEBUG=1`): Roda em debug mode
2. **Em produção/Netlify** (`FLASK_DEBUG` não definido ou `0`): Roda sem debug
3. O servidor **não roda automaticamente** no Netlify build

---

## 📊 TESTES DEPLOYADOS

### Antes de fazer deploy, teste localmente:

1. **Teste o servidor local**:
   ```bash
   python app.py
   ```
   Acesse: http://127.0.0.1:5000
   Login com suas credenciais
   Verifique se tudo funciona:
   - Gerenciamento de contas
   - Calculadora de operações
   - Criação/edição de operações
   - Histórico

2. **Se funcionar localmente, funcionará no deploy!** ✅

---

## 🎯 RESUMO DOS PASSOS

| Passo | O que fazer | Status | Tempo estimado |
|-------|-------------|--------|-------------|
| 1. Criar projeto Supabase | Criar projeto no dashboard | 5-10 min |
| 2. Criar conta Netlify | Add new site → Deploy with Git | 2-5 min |
| 3. Configurar variáveis | Environment variables → Adicionar 2 chaves | 3-5 min |
| 4. Fazer deploy inicial | Clicar em "Deploy site" | 30 seg - 2 min |
| **TOTAL** | **TOTAL: 15-20 minutos** |

---

## ⚠️ DICA IMPORTANTE

### Teste o site após deploy!

Após a mensagem de sucesso, acesse seu site e verifique:

- ✅ **Página inicial carrega?** (com login)
- ✅ **Calculadora funciona?** (nova operação)
- ✅ **Operações aparecem?** (lista do dia)
- ✅ **Histórico funciona?**

Se algo não funcionar:
- Verifique as variáveis de ambiente no Netlify
- Veja os logs em "Deploys" → "View logs"

---

## 🎉 PARABÉNS!

**Seu projeto está 100% pronto para deploy!**

- ✅ Repositório configurado
- ✅ Arquivos estáticos prontos
- ✅ `netlify.toml` configurado
- ✅ `app.py` protegido
- ✅ Servidor local funcional

**Agora é só seguir os 4 passos acima!** 🚀

Em 15-20 minutos, seu sistema de gestão de contas estará online no mundo! 🌎
