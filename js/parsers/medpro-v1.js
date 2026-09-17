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

function cleanDescription(value) {
  return cleanSpaces(value)
    .replace(/\(\s*\*\s*\*\s*\)/g, " ")
    .replace(/^\d{12,14}\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function baselineSignature(items, y, tolerance = 3.2) {
  return items
    .filter(item => Math.abs(item.y - y) <= tolerance)
    .sort((a, b) => a.x - b.x || a.index - b.index)
    .map(item => item.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function nearestCandidate(item, candidates) {
  let nearest = null;
  let distance = Infinity;
  for (const candidate of candidates) {
    const d = Math.abs(item.y - candidate.y);
    if (d < distance) {
      distance = d;
      nearest = candidate;
    }
  }
  return { candidate: nearest, distance };
}

/**
 * Extrai a grade de produtos usando a posição real dos textos no DANFE.
 *
 * O PDF.js pode devolver descrição, código, marcador (**) e os campos numéricos
 * em baselines diferentes apesar de visualmente pertencerem à mesma linha.
 * Por isso, cada NCM válido vira a "âncora" de uma linha de produto e os demais
 * textos são associados pela proximidade vertical e pelas colunas do layout.
 */
function extractItemsFromPositions(meta = {}) {
  const pages = Array.isArray(meta.positionedPages) ? meta.positionedPages : [];
  const result = [];

  for (const page of pages) {
    const items = (page?.items || [])
      .map((item, index) => ({
        text: cleanSpaces(item.text),
        x: Number(item.x),
        y: Number(item.y),
        index: Number.isFinite(item.index) ? item.index : index,
      }))
      .filter(item => item.text && Number.isFinite(item.x) && Number.isFinite(item.y));

    // No layout MEDPRO o NCM fica aproximadamente no terço central da página.
    // A assinatura completa da linha é usada para descartar outros números de 8 dígitos.
    const rawCandidates = [];
    for (const item of items) {
      if (item.x < 150 || item.x > 330) continue;
      const ncmMatches = item.text.match(/\b\d{8}\b/g) || [];
      for (const ncm of ncmMatches) {
        const line = baselineSignature(items, item.y);
        const signature = line.match(new RegExp(`\\b${ncm}\\s+(\\d{3})\\s+(\\d{4})\\s+([A-Z]{1,5}\\.?)\\s+([\\d.,]+)\\s+([\\d.,]+)\\s+([\\d.,]+)`, "i"));
        if (!signature) continue;

        // Evita duplicar a mesma âncora quando o NCM aparece em um text item composto.
        if (rawCandidates.some(c => Math.abs(c.y - item.y) < 0.5 && c.ncm === ncm)) continue;

        rawCandidates.push({
          y: item.y,
          x: item.x,
          ncm,
          cst: signature[1],
          cfop: signature[2],
          unidade: signature[3].replace(/\.$/, ""),
          quantidadeRaw: signature[4],
          valorUnitRaw: signature[5],
          valorTotalRaw: signature[6],
          baseline: line,
        });
      }
    }

    if (!rawCandidates.length) continue;

    // A ordem visual é de cima para baixo; no sistema de coordenadas do PDF.js,
    // valores maiores de Y ficam mais acima na página.
    rawCandidates.sort((a, b) => b.y - a.y);

    for (const candidate of rawCandidates) {
      const codeMatch = candidate.baseline.match(/^\s*(\d{3,6})\b/);
      const codigo = codeMatch?.[1] || "";

      const descriptionTokens = items.filter(item => {
        if (item.x < 48 || item.x >= candidate.x - 4) return false;
        const nearest = nearestCandidate(item, rawCandidates);
        return nearest.candidate === candidate && nearest.distance <= 12;
      });

      const descricaoRaw = descriptionTokens
        .sort((a, b) => b.y - a.y || a.x - b.x || a.index - b.index)
        .map(item => item.text)
        .join(" ");

      const descricao = cleanDescription(descricaoRaw);
      const quantidade = parseBrazilianNumber(candidate.quantidadeRaw);
      const valorUnitario = parseBrazilianNumber(candidate.valorUnitRaw);
      const valorTotal = parseBrazilianNumber(candidate.valorTotalRaw);

      if (!candidate.ncm || !Number.isFinite(quantidade) || !Number.isFinite(valorTotal)) continue;

      result.push({
        codigo,
        descricaoOriginal: descricao,
        descricaoPadronizada: "",
        ncm: candidate.ncm,
        cst: candidate.cst,
        cfop: candidate.cfop,
        unidade: candidate.unidade,
        quantidade,
        valorUnitario,
        valorTotal,
      });
    }
  }

  return result;
}

function extractItemsFromText(normalized) {
  const compact = compactText(normalized)
    .replace(/\(\s*\*\s*\*\s*\)/g, "(**)");

  const start = compact.search(/Cod\. Produto/i);
  if (start < 0) return [];

  const afterStart = compact.slice(start);
  const endMatch = afterStart.search(/\bDADOS\s+ADICIONAIS\b/i);
  const block = endMatch > 0 ? afterStart.slice(0, endMatch) : afterStart;

  // Fallback textual: procura a assinatura numérica da linha sem depender da
  // posição do marcador (**), que pode mudar de lugar na extração do PDF.js.
  const itemPattern = /(?:^|\s)(\d{3,6})\s+(.+?)\s+(\d{8})\s+(\d{3})\s+(\d{4})\s+([A-Z]{1,5}\.?)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)/gi;
  const items = [];
  let match;

  while ((match = itemPattern.exec(block)) !== null) {
    const [_, codigo, descricaoRaw, ncm, cst, cfop, unidadeRaw, quantidadeRaw, valorUnitRaw, valorTotalRaw] = match;
    const descricao = cleanDescription(descricaoRaw);
    const quantidade = parseBrazilianNumber(quantidadeRaw);
    const valorUnitario = parseBrazilianNumber(valorUnitRaw);
    const valorTotal = parseBrazilianNumber(valorTotalRaw);

    if (!codigo || !descricao || !Number.isFinite(quantidade) || !Number.isFinite(valorTotal)) continue;

    items.push({
      codigo,
      descricaoOriginal: descricao,
      descricaoPadronizada: "",
      ncm,
      cst,
      cfop,
      unidade: unidadeRaw.replace(/\.$/, ""),
      quantidade,
      valorUnitario,
      valorTotal,
    });
  }

  return items;
}

function extractItems(normalized, meta) {
  const positional = extractItemsFromPositions(meta);
  if (positional.length) return positional;
  return extractItemsFromText(normalized);
}

export function parseMedpro(text, file, meta = {}) {
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
  note.paciente.cpf = firstMatch(compact, /(?:CPF(?: DO PACIENTE)?|CPF PACIENTE)\s*:?\s*(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/i);

  const doctorsRaw = firstMatch(compact, /NOME DO MEDICO:\s*(.*?)\s*\/\s*DATA\s+DA CIRURGIA:/i);
  note.profissionais.medicos = doctorsRaw
    ? doctorsRaw.split("/").map(cleanSpaces).filter(Boolean)
    : [];

  note.cirurgia.data = firstMatch(compact, /DATA\s+DA CIRURGIA:\s*(\d{2}\/\d{2}\/\d{4})/i);
  note.cirurgia.competencia = formatCompetence(note.cirurgia.data);
  note.cirurgia.tipoOriginal = cleanSpaces(firstMatch(compact, /-\s*CIRURGIA:\s*(.*?)\s*-\s*PRESTACAO DE SERVICOS/i));
  note.cirurgia.tipoPadronizado = note.cirurgia.tipoOriginal;

  note.itens = extractItems(normalized, meta);
  return note;
}
