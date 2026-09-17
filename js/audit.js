import { canParseMedpro, parseMedpro } from "./parsers/medpro-v1.js";
import { emptyAuditNote } from "./parsers/parser-base.js";
import { validateAuditNote } from "./validators.js";

export function processExtractedText(text, file, meta = {}) {
  let note;

  if (canParseMedpro(text)) {
    note = parseMedpro(text, file, meta);
  } else {
    note = emptyAuditNote(file);
    note.sistema.status = "NAO_RECONHECIDO";
    note.sistema.alertas = [{ level: "error", message: "Layout/fornecedor ainda não reconhecido pelo AuditOPME." }];
  }

  note.sistema.paginas = meta.pages || 0;
  if (note.sistema.status === "NAO_RECONHECIDO") {
    return { note, itemSum: 0, sumMatches: false, errorCount: 1, warningCount: 0 };
  }
  return validateAuditNote(note);
}

export function buildPersistableRecord(note) {
  // Lista branca: somente estes campos poderão seguir futuramente ao backend/Sheets.
  return {
    fornecedor: note.documento.fornecedor,
    cnpjFornecedor: note.documento.cnpjFornecedor,
    numeroNF: note.documento.numeroNF,
    serieNF: note.documento.serieNF,
    chaveAcesso: note.documento.chaveAcesso,
    pedido: note.documento.pedido,
    dataEmissao: note.nota.dataEmissao,
    dataCirurgia: note.cirurgia.data,
    competencia: note.cirurgia.competencia,
    tipoCirurgia: note.cirurgia.tipoPadronizado || note.cirurgia.tipoOriginal,
    valorTotal: note.nota.valorTotal,
    itens: note.itens.map(item => ({ ...item })),
    layout: note.sistema.layout,
    parser: note.sistema.parser,
  };
}
