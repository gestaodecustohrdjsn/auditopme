import { extractPdfText } from "./pdf-reader.js";
import { processExtractedText } from "./audit.js";
import { validateAuditNote } from "./validators.js";
import { formatCompetence, parseBrazilianNumber } from "./parsers/parser-base.js";

const input = document.querySelector("#file-input");
const selectButton = document.querySelector("#select-files");
const dropZone = document.querySelector("#drop-zone");
const resultsSection = document.querySelector("#results-section");
const results = document.querySelector("#results");
const summary = document.querySelector("#summary");
const clearButton = document.querySelector("#clear-results");
const template = document.querySelector("#note-card-template");
const rulesInfo = document.querySelector("#rules-info");
const editDialog = document.querySelector("#edit-dialog");
const editForm = document.querySelector("#edit-form");
const editItems = document.querySelector("#edit-items");
const addItemButton = document.querySelector("#add-item");
const deparaBox = document.querySelector("#depara-box");
const rejectDialog = document.querySelector("#reject-dialog");
const rejectForm = document.querySelector("#reject-form");
const toast = document.querySelector("#toast");

const state = {
  notes: new Map(),
  sequence: 1,
  deparas: [],
};

selectButton.addEventListener("click", e => { e.stopPropagation(); input.click(); });
dropZone.addEventListener("click", () => input.click());
dropZone.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") input.click(); });
input.addEventListener("change", () => handleFiles([...input.files]));

["dragenter", "dragover"].forEach(type => dropZone.addEventListener(type, e => {
  e.preventDefault(); dropZone.classList.add("dragover");
}));
["dragleave", "drop"].forEach(type => dropZone.addEventListener(type, e => {
  e.preventDefault(); dropZone.classList.remove("dragover");
}));
dropZone.addEventListener("drop", e => handleFiles([...e.dataTransfer.files]));
clearButton.addEventListener("click", clearResults);
addItemButton.addEventListener("click", () => appendEditItemRow());
editForm.addEventListener("submit", saveEdit);
rejectForm.addEventListener("submit", saveRejection);

results.addEventListener("click", event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const card = button.closest(".note-card");
  const id = card?.dataset.noteId;
  if (!id || !state.notes.has(id)) return;

  const action = button.dataset.action;
  if (action === "edit") openEdit(id);
  if (action === "approve") approveNote(id);
  if (action === "reject") openReject(id);
  if (action === "reopen") reopenNote(id);
});

document.querySelectorAll("[data-close-dialog]").forEach(button => {
  button.addEventListener("click", () => document.querySelector(`#${button.dataset.closeDialog}`)?.close());
});

editForm.elements.tipoCirurgia.addEventListener("input", toggleDeparaBox);

async function handleFiles(files) {
  const pdfs = files.filter(file => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
  if (!pdfs.length) return;

  resultsSection.classList.remove("hidden");
  summary.classList.remove("hidden");

  for (const file of pdfs) {
    const placeholder = createProcessingCard(file);
    try {
      const extracted = await extractPdfText(file);
      const processed = processExtractedText(extracted.text, file, extracted);
      ensureAuditState(processed.note);
      applyDeparaRules(processed.note);
      const id = `nota-${state.sequence++}`;
      state.notes.set(id, processed.note);
      placeholder.remove();
      refreshAll();
    } catch (error) {
      console.error(error);
      placeholder.replaceWith(renderFailure(file, error));
    }
  }
  input.value = "";
}

function ensureAuditState(note) {
  if (!note.auditoria) note.auditoria = {};
  note.auditoria.status ||= "PENDENTE";
  note.auditoria.motivoRejeicao ||= "";
  note.auditoria.observacaoRejeicao ||= "";
  note.auditoria.alteradoManualmente = Boolean(note.auditoria.alteradoManualmente);
  note.auditoria.alteracoes ||= [];

  for (const item of note.itens) {
    if (item.descricaoExtraida === undefined) item.descricaoExtraida = item.descricaoOriginal || "";
    if (item.descricaoPadronizada === undefined) item.descricaoPadronizada = "";
  }
}

function refreshAll() {
  validateWholeBatch();
  results.innerHTML = "";
  for (const [id, note] of state.notes.entries()) {
    results.appendChild(renderCard(id, note));
  }
  updateSummary();
  updateRulesInfo();
}

function validateWholeBatch() {
  const processedById = new Map();
  for (const [id, note] of state.notes.entries()) {
    if (note.sistema.status === "NAO_RECONHECIDO") continue;
    processedById.set(id, validateAuditNote(note));
  }

  const groups = new Map();
  for (const [id, note] of state.notes.entries()) {
    const key = getDuplicateKey(note);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(id);
  }

  for (const ids of groups.values()) {
    if (ids.length < 2) continue;
    for (const id of ids) {
      const note = state.notes.get(id);
      if (!note || note.auditoria.status === "REJEITADA") continue;
      appendValidationAlert(note, "error", "Possível duplicidade neste lote: mesma chave de acesso ou mesmo fornecedor + série + número da NF.");
    }
  }
}

function getDuplicateKey(note) {
  const key = String(note.documento.chaveAcesso || "").replace(/\D/g, "");
  if (key.length === 44) return `KEY:${key}`;
  const cnpj = String(note.documento.cnpjFornecedor || "").replace(/\D/g, "");
  const serie = String(note.documento.serieNF || "").trim();
  const nf = String(note.documento.numeroNF || "").trim();
  if (!cnpj || !nf) return "";
  return `NF:${cnpj}|${serie}|${nf}`;
}

function appendValidationAlert(note, level, message) {
  if (note.sistema.alertas.some(alert => alert.message === message)) return;
  note.sistema.alertas.push({ level, message });
  if (level === "error") note.sistema.status = "ERRO";
  else if (note.sistema.status === "OK") note.sistema.status = "ALERTA";
}

function updateSummary() {
  const notes = [...state.notes.values()];
  const approved = notes.filter(note => note.auditoria.status === "APROVADA").length;
  const rejected = notes.filter(note => note.auditoria.status === "REJEITADA").length;
  const pending = notes.length - approved - rejected;
  document.querySelector("#sum-files").textContent = notes.length;
  document.querySelector("#sum-approved").textContent = approved;
  document.querySelector("#sum-pending").textContent = pending;
  document.querySelector("#sum-rejected").textContent = rejected;
}

function updateRulesInfo() {
  if (!state.deparas.length) {
    rulesInfo.classList.add("hidden");
    return;
  }
  rulesInfo.classList.remove("hidden");
  rulesInfo.textContent = `${state.deparas.length} ${state.deparas.length === 1 ? "regra temporária" : "regras temporárias"} de De-Para ${state.deparas.length === 1 ? "ativa" : "ativas"} neste lote.`;
}

function createProcessingCard(file) {
  const article = document.createElement("article");
  article.className = "note-card processing";
  article.innerHTML = `<div class="note-number">${escapeHtml(file.name)}</div><div class="processing-note">Lendo e analisando PDF…</div>`;
  results.appendChild(article);
  return article;
}

function renderFailure(file, error) {
  const article = document.createElement("article");
  article.className = "note-card";
  article.innerHTML = `<div class="note-card-head"><div><div class="note-number">${escapeHtml(file.name)}</div><div class="supplier">Falha na leitura</div></div><span class="status-badge error">Erro</span></div><div class="alerts"><div class="alert error">Não foi possível processar este PDF: ${escapeHtml(error?.message || "erro desconhecido")}</div></div>`;
  return article;
}

function renderCard(id, note) {
  const fragment = template.content.cloneNode(true);
  const card = fragment.querySelector(".note-card");
  card.dataset.noteId = id;
  card.querySelector(".note-number").textContent = note.documento.numeroNF ? `NF ${note.documento.numeroNF}` : note.arquivo.nome;

  renderStatus(card, note);

  set(card, "surgeryDate", note.cirurgia.data || "—");
  set(card, "competence", note.cirurgia.competencia || "—");
  set(card, "issueDate", note.nota.dataEmissao || "—");
  set(card, "totalValue", money(note.nota.valorTotal));

  const displayedProcedure = note.cirurgia.tipoPadronizado || note.cirurgia.tipoOriginal || "Procedimento não identificado";
  set(card, "procedure", displayedProcedure);
  const procedureOrigin = card.querySelector('[data-field="procedureOrigin"]');
  if (note.cirurgia.tipoPadronizado && normalizeComparable(note.cirurgia.tipoPadronizado) !== normalizeComparable(note.cirurgia.tipoOriginal)) {
    procedureOrigin.textContent = `Extraído do PDF: ${note.cirurgia.tipoOriginal}`;
    procedureOrigin.classList.remove("hidden");
  }

  set(card, "itemTypes", note.itens.length);
  const units = note.itens.reduce((sum, item) => sum + (Number(item.quantidade) || 0), 0);
  set(card, "units", formatNumber(units));

  const itemSum = note.itens.reduce((sum, item) => sum + (Number(item.valorTotal) || 0), 0);
  const total = Number(note.nota.valorTotal);
  const sumMatches = Number.isFinite(total) && Math.abs(itemSum - total) <= 0.02;
  const sumNode = card.querySelector('[data-field="sumStatus"]');
  if (note.itens.length && Number.isFinite(total)) {
    sumNode.textContent = sumMatches ? `✓ Itens conferem (${money(itemSum)})` : `✕ Soma dos itens: ${money(itemSum)}`;
    sumNode.className = sumMatches ? "sum-ok" : "sum-bad";
  } else sumNode.textContent = "Validação financeira indisponível";

  set(card, "supplier", note.documento.fornecedor || "Fornecedor não reconhecido");
  set(card, "supplierCnpj", note.documento.cnpjFornecedor ? `CNPJ ${note.documento.cnpjFornecedor}` : "CNPJ —");
  set(card, "order", note.documento.pedido || "—");
  set(card, "patient", note.paciente.nome || "Não localizado");
  set(card, "cpf", note.paciente.cpf || "Não localizado");
  set(card, "doctors", note.profissionais.medicos.join(" / ") || "Não localizado");
  set(card, "accessKey", formatAccessKey(note.documento.chaveAcesso) || "—");

  const alerts = card.querySelector('[data-field="alerts"]');
  note.sistema.alertas.forEach(alert => {
    const div = document.createElement("div");
    div.className = `alert ${alert.level}`;
    div.textContent = alert.message;
    alerts.appendChild(div);
  });

  const decisionNote = card.querySelector('[data-field="decisionNote"]');
  if (note.auditoria.status === "REJEITADA") {
    decisionNote.classList.remove("hidden");
    decisionNote.classList.add("rejected-note");
    const detail = note.auditoria.observacaoRejeicao ? ` — ${note.auditoria.observacaoRejeicao}` : "";
    decisionNote.textContent = `Rejeitada: ${note.auditoria.motivoRejeicao}${detail}`;
  } else if (note.auditoria.status === "APROVADA") {
    decisionNote.classList.remove("hidden");
    decisionNote.classList.add("approved-note");
    decisionNote.textContent = "Nota aprovada para futura importação na base de custos.";
  }

  const tbody = card.querySelector('[data-field="items"]');
  for (const item of note.itens) {
    const tr = document.createElement("tr");
    const description = item.descricaoPadronizada || item.descricaoOriginal;
    const values = [item.codigo, description, item.ncm, item.cst, item.cfop, item.unidade, formatNumber(item.quantidade), money(item.valorUnitario), money(item.valorTotal)];
    values.forEach(value => { const td = document.createElement("td"); td.textContent = value ?? ""; tr.appendChild(td); });
    tbody.appendChild(tr);
  }
  if (!note.itens.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = '<td colspan="9">Nenhum item reconhecido.</td>';
    tbody.appendChild(tr);
  }

  return card;
}

function renderStatus(card, note) {
  const badge = card.querySelector('[data-field="statusBadge"]');
  const caption = card.querySelector('[data-field="validationCaption"]');
  const actions = card.querySelector('[data-field="actions"]');
  const approve = actions.querySelector('[data-action="approve"]');
  const reject = actions.querySelector('[data-action="reject"]');
  const edit = actions.querySelector('[data-action="edit"]');
  const reopen = actions.querySelector('[data-action="reopen"]');

  if (note.auditoria.status === "APROVADA") {
    badge.textContent = "Aprovada";
    badge.classList.add("success");
    caption.textContent = validationLabel(note.sistema.status);
    approve.classList.add("hidden"); reject.classList.add("hidden"); edit.classList.add("hidden"); reopen.classList.remove("hidden");
    card.classList.add("approved");
    return;
  }

  if (note.auditoria.status === "REJEITADA") {
    badge.textContent = "Rejeitada";
    badge.classList.add("error");
    caption.textContent = "Fora da futura importação";
    approve.classList.add("hidden"); reject.classList.add("hidden"); edit.classList.add("hidden"); reopen.classList.remove("hidden");
    card.classList.add("rejected");
    return;
  }

  if (note.sistema.status === "OK") {
    badge.textContent = "Pronta para auditoria";
    badge.classList.add("success");
  } else if (note.sistema.status === "ALERTA") {
    badge.textContent = "Com alerta";
    badge.classList.add("warning");
  } else {
    badge.textContent = note.sistema.status === "NAO_RECONHECIDO" ? "Não reconhecido" : "Revisar";
    badge.classList.add("error");
  }
  caption.textContent = note.auditoria.alteradoManualmente ? "Editada manualmente" : "Pendente de decisão";
  approve.disabled = note.sistema.status === "ERRO" || note.sistema.status === "NAO_RECONHECIDO";
  approve.title = approve.disabled ? "Corrija os erros antes de aprovar." : "Aprovar esta nota";
}

function validationLabel(status) {
  if (status === "OK") return "Validação sem alertas";
  if (status === "ALERTA") return "Aprovada com alerta";
  if (status === "ERRO") return "Há erro de validação";
  return "";
}

function openEdit(id) {
  const note = state.notes.get(id);
  if (!note) return;
  ensureAuditState(note);
  editForm.reset();
  editForm.elements.noteId.value = id;
  editForm.elements.numeroNF.value = note.documento.numeroNF || "";
  editForm.elements.serieNF.value = note.documento.serieNF || "";
  editForm.elements.pedido.value = note.documento.pedido || "";
  editForm.elements.valorTotal.value = formatEditableNumber(note.nota.valorTotal);
  editForm.elements.fornecedor.value = note.documento.fornecedor || "";
  editForm.elements.cnpjFornecedor.value = note.documento.cnpjFornecedor || "";
  editForm.elements.dataEmissao.value = note.nota.dataEmissao || "";
  editForm.elements.dataCirurgia.value = note.cirurgia.data || "";
  editForm.elements.tipoCirurgia.value = note.cirurgia.tipoPadronizado || note.cirurgia.tipoOriginal || "";
  editForm.elements.paciente.value = note.paciente.nome || "";
  editForm.elements.cpf.value = note.paciente.cpf || "";
  editForm.elements.medicos.value = note.profissionais.medicos.join(" / ");

  editItems.innerHTML = "";
  note.itens.forEach(item => appendEditItemRow(item));
  toggleDeparaBox();
  editDialog.showModal();
}

function appendEditItemRow(item = {}) {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input data-item="codigo" value="${escapeAttr(item.codigo || "")}" /></td>
    <td><input class="item-description-input" data-item="descricao" value="${escapeAttr(item.descricaoPadronizada || item.descricaoOriginal || "")}" /></td>
    <td><input data-item="ncm" value="${escapeAttr(item.ncm || "")}" /></td>
    <td><input data-item="cst" value="${escapeAttr(item.cst || "")}" /></td>
    <td><input data-item="cfop" value="${escapeAttr(item.cfop || "")}" /></td>
    <td><input data-item="unidade" value="${escapeAttr(item.unidade || "")}" /></td>
    <td><input data-item="quantidade" inputmode="decimal" value="${escapeAttr(formatEditableNumber(item.quantidade))}" /></td>
    <td><input data-item="valorUnitario" inputmode="decimal" value="${escapeAttr(formatEditableNumber(item.valorUnitario))}" /></td>
    <td><input data-item="valorTotal" inputmode="decimal" value="${escapeAttr(formatEditableNumber(item.valorTotal))}" /></td>
    <td><button class="row-remove" type="button" title="Remover item" aria-label="Remover item">×</button></td>
  `;
  tr.dataset.originalDescription = item.descricaoExtraida ?? item.descricaoOriginal ?? "";
  tr.querySelector(".row-remove").addEventListener("click", () => tr.remove());
  editItems.appendChild(tr);
}

function toggleDeparaBox() {
  const id = editForm.elements.noteId.value;
  const note = state.notes.get(id);
  if (!note) return;
  const edited = editForm.elements.tipoCirurgia.value.trim();
  const original = note.cirurgia.tipoOriginal || "";
  const changed = edited && normalizeComparable(edited) !== normalizeComparable(original);
  deparaBox.classList.toggle("hidden", !changed);
  if (!changed) editForm.elements.criarDeparaCirurgia.checked = false;
}

function saveEdit(event) {
  event.preventDefault();
  const id = editForm.elements.noteId.value;
  const note = state.notes.get(id);
  if (!note) return;

  const before = snapshotEditable(note);

  note.documento.numeroNF = editForm.elements.numeroNF.value.trim();
  note.documento.serieNF = editForm.elements.serieNF.value.trim();
  note.documento.pedido = editForm.elements.pedido.value.trim();
  note.documento.fornecedor = editForm.elements.fornecedor.value.trim();
  note.documento.cnpjFornecedor = editForm.elements.cnpjFornecedor.value.trim();
  note.nota.dataEmissao = editForm.elements.dataEmissao.value.trim();
  note.nota.valorTotal = parseBrazilianNumber(editForm.elements.valorTotal.value);
  note.cirurgia.data = editForm.elements.dataCirurgia.value.trim();
  note.cirurgia.competencia = formatCompetence(note.cirurgia.data);
  note.cirurgia.tipoPadronizado = editForm.elements.tipoCirurgia.value.trim();
  note.paciente.nome = editForm.elements.paciente.value.trim();
  note.paciente.cpf = editForm.elements.cpf.value.trim();
  note.profissionais.medicos = editForm.elements.medicos.value.split("/").map(value => value.trim()).filter(Boolean);

  note.itens = [...editItems.querySelectorAll("tr")].map(row => {
    const get = key => row.querySelector(`[data-item="${key}"]`)?.value.trim() || "";
    const originalDescription = row.dataset.originalDescription || get("descricao");
    const editedDescription = get("descricao");
    return {
      codigo: get("codigo"),
      descricaoExtraida: originalDescription,
      descricaoOriginal: originalDescription,
      descricaoPadronizada: normalizeComparable(editedDescription) !== normalizeComparable(originalDescription) ? editedDescription : "",
      ncm: get("ncm"),
      cst: get("cst"),
      cfop: get("cfop"),
      unidade: get("unidade"),
      quantidade: parseBrazilianNumber(get("quantidade")),
      valorUnitario: parseBrazilianNumber(get("valorUnitario")),
      valorTotal: parseBrazilianNumber(get("valorTotal")),
    };
  });

  if (editForm.elements.criarDeparaCirurgia.checked && note.cirurgia.tipoOriginal && note.cirurgia.tipoPadronizado) {
    addDeparaRule({
      field: "tipoCirurgia",
      supplierCnpj: note.documento.cnpjFornecedor,
      layout: note.sistema.layout,
      from: note.cirurgia.tipoOriginal,
      to: note.cirurgia.tipoPadronizado,
    });
  }

  const after = snapshotEditable(note);
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    note.auditoria.alteradoManualmente = true;
    note.auditoria.alteracoes.push({ quando: new Date().toISOString(), origem: "edicao_manual" });
  }

  editDialog.close();
  applyDeparaToAllPending();
  refreshAll();
  showToast("Alterações salvas no lote atual.");
}

function snapshotEditable(note) {
  return {
    documento: { ...note.documento },
    cirurgia: { ...note.cirurgia },
    nota: { ...note.nota },
    paciente: { ...note.paciente },
    profissionais: { medicos: [...note.profissionais.medicos] },
    itens: note.itens.map(item => ({ ...item })),
  };
}

function addDeparaRule(rule) {
  if (normalizeComparable(rule.from) === normalizeComparable(rule.to)) return;
  const existing = state.deparas.find(item =>
    item.field === rule.field &&
    normalizeComparable(item.supplierCnpj) === normalizeComparable(rule.supplierCnpj) &&
    item.layout === rule.layout &&
    normalizeComparable(item.from) === normalizeComparable(rule.from)
  );
  if (existing) existing.to = rule.to;
  else state.deparas.push(rule);
}

function applyDeparaRules(note) {
  const rules = state.deparas.filter(rule =>
    rule.field === "tipoCirurgia" &&
    normalizeComparable(rule.supplierCnpj) === normalizeComparable(note.documento.cnpjFornecedor) &&
    rule.layout === note.sistema.layout &&
    normalizeComparable(rule.from) === normalizeComparable(note.cirurgia.tipoOriginal)
  );
  if (rules.length) note.cirurgia.tipoPadronizado = rules.at(-1).to;
}

function applyDeparaToAllPending() {
  for (const note of state.notes.values()) {
    if (note.auditoria.status !== "PENDENTE") continue;
    applyDeparaRules(note);
  }
}

function approveNote(id) {
  refreshAll();
  const note = state.notes.get(id);
  if (!note) return;
  if (note.sistema.status === "ERRO" || note.sistema.status === "NAO_RECONHECIDO") {
    showToast("Esta nota possui erro de validação. Corrija os dados ou rejeite a nota.", "error");
    return;
  }
  note.auditoria.status = "APROVADA";
  note.auditoria.motivoRejeicao = "";
  note.auditoria.observacaoRejeicao = "";
  refreshAll();
  showToast(`NF ${note.documento.numeroNF || ""} aprovada.`);
}

function openReject(id) {
  const note = state.notes.get(id);
  if (!note) return;
  rejectForm.reset();
  rejectForm.elements.noteId.value = id;
  rejectDialog.showModal();
}

function saveRejection(event) {
  event.preventDefault();
  const id = rejectForm.elements.noteId.value;
  const note = state.notes.get(id);
  if (!note) return;
  const motivo = rejectForm.elements.motivo.value.trim();
  const observacao = rejectForm.elements.observacao.value.trim();
  if (!motivo) {
    showToast("Selecione o motivo da rejeição.", "error");
    return;
  }
  if (motivo === "Outro" && !observacao) {
    showToast("Descreva o motivo quando selecionar ‘Outro’.", "error");
    return;
  }
  note.auditoria.status = "REJEITADA";
  note.auditoria.motivoRejeicao = motivo;
  note.auditoria.observacaoRejeicao = observacao;
  rejectDialog.close();
  refreshAll();
  showToast(`NF ${note.documento.numeroNF || ""} rejeitada.`);
}

function reopenNote(id) {
  const note = state.notes.get(id);
  if (!note) return;
  note.auditoria.status = "PENDENTE";
  note.auditoria.motivoRejeicao = "";
  note.auditoria.observacaoRejeicao = "";
  refreshAll();
  showToast("Nota reaberta para auditoria.");
}

function set(root, name, value) {
  const node = root.querySelector(`[data-field="${name}"]`);
  if (node) node.textContent = value;
}

function money(value) {
  return Number.isFinite(Number(value)) ? Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";
}

function formatNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 4 }) : "—";
}

function formatEditableNumber(value) {
  return Number.isFinite(Number(value)) ? String(Number(value)).replace(".", ",") : "";
}

function formatAccessKey(value) {
  return String(value || "").replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

function normalizeComparable(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

function escapeAttr(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function clearResults() {
  state.notes.clear();
  state.deparas = [];
  state.sequence = 1;
  results.innerHTML = "";
  updateSummary();
  updateRulesInfo();
  resultsSection.classList.add("hidden");
  summary.classList.add("hidden");
}

let toastTimer;
function showToast(message, type = "success") {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toastTimer = setTimeout(() => toast.classList.add("hidden"), 3200);
}
