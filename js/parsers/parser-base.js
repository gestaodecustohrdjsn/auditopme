export function emptyAuditNote(file) {
  return {
    arquivo: { nome: file?.name || "", tamanho: file?.size || 0 },
    documento: {
      fornecedor: "", cnpjFornecedor: "", numeroNF: "", serieNF: "", chaveAcesso: "", pedido: ""
    },
    paciente: { nome: "", cpf: "" },
    profissionais: { medicos: [] },
    cirurgia: { data: "", competencia: "", tipoOriginal: "", tipoPadronizado: "" },
    nota: { dataEmissao: "", valorTotal: null },
    itens: [],
    auditoria: {
      status: "PENDENTE",
      motivoRejeicao: "",
      observacaoRejeicao: "",
      alteradoManualmente: false,
      alteracoes: []
    },
    sistema: {
      layout: "", parser: "", confianca: null, status: "PENDENTE", alertas: [], paginas: 0
    }
  };
}

export function normalizeText(text) {
  return String(text || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function compactText(text) {
  return normalizeText(text).replace(/\s+/g, " ").trim();
}

export function parseBrazilianNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const cleaned = String(value).replace(/[^0-9,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatCompetence(dateBr) {
  const match = String(dateBr || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[2]}/${match[3]}` : "";
}
