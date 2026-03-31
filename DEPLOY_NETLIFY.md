# Deploy na Netlify - Gestor de Contas BETS

## 📋 Pré-Requisitos

Antes de fazer deploy, certifique-se de ter:

1. **Conta GitHub**
   - Crie uma conta em https://github.com
   - O repositório já foi criado: https://github.com/cristhiankzdev/gestor-contas-bets

2. **Conta Netlify**
   - Crie uma conta gratuita em https://app.netlify.com
   - Ou faça login com seu GitHub

3. **Variáveis de Ambiente**
   - Você precisará configurar as seguintes variáveis:
     - `SUPABASE_URL` - URL do seu projeto Supabase
     - `SUPABASE_ANON_KEY` - Chave anônima do Supabase
   - NOTA: O arquivo `.env.example` está incluído no repositório

---

## 🚀 Método 1: Deploy via Interface Netlify (Recomendado)

Este é o método mais simples e não requer CLI.

### Passos:

1. **Acesse o Netlify**
   - Vá para https://app.netlify.com
   - Clique em "Add new site" ou "Import from GitHub"

2. **Importe do GitHub**
   - Clique em "Import an existing project"
   - Selecione o repositório: `cristhiankzdev/gestor-contas-bets`
   - Clique em "Import site"

3. **Configurações de Build**
   Netlify detectará automaticamente o arquivo `netlify.toml`
   - Framework detectado: "Python"
   - Build command: `python app.py`
   - Python version: 3.13

4. **Variáveis de Ambiente (IMPORTANTE!)**
   - Vá em "Site settings" → "Environment variables"
   - Clique em "Add variable"
   - Adicione:
     ```
     Key: SUPABASE_URL
     Value: sua_url_do_supabase
     ```
     ```
     Key: SUPABASE_ANON_KEY
     Value: sua_chave_anonima_do_supabase
     ```
   - Clique em "Save"

5. **Deploy**
   - Clique em "Deploy site"
   - Aguarde alguns segundos
   - Seu site estará disponível em: `https://nome-que-escolher.netlify.app`

---

## 🚀 Método 2: Deploy via CLI Netlify

Se preferir usar linha de comando:

### Instalação:

1. **Instale o Netlify CLI**
   ```bash
   npm install -g netlify-cli
   ```

2. **Login**
   ```bash
   netlify login
   ```

### Deploy:

1. **Configurar variáveis de ambiente**
   ```bash
   netlify env:set SUPABASE_URL sua_url_do_supabase
   netlify env:set SUPABASE_ANON_KEY sua_chave_anonima_do_supabase
   ```

2. **Fazer deploy**
   ```bash
   cd "c:\Users\CRKZ\Desktop\CLAUDE\Projeto 02 - BETS"
   netlify deploy --prod
   ```

---

## ⚙️ Configurações do netlify.toml

O arquivo `netlify.toml` que foi criado configura:

- **Build Command**: `python app.py`
- **Python Version**: 3.13
- **Redirecionamento**: `/login` → `/`
- **Headers de Segurança**: Proteção contra XSS e clickjacking

### Por que funciona para este projeto:

1. **Servidor Flask Standalone**
   - O `python app.py` inicia o servidor Flask
   - Não há necessidade de build complexo
   - O arquivo `app.py` já está configurado para servir arquivos estáticos

2. **Arquivos Estáticos Automaticamente Servidos**
   - O Flask serve os arquivos de `static/` automaticamente
   - CSS, JS, HTML são copiados para o site

3. **Sem Dependências de Node.js**
   - Este projeto usa apenas Python
   - Não há necessidade de instalar pacotes npm

---

## 🔐 Configuração de Segurança

O arquivo `.gitignore` foi configurado para proteger:
- ❌ Arquivos `.env` (com credenciais reais)
- ❌ Banco de dados `data/bets.db`
- ❌ Chaves de sessão `secret.key`
- ❌ Logs e arquivos temporários

Isso garante que suas credenciais reais NUNCA serão publicadas no GitHub ou Netlify!

---

## 🌍 URL do Deploy

Seu site será publicado em:
```
https://[nome-que-escolher].netlify.app
```

Escolha um subdomínio único ao fazer o primeiro deploy.

---

## 🔄 Atualizações Futuras

Após o deploy inicial, para atualizar seu site:

### Via Interface Netlify:
1. Acesse https://app.netlify.com
2. Selecione seu site
3. Clique em "Deploys" → "Trigger deploy"
4. O Netlify fará um novo deploy automaticamente

### Via CLI:
```bash
cd "c:\Users\CRKZ\Desktop\CLAUDE\Projeto 02 - BETS"
git pull origin master
netlify deploy --prod
```

---

## 🐛 Solução de Problemas

### Erro: "Application Error"

Causa: Variáveis de ambiente não configuradas.
Solução: Adicione `SUPABASE_URL` e `SUPABASE_ANON_KEY` nas variáveis de ambiente do Netlify.

### Erro: "Server Error"

Causa: Problema com o arquivo `app.py` ou dependências.
Solução:
1. Verifique os logs em "Site settings" → "Functions" → "View logs"
2. Certifique-se de que o arquivo `app.py` existe na raiz

### Erro: "404 Not Found"

Causa: Arquivo `app.py` não foi encontrado.
Solução: Verifique se o arquivo está no diretório raiz do projeto.

---

## 📊 Monitoramento

O Netlify fornece monitoramento automático:
- Status do deploy
- Uso de recursos
- Logs em tempo real
- Métricas de performance

Acesse: https://app.netlify.com → selecione seu site → "Deploys"

---

## 💡 Dicas de Otimização

1. **Reduzir Tamanho do Deploy**
   - A Netlify ignora automaticamente `node_modules/`
   - O arquivo `.gitignore` já está configurado

2. **Cache de Arquivos Estáticos**
   - Arquivos CSS, JS são cacheados pelo navegador
   - Não há necessidade de otimização adicional

3. **Compressão Automática**
   - O Netlify comprime automaticamente os arquivos estáticos
   - Melhora o tempo de carregamento

4. **CDN Global**
   - O Netlify usa CDN global para distribuição rápida
   - Seu site carregará rápido em qualquer lugar do mundo

---

## 🎯 Checklist Pré-Deploy

- [ ] Conta GitHub criada
- [ ] Repositório público (sim: ✅)
- [ ] Conta Netlify criada
- [ ] Variáveis de ambiente configuradas
- [ ] Deploy inicial realizado
- [ ] Teste de funcionalidade completa
- [ ] Domínio personalizado (opcional)

---

## 📝 Suporte

Se encontrar problemas:
- Documentação Netlify: https://docs.netlify.com
- Supabase Docs: https://supabase.com/docs
- Flask Docs: https://flask.palletsprojects.com

---

## ⚠️ Aviso Importante

**O arquivo `.env` com credenciais reais NUNCA deve ser commitado!**

Use sempre o arquivo `.env.example` como referência para configuração. As credenciais devem ser configuradas apenas nas variáveis de ambiente do Netlify.

---

**Autor**: Cristhiankzdev
**Data**: 31/03/2026
**Versão**: 1.0.0
