# AuditOPME — v0.3.0

Aplicação web para leitura local, auditoria e registro de custos de OPME.

## O que entrou nesta versão

A v0.3.0 mantém toda a auditoria da v0.2.0 e adiciona a primeira persistência real:

- conexão com Google Apps Script;
- gravação em Google Sheets somente após aprovação;
- botão **Importar aprovadas**;
- proteção contra duplicidade na base por:
  - chave de acesso da NF-e; ou
  - `CNPJ do fornecedor + série + número da NF`;
- datas gravadas como datas reais no Sheets;
- competência derivada da **data da cirurgia**;
- itens gravados em tabela separada;
- registro técnico de importação na aba `AUDITORIA`;
- De-Para do tipo de cirurgia persistido na aba `DEPARA` quando o lote é importado;
- carregamento das regras de De-Para já existentes ao conectar a base;
- token de acesso temporário enquanto o login Google/Microsoft ainda não foi implementado.

## Privacidade e minimização de dados

Os PDFs continuam sendo lidos no navegador.

Paciente, CPF e médicos podem aparecer durante a auditoria, porém **não fazem parte do objeto enviado ao Apps Script**. Há duas proteções:

1. o frontend cria o objeto de persistência por lista branca;
2. o backend rejeita requisições que contenham chaves de dados pessoais de auditoria.

Nesta versão:

- PDF: não enviado e não armazenado;
- paciente: não enviado;
- CPF: não enviado;
- médicos/CRM: não enviados;
- notas rejeitadas: não são gravadas na base de custos;
- somente notas aprovadas podem ser importadas.

## 1. Atualizar o GitHub Pages

Copie o conteúdo desta pasta para a raiz do repositório `auditopme`, substituindo a v0.2.0.

A estrutura relevante passa a ser:

```text
auditopme/
├── index.html
├── css/
├── js/
│   ├── app.js
│   ├── audit.js
│   ├── backend.js
│   ├── pdf-reader.js
│   ├── validators.js
│   └── parsers/
├── apps-script/
│   └── Code.gs
└── docs/
```

A pasta `apps-script/` é documentação/cópia do backend e não é executada pelo GitHub Pages.

## 2. Configurar a planilha

Abra a planilha **AuditOPME - Base de Dados** e depois **Extensões → Apps Script**.

No projeto **AuditOPME Backend**:

1. abra `Code.gs`;
2. apague o conteúdo existente;
3. copie todo o conteúdo de `apps-script/Code.gs`;
4. salve;
5. execute manualmente a função `setupAuditOPME`;
6. autorize o projeto quando o Google solicitar.

A função:

- cria as abas que estiverem faltando;
- coloca os cabeçalhos nas abas vazias;
- não apaga dados existentes;
- configura formatos de data/moeda;
- registra a planilha usada pelo backend;
- cria o token de acesso.

As abas são:

`NOTAS`, `ITENS`, `AUDITORIA`, `DEPARA`, `LAYOUTS` e `CONFIG`.

### Copiar o token

Depois de executar `setupAuditOPME`, abra o **Registro de execução**. Haverá uma linha semelhante a:

```text
TOKEN DE ACESSO: xxxxxxxx...
```

Guarde esse token. Se precisar vê-lo novamente, execute `mostrarTokenAuditOPME()`.

Para invalidar o token anterior e gerar outro, execute `renovarTokenAuditOPME()`.

## 3. Implantar o Apps Script

No editor do Apps Script:

1. **Implantar → Nova implantação**;
2. tipo: **Aplicativo da Web**;
3. executar como: **Eu**;
4. acesso: **Qualquer pessoa**;
5. implante;
6. copie a URL que termina em `/exec`.

> Esta configuração pública é uma ponte técnica da v0.3.0. O endpoint não aceita gravações sem o token. Quando implementarmos login Google/Microsoft, esta camada será substituída por autenticação de usuário.

Sempre que alterar `Code.gs` depois, crie uma nova versão da implantação ou edite a implantação existente para apontar para a versão mais recente.

## 4. Conectar o AuditOPME

Abra o sistema no GitHub Pages.

1. clique em **Configurar base**;
2. informe a URL `/exec` do Apps Script;
3. informe o token;
4. clique em **Salvar e testar**.

Quando estiver funcionando, o cabeçalho mostrará **Base conectada**.

A URL do backend é salva no `localStorage`. O token fica somente no `sessionStorage`, portanto não é gravado no repositório e tende a desaparecer ao encerrar a sessão do navegador.

## 5. Teste recomendado

Faça primeiro um teste controlado:

1. carregue somente uma NF da MEDPRO;
2. confira todos os dados;
3. aprove a NF;
4. clique em **Importar aprovadas (1)**;
5. confirme a mensagem de privacidade;
6. verifique as abas `NOTAS`, `ITENS` e `AUDITORIA`.

Depois tente importar a mesma NF outra vez. Ela deverá aparecer como **Já cadastrada** e não será duplicada na planilha.

## Estrutura de persistência

Veja `docs/base-de-dados.md` para o detalhamento das colunas.

## Regra de competência

A competência de custos é calculada pela **data da cirurgia**, não pela data de emissão da NF e nem pela data de importação.

Exemplo:

```text
Cirurgia:      31/08/2026
Emissão NF:    10/09/2026
Importação:    17/09/2026
Competência:   08/2026
```

## Próximas etapas

Depois de validarmos a persistência em uso real:

- autenticação Google e Microsoft;
- usuário de auditoria/importação;
- consulta prévia de duplicidades na base;
- dashboard por período da cirurgia;
- relatórios/exportações;
- administração visual das regras de De-Para;
- suporte a novos fornecedores/layouts.
