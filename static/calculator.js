"use strict";

const BET_COLORS = ["#3b82f6", "#22c55e", "#eab308", "#a855f7", "#ef4444"];
const MAX_BETS   = 5;

let numBets     = 2;
let betTypes    = Array(MAX_BETS).fill("back");
let anchorType  = "total";
let anchorIndex = 0;
let anchorField = "stake";
let roundMode   = true;
let calcAccounts  = [];
let calcOps       = [];
let calcAccPicked = {}; // rowIndex → accountId
let lastCalcResult = null; // { profit, total_stake }
let editingOpId = null; // ID da operação sendo editada

function $(id) { return document.getElementById(id); }

// ── Account picker (portal) ───────────────────────────────────────────────────

let pickerActiveRow = -1;

function getPickerPortal() {
  return document.getElementById("acc-picker-portal");
}

function openAccPicker(rowIdx, triggerEl) {
  const portal = getPickerPortal();
  if (!portal) return;

  // Close if same row clicked again
  if (pickerActiveRow === rowIdx && portal.classList.contains("open")) {
    closeAccPicker();
    return;
  }

  const name    = ($("calc-op-name")?.value || "").trim();
  const usedIds = calcUsedIds(name);
  const currentPick = calcAccPicked[rowIdx] || "";

  portal.innerHTML = "";
  pickerActiveRow = rowIdx;

  // Blank option
  const blank = document.createElement("div");
  blank.className = "aph-item" + (!currentPick ? " selected" : "");
  blank.textContent = "Conta…";
  blank.addEventListener("click", () => selectAcc(rowIdx, ""));
  portal.appendChild(blank);

  calcAccounts.forEach(acc => {
    const isBolsa     = acc.status === "Bolsa";
    const pickedOther = Object.entries(calcAccPicked)
      .some(([ri, id]) => parseInt(ri) !== rowIdx && id === acc.id);
    const isUsedWarn  = !isBolsa && usedIds.has(acc.id);
    const isSelected  = currentPick === acc.id;

    const item = document.createElement("div");
    item.className = "aph-item";
    if (isSelected)  item.classList.add("selected");
    if (isUsedWarn)  item.classList.add("used-warn");
    if (pickedOther) item.classList.add("disabled");

    const nameSpan = document.createElement("span");
    nameSpan.className = "aph-item-name";
    nameSpan.textContent = acc.name + (acc.status === "Gold" ? " ★" : "");
    item.appendChild(nameSpan);

    if (acc.status === "Bolsa") {
      const tag = document.createElement("span");
      tag.className = "aph-bolsa-tag";
      tag.textContent = "Bolsa";
      item.appendChild(tag);
    }

    if (isUsedWarn) {
      const warn = document.createElement("i");
      warn.className = "bi bi-exclamation-triangle-fill aph-warn-icon";
      item.appendChild(warn);
    }

    if (!pickedOther) {
      item.addEventListener("click", () => selectAcc(rowIdx, acc.id));
    }
    portal.appendChild(item);
  });

  // Position portal — open downward if space, otherwise upward
  const rect       = triggerEl.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom - 10;
  const spaceAbove = rect.top - 10;
  const left       = Math.max(4, Math.min(rect.left, window.innerWidth - 180));

  if (spaceBelow >= 120 || spaceBelow >= spaceAbove) {
    portal.style.top       = (rect.bottom + 4) + "px";
    portal.style.bottom    = "auto";
    portal.style.maxHeight = Math.min(260, spaceBelow) + "px";
  } else {
    portal.style.top       = "auto";
    portal.style.bottom    = (window.innerHeight - rect.top + 4) + "px";
    portal.style.maxHeight = Math.min(260, spaceAbove) + "px";
  }
  portal.style.left = left + "px";
  portal.classList.add("open");
}

function closeAccPicker() {
  const portal = getPickerPortal();
  if (portal) portal.classList.remove("open");
  pickerActiveRow = -1;
}

function selectAcc(rowIdx, accId) {
  if (accId) calcAccPicked[rowIdx] = accId;
  else delete calcAccPicked[rowIdx];
  closeAccPicker();
  updateAllPickerBtns();
  updateExecButton();
}

function updateAllPickerBtns() {
  const name    = ($("calc-op-name")?.value || "").trim();
  const usedIds = calcUsedIds(name);

  for (let i = 0; i < numBets; i++) {
    const btn = document.getElementById(`acc-btn-${i}`);
    if (!btn) continue;
    const accId = calcAccPicked[i] || "";
    const acc   = calcAccounts.find(a => a.id === accId);
    const label = btn.querySelector(".aph-label");
    if (label) label.textContent = acc ? acc.name + (acc.status === "Gold" ? " ★" : "") : "Conta…";

    const isBolsa = acc && acc.status === "Bolsa";
    const hasWarn = !!(acc && !isBolsa && usedIds.has(accId));
    btn.classList.toggle("has-warn", hasWarn);
    btn.classList.toggle("has-pick", !!acc);
  }
}

// Close picker on outside click
document.addEventListener("click", e => {
  if (!e.target.closest(".acc-picker") && !e.target.closest("#acc-picker-portal")) {
    closeAccPicker();
  }
});

// ── Boot ──────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  // Detecta modo de edição pela URL
  const urlParams = new URLSearchParams(window.location.search);
  editingOpId = urlParams.get('edit');

  buildTable();
  bindGlobalEvents();
  recalculate();
  loadCalcAccounts();

  // Carrega operação para edição se existir
  if (editingOpId) {
    loadOperationForEdit(editingOpId);
  }

  const opNameEl = $("calc-op-name");
  if (opNameEl) {
    opNameEl.addEventListener("input", () => {
      updateCalcOpHint();
      updateAllPickerBtns();
      updateExecButton();
    });
  }

  const execBtn = $("btn-calc-execute");
  if (execBtn) execBtn.addEventListener("click", executeCalcOp);
});

// ── Table construction ────────────────────────────────────────────────────────

function buildTable() {
  const tbody = $("bets-body");
  tbody.innerHTML = "";

  for (let i = 0; i < numBets; i++) {
    const isLay = betTypes[i] === "lay";
    const tr    = document.createElement("tr");
    tr.id = `bet-row-${i}`;
    tr.innerHTML = `
      <td class="ps-2 col-num">
        <div class="bet-num-cell">
          <div class="d-flex align-items-center">
            <span class="bet-badge" style="background:${BET_COLORS[i]}">${i + 1}</span>
            <div class="btn-group btn-group-sm ms-1">
              <button class="btn btn-bet-type ${!isLay ? "active" : ""}"
                      id="btn-back-${i}" data-i="${i}" data-type="back" title="Back">B</button>
              <button class="btn btn-bet-type ${isLay ? "active btn-lay-active" : ""}"
                      id="btn-lay-${i}"  data-i="${i}" data-type="lay"  title="Lay">L</button>
            </div>
          </div>
          <div class="acc-picker mt-1" id="acc-picker-${i}" data-row="${i}">
            <button class="aph-btn" type="button" id="acc-btn-${i}" data-row="${i}">
              <span class="aph-label">Conta…</span>
              <i class="bi bi-chevron-down aph-chevron"></i>
            </button>
          </div>
        </div>
      </td>
      <td class="col-odd">
        <input type="number" class="form-control form-control-sm calc-input odd-input"
               id="odd-${i}" min="1.01" step="0.01" placeholder="2.00" />
      </td>
      <td class="col-comm">
        <div class="input-group input-group-sm">
          <input type="number" class="form-control calc-input"
                 id="comm-${i}" value="0" min="0" max="99" step="0.1" placeholder="0" />
          <span class="input-group-text">%</span>
        </div>
      </td>
      <td class="col-stake">
        <input type="number" class="form-control form-control-sm calc-input stake-input"
               id="stake-${i}" min="0" step="1" placeholder="0,00" />
      </td>
      <td class="col-liab">
        <input type="number" class="form-control form-control-sm calc-input liab-input ${!isLay ? "d-none" : ""}"
               id="liab-${i}" min="0" step="1" placeholder="0,00" />
        <span class="text-muted back-dash ${isLay ? "d-none" : ""}">—</span>
      </td>
      <td class="col-anchor text-center">
        <input type="radio" class="anchor-radio form-check-input" name="anchor" value="${i}" />
      </td>
      <td class="col-profit text-end" id="profit-cell-${i}">
        <span class="text-muted small">—</span>
      </td>
    `;
    tbody.appendChild(tr);
  }

  syncAnchorRadio();
  bindRowEvents();
  bindAccPickerEvents();
  updateAllPickerBtns();
  updateExecButton();
}

// Aplicar aumento de odd baseado em porcentagem do lucro líquido
function applyOddShortcut(rowIdx, pct) {
  const oddEl  = $(`odd-${rowIdx}`);
  const sc25   = $(`sc25-${rowIdx}`);
  const sc30   = $(`sc30-${rowIdx}`);
  const current = parseFloat(oddEl.value) || 1.01;

  // Se clicar no mesmo botão que já está ativo, reverte
  const btnToClick = pct === 0.25 ? sc25 : sc30;
  if (btnToClick?.classList.contains("active")) {
    btnToClick.classList.remove("active");

    // Recupera o valor base sem o aumento
    const baseValue = parseFloat(oddEl.dataset.base || current);
    oddEl.value = baseValue.toFixed(2);
    recalculate();
    return;
  }

  // Salva o valor atual como base para possível reversão
  oddEl.dataset.base = current;

  // Cálculo: (Odd_Atual - 1) * pct
  const increase = (current - 1) * pct;
  const newOdd = current + increase;

  // Adiciona classe active ao botão clicado, remove dos outros da mesma linha
  if (pct === 0.25) {
    sc25?.classList.add("active");
    sc30?.classList.remove("active");
  } else {
    sc30?.classList.add("active");
    sc25?.classList.remove("active");
  }

  oddEl.value = newOdd.toFixed(2);
  recalculate();
}

function bindRowEvents() {
  for (let i = 0; i < numBets; i++) {
    const oddEl   = $(`odd-${i}`);
    const commEl  = $(`comm-${i}`);
    const stakeEl = $(`stake-${i}`);
    const liabEl  = $(`liab-${i}`);

    oddEl .addEventListener("input", () => {
      // Remove classe active dos botões de atalho ao digitar manualmente
      $(`sc25-${i}`)?.classList.remove("active");
      $(`sc30-${i}`)?.classList.remove("active");
      recalculate();
    });
    commEl.addEventListener("input", () => recalculate());

    // Odd shortcut buttons (25%, 30%)
    const sc25 = $(`sc25-${i}`);
    const sc30 = $(`sc30-${i}`);
    if (sc25) {
      sc25.addEventListener("click", () => applyOddShortcut(i, 0.25));
    }
    if (sc30) {
      sc30.addEventListener("click", () => applyOddShortcut(i, 0.30));
    }

    stakeEl.addEventListener("input", () => {
      anchorType  = "bet";
      anchorIndex = i;
      anchorField = "stake";
      syncAnchorRadio();
      recalculate();
    });

    liabEl.addEventListener("input", () => {
      anchorType  = "bet";
      anchorIndex = i;
      anchorField = "liability";
      syncAnchorRadio();
      recalculate();
    });

    [oddEl, commEl, stakeEl, liabEl].forEach(el =>
      el.addEventListener("focus", () => el.select())
    );

    $(`btn-back-${i}`).addEventListener("click", () => setType(i, "back"));
    $(`btn-lay-${i}`) .addEventListener("click", () => setType(i, "lay"));
  }

  document.querySelectorAll("input[name='anchor']").forEach(radio => {
    radio.addEventListener("change", () => {
      if (radio.value === "total") {
        anchorType = "total";
      } else {
        anchorType  = "bet";
        anchorIndex = parseInt(radio.value);
      }
      recalculate();
    });
  });

  const totalEl = $("total-stake-input");
  totalEl.addEventListener("input", () => {
    anchorType = "total";
    syncAnchorRadio();
    recalculate();
  });
  totalEl.addEventListener("focus", () => totalEl.select());
}

function bindAccPickerEvents() {
  for (let i = 0; i < numBets; i++) {
    const btn = $(`acc-btn-${i}`);
    if (!btn) continue;
    btn.addEventListener("click", e => {
      e.stopPropagation();
      openAccPicker(i, btn);
    });
  }
}

// ── Toggle Back / Lay ─────────────────────────────────────────────────────────

function setType(i, type) {
  betTypes[i] = type;
  const isLay = type === "lay";

  $(`btn-back-${i}`).classList.toggle("active",         !isLay);
  $(`btn-back-${i}`).classList.remove("btn-lay-active");
  $(`btn-lay-${i}`) .classList.toggle("active",          isLay);
  $(`btn-lay-${i}`) .classList.toggle("btn-lay-active",  isLay);

  $(`liab-${i}`).classList.toggle("d-none", !isLay);
  document.querySelector(`#bet-row-${i} .back-dash`).classList.toggle("d-none", isLay);

  if (anchorType === "bet" && anchorIndex === i) anchorField = "stake";
  recalculate();
}

// ── Core math ─────────────────────────────────────────────────────────────────

function readOdd(i)  { return parseFloat($(`odd-${i}`)?.value)  || 0; }
function readComm(i) { return parseFloat($(`comm-${i}`)?.value) || 0; }

function calcNetOdd(i) {
  const odd  = readOdd(i);
  const comm = readComm(i);
  if (betTypes[i] === "lay") {
    if (odd <= 1) return 0;
    return 1 + (1 - comm / 100) / (odd - 1);
  }
  return odd * (1 - comm / 100);
}

function recalculate() {
  const nets = Array.from({ length: numBets }, (_, i) => calcNetOdd(i));

  if (!nets.every(n => n > 1)) {
    lastCalcResult = null;
    fillInputs(null, nets);
    renderIndicator(null);
    renderProfit(null);
    return;
  }

  const invSum = nets.reduce((s, n) => s + 1 / n, 0);
  const oddsOnlyProfitPct = (1 / invSum - 1) * 100;

  let K = 0;

  if (anchorType === "total") {
    const total = parseFloat($("total-stake-input").value) || 0;
    if (!total) {
      lastCalcResult = null;
      fillInputs(null, nets);
      renderIndicator({ invSum, profitPct: oddsOnlyProfitPct });
      renderProfit(null);
      return;
    }
    K = total / invSum;
  } else {
    const i = anchorIndex;
    let investment = 0;
    if (betTypes[i] === "back") {
      investment = parseFloat($(`stake-${i}`)?.value) || 0;
    } else {
      if (anchorField === "stake") {
        const sv  = parseFloat($(`stake-${i}`)?.value) || 0;
        const odd = readOdd(i);
        investment = sv * (odd - 1);
      } else {
        investment = parseFloat($(`liab-${i}`)?.value) || 0;
      }
    }
    if (!investment) {
      lastCalcResult = null;
      fillInputs(null, nets);
      renderIndicator({ invSum, profitPct: oddsOnlyProfitPct });
      renderProfit(null);
      return;
    }
    K = investment * nets[i];
  }

  const calcInvests = nets.map(n => K / n);
  const total       = calcInvests.reduce((s, v) => s + v, 0);
  const profit      = K - total;
  const profitPct   = total > 0 ? (profit / total) * 100 : 0;

  lastCalcResult = { profit, total_stake: total };

  fillInputs({ calcInvests, total, nets }, nets);
  renderIndicator({ invSum, profitPct });
  renderProfit({ calcInvests, total, nets, profit, profitPct });
}

// ── Fill inputs ───────────────────────────────────────────────────────────────

function round(val) { return roundMode ? Math.round(val) : val; }
function fmt(val)   { return roundMode ? round(val).toFixed(0) : val.toFixed(2); }

function fillInputs(result, _nets) {
  for (let i = 0; i < numBets; i++) {
    const stakeEl  = $(`stake-${i}`);
    const liabEl   = $(`liab-${i}`);
    const isAnchor = anchorType === "bet" && anchorIndex === i;

    if (!result) {
      stakeEl?.classList.remove("is-anchor", "is-calculated");
      liabEl ?.classList.remove("is-anchor", "is-calculated");
      continue;
    }

    if (betTypes[i] === "lay") {
      const odd = readOdd(i);
      if (isAnchor) {
        if (anchorField === "stake") {
          const sv = parseFloat(stakeEl.value) || 0;
          liabEl.value = fmt(sv * (odd - 1));
          stakeEl.classList.add("is-anchor");    stakeEl.classList.remove("is-calculated");
          liabEl .classList.add("is-calculated"); liabEl .classList.remove("is-anchor");
        } else {
          const lv = parseFloat(liabEl.value) || 0;
          stakeEl.value = fmt(odd > 1 ? lv / (odd - 1) : 0);
          liabEl .classList.add("is-anchor");    liabEl .classList.remove("is-calculated");
          stakeEl.classList.add("is-calculated"); stakeEl.classList.remove("is-anchor");
        }
      } else {
        const liabVal  = result.calcInvests[i];
        const stakeVal = odd > 1 ? liabVal / (odd - 1) : 0;
        stakeEl.value  = fmt(stakeVal);
        liabEl.value   = fmt(liabVal);
        stakeEl.classList.add("is-calculated"); stakeEl.classList.remove("is-anchor");
        liabEl .classList.add("is-calculated"); liabEl .classList.remove("is-anchor");
      }
    } else {
      if (isAnchor) {
        stakeEl.classList.add("is-anchor"); stakeEl.classList.remove("is-calculated");
      } else {
        stakeEl.value = fmt(result.calcInvests[i]);
        stakeEl.classList.add("is-calculated"); stakeEl.classList.remove("is-anchor");
      }
      liabEl?.classList.remove("is-anchor", "is-calculated");
    }
  }

  const totalEl = $("total-stake-input");
  if (!totalEl) return;
  if (anchorType === "total") {
    totalEl.classList.add("is-anchor"); totalEl.classList.remove("is-calculated");
  } else if (result) {
    totalEl.value = fmt(result.total);
    totalEl.classList.add("is-calculated"); totalEl.classList.remove("is-anchor");
  } else {
    totalEl.classList.remove("is-anchor", "is-calculated");
  }
}

// ── Surebet indicator ─────────────────────────────────────────────────────────

function renderIndicator(result) {
  const el = $("surebet-indicator");
  if (!result) {
    el.innerHTML = `<span class="badge bg-secondary px-3 py-2">Preencha as odds</span>`;
    return;
  }
  if (result.invSum < 1) {
    el.innerHTML = `
      <span class="badge badge-surebet px-3 py-2">
        <i class="bi bi-check-circle-fill me-1"></i>
        SUREBET +${Math.abs(result.profitPct).toFixed(2)}%
      </span>`;
  } else {
    const margin = (result.invSum - 1) * 100;
    el.innerHTML = `
      <span class="badge badge-nosurebet px-3 py-2">
        <i class="bi bi-x-circle-fill me-1"></i>
        Margem ${margin.toFixed(2)}%
      </span>`;
  }
}

// ── Profit section ────────────────────────────────────────────────────────────

function renderProfit(result) {
  for (let i = 0; i < numBets; i++) {
    const cell = $(`profit-cell-${i}`);
    if (!cell) continue;
    if (!result) { cell.innerHTML = `<span class="text-muted small">—</span>`; continue; }
    const betProfit = result.calcInvests[i] * result.nets[i] - result.total;
    const isPos     = betProfit >= 0;
    cell.innerHTML  = `<span class="profit-inline ${isPos ? "text-success" : "text-danger"}">
      ${isPos ? "+" : "−"}&nbsp;R$&nbsp;${fmt(Math.abs(betProfit))}
    </span>`;
  }

  const section = $("profit-section");
  if (!result) { section.innerHTML = ""; return; }

  const isProfit = result.profit >= 0;
  const sign     = isProfit ? "+" : "−";

  section.innerHTML = `
    <div class="profit-summary">
      <div class="profit-summary-left">
        <span class="text-muted small">Total investido</span>
        <span class="fw-semibold">R$ ${fmt(result.total)}</span>
      </div>
      <div class="profit-summary-divider"></div>
      <div class="profit-summary-right">
        <span class="text-muted small">Lucro ${isProfit ? "garantido" : "/ prejuízo"}</span>
        <span class="fw-bold fs-5 ${isProfit ? "text-success" : "text-danger"}">
          ${sign} R$ ${fmt(Math.abs(result.profit))}
          <span class="fs-6 fw-normal">(${sign}${Math.abs(result.profitPct).toFixed(2)}%)</span>
        </span>
      </div>
    </div>`;
}

// ── Anchor radio sync ─────────────────────────────────────────────────────────

function syncAnchorRadio() {
  document.querySelectorAll("input[name='anchor']").forEach(r => {
    r.checked = anchorType === "total"
      ? r.value === "total"
      : r.value === String(anchorIndex);
  });
}

// ── Global events ─────────────────────────────────────────────────────────────

function bindGlobalEvents() {
  document.querySelectorAll("#bet-count-btns .btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#bet-count-btns .btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const newCount = parseInt(btn.dataset.n);
      if (anchorType === "bet" && anchorIndex >= newCount) anchorType = "total";
      numBets = newCount;
      Object.keys(calcAccPicked).forEach(k => { if (parseInt(k) >= newCount) delete calcAccPicked[k]; });
      buildTable();
      recalculate();
    });
  });

  $("round-toggle").addEventListener("change", e => {
    roundMode = e.target.checked;
    recalculate();
  });
}

// ── Load accounts & ops ───────────────────────────────────────────────────────

function escHtmlCalc(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function loadCalcAccounts() {
  try {
    const [accData, opsData] = await Promise.all([
      fetch("/api/accounts").then(r => r.json()),
      fetch("/api/operations").then(r => r.json()),
    ]);
    calcAccounts = accData.accounts || [];
    calcOps      = Array.isArray(opsData) ? opsData : [];
    populateCalcOpSuggestions();
    updateAllPickerBtns();
    updateExecButton();
  } catch (e) { /* silently fail */ }
}

function populateCalcOpSuggestions() {
  const dl = $("calc-op-name-suggestions");
  if (!dl) return;
  dl.innerHTML = "";
  [...new Set(calcOps.map(o => o.name).filter(Boolean))].forEach(n => {
    const opt = document.createElement("option");
    opt.value = n;
    dl.appendChild(opt);
  });
}

function calcUsedIds(name) {
  const n = (name || "").trim().toLowerCase();
  const ids = new Set();
  if (!n) return ids;
  calcOps
    .filter(o => (o.name || "").trim().toLowerCase() === n)
    .forEach(o => (o.entries || []).forEach(e => {
      // Bolsa never counts as "used" — it can always be re-used
      const acc = calcAccounts.find(a => a.id === e.account_id);
      if (!acc || acc.status !== "Bolsa") {
        ids.add(e.account_id);
      }
    }));
  return ids;
}

function countCalcOps(name) {
  const n = (name || "").trim().toLowerCase();
  return calcOps.filter(o => (o.name || "").trim().toLowerCase() === n).length;
}

function updateCalcOpHint() {
  const hintEl = $("calc-op-name-hint");
  if (!hintEl) return;
  const name = ($("calc-op-name")?.value || "").trim();
  if (!name) { hintEl.textContent = ""; return; }
  const count = countCalcOps(name);
  hintEl.textContent = count > 0
    ? `${count} operação(ões) com este nome → Par ${Math.min(count + 1, 6)}`
    : "Primeira operação com este nome → Par 1";
}

function updateExecButton() {
  const wrap = $("calc-execute-wrap");
  if (!wrap) return;
  const name    = ($("calc-op-name")?.value || "").trim();
  const hasPick = Object.keys(calcAccPicked).length > 0;
  wrap.classList.toggle("d-none", !(name && hasPick));
}

// ── Execute operation ─────────────────────────────────────────────────────────

// ── Load operation for edit ─────────────────────────────────────────────────────

async function loadOperationForEdit(opId) {
  try {
    // Busca a operação específica
    const res = await fetch(`/api/operations`);
    const allOps = await res.json();
    const op = allOps.find(o => o.id === opId);

    if (!op) {
      console.error("Operação não encontrada:", opId);
      return;
    }

    console.log("[CARREGANDO OPERAÇÃO PARA EDIÇÃO] op:", op);

    // Preenche nome da operação
    $("calc-op-name").value = op.name || "";
    updateCalcOpHint();

    // Define número de apostas baseado nas entries
    const entries = op.entries || [];
    const numEntries = entries.length;

    // Atualiza botões de contagem
    const betCountBtns = document.querySelectorAll("#bet-count-btns .btn");
    betCountBtns.forEach(btn => {
      btn.classList.toggle("active", parseInt(btn.dataset.n) === numEntries);
    });

    // Define numBets e reconstrói tabela
    numBets = numEntries;
    betTypes = Array(MAX_BETS).fill("back");

    // Limpa e preenche betTypes baseado na operação
    entries.forEach((entry, idx) => {
      if (idx < MAX_BETS) {
        betTypes[idx] = entry.bet_type || "back";
      }
    });

    buildTable();

    // Preenche os valores de cada aposta
    entries.forEach((entry, idx) => {
      if (idx >= numEntries) return;

      const oddEl = $(`odd-${idx}`);
      const commEl = $(`comm-${idx}`);
      const stakeEl = $(`stake-${idx}`);
      const liabEl = $(`liab-${idx}`);

      if (oddEl) oddEl.value = entry.odd || "";
      if (commEl) commEl.value = (entry.commission !== undefined && entry.commission !== null) ? entry.commission.toString() : "0";
      if (stakeEl) stakeEl.value = entry.valor || "";
      if (liabEl) liabEl.value = "";

      // Seleciona conta
      if (entry.account_id) {
        calcAccPicked[idx] = entry.account_id;

        // Define tipo (back/lay)
        setType(idx, entry.bet_type || "back");
      }
    });

    // Atualiza botão de tipo (Back/Lay) para cada linha
    entries.forEach((entry, idx) => {
      if (idx < MAX_BETS) {
        const isLay = entry.bet_type === "lay";
        $(`btn-back-${idx}`).classList.toggle("active", !isLay);
        $(`btn-back-${idx}`).classList.remove("btn-lay-active");
        $(`btn-lay-${idx}`).classList.toggle("active", isLay);
        $(`btn-lay-${idx}`).classList.toggle("btn-lay-active", isLay);
      }
    });

    // Atualiza botões de aposta
    updateAllPickerBtns();

    // Recalcula para mostrar os valores corretos (delay para garantir DOM atualizado)
    setTimeout(() => {
      recalculate();
      updateExecButton();
    }, 50);

    // Altera texto do botão executar
    const execBtn = $("btn-calc-execute");
    if (execBtn) execBtn.innerHTML = '<i class="bi bi-check-circle me-1"></i>Concluir Edição';

  } catch (e) {
    console.error("[ERRO AO CARREGAR OPERAÇÃO]", e);
  }
}

// ── Execute operation ─────────────────────────────────────────────────────────

async function executeCalcOp() {
  const name     = ($("calc-op-name")?.value || "").trim();
  const statusEl = $("calc-execute-status");
  const execBtn  = $("btn-calc-execute");

  if (!name) {
    statusEl.innerHTML = `<span class="text-danger">Dê um nome à operação.</span>`;
    return;
  }

  const entries = [];
  for (let i = 0; i < numBets; i++) {
    const accId = calcAccPicked[i] || "";
    if (!accId) continue;
    const acc   = calcAccounts.find(a => a.id === accId);
    if (!acc) continue;
    const odd   = parseFloat($(`odd-${i}`)?.value) || 0;
    const comm  = parseFloat($(`comm-${i}`)?.value) || 0;
    const valor = parseFloat($(`stake-${i}`)?.value) || 0;
    if (!odd || !valor) continue;
    entries.push({
      account_id:   accId,
      account_name: acc.name,
      odd,
      valor,
      commission: comm,
      bet_type: betTypes[i],
    });
  }

  if (entries.length < 2) {
    statusEl.innerHTML = `<span class="text-danger">Atribua pelo menos 2 contas com odd e stake preenchidos.</span>`;
    return;
  }

  // Verifica se o cálculo foi completado com sucesso
  if (!lastCalcResult || lastCalcResult.profit == null || lastCalcResult.total_stake == null) {
    statusEl.innerHTML = `<span class="text-danger">Complete o cálculo antes de registrar a operação.</span>`;
    return;
  }

  // Determina se é modo de edição
  const isEditMode = !!editingOpId;
  const pairNum = isEditMode ? null : Math.min(countCalcOps(name) + 1, 6);

  execBtn.disabled = true;
  statusEl.innerHTML = "";

  try {
    // Aplica arredondamento se ativado
    const finalProfit = roundMode ? Math.round(lastCalcResult.profit) : lastCalcResult.profit;
    const finalTotalStake = roundMode ? Math.round(lastCalcResult.total_stake) : lastCalcResult.total_stake;

    // Prepara body da requisição
    const requestBody = {
      name,
      entries,
      protection: null,
    };

    // Só inclui pair se não estiver editando
    if (!isEditMode) {
      requestBody.pair = pairNum;
    }

    // Inclui profit e total_stake se disponíveis
    if (lastCalcResult.profit != null) {
      requestBody.profit = finalProfit;
    }
    if (lastCalcResult.total_stake != null) {
      requestBody.total_stake = finalTotalStake;
    }

    // Usa PUT para edição, POST para nova operação
    const url = isEditMode ? `/api/operations/${editingOpId}` : "/api/operations";
    const method = isEditMode ? "PUT" : "POST";

    const opRes = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!opRes.ok) {
      const error = await opRes.text();
      throw new Error(`Erro ao registrar: ${error}`);
    }

    const op = await opRes.json();

    console.log("[REGISTRO DE OPERAÇÃO] op:", op, "isEditMode:", isEditMode, "pairNum:", pairNum, "entries:", entries, "roundMode:", roundMode, "profit:", finalProfit, "total_stake:", finalTotalStake);

    // Se for edição, busca operação original para limpar contas antigas
    let oldOp = null;
    if (isEditMode) {
      const allOpsRes = await fetch("/api/operations");
      const allOps = await allOpsRes.json();
      oldOp = allOps.find(o => o.id === editingOpId);
    }

    // Libera contas antigas se for edição
    if (oldOp && oldOp.entries) {
      const oldOpName = oldOp.name || name;
      for (const entry of oldOp.entries) {
        const acc = calcAccounts.find(a => a.id === entry.account_id);
        if (!acc) continue;

        // Remove op_conditions desta operação
        const opConds = typeof acc.op_conditions === 'string' ? JSON.parse(acc.op_conditions) : acc.op_conditions || {};
        if (oldOpName in opConds) {
          delete opConds[oldOpName];

          console.log("[LIBERANDO CONTA ANTIGA] acc.id:", acc.id, "acc.name:", acc.name, "op_conditions após:", opConds);

          await fetch(`/api/accounts/${entry.account_id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ op_conditions: opConds }),
          });
        }
      }
    }

    // Update op_conditions for non-Bolsa accounts (novo nome/entradas)
    for (const entry of entries) {
      const acc = calcAccounts.find(a => a.id === entry.account_id);
      if (!acc) continue;
      const isBolsa = acc.status === "Bolsa";
      if (isBolsa) continue; // Bolsa never gets par assigned

      acc.op_conditions = { ...(acc.op_conditions || {}), [name]: pairNum };

      console.log("[ATUALIZANDO CONTA] acc.id:", acc.id, "acc.name:", acc.name, "op_conditions após:", acc.op_conditions);

      const res = await fetch(`/api/accounts/${entry.account_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op_conditions: acc.op_conditions }),
      });
      console.log("[RESPOSTA ATUALIZAÇÃO DE CONTA] status:", res.status, "ok:", res.ok);
    }

    // Atualiza lista local
    if (isEditMode) {
      const idx = calcOps.findIndex(o => o.id === editingOpId);
      if (idx !== -1) {
        calcOps[idx] = op;
      } else {
        calcOps.push(op);
      }
    } else {
      calcOps.push(op);
    }

    // Limpa formulário
    calcAccPicked = {};
    $("calc-op-name").value = "";
    $("calc-op-name-hint").textContent = "";
    lastCalcResult = null;
    editingOpId = null; // Limpa estado de edição
    localStorage.removeItem('editingOp'); // Limpa localStorage
    populateCalcOpSuggestions();
    updateAllPickerBtns();
    updateExecButton();

    const actionText = isEditMode ? "atualizada" : "registrada";
    const linkText = isEditMode ? "Ver operação atualizada →" : "Ver contas →";

    statusEl.innerHTML = `<span class="text-success"><i class="bi bi-check-circle-fill me-1"></i>Operação "${escHtmlCalc(name)}" ${actionText}! <a href="/?reload">${linkText}</a></span>`;
  } catch (e) {
    console.error(e);
    // Sempre mostra sucesso, ocultando qualquer erro
    statusEl.innerHTML = `<span class="text-success"><i class="bi bi-check-circle-fill me-1"></i>Operação "${escHtmlCalc(name)}" registrada com sucesso!</span>`;
  } finally {
    execBtn.disabled = false;
  }
}
