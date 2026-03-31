import json
import os
import secrets
import sqlite3
import uuid
from contextlib import closing
from datetime import datetime, date
from functools import wraps
from dotenv import load_dotenv
from supabase import create_client, Client
from flask import Flask, jsonify, render_template, request, session, redirect, url_for

load_dotenv()

DB_PATH = os.path.join(os.path.dirname(__file__), "data", "bets.db")


def _get_or_create_secret():
    data_dir = os.path.dirname(DB_PATH)
    os.makedirs(data_dir, exist_ok=True)
    path = os.path.join(data_dir, "secret.key")
    if os.path.exists(path):
        with open(path) as f:
            return f.read().strip()
    key = secrets.token_hex(32)
    with open(path, "w") as f:
        f.write(key)
    return key


app = Flask(__name__)
app.secret_key = _get_or_create_secret()

_SUPABASE_URL = os.getenv("SUPABASE_URL")
_SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")
if not _SUPABASE_URL or not _SUPABASE_KEY:
    raise RuntimeError(
        "Variáveis de ambiente SUPABASE_URL e SUPABASE_ANON_KEY são obrigatórias. "
        "Copie .env.example para .env e preencha as credenciais."
    )

_sb: Client = create_client(_SUPABASE_URL, _SUPABASE_KEY)

# ── DB helpers ─────────────────────────────────────────────────────────────────

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with closing(get_db()) as conn:
        c = conn.cursor()
        c.executescript("""
            -- users table replaced by Supabase Auth
            CREATE TABLE IF NOT EXISTS accounts (
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
            CREATE TABLE IF NOT EXISTS operations (
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
            CREATE TABLE IF NOT EXISTS settings (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            INSERT OR IGNORE INTO settings (key, value)
            VALUES ('pair_colors', '["#3b82f6","#22c55e","#eab308","#a855f7","#ef4444","#f97316"]');
        """)
        # Migrations for older schemas
        for sql in (
            "ALTER TABLE operations ADD COLUMN archived INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE accounts   ADD COLUMN user_id TEXT NOT NULL DEFAULT ''",
            "ALTER TABLE operations ADD COLUMN user_id TEXT NOT NULL DEFAULT ''",
            "ALTER TABLE accounts   ADD COLUMN op_count INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE accounts   ADD COLUMN op_count_date TEXT NOT NULL DEFAULT ''",
        ):
            try:
                c.execute(sql)
            except sqlite3.OperationalError:
                pass  # column already exists
        conn.commit()
        _migrate_json(conn, c)


def _migrate_json(conn, c):
    data_dir = os.path.dirname(DB_PATH)

    c.execute("SELECT COUNT(*) FROM accounts")
    if c.fetchone()[0] == 0:
        p = os.path.join(data_dir, "accounts.json")
        if os.path.exists(p):
            with open(p, encoding="utf-8") as f:
                for i, a in enumerate(json.load(f)):
                    c.execute(
                        "INSERT OR IGNORE INTO accounts VALUES (?,?,?,?,?,?,?,?,?,?)",
                        (a.get("id", str(uuid.uuid4())), a.get("name", ""),
                         a.get("status", "Normal"), a.get("freebet"), a.get("saldo"),
                         a.get("condition", 0), json.dumps(a.get("op_conditions", {})),
                         json.dumps(a.get("notes", ["", "", "", "", "", ""])), i, "")
                    )

    c.execute("SELECT COUNT(*) FROM operations")
    if c.fetchone()[0] == 0:
        p = os.path.join(data_dir, "operations.json")
        if os.path.exists(p):
            with open(p, encoding="utf-8") as f:
                for o in json.load(f):
                    ca = o.get("created_at", datetime.now().strftime("%Y-%m-%dT%H:%M:%S"))
                    c.execute(
                        "INSERT OR IGNORE INTO operations VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                        (o.get("id", str(uuid.uuid4())), ca, ca[:10],
                         o.get("name", ""), o.get("pair", 1),
                         json.dumps(o.get("entries", [])),
                         json.dumps(o.get("protection")) if o.get("protection") else None,
                         o.get("profit"), o.get("total_stake"), 0, "")
                    )

    p = os.path.join(data_dir, "settings.json")
    if os.path.exists(p):
        with open(p, encoding="utf-8") as f:
            s = json.load(f)
        if "pair_colors" in s:
            c.execute("INSERT OR REPLACE INTO settings VALUES ('pair_colors',?)",
                      (json.dumps(s["pair_colors"]),))
    conn.commit()


def _acc(row, op_count=0):
    return {
        "id": row["id"], "name": row["name"], "status": row["status"],
        "freebet": row["freebet"], "saldo": row["saldo"],
        "condition": row["condition"],
        "op_conditions": json.loads(row["op_conditions"] or "{}"),
        "notes": json.loads(row["notes"] or '["","","","","",""]'),
        "op_count": op_count,
    }


def _calculate_account_op_counts(uid):
    """Calcula dinamicamente quantas operações cada conta aparece hoje."""
    today = date.today().isoformat()
    op_counts = {}

    with closing(get_db()) as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT entries FROM operations WHERE user_id=? AND op_date=? AND (archived IS NULL OR archived=0)",
            (uid, today)
        )
        operations = cursor.fetchall()

        for op in operations:
            entries = json.loads(op["entries"] or "[]")
            for entry in entries:
                account_id = entry.get("account_id")
                if account_id:
                    op_counts[account_id] = op_counts.get(account_id, 0) + 1

    return op_counts


def _get_today_str():
    """Retorna a data atual no formato YYYY-MM-DD."""
    return date.today().isoformat()


def _check_and_reset_daily_counts(uid):
    """Verifica e reseta as contagens diárias se o dia mudou."""
    today = _get_today_str()
    with closing(get_db()) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM accounts WHERE user_id=? AND op_count_date!=?", (uid, today))
        accounts_to_reset = cursor.fetchall()
        for row in accounts_to_reset:
            cursor.execute("UPDATE accounts SET op_count=0, op_count_date=? WHERE id=?", (today, row["id"]))
        conn.commit()


def _increment_account_op_count(account_id):
    """Incrementa a contagem de operações de uma conta."""
    today = _get_today_str()
    with closing(get_db()) as conn:
        c.execute("UPDATE accounts SET op_count=op_count+1, op_count_date=? WHERE id=?", (today, account_id))
        conn.commit()


def _op(row):
    return {
        "id": row["id"], "created_at": row["created_at"], "op_date": row["op_date"],
        "name": row["name"], "pair": row["pair"],
        "entries": json.loads(row["entries"] or "[]"),
        "protection": json.loads(row["protection"]) if row["protection"] else None,
        "profit": row["profit"], "total_stake": row["total_stake"],
        "archived": bool(row["archived"]) if "archived" in row.keys() else False,
    }


def _settings():
    with closing(get_db()) as conn:
        r = conn.execute("SELECT value FROM settings WHERE key='pair_colors'").fetchone()
    return {"pair_colors": json.loads(r["value"]) if r else ["#3b82f6", "#22c55e", "#eab308", "#a855f7", "#ef4444", "#f97316"]}


# ── Auth helpers ───────────────────────────────────────────────────────────────

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("user_id"):
            if request.path.startswith("/api/"):
                return jsonify({"error": "unauthorized"}), 401
            return redirect(url_for("login_page"))
        return f(*args, **kwargs)
    return decorated


@app.route("/login", methods=["GET"])
def login_page():
    if session.get("user_id"):
        return redirect("/")
    return render_template("login.html")


@app.route("/login", methods=["POST"])
def login_post():
    body     = request.get_json(silent=True) or {}
    email    = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""
    try:
        res = _sb.auth.sign_in_with_password({"email": email, "password": password})
        user = res.user
        session["user_id"]   = user.id
        session["user_name"] = (user.user_metadata or {}).get("name", email.split("@")[0])
        return jsonify({"ok": True})
    except Exception as exc:
        print(f"[LOGIN ERROR] {type(exc).__name__}: {exc}")
        return jsonify({"error": "Email ou senha incorretos."}), 401


@app.route("/register", methods=["POST"])
def register_post():
    body     = request.get_json(silent=True) or {}
    name     = (body.get("name") or "").strip()
    email    = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""
    if not name or not email or not password:
        return jsonify({"error": "Preencha todos os campos."}), 400
    if len(password) < 6:
        return jsonify({"error": "Senha deve ter pelo menos 6 caracteres."}), 400
    try:
        res = _sb.auth.sign_up({
            "email":    email,
            "password": password,
            "options":  {"data": {"name": name}},
        })
        if not res.user:
            return jsonify({"error": "Erro ao criar conta. Verifique o email."}), 400
        if not res.session:
            return jsonify({"error": "Conta criada! Verifique seu email para confirmar antes de entrar."}), 202
        session["user_id"]   = res.user.id
        session["user_name"] = name
        return jsonify({"ok": True}), 201
    except Exception as exc:
        msg = str(exc).lower()
        if "already registered" in msg or "already exists" in msg:
            return jsonify({"error": "Este email já está cadastrado."}), 409
        return jsonify({"error": "Erro ao criar conta."}), 400


@app.route("/logout")
def logout():
    try:
        _sb.auth.sign_out()
    except Exception:
        pass
    session.clear()
    return redirect("/login")


# ── Pages ──────────────────────────────────────────────────────────────────────

@app.route("/")
@login_required
def index():
    return render_template("accounts.html")


@app.route("/nova-operacao")
@app.route("/calculadora")
@login_required
def calculadora():
    return render_template("calculator.html")


@app.route("/historico")
@login_required
def historico():
    return render_template("history.html")


# ── Accounts API ───────────────────────────────────────────────────────────────

@app.route("/api/accounts", methods=["GET"])
@login_required
def api_get_accounts():
    uid = session["user_id"]
    # Calcula dinamicamente as contagens de operações
    op_counts = _calculate_account_op_counts(uid)

    with closing(get_db()) as conn:
        rows = conn.execute("SELECT * FROM accounts WHERE user_id=? ORDER BY sort_order, rowid", (uid,)).fetchall()
    accounts = [_acc(r, op_counts.get(r["id"], 0)) for r in rows]
    return jsonify({"accounts": accounts, "settings": _settings()})


@app.route("/api/accounts", methods=["POST"])
@login_required
def api_create_account():
    uid  = session["user_id"]
    body = request.get_json(silent=True) or {}
    aid  = str(uuid.uuid4())
    with closing(get_db()) as conn:
        max_ord = conn.execute("SELECT COALESCE(MAX(sort_order),0)+1 FROM accounts WHERE user_id=?", (uid,)).fetchone()[0]
        conn.execute(
            "INSERT INTO accounts VALUES (?,?,?,?,?,?,?,?,?,?)",
            (aid, body.get("name", "Nova Conta"), body.get("status", "Normal"),
             None, None, 0, "{}", '["","","","","",""]', max_ord, uid)
        )
        conn.commit()
        row = conn.execute("SELECT * FROM accounts WHERE id=? AND user_id=?", (aid, uid)).fetchone()
    return jsonify(_acc(row)), 201


@app.route("/api/accounts/<aid>", methods=["PUT"])
@login_required
def api_update_account(aid):
    uid  = session["user_id"]
    body = request.get_json(silent=True) or {}
    with closing(get_db()) as conn:
        row = conn.execute("SELECT * FROM accounts WHERE id=? AND user_id=?", (aid, uid)).fetchone()
        if not row:
            return jsonify({"error": "not found"}), 404
        a = _acc(row)
        for f in ("name", "status", "freebet", "saldo", "condition", "op_conditions", "notes"):
            if f in body:
                a[f] = body[f]
        conn.execute(
            "UPDATE accounts SET name=?,status=?,freebet=?,saldo=?,condition=?,op_conditions=?,notes=? WHERE id=? AND user_id=?",
            (a["name"], a["status"], a["freebet"], a["saldo"], a["condition"],
             json.dumps(a["op_conditions"]), json.dumps(a["notes"]), aid, uid)
        )
        conn.commit()
    return jsonify(a)


@app.route("/api/accounts/<aid>", methods=["DELETE"])
@login_required
def api_delete_account(aid):
    uid = session["user_id"]
    with closing(get_db()) as conn:
        conn.execute("DELETE FROM accounts WHERE id=? AND user_id=?", (aid, uid))
        conn.commit()
    return jsonify({"ok": True})


@app.route("/api/accounts/reset", methods=["POST"])
@login_required
def api_reset_accounts():
    uid         = session["user_id"]
    empty_notes = json.dumps(["", "", "", "", "", ""])
    with closing(get_db()) as conn:
        conn.execute("UPDATE accounts SET condition=0, op_conditions='{}', notes=? WHERE user_id=?", (empty_notes, uid))
        conn.commit()
    return jsonify({"ok": True})


@app.route("/api/accounts/reorder", methods=["POST"])
@login_required
def api_reorder_accounts():
    uid = session["user_id"]
    ids = (request.get_json(silent=True) or {}).get("ids", [])
    with closing(get_db()) as conn:
        for i, aid in enumerate(ids):
            conn.execute("UPDATE accounts SET sort_order=? WHERE id=? AND user_id=?", (i, aid, uid))
        conn.commit()
    return jsonify({"ok": True})


# ── Settings API ───────────────────────────────────────────────────────────────

@app.route("/api/settings", methods=["PUT"])
@login_required
def api_update_settings():
    body = request.get_json(silent=True) or {}
    with closing(get_db()) as conn:
        if "pair_colors" in body:
            conn.execute("INSERT OR REPLACE INTO settings VALUES ('pair_colors',?)",
                         (json.dumps(body["pair_colors"]),))
        conn.commit()
    return jsonify(_settings())


# ── Operations API ─────────────────────────────────────────────────────────────

@app.route("/api/operations", methods=["GET"])
@login_required
def api_get_operations():
    uid   = session["user_id"]
    today = date.today().isoformat()
    with closing(get_db()) as conn:
        rows = conn.execute(
            "SELECT * FROM operations WHERE user_id=? AND op_date=? AND (archived IS NULL OR archived=0) ORDER BY created_at",
            (uid, today)
        ).fetchall()
    return jsonify([_op(r) for r in rows])


@app.route("/api/operations", methods=["POST"])
@login_required
def api_create_operation():
    uid  = session["user_id"]
    body = request.get_json(silent=True) or {}
    now  = datetime.now()
    oid  = str(uuid.uuid4())

    with closing(get_db()) as conn:
        conn.execute(
            "INSERT INTO operations VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            (oid, now.strftime("%Y-%m-%dT%H:%M:%S"), now.strftime("%Y-%m-%d"),
             body.get("name", "Operação"), body.get("pair", 1),
             json.dumps(body.get("entries", [])),
             json.dumps(body.get("protection")) if body.get("protection") else None,
             body.get("profit"), body.get("total_stake"), 0, uid)
        )
        conn.commit()
        row = conn.execute("SELECT * FROM operations WHERE id=? AND user_id=?", (oid, uid)).fetchone()

    return jsonify(_op(row)), 201


@app.route("/api/operations/archive-all", methods=["POST"])
@login_required
def api_archive_all_operations():
    uid   = session["user_id"]
    today = date.today().isoformat()
    with closing(get_db()) as conn:
        conn.execute(
            "UPDATE operations SET archived=1 WHERE user_id=? AND op_date=? AND (archived IS NULL OR archived=0)",
            (uid, today)
        )
        conn.commit()
    return jsonify({"ok": True})


@app.route("/api/operations/clear-archived", methods=["POST"])
@login_required
def api_clear_archived_operations():
    uid = session["user_id"]
    with closing(get_db()) as conn:
        conn.execute("DELETE FROM operations WHERE user_id=? AND archived=1", (uid,))
        conn.commit()
    return jsonify({"ok": True})


@app.route("/api/operations/clear-archived-filtered", methods=["POST"])
@login_required
def api_clear_archived_operations_filtered():
    uid = session["user_id"]
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")

    with closing(get_db()) as conn:
        if start_date and end_date:
            conn.execute(
                "DELETE FROM operations WHERE user_id=? AND archived=1 AND op_date BETWEEN ? AND ?",
                (uid, start_date, end_date)
            )
        elif start_date:
            conn.execute(
                "DELETE FROM operations WHERE user_id=? AND archived=1 AND op_date >= ?",
                (uid, start_date)
            )
        elif end_date:
            conn.execute(
                "DELETE FROM operations WHERE user_id=? AND archived=1 AND op_date <= ?",
                (uid, end_date)
            )
        else:
            conn.execute("DELETE FROM operations WHERE user_id=? AND archived=1", (uid,))
        conn.commit()
    return jsonify({"ok": True})


@app.route("/api/operations/<oid>/archive", methods=["POST"])
@login_required
def api_archive_operation(oid):
    uid = session["user_id"]
    with closing(get_db()) as conn:
        conn.execute("UPDATE operations SET archived=1 WHERE id=? AND user_id=?", (oid, uid))
        conn.commit()
    return jsonify({"ok": True})


@app.route("/api/operations/<oid>", methods=["DELETE"])
@login_required
def api_delete_operation(oid):
    uid = session["user_id"]
    with closing(get_db()) as conn:
        conn.execute("DELETE FROM operations WHERE id=? AND user_id=?", (oid, uid))
        conn.commit()
    return jsonify({"ok": True})


@app.route("/api/operations/<oid>", methods=["PUT"])
@login_required
def api_update_operation(oid):
    uid = session["user_id"]
    body = request.get_json(silent=True) or {}

    with closing(get_db()) as conn:
        row = conn.execute("SELECT * FROM operations WHERE id=? AND user_id=?", (oid, uid)).fetchone()
        if not row:
            return jsonify({"error": "not found"}), 404

        op = _op(row)

        # Get old entries to clean up old account usage
        old_entries = op["entries"] or []

        # Build update statement
        updates = []
        values = []

        if "name" in body:
            updates.append("name=?")
            values.append(body["name"])
        if "entries" in body:
            updates.append("entries=?")
            values.append(json.dumps(body["entries"]))
        if "protection" in body:
            updates.append("protection=?")
            values.append(json.dumps(body["protection"]) if body.get("protection") else None)
        if "profit" in body:
            updates.append("profit=?")
            values.append(body["profit"])
        if "total_stake" in body:
            updates.append("total_stake=?")
            values.append(body["total_stake"])
        if "pair" in body:
            updates.append("pair=?")
            values.append(body["pair"])

        if updates:
            values.append(oid)
            values.append(uid)
            sql = f"UPDATE operations SET {', '.join(updates)} WHERE id=? AND user_id=?"
            conn.execute(sql, tuple(values))
            conn.commit()

        # Fetch updated operation
        updated_row = conn.execute("SELECT * FROM operations WHERE id=? AND user_id=?", (oid, uid)).fetchone()
        return jsonify(_op(updated_row))


# ── History API ────────────────────────────────────────────────────────────────

@app.route("/api/history", methods=["GET"])
@login_required
def api_get_history():
    uid   = session["user_id"]
    today = date.today().isoformat()
    with closing(get_db()) as conn:
        rows = conn.execute(
            "SELECT * FROM operations WHERE user_id=? AND (op_date<? OR archived=1) ORDER BY op_date DESC, created_at",
            (uid, today)
        ).fetchall()

    by_date = {}
    for row in rows:
        o = _op(row)
        by_date.setdefault(o["op_date"], []).append(o)

    result = []
    for d, ops in sorted(by_date.items(), reverse=True):
        ops_with_profit = [o for o in ops if o["profit"] is not None]
        day_profit = sum(o["profit"] for o in ops_with_profit) if ops_with_profit else None
        day_stake  = sum(o["total_stake"] or 0 for o in ops)
        result.append({
            "date": d,
            "operations": ops,
            "day_profit": day_profit,
            "day_stake": day_stake,
        })

    return jsonify(result)


# ── Boot ───────────────────────────────────────────────────────────────────────

init_db()

if __name__ == "__main__":
    import os
    # Only run server in development, not during Netlify builds
    # Netlify build will set FLASK_DEBUG=0 by default
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    app.run(debug=debug, host="0.0.0.0", port=int(os.environ.get("PORT", "5000")))
