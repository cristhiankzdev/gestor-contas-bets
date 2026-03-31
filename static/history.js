(() => {
  const $ = id => document.getElementById(id);

  let allDays     = [];
  let pairColors  = ["#3b82f6", "#22c55e", "#eab308", "#a855f7"];

  // ── Boot ───────────────────────────────────────────
  async function load() {
    try {
      const [histData, accData] = await Promise.all([
        fetch("/api/history").then(r => r.json()),
        fetch("/api/accounts").then(r => r.json()),
      ]);
      allDays    = histData || [];
      pairColors = accData.settings?.pair_colors || pairColors;
    } catch (e) {
      allDays = [];
    }
    $("hist-loading").classList.add("d-none");
    renderDashboard();
    renderList(getFiltered());
  }

  function getFiltered() {
    const from = $("filter-from").value;
    const to   = $("filter-to").value;
    return allDays.filter(d => {
      if (from && d.date < from) return false;
      if (to   && d.date > to)   return false;
      return true;
    });
  }

  // ── Dashboard ──────────────────────────────────────
  function renderDashboard() {
    if (allDays.length === 0) return;
    $("hist-dashboard").style.display = "";

    const totalOps    = allDays.reduce((s, d) => s + d.operations.length, 0);
    const totalStake  = allDays.reduce((s, d) => s + (d.day_stake  || 0), 0);
    const daysWithPL  = allDays.filter(d => d.day_profit != null);
    const totalProfit = daysWithPL.reduce((s, d) => s + d.day_profit, 0);

    $("hd-days").textContent  = allDays.length;
    $("hd-ops").textContent   = totalOps;
    $("hd-stake").textContent = "R$ " + totalStake.toFixed(2);

    if (daysWithPL.length > 0) {
      const isPos = totalProfit >= 0;
      $("hd-profit").textContent  = (isPos ? "+" : "−") + "R$ " + Math.abs(totalProfit).toFixed(2);
      $("hd-profit").className    = "hist-card-value " + (isPos ? "text-success" : "text-danger");
    } else {
      $("hd-profit").textContent = "—";
    }
  }

  // ── List ───────────────────────────────────────────
  function renderList(days) {
    const list = $("hist-list");
    list.innerHTML = "";

    if (days.length === 0) {
      $("hist-empty").classList.remove("d-none");
      return;
    }
    $("hist-empty").classList.add("d-none");

    days.forEach(day => list.appendChild(buildDayCard(day)));
  }

  function buildDayCard(day) {
    const wrap = document.createElement("div");
    wrap.className = "hist-day-card";

    const dtStr = formatDate(day.date);
    const isPos = day.day_profit != null && day.day_profit >= 0;
    const plStr = day.day_profit != null
      ? (isPos ? "+" : "−") + "R$ " + Math.abs(day.day_profit).toFixed(2)
      : "—";
    const stakeStr = day.day_stake > 0 ? "R$ " + day.day_stake.toFixed(2) : "—";

    wrap.innerHTML = `
      <div class="hist-day-header">
        <div class="hist-day-date">
          <i class="bi bi-calendar3 me-2"></i>${dtStr}
          <span class="hist-day-count">${day.operations.length} operaç${day.operations.length !== 1 ? "ões" : "ão"}</span>
        </div>
        <div class="hist-day-summary">
          <span class="hist-day-stake text-muted small">Investido: <strong>${stakeStr}</strong></span>
          <span class="hist-day-pl ${day.day_profit != null ? (isPos ? "text-success" : "text-danger") : "text-muted"}">
            ${plStr}
          </span>
        </div>
      </div>
      <div class="hist-day-ops"></div>`;

    const opsWrap = wrap.querySelector(".hist-day-ops");
    day.operations.forEach(op => opsWrap.appendChild(buildOpRow(op)));

    return wrap;
  }

  function buildOpRow(op) {
    const div = document.createElement("div");
    div.className = "op-row";

    const dt = new Date(op.created_at);
    const timeStr  = dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const pairVal  = op.pair || 1;
    const pairColor = pairColors[pairVal - 1] || "#6b7280";

    const chipsHtml = (op.entries || []).map(e =>
      `${escHtml(e.account_name)}&nbsp;${e.odd ? e.odd.toFixed(2) : "?"}&nbsp;R$${e.valor ? e.valor.toFixed(0) : "0"}`
    ).join(`<span class="op-row-sep"> · </span>`);

    let plHtml;
    if (op.profit != null) {
      const isPos = op.profit >= 0;
      plHtml = `<span class="${isPos ? "text-success" : "text-danger"}" style="font-weight:700">
        ${isPos ? "+" : "−"}R$${Math.abs(op.profit).toFixed(2)}</span>`;
    } else {
      plHtml = `<span class="text-muted">—</span>`;
    }

    div.innerHTML = `
      <span class="op-row-par" style="background:${pairColor}">Par ${pairVal}</span>
      <span class="op-row-name">${escHtml(op.name || "Operação")}</span>
      <span class="op-row-entries">${chipsHtml}</span>
      <span class="op-row-time">${timeStr}</span>
      <span class="op-row-pl">${plHtml}</span>`;

    return div;
  }

  // ── Filters ────────────────────────────────────────
  function applyFilter() { renderList(getFiltered()); }

  $("filter-from").addEventListener("change", applyFilter);
  $("filter-from").addEventListener("input",  applyFilter);
  $("filter-to"  ).addEventListener("change", applyFilter);
  $("filter-to"  ).addEventListener("input",  applyFilter);
  $("btn-filter-apply").addEventListener("click", applyFilter);
  $("btn-filter-clear").addEventListener("click", () => {
    $("filter-from").value = "";
    $("filter-to"  ).value = "";
    applyFilter();
  });
  $("btn-clear-archived").addEventListener("click", clearArchived);

  // ── Helpers ────────────────────────────────────────
  function escHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function formatDate(d) {
    if (!d) return "—";
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  }

  // ── Clear functions ─────────────────────────────────
  async function clearArchived() {
    const filtered = getFiltered();

    // Calcular quantas operações serão deletadas e valores
    let opsToDelete = 0;
    let totalStakeToDelete = 0;
    let totalProfitToDelete = 0;
    let daysToDelete = 0;

    filtered.forEach(day => {
      daysToDelete++;
      opsToDelete += day.operations.length;
      day.operations.forEach(op => {
        totalStakeToDelete += op.total_stake || 0;
        if (op.profit !== null && op.profit !== undefined) {
          totalProfitToDelete += op.profit;
        }
      });
    });

    if (opsToDelete === 0) {
      showNotification("Nenhuma operação arquivada no período selecionado.", "warning");
      return;
    }

    if (!confirm(`Deseja excluir permanentemente as ${opsToDelete} operações arquivadas exibidas neste período? Esta ação é irreversível.`)) return;

    try {
      const btn = $("btn-clear-archived");
      btn.disabled = true;
      btn.innerHTML = '<i class="bi bi-arrow-repeat spin me-1"></i>Excluindo...';

      const params = new URLSearchParams();
      const from = $("filter-from").value;
      const to = $("filter-to").value;
      if (from) params.append("start_date", from);
      if (to) params.append("end_date", to);

      await fetch(`/api/operations/clear-archived-filtered?${params}`, { method: "POST" });

      // Atualizar o estado local removendo os dias excluídos
      filtered.forEach(day => {
        const idx = allDays.findIndex(d => d.date === day.date);
        if (idx !== -1) allDays.splice(idx, 1);
      });

      // Atualizar os cards de resumo instantaneamente
      updateDashboardCardsLocally(daysToDelete, opsToDelete, totalStakeToDelete, totalProfitToDelete);

      // Renderiza a interface atualizada
      renderDashboard();
      renderList(getFiltered());

      showNotification(`${opsToDelete} operações arquivadas excluídas.`, "success");
    } catch (err) {
      showNotification(`Erro ao excluir: ${err.message}`, "danger");
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-trash me-1"></i>Limpar arquivadas';
    }
  }

  function updateDashboardCardsLocally(daysDeleted, opsDeleted, stakeDeleted, profitDeleted) {
    // Atualiza os cards de resumo instantaneamente
    const currentDays = parseInt($("hd-days").textContent) || 0;
    const currentOps = parseInt($("hd-ops").textContent) || 0;
    const currentStakeText = $("hd-stake").textContent.replace("R$ ", "").replace(",", ".");
    const currentStake = parseFloat(currentStakeText) || 0;

    // Atualizar Dias registrados
    $("hd-days").textContent = Math.max(0, currentDays - daysDeleted);

    // Atualizar Total de operações
    $("hd-ops").textContent = Math.max(0, currentOps - opsDeleted);

    // Atualizar Total investido
    const newStake = Math.max(0, currentStake - stakeDeleted);
    $("hd-stake").textContent = "R$ " + newStake.toFixed(2);

    // Atualizar Lucro/Prejuízo total (se tiver valor)
    const currentProfitText = $("hd-profit").textContent;
    if (currentProfitText !== "—") {
      const isPos = currentProfitText.includes("+");
      const currentProfitValue = parseFloat(currentProfitText.replace(/[^0-9.-]/g, "")) || 0;
      const newProfit = currentProfitValue - profitDeleted;

      if (newProfit !== 0) {
        const isPositive = newProfit > 0;
        $("hd-profit").textContent = (isPositive ? "+" : "−") + "R$ " + Math.abs(newProfit).toFixed(2);
        $("hd-profit").className = "hist-card-value " + (isPositive ? "text-success" : "text-danger");
      } else {
        $("hd-profit").textContent = "—";
      }
    }
  }

  function showNotification(message, type) {
    const alert = document.createElement("div");
    alert.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3`;
    alert.style.zIndex = "9999";
    alert.innerHTML = `
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(alert);
    setTimeout(() => alert.remove(), 5000);
  }

  // ── Init ───────────────────────────────────────────
  load();
})();
