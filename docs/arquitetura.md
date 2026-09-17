# Arquitetura — AuditOPME

## Regra central

**O navegador lê tudo. O backend, quando existir, receberá somente os campos explicitamente autorizados para persistência.**

O objeto de auditoria (`AuditNota`) pode conter dados pessoais temporários. O objeto persistível (`RegistroCustos`) usa uma lista branca e exclui paciente, CPF e médicos.

## Camadas

1. `pdf-reader.js`: PDF → texto.
2. `parsers/*`: texto → estrutura padronizada por fornecedor/layout.
3. `validators.js`: regras de consistência independentes do layout.
4. `audit.js`: orquestra parser e validação e, futuramente, gera o objeto persistível.
5. `app.js`: interface.

## Identificação de NF

Prioridade futura para duplicidade:

1. chave de acesso da NF-e;
2. fallback: CNPJ do fornecedor + série + número da NF.

Número da NF isolado não deve ser tratado como identificador único entre fornecedores.

## Competência de custos

A competência é derivada da **data da cirurgia**, não da data de emissão nem da data de importação.
