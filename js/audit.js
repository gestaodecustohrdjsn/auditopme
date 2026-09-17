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

/**
 * Gera exclusivamente o objeto que poderá, em uma versão posterior, atravessar
 * a fronteira do navegador e seguir ao backend/base de custos.
 *
 * Paciente, CPF e médicos não fazem parte desta lista branca.
 */
export function buildPersistableRecord(note) {
  // Lista branca de persistência. Dados exclusivos de auditoria (paciente,
  // CPF, médicos e qualquer objeto relacionado) não entram neste retorno.
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
    tipoCirurgiaOriginal: note.cirurgia.tipoOriginal,
    tipoCirurgia: note.cirurgia.tipoPadronizado || note.cirurgia.tipoOriginal,
    valorTotal: note.nota.valorTotal,
    itens: note.itens.map(item => ({
      codigo: item.codigo,
      descricaoOriginal: item.descricaoOriginal,
      descricaoPadronizada: item.descricaoPadronizada || "",
      ncm: item.ncm,
      cst: item.cst,
      cfop: item.cfop,
      unidade: item.unidade,
      quantidade: item.quantidade,
      valorUnitario: item.valorUnitario,
      valorTotal: item.valorTotal,
    })),
  };
}
