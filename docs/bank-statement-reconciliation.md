# Bank Statement Reconciliation Flow

This document describes how the banking reconciliation pipeline works across the Church Financial API layers, from the HTTP entry point to background processing and manual interventions.

## HTTP Endpoints

The reconciliation surface exposes four endpoints under `/api/v1/finance/bank-statements`:

| Method & Path | Purpose | Controller |
| --- | --- | --- |
| `POST /import` | Uploads a bank statement file and queues the import job. | `importBankStatementController` |
| `GET /` | Lists statements with filters for status, date range, bank, and church. | `listBankStatementsController` |
| `POST /{bankStatementId}/retry` | Re-attempts automatic reconciliation on a previously imported statement. | `retryBankStatementController` |
| `PATCH /{bankStatementId}/link` | Manually links a statement to a specific financial record. | `linkBankStatementController` |

All routes are mounted with `PermissionMiddleware`, authenticating the user context (`req["user"]`) and enforcing church scoping rules (superusers may pass `churchId`).

## Upload & Queueing

1. **Request validation** — `ImportBankStatementValidator` ensures `bank`, `month`, `year`, and the multipart `file` field are present; `churchId` is optional for superusers.
2. **Use case orchestration** — `ImportBankStatement.execute` (application layer) sanitizes the filename, persists a temp copy under `${os.tmpdir()}/church-finance-api/bank-statements`, and dispatches a payload to `QueueName.ImportBankStatementJob`. The payload carries metadata (church, bank, account name, reference period) and the safe `filePath`.
3. **HTTP response** — The controller returns HTTP `202 Accepted` with the enqueued context (`queuedAt`, `bank`, `month`, `year`, `churchId`).

## Background Job Processing

1. **Queue binding** — `BankingQueue` registers `ImportBankStatementJob` with dependencies: `BankStatementParserFactory`, `BankStatementMongoRepository`, `BankStatementReconciler`, and the shared `QueueService`.
2. **Job execution** — When the worker receives the job:
   - `ImportBankStatementJob.handle` uses the provided local `filePath` and resolves a parser via `BankStatementParserFactory` (currently `NubankCsvParser`).
   - The parser yields `IntermediateBankStatement` records, which are deduplicated by `fitId` and content hash before persisting through `BankStatementMongoRepository.bulkInsert`.
3. **Automatic reconciliation** — The job calls `BankStatementReconciler.reconcile` for each inserted statement:
   - It searches `FinanceRecordMongoRepository` for candidate financial records matching church, amount, direction, status (`PENDING`/`CLEARED`), date tolerance (`postedAt ±1 day`), and optional account name.
   - On match, the statement transitions to `RECONCILED`, persists the status/hash, and triggers `DispatchUpdateStatusFinancialRecord` to mark the financial record as reconciled.
   - On no match, the statement is marked `UNMATCHED` for manual handling.
4. **Notifications** — Job completion sends a summary to `QueueName.TelegramNotification` (total lines, inserted count, duplicates, auto reconciled, pending).
5. **Cleanup** — Temporary files are removed on success/failure via `fs.unlink`.

## Listing & Filtering

`listBankStatementsController` exposes GET `/api/v1/finance/bank-statements`, accepting optional filters:

- `bank`, `status`, `month`, `year`, `dateFrom`, `dateTo`, and (for superusers) `churchId`.
- Responses are serialized via `statement.toPrimitives()`, ensuring ISO date strings for `postedAt`, `createdAt`, `updatedAt`, and `reconciledAt`.

This endpoint powers dashboards and manual reconciliation queues in the frontend.

## Manual Recovery Paths

### Retry Automatic Reconciliation

- Endpoint: `POST /api/v1/finance/bank-statements/{bankStatementId}/retry`
- Controller invokes `RetryBankStatementReconciliation.execute`, which fetches the statement and re-runs `BankStatementReconciler.reconcile`.
- Returns `{ matched: boolean, financialRecordId?: string }`.

### Manual Linking

- Endpoint: `PATCH /api/v1/finance/bank-statements/{bankStatementId}/link`
- Input: `{ financialRecordId }`.
- The controller executes `LinkBankStatementToFinancialRecord`, associating the statement with a specific record, updating repositories, and dispatching notifications.
- Response confirms `{ reconciled: true, bankStatementId, financialRecordId }`.

## Domain Persistence Model

`BankStatement` aggregates capture:

- Identifiers (`bankStatementId`, `fitId`, `hash`)
- Context (`churchId`, `bank`, `accountName`, `month`, `year`)
- Financial data (`postedAt`, `direction`, `amount`, `description`)
- Reconciliation metadata (`reconciliationStatus`, `financialRecordId`, `reconciledAt`, `raw`)

Repositories enforce uniqueness via `findByFitId`/`findByHash` checks before inserts.

## Error Handling & Logging

- HTTP controllers standardize errors through `domainResponse`, returning `HttpStatus.BAD_REQUEST`/`422` on validation issues.
- Application and job layers emit structured logs via `Logger(<ClassName>)`, aiding observability in queue processing and reconciliation outcomes.

## Frontend Integration Checklist

1. **Upload form** — Send `multipart/form-data` with `file`, `bank`, `month`, `year`, optional `accountName`; handle `202 Accepted`.
2. **Progress UI** — Poll `GET /api/v1/finance/bank-statements` filtered by church/bank to surface `PENDING`/`UNMATCHED` statements.
3. **Manual reconciliation** — Provide actions for:
   - `POST /{id}/retry` to reprocess.
   - `PATCH /{id}/link` with a selected `financialRecordId`.
4. **Auth** — Include the bearer token (JWT) in every request header (`Authorization: Bearer <token>`).

This flow ensures uploads are processed asynchronously, reconciled where possible, and surfaced for manual operations when required.
