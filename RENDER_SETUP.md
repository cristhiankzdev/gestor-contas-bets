# Configuração do Render - Correção dos Problemas

## Problemas Identificados

### 1. Contas do Supabase não carregam
**Causa:** As variáveis de ambiente `SUPABASE_URL` e `SUPABASE_ANON_KEY` não estão configuradas no Render.

**Solução:** Adicione as variáveis de ambiente no painel do Render:

1. Acesse o painel do Render: https://dashboard.render.com
2. Vá no seu serviço (web service)
3. Clique em "Environment"
4. Adicione as seguintes variáveis:
   - `SUPABASE_URL`: Sua URL do projeto Supabase (ex: `https://seu-projeto.supabase.co`)
   - `SUPABASE_ANON_KEY`: Sua chave anon do Supabase

**Onde encontrar essas credenciais:**
1. Acesse https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá em Settings → API
4. Copie `Project URL` para SUPABASE_URL
5. Copie `anon public` key para SUPABASE_ANON_KEY

### 2. Botões "Adicionar" não funcionam
**Causa:** Consequência direta do problema 1. Sem as credenciais do Supabase configuradas, o login falha e todas as chamadas de API retornam erro 401.

**Solução:** Após configurar as variáveis de ambiente, faça um novo deploy. Isso resolverá automaticamente ambos os problemas.

## Como Fazer o Deploy

### Opção 1: Usando o arquivo render.yaml (Recomendado)

O arquivo `render.yaml` já foi criado com as configurações corretas. Para usar:

1. Faça commit do arquivo `render.yaml`
2. No Render, conecte seu repositório Git
3. Render detectará automaticamente o `render.yaml` e configurará o serviço
4. Configure as variáveis de ambiente SUPABASE_URL e SUPABASE_ANON_KEY no painel
5. Faça o deploy

### Opção 2: Configuração Manual

Se preferir configurar manualmente:

1. Crie um novo Web Service no Render
2. Conecte seu repositório Git
3. Configure:
   - **Runtime:** Python
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn app:app --bind 0.0.0.0:$PORT --workers 1 --timeout 120`
   - **Environment Variables:**
     - `SUPABASE_URL` = sua URL do Supabase
     - `SUPABASE_ANON_KEY` = sua chave anon do Supabase
     - `FLASK_DEBUG` = 0

## Depuração

Se ainda houver problemas após configurar as variáveis de ambiente:

### 1. Verifique os logs do Render
1. Acesse o painel do Render
2. Vá no seu serviço → Logs
3. Procure por erros como:
   - `RuntimeError: Variáveis de ambiente SUPABASE_URL e SUPABASE_ANON_KEY são obrigatórias`
   - `[LOGIN ERROR]`
   - `[ERROR] Failed to load accounts`

### 2. Verifique o console do navegador
1. Acesse sua aplicação no Render
2. Abra o console do navegador (F12)
3. Procure por erros JavaScript como:
   - `[LOGIN ERROR]`
   - `[ERROR] Failed to load accounts`
   - `[API ERROR]`

### 3. Teste as variáveis de ambiente
No painel do Render, verifique se as variáveis estão configuradas:
- `SUPABASE_URL` deve começar com `https://`
- `SUPABASE_ANON_KEY` deve ser uma string longa
- Nenhum valor deve estar vazio

## Verificação

Após o deploy:

1. Acesse a URL do seu app no Render
2. Abra o console do navegador (F12) para ver logs
3. Tente fazer login com suas credenciais do Supabase
4. Verifique se as contas carregam corretamente
5. Teste os botões "Adicionar"

## Troubleshooting

### Erro: "Variáveis de ambiente SUPABASE_URL e SUPABASE_ANON_KEY são obrigatórias"

As variáveis de ambiente não foram configuradas. Siga as instruções acima para adicioná-las no painel do Render.

### Erro: "Email ou senha incorretos"

Verifique se suas credenciais do Supabase estão corretas e se o usuário existe no Supabase.

### Erro: As contas não aparecem após login

1. Verifique os logs do serviço no Render
2. Confirme que as variáveis de ambiente estão definidas corretamente
3. Certifique-se de que o banco de dados SQLite foi criado no caminho correto

## Notas Importantes

- O arquivo `.env` não deve ser commitado (já está no .gitignore)
- As credenciais do Supabase devem ser configuradas como variáveis de ambiente no Render, nunca no código
- O servidor Gunicorn está configurado para rodar em produção com 1 worker e timeout de 120 segundos
