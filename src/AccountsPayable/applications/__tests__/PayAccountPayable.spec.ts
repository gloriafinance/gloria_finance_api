import { PayAccountPayable } from "../PayAccountPayable"
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
  AvailabilityAccount,
  AvailabilityAccountChurchMismatch,
  AvailabilityAccountNotFound,
  AccountType,
  FinancialConcept,
  ConceptType,
  StatementCategory,
} from "@/Financial/domain"
import { AmountValue, IQueueService, InstallmentsStatus } from "@/Shared/domain"
import { IAvailabilityAccountRepository } from "@/Financial/domain/interfaces"

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

const createRequest = (
  overrides: Partial<PayAccountPayableRequest> = {}
): PayAccountPayableRequest => ({
  accountPayableId: overrides.accountPayableId ?? "account-payable-1",
  costCenterId: overrides.costCenterId ?? "cost-center-1",
  installmentId: overrides.installmentId ?? "installment-1",
  installmentIds: overrides.installmentIds ?? ["installment-1"],
  financialTransactionId: overrides.financialTransactionId ?? "transaction-1",
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

  const useCase = new PayAccountPayable(
    availabilityAccountRepository,
    accountPayableRepository,
    queueService
  )

  beforeEach(() => {
    jest.clearAllMocks()
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
