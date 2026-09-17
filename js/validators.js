function brDateToDate(value) {
  const m = String(value || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const date = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  if (date.getFullYear() !== Number(m[3]) || date.getMonth() !== Number(m[2]) - 1 || date.getDate() !== Number(m[1])) return null;
  return date;
}

export function validateAuditNote(note) {
  const alerts = [];
  const required = [
    [note.documento.fornecedor, "Fornecedor não identificado."],
    [note.documento.numeroNF, "Número da NF não identificado."],
    [note.cirurgia.data, "Data da cirurgia não identificada."],
    [note.nota.dataEmissao, "Data de emissão não identificada."],
    [note.cirurgia.tipoOriginal, "Tipo de cirurgia não identificado."],
  ];
  for (const [value, message] of required) if (!value) alerts.push({ level: "error", message });

  if (!(note.nota.valorTotal >= 0)) alerts.push({ level: "error", message: "Valor total da NF não identificado." });
  if (!note.itens.length) alerts.push({ level: "error", message: "Nenhum item da nota foi identificado." });

  if (note.documento.chaveAcesso && !/^\d{44}$/.test(note.documento.chaveAcesso)) {
    alerts.push({ level: "warning", message: "A chave de acesso encontrada não possui 44 dígitos." });
  }
  if (!note.documento.chaveAcesso) alerts.push({ level: "warning", message: "Chave de acesso não identificada." });

  const surgeryDate = brDateToDate(note.cirurgia.data);
  const issueDate = brDateToDate(note.nota.dataEmissao);
  if (note.cirurgia.data && !surgeryDate) alerts.push({ level: "error", message: "Data da cirurgia inválida." });
  if (note.nota.dataEmissao && !issueDate) alerts.push({ level: "error", message: "Data de emissão inválida." });
  if (surgeryDate && issueDate && surgeryDate > issueDate) {
    alerts.push({ level: "warning", message: "A cirurgia está datada após a emissão da NF. Conferir documento." });
  }

  const itemSum = note.itens.reduce((sum, item) => sum + (Number(item.valorTotal) || 0), 0);
  const total = Number(note.nota.valorTotal);
  const difference = Number.isFinite(total) ? Math.abs(itemSum - total) : null;
  const sumMatches = difference !== null && difference <= 0.02;
  if (difference !== null && !sumMatches) {
    alerts.push({ level: "error", message: `A soma dos itens diverge do valor total da NF em R$ ${difference.toFixed(2).replace(".", ",")}.` });
  }

  const errorCount = alerts.filter(a => a.level === "error").length;
  const warningCount = alerts.filter(a => a.level === "warning").length;
  note.sistema.alertas = alerts;
  note.sistema.status = errorCount ? "ERRO" : warningCount ? "ALERTA" : "OK";
  note.sistema.confianca = Math.max(0, 100 - errorCount * 20 - warningCount * 5);

  return { note, itemSum, sumMatches, difference, errorCount, warningCount };
}
