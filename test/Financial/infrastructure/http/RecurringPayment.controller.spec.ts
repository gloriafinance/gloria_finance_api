// StorageProviderService.getInstance() is invoked at module load time by some
// transitive dependency (Financal.queue.ts). Configure the env so it does not
// blow up before any test runs.
process.env.BUCKET_FILES = "test-bucket"
process.env.CLOUD_PROVIDER = "gcp"

import { AccountType } from "@/FinanceConfig/domain"
import { AvailabilityAccount } from "@/Financial/domain"
import { AvailabilityAccountMongoRepository } from "@/FinanceConfig/infrastructure/presistence/AvailabilityAccountMongoRepository"
import { Bank } from "@/Banking/domain"
import { BankMongoRepository } from "@/Banking/infrastructure/persistence/BankMongoRepository"
import { ChurchBankingClient } from "@/Banking/infrastructure/church-banking/ChurchBankingClient"
import { ChurchBankingClientError } from "@/Banking/domain/exceptions/ChurchBankingClient.exception"
import { FinanceRecordMongoRepository } from "@/Financial/infrastructure/persistence/FinanceRecordMongoRepository"
import { RecurringPayments } from "@/Financial/domain/RecurringPayments"
import { RecurringPaymentController } from "@/Financial/infrastructure/http/controllers/RecurringPayment.controller"
import { RecurringPaymentsMongoRepository } from "@/Financial/infrastructure/persistence/RecurringPaymentsMongoRepository"
import {
  FinancialConceptMongoRepository,
  FinancialConfigurationMongoRepository,
} from "@/FinanceConfig/infrastructure/presistence"
import { FinancialYearMongoRepository } from "@/ConsolidatedFinancial/infrastructure"
import { Provider } from "@/Banking/domain/enums/Provider.enum"
import { QueueService } from "@/package/queue/infrastructure/QueueService"
import { StorageProviderService } from "@/Shared/infrastructure"

// The controller builds the client itself; `jose` is ESM-only and jest runs as
// CommonJS, so the import is stubbed and the provider call is spied instead.
jest.mock("jose", () => ({
  CompactEncrypt: class {},
  SignJWT: class {},
  importJWK: jest.fn(),
}))

jest.mock("@google-cloud/storage", () => ({
  Storage: jest.fn(),
}))

// CostCenterMasterMongoRepository.getInstance() is invoked at module load time
// by Financal.queue.ts. Mock it to avoid a circular-dependency initialization
// error unrelated to register-payment behavior.
jest.mock(
  "@/Financial/infrastructure/persistence/CostCenterMasterMongoRepository",
  () => ({
    CostCenterMasterMongoRepository: {
      getInstance: jest.fn(),
    },
  })
)

function makeResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    send: jest.fn(),
  }
}

const recurrence = RecurringPayments.fromPrimitives({
  recurringPaymentId: "recurring-1",
  churchId: "church-1",
  financialConceptId: "concept-1",
  costCenterId: "cost-center-1",
  name: "Energy",
  type: "VARIABLE",
  dayOfMonth: 10,
  status: "ACTIVE",
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe("RecurringPaymentController.simulateBill", () => {
  it("simulates with the church of the authenticated request and returns the snapshot", async () => {
    const one = jest.fn().mockResolvedValue(recurrence)
    jest
      .spyOn(RecurringPaymentsMongoRepository, "getInstance")
      .mockReturnValue({ one } as never)
    const snapshot = {
      minimumScheduleDate: "2026-10-02",
      feeInCents: 0,
      bankSlip: { valueInCents: 74283, beneficiaryName: "Fornecedor" },
    }
    const simulateBill = jest
      .spyOn(ChurchBankingClient.prototype, "simulateBill")
      .mockResolvedValue(snapshot)
    const response = makeResponse()

    await new RecurringPaymentController().simulateBill(
      "recurring-1",
      { identificationField: "0339920159510052904014760030102388844" },
      { auth: { churchId: "church-1" } } as never,
      response as never
    )

    expect(one).toHaveBeenCalledWith({
      recurringPaymentId: "recurring-1",
      churchId: "church-1",
      status: "ACTIVE",
    })
    expect(simulateBill).toHaveBeenCalledWith({
      externalAccountId: "church-1",
      identificationField: "0339920159510052904014760030102388844",
    })
    expect(response.status).toHaveBeenCalledWith(200)
    expect(response.send).toHaveBeenCalledWith(snapshot)
  })

  it("answers a domain error when the recurrence is not payable", async () => {
    jest
      .spyOn(RecurringPaymentsMongoRepository, "getInstance")
      .mockReturnValue({ one: jest.fn().mockResolvedValue(undefined) } as never)
    const simulateBill = jest.spyOn(
      ChurchBankingClient.prototype,
      "simulateBill"
    )
    const response = makeResponse()

    await new RecurringPaymentController().simulateBill(
      "recurring-1",
      { barCode: "03391815100000029909777729900000000475110101" },
      { auth: { churchId: "church-1" } } as never,
      response as never
    )

    expect(simulateBill).not.toHaveBeenCalled()
    expect(response.status).toHaveBeenCalledWith(400)
    expect(response.send).toHaveBeenCalledWith({
      code: "RECURRING_PAYMENT_NOT_FOUND",
      message: "Recurring payment not found",
    })
  })

  it("keeps a provider outage as an outage", async () => {
    jest
      .spyOn(RecurringPaymentsMongoRepository, "getInstance")
      .mockReturnValue({
        one: jest.fn().mockResolvedValue(recurrence),
      } as never)
    jest
      .spyOn(ChurchBankingClient.prototype, "simulateBill")
      .mockRejectedValue(
        new ChurchBankingClientError(503, "SIMULATE_UNAVAILABLE")
      )
    const response = makeResponse()

    await new RecurringPaymentController().simulateBill(
      "recurring-1",
      { identificationField: "line" },
      { auth: { churchId: "church-1" } } as never,
      response as never
    )

    expect(response.status).toHaveBeenCalledWith(503)
    expect(response.send).toHaveBeenCalledWith({ code: "SIMULATE_UNAVAILABLE" })
  })
})

describe("RecurringPaymentController.registerPayment", () => {
  const churchId = "church-1"
  const recurringPaymentId = "recurring-1"
  const competence = "2026-10"
  const paymentDate = "2026-10-17"
  const availabilityAccountId = "availability-1"
  const bankId = "bank-1"

  const recurrence = RecurringPayments.fromPrimitives({
    recurringPaymentId,
    churchId,
    financialConceptId: "concept-1",
    costCenterId: "cost-center-1",
    name: "Energy",
    type: "FIXED",
    amount: 100,
    dayOfMonth: 10,
    status: "ACTIVE",
  })

  const concept = {
    financialConceptId: "concept-1",
    churchId,
    active: true,
    type: "OUTGO",
  }
  const costCenter = {
    costCenterId: "cost-center-1",
    churchId,
  }

  const buildAccount = (accountType: AccountType, source?: any) =>
    AvailabilityAccount.fromPrimitives({
      churchId,
      availabilityAccountId,
      accountName: "Conta",
      balance: 0,
      active: true,
      accountType,
      lastMove: new Date(),
      createdAt: new Date(),
      source,
      symbol: "BRL",
    })

  const buildBank = (provider?: Provider) =>
    Bank.fromPrimitives({
      bankId,
      provider,
      churchId,
      active: true,
      accountType: "CHECKING" as any,
      name: "Banco",
      tag: "",
      addressInstancePayment: "",
      bankInstruction: "",
    })

  function mockAll({
    account,
    bank,
    existingRecord = false,
  }: {
    account: ReturnType<typeof buildAccount>
    bank?: ReturnType<typeof buildBank>
    existingRecord?: boolean
  }) {
    jest
      .spyOn(AvailabilityAccountMongoRepository, "getInstance")
      .mockReturnValue({ one: jest.fn().mockResolvedValue(account) } as never)

    jest
      .spyOn(BankMongoRepository, "getInstance")
      .mockReturnValue({ findById: jest.fn().mockResolvedValue(bank) } as never)

    jest
      .spyOn(RecurringPaymentsMongoRepository, "getInstance")
      .mockReturnValue({
        one: jest.fn().mockResolvedValue(recurrence),
      } as never)

    jest.spyOn(FinanceRecordMongoRepository, "getInstance").mockReturnValue({
      findRecurringPayment: jest
        .fn()
        .mockResolvedValue(existingRecord ? { id: "record-1" } : undefined),
      countRecurringPaymentRecords: jest.fn().mockResolvedValue(0),
    } as never)

    jest.spyOn(StorageProviderService, "getInstance").mockReturnValue({
      uploadFile: jest.fn().mockResolvedValue("voucher-key"),
      deleteFile: jest.fn().mockResolvedValue(undefined),
    } as never)
    jest.spyOn(QueueService, "getInstance").mockReturnValue({
      dispatch: jest.fn().mockResolvedValue(undefined),
    } as never)

    jest
      .spyOn(FinancialConceptMongoRepository, "getInstance")
      .mockReturnValue({ one: jest.fn().mockResolvedValue(concept) } as never)

    jest
      .spyOn(FinancialConfigurationMongoRepository, "getInstance")
      .mockReturnValue({
        findCostCenterByCostCenterId: jest.fn().mockResolvedValue(costCenter),
      } as never)

    jest.spyOn(FinancialYearMongoRepository, "getInstance").mockReturnValue({
      one: jest.fn().mockResolvedValue({ isClosed: () => false }),
    } as never)
  }

  const withFile = {
    auth: { churchId },
    files: { file: { originalname: "comprobante.pdf" } },
  } as never

  const body = { competence, paymentDate, availabilityAccountId }

  it("allows a manual registration from CASH even when the church has a connected provider account", async () => {
    mockAll({ account: buildAccount(AccountType.CASH) })
    const response = makeResponse()

    await new RecurringPaymentController().registerPayment(
      recurringPaymentId,
      body,
      withFile,
      response as never
    )

    expect(response.status).toHaveBeenCalledWith(202)
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({ status: "PROCESSING", competence })
    )
  })

  it("allows a manual registration from WALLET when the voucher is attached", async () => {
    mockAll({ account: buildAccount(AccountType.WALLET) })
    const response = makeResponse()

    await new RecurringPaymentController().registerPayment(
      recurringPaymentId,
      body,
      withFile,
      response as never
    )

    expect(response.status).toHaveBeenCalledWith(202)
    expect(response.send).toHaveBeenCalledWith(
      expect.objectContaining({ status: "PROCESSING", competence })
    )
  })

  it("requires a voucher to register manually from WALLET", async () => {
    mockAll({ account: buildAccount(AccountType.WALLET) })
    const response = makeResponse()

    await new RecurringPaymentController().registerPayment(
      recurringPaymentId,
      body,
      { auth: { churchId } } as never,
      response as never
    )

    expect(response.status).toHaveBeenCalledWith(400)
    expect(response.send).toHaveBeenCalledWith({
      code: "RECURRING_PAYMENT_VOUCHER_REQUIRED",
      message: "A voucher file is required to register a manual payment",
    })
  })

  it("blocks manual registration when the selected bank is connected to the provider", async () => {
    mockAll({
      account: buildAccount(AccountType.BANK, { bankId }),
      bank: buildBank(Provider.ASAAS),
    })
    const response = makeResponse()

    await new RecurringPaymentController().registerPayment(
      recurringPaymentId,
      body,
      withFile,
      response as never
    )

    expect(response.status).toHaveBeenCalledWith(400)
    expect(response.send).toHaveBeenCalledWith({
      code: "generic_exception",
      message: "Selected bank is not enabled for manual flow",
    })
  })
})
