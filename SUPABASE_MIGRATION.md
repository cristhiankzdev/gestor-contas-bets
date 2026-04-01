# MIGRAÇÃO PARA SUPABASE - Dados Permanentes

## 🎯 Problema Resolvido

**Problema Anterior:**
- Os dados eram salvos em SQLite local do Render
- O banco SQLite é **TEMPORÁRIO** e pode ser resetado a qualquer momento
- Ao fazer logout ou ficar um tempo fora, os dados eram **perdidos**

**Solução:**
- Migração completa do SQLite para **Supabase**
- Dados salvos na **NUVEM**, permanentes e seguros
- Cada conta é vinculada ao **user_id** do usuário logado

## 📋 Tabelas Necessárias no Supabase

### 1. Tabela `accounts`

```sql
CREATE TABLE accounts (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL DEFAULT '',
    status      TEXT NOT NULL DEFAULT 'Normal',
    freebet     REAL,
    saldo       REAL,
    condition   INTEGER NOT NULL DEFAULT 0,
    op_conditions TEXT NOT NULL DEFAULT '{}',
    notes       TEXT NOT NULL DEFAULT '["","","","","",""]',
    sort_order  INTEGER NOT NULL DEFAULT 0,
    user_id     TEXT NOT NULL DEFAULT '',
    op_count    INTEGER NOT NULL DEFAULT 0,
    op_count_date TEXT NOT NULL DEFAULT ''
);

-- Índice para performance em buscas por user_id
CREATE INDEX idx_accounts_user_id ON accounts(user_id);
```

### 2. Tabela `operations` (se ainda não existe)

```sql
CREATE TABLE operations (
    id          TEXT PRIMARY KEY,
    created_at  TEXT NOT NULL,
    op_date     TEXT NOT NULL,
    name        TEXT NOT NULL DEFAULT '',
    pair        INTEGER NOT NULL DEFAULT 1,
    entries     TEXT NOT NULL DEFAULT '[]',
    protection  TEXT,
    profit      REAL,
    total_stake REAL,
    archived    INTEGER NOT NULL DEFAULT 0,
    user_id     TEXT NOT NULL DEFAULT ''
);

-- Índices para performance
CREATE INDEX idx_operations_user_id ON operations(user_id);
CREATE INDEX idx_operations_op_date ON operations(op_date);
```

## 🔐 Políticas de Segurança (RLS) - OBRIGATÓRIO

**IMPORTANTE:** Você deve configurar **Row Level Security (RLS)** no Supabase para garantir que cada usuário só veja seus próprios dados.

### 1. Habilitar RLS no Supabase
```sql
-- No SQL Editor do Supabase, execute:
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations ENABLE ROW LEVEL SECURITY;
```

### 2. Criar Políticas de Segurança

```sql
-- Políticas para accounts
DROP POLICY IF EXISTS "Users can view own accounts" ON accounts;
CREATE POLICY "Users can view own accounts"
    ON accounts FOR SELECT
    USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can insert own accounts" ON accounts;
CREATE POLICY "Users can insert own accounts"
    ON accounts FOR INSERT
    WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can update own accounts" ON accounts;
CREATE POLICY "Users can update own accounts"
    ON accounts FOR UPDATE
    USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can delete own accounts" ON accounts;
CREATE POLICY "Users can delete own accounts"
    ON accounts FOR DELETE
    USING (auth.uid()::text = user_id);

-- Políticas para operations
DROP POLICY IF EXISTS "Users can view own operations" ON operations;
CREATE POLICY "Users can view own operations"
    ON operations FOR SELECT
    USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can insert own operations" ON operations;
CREATE POLICY "Users can insert own operations"
    ON operations FOR INSERT
    WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can update own operations" ON operations;
CREATE POLICY "Users can update own operations"
    ON operations FOR UPDATE
    USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "Users can delete own operations" ON operations;
CREATE POLICY "Users can delete own operations"
    ON operations FOR DELETE
    USING (auth.uid()::text = user_id);
```

## 🔧 Rotas Alteradas no app.py

### 1. GET /api/accounts
**ANTES (SQLite):**
```python
with closing(get_db()) as conn:
    rows = conn.execute("SELECT * FROM accounts WHERE user_id=? ORDER BY sort_order, rowid", (uid,)).fetchall()
```

**DEPOIS (Supabase):**
```python
response = _sb.table("accounts").select("*").eq("user_id", uid).order("sort_order").execute()
```

### 2. POST /api/accounts
**ANTES (SQLite):**
```python
conn.execute("INSERT INTO accounts VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", ...)
```

**DEPOIS (Supabase):**
```python
new_account = {
    "id": str(uuid.uuid4()),
    "name": account_name,
    "status": body.get("status", "Normal"),
    "freebet": None,
    "saldo": None,
    "condition": 0,
    "op_conditions": "{}",
    "notes": '["","","","","",""]',
    "sort_order": max_ord,
    "user_id": uid,  # ← CRÍTICO: vincula ao usuário
    "op_count": 0,
    "op_count_date": ''
}
_sb.table("accounts").insert(new_account).execute()
```

### 3. PUT /api/accounts/<aid>
**ANTES (SQLite):**
```python
conn.execute("UPDATE accounts SET name=?,status=?,... WHERE id=? AND user_id=?", ...)
```

**DEPOIS (Supabase):**
```python
_sb.table("accounts").update(update_data).eq("id", aid).eq("user_id", uid).execute()
```

### 4. DELETE /api/accounts/<aid>
**ANTES (SQLite):**
```python
conn.execute("DELETE FROM accounts WHERE id=? AND user_id=?", (aid, uid))
```

**DEPOIS (Supabase):**
```python
_sb.table("accounts").delete().eq("id", aid).eq("user_id", uid).execute()
```

### 5. POST /api/accounts/reset
**ANTES (SQLite):**
```python
conn.execute("UPDATE accounts SET condition=0, op_conditions='{}', notes=? WHERE user_id=?", ...)
```

**DEPOIS (Supabase):**
```python
_sb.table("accounts").update({...}).eq("user_id", uid).execute()
```

### 6. Função _calculate_account_op_counts()
**ANTES (SQLite):**
```python
with closing(get_db()) as conn:
    cursor.execute("SELECT entries FROM operations WHERE user_id=? AND op_date=?...", ...)
```

**DEPOIS (Supabase):**
```python
response = _sb.table("operations").select("entries").eq("user_id", uid).eq("op_date", today).execute()
```

## ✅ Verificações Importantes

### 1. Variáveis de Ambiente
As seguintes variáveis já estão configuradas (do login):
- `SUPABASE_URL` ✅
- `SUPABASE_ANON_KEY` ✅

### 2. Biblioteca Supabase
Já está no `requirements.txt`:
```
supabase  ✅
```

### 3. Tabelas Necessárias
Você **PRECISA** criar as tabelas no Supabase antes de usar o app:
1. `accounts` - tabela de contas
2. `operations` - tabela de operações

### 4. Políticas de Segurança (RLS)
**CRUCIAL:** Sem o RLS, qualquer usuário poderá ver os dados de outros!
Configure as políticas conforme mostrado acima.

## 🚀 Passos para Ativar

### Passo 1: Criar Tabelas no Supabase
1. Acesse o painel do Supabase
2. Vá em "SQL Editor"
3. Copie e execute os scripts SQL acima para criar as tabelas

### Passo 2: Configurar RLS
1. No SQL Editor do Supabase
2. Copie e execute as políticas de segurança acima

### Passo 3: Deploy
```bash
git add app.py SUPABASE_MIGRATION.md
git commit -m "Migração SQLite → Supabase para dados permanentes"
git push origin master
```

### Passo 4: Teste
1. Aguarde o deploy no Render
2. Faça login
3. Crie algumas contas
4. Faça logout
5. Faça login novamente
6. **Suas contas devem continuar lá!** ✅

## 🎉 Benefícios da Migração

- ✅ **Dados Permanentes** - Não perde mais dados ao logout
- ✅ **Multi-dispositivo** - Acesse de qualquer lugar
- ✅ **Backup Automático** - Supabase faz backup diário
- ✅ **Segurança** - RLS garante privacidade dos dados
- ✅ **Escala** - Supabase escala automaticamente
- ✅ **API REST** - Interface mais moderna e robusta

## ⚠️ Importante

**Os dados antigos (SQLite) NÃO serão migrados automaticamente!**
- Os dados que existem atualmente no SQLite não serão transferidos para o Supabase
- Você precisará recriar as contas manualmente após a migração
- Isso é aceitável pois os dados no SQLite eram temporários mesmo

## 🔗 Links Úteis

- [Documentação Supabase Python](https://supabase.com/docs/reference/python)
- [Documentação RLS](https://supabase.com/docs/guides/auth/row-level-security)
- [Painel Supabase](https://app.supabase.com)

## 📝 Resumo das Mudanças

| Aspecto | Antes (SQLite) | Depois (Supabase) |
|---------|----------------|-------------------|
| Armazenamento | Local (Render) | Nuvem (Supabase) |
| Persistência | Temporário | **Permanente** |
| Multi-dispositivo | ❌ Não | ✅ Sim |
| Backup | ❌ Manual | ✅ Automático |
| Segurança | ⚠️ Frágil | ✅ RLS forte |
| Escalabilidade | ❌ Limitada | ✅ Automática |

**Após esta migração, seus dados serão permanentes e seguros!** 🎉
