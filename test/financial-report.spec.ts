import { strict as assert } from "assert"
jest.mock("@/app", () => ({ APP_DIR: process.cwd() }))
import { GenerateFinanceRecordReport } from "@/Financial/applications/financeRecord/GenerateFinanceRecordReport"
import {
  AvailabilityAccountMaster,
  ConceptType,
  CostCenterMaster,
  FinanceRecordReportRequest,
  StatementCategory,
  StatementCategorySummary,
} from "@/Financial/domain"
import { IncomeStatement } from "@/Reports/applications/IncomeStatement"
import { BaseReportRequest } from "@/Reports/domain"
import {
  IChurchRepository,
  Church,
  ChurchDTO,
} from "@/Church/domain"
import { IFinancialRecordRepository } from "@/Financial/domain/interfaces"
import { Criteria, Paginate } from "@abejarano/ts-mongodb-criteria"
import { IXLSExportAdapter, ReportFile } from "@/Shared/domain"
import { PuppeteerAdapter } from "@/Shared/adapter/GeneratePDF.adapter"
import { IHTMLAdapter } from "@/Shared/domain/interfaces/GenerateHTML.interface"
import { IStorageService } from "@/Shared/domain"

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
  }
  availabilityAccount?: {
    accountName: string
  }
  costCenter?: {
    name: string
  }
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

  async fetchAvailableAccounts(
    _filter: {
      churchId: string
      year: number
      month?: number
    }
  ): Promise<AvailabilityAccountMaster[]> {
    return []
  }

  async fetchCostCenters(
    _filter: {
      churchId: string
      year: number
      month?: number
    }
  ): Promise<CostCenterMaster[]> {
    return []
  }

  async fetchStatementCategories(
    _filter: {
      churchId: string
      year: number
      month?: number
    }
  ): Promise<StatementCategorySummary[]> {
    const categoryTotals = new Map<
      StatementCategory,
      { income: number; expenses: number; reversal: number }
    >()

    for (const record of this.records) {
      const category =
        record.financialConcept?.statementCategory ?? StatementCategory.OTHER
      const current =
        categoryTotals.get(category) ?? {
          income: 0,
          expenses: 0,
          reversal: 0,
        }

      if (record.type === ConceptType.INCOME) {
        current.income += record.amount
      } else if (
        record.type === ConceptType.DISCHARGE ||
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

class StubHtmlAdapter implements IHTMLAdapter {
  public capturedTemplate: string | null = null
  public capturedData: any = null

  generateHTML(template: string, data: any): string {
    this.capturedTemplate = template
    this.capturedData = data
    return "<html></html>"
  }
}

class StubStorageService implements IStorageService {
  async uploadFile(): Promise<string> {
    return "/tmp/uploaded.pdf"
  }

  async downloadFile(): Promise<string> {
    return "/tmp/downloaded.pdf"
  }

  async deleteFile(): Promise<void> {
    return undefined
  }

  setBucketName(): IStorageService {
    return this
  }
}

class FakePdfAdapter extends PuppeteerAdapter {
  public templateUsed: string | null = null
  public payload: any = null

  constructor(private readonly htmlStub = new StubHtmlAdapter()) {
    super(htmlStub, new StubStorageService())
  }

  htmlTemplate(template: string, data: any): this {
    this.templateUsed = template
    this.payload = data
    return super.htmlTemplate(template, data)
  }

  async toPDF(_upload?: boolean): Promise<string> {
    return "/tmp/fake-report.pdf"
  }
}

class FakeXlsAdapter implements IXLSExportAdapter {
  public rows: any[][] = []
  public header: string[] = []
  public sheetName: string | null = null

  async export(rows: any[], header: string[], sheetName: string): Promise<ReportFile> {
    this.rows = rows
    this.header = header
    this.sheetName = sheetName
    return {
      path: "/tmp/fake.csv",
      filename: `${sheetName}.csv`,
    }
  }
}

class FakeChurch implements Partial<Church> {
  constructor(private readonly id: string, private readonly name: string) {}

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

const sampleRecords: SampleRecord[] = [
  {
    financialRecordId: "rec-001",
    churchId: "church-001",
    amount: 1000,
    date: new Date("2025-10-01T00:00:00.000Z"),
    type: ConceptType.INCOME,
    description: "Dízimos",
    financialConcept: {
      name: "Dízimos",
      statementCategory: StatementCategory.REVENUE,
    },
    availabilityAccount: {
      accountName: "Conta Principal",
    },
  },
  {
    financialRecordId: "rec-002",
    churchId: "church-001",
    amount: 300,
    date: new Date("2025-10-02T00:00:00.000Z"),
    type: ConceptType.DISCHARGE,
    description: "Energia elétrica",
    financialConcept: {
      name: "Energia",
      statementCategory: StatementCategory.OPEX,
    },
    costCenter: {
      name: "Infraestrutura",
    },
  },
  {
    financialRecordId: "rec-003",
    churchId: "church-001",
    amount: 200,
    date: new Date("2025-10-03T00:00:00.000Z"),
    type: ConceptType.PURCHASE,
    description: "Compra de cadeiras",
    financialConcept: {
      name: "Mobiliário",
      statementCategory: StatementCategory.CAPEX,
    },
  },
  {
    financialRecordId: "rec-004",
    churchId: "church-001",
    amount: 150,
    date: new Date("2025-10-04T00:00:00.000Z"),
    type: ConceptType.REVERSAL,
    description: "Estorno de recebimento",
    financialConcept: {
      name: "Estorno",
      statementCategory: StatementCategory.OTHER,
    },
  },
  {
    financialRecordId: "rec-005",
    churchId: "church-001",
    amount: 400,
    date: new Date("2025-10-05T00:00:00.000Z"),
    type: ConceptType.INCOME,
    description: "Ofertas especiais",
    financialConcept: {
      name: "Ofertas",
      statementCategory: StatementCategory.OTHER,
    },
  },
  {
    financialRecordId: "rec-006",
    churchId: "church-001",
    amount: 50,
    date: new Date("2025-10-06T00:00:00.000Z"),
    type: ConceptType.DISCHARGE,
    description: "Materiais de limpeza",
    financialConcept: {
      name: "Limpeza",
      statementCategory: StatementCategory.OTHER,
    },
  },
]

const expectedTotals = {
  income: 1400,
  expenses: 550,
  reversal: 150,
  net: 700,
}

describe("Financial reporting consistency", () => {
  const church = new FakeChurch("church-001", "Igreja Central")
  const churchRepository = buildChurchRepository(church)
  const financialRecordRepository = new FakeFinancialRecordRepository(sampleRecords)

  it("generates movement report summary aligned with type rules", async () => {
    const fakePdf = new FakePdfAdapter()
    const fakeXls = new FakeXlsAdapter()

    const useCase = new GenerateFinanceRecordReport(
      churchRepository,
      financialRecordRepository,
      fakePdf,
      fakeXls
    )

    const request: FinanceRecordReportRequest = {
      churchId: "church-001",
      startDate: new Date("2025-10-01T00:00:00.000Z"),
      endDate: new Date("2025-10-31T23:59:59.999Z"),
      format: "pdf",
      page: 1,
      perPage: 100,
    }

    await useCase.execute(request)

    assert.ok(fakePdf.payload, "PDF payload should be captured")
    assert.strictEqual(fakePdf.templateUsed, "financial/finance-record-report")

    const summary = fakePdf.payload.summary
    assert.strictEqual(summary.totalIncome, expectedTotals.income)
    assert.strictEqual(summary.totalExpenses, expectedTotals.expenses)
    assert.strictEqual(summary.totalReversal, expectedTotals.reversal)
    assert.strictEqual(summary.netResult, expectedTotals.net)

    const reversalRow = summary.totalsByType.find(
      (row) => row.type === ConceptType.REVERSAL
    )
    assert.ok(reversalRow, "Reversal row should exist in summary totals")
    assert.strictEqual(reversalRow!.signedTotal, -expectedTotals.reversal)

    const reversalRecord = fakePdf.payload.records.find(
      (record: any) => record.type === "REVERSAL"
    )
    assert.ok(reversalRecord, "Reversal record should be present in the PDF")
    assert.strictEqual(reversalRecord.amount, -expectedTotals.reversal)
  })

  it("computes income statement totals using type-only classification", async () => {
    const incomeStatement = new IncomeStatement(
      financialRecordRepository,
      churchRepository
    )

    const request: BaseReportRequest = {
      churchId: "church-001",
      year: 2025,
      month: 10,
    }

    const response = await incomeStatement.execute(request)

    assert.strictEqual(response.summary.revenue, expectedTotals.income)
    assert.strictEqual(response.summary.operatingExpenses, expectedTotals.expenses)
    assert.strictEqual(response.summary.operatingIncome, expectedTotals.income - expectedTotals.expenses)
    assert.strictEqual(response.summary.reversalAdjustments, expectedTotals.reversal)
    assert.strictEqual(response.summary.netIncome, expectedTotals.net)

    const otherCategory = response.breakdown.find(
      (item) => item.category === StatementCategory.OTHER
    )
    assert.ok(otherCategory, "Other category should be present in breakdown")
    assert.strictEqual(otherCategory!.income, 400)
    assert.strictEqual(otherCategory!.expenses, 50)
    assert.strictEqual(
      otherCategory!.net,
      otherCategory!.income - otherCategory!.expenses
    )
  })

  it("keeps movement report and income statement net results aligned", async () => {
    const fakePdf = new FakePdfAdapter()
    const fakeXls = new FakeXlsAdapter()

    const reportUseCase = new GenerateFinanceRecordReport(
      churchRepository,
      financialRecordRepository,
      fakePdf,
      fakeXls
    )

    const financeRequest: FinanceRecordReportRequest = {
      churchId: "church-001",
      startDate: new Date("2025-10-01T00:00:00.000Z"),
      endDate: new Date("2025-10-31T23:59:59.999Z"),
      format: "pdf",
      page: 1,
      perPage: 100,
    }

    await reportUseCase.execute(financeRequest)

    const statement = new IncomeStatement(
      financialRecordRepository,
      churchRepository
    )

    const incomeStatement = await statement.execute({
      churchId: "church-001",
      year: 2025,
      month: 10,
    })

    assert.strictEqual(
      fakePdf.payload.summary.netResult,
      incomeStatement.summary.netIncome,
      "Net results between movement report and income statement should match"
    )
  })
})
