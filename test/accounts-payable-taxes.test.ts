import { strict as assert } from "assert"
import {
  AccountPayable,
  type AccountPayableRequest,
  AccountPayableStatus,
  AccountPayableTaxStatus,
  type IAccountPayableRepository,
  type ISupplierRepository,
  Supplier,
  SupplierType,
  TaxDocumentType,
} from "@/AccountsPayable/domain"
import { CreateAccountPayable } from "@/AccountsPayable/applications"
import type { Paginate } from "@abejarano/ts-mongodb-criteria"
import { InvalidInstallmentsConfiguration } from "@/AccountsPayable/domain/exceptions/InvalidInstallmentsConfiguration"
import { AmountValue } from "@/Shared/domain"
import type { IFinancialConceptRepository } from "@/Financial/domain/interfaces"
import { FinancialConcept } from "@/Financial/domain"
import { type IQueueService, QueueName } from "@/package/queue/domain"

type TestCase = {
  name: string
  run: () => void | Promise<void>
}

class QueueServiceMock implements IQueueService {
  dispatch(queueName: QueueName, args: any): void {}
}

class FinancialConceptRepositoryMock implements IFinancialConceptRepository {
  listByCriteria(filter: object): Promise<FinancialConcept[]> {
    return Promise.resolve([])
  }

  one(filter: object): Promise<FinancialConcept | undefined> {
    return Promise.resolve(undefined)
  }

  upsert(financialConcept: FinancialConcept): Promise<void> {
    return Promise.resolve(undefined)
  }
}
class AccountPayableRepositoryMock implements IAccountPayableRepository {
  public saved: AccountPayable | null = null

  async upsert(accountPayable: AccountPayable): Promise<void> {
    this.saved = accountPayable
  }

  async one(): Promise<AccountPayable | null> {
    return null
  }

  async list(): Promise<Paginate<AccountPayable>> {
    throw new Error("Method not implemented in mock.")
  }
}

class SupplierRepositoryMock implements ISupplierRepository {
  constructor(private readonly supplier: Supplier) {}

  async upsert(): Promise<void> {
    throw new Error("Method not implemented in mock.")
  }

  async list(): Promise<Paginate<Supplier>> {
    throw new Error("Method not implemented in mock.")
  }

  async one(filter: object): Promise<Supplier | null> {
    if (
      (filter as { supplierId?: string }).supplierId ===
      this.supplier.getSupplierId()
    ) {
      return this.supplier
    }

    return null
  }

  async all(_churchId: string): Promise<Supplier[]> {
    return [this.supplier]
  }
}

const baseTaxDocument = {
  type: TaxDocumentType.INVOICE,
  number: "0001",
  date: new Date(),
}

const withTaxDocument = <T extends object>(
  params: T
): T & {
  taxDocument: typeof baseTaxDocument
} => ({
  ...params,
  taxDocument: baseTaxDocument,
})

function testAccountPayableTaxCalculation(): void {
  const account = AccountPayable.create(
    withTaxDocument({
      supplier: {
        supplierId: "supplier-001",
        supplierType: SupplierType.SUPPLIER,
        supplierDNI: "12345678901",
        name: "Construtora Monte",
        phone: "11999999999",
      },
      churchId: "church-001",
      description: "Reforma do altar",
      installments: [
        {
          amount: 1000,
          dueDate: new Date("2025-01-15T00:00:00.000Z"),
        },
      ],
      taxes: [
        { taxType: "ISS", percentage: 5 },
        { taxType: "PIS", percentage: 1.65 },
      ],
    })
  )

  const taxes = account.getTaxes()
  assert.strictEqual(taxes.length, 2, "Two taxes should be registered")

  const iss = taxes.find((tax) => tax.taxType === "ISS")
  assert.ok(iss, "ISS tax should be calculated")
  assert.strictEqual(iss!.amount, 50)

  const pis = taxes.find((tax) => tax.taxType === "PIS")
  const expectedPisAmount = Number(((1000 * 1.65) / 100).toFixed(2))
  assert.ok(pis, "PIS tax should be calculated")
  assert.strictEqual(pis!.amount, expectedPisAmount)

  const expectedTotal = Number((iss!.amount + pis!.amount).toFixed(2))
  assert.strictEqual(account.getTaxAmountTotal(), expectedTotal)

  const primitives = account.toPrimitives()
  assert.strictEqual(primitives.taxAmountTotal, expectedTotal)
  assert.strictEqual(primitives.taxes.length, 2)
}

async function testCreateAccountPayablePersistsTaxes(): Promise<void> {
  const supplier = Supplier.create({
    churchId: "church-002",
    type: SupplierType.SUPPLIER,
    dni: "98765432100",
    name: "Serviços Gerais Brasil",
    address: {
      street: "Rua Central",
      number: "100",
      city: "São Paulo",
      state: "SP",
      zipCode: "01000000",
    },
    phone: "11988887777",
    email: "contato@sgbrasil.com",
  })

  const supplierRepository = new SupplierRepositoryMock(supplier)
  const accountPayableRepository = new AccountPayableRepositoryMock()
  const useCase = new CreateAccountPayable(
    accountPayableRepository,
    supplierRepository,
    new FinancialConceptRepositoryMock(),
    new QueueServiceMock()
  )

  const request: AccountPayableRequest = {
    createdBy: "user-name",
    taxDocument: { date: undefined, type: undefined },
    supplierId: supplier.getSupplierId(),
    churchId: "church-002",
    description: "Construção do mezanino",
    installments: [
      {
        amount: 800,
        dueDate: new Date("2025-03-10T00:00:00.000Z"),
      },
      {
        amount: 1200,
        dueDate: new Date("2025-04-10T00:00:00.000Z"),
      },
    ],
    taxes: [
      { taxType: "ISS", percentage: 5 },
      { taxType: "INSS", percentage: 11, amount: 330 },
    ],
  }

  await useCase.execute(request)

  assert.ok(
    accountPayableRepository.saved,
    "Account payable should be persisted with taxes"
  )

  const persisted = accountPayableRepository.saved!.toPrimitives()
  const baseAmount = 800 + 1200
  const expectedIss = Number(((baseAmount * 5) / 100).toFixed(2))
  const expectedTotal = Number((expectedIss + 330).toFixed(2))

  assert.strictEqual(persisted.taxAmountTotal, expectedTotal)
  assert.strictEqual(persisted.taxes.length, 2)
  assert.deepStrictEqual(persisted.taxMetadata, {
    status: AccountPayableTaxStatus.TAXED,
    taxExempt: false,
    exemptionReason: undefined,
    cstCode: undefined,
    cfop: undefined,
    observation: undefined,
  })

  const iss = persisted.taxes.find((tax) => tax.taxType === "ISS")
  assert.ok(iss, "ISS tax should be present on persistence")
  assert.strictEqual(iss!.percentage, 5)
  assert.strictEqual(iss!.amount, expectedIss)

  const inss = persisted.taxes.find((tax) => tax.taxType === "INSS")
  assert.ok(inss, "INSS tax should be present on persistence")
  assert.strictEqual(inss!.amount, 330)
}

function testAccountPayableSupportsExemptInvoices(): void {
  const account = AccountPayable.create(
    withTaxDocument({
      supplier: {
        supplierId: "supplier-002",
        supplierType: SupplierType.SUPPLIER,
        supplierDNI: "12345678901",
        name: "Arquitetura Sagrada Ltda",
        phone: "11988889999",
      },
      churchId: "church-003",
      description: "Restauro de vitrais",
      installments: [
        {
          amount: 1500,
          dueDate: new Date("2025-02-20T00:00:00.000Z"),
        },
      ],
      taxMetadata: {
        status: AccountPayableTaxStatus.EXEMPT,
        taxExempt: true,
        exemptionReason: "Serviço enquadrado no art. 150, VI, b da CF",
        cstCode: "041",
        observation:
          "NF emitida sem destaque de imposto por imunidade tributária",
      },
    })
  )

  assert.strictEqual(account.getTaxes().length, 0)
  assert.strictEqual(account.getTaxAmountTotal(), 0)

  const metadata = account.getTaxMetadata()
  assert.ok(metadata, "Tax metadata should be stored for exempt invoices")
  assert.strictEqual(metadata!.status, AccountPayableTaxStatus.EXEMPT)
  assert.strictEqual(metadata!.taxExempt, true)
  assert.strictEqual(metadata!.cstCode, "041")
  assert.strictEqual(metadata!.cfop, undefined)

  const persisted = account.toPrimitives()
  assert.strictEqual(persisted.taxAmountTotal, 0)
  assert.deepStrictEqual(persisted.taxes, [])
  assert.deepStrictEqual(persisted.taxMetadata, {
    status: AccountPayableTaxStatus.EXEMPT,
    taxExempt: true,
    exemptionReason: "Serviço enquadrado no art. 150, VI, b da CF",
    cstCode: "041",
    cfop: undefined,
    observation: "NF emitida sem destaque de imposto por imunidade tributária",
  })
}

function testAccountPayableSupportsCommitmentsWithoutInvoice(): void {
  const account = AccountPayable.create(
    withTaxDocument({
      supplier: {
        supplierId: "supplier-011",
        supplierType: SupplierType.INDIVIDUAL,
        supplierDNI: "32165498700",
        name: "João da Silva",
        phone: "11977776666",
      },
      churchId: "church-011",
      description: "Compra de veículo seminovo",
      installments: [
        {
          amount: 20000,
          dueDate: new Date("2024-08-10T00:00:00.000Z"),
        },
        {
          amount: 20000,
          dueDate: new Date("2024-09-10T00:00:00.000Z"),
        },
        {
          amount: 20000,
          dueDate: new Date("2024-10-10T00:00:00.000Z"),
        },
      ],
      taxMetadata: {
        status: AccountPayableTaxStatus.NOT_APPLICABLE,
        taxExempt: true,
        observation: "Contrato particular assinado com pessoa física",
      },
    })
  )

  assert.strictEqual(account.getTaxes().length, 0)
  assert.strictEqual(account.getTaxAmountTotal(), 0)

  const metadata = account.getTaxMetadata()
  assert.ok(
    metadata,
    "Tax metadata should be recorded for non-taxable commitments"
  )
  assert.strictEqual(metadata!.status, AccountPayableTaxStatus.NOT_APPLICABLE)
  assert.strictEqual(metadata!.taxExempt, true)
  assert.strictEqual(
    metadata!.observation,
    "Contrato particular assinado com pessoa física"
  )

  const primitives = account.toPrimitives()
  assert.deepStrictEqual(primitives.taxes, [])
  assert.strictEqual(primitives.taxAmountTotal, 0)
  assert.deepStrictEqual(
    primitives.taxMetadata,
    {
      status: AccountPayableTaxStatus.NOT_APPLICABLE,
      taxExempt: true,
      exemptionReason: undefined,
      cstCode: undefined,
      cfop: undefined,
      observation: "Contrato particular assinado com pessoa física",
    },
    "Primitives should expose NOT_APPLICABLE status for commitments without NF"
  )
}

function testAccountPayableStoresMixedTaxStatuses(): void {
  const account = AccountPayable.create(
    withTaxDocument({
      supplier: {
        supplierId: "supplier-010",
        supplierType: SupplierType.SUPPLIER,
        supplierDNI: "22345678901",
        name: "Serviços de Climatização",
        phone: "11922221111",
      },
      churchId: "church-010",
      description: "Instalação de ar condicionado",
      installments: [
        {
          amount: 2000,
          dueDate: new Date("2025-01-20T00:00:00.000Z"),
        },
      ],
      taxes: [
        {
          taxType: "ISS",
          percentage: 5,
          status: AccountPayableTaxStatus.TAXED,
        },
        {
          taxType: "ICMS-ST",
          percentage: 0,
          amount: 120,
          status: AccountPayableTaxStatus.SUBSTITUTION,
        },
      ],
    })
  )

  const taxes = account.getTaxes()
  assert.strictEqual(taxes.length, 2)

  const substitution = taxes.find((tax) => tax.taxType === "ICMS-ST")
  assert.ok(substitution, "Substitution tax line should be present")
  assert.strictEqual(
    substitution!.status,
    AccountPayableTaxStatus.SUBSTITUTION,
    "Substitution status must be preserved on tax line"
  )

  const taxedLine = taxes.find((tax) => tax.taxType === "ISS")
  assert.ok(taxedLine, "Regular tax line should be present")
  assert.strictEqual(
    taxedLine!.status,
    AccountPayableTaxStatus.TAXED,
    "Regular tax line defaults to TAXED status"
  )

  const metadata = account.getTaxMetadata()
  assert.strictEqual(metadata.status, AccountPayableTaxStatus.TAXED)
  assert.strictEqual(metadata.taxExempt, false)
}

function testAccountPayableDefaultsToSubstitutionWhenOnlySubstitutedLines(): void {
  const account = AccountPayable.create(
    withTaxDocument({
      supplier: {
        supplierId: "supplier-011",
        supplierType: SupplierType.SUPPLIER,
        supplierDNI: "32345678901",
        name: "Transporte Litúrgico",
        phone: "11911110000",
      },
      churchId: "church-011",
      description: "Serviço de transporte para retiro",
      amountTotal: 1500,
      taxes: [
        {
          taxType: "ICMS-ST",
          percentage: 0,
          amount: 90,
          status: AccountPayableTaxStatus.SUBSTITUTION,
        },
      ],
    })
  )

  const taxes = account.getTaxes()
  assert.strictEqual(taxes.length, 1)
  assert.strictEqual(
    taxes[0].status,
    AccountPayableTaxStatus.SUBSTITUTION,
    "Substitution-only invoices should mark the tax line as substitution"
  )

  const metadata = account.getTaxMetadata()
  assert.strictEqual(
    metadata.status,
    AccountPayableTaxStatus.SUBSTITUTION,
    "Default metadata should reflect substitution regime when applicable"
  )
  assert.strictEqual(metadata.taxExempt, false)
}

function testAccountPayableDefaultsTaxMetadataForUntaxedInvoices(): void {
  const account = AccountPayable.create(
    withTaxDocument({
      supplier: {
        supplierId: "supplier-003",
        supplierType: SupplierType.SUPPLIER,
        supplierDNI: "12345678901",
        name: "Limpeza e Cia",
        phone: "11977776666",
      },
      churchId: "church-004",
      description: "Serviço de limpeza pontual",
      installments: [
        {
          amount: 500,
          dueDate: new Date("2025-05-10T00:00:00.000Z"),
        },
      ],
    })
  )

  assert.strictEqual(account.getTaxes().length, 0)
  assert.strictEqual(account.getTaxAmountTotal(), 0)
  assert.deepStrictEqual(account.getTaxMetadata(), {
    status: AccountPayableTaxStatus.EXEMPT,
    taxExempt: true,
    exemptionReason: undefined,
    cstCode: undefined,
    cfop: undefined,
    observation: undefined,
  })
}

function testAccountPayableDropsTaxesWhenExplicitlyExempt(): void {
  const account = AccountPayable.create(
    withTaxDocument({
      supplier: {
        supplierId: "supplier-004",
        supplierType: SupplierType.SUPPLIER,
        supplierDNI: "12345678901",
        name: "Serviços de Jardinagem",
        phone: "11966665555",
      },
      churchId: "church-005",
      description: "Manutenção do jardim",
      installments: [
        {
          amount: 900,
          dueDate: new Date("2025-06-10T00:00:00.000Z"),
        },
      ],
      taxes: [
        { taxType: "ISS", percentage: 5 },
        { taxType: "INSS", percentage: 11 },
      ],
      taxMetadata: {
        taxExempt: true,
        status: AccountPayableTaxStatus.EXEMPT,
        exemptionReason: "Serviço vinculado à finalidade essencial",
      },
    })
  )

  assert.strictEqual(
    account.getTaxes().length,
    0,
    "Explicitly exempt invoices must not persist tax lines"
  )
  assert.strictEqual(
    account.getTaxAmountTotal(),
    0,
    "Explicitly exempt invoices must not accumulate tax totals"
  )
  assert.deepStrictEqual(account.getTaxMetadata(), {
    status: AccountPayableTaxStatus.EXEMPT,
    taxExempt: true,
    exemptionReason: "Serviço vinculado à finalidade essencial",
    cstCode: undefined,
    cfop: undefined,
    observation: undefined,
  })
}

function testAccountPayableSupportsScenarioBWithoutInstallments(): void {
  const amountTotal = 3500
  const account = AccountPayable.create(
    withTaxDocument({
      supplier: {
        supplierId: "supplier-007",
        supplierType: SupplierType.SUPPLIER,
        supplierDNI: "98765432100",
        name: "Engenharia Estrutural",
        phone: "11933332222",
      },
      churchId: "church-008",
      description: "Montagem de estrutura metálica",
      amountTotal,
      taxes: [{ taxType: "ISS", percentage: 3 }],
    })
  )

  const expectedIss = Number(((amountTotal * 3) / 100).toFixed(2))

  assert.strictEqual(account.getTaxes().length, 1)
  assert.strictEqual(account.getTaxAmountTotal(), expectedIss)
  assert.strictEqual(account.getStatus(), AccountPayableStatus.PENDING)
  assert.strictEqual(account.getAmountPending(), amountTotal)
  assert.deepStrictEqual(account.toPrimitives().installments, [])
  assert.strictEqual(account.getTaxMetadata().taxExempt, false)
  assert.strictEqual(
    account.getTaxMetadata().status,
    AccountPayableTaxStatus.TAXED
  )
}

function testAccountPayableRequiresAmountTotalForScenarioB(): void {
  assert.throws(() => {
    AccountPayable.create(
      withTaxDocument({
        supplier: {
          supplierId: "supplier-008",
          supplierType: SupplierType.SUPPLIER,
          supplierDNI: "98765432100",
          name: "Serviços Técnicos",
          phone: "11933335555",
        },
        churchId: "church-009",
        description: "Consultoria estrutural",
      })
    )
  }, InvalidInstallmentsConfiguration)
}

function testAccountPayableRejectsMismatchedInstallments(): void {
  assert.throws(() => {
    AccountPayable.create(
      withTaxDocument({
        supplier: {
          supplierId: "supplier-005",
          supplierType: SupplierType.SUPPLIER,
          supplierDNI: "12345678901",
          name: "Elétrica Luz Viva",
          phone: "11955554444",
        },
        churchId: "church-006",
        description: "Instalação elétrica",
        installments: [
          {
            amount: 500,
            dueDate: new Date("2025-07-01T00:00:00.000Z"),
          },
          {
            amount: 500,
            dueDate: new Date("2025-08-01T00:00:00.000Z"),
          },
        ],
        amountTotal: 1200,
      })
    )
  }, InvalidInstallmentsConfiguration)
}

function testAccountPayableStatusTransitionsWithPayments(): void {
  const account = AccountPayable.create(
    withTaxDocument({
      supplier: {
        supplierId: "supplier-006",
        supplierType: SupplierType.SUPPLIER,
        supplierDNI: "12345678901",
        name: "Construções Gerais",
        phone: "11944443333",
      },
      churchId: "church-007",
      description: "Pintura externa",
      installments: [
        {
          amount: 1000,
          dueDate: new Date("2025-09-10T00:00:00.000Z"),
        },
        {
          amount: 1000,
          dueDate: new Date("2025-10-10T00:00:00.000Z"),
        },
      ],
    })
  )

  assert.strictEqual(account.getStatus(), AccountPayableStatus.PENDING)

  account.updateAmount(AmountValue.create(500))
  assert.strictEqual(account.getStatus(), AccountPayableStatus.PARTIAL)
  assert.strictEqual(Number(account.getAmountPending().toFixed(2)), 1500)

  account.updateAmount(AmountValue.create(1500))
  assert.strictEqual(account.getStatus(), AccountPayableStatus.PAID)
  assert.strictEqual(account.getAmountPending(), 0)
}

async function runTests() {
  const tests: TestCase[] = [
    {
      name: "AccountPayable.create calculates tax totals",
      run: testAccountPayableTaxCalculation,
    },
    {
      name: "CreateAccountPayable persists calculated taxes",
      run: testCreateAccountPayablePersistsTaxes,
    },
    {
      name: "AccountPayable.create stores metadata for exempt invoices",
      run: testAccountPayableSupportsExemptInvoices,
    },
    {
      name: "AccountPayable.create registra compromissos sem nota fiscal",
      run: testAccountPayableSupportsCommitmentsWithoutInvoice,
    },
    {
      name: "AccountPayable.create persists mixed tax line statuses",
      run: testAccountPayableStoresMixedTaxStatuses,
    },
    {
      name: "AccountPayable.create defaults metadata to substitution when appropriate",
      run: testAccountPayableDefaultsToSubstitutionWhenOnlySubstitutedLines,
    },
    {
      name: "AccountPayable.create defaults metadata when no taxes are provided",
      run: testAccountPayableDefaultsTaxMetadataForUntaxedInvoices,
    },
    {
      name: "AccountPayable.create drops taxes when metadata enforces exemption",
      run: testAccountPayableDropsTaxesWhenExplicitlyExempt,
    },
    {
      name: "AccountPayable.create supports scenario B without installments",
      run: testAccountPayableSupportsScenarioBWithoutInstallments,
    },
    {
      name: "AccountPayable.create requires amountTotal when no installments are provided",
      run: testAccountPayableRequiresAmountTotalForScenarioB,
    },
    {
      name: "AccountPayable.create validates installment totals",
      run: testAccountPayableRejectsMismatchedInstallments,
    },
    {
      name: "AccountPayable.updateAmount transitions status based on payments",
      run: testAccountPayableStatusTransitionsWithPayments,
    },
  ]

  const failures: string[] = []

  for (const test of tests) {
    try {
      await test.run()
      console.log(`✓ ${test.name}`)
    } catch (error) {
      failures.push(test.name)
      console.error(`✗ ${test.name}`)
      console.error(error)
    }
  }

  if (failures.length) {
    console.error(`\n${failures.length} test(s) failed.`)
    process.exitCode = 1
  } else {
    console.log(`\nAll ${tests.length} business tax tests passed.`)
  }
}

test("business tax scenarios run", async () => {
  await runTests()
})
