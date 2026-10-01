# 04 — Arquitetura do frontend

O frontend do Aprumo é a camada de apresentação do fluxo de conferência. Ele não contém
regras normativas, não classifica requisitos e não conhece provedores de IA. Essas decisões
pertencem ao serviço `ai` e chegam ao navegador por contratos validados pelo `bff`.

## Direção das dependências

```text
components ──► state/useAssessment ──► AprumoGateway ◄── api (fetch)
     │                  │
     └──────────────► types ◄──────── contracts do BFF/IA
```

- `components/`: apresentação e interação acessível; recebem dados e callbacks.
- `state/assessment.ts`: máquina de estados pura da conferência.
- `state/useAssessment.ts`: casos de uso e coordenação assíncrona.
- `api.ts`: porta `AprumoGateway` e adaptador HTTP padrão.
- `types.ts`: representação TypeScript dos contratos validados no BFF.
- `app/`: preocupações da aplicação, como roteamento.
- `hooks/`: comportamentos reutilizáveis sem marcação visual.

## Princípios aplicados

### Responsabilidade única

O `App` compõe páginas e layout. A máquina de estados decide transições. O gateway cuida da
rede. `TransientNotice` renderiza feedback e `useTransientNotice` controla seu ciclo de vida.

### Aberto/fechado e substituição

`useAssessment` depende de `AprumoGateway`. Testes ou novos transportes podem fornecer outra
implementação sem alterar a máquina de estados ou os componentes.

### Segregação de interfaces

Componentes recebem apenas o estado e as ações que utilizam. Eles não importam o cliente HTTP
nem acessam segredos, orçamento ou provedores do serviço de IA.

### Inversão de dependência

O caso de uso conhece a porta `AprumoGateway`, não os detalhes de `fetch`. O adaptador HTTP é a
implementação padrão injetada na borda da aplicação.

## Estado da conferência

O fluxo é explícito e finito:

```text
describe → analyzing → asking → evaluating → done
              │                         │
              └──────── failure ◄───────┘
```

Chamadas ao modelo partem de eventos do usuário, nunca de efeitos de renderização. Isso evita
requisições duplicadas no `StrictMode`. Ao concluir a avaliação, o caso de uso emite
`onReportReady`, permitindo que a composição móvel abra o relatório sem sincronizar estado por
efeito.

## Contratos e regras de domínio

- Os status válidos são `atendido`, `pendente`, `nao_informado` e `decisao_humana`.
- O frontend não inventa status nem referências normativas.
- Toda referência exibida veio do conjunto recuperado e validado pelo backend.
- PDF, orçamento, limitação de taxa, anonimização e validação estrutural permanecem no BFF/IA.
- Mudanças de contrato devem atualizar Python, Zod, exemplos em `contracts/` e TypeScript.

## Regras de evolução

1. Não adicionar chamadas HTTP diretamente em componentes.
2. Não duplicar estado derivável do `State` da conferência.
3. Manter transições puras em `assessment.ts` e efeitos em `useAssessment.ts`.
4. Preferir callbacks com intenção (`onReportReady`) a efeitos que sincronizam estados locais.
5. Toda nova transição de domínio precisa de teste do reducer.
6. Toda alteração de contrato precisa passar pelos testes de Python, BFF e web.
