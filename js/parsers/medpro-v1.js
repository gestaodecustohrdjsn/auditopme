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
  // A tabela do DANFE pode chegar com quebras de linha diferentes dependendo
  // do leitor de PDF. Por isso a extração trabalha sobre uma versão compacta
  // do bloco e reconhece a assinatura estrutural do item:
  // código + descrição + (**) + NCM + CST + CFOP + UN + qtd + v.unit + v.total.
  const compact = compactText(normalized)
    .replace(/\(\s*\*\s*\*\s*\)/g, "(**)");

  const start = compact.search(/Cod\. Produto/i);
  if (start < 0) return [];

  const afterStart = compact.slice(start);
  const endMatch = afterStart.search(/\bVALOR\s+DESC\b/i);
  const block = endMatch > 0 ? afterStart.slice(0, endMatch) : afterStart;

  const itemPattern = /(?:^|\s)(\d{3,6})\s+(.+?)\s+\(\*\*\)\s+(\d{8})\s+(\d{3})\s+(\d{4})\s+([A-Z]{1,5}\.?)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)/gi;
  const items = [];
  let match;

  while ((match = itemPattern.exec(block)) !== null) {
    const [_, codigo, descricaoRaw, ncm, cst, cfop, unidadeRaw, quantidadeRaw, valorUnitRaw, valorTotalRaw] = match;

    const descricao = cleanSpaces(
      descricaoRaw
        .replace(/^\d{12,14}\s+/, "")
        .replace(/\s+/g, " ")
    );

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
