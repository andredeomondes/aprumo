# Auditoria do sistema — 01/10/2026

## Escopo

Comparação entre README, especificações, plano histórico, contratos e implementação dos três
serviços. A verificação cobre o fluxo `web → BFF → IA → relatório → PDF`, catálogo, painel,
responsividade, qualidade do código, dependências e automação de CI.

## Resultado executivo

O MVP documentado no README funciona de ponta a ponta. A conferência identifica normas,
produz perguntas ancoradas em itens recuperados, avalia as respostas, exibe as citações e gera
um PDF válido. Os serviços respondem em ambiente local com 5.262 requisitos do corpus capturado
em 30/09/2026.

Duas metas da especificação original continuam pendentes:

1. **Entrevista adaptativa:** as respostas são avaliadas, mas ainda não acionam nova recuperação
   nem perguntas adicionais. Implementar isso altera o contrato e o fluxo de domínio; requer uma
   decisão explícita de produto.
2. **Publicação comprovada:** a infraestrutura de deploy está configurada, mas o repositório não
   registra a URL pública para que a acessibilidade externa seja auditável.

O plano em `docs/plans/2026-09-30-aprumo-mvp.md` é um documento histórico de execução. Seus
checklists não representam o estado atual e não devem ser usados como tracker de entrega.

## Evidências automatizadas

| Camada | Resultado | Evidência |
|---|---:|---|
| Web unitário | 19/19 | gateway, reducer, status, métricas e sugestões |
| BFF | 20/20 | validação, limites, orçamento, contratos, PDF e cliente da IA |
| IA | 89/89 | API, domínio, privacidade, RAG, resiliência, tendências e contratos |
| E2E Playwright | 3/3 | desktop completo, catálogo/painel e composição móvel |
| Avaliação determinística | aprovado | F1 `bm25+regras = 0,88`, piso `0,80` |
| Build | aprovado | TypeScript/Vite e TypeScript do BFF |
| Lint | aprovado | `oxlint` no frontend |
| Dependências npm | aprovado | zero vulnerabilidades conhecidas em produção |
| Dependências Python | aprovado | `pip-audit --skip-editable`, após atualização do instalador |

## Fluxo verificado

| Limite | Estado | Evidência |
|---|---|---|
| Interface → análise | aprovado | POST real `/api/analyze` iniciado pelo navegador |
| BFF → IA | aprovado | análise retorna NR-35/NR-10 e requisitos citáveis |
| Perguntas → avaliação | aprovado | respostas percorrem todas as perguntas e chamam `/api/evaluate` |
| Avaliação → relatório | aprovado | requisitos recebem status, justificativa e referência |
| Relatório → PDF | aprovado | download inicia e o arquivo começa com `%PDF` |
| Catálogo | aprovado | 36 NRs renderizadas e filtro por tema funcional |
| Painel | aprovado | métricas reais do BFF/IA carregadas |
| Mobile | aprovado | alternância acessível entre conversa, andamento e relatório |

## Melhorias implementadas nesta auditoria

- suíte E2E hermética em portas dedicadas, sem depender de servidores já abertos;
- teste do download e da assinatura do PDF;
- projetos Playwright separados para desktop e mobile;
- auditoria de dependências, lint e E2E incorporados ao GitHub Actions;
- artefato HTML do Playwright preservado quando o CI falha;
- resultados temporários do Playwright ignorados pelo Git;
- aquecimento do frontend corrigido para alcançar BFF e IA sem consumir análise;
- critérios de sucesso da especificação atualizados com evidência real.

## Riscos restantes

- O fallback local é determinístico e mantém o produto disponível, mas não substitui a avaliação
  periódica com os provedores de linguagem configurados.
- O corpus contém itens extraídos de tabelas e anexos cuja estrutura pode ter sido perdida, como
  já registrado no README.
- A URL pública e um smoke test contra produção ainda precisam ser registrados após o deploy.
