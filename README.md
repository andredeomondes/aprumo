# Aprumo

Conferência de requisitos das Normas Regulamentadoras (NRs) antes de uma atividade de risco.

O profissional de segurança descreve a atividade planejada. O Aprumo identifica as normas aplicáveis entre as **36 NRs vigentes**, faz perguntas derivadas dos itens normativos recuperados, mostra a série de acidentes de trabalho do setor e devolve um relatório em PDF que confronta o que foi informado com o que a norma exige, **citando o item de origem em cada linha**.

## O problema

Uma mesma atividade pode acionar várias normas ao mesmo tempo. Trocar uma luminária num poste envolve trabalho em altura (NR-35) e serviço em eletricidade (NR-10), e quem consulta uma norma de cada vez tende a esquecer o requisito da outra. A conferência costuma acontecer de cabeça e não deixa registro.

## O que ele faz e o que não faz

| Faz | Não faz |
|---|---|
| Identifica as NRs aplicáveis a uma descrição em linguagem de campo | Não emite laudo nem parecer técnico |
| Pergunta sobre os requisitos recuperados, citando o item | Não decide enquadramento que depende de juízo profissional: marca como "decisão do profissional" |
| Recusa dado de baixa qualidade: a série de acidentes só aparece se passar no filtro | Não afirma sem fonte: sem base recuperada, diz que não encontrou |
| Gera relatório em PDF com status por item | Não inventa item: referência fora do que foi recuperado é descartada |
| Mascara CPF, e-mail, telefone, CNPJ e matrícula antes de chamar o modelo | Não substitui a leitura da norma |

## Como as temáticas do edital aparecem no projeto

| Temática (Anexo I) | Onde está | Evidência |
|---|---|---|
| NLP | Tokenização em português com stemmer Snowball aplicado antes de tirar acento; BM25 | `ai/aprumo_ai/text.py`, `retrieval.py` |
| LLMs e transformers | Expansão de consulta, escolha de normas num catálogo fechado, perguntas e avaliação com saída estruturada; embeddings `mistral-embed` | `reasoner.py`, `llm.py`, `hybrid.py` |
| RAG | Item numerado como unidade de recuperação, busca híbrida BM25 + vetores com Reciprocal Rank Fusion, citação obrigatória | `hybrid.py`, `service.py` |
| ML: avaliação | Gabarito de 33 atividades, precisão, revocação, F1 e acerto da norma principal, com piso de qualidade no CI | `evaluation/`, `EVALUATION.md` |
| Séries temporais | Série mensal de acidentes por setor (CAT/INSS), filtro de qualidade, Holt com backtest contra o ingênuo | `accidents/trends.py` |
| Engenharia de dados | Download do texto consolidado de cada NR, extração com PyMuPDF, relatório de qualidade da ingestão, hash dos PDFs, agregação de 38 meses de CAT | `ingestion/`, `accidents/ingest.py`, `data/INGESTION.md` |
| MLOps e observabilidade | CI com testes, build e avaliação; métricas de provedores, reserva, cache e latência p50/p95; painel ao vivo | `.github/workflows/ci.yml`, `observability.py`, `#painel` |
| Vieses, privacidade, impacto social | Anonimização antes do modelo, recusa sem base, decisão devolvida ao profissional, auditoria de fontes (ver Dados) | `privacy.py`, `service.py` |

## Arquitetura

```
web  React + Vite           chat com autocompletar, contexto de risco, relatório,
 │                          download do PDF e painel de operação (#painel)
 ▼
bff  Node + Fastify         porta pública: valida contrato (zod), limita taxa por IP,
 │                          orçamento diário, gera o PDF, fala com a IA por token interno
 ▼
ai   Python + FastAPI       36 NRs, busca híbrida, anonimização, cadeia de modelos,
                            série de acidentes, métricas
```

Cada serviço tem uma responsabilidade. As regras de negócio dependem de interfaces (`Retriever`, `Reasoner`, `StructuredLLM`, `Embedder`, `TrendProvider`, `AiClient`), não de implementações, então os testes rodam sem rede e sem chave de API.

No frontend, a mesma direção é preservada: componentes dependem da máquina de estados da conferência, os casos de uso dependem da porta `AprumoGateway` e apenas o adaptador em `web/src/api.ts` conhece `fetch`. O detalhamento e as regras de evolução estão em [`specs/04-arquitetura-frontend.md`](specs/04-arquitetura-frontend.md).

### Fluxo de uma conferência

1. A descrição passa por `redact()`: dado pessoal sai antes de qualquer chamada externa.
2. O modelo diz se é atividade de trabalho, traduz a linguagem de campo para o vocabulário das normas ("poste" → "trabalho em altura") e escolhe até três normas **num catálogo fechado** com as 36 vigentes.
3. A busca híbrida recupera os itens **dentro de cada norma escolhida**, para a norma extensa não afogar a menor.
4. O modelo escreve de 3 a 6 perguntas a partir dos itens recuperados. Pergunta que cite item fora dessa lista é descartada.
5. Para normas setoriais, entra a série de acidentes típicos do setor.
6. Com as respostas, o modelo classifica cada item (atendido, pendente, não informado, decisão do profissional). Item que o modelo não avaliou vira "não informado"; item inventado é descartado.

## Modelos de linguagem

Cadeia de provedores gratuitos, todos pela API compatível com a da OpenAI:

| Ordem | Provedor | Modelo padrão |
|---|---|---|
| 1 | Groq | `qwen/qwen3.8-27b` |
| 2 | Google Gemini | `gemini-flash-lite-latest` |
| 3 | OpenRouter | `nvidia/nemotron-3-super-120b-a12b:free` |
| 4 | Mistral | `mistral-small-latest` |

- Só entra na cadeia o provedor com chave definida no ambiente. A Anthropic entra por último se houver `ANTHROPIC_API_KEY`.
- Falha, 429, resposta vazia ou JSON fora do schema passam para o próximo. Quem respondeu 429 fica fora por 60 segundos.
- Toda resposta é validada por Pydantic, venha de onde vier.
- Cache por entrada: repetir um exemplo não gasta chamada.
- Se nenhum provedor responder, regras locais assumem (dicionário de termos de campo, perguntas direto dos itens, avaliação devolvida ao profissional). A aplicação não cai.
- Economia de tokens: três chamadas por conferência, texto de cada item cortado em 400 caracteres no prompt, limite de saída por etapa.
- O `gpt-oss-20b` da Groq saiu da cadeia depois de falhar em 10 de 10 gerações de JSON na avaliação.

## Dados

### Normas

As **36 NRs vigentes** (NR-02 e NR-27 foram revogadas), baixadas por `python -m aprumo_ai.ingestion.download` a partir da página oficial de cada norma no portal do MTE. O script segue o link do **texto consolidado**, nunca uma portaria de alteração.

Auditoria de fonte: dos 17 PDFs baixados antes por URL montada à mão, 15 não eram o texto consolidado vigente. A NR-10, por exemplo, era a versão com vigência a partir de 01/06/2027, e a NR-23 tinha uma página. O download passou a seguir a página oficial de cada norma para eliminar esse risco.

A ingestão (`python -m aprumo_ai.ingestion`) usa PyMuPDF, segmenta por item numerado e grava `ai/data/corpus.json` com a data de captura e o hash SHA-256 de cada PDF. Na comparação sobre as NR-06, 18 e 35, o pypdf partiu 28 palavras ao meio ("si stema") e o PyMuPDF nenhuma, em 1/20 do tempo.

Resultado: **5.262 itens**, 14 revogados fora da busca. O relatório de qualidade por norma fica em `ai/data/INGESTION.md`. Foi ele que mostrou um erro de citação: sumários listam os anexos antes do texto principal, e o parser rotulava quase toda a NR-18 como "anexo". Agora o rótulo de anexo só vale quando o número do item colide com um já visto.

### Acidentes de trabalho

Comunicações de Acidente de Trabalho (CAT) do INSS, dados abertos sob licença CC-BY, 35 de 38 arquivos mensais (os três últimos foram bloqueados pelo portal com HTTP 403 durante a coleta). `python -m aprumo_ai.accidents.ingest` lê só o CSV de cada ZIP e conta acidentes típicos, de trajeto, doenças e óbitos por **mês do acidente** × CNAE.

A série é montada pela data do acidente, e não pelo mês do arquivo, porque os arquivos oscilam por motivos de publicação (abr/2024 com o dobro do normal, set/2024 a fev/2025 quase vazios, jun/2026 com acúmulo). Os três meses mais recentes são descartados por atraso de notificação.

## Avaliação

33 atividades com gabarito de normas escrito à mão (`ai/aprumo_ai/evaluation/cases.json`), das quais 23 industriais e 10 setoriais. A NR-01, transversal, fica fora da conta.

```
python -m aprumo_ai.evaluation
```

| Modo | Norma principal certa | Precisão | Revocação | F1 |
|---|---:|---:|---:|---:|
| BM25 puro | 16/33 | 0,47 | 0,45 | 0,46 |
| Híbrida (BM25 + embeddings), sem modelo | 18/33 | 0,55 | 0,55 | 0,55 |
| BM25 + regras locais (reserva) | 31/33 | 0,89 | 0,87 | 0,88\* |
| **Híbrida + modelo escolhe as normas (produção)** | **32/33** | 0,61 | **0,95** | 0,74 |

Os embeddings sozinhos acrescentam pouco na identificação da norma (+0,09 de F1 sobre o BM25), porque quem decide a norma é o modelo; o ganho deles está em recuperar o item certo quando a descrição usa outras palavras. Entre execuções, a saída do modelo varia e o F1 de produção oscila entre 0,74 e 0,79.

\* As regras locais foram escritas conhecendo os casos de teste; o número mede que a reserva funciona, não que ela generaliza.

**Como chegamos aqui.** Com 6 normas, identificar a norma pela participação na soma dos scores do BM25, com a consulta expandida pelo modelo, dava F1 0,86. Com 14 normas caiu para 0,68: a NR-18 (construção) fala de altura, eletricidade, EPI e solda, e aparecia em quase toda consulta. A solução foi dividir o trabalho: o modelo escolhe as normas num catálogo fechado e a busca recupera os itens dentro de cada norma escolhida.

**Por que otimizar revocação.** O modelo acerta a norma principal em 32 de 33 casos e às vezes acrescenta uma segunda plausível (andaime de fachada → NR-18; explosivos na mina → NR-16, periculosidade). Em segurança do trabalho, esquecer uma norma custa mais do que conferir uma a mais.

**Piso de qualidade.** O CI roda a avaliação sem modelo (determinística, sem chave) e falha se o F1 das regras locais cair abaixo de 0,80.

## Séries temporais

O pipeline está completo: série mensal de acidentes típicos por setor a partir das CATs do INSS, mapeamento de cada norma setorial para os CNAEs do seu setor (NR-18 construção, NR-22 mineração, NR-31 agro, NR-32 saúde, NR-36 frigoríficos e outras), projeção de 3 meses por Holt e backtest contra o modelo ingênuo, com a projeção exibida só quando vence.

**Mas nenhuma série é exibida hoje, e isso é deliberado.** A série só aparece se passar num filtro de qualidade: nenhum mês pode ficar abaixo de 40% ou acima de 200% da mediana. As CATs abertas de jun/2023 a abr/2026 reprovam em todos os setores, mesmo contando pela data do acidente:

| Período | Acidentes típicos por mês (Brasil) |
|---|---:|
| jun/2023 a abr/2024 | 27 a 50 mil |
| set/2024 a fev/2025 | 2,8 a 8,4 mil |
| jul e ago/2025 | 100 e 95 mil |
| nov e dez/2025 | 40 e 5 |

Acidentes de trabalho não oscilam assim. As variações vêm da publicação dos dados, e uma tendência calculada sobre elas seria falsa. Para uma ferramenta de segurança, mostrar número errado é pior do que não mostrar nada. O código fica pronto para quando a fonte for corrigida ou trocada; a alternativa natural são as tabelas anuais consolidadas do Anuário Estatístico de Acidentes do Trabalho.

## Observabilidade

`GET /v1/metrics` (token interno) e o painel em `#painel` mostram, desde o último início do serviço:

- qual provedor respondeu, qual falhou por erro ou por limite de taxa e quem está em pausa;
- quantas vezes a reserva por regras entrou;
- acerto de cache e parcela de consultas com busca híbrida;
- latência p50 e p95 da análise e da avaliação;
- análises por resultado (com normas, fora do domínio, sem base) e normas mais identificadas;
- uso do orçamento diário.

## Segurança

| Risco | Tratamento |
|---|---|
| Uso direto do serviço que gasta cota de API | Serviço de IA só aceita chamadas com token interno comparado em tempo constante |
| Abuso por IP | 10 requisições por minuto por IP no BFF, confiando só no proxy da hospedagem (sem isso o IP seria forjável pelo `X-Forwarded-For`) |
| Abuso distribuído | Orçamento diário de análises no BFF; gerar PDF não consome |
| Corpo gigante ou malformado | Limite de 256 KB e validação zod; resposta 400/413, nunca 500 |
| Prompt injection | Texto do usuário delimitado como dado no prompt; saída validada por schema; referências conferidas contra o que foi recuperado |
| Dado pessoal | Anonimização antes do modelo; o relatório guarda a atividade já anonimizada |
| Segredos | Chaves só em variável de ambiente; `.env` fora do git |
| Dependências | `npm audit` e `pip-audit` sem vulnerabilidades conhecidas na data da auditoria |

## Limitações

- Nomes de pessoas não são anonimizados (só padrões estruturados: CPF, CNPJ, e-mail, telefone, matrícula).
- Tabelas dos PDFs perdem a estrutura na extração; itens que dependem de tabela ficam incompletos. Anexos avulsos (como os de limites de tolerância da NR-15) não entram.
- O gabarito tem 33 casos escritos pelo autor e é rígido: uma norma plausível a mais conta como erro.
- A série de acidentes está desligada pelo filtro de qualidade enquanto a fonte tiver falhas de publicação (ver Séries temporais).
- Os planos gratuitos têm cota: o orçamento diário e a cadeia de provedores reduzem, mas não eliminam, o risco de indisponibilidade.
- O relatório é apoio à conferência. A responsabilidade técnica continua do profissional habilitado.

## Como rodar localmente

Pré-requisitos: Python 3.12, Node 22 e ao menos uma chave de provedor (Groq, Gemini, OpenRouter ou Mistral, todos com plano gratuito).

```bash
# serviço de IA
cd ai
python -m venv .venv && .venv/Scripts/pip install -e ".[dev]"   # Linux/macOS: .venv/bin/pip
cp .env.example .env                                            # preencha as chaves e um token
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

### Teste completo de ponta a ponta

A suíte Playwright levanta IA, BFF e web em portas isoladas, usa a reserva local determinística
quando não há chave de modelo e valida o fluxo completo até o download de um PDF real. Também
confere o catálogo, o painel e a navegação móvel.

```bash
cd web
npx playwright install chromium
npm run test:e2e
```

O CI executa testes, builds, lint, auditoria das dependências e essa suíte E2E. Em falha de
navegador, o relatório do Playwright fica disponível como artefato da execução.

Reconstruir os dados (opcional, os resultados já estão versionados):

```bash
python -m aprumo_ai.ingestion.download      # PDFs oficiais das 36 NRs
python -m aprumo_ai.ingestion               # corpus.json + INGESTION.md
python -m aprumo_ai.ingestion.embed mistral # vetores da busca híbrida
python -m aprumo_ai.ingestion.suggestions   # arquivo do autocompletar
python -m aprumo_ai.accidents.ingest        # série de acidentes (CAT/INSS)
```

## Deploy

Hospedagem gratuita: `ai` e `bff` no Render (`render.yaml`), `web` na Vercel. Um workflow do GitHub Actions chama `/health` a cada 10 minutos para reduzir o cold start do plano gratuito.

## Licença

Código sob MIT. O texto das Normas Regulamentadoras é público, publicado pelo Ministério do Trabalho e Emprego. Dados de acidentes: INSS, licença CC-BY.
