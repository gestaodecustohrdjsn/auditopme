# Arquitetura — AuditOPME v0.3.0

## Fronteira de dados

O sistema possui dois modelos conceituais.

### AuditNota

Existe somente no navegador e pode conter tudo que é necessário para conferir o documento:

- paciente;
- CPF;
- médicos;
- dados da NF;
- cirurgia;
- itens;
- validações.

### RegistroCustos

É criado por lista branca a partir da AuditNota e contém somente os dados autorizados a sair do navegador.

O backend ainda executa uma segunda verificação para rejeitar chaves sensíveis caso sejam enviadas por engano.

## Fluxo

```text
PDF
 ↓
PDF.js no navegador
 ↓
Parser do fornecedor/layout
 ↓
AuditNota completa (memória do navegador)
 ↓
Auditoria / edição / De-Para / aprovação
 ↓
RegistroCustos (lista branca)
 ↓
Apps Script
 ↓
Validação + duplicidade + lock
 ↓
Google Sheets
  ├─ NOTAS
  ├─ ITENS
  ├─ AUDITORIA
  ├─ DEPARA
  ├─ LAYOUTS
  └─ CONFIG
```

## Comunicação GitHub Pages → Apps Script

A v0.3.0 usa POST `text/plain` em modo `no-cors`. Como o navegador não consegue ler diretamente a resposta opaca, cada requisição recebe um UUID.

O Apps Script guarda o resultado por alguns minutos em `CacheService`, e o frontend consulta o resultado via JSONP usando apenas esse UUID.

O token de escrita segue somente no corpo do POST e não é colocado na URL.

## Concorrência

A importação usa `LockService` para evitar que duas requisições simultâneas gravem a mesma NF entre a conferência de duplicidade e a escrita.

## Datas

Datas da cirurgia e emissão são gravadas como valores de data reais no Google Sheets. A competência é o primeiro dia do mês da cirurgia e recebe formatação `MM/AAAA`.

## Futuro

A camada de token é temporária. Login Google/Microsoft substituirá a autenticação técnica e permitirá preencher `usuario_importacao`, histórico de decisões e perfis de acesso.
