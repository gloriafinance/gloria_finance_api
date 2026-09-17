import { PayAccountReceivable } from "@/AccountsReceivable/applications/PayAccountReceivable"
import {
  AccountReceivable,
  AccountsReceivableStatus,
  IAccountsReceivableRepository,
  InstallmentNotFound,
  PayAccountReceivableNotFound,
} from "@/AccountsReceivable/domain"
import { AccountReceivableType } from "@/AccountsReceivable/domain/enums/AccountReceivableType.enum"
import {
  AvailabilityAccount,
  ConceptType,
  FinancialConcept,
  StatementCategory,
} from "@/Financial/domain"
import {
  IAvailabilityAccountRepository,
  IFinancialRecordRepository,
} from "@/Financial/domain/interfaces"
import { IQueueService } from "@/Shared/domain"
import { AmountValue, InstallmentsStatus } from "@/Shared/domain"

type AccountReceivablePrimitives = ReturnType<
  AccountReceivable["toPrimitives"]
> & {
  id?: string
}

const createConcept = (churchId = "church-1") =>
  FinancialConcept.fromPrimitives({
    id: "concept-db-id",
    financialConceptId: "concept-1",
    name: "Receivable",
    description: "Income concept",
    active: true,
    type: ConceptType.INCOME,
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

const createAccountReceivable = (
  overrides: Partial<AccountReceivablePrimitives> = {}
): AccountReceivable => {
  const { installments, ...rest } = overrides
  return AccountReceivable.fromPrimitives({
    id: "receivable-db-id",
    accountReceivableId: "receivable-1",
    churchId: "church-1",
    description: "Test receivable",
    amountTotal: 100,
    amountPaid: 0,
    amountPending: 100,
    status: AccountsReceivableStatus.PENDING,
    installments: installments ?? defaultInstallments(),
    createdAt: new Date(),
    updatedAt: new Date(),
    debtor: {
      debtorType: "PERSON" as any,
      debtorDNI: "123",
      name: "Debtor",
      phone: "999",
      email: "debtor@church.com",
      address: "address",
    },
    token: "token",
    contract: "",
    type: AccountReceivableType.CONTRIBUTION,
    financialConcept: createConcept(),
    createdBy: "user-1",
    ...rest,
  })
}

const createAvailabilityAccount = () =>
  AvailabilityAccount.fromPrimitives({
    availabilityAccountId: "availability-1",
    churchId: "church-1",
    accountName: "Main account",
    balance: 1000,
    active: true,
    accountType: "BANK" as any,
    lastMove: new Date(),
    createdAt: new Date(),
    source: { bankId: "bank-1" },
    symbol: "R$",
  })

const createRequest = (overrides: Partial<any> = {}) => ({
  accountReceivableId: overrides.accountReceivableId ?? "receivable-1",
  installmentId: overrides.installmentId ?? "installment-1",
  installmentIds: overrides.installmentIds ?? ["installment-1"],
  financialTransactionId: overrides.financialTransactionId ?? "tx-1",
  financialRecordId: overrides.financialRecordId,
  availabilityAccountId: overrides.availabilityAccountId ?? "availability-1",
  churchId: overrides.churchId ?? "church-1",
  amount: overrides.amount ?? AmountValue.create(100),
  date: overrides.date ?? new Date("2026-09-14T12:00:00.000Z"),
  file: overrides.file,
  voucher: overrides.voucher,
  concept: overrides.concept ?? "Receivable payment",
  createdBy: overrides.createdBy ?? "user-1",
})

describe("PayAccountReceivable", () => {
  const financialRecordRepository = {
    deleteByFinancialRecordId: jest.fn(),
    list: jest.fn(),
    one: jest.fn(),
    titheList: jest.fn(),
    fetchStatementCategories: jest.fn(),
    upsert: jest.fn(),
  } as unknown as jest.Mocked<IFinancialRecordRepository>

  const availabilityAccountRepository = {
    upsert: jest.fn(),
    one: jest.fn(),
    list: jest.fn(),
  } as unknown as jest.Mocked<IAvailabilityAccountRepository>

  const accountReceivableRepository = {
    list: jest.fn(),
    one: jest.fn(),
    upsert: jest.fn(),
  } as unknown as jest.Mocked<IAccountsReceivableRepository>

  const queueService = {
    dispatch: jest.fn(),
  } as jest.Mocked<IQueueService>

  let useCase: PayAccountReceivable

  beforeEach(() => {
    jest.clearAllMocks()
    accountReceivableRepository.one.mockResolvedValue(createAccountReceivable())
    availabilityAccountRepository.one.mockResolvedValue(
      createAvailabilityAccount()
    )
    useCase = new PayAccountReceivable(
      financialRecordRepository,
      availabilityAccountRepository,
      accountReceivableRepository,
      queueService
    )
  })

  it("throws PayAccountReceivableNotFound when account does not exist", async () => {
    accountReceivableRepository.one.mockResolvedValueOnce(undefined)

    await expect(useCase.execute(createRequest())).rejects.toBeInstanceOf(
      PayAccountReceivableNotFound
    )
  })

  it("throws InstallmentNotFound when installment does not exist", async () => {
    accountReceivableRepository.one.mockResolvedValueOnce(
      createAccountReceivable({
        installments: [
          {
            installmentId: "other",
            amount: 50,
            amountPaid: 0,
            amountPending: 50,
            dueDate: new Date(),
            status: InstallmentsStatus.PENDING,
          },
        ],
      })
    )

    await expect(useCase.execute(createRequest())).rejects.toBeInstanceOf(
      InstallmentNotFound
    )
    expect(accountReceivableRepository.upsert).toHaveBeenCalledTimes(1)
  })

  it("uses the payment date when dispatching the financial record", async () => {
    const date = new Date("2026-08-31T23:30:00.000Z")

    await useCase.execute(createRequest({ date }))

    expect(queueService.dispatch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ date })
    )
  })
})
