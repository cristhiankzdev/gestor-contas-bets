# Gestor de Contas - BETS

Sistema de gerenciamento de contas e operações de apostas com funcionalidade de calculadora de surebets.

## Funcionalidades

- ✅ Gerenciamento de contas (criar, editar, excluir)
- ✅ Tipos de conta: Normal, Gold, Bolsa
- ✅ Cálculo de Surebets com distribuição de stakes
- ✅ Suporte a Back e Lay
- ✅ Sistema de arquivamento de operações
- ✅ Histórico de operações por dia
- ✅ Contagem de operações do dia por conta
- ✅ Sistema de edição de operações
- ✅ Arredondamento de lucro opcional
- ✅ Autenticação com Supabase
- ✅ Design responsivo com Bootstrap 5.3

## Tecnologias

- **Backend**: Python 3.13 + Flask
- **Banco de Dados**: SQLite
- **Autenticação**: Supabase Auth
- **Frontend**: HTML5 + Bootstrap 5.3.3 + Bootstrap Icons
- **JavaScript**: Vanilla JS (sem frameworks)

## Instalação

1. Clone o repositório
2. Crie um ambiente virtual (opcional):
   ```bash
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   ```
3. Instale as dependências:
   ```bash
   pip install -r requirements.txt
   ```
4. Configure as variáveis de ambiente:
   ```bash
   cp .env.example .env
   # Edite .env com suas credenciais do Supabase
   ```
5. Execute o servidor:
   ```bash
   python app.py
   ```
6. Acesse http://localhost:5000

## Variáveis de Ambiente

```env
SUPABASE_URL=sua_url_do_supabase
SUPABASE_ANON_KEY=sua_chave_anonima_do_supabase
```

## Estrutura do Projeto

```
├── app.py                 # Aplicação Flask principal
├── data/                  # Banco de dados SQLite (gerado automaticamente)
├── static/                # Arquivos estáticos
│   ├── accounts.css
│   ├── accounts.js
│   ├── calculator.css
│   └── calculator.js
├── templates/             # Templates HTML
│   ├── accounts.html
│   ├── calculator.html
│   ├── history.html
│   └── login.html
└── README.md
```

## Desenvolvimento

### Iniciar Servidor
```bash
python app.py
```

O servidor rodará em http://127.0.0.1:5000

### Criar Conta
1. Clique em "Configurações" → "Criar Conta"
2. Digite o nome da conta
3. Selecione o status (Normal, Gold, Bolsa)

### Registrar Operação
1. Acesse "Nova Operação"
2. Preencha os campos:
   - Nome da operação
   - Selecione contas
   - Informe odds e stakes
   - (Opcional) Ative arredondamento
3. Clique em "Executar Operação"

### Editar Operação
1. Na página inicial, clique no ícone de lápis [✏️] ao lado de uma operação
2. Faça as alterações desejadas
3. Clique em "Concluir Edição"

### Arquivar Operação
- Clique no ícone de arquivo [📦] ao lado da operação
- Operações arquivadas aparecem no Histórico

## Licença

Este projeto é para uso pessoal.

## Autor

Desenvolvido para gestão de apostas.
