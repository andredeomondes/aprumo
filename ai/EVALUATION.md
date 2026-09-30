# Avaliação — identificação de normas

Corpus capturado em 2026-09-30 · 15 casos com gabarito · NR-01 (transversal) fora da conta.

| Modo | Precisão | Revocação | F1 | Menor score do 1º item (casos) |
|---|---:|---:|---:|---:|
| bm25 | 0.38 | 0.44 | 0.41 | 5.1 |
| bm25+llm | 0.88 | 0.83 | 0.86 | 12.0 |

## Score do 1º item em frases fora do domínio (calibra `APRUMO_MIN_SCORE`)

| Frase | Score |
|---|---:|
| Como faço uma receita de bolo de cenoura? | 5.7 |
| Qual o melhor filme para assistir hoje? | 5.7 |
| Organizar a festa de aniversário da empresa | 4.9 |

## Casos com erro

| Modo | Atividade | Esperado | Previsto |
|---|---|---|---|
| bm25 | Troca de luminária em poste a 7 metros, próximo à rede de baixa tensão | NR-10, NR-35 | NR-10, NR-12 |
| bm25 | Limpeza interna de tanque de armazenamento de combustível | NR-33 | NR-12 |
| bm25 | Montagem de andaime para pintura de fachada no quarto andar | NR-35 | NR-10, NR-12 |
| bm25 | Inspeção dentro de galeria subterrânea de esgoto | NR-33 | NR-12 |
| bm25 | Entrega de luvas, capacete e botina para equipe nova | NR-06 | NR-10, NR-12 |
| bm25 | Troca de motor elétrico de esteira transportadora | NR-10, NR-12 | NR-12 |
| bm25 | Solda dentro de silo vazio com acesso por escotilha superior | NR-33, NR-35 | NR-10, NR-12 |
| bm25 | Limpeza de calhas no telhado de galpão industrial | NR-35 | NR-12 |
| bm25 | Manutenção de subestação com desligamento e bloqueio | NR-10 | NR-12 |
| bm25 | Resgate de trabalhador em poço de visita | NR-33 | NR-10, NR-33 |
| bm25 | Instalação de linha de vida em cobertura metálica | NR-35 | NR-12, NR-35 |
| bm25+llm | Troca de luminária em poste a 7 metros, próximo à rede de baixa tensão | NR-10, NR-35 | NR-10 |
| bm25+llm | Entrega de luvas, capacete e botina para equipe nova | NR-06 | NR-06, NR-10 |
| bm25+llm | Troca de motor elétrico de esteira transportadora | NR-10, NR-12 | NR-10 |
| bm25+llm | Solda dentro de silo vazio com acesso por escotilha superior | NR-33, NR-35 | NR-33 |
| bm25+llm | Manutenção de subestação com desligamento e bloqueio | NR-10 | NR-10, NR-12 |
