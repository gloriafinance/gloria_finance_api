# Database Guide - MongoDB with @abejarano/ts-mongodb-criteria

This document explains how to work with MongoDB in this DDD project using the custom `@abejarano/ts-mongodb-criteria` library.

---

## Overview

The `@abejarano/ts-mongodb-criteria` library provides:
- **Type-safe query building** with the Criteria pattern
- **Base repository classes** that encapsulate MongoDB operations
- **Pagination support** out of the box
- **Domain entity integration** through `AggregateRoot`

---

## Core Concepts

### 1. AggregateRoot

All domain entities extend `AggregateRoot` from the library:

```typescript
import { AggregateRoot } from "@abejarano/ts-mongodb-criteria"

export class States extends AggregateRoot {
  private id?: string
  private countryId: string
  private name: string

  static fromPrimitives(plainData: any): States {
    const s = new States()
    s.id = plainData.id
    s.countryId = plainData.countryId
    s.name = plainData.name
    return s
  }

  toPrimitives(): any {
    return {
      countryId: this.countryId,
      name: this.name,
    }
  }
}
```

### 2. MongoRepository<T>

Base class for all MongoDB repositories. Provides:
- Connection management
- Collection access via `collection()` method
- Common CRUD operations
- Criteria-based querying

```typescript
import { MongoRepository } from "@abejarano/ts-mongodb-criteria"

export class ChurchMongoRepository extends MongoRepository<Church> {
  collectionName(): string {
    return "churches"
  }
}
```

### 3. Criteria Pattern

The `Criteria` class encapsulates query logic:

```typescript
import { Criteria, Filters, Order, OrderTypes } from "@abejarano/ts-mongodb-criteria"

const criteria = new Criteria(
  filters,      // Filters object
  order,        // Order object
  perPage,      // Number of results per page
  page          // Current page number
)
```

---

## Building Queries

### Simple Equality Filter

```typescript
import { Criteria, Filters, Operator } from "@abejarano/ts-mongodb-criteria"

const filters = []
filters.push(
  new Map([
    ["field", "churchId"],
    ["operator", Operator.EQUAL],
    ["value", "church-123"],
  ])
)

const criteria = new Criteria(
  Filters.fromValues(filters),
  null,  // No ordering
  20,    // 20 results per page
  1      // Page 1
)
```

### Date Range Filters

```typescript
if (request.startDate) {
  filters.push(
    new Map([
      ["field", "createdAt"],
      ["operator", Operator.GTE],
      ["value", new Date(request.startDate)],
    ])
  )
}

if (request.endDate) {
  filters.push(
    new Map([
      ["field", "createdAt"],
      ["operator", Operator.LTE],
      ["value", new Date(request.endDate)],
    ])
  )
}
```

### OR Conditions (Search)

```typescript
import { OrCondition, Operator } from "@abejarano/ts-mongodb-criteria"

const searchConditions: OrCondition[] = [
  { field: "name", operator: Operator.CONTAINS, value: searchTerm },
  { field: "code", operator: Operator.CONTAINS, value: searchTerm },
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

### Ordering Results

```typescript
import { Order, OrderTypes } from "@abejarano/ts-mongodb-criteria"

// Descending order by createdAt
const order = Order.fromValues("createdAt", OrderTypes.DESC)

// Ascending order by name
const order = Order.fromValues("name", OrderTypes.ASC)

const criteria = new Criteria(
  Filters.fromValues(filters),
  order,
  20,
  1
)
```

---

## Repository Implementation

### Implementing Domain Interfaces

```typescript
// Domain interface
export interface ISupplierRepository {
  upsert(supplier: Supplier): Promise<void>
  list(criteria: Criteria): Promise<Paginate<Supplier>>
  one(filter: object): Promise<Supplier | null>
  all(churchId: string): Promise<Supplier[]>
}

// Infrastructure implementation
export class SupplierMongoRepository
  extends MongoRepository<Supplier>
  implements ISupplierRepository
{
  private static instance: SupplierMongoRepository

  static getInstance(): SupplierMongoRepository {
    if (!this.instance) {
      this.instance = new SupplierMongoRepository()
    }
    return this.instance
  }

  collectionName(): string {
    return "suppliers"
  }

  async upsert(supplier: Supplier): Promise<void> {
    const collection = await this.collection()
    await collection.updateOne(
      { supplierId: supplier.getSupplierId() },
      { $set: supplier.toPrimitives() },
      { upsert: true }
    )
  }

  async list(criteria: Criteria): Promise<Paginate<Supplier>> {
    return await this.fetch(criteria)  // Inherited from MongoRepository
  }

  async one(filter: object): Promise<Supplier | null> {
    const collection = await this.collection()
    const document = await collection.findOne(filter)
    return document ? Supplier.fromPrimitives({ ...document, id: document._id }) : null
  }

  async all(churchId: string): Promise<Supplier[]> {
    const collection = await this.collection()
    const documents = await collection.find({ churchId }).toArray()
    return documents.map(doc => Supplier.fromPrimitives({ ...doc, id: doc._id }))
  }
}
```

### Using the Native MongoDB Driver

The `collection()` method returns the native MongoDB collection, allowing direct operations:

```typescript
async customQuery(): Promise<Church[]> {
  const collection = await this.collection()
  
  // Use native MongoDB methods
  const documents = await collection
    .find({ status: "active" })
    .sort({ name: 1 })
    .limit(10)
    .toArray()
  
  return documents.map(doc => Church.fromPrimitives({ ...doc, id: doc._id }))
}

async aggregateData(): Promise<any[]> {
  const collection = await this.collection()
  
  return await collection.aggregate([
    { $match: { churchId: "church-123" } },
    { $group: { _id: "$category", total: { $sum: "$amount" } } },
  ]).toArray()
}
```

---

## Pagination

### Paginate<T> Response

All paginated queries return a `Paginate<T>` object:

```typescript
{
  count: 150,           // Total number of records
  nextPag: 2,           // Next page number (or null if last page)
  results: [...]        // Array of domain entities
}
```

### Usage in Application Services

```typescript
export class ListContributions {
  constructor(private readonly repo: IOnlineContributionsRepository) {}

  async execute(filter: FilterContributionsRequest) {
    const criteria = this.prepareCriteria(filter)
    return await this.repo.findByCriteria(criteria)  // Returns Paginate<Contribution>
  }
}
```

### Usage in Controllers

```typescript
const result = await listContributions.execute(request)

// Transform for HTTP response
return res.json({
  total: result.count,
  page: request.page,
  perPage: request.perPage,
  nextPage: result.nextPag,
  data: result.results.map(c => c.toPrimitives()),
})
```

---

## Available Operators

| Operator | MongoDB Equivalent | Usage |
|----------|-------------------|-------|
| `Operator.EQUAL` | `$eq` | Exact match |
| `Operator.NOT_EQUAL` | `$ne` | Not equal |
| `Operator.GT` | `$gt` | Greater than |
| `Operator.GTE` | `$gte` | Greater than or equal |
| `Operator.LT` | `$lt` | Less than |
| `Operator.LTE` | `$lte` | Less than or equal |
| `Operator.IN` | `$in` | Value in array |
| `Operator.NOT_IN` | `$nin` | Value not in array |
| `Operator.CONTAINS` | `$regex` | Partial string match |
| `Operator.OR` | `$or` | Logical OR |

---

## Connection Management

MongoDB connections are managed automatically by the `MongoRepository` base class. Configuration is typically loaded from environment variables:

```typescript
// In your MongoDB connection setup (usually in Shared/infrastructure)
const mongoUri = process.env.MONGODB_URI
const mongoDatabase = process.env.MONGODB_DATABASE
```

The repository base class handles:
- Connection pooling
- Automatic reconnection
- Connection sharing across repositories (via singleton pattern)

---

## Best Practices

1. **Always use Criteria for queries**: Avoid direct MongoDB queries in application services
2. **Map at the infrastructure boundary**: Convert MongoDB documents to domain entities immediately after retrieval
3. **Use fromPrimitives/toPrimitives**: Keep mapping logic in domain entities
4. **Singleton repositories**: Ensure each repository uses `getInstance()` pattern
5. **Type safety**: Leverage TypeScript's type system with Criteria builders
6. **Pagination**: Always paginate list queries to avoid memory issues
7. **Indexing**: Create appropriate MongoDB indexes for fields used in queries

---

## Example: Complete Query Flow

### 1. Request (HTTP Layer)
```typescript
const request: FilterPurchasesRequest = {
  churchId: "church-123",
  startDate: "2025-01-01",
  endDate: "2025-12-31",
  page: 1,
  perPage: 20,
}
```

### 2. Application Service
```typescript
export class SearchPurchase {
  constructor(private readonly repository: IPurchaseRepository) {}

  async execute(request: FilterPurchasesRequest): Promise<Paginate<Purchase>> {
    const criteria = this.prepareCriteria(request)
    return await this.repository.fetch(criteria)
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

    if (request.startDate) {
      filters.push(
        new Map([
          ["field", "purchaseDate"],
          ["operator", Operator.GTE],
          ["value", new Date(request.startDate)],
        ])
      )
    }

    if (request.endDate) {
      filters.push(
        new Map([
          ["field", "purchaseDate"],
          ["operator", Operator.LTE],
          ["value", new Date(request.endDate)],
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

### 3. Repository
```typescript
export class PurchaseMongoRepository extends MongoRepository<Purchase> {
  collectionName(): string {
    return "purchases"
  }

  // fetch() method is inherited from MongoRepository
}
```

### 4. Response
```typescript
{
  count: 45,
  nextPag: 2,
  results: [
    Purchase { /* domain entity */ },
    Purchase { /* domain entity */ },
    // ... 18 more
  ]
}
```

---

## Common Patterns

### Pattern 1: Simple List with Pagination
```typescript
const criteria = new Criteria(
  Filters.fromValues([]),  // No filters
  Order.fromValues("createdAt", OrderTypes.DESC),
  20,
  1
)
```

### Pattern 2: Filtered List
```typescript
const filters = [
  new Map([["field", "status"], ["operator", Operator.EQUAL], ["value", "active"]]),
  new Map([["field", "churchId"], ["operator", Operator.EQUAL], ["value", churchId]]),
]
const criteria = new Criteria(Filters.fromValues(filters), null, 20, 1)
```

### Pattern 3: Search with Multiple Fields
```typescript
const searchConditions: OrCondition[] = [
  { field: "name", operator: Operator.CONTAINS, value: term },
  { field: "email", operator: Operator.CONTAINS, value: term },
  { field: "phone", operator: Operator.CONTAINS, value: term },
]
filters.push(
  new Map([["field", "search"], ["operator", Operator.OR], ["value", searchConditions]])
)
```

---

For more information, refer to the `@abejarano/ts-mongo-criteria` repository or examine existing repositories in `src/*/infrastructure/persistence/`.