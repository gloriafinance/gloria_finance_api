# Engineering Guidelines

This repository implements a **pure Domain-Driven Design (DDD)** service-oriented architecture for the Church Financial
API using **TypeScript without any framework** (no NestJS, no other frameworks). The application uses **Express.js**
directly for HTTP routing and **MongoDB** with the custom `@abejarano/ts-mongodb-criteria` library for data persistence.

Follow the conventions below when extending or modifying the codebase.

---

## Technology Stack

### Core Dependencies

- **Runtime**: Node.js with TypeScript
- **Web Framework**: Express.js (vanilla, no framework wrapper)
- **Database**: MongoDB (native driver v6.13.0)
- **Query Builder**: `@abejarano/ts-mongodb-criteria` (v1.2.0) - Custom library for MongoDB queries with DDD patterns
- **Server Utils**: `@abejarano/ts-express-server` (v1.3.0) - Lightweight Express utilities
- **Queue System**: Bull (v4.16.5) with Redis
- **Authentication**: JWT (jsonwebtoken v9.0.2)
- **Logging**: Pino (v10.0.0)
- **Request Validation**: `node-input-validator` (used heavily via Express middlewares under `src/**/infrastructure/http/validators`)

### Important Notes

- **No framework-based dependency injection**: Dependencies are injected manually through constructors
- **No decorators for controllers**: Express routes are registered explicitly
- **Manual singleton management**: Repositories use the singleton pattern via `getInstance()`
- **Pure TypeScript**: No framework-specific annotations or decorators (except `reflect-metadata` for basic metadata)

---

## Architectural Overview

- **Layered modules**: Each bounded context (e.g., `Church`, `Financial`, `SecuritySystem`) is split into `domain`,
  `applications`, and `infrastructure` folders under `src/`. This enforces separation between core business logic,
  use-case orchestration, and framework/IO concerns.
- **Shared utilities**: Cross-cutting concerns live under `src/Shared/` and are consumed via the `@/Shared/...` alias
  configured in `tsconfig.json`.
- **Entry points**:
    - `src/app.ts` bootstraps the HTTP server and registers Express routers through `RoutesModule`
    - `src/queues.ts` provides queue definitions consumed by `StartQueueService`
- **No framework magic**: Everything is explicit—manual route registration, manual dependency instantiation, and
  straightforward TypeScript classes.

---

## Domain Layer Practices

### Entities and Aggregates

- Domain models (e.g., `src/Church/domain/Church.ts`, `src/Church/domain/Minister.ts`) extend `AggregateRoot` from
  `@abejarano/ts-mongodb-criteria`
- Expose factory helpers such as `static create(...)` and `static fromPrimitives(...)` for object construction
- Keep state in **private fields** with intention-revealing getters and setters
- The `toPrimitives()` method serializes the entity to a plain object for persistence

Example:

```typescript
import { AggregateRoot } from "@abejarano/ts-mongodb-criteria"

export class Minister extends AggregateRoot {
  private id?: string
  private ministerId: string
  private name: string

  // ... other private fields

  static create(name: string, email: string, ...): Minister {
    const m = new Minister()
    m.name = name
    m.ministerId = IdentifyEntity.get(`minister`)
    return m
  }

  static fromPrimitives(plainData: any): Minister {
    const m = new Minister()
    m.id = plainData.id
    m.name = plainData.name
    return m
  }

  toPrimitives(): any {
    return {
      ministerId: this.ministerId,
      name: this.name,
      // ...
    }
  }
}
```

### Pure Domain Code

- Domain classes and types **must not import infrastructure code**
- Depend only on other domain modules, value objects, or shared helpers like `IdentifyEntity` or `DateBR`
- Keep business logic and validation in the domain layer

### Typed Requests and DTOs

- User-facing payloads are described with `*.request.ts` or `*.dto.type.ts` files (e.g.,
  `src/AccountsPayable/domain/requests/AccountPayable.request.ts` or `src/Church/domain/type/Church.dto.type.ts`)
- Reuse or extend these types rather than inlining ad-hoc objects

### Repository Contracts

- Persistency abstractions live under `domain/interfaces` as `*.interface.ts` (e.g., `IChurchRepository`,
  `IMinisterRepository`)
- Example:

```typescript
import { Minister } from "../Minister"
import { Criteria, Paginate } from "@abejarano/ts-mongodb-criteria"

export interface IMinisterRepository {
  upsert(minister: Minister): Promise<void>

  list(criteria: Criteria): Promise<Paginate<Minister>>

  findById(ministerId: string): Promise<Minister | undefined>
}
```

- Infrastructure must implement these contracts to keep the domain decoupled from data sources

### Exceptions

- Business errors extend `DomainException` (`src/Shared/domain/exceptions/domain-exception.ts`)
- Surface typed error codes/messages for controllers
- Throw domain exceptions instead of generic Errors for business validation issues

---

## Application Layer Practices

### Use-Case Classes

- Each action is implemented as a class with a single `execute(...)` method (e.g.,
  `src/Church/applications/church/CreateOrUpdateChurch.ts`, `src/Purchases/applications/SearchPurchase.ts`)
- Dependencies are injected through the **constructor** using domain interfaces or shared services
- Example:

```typescript
export class SearchPurchase {
  constructor(private readonly purchaseRepository: IPurchaseRepository) {
  }

  async execute(request: FilterPurchasesRequest): Promise<Paginate<Purchase>> {
    return await this.purchaseRepository.fetch(this.prepareCriteria(request))
  }

  private prepareCriteria(request: FilterPurchasesRequest) {
    // Build Criteria using @abejarano/ts-mongodb-criteria
    const filters = []
    if (request.churchId) {
      filters.push(
        new Map([
          ["field", "churchId"],
          ["operator", Operator.EQUAL],
          ["value", request.churchId],
        ])
      )
    }
    return new Criteria(
      Filters.fromValues(filters),
      Order.fromValues("purchaseDate", OrderTypes.DESC),
      Number(request.perPage),
      Number(request.page)
    )
  }
}
```

### Logging

- Acquire contextual loggers through `Logger("UseCaseName")` from `src/Shared/adapter`
- Log significant state transitions (registrations, updates) before delegating to repositories/services

### Orchestration Only

- Application services coordinate domain entities, repository calls, and other application services (such as queue
  dispatchers)
- **Avoid embedding HTTP or database code here**

---

## Infrastructure Layer Practices

### Controllers and Routes

- Express controllers (`*.controller.ts`) orchestrate application services and normalize responses via
  `domainResponse` (`src/Shared/helpers/domainResponse.ts`)
- Route definitions (`*.routes.ts` or `*.routers.ts`) register controllers and attach middlewares such as
  `PermissionMiddleware`
- Request validation is typically done at the HTTP boundary using `node-input-validator` middlewares (see
  `src/**/infrastructure/http/validators/*.validator.ts`); invalid payloads usually return
  `HttpStatus.UNPROCESSABLE_ENTITY` with `v.errors`
- **No decorators**: Routes are registered manually with Express Router

### Persistence Adapters (Using @abejarano/ts-mongodb-criteria)

Concrete repositories (e.g., `ChurchMongoRepository`, `AvailabilityAccountMongoRepository`) live under
`infrastructure/persistence`, extend `MongoRepository` from `@abejarano/ts-mongodb-criteria`, and implement domain
interfaces.

#### Key Features of @abejarano/ts-mongodb-criteria:

- **MongoRepository<T>**: Base class that provides common CRUD operations
- **Criteria**: Encapsulates filtering, ordering, and pagination logic
- **Filters**: Builder for complex query conditions
- **Operators**: Type-safe query operators (EQUAL, GTE, LTE, CONTAINS, OR, etc.)
- **Paginate<T>**: Standardized pagination response
- **AggregateRoot**: Base class for domain entities

Example repository implementation:

```typescript
import { MongoRepository } from "@abejarano/ts-mongodb-criteria"
import { AvailabilityAccount } from "../../domain"
import { IAvailabilityAccountRepository } from "../../domain/interfaces"

export class AvailabilityAccountMongoRepository
  extends MongoRepository<AvailabilityAccount>
  implements IAvailabilityAccountRepository {
  private static instance: AvailabilityAccountMongoRepository

  static getInstance(): AvailabilityAccountMongoRepository {
    if (!this.instance) {
      this.instance = new AvailabilityAccountMongoRepository()
    }
    return this.instance
  }

  collectionName(): string {
    return "availability_accounts"
  }

  async upsert(account: AvailabilityAccount): Promise<void> {
    const collection = await this.collection()
    await collection.updateOne(
      { availabilityAccountId: account.getAvailabilityAccountId() },
      { $set: account },
      { upsert: true }
    )
  }

  async one(filter: object): Promise<AvailabilityAccount | undefined> {
    const collection = await this.collection()
    const document = await collection.findOne(filter)
    if (!document) return undefined
    return AvailabilityAccount.fromPrimitives({ ...document, id: document._id })
  }
}
```

#### Repository Patterns:

- Repositories follow the **Singleton pattern** via `getInstance()` to share MongoDB connections
- Must implement the `collectionName()` method to specify the MongoDB collection
- Use the native MongoDB driver methods (`findOne`, `updateOne`, `find`, etc.) from the inherited `collection()` method
- Entity mapping: Convert MongoDB documents to domain entities using `fromPrimitives()` factory method

#### Using Criteria for Queries:

Application services build `Criteria` objects to query repositories:

```typescript
import { Criteria, Filters, Operator, Order, OrderTypes } from "@abejarano/ts-mongodb-criteria"

const filters = []
filters.push(new Map([
  ["field", "churchId"],
  ["operator", Operator.EQUAL],
  ["value", churchId],
]))

const criteria = new Criteria(
  Filters.fromValues(filters),
  Order.fromValues("createdAt", OrderTypes.DESC),
  20,  // perPage
  1    // page
)

const results = await repository.list(criteria)
```

### Queue Workers

- Queue handlers implement `IQueue` and are wired through `IDefinitionQueue` entries in `src/queues.ts`
- Provide `useClass`, `inject`, and optional `delay` settings when registering new workers

### Cross-Service Integrations

- Adapters such as the Google Cloud-aware logger or storage clients belong in `src/Shared/infrastructure` or
  `src/Shared/adapter`
- Keep third-party SDK usage out of the domain layer

---

## Error Handling and Background Processing

### Standardized Responses

- Use `domainResponse` in controllers to translate domain exceptions into `HttpStatus.BAD_REQUEST` responses
- Push unexpected errors to the `QueueService` for Telegram notifications

### Queues and Scheduling

- Initialize queues with `StartQueueService(server.getApp(), Queues())` in `src/app.ts`
- Queue services manage lifecycle (`initialize`, `dispatch`, `shutdown`) through dedicated classes (`QueueRegistry`,
  `QueueProcessor`, `QueueDispatcher`)

### Cron Jobs

- Register recurring jobs via `src/Shared/infrastructure/schedule` modules
- Keep scheduling definitions isolated from business logic

---

## Naming and Coding Conventions

### Files and Classes

- **Classes & enums**: Use PascalCase filenames and declarations (e.g., `Church.ts`, `ChurchStatus.enum.ts`)
- **Interfaces & types**: Append `.interface.ts`, `.request.ts`, or `.dto.type.ts` to describe contracts and payloads
- **Controllers & routes**: Controllers end with `.controller.ts` and routes with `.routes.ts` or `.routers.ts`
- **Repositories**: Name repositories with the pattern `<Entity>MongoRepository.ts` (e.g., `ChurchMongoRepository.ts`)

### Code Style

- Keep property names in `camelCase`
- Prefer explicit type aliases over anonymous objects
- Use `async/await` for asynchronous operations
- Follow the repository pattern with singleton instances

---

## Dependency Management

### Manual Dependency Injection

Since this project **does not use NestJS or any DI framework**, dependencies are managed manually:

1. **Repositories**: Use singleton pattern via `getInstance()`
   ```typescript
   const repository = ChurchMongoRepository.getInstance()
   ```

2. **Use Cases**: Instantiate with required dependencies
   ```typescript
   const useCase = new CreateChurch(ChurchMongoRepository.getInstance())
   ```

3. **Controllers**: Instantiate use cases in controller methods
   ```typescript
   export class ChurchController {
     async create(req: Request, res: Response) {
       const useCase = new CreateChurch(ChurchMongoRepository.getInstance())
       const result = await useCase.execute(req.body)
       return domainResponse(result, res)
     }
   }
   ```

### Path Aliases

The project uses `tsconfig-paths` for module resolution. Available aliases:

- `@/Shared/*` → `src/Shared/*`
- Other bounded contexts are referenced by relative paths

---

## Testing Practices

- Tests use Jest (v29.7.0) with ts-jest
- Run tests with: `npm test`
- Tests should follow the same layered architecture
- Mock repositories at the infrastructure boundary
- Focus on testing business logic in use cases

---

## Database Queries with @abejarano/ts-mongodb-criteria

### Available Operators

- `Operator.EQUAL`: Exact match
- `Operator.GTE`: Greater than or equal
- `Operator.LTE`: Less than or equal
- `Operator.CONTAINS`: Partial string match
- `Operator.OR`: Logical OR condition
- `Operator.IN`: Value in array
- `Operator.NOT_EQUAL`: Not equal

### Complex Queries with OR Conditions

```typescript
const searchConditions: OrCondition[] = [
  { field: "name", operator: Operator.CONTAINS, value: searchTerm },
  { field: "email", operator: Operator.CONTAINS, value: searchTerm },
]

filters.push(
  new Map([
    ["field", "search"],
    ["operator", Operator.OR],
    ["value", searchConditions],
  ])
)
```

### Pagination

All list queries return a `Paginate<T>` object:

```typescript
{
  count: number,      // Total records
    nextPag
:
  number,    // Next page number
    results
:
  T[]        // Array of entities
}
```

---

## References

- **@abejarano/ts-mongodb-criteria**: [GitHub Repository](https://github.com/abejarano/ts-mongo-criteria)
- **@abejarano/ts-express-server**: Custom Express utilities
- **MongoDB Native Driver**: [Documentation](https://mongodb.github.io/node-mongodb-native/)
- **Express.js**: [Documentation](https://expressjs.com/)

---

## Summary

This is a **pure TypeScript DDD application** without framework abstractions:

- ✅ Uses vanilla Express.js for HTTP routing
- ✅ Uses MongoDB native driver with `@abejarano/ts-mongodb-criteria` for queries
- ✅ Manual dependency injection via constructors and singletons
- ✅ Clean separation between domain, application, and infrastructure layers
- ❌ No NestJS
- ❌ No framework-based dependency injection
- ❌ No decorators for routes or controllers

## Bounded Contexts

### ChurchContext

- Directorio: `src/Church`
- Entidades: Church, Member, Minister
- Depende de: `Shared`
- Publica eventos lógicos (a nivel de app): MemberRegistered, ChurchCreated

### SecurityContext

- Directorio: `src/SecuritySystem`
- Entidades: User, Role, Permission
- Depende de: `Shared`, `Church` (cuando vincula memberId)

### FinanceConfigContext

- Directorio: `src/Financial`
- Submódulos:
    - availabilityAccount
    - costCenter
    - financialConcept
    - contributions (OnlineContributions)
- Depende de: `Church`, `Shared`

### TreasuryContext

- Directorios:
    - `src/AccountsPayable`
    - `src/AccountsReceivable`
    - `src/Financial/applications/financeRecord`
    - `src/Financial/applications/dispatchers`
    - `src/Financial/applications/jobs`
    - `src/ConsolidatedFinancial`
- Depende de: `FinanceConfigContext`, `Church`, `Shared`

### BankingContext

- Directorio: `src/Banking`
- Depende de: `FinanceConfigContext`, `TreasuryContext` (via interfaces), `Shared`

### PatrimonyContext

- Directorio: `src/Patrimony`
- Depende de: `Church`, `Shared`

### PurchasesContext

- Directorio: `src/Purchases`
- Depende de: `FinanceConfigContext`, `TreasuryContext`, `Shared`

### ReportsContext

- Directorio: `src/Reports`
- Depende de: `TreasuryContext`, `FinanceConfigContext`, `BankingContext`, `Shared`

```text
Church, Security, World
        ↓
   FinanceConfig (Financial: concepts, accounts, cost centers)
        ↓
   Treasury (AccountsPayable, AccountsReceivable, FinancialRecords, Consolidated)
        ↓
   Banking (Bank, BankStatements, Movements)
        ↓
   Reports, Patrimony, Purchases
