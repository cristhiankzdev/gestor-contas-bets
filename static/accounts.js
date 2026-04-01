(() => {
  const $ = id => document.getElementById(id);

  // ── Estado ─────────────────────────────────────────
  let accounts = [];
  let settings = {};
  let editingId = null;
  let editingStatus = "Normal";

  let sortState = { col: null, dir: 1 };
  let operations = [];

  let portalEl = null;
  let portalKey = null;

  const COND_GROUP_ORDER = { 5: 0, 6: 1, 7: 2, 0: 9 };

  const CONDITIONS = [
    { value: 0, label: "—",         color: null,      type: "none" },
    { value: 5, label: "Código",    color: "#ec4899", type: "special" },
    { value: 6, label: "Depositar", color: "#16a34a", type: "special" },
    { value: 7, label: "Limitada",  color: "#ef4444", type: "special" },
  ];

  function getCondition(value) {
    return CONDITIONS.find(c => c.value === value) || CONDITIONS[0];
  }

  function calculateOpCounts() {
    const opCounts = {};
    operations.forEach(op => {
      op.entries.forEach(entry => {
        const accountId = entry.account_id;
        if (accountId) {
          opCounts[accountId] = (opCounts[accountId] || 0) + 1;
        }
      });
    });
    return opCounts;
  }

  // ── API ────────────────────────────────────────────
  async function api(method, path, body) {
    const opts = { method, headers: { "Content-Type": "application/json" } };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch(path, opts);
    const data = await res.json();
    if (!res.ok) {
      console.error(`[API ERROR] ${method} ${path}:`, data.error || res.statusText);
      throw new Error(data.error || `API error: ${res.status}`);
    }
    return data;
  }

  async function load() {
    try {
      console.log('[DEBUG] Loading accounts...');
      const data = await api("GET", "/api/accounts");
      console.log('[DEBUG] Accounts loaded:', data);
      accounts = data.accounts || [];
      settings = data.settings || settings;
      console.log('[DEBUG] Total accounts:', accounts.length);
      render();
    } catch (err) {
      console.error('[ERROR] Failed to load accounts:', err);
      // Se houver erro de auth, redireciona para login
      if (err.error === 'unauthorized' || err.message?.includes('unauthorized') || err.message?.includes('401')) {
        console.log('[AUTH] Unauthorized, redirecting to login');
        window.location.href = '/login';
      } else {
        console.error('[ERROR] Detailed error:', err);
        alert('Erro ao carregar contas. Tente recarregar a página.');
      }
    }
  }

  async function saveField(id, field, value) {
    await api("PUT", `/api/accounts/${id}`, { [field]: value });
  }

  // ── Portal dropdown ────────────────────────────────
  function closePortal() {
    if (portalEl) { portalEl.remove(); portalEl = null; portalKey = null; }
  }

  function openCondPortal(triggerEl, acc) {
    closePortal();
    portalKey = acc.id;

    const rect = triggerEl.getBoundingClientRect();
    const portal = document.createElement("div");
    portal.className = "cond-portal";

    const left = Math.min(rect.left, window.innerWidth - 170);
    portal.style.top  = (rect.bottom + 4) + "px";
    portal.style.left = left + "px";

    CONDITIONS.forEach((c, idx) => {
      const isActive = acc.condition === c.value;

      if (idx === 1) {
        const sep = document.createElement("div");
        sep.className = "cond-portal-divider";
        portal.appendChild(sep);
      }

      const btn = document.createElement("button");
      btn.className = "cond-portal-option" + (isActive ? " active" : "");
      if (c.color) {
        btn.style.setProperty("--opt-color", c.color);
        btn.style.setProperty("--opt-bg", "rgba(0,0,0,0.1)");
      }

      const dot = document.createElement("span");
      dot.className = "cond-opt-dot";
      dot.style.background = c.color || "#e2e6ea";

      const label = document.createElement("span");
      label.textContent = c.label;

      btn.appendChild(dot);
      btn.appendChild(label);

      if (isActive) {
        const check = document.createElement("i");
        check.className = "bi bi-check opt-check";
        btn.appendChild(check);
      }

      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const val = acc.condition === c.value ? 0 : c.value;
        const idx2 = accounts.findIndex(a => a.id === acc.id);
        accounts[idx2].condition = val;
        await saveField(acc.id, "condition", val);
        closePortal();
        const tr = document.querySelector(`tr[data-id="${acc.id}"]`);
        if (tr) tr.replaceWith(buildRow(accounts[idx2]));
      });

      portal.appendChild(btn);
    });

    portalEl = portal;
    document.body.appendChild(portal);
  }

  document.addEventListener("click", closePortal);
  window.addEventListener("scroll", closePortal, true);

  // ── Sort ───────────────────────────────────────────
  function getSorted() {
    return [...accounts].sort((a, b) => {
      if (!sortState.col) return 0;
      if (sortState.col === "name") {
        const va = (a.name || "").toLowerCase();
        const vb = (b.name || "").toLowerCase();
        if (va !== vb) return va < vb ? -sortState.dir : sortState.dir;
      } else if (sortState.col === "status") {
        const va = (a.status || "").toLowerCase();
        const vb = (b.status || "").toLowerCase();
        if (va !== vb) return va < vb ? -sortState.dir : sortState.dir;
      } else if (sortState.col === "condition") {
        const oa = COND_GROUP_ORDER[a.condition] ?? 99;
        const ob = COND_GROUP_ORDER[b.condition] ?? 99;
        if (oa !== ob) return (oa - ob) * sortState.dir;
      } else if (sortState.col === "op_count") {
        const va = a.op_count || 0;
        const vb = b.op_count || 0;
        if (va !== vb) return (va - vb) * sortState.dir;
      } else {
        const va = a[sortState.col];
        const vb = b[sortState.col];
        if (va === null && vb !== null) return 1;
        if (vb === null && va !== null) return -1;
        if (va !== null && vb !== null && va !== vb) return (va - vb) * sortState.dir;
      }
      return 0;
    });
  }

  function buildHeaders() {
    const tr = $("accounts-thead-row");
    if (!tr) return;
    tr.innerHTML = "";

    const staticLeft = [
      { label: "Nome",    cls: "col-name col-sortable",  sort: "name" },
      { label: "Tipo",    cls: "col-status col-sortable", sort: "status" },
      { label: "Freebet", cls: "col-value col-sortable",  sort: "freebet" },
      { label: "Saldo",   cls: "col-value col-sortable",  sort: "saldo" },
    ];

    staticLeft.forEach(({ label, cls, sort }) => {
      const th = document.createElement("th");
      th.className = cls;
      th.dataset.sort = sort;
      th.innerHTML = `${label} <span class="sort-icon"><i class="bi bi-chevron-expand"></i></span>`;
      tr.appendChild(th);
    });

    const thCond = document.createElement("th");
    thCond.className = "col-cond col-sortable";
    thCond.dataset.sort = "condition";
    thCond.innerHTML = `Condição <span class="sort-icon"><i class="bi bi-chevron-expand"></i></span>`;
    tr.appendChild(thCond);

    // Operações do dia column
    const thOpCount = document.createElement("th");
    thOpCount.className = "col-op-count col-sortable";
    thOpCount.dataset.sort = "op_count";
    thOpCount.innerHTML = `Ops/Dia <span class="sort-icon"><i class="bi bi-chevron-expand"></i></span>`;
    tr.appendChild(thOpCount);

    for (let i = 1; i <= 2; i++) {
      const th = document.createElement("th");
      th.className = "col-note";
      th.textContent = `Nota ${i}`;
      tr.appendChild(th);
    }

    const thAct = document.createElement("th");
    thAct.className = "col-actions";
    tr.appendChild(thAct);

    setupSortListeners();
    updateSortIcons();
  }

  function setupSortListeners() {
    document.querySelectorAll("#accounts-thead-row .col-sortable[data-sort]").forEach(th => {
      th.addEventListener("click", () => {
        const col = th.dataset.sort;
        if (sortState.col === col) {
          sortState.dir = sortState.dir === 1 ? -1 : (sortState.col = null, 1);
        } else {
          sortState.col = col;
          sortState.dir = 1;
        }
        updateSortIcons();
        renderRows();
      });
    });
  }

  function updateSortIcons() {
    document.querySelectorAll("#accounts-thead-row .col-sortable[data-sort]").forEach(th => {
      const col = th.dataset.sort;
      const icon = th.querySelector(".sort-icon");
      if (!icon) return;
      if (sortState.col === col) {
        th.classList.add("sorted");
        icon.innerHTML = sortState.dir === 1
          ? '<i class="bi bi-arrow-up"></i>'
          : '<i class="bi bi-arrow-down"></i>';
      } else {
        th.classList.remove("sorted");
        icon.innerHTML = '<i class="bi bi-chevron-expand"></i>';
      }
    });
  }

  // ── Render ─────────────────────────────────────────
  function render() {
    console.log('Rendering accounts:', accounts.length);
    const loadingEl = $("loading");
    if (loadingEl) loadingEl.classList.add("d-none");

    const badgeCountEl = $("badge-count");
    if (badgeCountEl) {
      badgeCountEl.textContent = `${accounts.length} conta${accounts.length !== 1 ? "s" : ""}`;
    }

    // Display today's date
    const todayDateEl = $("today-date");
    if (todayDateEl) {
      const today = new Date();
      const day = String(today.getDate()).padStart(2, '0');
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const year = today.getFullYear();
      todayDateEl.textContent = `${day}/${month}/${year}`;
    }

    if (accounts.length === 0) {
      const emptyStateEl = $("empty-state");
      if (emptyStateEl) emptyStateEl.classList.remove("d-none");
      const tableWrapEl = $("accounts-table-wrap");
      if (tableWrapEl) tableWrapEl.classList.add("d-none");
      return;
    }

    const emptyStateEl = $("empty-state");
    if (emptyStateEl) emptyStateEl.classList.add("d-none");

    const tableWrapEl = $("accounts-table-wrap");
    if (tableWrapEl) tableWrapEl.classList.remove("d-none");

    buildHeaders();
    renderRows();
  }

  function renderRows() {
    const list = getSorted();
    const tbody = $("accounts-tbody");
    if (!tbody) return;

    // Calculate operation counts for each account
    const opCounts = calculateOpCounts();

    tbody.innerHTML = "";
    list.forEach(acc => tbody.appendChild(buildRow(acc, opCounts)));
  }

  function buildRow(acc, opCounts = {}) {
    const isGold  = acc.status === "Gold";
    const isBolsa = acc.status === "Bolsa";
    const notes  = acc.notes || ["", "", "", "", "", "", ""];
    const opConds = typeof acc.op_conditions === 'string' ? JSON.parse(acc.op_conditions) : acc.op_conditions || {};
    const cond   = getCondition(acc.condition);
    const opCount = opCounts[acc.id] || 0;

    const tr = document.createElement("tr");
    tr.dataset.id = acc.id;
    if (cond.color) {
      tr.style.setProperty("--row-cond-color", cond.color);
      tr.classList.add("has-special-cond");
    }

    // Nome
    const tdName = document.createElement("td");
    tdName.className = "col-name";
    tdName.innerHTML = `<span class="account-name">${escHtml(acc.name)}</span>`;
    tr.appendChild(tdName);

    // Status
    const tdStatus = document.createElement("td");
    tdStatus.className = "col-status";
    const statusLabel = isBolsa ? "Bolsa" : isGold ? "Gold" : "Normal";
    const statusCls   = isBolsa ? "bolsa" : isGold ? "gold" : "normal";
    tdStatus.innerHTML = `<span class="status-badge ${statusCls}">${statusLabel}</span>`;
    tr.appendChild(tdStatus);

    // Freebet
    const tdFb = document.createElement("td");
    tdFb.className = "col-value";
    tdFb.innerHTML = `
      <div class="value-input-wrap freebet-wrap ${acc.freebet !== null ? "has-value" : ""}">
        <span class="currency-sign">R$</span>
        <input type="number" step="0.01" min="0" class="value-input"
          placeholder="—" value="${acc.freebet !== null ? acc.freebet : ""}"
          data-field="freebet" data-id="${acc.id}" />
        ${acc.freebet !== null
          ? `<button class="btn-clear-value" data-field="freebet" data-id="${acc.id}" title="Remover freebet"><i class="bi bi-trash3"></i></button>`
          : ""}
      </div>`;
    tr.appendChild(tdFb);

    // Saldo
    const tdSaldo = document.createElement("td");
    tdSaldo.className = "col-value";
    tdSaldo.innerHTML = `
      <div class="value-input-wrap saldo-wrap ${acc.saldo !== null ? "has-value" : ""}">
        <span class="currency-sign">R$</span>
        <input type="number" step="0.01" class="value-input"
          placeholder="—" value="${acc.saldo !== null ? acc.saldo : ""}"
          data-field="saldo" data-id="${acc.id}" />
      </div>`;
    tr.appendChild(tdSaldo);

    // Condição
    const tdCond = document.createElement("td");
    tdCond.className = "col-cond";
    const trigger = document.createElement("button");
    trigger.className = "cond-trigger" + (acc.condition !== 0 ? " active" : "");
    if (cond.color) trigger.style.setProperty("--pill-color", cond.color);
    trigger.innerHTML = `${escHtml(cond.label)}<i class="bi bi-chevron-down chevron"></i>`;
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      if (portalKey === acc.id) closePortal();
      else openCondPortal(trigger, acc);
    });
    tdCond.appendChild(trigger);
    tr.appendChild(tdCond);

    // Operações do dia column
    const tdOpCount = document.createElement("td");
    tdOpCount.className = "col-op-count";
    if (opCount > 0) {
      tdOpCount.innerHTML = `<span class="op-count-badge">${opCount}</span>`;
    } else {
      tdOpCount.innerHTML = `<span class="op-count-empty">—</span>`;
    }
    tr.appendChild(tdOpCount);

    // Notas (2)
    notes.slice(0, 2).forEach((note, i) => {
      const tdNote = document.createElement("td");
      tdNote.className = "col-note";
      const input = document.createElement("input");
      input.type = "text";
      input.className = "note-input" + (note ? " has-text" : "");
      input.placeholder = "—";
      input.value = note;
      input.dataset.noteIdx = i;
      input.dataset.id = acc.id;
      tdNote.appendChild(input);
      tr.appendChild(tdNote);
    });

    // Ações
    const tdAct = document.createElement("td");
    tdAct.className = "col-actions";
    tdAct.innerHTML = `<button class="btn-icon btn-edit-account" data-id="${acc.id}" title="Editar conta"><i class="bi bi-pencil"></i></button>`;
    tr.appendChild(tdAct);

    bindRowEvents(tr, acc);
    return tr;
  }

  function bindRowEvents(tr, acc) {
    tr.querySelector(".btn-edit-account").addEventListener("click", () => openEditModal(acc));

    tr.querySelectorAll(".value-input").forEach(input => {
      input.addEventListener("focus", () => input.select());
      input.addEventListener("change", async () => {
        const val = input.value.trim() === "" ? null : parseFloat(input.value);
        const field = input.dataset.field;
        const id = input.dataset.id;
        const idx = accounts.findIndex(a => a.id === id);
        if (idx !== -1) accounts[idx][field] = val;
        await saveField(id, field, val);
        tr.replaceWith(buildRow(accounts[idx]));
      });
    });

    tr.querySelectorAll(".btn-clear-value").forEach(btn => {
      btn.addEventListener("click", async () => {
        const field = btn.dataset.field;
        const id = btn.dataset.id;
        const idx = accounts.findIndex(a => a.id === id);
        if (idx !== -1) accounts[idx][field] = null;
        await saveField(id, field, null);
        tr.replaceWith(buildRow(accounts[idx]));
      });
    });

    tr.querySelectorAll(".note-input").forEach(input => {
      input.addEventListener("change", async () => {
        const id = input.dataset.id;
        const noteIdx = parseInt(input.dataset.noteIdx);
        const idx = accounts.findIndex(a => a.id === id);
        if (idx !== -1) {
          accounts[idx].notes[noteIdx] = input.value;
          await saveField(id, "notes", accounts[idx].notes);
          input.classList.toggle("has-text", !!input.value);
        }
      });
    });
  }

  // ── Modal: editar conta ────────────────────────────
  const modalAccount = new bootstrap.Modal($("modal-account"));

  function openEditModal(acc) {
    editingId = acc.id;
    editingStatus = acc.status;
    $("edit-name").value = acc.name;
    $("edit-freebet").value = acc.freebet !== null && acc.freebet !== undefined ? acc.freebet : "";
    $("edit-saldo").value = acc.saldo !== null && acc.saldo !== undefined ? acc.saldo : "";
    updateStatusButtons(acc.status);
    $("modal-account-title").textContent = `Editar — ${acc.name}`;
    modalAccount.show();
  }

  function updateStatusButtons(status) {
    editingStatus = status;
    $("btn-status-normal").classList.toggle("active", status === "Normal");
    $("btn-status-gold").classList.toggle("active", status === "Gold");
    $("btn-status-bolsa").classList.toggle("active", status === "Bolsa");
  }

  $("btn-status-normal").addEventListener("click", () => updateStatusButtons("Normal"));
  $("btn-status-gold").addEventListener("click", () => updateStatusButtons("Gold"));
  $("btn-status-bolsa").addEventListener("click", () => updateStatusButtons("Bolsa"));

  $("btn-clear-edit-freebet").addEventListener("click", () => {
    $("edit-freebet").value = "";
  });

  $("btn-save-account").addEventListener("click", async () => {
    const name = $("edit-name").value.trim();
    if (!name) return;
    const freebetRaw = $("edit-freebet").value.trim();
    const saldoRaw   = $("edit-saldo").value.trim();
    const freebet = freebetRaw === "" ? null : parseFloat(freebetRaw);
    const saldo   = saldoRaw   === "" ? null : parseFloat(saldoRaw);
    const idx = accounts.findIndex(a => a.id === editingId);
    if (idx !== -1) {
      accounts[idx].name    = name;
      accounts[idx].status  = editingStatus;
      accounts[idx].freebet = freebet;
      accounts[idx].saldo   = saldo;
      await api("PUT", `/api/accounts/${editingId}`, { name, status: editingStatus, freebet, saldo });
    }
    modalAccount.hide();
    render();
  });

  $("btn-delete-account").addEventListener("click", async () => {
    if (!confirm("Excluir esta conta?")) return;
    await api("DELETE", `/api/accounts/${editingId}`);
    accounts = accounts.filter(a => a.id !== editingId);
    modalAccount.hide();
    render();
  });

  // ── Gerir contas ───────────────────────────────────
  console.log('[DEBUG] Initializing modal-manage');
  const modalManageElement = $("modal-manage");
  if (!modalManageElement) {
    console.error('[ERROR] modal-manage element not found!');
  } else {
    console.log('[DEBUG] modal-manage element found');
  }
  const modalManage = new bootstrap.Modal(modalManageElement);

  function openManageModal() {
    console.log('[DEBUG] openManageModal called');
    renderManageList();
    $("new-account-name").value = "";
    console.log('[DEBUG] Showing modal-manage');
    modalManage.show();
  }

  function renderManageList() {
    const container = $("manage-accounts-list");
    container.innerHTML = "";
    if (accounts.length === 0) {
      container.innerHTML = `<p class="text-muted text-center py-3 small">Nenhuma conta ainda.</p>`;
      return;
    }
    accounts.forEach(acc => {
      const row = document.createElement("div");
      row.className = "manage-acc-item";
      row.dataset.id = acc.id;

      const inp = document.createElement("input");
      inp.type = "text";
      inp.className = "form-control form-control-sm manage-acc-input";
      inp.value = acc.name;
      inp.readOnly = true;

      const btnEdit = document.createElement("button");
      btnEdit.className = "btn-icon manage-btn-edit";
      btnEdit.title = "Renomear";
      btnEdit.innerHTML = '<i class="bi bi-pencil"></i>';

      const btnSave = document.createElement("button");
      btnSave.className = "btn-icon manage-btn-save d-none";
      btnSave.title = "Salvar nome";
      btnSave.innerHTML = '<i class="bi bi-check-lg text-success"></i>';

      const btnDel = document.createElement("button");
      btnDel.className = "btn-icon manage-btn-del";
      btnDel.title = "Excluir conta";
      btnDel.innerHTML = '<i class="bi bi-trash text-danger"></i>';

      row.appendChild(inp);
      row.appendChild(btnEdit);
      row.appendChild(btnSave);
      row.appendChild(btnDel);

      btnEdit.addEventListener("click", () => {
        inp.readOnly = false;
        inp.focus();
        inp.select();
        btnEdit.classList.add("d-none");
        btnSave.classList.remove("d-none");
      });

      const doSave = async () => {
        const newName = inp.value.trim();
        if (!newName) { inp.value = acc.name; }
        else if (newName !== acc.name) {
          const idx = accounts.findIndex(a => a.id === acc.id);
          if (idx !== -1) accounts[idx].name = newName;
          acc.name = newName;
          await api("PUT", `/api/accounts/${acc.id}`, { name: newName });
          render();
        }
        inp.readOnly = true;
        btnEdit.classList.remove("d-none");
        btnSave.classList.add("d-none");
      };

      btnSave.addEventListener("click", doSave);
      inp.addEventListener("keydown", e => { if (e.key === "Enter") doSave(); });

      btnDel.addEventListener("click", async () => {
        if (!confirm(`Excluir a conta "${acc.name}"?`)) return;
        await api("DELETE", `/api/accounts/${acc.id}`);
        accounts = accounts.filter(a => a.id !== acc.id);
        render();
        renderManageList();
      });

      container.appendChild(row);
    });
  }

  $("btn-add-new-account").addEventListener("click", async (e) => {
    e.preventDefault();
    console.log('[DEBUG] btn-add-new-account clicked');

    const name = $("new-account-name").value.trim();
    console.log('[DEBUG] Account name:', name);

    if (!name) {
      console.log('[DEBUG] Name is empty, returning');
      alert("Por favor, digite o nome da conta.");
      return;
    }

    try {
      console.log('[DEBUG] Calling API to create account...');
      const acc = await api("POST", "/api/accounts", { name });
      console.log('[DEBUG] Account created:', acc);

      accounts.push(acc);
      $("new-account-name").value = "";
      render();
      renderManageList();
    } catch (err) {
      console.error('[ERROR] Failed to create account:', err);
      alert("Erro ao criar conta: " + err.message);
    }
  });

  const btnAddEl = $("btn-add");
  if (btnAddEl) {
    console.log('[DEBUG] Found btn-add element');
    btnAddEl.addEventListener("click", openManageModal);
  } else {
    console.log('[DEBUG] btn-add element not found');
  }

  const btnAddEmptyEl = $("btn-add-empty");
  if (btnAddEmptyEl) {
    console.log('[DEBUG] Found btn-add-empty element');
    btnAddEmptyEl.addEventListener("click", () => {
      console.log('[DEBUG] btn-add-empty clicked');
      openManageModal();
    });
  } else {
    console.log('[DEBUG] btn-add-empty element not found');
  }

  // Botão de configurações abre modal centralizado
  const btnOpenSettings = $("btn-open-settings");
  const modalSettings = new bootstrap.Modal($("modal-settings"));
  if (btnOpenSettings) {
    btnOpenSettings.addEventListener("click", () => modalSettings.show());
  }

  // Botão "Criar Conta" dentro das configurações
  const btnSettingsCriar = $("btn-settings-criar-conta");
  if (btnSettingsCriar) {
    btnSettingsCriar.addEventListener("click", () => {
      modalSettings.hide();
      openManageModal();
    });
  }

  const newAccountNameEl = $("new-account-name");
  if (newAccountNameEl) {
    newAccountNameEl.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        const btnAddNew = $("btn-add-new-account");
        if (btnAddNew) btnAddNew.click();
      }
    });
  }

  // ── Helpers ────────────────────────────────────────
  function escHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // ── Operations ─────────────────────────────────────
  async function loadOperations() {
    const data = await api("GET", "/api/operations");
    operations = Array.isArray(data) ? data : [];
    buildHeaders();
    renderRows();
    renderOperations();
  }

  async function archiveOp(opId) {
    const op = operations.find(o => o.id === opId);
    if (!op) return;

    await api("POST", `/api/operations/${opId}/archive`);
    operations = operations.filter(o => o.id !== opId);

    // Remove o nome da operação dos op_conditions de todas as contas
    const opName = op.name;
    if (opName) {
      const updatedAccounts = await api("GET", "/api/accounts");
      for (const acc of updatedAccounts.accounts) {
        const opConds = typeof acc.op_conditions === 'string' ? JSON.parse(acc.op_conditions) : acc.op_conditions || {};
        if (opName in opConds) {
          delete opConds[opName];
          await api("PUT", `/api/accounts/${acc.id}`, { op_conditions: opConds });
        }
      }
    }

    buildHeaders();
    renderRows();
    renderOperations();

    // Recarrega contas para atualizar contagens de operações
    await load();
  }

  async function archiveAllOps() {
    if (!confirm("Arquivar todas as operações do dia? Elas só serão vistas no histórico.")) return;
    await api("POST", "/api/operations/archive-all");
    operations = [];
    buildHeaders();
    renderRows();
    renderOperations();

    // Recarrega contas para atualizar contagens de operações
    await load();
  }

  function renderOperations() {
    const section = $("operations-section");
    const list    = $("operations-list");
    if (operations.length === 0) { section.classList.add("d-none"); return; }
    section.classList.remove("d-none");

    // Rebuild section header with archive-all button
    const header = section.querySelector(".op-section-header");
    if (header && !header.querySelector(".btn-archive-all")) {
      const archBtn = document.createElement("button");
      archBtn.className = "btn btn-sm btn-outline-secondary btn-archive-all ms-auto";
      archBtn.title = "Arquivar todas as operações do dia";
      archBtn.innerHTML = '<i class="bi bi-archive me-1"></i>Arquivar tudo';
      archBtn.addEventListener("click", archiveAllOps);
      header.appendChild(archBtn);
    }

    list.innerHTML = "";
    operations.forEach(op => list.appendChild(buildOpCard(op)));

    // Total P&L summary
    const opsWithProfit = operations.filter(o => o.profit != null);
    if (opsWithProfit.length > 0) {
      const totalProfit = opsWithProfit.reduce((s, o) => s + o.profit, 0);
      const totalStake  = opsWithProfit.reduce((s, o) => s + (o.total_stake || 0), 0);
      const isPos = totalProfit >= 0;
      const sign  = isPos ? "+" : "−";
      const summDiv = document.createElement("div");
      summDiv.className = "op-total-summary";
      summDiv.innerHTML = `
        <span class="op-total-label"><i class="bi bi-calculator me-1"></i>Resumo do dia</span>
        <span class="op-total-stake">Investido: <strong>R$${totalStake.toFixed(2)}</strong></span>
        <span class="op-total-pl ${isPos ? "text-success" : "text-danger"}">
          Lucro: <strong>${sign}R$${Math.abs(totalProfit).toFixed(2)}</strong>
        </span>`;
      list.appendChild(summDiv);
    }
  }

  function fmtMoney(v) {
    const abs = Math.abs(v).toFixed(2);
    return (v >= 0 ? "+" : "−") + " R$ " + abs;
  }

  function buildOpCard(op) {
    const div = document.createElement("div");
    div.className = "op-row";

    const dt = new Date(op.created_at);
    const timeStr  = dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

    const chipsHtml = (op.entries || []).map(e =>
      `${escHtml(e.account_name)}&nbsp;${e.odd ? e.odd.toFixed(2) : "?"}&nbsp;R$${e.valor ? e.valor.toFixed(0) : "0"}`
    ).join(`<span class="op-row-sep"> · </span>`);

    // Profit display: use saved profit if available
    let plHtml;
    if (op.profit != null) {
      const isPos = op.profit >= 0;
      const sign  = isPos ? "+" : "−";
      plHtml = `<span class="${isPos ? "text-success" : "text-danger"}" style="font-weight:700">${sign}R$${Math.abs(op.profit).toFixed(2)}</span>`;
    } else {
      plHtml = `<span class="text-muted">—</span>`;
    }

    div.innerHTML = `
      <span class="op-row-name">${escHtml(op.name || "Operação")}</span>
      <span class="op-row-entries">${chipsHtml}</span>
      <span class="op-row-time">${timeStr}</span>
      <span class="op-row-pl">${plHtml}</span>
      <button class="btn-icon btn-edit-op" data-id="${op.id}" data-op='${JSON.stringify(op).replace(/'/g, "\\'")}' title="Editar">
        <i class="bi bi-pencil"></i>
      </button>
      <button class="btn-icon btn-archive-op" data-id="${op.id}" title="Arquivar (mover para histórico)">
        <i class="bi bi-archive"></i>
      </button>
      <button class="btn-icon btn-delete-op" data-id="${op.id}" title="Excluir">
        <i class="bi bi-trash"></i>
      </button>`;

    div.querySelector(".btn-edit-op").addEventListener("click", () => {
      // Armazena operação para edição e redireciona
      localStorage.setItem('editingOp', JSON.stringify(op));
      window.location.href = '/nova-operacao?edit=' + op.id;
    });

    div.querySelector(".btn-archive-op").addEventListener("click", async () => {
      if (!confirm("Arquivar esta operação? Ela só será vista no histórico.")) return;
      await archiveOp(op.id);
    });

    div.querySelector(".btn-delete-op").addEventListener("click", async () => {
      if (!confirm("Excluir esta operação?")) return;
      await api("DELETE", `/api/operations/${op.id}`);

      // Remove da lista e limpa op_conditions das contas
      operations = operations.filter(o => o.id !== op.id);
      buildHeaders();
      renderRows();
      renderOperations();

      // Desvincula nomes e limpa par da operação deletada
      await clearOpFromAccounts(op);
    });

    return div;
  }

  // ── Init ───────────────────────────────────────────
  console.log('[DEBUG] accounts.js initializing...');
  console.log('[DEBUG] Checking DOM elements...');

  // Check for critical elements
  const btnAddNewAccount = $("btn-add-new-account");
  if (!btnAddNewAccount) {
    console.error('[ERROR] btn-add-new-account element not found!');
  } else {
    console.log('[DEBUG] btn-add-new-account element found');
  }

  console.log('[DEBUG] Starting load process...');
  load().then(() => loadOperations());
})();

// Limpa par de operação deletada de todas as contas
async function clearOpFromAccounts(op) {
  const opName = op.name || "";
  if (!opName) return;

  const accsData = await api("GET", "/api/accounts");
  for (const acc of accsData.accounts) {
    const opConds = typeof acc.op_conditions === 'string' ? JSON.parse(acc.op_conditions) : acc.op_conditions || {};
    if (opName in opConds) {
      delete opConds[opName];
      await api("PUT", `/api/accounts/${acc.id}`, { op_conditions: opConds });
    }
  }
  // Recarrega contas para atualizar UI
  const accs = await api("GET", "/api/accounts");
  accounts = accs.accounts;
  renderRows();
  buildHeaders();
}
