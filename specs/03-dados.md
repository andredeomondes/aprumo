# 03 — Dados

## Fonte

**Normas Regulamentadoras**, publicadas pelo Ministério do Trabalho e Emprego.

Índice oficial:
`https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes`

Os PDFs ficam num caminho previsível, o que permite ingestão automatizada:

```
.../comissao-tripartite-partitaria-permanente/arquivos/normas-regulamentadoras/nr-XX.pdf
```

São 38 normas, das quais 36 vigentes (NR-2 e NR-27 revogadas). Licença de uso público.

## Corpus inicial

Seis normas, escolhidas pela intersecção que produzem entre si:

| Norma | Título | Páginas | Itens numerados |
|---|---|---:|---:|
| NR-01 | Disposições Gerais e Gerenciamento de Riscos Ocupacionais | 11 | 93 |
| NR-06 | Equipamento de Proteção Individual | 11 | 28 |
| NR-10 | Segurança em Instalações e Serviços em Eletricidade | 33 | 155 |
| NR-12 | Segurança no Trabalho em Máquinas e Equipamentos | 167 | 902 |
| NR-33 | Segurança e Saúde nos Trabalhos em Espaços Confinados | 13 | 50 |
| NR-35 | Trabalho em Altura | 16 | 108 |
| | **Total** | **251** | **1.336** |

Medição real, feita sobre os arquivos baixados, não estimativa.

### Por que essas seis

A NR-01 é transversal e se aplica sempre. A NR-06 aparece em qualquer atividade com EPI. As
outras quatro cobrem riscos que **se cruzam na prática**: manutenção elétrica em altura aciona
NR-10 e NR-35; manutenção de máquina dentro de tanque aciona NR-12 e NR-33.

Essa intersecção é justamente o que torna o problema interessante: o profissional que consulta
uma norma isolada tende a perder o requisito da outra.

## Unidade de recuperação

**O item numerado é o chunk.** Não há janela de corte arbitrária.

```
35.4.5.1  →  identificador
          →  texto do requisito
          →  hierarquia: 35 > 35.4 > 35.4.5 > 35.4.5.1
```

Consequências:

- A citação é verificável por qualquer pessoa
- O contexto hierárquico pode ser recuperado junto (o item pai dá o assunto)
- Não existe o problema clássico de um requisito ficar partido entre dois chunks

## Qualidade e limitações conhecidas

| Questão | Situação |
|---|---|
| Texto extraível | ✅ Todas as seis extraem texto, sem necessidade de OCR |
| NR-12 é desproporcional | 902 dos 1.336 itens. Domina o corpus e pode enviesar a recuperação. Mitigação em `04-arquitetura.md` |
| Anexos | A NR-12 tem anexos extensos e muito específicos. Avaliar incluir ou declarar fora de escopo |
| Tabelas e figuras | A extração perde a estrutura de tabela. Itens que dependem de tabela ficam incompletos e precisam ser marcados |
| Atualização | As normas mudam por portaria. O corpus é uma fotografia datada e o sistema deve registrar a data de captura |
| Remissões entre normas | Itens que citam outra NR criam dependência que a recuperação simples não segue |

## Camada temporal

Para cobrir a temática de séries temporais do Anexo I, uma segunda fonte:

**Comunicações de Acidente de Trabalho (CAT)** do INSS, com série mensal agregada por atividade
econômica. Permite responder:

> *Como evoluiu a ocorrência de acidentes nesse tipo de atividade nos últimos anos?*

Isso acrescenta contexto de risco ao relatório de conformidade, em vez de ser um enxerto.

**Status: implementado com recusa por qualidade.** O pipeline cobre 35 de 38 arquivos mensais,
descarta os três meses mais recentes por atraso de notificação e só publica a tendência quando
a série passa no filtro de integridade. A fonte atual reprova nesse filtro, por isso o produto
não exibe uma projeção enganosa. O detalhamento e as anomalias observadas estão no README.

## Dado pessoal

O corpus normativo é público e não contém dado pessoal.

**Mas a entrevista contém.** O profissional pode informar nome de trabalhador, matrícula, CPF,
nome da empresa e localização da obra. Esse dado:

- é anonimizado antes de qualquer chamada a modelo externo
- não é persistido além do necessário para gerar o relatório
- se nenhum provedor externo responder, a reserva por regras locais mantém o fluxo disponível

Detalhamento em `04-arquitetura.md`.

## Reprodutibilidade

A ingestão é um comando. O script baixa os PDFs, extrai, segmenta por item numerado e grava o
corpus estruturado, registrando a data de captura e o hash de cada arquivo de origem.
