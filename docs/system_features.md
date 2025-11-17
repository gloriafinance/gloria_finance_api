# Church Finance API – Functional Feature Catalog

## Church Management

- Register and update church records, including address, contact details, status, and opening data, creating new entries
  when no `churchId` is supplied and editing existing congregations otherwise.【F:
  src/Church/applications/church/CreateOrUpdateChurch.ts†L1-L86】
- Search congregations with pagination and filters by region or status, retrieve congregations tied to a district, and
  list those operating without an assigned minister to streamline oversight.【F:
  src/Church/applications/church/SearchChurches.ts†L1-L54】【F:
  src/Church/applications/church/SearchChurchesByDistrictId.ts†L1-L8】【F:
  src/Church/applications/church/WithoutAssignedMinister.ts†L1-L8】
- Manage members by creating or updating profiles, synchronizing church affiliation, triggering background user
  provisioning, and exposing paginated searches scoped by region or church.【F:
  src/Church/applications/members/CreateOrUpdateMember.ts†L1-L90】【F:
  src/Church/applications/members/SearchMembers.ts†L1-L50】
- Oversee minister assignments by registering or updating clergy, attaching them to churches while enforcing exclusivity
  rules, and removing ministers when congregations become vacant.【F:
  src/Church/applications/ministers/RegisterOrUpdateMinister.ts†L1-L31】【F:
  src/Church/applications/ministers/AssignChurch.ts†L1-L44】【F:
  src/Church/applications/ministers/RemoveMinister.ts†L1-L35】

## Accounts Payable

- Register new suppliers with duplicate detection and list all suppliers for a church to maintain a clean vendor
  catalog.【F:src/AccountsPayable/applications/RegisterSuppliers.ts†L1-L32】【F:
  src/AccountsPayable/applications/AllSupplier.ts†L1-L9】
- Create accounts payable entries with validated supplier data, plus paginated listings filtered by church, status, and
  date range for operational visibility.【F:src/AccountsPayable/applications/CreateAccountPayable.ts†L1-L47】【F:
  src/AccountsPayable/applications/ListAccountsPayable.ts†L1-L77】
- Reconcile payable installments by locating the liability, validating cost centers and availability accounts, updating
  installments, and emitting linked financial records with rollback protection.【F:
  src/AccountsPayable/applications/PayAccountPayable.ts†L1-L142】

## Accounts Receivable

- Register receivables after validating their financial concept, auto-accept contributions, and trigger commitment
  emails for other receivable types.【F:src/AccountsReceivable/applications/CreateAccountReceivable.ts†L1-L73】
- Provide paginated receivable searches with filters for church, status, and period to support collection workflows.【F:
  src/AccountsReceivable/applications/ListAccountReceivable.ts†L1-L83】
- Manage payment commitments by locating the pending agreement, marking acceptance or rejection, and generating signed
  PDF contracts for accepted cases.【F:src/AccountsReceivable/applications/ConfirmOrDenyPaymentCommitment.ts†L1-L101】
- Apply incoming payments by validating installments, updating balances, and dispatching the associated financial record
  entries.【F:src/AccountsReceivable/applications/PayAccountReceivable.ts†L1-L116】

## Financial Configuration and Operations

- Create, update, or bootstrap financial concepts for each church, including first-time loads from fixture data, while
  enforcing church existence and tracking impact flags.【F:
  src/Financial/applications/financialConcept/CreateOrUpdateFinancialConcept.ts†L1-L82】【F:
  src/Financial/applications/financialConcept/FirstLoadFinancialConcepts.ts†L1-L60】【F:
  src/Financial/applications/financialConfiguration/InitialLoadingFinancialConcepts.ts†L1-L48】
- Manage availability accounts by creating or editing account definitions, validating access by church, and queueing
  balance updates with optional bank movement mirroring.【F:
  src/Financial/applications/availabilityAccount/CreateOrUpdateAvailabilityAccount.ts†L1-L51】【F:
  src/Financial/applications/availabilityAccount/FindAvailabilityAccountByAvailabilityAccountId.ts†L1-L44】【F:
  src/Financial/applications/DispatchUpdateAvailabilityAccountBalance.ts†L1-L44】【F:
  src/Financial/applications/availabilityAccount/UpdateAvailabilityAccountBalance.ts†L1-L44】
- Maintain cost centers by registering new records with responsible members, updating existing centers, and searching
  the catalog by church.【F:src/Financial/applications/costCenter/CreateCostCenter.ts†L1-L62】【F:
  src/Financial/applications/costCenter/UpdateCostCenter.ts†L1-L59】【F:
  src/Financial/applications/costCenter/SearchCostCenterByChurchId.ts†L1-L14】

## Financial Records and Reporting

- Dispatch and persist financial records with voucher handling, cost center impact updates, and availability balance
  adjustments once transactions clear.【F:src/Financial/applications/DispatchCreateFinancialRecord.ts†L1-L14】【F:
  src/Financial/applications/financeRecord/CreateFinancialRecord.ts†L1-L141】
- Cancel outgo records by validating financial periods, reversing movements, and updating downstream aggregates and
  statuses.【F:src/Financial/applications/financeRecord/CancelFinancialRecord.ts†L1-L134】
- Generate detailed financial record reports in CSV or PDF with aggregated summaries, fetching paginated data batches
  transparently.【F:src/Financial/applications/financeRecord/GenerateFinanceRecordReport.ts†L1-L200】
- Record online contributions by validating open financial months, storing vouchers, listing contributions with flexible
  filters, and finalizing processed donations by updating balances and financial records.【F:
  src/Financial/applications/contribution/RegisterContributionsOnline.ts†L1-L56】【F:
  src/Financial/applications/contribution/ListContributions.ts†L1-L92】【F:
  src/Financial/applications/contribution/UpdateContributionStatus.ts†L1-L78】

## Consolidated Financial Control

- Generate yearly financial months for each church and validate whether periods remain open before accepting new
  movements.【F:src/ConsolidatedFinancial/applications/GenerateFinancialMonths.ts†L1-L17】【F:
  src/ConsolidatedFinancial/applications/FinancialMonthValidator.ts†L1-L33】

## Banking

- Create or update bank configurations tied to churches, list bank accounts per congregation, and record movement
  entries through queue handlers.【F:src/Banking/applications/CreateOrUpdateBank.ts†L1-L37】【F:
  src/Banking/applications/SearchBankByChurchId.ts†L1-L10】【F:src/Banking/applications/MovementBankRecord.ts†L1-L34】
- Import, list, and reconcile bank statements by queueing uploads, applying rich filters, auto-matching records, and
  updating reconciliation status with linked financial records.【F:
  src/Banking/applications/bankStatement/ImportBankStatement.ts†L1-L105】【F:
  src/Banking/applications/bankStatement/ListBankStatements.ts†L1-L122】【F:
  src/Banking/applications/BankStatementReconciler.ts†L1-L120】

## Purchases

- Record purchase orders by validating availability accounts and cost centers, storing invoices, and dispatching
  outbound financial records with status aligned to account type.【F:src/Purchases/applications/RecordPurchase.ts†L1-L63】
- Provide paginated purchase searches filtered by church and purchase dates.【F:
  src/Purchases/applications/SearchPurchase.ts†L1-L41】

## Patrimony (Asset Management)

- Create, update, fetch, list, and dispose of assets with attachment handling, responsible member validation, and status
  management.【F:src/Patrimony/applications/CreateAsset.ts†L1-L52】【F:src/Patrimony/applications/UpdateAsset.ts†L1-L98】【F:
  src/Patrimony/applications/GetAsset.ts†L1-L25】【F:src/Patrimony/applications/ListAssets.ts†L1-L66】【F:
  src/Patrimony/applications/DisposeAsset.ts†L1-L31】
- Support inventory control by recording on-site checks, importing CSV results with email summaries, and generating
  inventory or physical checklist reports in CSV/PDF formats.【F:
  src/Patrimony/applications/RecordAssetInventory.ts†L1-L40】【F:
  src/Patrimony/applications/ProcessInventoryFromFileJob.ts†L1-L200】【F:
  src/Patrimony/applications/GenerateInventoryReport.ts†L1-L149】【F:
  src/Patrimony/applications/GeneratePhysicalInventorySheet.ts†L1-L111】

## Reporting and Analytics

- Produce monthly tithes summaries sourced from financial records and build income statements that aggregate
  availability accounts, cost centers, and statement categories.【F:src/Reports/applications/MonthlyTithes.ts†L1-L18】【F:
  src/Reports/applications/IncomeStatement.ts†L1-L128】

## Notifications and Communications

- Send payment commitment emails with templated context and queue-based delivery, plus issue password reset
  notifications with temporary credentials.【F:src/SendMail/applications/SendMailPaymentCommitment.ts†L1-L33】【F:
  src/SendMail/applications/SendMailChangePassword.ts†L1-L19】

## Geographic Catalogs

- Retrieve country-specific state lists via the world catalog service, supporting location-driven workflows.【F:
  src/World/applications/FindStateByCountryId.ts†L1-L7】
