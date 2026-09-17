import { extractPdfText } from "./pdf-reader.js";
import { processExtractedText } from "./audit.js";

const input = document.querySelector("#file-input");
const selectButton = document.querySelector("#select-files");
const dropZone = document.querySelector("#drop-zone");
const resultsSection = document.querySelector("#results-section");
const results = document.querySelector("#results");
const summary = document.querySelector("#summary");
const clearButton = document.querySelector("#clear-results");
const template = document.querySelector("#note-card-template");

let counters = { files: 0, ok: 0, warn: 0, error: 0 };

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

async function handleFiles(files) {
  const pdfs = files.filter(file => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
  if (!pdfs.length) return;
  resultsSection.classList.remove("hidden");
  summary.classList.remove("hidden");

  for (const file of pdfs) {
    counters.files += 1;
    updateSummary();
    const placeholder = createProcessingCard(file);
    try {
      const extracted = await extractPdfText(file);
      const processed = processExtractedText(extracted.text, file, extracted);
      placeholder.replaceWith(renderCard(processed));
      updateCounter(processed.note.sistema.status);
    } catch (error) {
      console.error(error);
      placeholder.replaceWith(renderFailure(file, error));
      counters.error += 1;
    }
    updateSummary();
  }
  input.value = "";
}

function updateCounter(status) {
  if (status === "OK") counters.ok += 1;
  else if (status === "ALERTA") counters.warn += 1;
  else counters.error += 1;
}

function updateSummary() {
  document.querySelector("#sum-files").textContent = counters.files;
  document.querySelector("#sum-ok").textContent = counters.ok;
  document.querySelector("#sum-warn").textContent = counters.warn;
  document.querySelector("#sum-error").textContent = counters.error;
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

function renderCard(processed) {
  const { note, itemSum, sumMatches } = processed;
  const fragment = template.content.cloneNode(true);
  const card = fragment.querySelector(".note-card");
  card.querySelector(".note-number").textContent = note.documento.numeroNF ? `NF ${note.documento.numeroNF}` : note.arquivo.nome;

  const badge = card.querySelector(".status-badge");
  if (note.sistema.status === "OK") { badge.textContent = "Conferência OK"; badge.classList.add("success"); }
  else if (note.sistema.status === "ALERTA") { badge.textContent = "Com alerta"; badge.classList.add("warning"); }
  else { badge.textContent = note.sistema.status === "NAO_RECONHECIDO" ? "Não reconhecido" : "Revisar"; badge.classList.add("error"); }

  set(card, "surgeryDate", note.cirurgia.data || "—");
  set(card, "competence", note.cirurgia.competencia || "—");
  set(card, "issueDate", note.nota.dataEmissao || "—");
  set(card, "totalValue", money(note.nota.valorTotal));
  set(card, "procedure", note.cirurgia.tipoOriginal || "Procedimento não identificado");
  set(card, "itemTypes", note.itens.length);
  const units = note.itens.reduce((sum, item) => sum + (Number(item.quantidade) || 0), 0);
  set(card, "units", formatNumber(units));

  const sumNode = card.querySelector('[data-field="sumStatus"]');
  if (note.itens.length && Number.isFinite(note.nota.valorTotal)) {
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

  const tbody = card.querySelector('[data-field="items"]');
  for (const item of note.itens) {
    const tr = document.createElement("tr");
    const values = [item.codigo, item.descricaoOriginal, item.ncm, item.cst, item.cfop, item.unidade, formatNumber(item.quantidade), money(item.valorUnitario), money(item.valorTotal)];
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

function set(root, name, value) {
  const node = root.querySelector(`[data-field="${name}"]`);
  if (node) node.textContent = value;
}
function money(value) {
  return Number.isFinite(Number(value)) ? Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";
}
function formatNumber(value) { return Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 4 }); }
function formatAccessKey(value) { return String(value || "").replace(/(\d{4})(?=\d)/g, "$1 ").trim(); }
function escapeHtml(value) { const div = document.createElement("div"); div.textContent = value; return div.innerHTML; }
function clearResults() {
  results.innerHTML = "";
  counters = { files: 0, ok: 0, warn: 0, error: 0 };
  updateSummary();
  resultsSection.classList.add("hidden");
  summary.classList.add("hidden");
}
