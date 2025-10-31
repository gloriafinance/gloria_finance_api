# Catálogo de conceitos financeiros

O catálogo `financialConcepts` define os tipos de lançamentos aceitos pelo módulo financeiro da API. Cada conceito centraliza o mapeamento entre tipos de receita/saída, categoria contábil e indicadores que alimentam relatórios de fluxo de caixa, DRE e balanço patrimonial.

## Campos disponíveis

| Campo | Tipo | Obrigatório | Descrição |
| --- | --- | --- | --- |
| `financialConceptId` | `string` | Sim (gerado automaticamente) | Identificador único legível pelo domínio. |
| `name` | `string` | Sim | Nome curto exibido em relatórios e filtros. |
| `description` | `string` | Sim | Detalhes sobre o uso do conceito. |
| `type` | `INCOME` \| `OUTGO` \| `PURCHASE` \| `REVERSAL` | Sim | Natureza do lançamento financeiro. |
| `statementCategory` | `REVENUE` \| `COGS` \| `OPEX` \| `CAPEX` \| `OTHER` | Sim | Classificação contábil utilizada em relatórios gerenciais. |
| `active` | `boolean` | Sim | Indica se o conceito pode ser selecionado em novos lançamentos. |
| `affectsCashFlow` | `boolean` | Sim para novos registros | `true` quando o conceito altera o fluxo de caixa realizado. |
| `affectsResult` | `boolean` | Sim para novos registros | `true` quando impacta o resultado (DRE). |
| `affectsBalance` | `boolean` | Sim para novos registros | `true` quando gera impacto direto no balanço patrimonial. |
| `isOperational` | `boolean` | Sim para novos registros | `true` para eventos recorrentes das operações do dia a dia. |
| `createdAt` | `string` (ISO) | Automático | Registrado pela API ao persistir o conceito. |

> **Compatibilidade:** os campos booleanos são opcionais para conceitos criados antes desta atualização, mas se tornam obrigatórios em novas criações via API.

## Regras de default

Quando os indicadores não são informados explicitamente, a API aplica os seguintes padrões:

- `REVENUE`, `OPEX` e `COGS`: `affectsCashFlow=true`, `affectsResult=true`, `affectsBalance=false`, `isOperational=true`.
- `CAPEX`: `affectsCashFlow=true`, `affectsResult=false`, `affectsBalance=true`, `isOperational=false`.
- `OTHER` + `PURCHASE`: `affectsCashFlow=true`, `affectsResult=false`, `affectsBalance=true`, `isOperational=false`.
- `OTHER` + `REVERSAL`: todos `false`.
- `OTHER` com demais tipos (`INCOME`/`OUTGO`): `affectsCashFlow=true`, `affectsResult=true`, `affectsBalance=false`, `isOperational=false`.

## Exemplos JSON

### Antes
```json
{
  "name": "Conta a Receber",
  "description": "Valor a receber por pagamento de uma conta a receber.",
  "type": "INCOME",
  "active": true,
  "statementCategory": "REVENUE"
}
```

### Depois
```json
{
  "name": "Conta a Receber",
  "description": "Valor a receber por pagamento de uma conta a receber.",
  "type": "INCOME",
  "active": true,
  "statementCategory": "REVENUE",
  "affectsCashFlow": true,
  "affectsResult": true,
  "affectsBalance": false,
  "isOperational": true
}
```

## Endpoints afetados

### `GET /financial-concepts`
Retorna a lista completa de conceitos da igreja autenticada. Exemplo de resposta:
```json
[
  {
    "financialConceptId": "FC-DIZIMO",
    "name": "Dízimos de Membros",
    "description": "Dízimos regulares doados pelos membros da igreja.",
    "statementCategory": "REVENUE",
    "type": "INCOME",
    "active": true,
    "affectsCashFlow": true,
    "affectsResult": true,
    "affectsBalance": false,
    "isOperational": true
  }
]
```

### `GET /financial-concepts/:id`
Retorna um conceito específico do catálogo. A carga útil segue o mesmo formato do `GET` geral.

### `POST /financial-concepts`
Cria um novo conceito. Payload mínimo:
```json
{
  "financialConceptId": "FC-DIZIMO",
  "name": "Dízimos de Membros",
  "description": "Dízimos regulares doados pelos membros da igreja.",
  "statementCategory": "REVENUE",
  "type": "INCOME",
  "active": true,
  "affectsCashFlow": true,
  "affectsResult": true,
  "affectsBalance": false,
  "isOperational": true
}
```
> O `PermissionMiddleware` injeta automaticamente o `churchId` a partir do token; não envie esse campo no corpo da requisição.

### `PATCH /financial-concepts/:id`
Aceita qualquer combinação parcial dos campos acima. Os indicadores booleanos que forem omitidos permanecem com o valor atual. Inclua-os explicitamente para alterar o comportamento contábil.

### `POST /financial-records`
O objeto `financialConcept` dentro do payload agora deve apresentar os novos campos quando fornecido manualmente:
```json
{
  "financialConcept": {
    "financialConceptId": "FC-DIZIMO",
    "name": "Dízimos de Membros",
    "description": "Dízimos regulares doados pelos membros da igreja.",
    "statementCategory": "REVENUE",
    "type": "INCOME",
    "affectsCashFlow": true,
    "affectsResult": true,
    "affectsBalance": false,
    "isOperational": true
  }
}
```

## Script de migração (MongoDB)
Para atualizar documentos já existentes na coleção `financial_concepts`, aplique os defaults com o snippet abaixo (executado no Mongo Shell ou mongosh):
```javascript
db.financial_concepts.updateMany(
  {
    $or: [
      { affectsCashFlow: { $exists: false } },
      { affectsResult: { $exists: false } },
      { affectsBalance: { $exists: false } },
      { isOperational: { $exists: false } }
    ]
  },
  [
    {
      $set: {
        affectsCashFlow: {
          $ifNull: [
            "$affectsCashFlow",
            { $cond: [{ $in: ["$statementCategory", ["REVENUE", "OPEX", "COGS"]] }, true, { $cond: [{ $eq: ["$statementCategory", "CAPEX"] }, true, { $cond: [{ $and: [{ $eq: ["$statementCategory", "OTHER"] }, { $eq: ["$type", "REVERSAL"] }] }, false, true] }] }] }
          ]
        },
        affectsResult: {
          $ifNull: [
            "$affectsResult",
            { $cond: [{ $eq: ["$statementCategory", "CAPEX"] }, false, { $cond: [{ $and: [{ $eq: ["$statementCategory", "OTHER"] }, { $eq: ["$type", "PURCHASE"] }] }, false, { $cond: [{ $and: [{ $eq: ["$statementCategory", "OTHER"] }, { $eq: ["$type", "REVERSAL"] }] }, false, true] }] } }
          ]
        },
        affectsBalance: {
          $ifNull: [
            "$affectsBalance",
            { $cond: [{ $in: ["$statementCategory", ["CAPEX"]] }, true, { $cond: [{ $and: [{ $eq: ["$statementCategory", "OTHER"] }, { $eq: ["$type", "PURCHASE"] }] }, true, false] }] }
          ]
        },
        isOperational: {
          $ifNull: [
            "$isOperational",
            { $cond: [{ $in: ["$statementCategory", ["REVENUE", "OPEX", "COGS"]] }, true, false] }
          ]
        }
      }
    }
  ]
)
```

> Ajuste o pipeline conforme regras específicas da sua contabilidade caso utilize categorias personalizadas.
