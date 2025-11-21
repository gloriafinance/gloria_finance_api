# Architecture Documentation

This document provides a comprehensive overview of the application's architecture, emphasizing the **pure DDD approach without frameworks**.

---

## Architecture Principles

### 1. Framework-Free DDD
This project implements Domain-Driven Design **without relying on frameworks** like NestJS, Nest.js, Inversify, or TypeDI. All architectural patterns are implemented using pure TypeScript and Express.js.

**Key Characteristics:**
- ✅ **Vanilla Express.js**: Direct HTTP routing without framework wrappers
- ✅ **Manual Dependency Injection**: Constructor injection without DI containers
- ✅ **Explicit Module System**: TypeScript modules with path aliases
- ✅ **Singleton Pattern**: Repository instances managed manually
- ❌ **No Decorators**: No `@Controller`, `@Injectable`, etc.
- ❌ **No Framework Magic**: Everything is explicit and traceable

### 2. Layered Architecture

```
┌─────────────────────────────────────────────┐
│            HTTP / CLI / Queue                │  ← Entry Points
├─────────────────────────────────────────────┤
│          Infrastructure Layer                │  ← Controllers, Routes, Repositories
├─────────────────────────────────────────────┤
│          Application Layer                   │  ← Use Cases / Services
├─────────────────────────────────────────────┤
│          Domain Layer                        │  ← Entities, Value Objects, Interfaces
├─────────────────────────────────────────────┤
│          Shared / Cross-Cutting              │  ← Utilities, Exceptions, Adapters
└─────────────────────────────────────────────┘
```

---

## Project Structure

```
src/
├── AccountsPayable/              # Bounded Context
│   ├── domain/                   # Core business logic
│   │   ├── interfaces/           # Repository contracts
│   │   ├── requests/             # Input DTOs
│   │   ├── Supplier.ts           # Aggregate Root
│   │   └── ...
│   ├── applications/             # Use Cases
│   │   ├── CreateSupplier.ts    # Single responsibility
│   │   └── ...
│   └── infrastructure/           # External concerns
│       ├── persistence/          # MongoDB implementations
│       ├── http/                 # Controllers & Routes
│       └── ...
│
├── Church/                       # Another Bounded Context
│   ├── domain/
│   ├── applications/
│   └── infrastructure/
│
├── Financial/
├── Purchases/
├── SecuritySystem/
├── ... (other contexts)
│
├── Shared/                       # Cross-cutting concerns
│   ├── domain/
│   │   ├── exceptions/          # Domain exceptions
│   │   └── ...
│   ├── adapter/                 # Logging, utilities
│   ├── helpers/                 # Pure functions
│   └── infrastructure/          # Shared infra (Storage, Queue)
│
├── app.ts                        # HTTP server bootstrap
├── queues.ts                     # Queue definitions
└── bootstrap/                    # Initialization modules
```

---

## Layer Responsibilities

### Domain Layer (`*/domain/`)

**Purpose**: Contains pure business logic, free from framework and infrastructure dependencies.

**Contents:**
- **Entities/Aggregates**: Extend `AggregateRoot` from `@abejarano/ts-mongodb-criteria`
- **Value Objects**: Immutable objects representing domain concepts
- **Interfaces**: Repository contracts (e.g., `IChurchRepository`)
- **Enums**: Domain-specific enumerations
- **Types/DTOs**: Request/response type definitions
- **Domain Exceptions**: Business rule violations

**Rules:**
- ❌ No imports from `infrastructure` or `applications`
- ❌ No framework dependencies
- ❌ No database or HTTP concerns
- ✅ Only imports from `domain`, `Shared/domain`, and standard libraries

**Example:**
```typescript
// src/Church/domain/Church.ts
import { AggregateRoot } from "@abejarano/ts-mongodb-criteria"
import { IdentifyEntity } from "@/Shared/adapter"

export class Church extends AggregateRoot {
  private id?: string
  private churchId: string
  private name: string

  static create(name: string, email: string): Church {
    const church = new Church()
    church.churchId = IdentifyEntity.get("church")
    church.name = name
    return church
  }

  static fromPrimitives(data: any): Church {
    const church = new Church()
    church.id = data.id
    church.churchId = data.churchId
    church.name = data.name
    return church
  }

  toPrimitives(): any {
    return {
      churchId: this.churchId,
      name: this.name,
    }
  }
}
```

---

### Application Layer (`*/applications/`)

**Purpose**: Orchestrates domain entities and repository calls to fulfill use cases.

**Contents:**
- **Use Case Classes**: One class per use case with `execute()` method
- **Application Services**: Coordinate multiple aggregates or external services
- **Query Builders**: Construct `Criteria` objects for repositories

**Rules:**
- ✅ Import from `domain` and `Shared`
- ✅ Inject dependencies via constructor
- ✅ Use domain interfaces, not concrete implementations
- ❌ No HTTP or database code
- ❌ No direct framework dependencies

**Example:**
```typescript
// src/Purchases/applications/SearchPurchase.ts
import { IPurchaseRepository } from "../domain/interfaces"
import { FilterPurchasesRequest } from "../domain/requests"
import { Criteria, Filters, Operator, Order, OrderTypes } from "@abejarano/ts-mongodb-criteria"

export class SearchPurchase {
  constructor(private readonly purchaseRepository: IPurchaseRepository) {}

  async execute(request: FilterPurchasesRequest) {
    return await this.purchaseRepository.fetch(this.prepareCriteria(request))
  }

  private prepareCriteria(request: FilterPurchasesRequest): Criteria {
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

---

### Infrastructure Layer (`*/infrastructure/`)

**Purpose**: Implements external concerns (HTTP, database, queues, storage).

**Contents:**
- **Persistence**: MongoDB repository implementations
- **HTTP**: Controllers and route definitions
- **Queues**: Background job handlers
- **Adapters**: Third-party service integrations

**Rules:**
- ✅ Implements domain interfaces
- ✅ Handles framework-specific code (Express, MongoDB)
- ✅ Singleton pattern for repositories
- ❌ Should not contain business logic

#### Persistence Layer

**Example:**
```typescript
// src/Financial/infrastructure/persistence/AvailabilityAccountMongoRepository.ts
import { MongoRepository } from "@abejarano/ts-mongodb-criteria"
import { AvailabilityAccount } from "../../domain"
import { IAvailabilityAccountRepository } from "../../domain/interfaces"

export class AvailabilityAccountMongoRepository
  extends MongoRepository<AvailabilityAccount>
  implements IAvailabilityAccountRepository
{
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
      { $set: account.toPrimitives() },
      { upsert: true }
    )
  }
}
```

#### HTTP Layer

**Controllers:**
```typescript
// src/Church/infrastructure/http/Church.controller.ts
import { Request, Response } from "express"
import { CreateChurch } from "../../applications/church/CreateChurch"
import { ChurchMongoRepository } from "../persistence/ChurchMongoRepository"
import { domainResponse } from "@/Shared/helpers/domainResponse"

export class ChurchController {
  async create(req: Request, res: Response) {
    const useCase = new CreateChurch(ChurchMongoRepository.getInstance())
    const result = await useCase.execute(req.body)
    return domainResponse(result, res)
  }

  async list(req: Request, res: Response) {
    const useCase = new ListChurches(ChurchMongoRepository.getInstance())
    const result = await useCase.execute(req.query)
    return res.json(result)
  }
}
```

**Routes:**
```typescript
// src/Church/infrastructure/http/Church.routes.ts
import { Router } from "express"
import { ChurchController } from "./Church.controller"
import { PermissionMiddleware } from "@/Shared/infrastructure/middleware"

const router = Router()
const controller = new ChurchController()

router.post("/churches", PermissionMiddleware, controller.create.bind(controller))
router.get("/churches", PermissionMiddleware, controller.list.bind(controller))

export default router
```

---

## Dependency Flow

```
┌──────────────────┐
│   Controller     │  ← Infrastructure
└────────┬─────────┘
         │ calls
         ▼
┌──────────────────┐
│    Use Case      │  ← Application
└────────┬─────────┘
         │ uses
         ▼
┌──────────────────┐
│ Repository Iface │  ← Domain
└────────┬─────────┘
         │ implemented by
         ▼
┌──────────────────┐
│ Mongo Repository │  ← Infrastructure
└──────────────────┘
```

**Key Points:**
- Dependencies point **inward** (toward the domain)
- Domain layer has **no** outward dependencies
- Infrastructure implements domain interfaces
- Application layer orchestrates through interfaces

---

## Dependency Injection Pattern

Since there's **no DI framework**, we use manual constructor injection:

### 1. Repository Singleton Pattern
```typescript
export class ChurchMongoRepository extends MongoRepository<Church> {
  private static instance: ChurchMongoRepository

  static getInstance(): ChurchMongoRepository {
    if (!this.instance) {
      this.instance = new ChurchMongoRepository()
    }
    return this.instance
  }
}
```

### 2. Use Case Instantiation
```typescript
// In controller
const repository = ChurchMongoRepository.getInstance()
const useCase = new CreateChurch(repository)
const result = await useCase.execute(request)
```

### 3. Service Composition
```typescript
export class ComplexUseCase {
  constructor(
    private readonly churchRepo: IChurchRepository,
    private readonly ministerRepo: IMinisterRepository,
    private readonly queueService: QueueService
  ) {}

  async execute(data: any) {
    // Orchestrate multiple services
  }
}

// Usage
const useCase = new ComplexUseCase(
  ChurchMongoRepository.getInstance(),
  MinisterMongoRepository.getInstance(),
  QueueService.getInstance()
)
```

---

## Module Organization (Bounded Contexts)

Each bounded context follows this structure:

```
BoundedContext/
├── domain/
│   ├── interfaces/
│   │   └── EntityRepository.interface.ts
│   ├── requests/
│   │   └── EntityRequest.ts
│   ├── Entity.ts
│   └── EntityStatus.enum.ts
│
├── applications/
│   ├── CreateEntity.ts
│   ├── UpdateEntity.ts
│   └── SearchEntity.ts
│
└── infrastructure/
    ├── persistence/
    │   └── EntityMongoRepository.ts
    └── http/
        ├── Entity.controller.ts
        └── Entity.routes.ts
```

---

## Cross-Cutting Concerns (Shared Layer)

The `Shared/` directory contains reusable components:

```
Shared/
├── domain/
│   ├── exceptions/
│   │   └── domain-exception.ts
│   └── value-objects/
│
├── adapter/
│   ├── Logger.ts
│   ├── IdentifyEntity.ts
│   └── ...
│
├── helpers/
│   ├── domainResponse.ts
│   ├── DateBR.ts
│   └── ...
│
└── infrastructure/
    ├── middleware/
    ├── queue/
    ├── storage/
    └── schedule/
```

**Usage:**
```typescript
import { Logger } from "@/Shared/adapter"
import { domainResponse } from "@/Shared/helpers/domainResponse"
import { DomainException } from "@/Shared/domain/exceptions/domain-exception"
```

---

## Error Handling Strategy

### Domain Exceptions
```typescript
// Shared/domain/exceptions/domain-exception.ts
export class DomainException extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message)
    this.name = "DomainException"
  }
}

// Usage in domain
if (!church.isActive()) {
  throw new DomainException("Church is not active", "CHURCH_INACTIVE", 400)
}
```

### Controller Error Handling
```typescript
import { domainResponse } from "@/Shared/helpers/domainResponse"

export async function controllerMethod(req: Request, res: Response) {
  try {
    const result = await useCase.execute(req.body)
    return domainResponse(result, res)
  } catch (error) {
    if (error instanceof DomainException) {
      return res.status(error.statusCode).json({
        error: error.code,
        message: error.message,
      })
    }
    // Log and notify unexpected errors
    logger.error(error)
    return res.status(500).json({ error: "INTERNAL_ERROR" })
  }
}
```

---

## Background Processing

### Queue System
- **Library**: Bull (Redis-backed)
- **Definition**: `src/queues.ts`
- **Workers**: `Shared/infrastructure/queue/`

**Example Queue Definition:**
```typescript
// src/queues.ts
export const Queues = (): IDefinitionQueue[] => [
  {
    name: "SendEmailQueue",
    useClass: SendEmailWorker,
    inject: [EmailService.getInstance()],
    delay: 5000,
  },
]
```

**Queue Worker:**
```typescript
export class SendEmailWorker implements IQueue {
  constructor(private emailService: EmailService) {}

  async process(job: Job) {
    await this.emailService.send(job.data)
  }
}
```

---

## Testing Strategy

### Unit Tests (Domain & Application)
```typescript
// Test domain logic
describe("Church", () => {
  it("should create a church", () => {
    const church = Church.create("Test Church", "test@example.com")
    expect(church.getName()).toBe("Test Church")
  })
})

// Test use cases with mocks
describe("CreateChurch", () => {
  it("should create and persist a church", async () => {
    const mockRepo = {
      upsert: jest.fn(),
    } as unknown as IChurchRepository

    const useCase = new CreateChurch(mockRepo)
    await useCase.execute({ name: "Test", email: "test@example.com" })

    expect(mockRepo.upsert).toHaveBeenCalled()
  })
})
```

### Integration Tests
```typescript
import request from "supertest"
import { app } from "../app"

describe("POST /churches", () => {
  it("should create a church", async () => {
    const response = await request(app)
      .post("/churches")
      .send({ name: "Test Church", email: "test@example.com" })
      .expect(201)

    expect(response.body.churchId).toBeDefined()
  })
})
```

---

## Benefits of This Architecture

1. **Framework Independence**: Easy to migrate or swap frameworks
2. **Testability**: Pure domain logic without infrastructure concerns
3. **Maintainability**: Clear separation of concerns
4. **Scalability**: Bounded contexts can evolve independently
5. **Type Safety**: Full TypeScript coverage without decorators
6. **Explicit Dependencies**: No hidden DI container magic

---

## Anti-Patterns to Avoid

❌ **Don't put business logic in controllers**
❌ **Don't import infrastructure in domain**
❌ **Don't use repositories directly in controllers (use use cases)**
❌ **Don't instantiate infrastructure inside use cases** (e.g., calling `MongoRepository.getInstance()` or `StorageGCP.getInstance()` from a use case like `DeclareInstallmentPayment`. Inject repositories/adapters through the constructor and wire them in the controller/bootstrap layer.)
❌ **Don't mix HTTP concerns with business logic**
❌ **Don't use global state or singletons for domain entities**
❌ **Don't bypass the layered architecture**

---

For more details on specific layers:
- Database operations: See `DATABASE.md`
- Coding conventions: See `AGENTS.md`
