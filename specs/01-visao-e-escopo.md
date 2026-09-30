# 01 — Visão e escopo

## O problema

Antes de executar uma atividade de risco, alguém precisa conferir se todos os requisitos
normativos estão atendidos. Esse trabalho hoje é manual: o profissional de segurança consulta
as normas aplicáveis, lista o que cada uma exige e confere item por item.

Três coisas dão errado nesse processo:

1. **Requisito esquecido.** Uma atividade pode acionar três normas ao mesmo tempo, e a
   intersecção entre elas é fácil de perder.
2. **Norma não identificada.** Quem descreve a atividade nem sempre sabe que ela se enquadra
   numa NR específica.
3. **Conferência sem rastro.** A checagem acontece na cabeça de alguém e não fica registrada.

## O que o Aprumo faz

Conduz uma entrevista sobre a atividade planejada, **com perguntas derivadas dos requisitos das
normas aplicáveis**, e devolve um relatório que confronta o que foi informado com o que a norma
exige, apontando o que está atendido, o que falta e citando o item de origem.

## O que ele não faz

Esta seção é tão importante quanto a anterior, e vai no README e no produto.

- **Não emite laudo nem parecer técnico.** Não substitui profissional habilitado.
- **Não decide enquadramento** que dependa de juízo profissional. Quando um requisito depende
  de uma classificação subjetiva (por exemplo, se uma atividade é rotineira ou não), o sistema
  aponta que o requisito existe e devolve a decisão ao humano.
- **Não afirma sem fonte.** Toda afirmação cita o item normativo que a sustenta. Quando não há
  base recuperada, o sistema declara que não encontrou, em vez de preencher a lacuna.
- **Não substitui a leitura da norma.**

## Por que a estrutura da NR favorece este problema

As Normas Regulamentadoras são escritas como listas de requisitos numerados
hierarquicamente (`35.4.5.1`). Isso traz duas vantagens raras:

- **A unidade de recuperação já existe.** Não é preciso inventar uma janela de corte por
  caracteres: o item numerado é o chunk natural.
- **O identificador de citação vem de graça.** Citar "NR-35, item 35.4.5.1" é verificável por
  qualquer pessoa em trinta segundos.

Medição no corpus inicial de 6 normas: **1.336 itens numerados em 251 páginas.**

## Usuário

Profissional de segurança do trabalho, técnico ou engenheiro, no momento do planejamento de
uma atividade. O uso é pontual, não contínuo: chega com uma atividade em mente, sai com um
relatório.

## Critérios de sucesso

O projeto é considerado bem-sucedido se, ao final:

- [ ] O sistema identifica corretamente as normas aplicáveis a uma descrição de atividade
- [ ] As perguntas da entrevista são **derivadas da norma recuperada**, não codificadas
- [ ] A resposta a uma pergunta pode **acionar requisitos adicionais** (entrevista adaptativa)
- [ ] Toda linha do relatório cita o item de origem
- [ ] O sistema recusa responder quando não há base recuperada, e isso é demonstrável
- [ ] Existe um conjunto de casos com gabarito e as métricas são medidas, não estimadas
- [ ] A aplicação está publicada e acessível por link
- [ ] O serviço expõe métricas e há um painel mostrando o sistema em operação

## Fora de escopo, por decisão

| Item | Por quê |
|---|---|
| Visão computacional | Exigiria treinar rede e comparar arquiteturas; não cabe no prazo sem comprometer o resto |
| Todas as 36 NRs | O corpus inicial cobre as normas de maior intersecção; ampliar é questão de ingestão, não de arquitetura |
| Ajuste fino de modelo de linguagem | O problema é de recuperação e ancoragem, não de estilo de geração |
| Autenticação e multiusuário | Não acrescenta nada à demonstração técnica |

## Relação com o Edital 032/2026

Este é o projeto de implementação previsto no item 3.4.2.7, a ser enviado até 23h59 de
01/10/2026 com vídeo explicativo de até 2 minutos, e sobre o qual a banca pode arguir o
candidato (item 3.4.3.5).

Cobertura das temáticas do Anexo I em `02-requisitos.md`.
