import { PayAccountPayable } from "@/AccountsPayable/applications/PayAccountPayable"
import {
  AccountPayable,
  AccountPayableChurchMismatch,
  AccountPayableNotFound,
  AccountPayableStatus,
  IAccountPayableRepository,
  InstallmentNotFound,
  PayAccountPayableRequest,
  SupplierType,
} from "@/AccountsPayable/domain"
import {
  AccountType,
  AvailabilityAccount,
  AvailabilityAccountChurchMismatch,
  AvailabilityAccountNotFound,
  ConceptType,
  CostCenter,
  CostCenterCategory,
  FinancialConcept,
  StatementCategory,
} from "@/Financial/domain"
import {
  IAvailabilityAccountRepository,
  IFinancialConceptRepository,
  IFinancialConfigurationRepository,
  IFinancialRecordRepository,
} from "@/Financial/domain/interfaces"
import { IFinancialYearRepository } from "@/ConsolidatedFinancial/domain"
import { AmountValue, InstallmentsStatus, IQueueService, IStorageService } from "@/Shared/domain"

type AccountPayablePrimitives = ReturnType<AccountPayable["toPrimitives"]> & {
  id?: string
  createdAt: Date
  updatedAt: Date
}

type AvailabilityAccountPrimitives = ReturnType<
  AvailabilityAccount["toPrimitives"]
> & {
  _id?: string
  lastMove?: Date
  createdAt: Date
  accountType: AccountType
}

const createConcept = (churchId = "church-1") =>
  FinancialConcept.fromPrimitives({
    id: "concept-db-id",
    financialConceptId: "concept-1",
    name: "Concept",
    description: "Payment concept",
    active: true,
    type: ConceptType.DISCHARGE,
    statementCategory: StatementCategory.OPEX,
    createdAt: new Date(),
    churchId,
  })

const defaultInstallments = () => [
  {
    installmentId: "installment-1",
    amount: 100,
    amountPaid: 0,
    amountPending: 100,
    dueDate: new Date(),
    status: InstallmentsStatus.PENDING,
  },
]

const createAccountPayable = (
  overrides: Partial<AccountPayablePrimitives> = {}
): AccountPayable => {
  const { installments, ...rest } = overrides
  return AccountPayable.fromPrimitives({
    id: "account-db-id",
    accountPayableId: "account-payable-1",
    churchId: "church-1",
    description: "Test account payable",
    amountTotal: 100,
    amountPaid: 0,
    amountPending: 100,
    status: AccountPayableStatus.PENDING,
    installments: installments ?? defaultInstallments(),
    createdAt: new Date(),
    updatedAt: new Date(),
    supplier: {
      supplierId: "supplier-1",
      supplierType: SupplierType.SUPPLIER,
      supplierDNI: "123456789",
      name: "Supplier",
      phone: "555-0100",
    },
    ...rest,
  })
}

const createAvailabilityAccount = (
  overrides: Partial<AvailabilityAccountPrimitives> = {}
): AvailabilityAccount => {
  const { lastMove, ...rest } = overrides
  return AvailabilityAccount.fromPrimitives({
    _id: "availability-db-id",
    availabilityAccountId: "availability-1",
    churchId: "church-1",
    accountName: "Main account",
    balance: 1000,
    active: true,
    accountType: AccountType.BANK,
    lastMove: lastMove ?? new Date(),
    createdAt: new Date(),
    source: { bankId: "bank-1" },
    symbol: "R$",
    ...rest,
  })
}

const createCostCenter = (
  overrides: Partial<ReturnType<CostCenter["toPrimitives"]>> = {}
): CostCenter =>
  CostCenter.fromPrimitives({
    costCenterId: "cost-center-1",
    name: "Main cost center",
    churchId: "church-1",
    active: true,
    category: CostCenterCategory.ESPECIAL_PROJECT,
    createdAt: new Date(),
    responsible: {
      name: "Responsible",
      email: "responsible@church.com",
      phone: "551199999999",
    },
    description: "",
    ...overrides,
  })

const createRequest = (
  overrides: Partial<PayAccountPayableRequest> = {}
): PayAccountPayableRequest => ({
  accountPayableId: overrides.accountPayableId ?? "account-payable-1",
  costCenterId: overrides.costCenterId ?? "cost-center-1",
  installmentId: overrides.installmentId ?? "installment-1",
  installmentIds: overrides.installmentIds ?? ["installment-1"],
  availabilityAccountId: overrides.availabilityAccountId ?? "availability-1",
  churchId: overrides.churchId ?? "church-1",
  amount: overrides.amount ?? AmountValue.create(100),
  file: overrides.file,
  voucher: overrides.voucher,
  concept: overrides.concept ?? createConcept(overrides.churchId ?? "church-1"),
})

describe("PayAccountPayable", () => {
  const accountPayableRepository = {
    one: jest.fn(),
    upsert: jest.fn(),
    list: jest.fn(),
  } as jest.Mocked<IAccountPayableRepository>

  const availabilityAccountRepository = {
    one: jest.fn(),
    upsert: jest.fn(),
    searchAvailabilityAccountsByChurchId: jest.fn(),
  } as jest.Mocked<IAvailabilityAccountRepository>

  const queueService = {
    dispatch: jest.fn(),
  } as jest.Mocked<IQueueService>

  const financialConceptRepository = {
    one: jest.fn(),
    listByCriteria: jest.fn(),
    upsert: jest.fn(),
  } as jest.Mocked<IFinancialConceptRepository>

  const financialConfigurationRepository = {
    findBankByBankId: jest.fn(),
    findCostCenterByCostCenterId: jest.fn(),
    upsertBank: jest.fn(),
    upsertCostCenter: jest.fn(),
    upsertFinancialConcept: jest.fn(),
    searchBanksByChurchId: jest.fn(),
    searchCenterCostsByChurchId: jest.fn(),
  } as unknown as jest.Mocked<IFinancialConfigurationRepository>

  const financialRecordRepository = {
    upsert: jest.fn(),
    deleteByFinancialRecordId: jest.fn(),
    fetch: jest.fn(),
    one: jest.fn(),
    titheList: jest.fn(),
    fetchAvailableAccounts: jest.fn(),
    fetchCostCenters: jest.fn(),
    fetchStatementCategories: jest.fn(),
  } as unknown as jest.Mocked<IFinancialRecordRepository>

  const financialYearRepository = {
    one: jest.fn(),
    upsert: jest.fn(),
  } as jest.Mocked<IFinancialYearRepository>

  const storageService = {
    uploadFile: jest.fn(),
    deleteFile: jest.fn(),
    downloadFile: jest.fn(),
    setBucketName: jest.fn(),
  } as jest.Mocked<IStorageService>

  let useCase: PayAccountPayable

  beforeEach(() => {
    jest.clearAllMocks()

    financialConceptRepository.one.mockResolvedValue(createConcept())
    ;(
      financialConfigurationRepository.findCostCenterByCostCenterId as jest.Mock
    ).mockResolvedValue(createCostCenter())
    ;(financialRecordRepository.upsert as jest.Mock).mockResolvedValue(
      undefined
    )
    ;(
      financialRecordRepository.deleteByFinancialRecordId as jest.Mock
    ).mockResolvedValue(undefined)
    financialYearRepository.one.mockResolvedValue({
      isClosed: () => false,
    } as any)
    availabilityAccountRepository.one.mockResolvedValue(
      createAvailabilityAccount()
    )
    storageService.uploadFile.mockResolvedValue("uploaded-voucher")
    storageService.deleteFile.mockResolvedValue(undefined)
    storageService.downloadFile.mockResolvedValue("download")

    useCase = new PayAccountPayable(
      availabilityAccountRepository,
      accountPayableRepository,
      queueService,
      financialConceptRepository,
      financialConfigurationRepository,
      financialRecordRepository,
      financialYearRepository,
      storageService
    )
  })

  it("throws AccountPayableNotFound when the account does not exist", async () => {
    accountPayableRepository.one.mockResolvedValueOnce(null)

    await expect(useCase.execute(createRequest())).rejects.toBeInstanceOf(
      AccountPayableNotFound
    )
  })

  it("throws AccountPayableChurchMismatch when the church does not match", async () => {
    accountPayableRepository.one.mockResolvedValueOnce(createAccountPayable())

    const request = createRequest({ churchId: "church-2" })

    await expect(useCase.execute(request)).rejects.toBeInstanceOf(
      AccountPayableChurchMismatch
    )
  })

  it("throws AvailabilityAccountNotFound when the availability account is missing", async () => {
    accountPayableRepository.one.mockResolvedValueOnce(createAccountPayable())
    availabilityAccountRepository.one.mockResolvedValueOnce(undefined)

    await expect(useCase.execute(createRequest())).rejects.toBeInstanceOf(
      AvailabilityAccountNotFound
    )
  })

  it("throws AvailabilityAccountChurchMismatch when the availability account belongs to another church", async () => {
    accountPayableRepository.one.mockResolvedValueOnce(createAccountPayable())
    availabilityAccountRepository.one.mockResolvedValueOnce(
      createAvailabilityAccount({ churchId: "church-2" })
    )

    await expect(useCase.execute(createRequest())).rejects.toBeInstanceOf(
      AvailabilityAccountChurchMismatch
    )
  })

  it("throws InstallmentNotFound when attempting to pay an unknown installment", async () => {
    accountPayableRepository.one.mockResolvedValueOnce(createAccountPayable())
    availabilityAccountRepository.one.mockResolvedValueOnce(
      createAvailabilityAccount()
    )

    const request = createRequest({ installmentIds: ["unknown-installment"] })

    await expect(useCase.execute(request)).rejects.toBeInstanceOf(
      InstallmentNotFound
    )
  })
})
