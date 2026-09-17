# Arquitetura — AuditOPME

## Princípio central

**Auditar tudo; persistir somente o necessário para gestão de custos.**

O PDF é lido no navegador. `AuditNota` pode conter dados pessoais necessários para a conferência. A função `buildPersistableRecord()` cria um segundo objeto por lista branca e exclui paciente, CPF e médicos.

## Camadas

- `pdf-reader.js`: leitura do PDF e coordenadas dos textos.
- `parsers/*`: reconhecimento de fornecedor/layout e extração para o formato comum `AuditNota`.
- `validators.js`: validações independentes do layout.
- `audit.js`: orquestra parser/validação e define o registro permitido para persistência.
- `app.js`: estado do lote, interface, edição, aprovação/rejeição e De-Para temporário.

## Estado da auditoria

Cada nota possui um estado independente da validação técnica:

- `PENDENTE`
- `APROVADA`
- `REJEITADA`

A validação técnica continua usando `OK`, `ALERTA`, `ERRO` ou `NAO_RECONHECIDO`.

Uma nota com `ERRO` não pode ser aprovada antes da correção. Alertas permitem aprovação.

## Duplicidade

Nesta fase, a verificação ocorre somente dentro do lote aberto no navegador:

1. chave de acesso da NF-e, quando disponível;
2. fallback: CNPJ do fornecedor + série + número da NF.

Quando houver persistência, a mesma lógica deverá ser repetida no backend contra a base histórica.

## De-Para

A v0.2.0 implementa regras temporárias para `tipoCirurgia`, com escopo:

`fornecedor/CNPJ + layout + valor extraído -> valor padronizado`

As regras desaparecem ao limpar/fechar o lote. A persistência delas será adicionada no backend em versão posterior.
