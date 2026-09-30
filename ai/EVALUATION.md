# Avaliação — identificação de normas

Corpus capturado em 2026-09-30 · 23 casos com gabarito · NR-01 (transversal) fora da conta.

| Modo | Precisão | Revocação | F1 | Menor score do 1º item (casos) |
|---|---:|---:|---:|---:|
| bm25 | 0.38 | 0.48 | 0.43 | 7.3 |
| bm25+regras | 0.96 | 0.93 | 0.94 | 5.5 |
| bm25+llm | 0.67 | 0.96 | 0.79 | 13.2 |

## Score do 1º item em frases fora do domínio (calibra `APRUMO_MIN_SCORE`)

| Frase | Score |
|---|---:|
| Como faço uma receita de bolo de cenoura? | 7.3 |
| Qual o melhor filme para assistir hoje? | 6.9 |
| Organizar a festa de aniversário da empresa | 7.9 |

## Casos com erro

| Modo | Atividade | Esperado | Previsto |
|---|---|---|---|
| bm25 | Troca de luminária em poste a 7 metros, próximo à rede de baixa tensão | NR-10, NR-35 | NR-10, NR-18 |
| bm25 | Limpeza interna de tanque de armazenamento de combustível | NR-33 | NR-13 |
| bm25 | Manutenção corretiva em prensa hidráulica com troca de matriz | NR-12 | NR-12, NR-18 |
| bm25 | Montagem de andaime para pintura de fachada no quarto andar | NR-35 | NR-18 |
| bm25 | Instalação de quadro de distribuição energizado em 380 V | NR-10 | NR-10, NR-18 |
| bm25 | Inspeção dentro de galeria subterrânea de esgoto | NR-33 | NR-18 |
| bm25 | Operação de torno mecânico sem proteção nas partes móveis | NR-12 | NR-12, NR-18 |
| bm25 | Entrega de luvas, capacete e botina para equipe nova | NR-06 | NR-18 |
| bm25 | Troca de motor elétrico de esteira transportadora | NR-10, NR-12 | NR-11, NR-18 |
| bm25 | Solda dentro de silo vazio com acesso por escotilha superior | NR-33, NR-35 | NR-18 |
| bm25 | Limpeza de calhas no telhado de galpão industrial | NR-35 | NR-18 |
| bm25 | Manutenção de subestação com desligamento e bloqueio | NR-10 | NR-12, NR-18 |
| bm25 | Resgate de trabalhador em poço de visita | NR-33 | — |
| bm25 | Instalação de linha de vida em cobertura metálica | NR-35 | NR-13, NR-18 |
| bm25 | Movimentação de bobinas de aço com ponte rolante no galpão | NR-11 | NR-11, NR-18 |
| bm25 | Operação de empilhadeira para carregar paletes no caminhão | NR-11 | NR-11, NR-18 |
| bm25 | Abertura de vaso de pressão para manutenção interna | NR-13, NR-33 | NR-13 |
| bm25 | Solda em linha de gás inflamável dentro da unidade de abastecimento | NR-20 | NR-18, NR-20 |
| bm25 | Posto de trabalho com levantamento manual de caixas de 25 kg durante o turno | NR-17 | NR-17, NR-18 |
| bm25 | Medição de ruído e calor no setor de fundição para avaliar exposição dos operadores | NR-09 | NR-09, NR-17 |
| bm25+regras | Limpeza interna de tanque de armazenamento de combustível | NR-33 | NR-20, NR-33 |
| bm25+regras | Solda dentro de silo vazio com acesso por escotilha superior | NR-33, NR-35 | NR-33 |
| bm25+regras | Abertura de vaso de pressão para manutenção interna | NR-13, NR-33 | NR-13 |
| bm25+llm | Limpeza interna de tanque de armazenamento de combustível | NR-33 | NR-13, NR-20, NR-33 |
| bm25+llm | Montagem de andaime para pintura de fachada no quarto andar | NR-35 | NR-18, NR-35 |
| bm25+llm | Inspeção dentro de galeria subterrânea de esgoto | NR-33 | NR-09, NR-33 |
| bm25+llm | Solda dentro de silo vazio com acesso por escotilha superior | NR-33, NR-35 | NR-20, NR-33 |
| bm25+llm | Resgate de trabalhador em poço de visita | NR-33 | NR-33, NR-35 |
| bm25+llm | Instalação de linha de vida em cobertura metálica | NR-35 | NR-18, NR-35 |
| bm25+llm | Movimentação de bobinas de aço com ponte rolante no galpão | NR-11 | NR-11, NR-12 |
| bm25+llm | Operação de empilhadeira para carregar paletes no caminhão | NR-11 | NR-11, NR-12 |
| bm25+llm | Solda em linha de gás inflamável dentro da unidade de abastecimento | NR-20 | NR-13, NR-20 |
| bm25+llm | Posto de trabalho com levantamento manual de caixas de 25 kg durante o turno | NR-17 | NR-11, NR-17 |
| bm25+llm | Concretagem de laje e montagem de fôrmas na obra de ampliação da fábrica | NR-18 | NR-11, NR-18, NR-35 |
