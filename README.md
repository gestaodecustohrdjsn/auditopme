# AuditOPME v0.4.0

Sistema web para leitura local de DANFEs de OPME, auditoria antes da persistência e consolidação de dados de custos em Google Sheets.

## O que há nesta versão

- Todo o fluxo da v0.3.0: leitura local dos PDFs, parser MEDPRO, edição, validações, aprovação/rejeição, De-Para e importação para Google Sheets.
- Novo **Dashboard OPME** dentro do sistema.
- Período e competência do dashboard são baseados **sempre na data da cirurgia**.
- Filtros por intervalo de datas, fornecedor e tipo de cirurgia/procedimento.
- Indicadores:
  - número de notas fiscais;
  - linhas de OPME;
  - quantidade física de OPMEs;
  - valor total;
  - valor médio por NF.
- Consolidações por mês, fornecedor, tipo de cirurgia e item de OPME.
- Os dados do dashboard vêm somente das notas com status `IMPORTADA` na base.

> O dashboard não mostra “número de cirurgias” nesta versão. Como nome/CPF do paciente não são persistidos, não existe uma chave confiável para afirmar que duas NFs pertencem ou não à mesma cirurgia. O sistema evita inventar essa métrica.

## Privacidade

Paciente, CPF e médicos continuam disponíveis somente durante a auditoria no navegador. Eles não são enviados ao Apps Script nem persistidos no Google Sheets.

## Atualização do Apps Script da v0.3 para v0.4

1. Abra a planilha `AuditOPME - Base de Dados`.
2. Vá em **Extensões > Apps Script**.
3. Substitua o conteúdo de `Code.gs` pelo arquivo `apps-script/Code.gs` desta versão.
4. Execute `setupAuditOPME()` novamente. A função é compatível com a estrutura existente e não recria o token quando ele já existe.
5. Vá em **Implantar > Gerenciar implantações**.
6. Edite a implantação atual do Aplicativo da Web.
7. Em **Versão**, selecione **Nova versão** e clique em **Implantar**.
8. Ao atualizar a implantação existente, a URL `/exec` permanece a mesma.

## Atualização do GitHub Pages

Substitua os arquivos do repositório pelos desta pasta. Não remova a estrutura de diretórios.

A interface passa a ter duas áreas:

- **Auditoria**: upload e conferência das NFs.
- **Dashboard**: consulta da base já importada.

## Configuração em outro computador

Na v0.4.0, a conexão ainda funciona por URL + token:

- a URL do Apps Script é salva em `localStorage` daquele navegador;
- o token fica apenas em `sessionStorage` e, portanto, é temporário.

Assim, um computador novo precisa receber a URL e o token. Mesmo no computador atual, uma nova sessão do navegador pode exigir o token novamente. Isso é intencional nesta fase para evitar deixar o token persistente no navegador.

A autenticação de usuários (Google/Microsoft) será uma camada posterior e substituirá esse processo manual.

## Estrutura

```text
auditopme/
├── index.html
├── README.md
├── apps-script/
│   └── Code.gs
├── css/
│   └── style.css
├── docs/
│   ├── arquitetura.md
│   └── base-de-dados.md
└── js/
    ├── app.js
    ├── audit.js
    ├── backend.js
    ├── dashboard.js
    ├── pdf-reader.js
    ├── validators.js
    └── parsers/
        ├── parser-base.js
        └── medpro-v1.js
```
