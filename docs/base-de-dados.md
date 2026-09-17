# Base de dados — AuditOPME v0.3.0

## NOTAS

Uma linha por nota importada.

Principais campos:

- `id_nota`: UUID interno;
- `id_lote`: identifica a importação realizada em conjunto;
- `chave_unica`: chave usada para impedir duplicidades;
- `fornecedor`;
- `cnpj_fornecedor`;
- `numero_nf`;
- `serie_nf`;
- `chave_acesso`;
- `pedido`;
- `data_emissao`;
- `data_cirurgia`;
- `competencia`: primeiro dia do mês da cirurgia, exibido como `MM/AAAA`;
- `tipo_cirurgia_original`;
- `tipo_cirurgia`: valor final após eventual De-Para;
- `valor_total`;
- `qtd_tipos_opme`;
- `qtd_unidades_opme`;
- `status`;
- `data_importacao`;
- `usuario_importacao`: reservado para a futura autenticação;
- `origem`.

## ITENS

Uma linha por item da NF.

Além de `id_item`, `id_nota` e `id_lote`, a tabela repete competência, data da cirurgia, fornecedor e NF para facilitar filtros e tabelas dinâmicas no Google Sheets.

Mantém:

- descrição original;
- descrição padronizada;
- descrição final;
- código;
- NCM;
- CST;
- CFOP;
- unidade;
- quantidade;
- valor unitário;
- valor total.

## AUDITORIA

Na v0.3.0 registra eventos de importação sem dados identificáveis do paciente.

As decisões de rejeição permanecem somente no lote do navegador nesta fase.

## DEPARA

Armazena regras persistentes por:

`CNPJ fornecedor + layout + campo + valor de origem → valor de destino`.

A primeira regra implementada é `tipoCirurgia`.

## LAYOUTS

Catálogo técnico dos leitores disponíveis. O setup cadastra inicialmente `medpro-v1`.

## CONFIG

Parâmetros estruturais da aplicação. Nesta versão registra explicitamente:

- competência baseada na data da cirurgia;
- armazenamento de PDF desativado;
- persistência de dados pessoais de auditoria desativada.

## Duplicidade

A prioridade é:

1. chave de acesso de 44 dígitos;
2. caso a chave não esteja disponível: `CNPJ fornecedor + série + número NF`.

Assim, fornecedores diferentes podem ter o mesmo número de NF sem colisão.
