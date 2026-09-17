# AuditOPME

**Conferência e Gestão de OPME**

Versão inicial do sistema web para leitura local, conferência e futura consolidação de dados de notas fiscais de OPME.

## Princípio de privacidade

O navegador pode utilizar dados pessoais presentes no PDF (ex.: nome do paciente, CPF e médicos) durante a auditoria. Esses campos **não fazem parte do objeto persistível de custos**. Na v0.1.0 nenhum dado é enviado a Google Sheets, Apps Script, Drive ou outro backend.

## v0.1.0

- Upload múltiplo de PDFs
- Leitura local com PDF.js
- Identificação do layout MEDPRO
- Extração de dados da NF, cirurgia e itens
- Validação de soma dos itens
- Cards de auditoria
- Estrutura preparada para novos fornecedores/parsers

## Estrutura

```text
auditopme/
├── index.html
├── css/style.css
├── js/
│   ├── app.js
│   ├── audit.js
│   ├── pdf-reader.js
│   ├── validators.js
│   └── parsers/
│       ├── parser-base.js
│       └── medpro-v1.js
└── docs/arquitetura.md
```

## Publicação no GitHub Pages

1. Envie os arquivos para a branch `main` do repositório `auditopme`.
2. Em **Settings → Pages**, selecione **Deploy from a branch**.
3. Branch: `main`; pasta: `/ (root)`.
4. Abra a URL gerada pelo GitHub Pages.

> A leitura usa módulos ES e PDF.js via CDN, portanto a página deve ser aberta por HTTP/HTTPS (GitHub Pages funciona normalmente). Evite testar abrindo `index.html` diretamente via `file://`.

## Próxima etapa planejada

v0.2: edição de campos, aprovação/rejeição, motivos de auditoria e de-para temporário.
