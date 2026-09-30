# Avaliação — identificação de normas

Corpus capturado em 2026-09-30 · 33 casos com gabarito · NR-01 (transversal) fora da conta.

| Modo | Norma principal certa | Precisão | Revocação | F1 |
|---|---:|---:|---:|---:|
| bm25 | 16/33 | 0.47 | 0.45 | 0.46 |
| bm25+regras | 31/33 | 0.89 | 0.87 | 0.88 |
| híbrida | 18/33 | 0.55 | 0.55 | 0.55 |
| híbrida+llm | 32/33 | 0.61 | 0.95 | 0.74 |

## Score do 1º item em frases fora do domínio (calibra `APRUMO_MIN_SCORE`)

| Frase | Score |
|---|---:|
| Como faço uma receita de bolo de cenoura? | 8.5 |
| Qual o melhor filme para assistir hoje? | 13.0 |
| Organizar a festa de aniversário da empresa | 6.8 |

## Casos com erro

| Modo | Atividade | Esperado | Previsto |
|---|---|---|---|
| bm25 | Troca de luminária em poste a 7 metros, próximo à rede de baixa tensão | NR-10, NR-35 | NR-18, NR-34 |
| bm25 | Limpeza interna de tanque de armazenamento de combustível | NR-33 | NR-13 |
| bm25 | Manutenção corretiva em prensa hidráulica com troca de matriz | NR-12 | NR-22 |
| bm25 | Montagem de andaime para pintura de fachada no quarto andar | NR-35 | NR-18, NR-34 |
| bm25 | Instalação de quadro de distribuição energizado em 380 V | NR-10 | NR-10, NR-18 |
| bm25 | Inspeção dentro de galeria subterrânea de esgoto | NR-33 | NR-22 |
| bm25 | Operação de torno mecânico sem proteção nas partes móveis | NR-12 | NR-12, NR-22 |
| bm25 | Entrega de luvas, capacete e botina para equipe nova | NR-06 | — |
| bm25 | Troca de motor elétrico de esteira transportadora | NR-10, NR-12 | — |
| bm25 | Solda dentro de silo vazio com acesso por escotilha superior | NR-33, NR-35 | NR-29, NR-31 |
| bm25 | Limpeza de calhas no telhado de galpão industrial | NR-35 | NR-18, NR-24 |
| bm25 | Manutenção de subestação com desligamento e bloqueio | NR-10 | NR-22 |
| bm25 | Resgate de trabalhador em poço de visita | NR-33 | — |
| bm25 | Instalação de linha de vida em cobertura metálica | NR-35 | NR-18 |
| bm25 | Movimentação de bobinas de aço com ponte rolante no galpão | NR-11 | — |
| bm25 | Operação de empilhadeira para carregar paletes no caminhão | NR-11 | — |
| bm25 | Abertura de vaso de pressão para manutenção interna | NR-13, NR-33 | NR-13 |
| bm25 | Posto de trabalho com levantamento manual de caixas de 25 kg durante o turno | NR-17 | NR-31 |
| bm25 | Medição de ruído e calor no setor de fundição para avaliar exposição dos operadores | NR-09 | NR-22, NR-36 |
| bm25 | Detonação de rochas com explosivos na frente de lavra da mina | NR-19, NR-22 | NR-22 |
| bm25 | Desossa de carne na linha de produção do frigorífico | NR-36 | NR-34, NR-36 |
| bm25+regras | Limpeza interna de tanque de armazenamento de combustível | NR-33 | NR-20, NR-33 |
| bm25+regras | Solda dentro de silo vazio com acesso por escotilha superior | NR-33, NR-35 | NR-33 |
| bm25+regras | Abertura de vaso de pressão para manutenção interna | NR-13, NR-33 | NR-13 |
| bm25+regras | Detonação de rochas com explosivos na frente de lavra da mina | NR-19, NR-22 | NR-22 |
| bm25+regras | Desossa de carne na linha de produção do frigorífico | NR-36 | NR-34, NR-36 |
| bm25+regras | Troca de turma com embarque de trabalhadores na plataforma de petróleo offshore | NR-37 | NR-18 |
| bm25+regras | Reforma dos vestiários e refeitório dos funcionários | NR-24 | NR-18 |
| híbrida | Troca de luminária em poste a 7 metros, próximo à rede de baixa tensão | NR-10, NR-35 | NR-10, NR-18 |
| híbrida | Limpeza interna de tanque de armazenamento de combustível | NR-33 | NR-13 |
| híbrida | Manutenção corretiva em prensa hidráulica com troca de matriz | NR-12 | NR-22 |
| híbrida | Montagem de andaime para pintura de fachada no quarto andar | NR-35 | NR-18, NR-34 |
| híbrida | Instalação de quadro de distribuição energizado em 380 V | NR-10 | NR-10, NR-18 |
| híbrida | Inspeção dentro de galeria subterrânea de esgoto | NR-33 | NR-22 |
| híbrida | Entrega de luvas, capacete e botina para equipe nova | NR-06 | — |
| híbrida | Troca de motor elétrico de esteira transportadora | NR-10, NR-12 | — |
| híbrida | Solda dentro de silo vazio com acesso por escotilha superior | NR-33, NR-35 | NR-31 |
| híbrida | Limpeza de calhas no telhado de galpão industrial | NR-35 | NR-18 |
| híbrida | Resgate de trabalhador em poço de visita | NR-33 | NR-22, NR-33 |
| híbrida | Instalação de linha de vida em cobertura metálica | NR-35 | NR-18 |
| híbrida | Movimentação de bobinas de aço com ponte rolante no galpão | NR-11 | NR-18 |
| híbrida | Operação de empilhadeira para carregar paletes no caminhão | NR-11 | NR-29 |
| híbrida | Abertura de vaso de pressão para manutenção interna | NR-13, NR-33 | NR-13 |
| híbrida | Medição de ruído e calor no setor de fundição para avaliar exposição dos operadores | NR-09 | NR-22, NR-36 |
| híbrida | Detonação de rochas com explosivos na frente de lavra da mina | NR-19, NR-22 | NR-18, NR-22 |
| híbrida | Armazenamento e manuseio de explosivos no paiol da pedreira | NR-19 | NR-19, NR-22 |
| híbrida+llm | Limpeza interna de tanque de armazenamento de combustível | NR-33 | NR-20, NR-33 |
| híbrida+llm | Montagem de andaime para pintura de fachada no quarto andar | NR-35 | NR-18, NR-35 |
| híbrida+llm | Instalação de quadro de distribuição energizado em 380 V | NR-10 | NR-10, NR-16 |
| híbrida+llm | Solda dentro de silo vazio com acesso por escotilha superior | NR-33, NR-35 | NR-33 |
| híbrida+llm | Resgate de trabalhador em poço de visita | NR-33 | NR-33, NR-35 |
| híbrida+llm | Instalação de linha de vida em cobertura metálica | NR-35 | NR-18, NR-35 |
| híbrida+llm | Movimentação de bobinas de aço com ponte rolante no galpão | NR-11 | NR-11, NR-12 |
| híbrida+llm | Operação de empilhadeira para carregar paletes no caminhão | NR-11 | NR-11, NR-12 |
| híbrida+llm | Solda em linha de gás inflamável dentro da unidade de abastecimento | NR-20 | NR-16, NR-20 |
| híbrida+llm | Concretagem de laje e montagem de fôrmas na obra de ampliação da fábrica | NR-18 | NR-18, NR-35 |
| híbrida+llm | Detonação de rochas com explosivos na frente de lavra da mina | NR-19, NR-22 | NR-16, NR-19, NR-22 |
| híbrida+llm | Aplicação de agrotóxico com pulverizador costal na lavoura | NR-31 | NR-09, NR-31 |
| híbrida+llm | Descarte de perfurocortantes no centro cirúrgico do hospital | NR-32 | NR-25, NR-32 |
| híbrida+llm | Solda no casco de navio em reparo no estaleiro | NR-34 | NR-33, NR-34, NR-35 |
| híbrida+llm | Desossa de carne na linha de produção do frigorífico | NR-36 | NR-12, NR-17, NR-36 |
| híbrida+llm | Troca de turma com embarque de trabalhadores na plataforma de petróleo offshore | NR-37 | NR-30, NR-35, NR-37 |
| híbrida+llm | Coleta de lixo domiciliar com caminhão compactador | NR-38 | NR-11, NR-12, NR-38 |
| híbrida+llm | Descarga de contêineres no cais com portêiner | NR-29 | NR-11, NR-29 |
| híbrida+llm | Reforma dos vestiários e refeitório dos funcionários | NR-24 | NR-08, NR-18 |
