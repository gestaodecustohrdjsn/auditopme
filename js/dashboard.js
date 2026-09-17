import { backendRequest, getBackendConfig } from "./backend.js";

const els = {};
let initialized = false;
let lastOptions = { suppliers: [], procedures: [] };

export function initDashboard() {
  if (initialized) return;
  initialized = true;

  els.auditView = document.querySelector("#audit-view");
  els.dashboardView = document.querySelector("#dashboard-view");
  els.navButtons = [...document.querySelectorAll("[data-view]")];
  els.form = document.querySelector("#dashboard-filters");
  els.startDate = document.querySelector("#dash-start-date");
  els.endDate = document.querySelector("#dash-end-date");
  els.supplier = document.querySelector("#dash-supplier");
  els.procedure = document.querySelector("#dash-procedure");
  els.allPeriod = document.querySelector("#dash-all-period");
  els.refresh = document.querySelector("#dash-refresh");
  els.status = document.querySelector("#dashboard-status");
  els.content = document.querySelector("#dashboard-content");

  setCurrentMonth();

  els.navButtons.forEach(button => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });
  els.form.addEventListener("submit", event => {
    event.preventDefault();
    loadDashboard();
  });
  els.allPeriod.addEventListener("click", () => {
    els.startDate.value = "";
    els.endDate.value = "";
    loadDashboard();
  });

  window.addEventListener("auditopme:backend-connected", () => {
    if (!els.dashboardView.classList.contains("hidden")) loadDashboard();
  });
  window.addEventListener("auditopme:backend-disconnected", () => {
    if (!els.dashboardView.classList.contains("hidden")) showState("Conecte a base para visualizar o dashboard.", "empty");
  });
}

function switchView(view) {
  const dashboard = view === "dashboard";
  els.auditView.classList.toggle("hidden", dashboard);
  els.dashboardView.classList.toggle("hidden", !dashboard);
  els.navButtons.forEach(button => button.classList.toggle("active", button.dataset.view === view));

  if (dashboard) loadDashboard();
}

function setCurrentMonth() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  els.startDate.value = toIsoDate(first);
  els.endDate.value = toIsoDate(last);
}

async function loadDashboard() {
  const config = getBackendConfig();
  if (!config.url || !config.token) {
    showState("Conecte a base para visualizar o dashboard.", "empty");
    return;
  }

  setLoading(true);
  showState("Consultando a base por data da cirurgia…", "loading");

  try {
    const currentSupplier = els.supplier.value;
    const currentProcedure = els.procedure.value;
    const result = await backendRequest("dashboard", {
      filters: {
        startDate: els.startDate.value,
        endDate: els.endDate.value,
        supplierCnpj: currentSupplier,
        procedure: currentProcedure,
      },
    }, { timeout: 45000 });

    renderOptions(result.filterOptions, currentSupplier, currentProcedure);
    renderDashboard(result);
  } catch (error) {
    console.error(error);
    showState(error.message || "Não foi possível carregar o dashboard.", "error");
  } finally {
    setLoading(false);
  }
}

function renderOptions(options = {}, selectedSupplier = "", selectedProcedure = "") {
  lastOptions = options;
  fillSelect(els.supplier, [{ value: "", label: "Todos os fornecedores" }, ...(options.suppliers || []).map(item => ({
    value: item.cnpj,
    label: item.name,
  }))], selectedSupplier);

  fillSelect(els.procedure, [{ value: "", label: "Todos os procedimentos" }, ...(options.procedures || []).map(value => ({
    value,
    label: value,
  }))], selectedProcedure);
}

function fillSelect(select, items, selected) {
  select.innerHTML = "";
  for (const item of items) {
    const option = document.createElement("option");
    option.value = item.value;
    option.textContent = item.label;
    select.appendChild(option);
  }
  if ([...select.options].some(option => option.value === selected)) select.value = selected;
}

function renderDashboard(data) {
  els.status.className = "dashboard-status";
  els.status.textContent = periodLabel(data.filters?.startDate, data.filters?.endDate);
  els.content.classList.remove("hidden");

  setText("dash-kpi-notes", integer(data.totals?.notes));
  setText("dash-kpi-lines", integer(data.totals?.itemLines));
  setText("dash-kpi-units", number(data.totals?.units));
  setText("dash-kpi-total", currency(data.totals?.totalValue));
  setText("dash-kpi-average", currency(data.totals?.averagePerNote));

  renderTable("dash-months-body", data.months, row => [row.label, integer(row.notes), number(row.units), currency(row.totalValue)], 4, "Nenhum movimento no período.");
  renderTable("dash-suppliers-body", data.suppliers, row => [row.label, integer(row.notes), number(row.units), currency(row.totalValue)], 4, "Nenhum fornecedor no período.");
  renderTable("dash-procedures-body", data.procedures, row => [row.label, integer(row.notes), number(row.units), currency(row.totalValue)], 4, "Nenhum procedimento no período.");
  renderTable("dash-items-body", data.topItems, row => [row.code || "—", row.label, number(row.quantity), integer(row.notes), currency(row.totalValue)], 5, "Nenhum item no período.");
}

function renderTable(id, rows = [], mapper, colspan, emptyText) {
  const body = document.querySelector(`#${id}`);
  body.innerHTML = "";
  if (!rows.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = colspan;
    td.className = "dashboard-empty-cell";
    td.textContent = emptyText;
    tr.appendChild(td);
    body.appendChild(tr);
    return;
  }

  rows.forEach(row => {
    const tr = document.createElement("tr");
    mapper(row).forEach((value, index) => {
      const td = document.createElement("td");
      td.textContent = value;
      if (index > 0) td.classList.add("numeric");
      tr.appendChild(td);
    });
    body.appendChild(tr);
  });
}

function showState(message, type) {
  els.status.className = `dashboard-status ${type || ""}`.trim();
  els.status.textContent = message;
  els.content.classList.add("hidden");
}

function setLoading(active) {
  els.refresh.disabled = active;
  els.allPeriod.disabled = active;
  els.refresh.textContent = active ? "Atualizando…" : "Aplicar filtros";
}

function setText(id, value) {
  const el = document.querySelector(`#${id}`);
  if (el) el.textContent = value;
}

function periodLabel(start, end) {
  if (!start && !end) return "Todo o período • referência: data da cirurgia";
  if (start && end) return `${formatIso(start)} a ${formatIso(end)} • referência: data da cirurgia`;
  if (start) return `A partir de ${formatIso(start)} • referência: data da cirurgia`;
  return `Até ${formatIso(end)} • referência: data da cirurgia`;
}

function formatIso(value) {
  const m = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : value;
}

function toIsoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function currency(value) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function integer(value) {
  return Math.round(Number(value || 0)).toLocaleString("pt-BR");
}

function number(value) {
  return Number(value || 0).toLocaleString("pt-BR", { maximumFractionDigits: 4 });
}
