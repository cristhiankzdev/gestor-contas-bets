# Guia de Depuração - Render

## Problemas Atuais
✅ Login funcionando (Supabase configurado corretamente)
❌ Lista de contas vazia após o login
❌ Botão "Adicionar Conta" não responde

## Logs de Depuração Adicionados

### No Backend (app.py)

#### Rota GET /api/accounts
```python
[DEBUG] api_get_accounts - User ID from session: {uid}
[DEBUG] api_get_accounts - Found {count} accounts for user {uid}
```

#### Rota POST /api/accounts
```python
[DEBUG] api_create_account - User ID: {uid}
[DEBUG] api_create_account - Request body: {body}
[DEBUG] api_create_account - Max sort_order: {order}
[DEBUG] api_create_account - Creating account: {name}
[DEBUG] api_create_account - Account created successfully: {name}
```

### No Frontend (accounts.js)

#### Inicialização
```javascript
[DEBUG] accounts.js initializing...
[DEBUG] Checking DOM elements...
[DEBUG] btn-add-new-account element found
[DEBUG] btn-add-empty element found
[DEBUG] modal-manage element found
[DEBUG] Starting load process...
```

#### Carregamento de Contas
```javascript
[DEBUG] Loading accounts...
[DEBUG] Accounts loaded: {data}
[DEBUG] Total accounts: {count}
```

#### Clique em "Adicionar"
```javascript
[DEBUG] btn-add-new-account clicked
[DEBUG] Account name: {name}
[DEBUG] Calling API to create account...
[DEBUG] Account created: {account}
```

#### Modal de Gerir Contas
```javascript
[DEBUG] openManageModal called
[DEBUG] Showing modal-manage
```

## Como Usar os Logs

### 1. No Console do Render (Backend)
1. Acesse https://dashboard.render.com
2. Selecione seu serviço → Logs
3. Procure por `[DEBUG]` ou `[ERROR]`

### 2. No Console do Navegador (Frontend)
1. Acesse sua aplicação no Render
2. Abra o console do navegador (F12)
3. Procure por `[DEBUG]` ou `[ERROR]`

## Diagnóstico Possível

### Cenário 1: Lista de Contas Vazia

**Se os logs mostrarem:**
```
[DEBUG] api_get_accounts - User ID from session: abc123
[DEBUG] api_get_accounts - Found 0 accounts for user abc123
```

**Diagnóstico:** As contas existem no banco mas têm `user_id` diferente do usuário atual.

**Solução:** Verificar se há contas antigas com `user_id` vazio ou incorreto.

### Cenário 2: Botão "Adicionar" Não Funciona

**Se os logs mostrarem:**
```
[DEBUG] btn-add-new-account clicked
[DEBUG] Account name: Teste
[DEBUG] Calling API to create account...
[ERROR] Failed to create account: {error}
```

**Diagnóstico:** Problema na criação da conta no backend.

**Solução:** Verificar os logs do backend para ver o erro específico.

**Se NÃO houver logs:**
```
// Nada aparece no console quando clica no botão
```

**Diagnóstico:** Event listener não está anexado ao botão.

**Solução:** Verificar se o elemento HTML existe e se há erros de JavaScript anteriores.

### Cenário 3: Modal Não Abre

**Se os logs mostrarem:**
```
[DEBUG] btn-add-empty clicked
[DEBUG] openManageModal called
[DEBUG] Showing modal-manage
// Mas o modal não aparece
```

**Diagnóstico:** Problema com o Bootstrap modal.

**Solução:** Verificar se o Bootstrap está carregado corretamente.

## Próximos Passos

1. **Faça um novo deploy** com as mudanças de logging
2. **Acesse o console do navegador** e do Render
3. **Faça login** e observe os logs
4. **Tente adicionar uma conta** e observe os logs
5. **Copie os logs relevantes** para análise

## Perguntas para Investigação

### 1. User ID Divergente
- O user_id que vem do Supabase é o mesmo que está no banco SQLite?
- Há contas com user_id vazio ou incorreto no banco?

### 2. Elementos DOM
- Todos os elementos HTML necessários existem?
- Há erros de JavaScript que impedem a execução?

### 3. Bootstrap Modal
- O Bootstrap está carregado corretamente?
- O elemento do modal existe no HTML?

### 4. Rede
- As requisições de API estão chegando no servidor?
- Há erros de CORS ou timeout?

## Comandos Úteis

### Para verificar o banco de dados diretamente
Se você tiver acesso ao container do Render:

```bash
# Acesse o container
ssh <render-service>

# Entre no diretório da aplicação
cd /app

# Abra o banco SQLite
sqlite3 data/bets.db

# Verifique as contas
SELECT id, name, user_id FROM accounts;

# Verifique contas com user_id vazio
SELECT * FROM accounts WHERE user_id = '';

# Verifique contas com user_id específico
SELECT * FROM accounts WHERE user_id = '<seu-user-id>';
```

## Resumo das Mudanças

1. ✅ Adicionado logs detalhados nas rotas `/api/accounts` (GET e POST)
2. ✅ Adicionado logs na inicialização do JavaScript
3. ✅ Adicionado logs nos event listeners dos botões
4. ✅ Adicionado logs nas funções de renderização
5. ✅ Melhorado tratamento de erros com mensagens específicas

Com esses logs, você poderá identificar exatamente onde está o problema e resolver de forma direcionada.
