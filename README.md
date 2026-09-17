# AuditOPME — v0.2.0

Aplicação web para leitura local, conferência e auditoria de notas de OPME.

## O que esta versão faz

- Upload de vários PDFs.
- Leitura local no navegador com PDF.js.
- Identificação do layout MEDPRO.
- Extração de NF, fornecedor, CNPJ, pedido, emissão, cirurgia, competência, valor e chave de acesso.
- Extração posicional dos itens do DANFE.
- Uso temporário de paciente, CPF e médicos exclusivamente na auditoria.
- Validações de datas, campos obrigatórios, chave de acesso, itens e soma financeira.
- Detecção de possível duplicidade dentro do lote por chave de acesso ou por `CNPJ + série + NF`.
- Edição manual dos campos e dos itens antes da decisão.
- Aprovação, rejeição com motivo e reabertura da nota.
- De-Para temporário do tipo de cirurgia dentro do lote atual.
- Lista branca separada para a futura base de custos, sem paciente, CPF ou médicos.

## Regra de privacidade desta fase

Os PDFs e os dados extraídos permanecem no navegador. A v0.2.0 ainda não possui backend, Google Sheets, Drive, login ou armazenamento persistente.

Dados pessoais podem ser exibidos durante a auditoria, mas não fazem parte do objeto preparado para a futura base de custos.

## Como publicar

1. Copie os arquivos deste diretório para a raiz do repositório `auditopme`.
2. Faça commit/push na branch usada pelo GitHub Pages.
3. Abra a página publicada e teste com os PDFs MEDPRO.

## Fluxo de auditoria

1. Carregar PDFs.
2. Conferir os dados e validações.
3. Usar **Editar** quando necessário.
4. Opcionalmente criar um De-Para temporário para o tipo de cirurgia.
5. **Aprovar** notas sem erros ou **Rejeitar** informando o motivo.
6. Uma nota aprovada/rejeitada pode ser reaberta enquanto o lote estiver na página.

## Próxima etapa planejada

Persistência com Google Apps Script + Google Sheets, mantendo a lista branca de campos que podem sair do navegador.
