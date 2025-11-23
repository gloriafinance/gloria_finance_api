import { strict as assert } from "assert"
import { DRE } from "@/Reports/applications/DRE"
import { BaseReportRequest } from "@/Reports/domain"
import { Church, ChurchDTO, IChurchRepository } from "@/Church/domain"
import { IFinancialRecordRepository } from "@/Financial/domain/interfaces"
import {
  AvailabilityAccountMaster,
  ConceptType,
  CostCenterMaster,
  FinancialRecordStatus,
  StatementCategory,
  StatementCategorySummary,
} from "@/Financial/domain"
import { Criteria, Paginate } from "@abejarano/ts-mongodb-criteria"

jest.mock("@/app", () => ({ APP_DIR: process.cwd() }))
jest.mock("@/Shared/adapter/CustomLogger", () => ({
  Logger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}))

type SampleRecord = {
  financialRecordId: string
  churchId: string
  amount: number
  date: Date
  type: ConceptType
  description?: string
  financialConcept?: {
    name: string
    statementCategory: StatementCategory
    affectsResult?: boolean
  }
  availabilityAccount?: {
    accountName: string
  }
  costCenter?: {
    name: string
  }
  status?: FinancialRecordStatus
}

class FakeFinancialRecordRepository implements IFinancialRecordRepository {
  constructor(private readonly records: SampleRecord[]) {}

  async upsert(): Promise<void> {
    throw new Error("Method not implemented in fake repository.")
  }

  async deleteByFinancialRecordId(): Promise<void> {
    throw new Error("Method not implemented in fake repository.")
  }

  async list(_criteria: Criteria): Promise<Paginate<any>> {
    return {
      results: this.records,
      nextPag: null,
      count: this.records.length,
    }
  }

  async one(): Promise<any> {
    return null
  }

  async titheList(): Promise<{
    total: number
    tithesOfTithes: number
    records: any[]
  }> {
    throw new Error("Method not implemented in fake repository.")
  }

  async fetchAvailableAccounts(_filter: {
    churchId: string
    year: number
    month?: number
  }): Promise<AvailabilityAccountMaster[]> {
    return []
  }

  async fetchCostCenters(_filter: {
    churchId: string
    year: number
    month?: number
  }): Promise<CostCenterMaster[]> {
    return []
  }

  async fetchStatementCategories(_filter: {
    churchId: string
    year: number
    month?: number
  }): Promise<StatementCategorySummary[]> {
    const realizedStatuses = new Set<FinancialRecordStatus>([
      FinancialRecordStatus.CLEARED,
      FinancialRecordStatus.RECONCILED,
    ])

    const categoryTotals = new Map<
      StatementCategory,
      { income: number; expenses: number; reversal: number }
    >()

    for (const record of this.records) {
      const isRealized =
        record.status !== undefined && realizedStatuses.has(record.status)
      const affectsResult = record.financialConcept?.affectsResult === true

      if (!isRealized || !affectsResult) {
        continue
      }

      const category =
        record.financialConcept?.statementCategory ?? StatementCategory.OTHER
      const current = categoryTotals.get(category) ?? {
        income: 0,
        expenses: 0,
        reversal: 0,
      }

      if (record.type === ConceptType.INCOME) {
        current.income += record.amount
      } else if (
        record.type === ConceptType.OUTGO ||
        record.type === ConceptType.PURCHASE
      ) {
        current.expenses += record.amount
      } else if (record.type === ConceptType.REVERSAL) {
        current.reversal += record.amount
      }

      categoryTotals.set(category, current)
    }

    return Array.from(categoryTotals.entries()).map(([category, totals]) => ({
      category,
      income: totals.income,
      expenses: totals.expenses,
      reversal: totals.reversal,
    }))
  }
}

class FakeChurch implements Partial<Church> {
  constructor(
    private readonly id: string,
    private readonly name: string
  ) {}

  getName(): string {
    return this.name
  }

  getChurchId(): string {
    return this.id
  }
}

const buildChurchRepository = (church: FakeChurch): IChurchRepository => ({
  async one(churchId: string): Promise<Church | undefined> {
    if (churchId === church.getChurchId()) {
      return church as unknown as Church
    }
    return undefined
  },
  async upsert(): Promise<void> {
    throw new Error("Method not implemented in fake repository.")
  },
  async list(): Promise<Paginate<ChurchDTO>> {
    throw new Error("Method not implemented in fake repository.")
  },
  async listByDistrictId(): Promise<Church[]> {
    return []
  },
  async hasAnAssignedMinister(): Promise<[boolean, Church | undefined]> {
    return [false, undefined]
  },
  async withoutAssignedMinister(): Promise<Church[]> {
    return []
  },
})

describe("DRE Report", () => {
  const church = new FakeChurch("church-001", "Igreja Central")
  const churchRepository = buildChurchRepository(church)

  it("generates DRE report with correct calculations", async () => {
    const records: SampleRecord[] = [
      {
        financialRecordId: "rec-001",
        churchId: "church-001",
        amount: 3000,
        date: new Date("2024-05-01T00:00:00.000Z"),
        type: ConceptType.INCOME,
        description: "Dízimos",
        financialConcept: {
          name: "Dízimos",
          statementCategory: StatementCategory.REVENUE,
          affectsResult: true,
        },
        status: FinancialRecordStatus.CLEARED,
      },
      {
        financialRecordId: "rec-002",
        churchId: "church-001",
        amount: 117.05,
        date: new Date("2024-05-02T00:00:00.000Z"),
        type: ConceptType.INCOME,
        description: "Ofertas",
        financialConcept: {
          name: "Ofertas",
          statementCategory: StatementCategory.REVENUE,
          affectsResult: true,
        },
        status: FinancialRecordStatus.CLEARED,
      },
      {
        financialRecordId: "rec-003",
        churchId: "church-001",
        amount: 50,
        date: new Date("2024-05-03T00:00:00.000Z"),
        type: ConceptType.OUTGO,
        description: "Energia elétrica",
        financialConcept: {
          name: "Energia",
          statementCategory: StatementCategory.OPEX,
          affectsResult: true,
        },
        status: FinancialRecordStatus.CLEARED,
      },
      {
        financialRecordId: "rec-004",
        churchId: "church-001",
        amount: 51.5,
        date: new Date("2024-05-04T00:00:00.000Z"),
        type: ConceptType.OUTGO,
        description: "Água",
        financialConcept: {
          name: "Água",
          statementCategory: StatementCategory.OPEX,
          affectsResult: true,
        },
        status: FinancialRecordStatus.CLEARED,
      },
    ]

    const financialRecordRepository = new FakeFinancialRecordRepository(records)
    const dre = new DRE(financialRecordRepository, churchRepository)

    const request: BaseReportRequest = {
      churchId: "church-001",
      year: 2024,
      month: 5,
    }

    const result = await dre.execute(request)

    // Verify the calculations
    assert.strictEqual(result.receitaBruta, 3117.05)
    assert.strictEqual(result.receitaLiquida, 3117.05)
    assert.strictEqual(result.custosDiretos, 0)
    assert.strictEqual(result.resultadoBruto, 3117.05)
    assert.strictEqual(result.despesasOperacionais, 101.5)
    assert.strictEqual(result.resultadoOperacional, 3015.55)
    assert.strictEqual(result.resultadosExtraordinarios, 0)
    assert.strictEqual(result.resultadoLiquido, 3015.55)
    assert.strictEqual(result.year, 2024)
    assert.strictEqual(result.month, 5)
  })

  it("excludes CAPEX from DRE calculations", async () => {
    const records: SampleRecord[] = [
      {
        financialRecordId: "rec-001",
        churchId: "church-001",
        amount: 1000,
        date: new Date("2024-05-01T00:00:00.000Z"),
        type: ConceptType.INCOME,
        description: "Dízimos",
        financialConcept: {
          name: "Dízimos",
          statementCategory: StatementCategory.REVENUE,
          affectsResult: true,
        },
        status: FinancialRecordStatus.CLEARED,
      },
      {
        financialRecordId: "rec-002",
        churchId: "church-001",
        amount: 500,
        date: new Date("2024-05-02T00:00:00.000Z"),
        type: ConceptType.PURCHASE,
        description: "Compra de equipamento",
        financialConcept: {
          name: "Equipamento",
          statementCategory: StatementCategory.CAPEX,
          affectsResult: true,
        },
        status: FinancialRecordStatus.CLEARED,
      },
    ]

    const financialRecordRepository = new FakeFinancialRecordRepository(records)
    const dre = new DRE(financialRecordRepository, churchRepository)

    const request: BaseReportRequest = {
      churchId: "church-001",
      year: 2024,
      month: 5,
    }

    const result = await dre.execute(request)

    // CAPEX should not affect the DRE
    assert.strictEqual(result.receitaBruta, 1000)
    assert.strictEqual(result.resultadoLiquido, 1000)
  })

  it("maps COGS to custosDiretos", async () => {
    const records: SampleRecord[] = [
      {
        financialRecordId: "rec-001",
        churchId: "church-001",
        amount: 1000,
        date: new Date("2024-05-01T00:00:00.000Z"),
        type: ConceptType.INCOME,
        description: "Dízimos",
        financialConcept: {
          name: "Dízimos",
          statementCategory: StatementCategory.REVENUE,
          affectsResult: true,
        },
        status: FinancialRecordStatus.CLEARED,
      },
      {
        financialRecordId: "rec-002",
        churchId: "church-001",
        amount: 200,
        date: new Date("2024-05-02T00:00:00.000Z"),
        type: ConceptType.OUTGO,
        description: "Material de eventos",
        financialConcept: {
          name: "Material eventos",
          statementCategory: StatementCategory.COGS,
          affectsResult: true,
        },
        status: FinancialRecordStatus.CLEARED,
      },
    ]

    const financialRecordRepository = new FakeFinancialRecordRepository(records)
    const dre = new DRE(financialRecordRepository, churchRepository)

    const request: BaseReportRequest = {
      churchId: "church-001",
      year: 2024,
      month: 5,
    }

    const result = await dre.execute(request)

    assert.strictEqual(result.receitaBruta, 1000)
    assert.strictEqual(result.custosDiretos, 200)
    assert.strictEqual(result.resultadoBruto, 800)
    assert.strictEqual(result.despesasOperacionais, 0)
    assert.strictEqual(result.resultadoOperacional, 800)
  })

  it("maps OTHER to resultadosExtraordinarios", async () => {
    const records: SampleRecord[] = [
      {
        financialRecordId: "rec-001",
        churchId: "church-001",
        amount: 1000,
        date: new Date("2024-05-01T00:00:00.000Z"),
        type: ConceptType.INCOME,
        description: "Dízimos",
        financialConcept: {
          name: "Dízimos",
          statementCategory: StatementCategory.REVENUE,
          affectsResult: true,
        },
        status: FinancialRecordStatus.CLEARED,
      },
      {
        financialRecordId: "rec-002",
        churchId: "church-001",
        amount: 300,
        date: new Date("2024-05-02T00:00:00.000Z"),
        type: ConceptType.INCOME,
        description: "Venda de bem",
        financialConcept: {
          name: "Venda de bem",
          statementCategory: StatementCategory.OTHER,
          affectsResult: true,
        },
        status: FinancialRecordStatus.CLEARED,
      },
      {
        financialRecordId: "rec-003",
        churchId: "church-001",
        amount: 50,
        date: new Date("2024-05-03T00:00:00.000Z"),
        type: ConceptType.OUTGO,
        description: "Multa",
        financialConcept: {
          name: "Multa",
          statementCategory: StatementCategory.OTHER,
          affectsResult: true,
        },
        status: FinancialRecordStatus.CLEARED,
      },
    ]

    const financialRecordRepository = new FakeFinancialRecordRepository(records)
    const dre = new DRE(financialRecordRepository, churchRepository)

    const request: BaseReportRequest = {
      churchId: "church-001",
      year: 2024,
      month: 5,
    }

    const result = await dre.execute(request)

    assert.strictEqual(result.receitaBruta, 1000)
    assert.strictEqual(result.resultadoBruto, 1000)
    assert.strictEqual(result.resultadoOperacional, 1000)
    assert.strictEqual(result.resultadosExtraordinarios, 250)
    assert.strictEqual(result.resultadoLiquido, 1250)
  })

  it("only includes CLEARED and RECONCILED records", async () => {
    const records: SampleRecord[] = [
      {
        financialRecordId: "rec-001",
        churchId: "church-001",
        amount: 1000,
        date: new Date("2024-05-01T00:00:00.000Z"),
        type: ConceptType.INCOME,
        description: "Dízimos cleared",
        financialConcept: {
          name: "Dízimos",
          statementCategory: StatementCategory.REVENUE,
          affectsResult: true,
        },
        status: FinancialRecordStatus.CLEARED,
      },
      {
        financialRecordId: "rec-002",
        churchId: "church-001",
        amount: 500,
        date: new Date("2024-05-02T00:00:00.000Z"),
        type: ConceptType.INCOME,
        description: "Ofertas pending",
        financialConcept: {
          name: "Ofertas",
          statementCategory: StatementCategory.REVENUE,
          affectsResult: true,
        },
        status: FinancialRecordStatus.PENDING,
      },
      {
        financialRecordId: "rec-003",
        churchId: "church-001",
        amount: 200,
        date: new Date("2024-05-03T00:00:00.000Z"),
        type: ConceptType.INCOME,
        description: "Ofertas reconciled",
        financialConcept: {
          name: "Ofertas",
          statementCategory: StatementCategory.REVENUE,
          affectsResult: true,
        },
        status: FinancialRecordStatus.RECONCILED,
      },
    ]

    const financialRecordRepository = new FakeFinancialRecordRepository(records)
    const dre = new DRE(financialRecordRepository, churchRepository)

    const request: BaseReportRequest = {
      churchId: "church-001",
      year: 2024,
      month: 5,
    }

    const result = await dre.execute(request)

    // Only CLEARED (1000) and RECONCILED (200) should be included
    assert.strictEqual(result.receitaBruta, 1200)
    assert.strictEqual(result.resultadoLiquido, 1200)
  })

  it("only includes records with affectsResult = true", async () => {
    const records: SampleRecord[] = [
      {
        financialRecordId: "rec-001",
        churchId: "church-001",
        amount: 1000,
        date: new Date("2024-05-01T00:00:00.000Z"),
        type: ConceptType.INCOME,
        description: "Dízimos",
        financialConcept: {
          name: "Dízimos",
          statementCategory: StatementCategory.REVENUE,
          affectsResult: true,
        },
        status: FinancialRecordStatus.CLEARED,
      },
      {
        financialRecordId: "rec-002",
        churchId: "church-001",
        amount: 500,
        date: new Date("2024-05-02T00:00:00.000Z"),
        type: ConceptType.INCOME,
        description: "Saldo inicial",
        financialConcept: {
          name: "Saldo inicial",
          statementCategory: StatementCategory.OTHER,
          affectsResult: false,
        },
        status: FinancialRecordStatus.CLEARED,
      },
    ]

    const financialRecordRepository = new FakeFinancialRecordRepository(records)
    const dre = new DRE(financialRecordRepository, churchRepository)

    const request: BaseReportRequest = {
      churchId: "church-001",
      year: 2024,
      month: 5,
    }

    const result = await dre.execute(request)

    // Only records with affectsResult = true should be included
    assert.strictEqual(result.receitaBruta, 1000)
    assert.strictEqual(result.resultadoLiquido, 1000)
  })

  it("subtracts reversals from the relevant line items", async () => {
    const records: SampleRecord[] = [
      {
        financialRecordId: "rec-001",
        churchId: "church-001",
        amount: 1000,
        date: new Date("2024-05-01T00:00:00.000Z"),
        type: ConceptType.INCOME,
        description: "Dízimos",
        financialConcept: {
          name: "Dízimos",
          statementCategory: StatementCategory.REVENUE,
          affectsResult: true,
        },
        status: FinancialRecordStatus.CLEARED,
      },
      {
        financialRecordId: "rec-002",
        churchId: "church-001",
        amount: 200,
        date: new Date("2024-05-02T00:00:00.000Z"),
        type: ConceptType.REVERSAL,
        description: "Estorno de dízimo",
        financialConcept: {
          name: "Estorno",
          statementCategory: StatementCategory.REVENUE,
          affectsResult: true,
        },
        status: FinancialRecordStatus.CLEARED,
      },
      {
        financialRecordId: "rec-003",
        churchId: "church-001",
        amount: 100,
        date: new Date("2024-05-03T00:00:00.000Z"),
        type: ConceptType.OUTGO,
        description: "Energia elétrica",
        financialConcept: {
          name: "Energia",
          statementCategory: StatementCategory.OPEX,
          affectsResult: true,
        },
        status: FinancialRecordStatus.CLEARED,
      },
      {
        financialRecordId: "rec-004",
        churchId: "church-001",
        amount: 50,
        date: new Date("2024-05-04T00:00:00.000Z"),
        type: ConceptType.REVERSAL,
        description: "Estorno de despesa",
        financialConcept: {
          name: "Estorno despesa",
          statementCategory: StatementCategory.OPEX,
          affectsResult: true,
        },
        status: FinancialRecordStatus.CLEARED,
      },
    ]

    const financialRecordRepository = new FakeFinancialRecordRepository(records)
    const dre = new DRE(financialRecordRepository, churchRepository)

    const request: BaseReportRequest = {
      churchId: "church-001",
      year: 2024,
      month: 5,
    }

    const result = await dre.execute(request)

    // Revenue: 1000 (income) - 200 (reversal) = 800
    assert.strictEqual(result.receitaBruta, 800)
    assert.strictEqual(result.receitaLiquida, 800)

    // Operating expenses: 100 (expense) - 50 (reversal) = 50
    assert.strictEqual(result.despesasOperacionais, 50)

    // Result: 800 (revenue) - 50 (expenses) = 750
    assert.strictEqual(result.resultadoOperacional, 750)
    assert.strictEqual(result.resultadoLiquido, 750)
  })
})
