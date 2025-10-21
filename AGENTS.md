# Engineering Guidelines

This repository implements a Domain-Driven Design (DDD) service-oriented architecture for the Church Financial API. Follow the conventions below when extending or modifying the codebase.

## Architectural Overview
- **Layered modules:** Each bounded context (e.g., `Church`, `Financial`, `SecuritySystem`) is split into `domain`, `applications`, and `infrastructure` folders under `src/`. This enforces separation between core business logic, use-case orchestration, and framework/IO concerns.
- **Shared utilities:** Cross-cutting concerns live under `src/Shared/` and are consumed via the `@/Shared/...` alias configured in `tsconfig.json`.
- **Entry points:** `src/app.ts` bootstraps the HTTP server and registers Express routers through `RoutesModule`, while `src/queues.ts` provides queue definitions consumed by `StartQueueService`.

## Domain Layer Practices
- **Entities and aggregates:** Domain models (for example, `src/Church/domain/Church.ts`) extend `AggregateRoot`, expose factory helpers such as `static create(...)` / `fromPrimitives(...)`, keep state in private fields, and provide intention-revealing setters/getters.
- **Pure domain code:** Domain classes and types must not import infrastructure code. Depend only on other domain modules, value objects, or shared helpers like `IdentifyEntity` or `DateBR`.
- **Typed requests and DTOs:** User-facing payloads are described with `*.request.ts` or `*.dto.type.ts` files (see `src/AccountsPayable/domain/requests/AccountPayable.request.ts` or `src/Church/domain/type/Church.dto.type.ts`). Reuse or extend these types rather than inlining ad-hoc objects.
- **Repository contracts:** Persistency abstractions live under `domain/interfaces` as `*.interface.ts` (e.g., `IChurchRepository`). Infrastructure must implement these contracts to keep the domain decoupled from data sources.
- **Exceptions:** Business errors extend `DomainException` (`src/Shared/domain/exceptions/domain-exception.ts`) and surface typed error codes/messages for the controllers. Throw domain exceptions instead of generic Errors when representing business validation issues.

## Application Layer Practices
- **Use-case classes:** Each action is implemented as a class with a single `execute(...)` method (e.g., `src/Church/applications/church/CreateOrUpdateChurch.ts`). Inject dependencies through the constructor using domain interfaces or shared services.
- **Logging:** Acquire contextual loggers through `Logger("UseCaseName")` from `src/Shared/adapter`. Log significant state transitions (registrations, updates) before delegating to repositories/services.
- **Orchestration only:** Application services coordinate domain entities, repository calls, and other application services (such as queue dispatchers). Avoid embedding HTTP or database code here.

## Infrastructure Layer Practices
- **Controllers and routes:** Express controllers (`*.controller.ts`) orchestrate application services and normalize responses via `domainResponse` (`src/Shared/helpers/domainResponse.ts`). Route definitions (`*.routes.ts` or `*.routers.ts`) register controllers and attach middlewares such as `PermissionMiddleware`.
- **Persistence adapters:** Concrete repositories (e.g., `ChurchMongoRepository`) live under `infrastructure/persistence`, extend `MongoRepository`, and implement domain interfaces. They follow the Singleton pattern via `getInstance()` to share MongoDB connections.
- **Queue workers:** Queue handlers implement `IQueue` and are wired through `IDefinitionQueue` entries in `src/queues.ts`. Provide `useClass`, `inject`, and optional `delay` settings when registering new workers.
- **Cross-service integrations:** Adapters such as the Google Cloud-aware logger or storage clients belong in `src/Shared/infrastructure` or `src/Shared/adapter`. Keep third-party SDK usage out of the domain layer.

## Error Handling and Background Processing
- **Standardized responses:** Use `domainResponse` in controllers to translate domain exceptions into `HttpStatus.BAD_REQUEST` responses and to push unexpected errors to the `QueueService` for Telegram notifications.
- **Queues and scheduling:** Initialize queues with `StartQueueService(server.getApp(), Queues())` in `src/app.ts`. Queue services manage lifecycle (`initialize`, `dispatch`, `shutdown`) through dedicated classes (`QueueRegistry`, `QueueProcessor`, `QueueDispatcher`).
- **Cron jobs:** Register recurring jobs via `src/Shared/infrastructure/schedule` modules. Keep scheduling definitions isolated from business logic.

## Naming and Coding Conventions
- **Classes & enums:** Use PascalCase filenames and declarations (e.g., `Church.ts`, `ChurchStatus.enum.ts`).
- **Interfaces & types:** Append `.interface.ts`, `.request.ts`, or `.dto.type.ts` to describe contracts and payloads. Keep property names in `camelCase` and prefer explicit type aliases over anonymous objects.
- **Controllers & routes:** Controllers end with `.controller.ts` and routes with `.routes.ts` or `.routers.ts` to clarify intent.
- **Repositories:** Persistence adapters should follow the `{Context}{Database}Repository.ts` convention (`ChurchMongoRepository.ts`).
- **Shared helpers:** Utilities in `src/Shared/helpers` expose named exports and are re-exported through `index.ts` to keep import paths consistent.
- **Path aliases:** Import project modules via the `@/` alias instead of relative paths (`import { QueueService } from "@/Shared/infrastructure"`).

## Tooling and Processes
- **Environment loading:** `dotenv/config` is required at the entry point. Define configuration through `.env` variables (e.g., `APP_PORT`).
- **Formatting:** Run `npm run format` / `npm run format:check` before committing. Respect Prettier defaults for TypeScript and Handlebars templates.
- **Build & runtime:** Compile with `npm run build`, which emits to `dist/` and copies static assets through `src/copyStaticAssets.ts`. Start development with `npm run dev` to enable `tsconfig-paths` and `nodemon` hot reload.

Adhering to these guidelines preserves the clear separation between domain logic, application orchestration, and infrastructure concerns that the project relies on.
