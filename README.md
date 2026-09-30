# Aprumo

Conferência de requisitos das Normas Regulamentadoras (NRs) antes de uma atividade de risco.

O profissional de segurança descreve a atividade planejada. O Aprumo identifica as normas aplicáveis, faz perguntas derivadas dos itens normativos recuperados e devolve um relatório em PDF que confronta o que foi informado com o que a norma exige, **citando o item de origem em cada linha**.

## O problema

Uma mesma atividade pode acionar várias normas ao mesmo tempo. Trocar uma luminária num poste envolve trabalho em altura (NR-35) e serviço em eletricidade (NR-10), e quem consulta uma norma de cada vez tende a esquecer o requisito da outra. A conferência costuma acontecer de cabeça e não deixa registro.

## O que ele faz e o que não faz

| Faz | Não faz |
|---|---|
| Identifica as NRs aplicáveis a uma descrição em linguagem de campo | Não emite laudo nem parecer técnico |
| Pergunta sobre os requisitos recuperados, citando o item | Não decide enquadramento que depende de juízo profissional: marca como "decisão do profissional" |
| Gera relatório em PDF com status por item | Não afirma sem fonte: sem base recuperada, diz que não encontrou |
| Mascara CPF, e-mail, telefone, CNPJ e matrícula antes de chamar o modelo | Não substitui a leitura da norma |

## Arquitetura

```
web  React + Vite           chat, relatório e download do PDF
 │
 ▼
bff  Node + Fastify         porta pública: valida contrato (zod), limita taxa,
 │                          gera o PDF, fala com a IA por token interno
 ▼
ai   Python + FastAPI       ingestão das NRs, busca BM25, anonimização,
                            orquestração e chamadas ao Claude
```

Cada serviço tem uma responsabilidade. As regras de negócio dependem de interfaces (`Retriever`, `Reasoner`, `AiClient`), não de implementações, então os testes rodam sem rede e sem chave de API.

### Fluxo de uma conferência

1. A descrição passa por `redact()`: dado pessoal sai antes de qualquer chamada externa.
2. O modelo diz se é atividade de trabalho e traduz a linguagem de campo para os termos que as NRs usam ("poste" → "trabalho em altura").
3. O BM25 recupera os itens; a norma aplicável é a de maior participação na soma dos scores.
4. O modelo escreve de 3 a 6 perguntas **a partir dos itens recuperados**. Pergunta que cite item fora dessa lista é descartada.
5. Com as respostas, o modelo classifica cada item (atendido, pendente, não informado, decisão do profissional). Item que o modelo não avaliou vira "não informado"; item inventado é descartado.

## Decisões

| Decisão | Por quê |
|---|---|
| O item numerado (`35.4.5.1`) é a unidade de recuperação | Não existe janela de corte arbitrária, nenhum requisito fica partido, e a citação é verificável em trinta segundos |
| BM25 em vez de embeddings | Cabe no plano gratuito (sem modelo em memória) e é explicável item a item. Embeddings são o próximo passo |
| Expansão da consulta pelo modelo | Quem descreve a atividade não usa o vocabulário da norma; o BM25 puro erra por isso (ver avaliação) |
| Saída estruturada validada por Pydantic | O modelo devolve JSON no formato do domínio ou a chamada falha; não há parsing de texto livre |
| Guardas fora do modelo | Recusar sem base, descartar item inventado e anonimizar são regras de código, testadas, que não dependem do modelo obedecer |
| Token interno entre BFF e IA | O serviço de IA, que gasta crédito de API, não aceita chamada direta da internet |

## Dados

Seis normas escolhidas pela intersecção que produzem entre si: NR-01, NR-06, NR-10, NR-12, NR-33 e NR-35, baixadas do portal oficial do MTE. A ingestão (`python -m aprumo_ai.ingestion`) segmenta por item numerado e grava `ai/data/corpus.json` com a data de captura e o hash SHA-256 de cada PDF.

Resultado: **607 itens**, dos quais 13 revogados ficam fora da busca.

## Avaliação

15 atividades com gabarito de normas escrito à mão (`ai/aprumo_ai/evaluation/cases.json`). A NR-01, transversal, fica fora da conta.

```
python -m aprumo_ai.evaluation
```

| Modo | Precisão | Revocação | F1 |
|---|---:|---:|---:|
| BM25 puro | 0,38 | 0,44 | 0,41 |

O BM25 puro erra porque as normas extensas (NR-12, NR-10) aparecem em quase toda consulta. Outra medição importante: frases fora do domínio ("receita de bolo") recebem score semelhante ao de casos reais, então **o limiar de score não serve como filtro de domínio**. Quem faz esse filtro é o modelo (`is_work_activity`), e o score fica só como piso. O modo com expansão pelo modelo roda com `ANTHROPIC_API_KEY` definida e é registrado em `ai/EVALUATION.md`.

## Limitações

- Seis NRs de 36 vigentes. Ampliar é questão de ingestão, não de arquitetura.
- Anexos da NR-12 cobertos parcialmente; tabelas perdem a estrutura na extração do PDF.
- A extração às vezes separa palavras no meio ("fab ricação"), o que prejudica a busca nesses itens.
- O texto da NR-10 capturado é o da Portaria MTE nº 737/2026, com vigência a partir de 01/06/2027.
- Gabarito com 15 casos, escritos pelo autor: mede a tendência, não garante generalização.
- O relatório é apoio à conferência. A responsabilidade técnica continua do profissional habilitado.

## Como rodar localmente

Pré-requisitos: Python 3.12, Node 22 e uma chave da API da Anthropic.

```bash
# serviço de IA
cd ai
python -m venv .venv && .venv/Scripts/pip install -e ".[dev]"   # Linux/macOS: .venv/bin/pip
cp .env.example .env                                            # preencha a chave e um token
.venv/Scripts/python -m pytest
.venv/Scripts/uvicorn aprumo_ai.main:app --env-file .env --port 8000

# BFF
cd bff
npm install && npm test
cp .env.example .env && npx tsx --env-file=.env src/server.ts

# web
cd web
npm install && npm test
npm run dev
```

## Deploy

Hospedagem gratuita: `ai` e `bff` no Render (`render.yaml`), `web` na Vercel. Um workflow do GitHub Actions chama `/health` a cada 10 minutos para reduzir o cold start do plano gratuito.

## Licença

Código sob MIT. O texto das Normas Regulamentadoras é público, publicado pelo Ministério do Trabalho e Emprego.
