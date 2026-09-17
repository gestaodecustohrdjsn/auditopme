import { emptyAuditNote, normalizeText, compactText, parseBrazilianNumber, formatCompetence } from "./parser-base.js";

const PARSER_ID = "medpro-v1";
const LAYOUT_ID = "MEDPRO DANFE v1";

export function canParseMedpro(text) {
  const compact = compactText(text).toUpperCase();
  return compact.includes("MEDPRO") && compact.includes("14.927.939/0001-00") && compact.includes("DANFE");
}

function firstMatch(text, regex, group = 1) {
  const match = text.match(regex);
  return match ? String(match[group] ?? "").trim() : "";
}

function cleanSpaces(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function extractAccessKey(compact) {
  const aroundKey = firstMatch(compact, /([0-9][0-9\s]{42,60}[0-9])\s+CHAVE DE ACESSO/i);
  const digits = aroundKey.replace(/\D/g, "");
  if (digits.length === 44) return digits;
  const candidates = compact.match(/(?:\d[\s]*){44}/g) || [];
  for (const candidate of candidates) {
    const c = candidate.replace(/\D/g, "");
    if (c.length === 44) return c;
  }
  return "";
}

function extractNfAndSerie(normalized, fileName = "") {
  const fileNf = firstMatch(fileName, /\bNF\s*(\d{3,})\b/i);
  const block = normalized.match(/NF-E[\s\S]{0,120}?N[º°]?\s*[\r\n ]*Série:\s*[\r\n ]*(\d+)\s*[\r\n ]*(\d+)/i);
  if (block) return { numeroNF: block[1], serieNF: block[2] };

  const fallback = normalized.match(/Série:\s*[\r\n ]*(\d{3,})\s*[\r\n ]*(\d+)/i);
  return { numeroNF: fileNf || fallback?.[1] || "", serieNF: fallback?.[2] || "" };
}

function extractItems(normalized) {
  const start = normalized.search(/Cod\. Produto/i);
  const end = normalized.search(/\nVALOR\s*\nDESC/i);
  if (start < 0 || end <= start) return [];

  const block = normalized.slice(start, end);
  const lines = block.split(/\n+/).map(v => v.trim()).filter(Boolean);
  const headerEnd = lines.findIndex((line, idx) => idx > 8 && /^ICMS\s*\|/i.test(line));
  const dataLines = lines.slice(headerEnd >= 0 ? headerEnd + 1 : 0);

  const items = [];
  let i = 0;
  while (i < dataLines.length) {
    if (!/^\d{3,6}$/.test(dataLines[i])) { i += 1; continue; }
    const codigo = dataLines[i];
    const descParts = [];
    let j = i + 1;

    while (j < dataLines.length && dataLines[j] !== "(**)" && !/^\(\*\*\)$/.test(dataLines[j])) {
      // Se encontrarmos um novo código antes de (**), este não é um item válido.
      if (j > i + 1 && /^\d{3,6}$/.test(dataLines[j]) && /^\d{8}$/.test(dataLines[j + 1] || "")) break;
      descParts.push(dataLines[j]);
      j += 1;
    }
    if (j >= dataLines.length || !/^\(\*\*\)$/.test(dataLines[j])) { i += 1; continue; }

    const ncm = dataLines[j + 1] || "";
    const cst = dataLines[j + 2] || "";
    const cfop = dataLines[j + 3] || "";
    const unidade = dataLines[j + 4] || "";
    const quantidadeRaw = dataLines[j + 5] || "";
    const valorUnitRaw = dataLines[j + 6] || "";
    const valorTotalRaw = dataLines[j + 7] || "";

    if (!/^\d{8}$/.test(ncm) || !/^\d{3}$/.test(cst) || !/^\d{4}$/.test(cfop)) {
      i += 1;
      continue;
    }

    // Remove GTIN/EAN quando aparece isolado no início da descrição.
    const desc = cleanSpaces(descParts.join(" ").replace(/^\d{12,14}\s+/, ""));
    const quantidade = parseBrazilianNumber(quantidadeRaw);
    const valorUnitario = parseBrazilianNumber(valorUnitRaw);
    const valorTotal = parseBrazilianNumber(valorTotalRaw);

    items.push({
      codigo,
      descricaoOriginal: desc,
      descricaoPadronizada: "",
      ncm,
      cst,
      cfop,
      unidade,
      quantidade,
      valorUnitario,
      valorTotal,
    });

    i = j + 8;
  }

  return items;
}

export function parseMedpro(text, file) {
  const normalized = normalizeText(text);
  const compact = compactText(text);
  const note = emptyAuditNote(file);

  note.sistema.layout = LAYOUT_ID;
  note.sistema.parser = PARSER_ID;
  note.documento.fornecedor = "MEDPRO MEDICAMENTOS E MAT.HOSP LTDA EPP";
  note.documento.cnpjFornecedor = firstMatch(compact, /(14\.927\.939\/0001-00)/i);

  const ids = extractNfAndSerie(normalized, file?.name || "");
  note.documento.numeroNF = ids.numeroNF;
  note.documento.serieNF = ids.serieNF;
  note.documento.chaveAcesso = extractAccessKey(compact);
  note.documento.pedido = firstMatch(compact, /PEDIDO:\s*#?\s*(\d+)/i);

  note.nota.dataEmissao = firstMatch(compact, /DATA DA EMISSÃO\s*(\d{2}\/\d{2}\/\d{4})/i)
    || firstMatch(compact, /EMISSÃO:\s*(\d{2}\/\d{2}\/\d{4})/i);

  const totalRaw = firstMatch(compact, /VALOR TOTAL\s+NOTA\s+([\d.]+,\d{2})/i)
    || firstMatch(compact, /EMISSÃO:\s*\d{2}\/\d{2}\/\d{4}\s+VALOR TOTAL:\s*([\d.]+,\d{2})/i);
  note.nota.valorTotal = parseBrazilianNumber(totalRaw);

  note.paciente.nome = cleanSpaces(firstMatch(compact, /NOME DO PACIENTE:\s*(.*?)\s*\/\s*NOME DO MEDICO:/i));
  // Nem todas as notas desta amostra possuem CPF do paciente. Só preenche se o rótulo existir.
  note.paciente.cpf = firstMatch(compact, /(?:CPF(?: DO PACIENTE)?|CPF PACIENTE)\s*:?\s*(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/i);

  const doctorsRaw = firstMatch(compact, /NOME DO MEDICO:\s*(.*?)\s*\/\s*DATA\s+DA CIRURGIA:/i);
  note.profissionais.medicos = doctorsRaw
    ? doctorsRaw.split("/").map(cleanSpaces).filter(Boolean)
    : [];

  note.cirurgia.data = firstMatch(compact, /DATA\s+DA CIRURGIA:\s*(\d{2}\/\d{2}\/\d{4})/i);
  note.cirurgia.competencia = formatCompetence(note.cirurgia.data);
  note.cirurgia.tipoOriginal = cleanSpaces(firstMatch(compact, /-\s*CIRURGIA:\s*(.*?)\s*-\s*PRESTACAO DE SERVICOS/i));
  note.cirurgia.tipoPadronizado = note.cirurgia.tipoOriginal;

  note.itens = extractItems(normalized);
  return note;
}
