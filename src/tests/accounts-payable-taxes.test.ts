import { strict as assert } from "assert"
import {
  AccountPayable,
  AccountPayableRequest,
  AccountPayableStatus,
  AccountPayableTaxStatus,
  IAccountPayableRepository,
  ISupplierRepository,
  Supplier,
  SupplierType,
} from "@/AccountsPayable/domain"
import { CreateAccountPayable } from "@/AccountsPayable/applications"
import { Paginate } from "@abejarano/ts-mongodb-criteria"
import { InvalidInstallmentsConfiguration } from "@/AccountsPayable/domain/exceptions/InvalidInstallmentsConfiguration"
import { AmountValue } from "@/Shared/domain"

type TestCase = {
  name: string
  run: () => void | Promise<void>
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
    if ((filter as { supplierId?: string }).supplierId === this.supplier.getSupplierId()) {
      return this.supplier
    }

    return null
  }

  async all(_churchId: string): Promise<Supplier[]> {
    return [this.supplier]
  }
}

function testAccountPayableTaxCalculation(): void {
  const account = AccountPayable.create({
    supplier: {
      supplierId: "supplier-001",
      supplierType: SupplierType.COMPANY,
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
    type: SupplierType.COMPANY,
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
    supplierRepository
  )

  const request: AccountPayableRequest = {
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
  const account = AccountPayable.create({
    supplier: {
      supplierId: "supplier-002",
      supplierType: SupplierType.COMPANY,
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
      observation: "NF emitida sem destaque de imposto por imunidade tributária",
    },
  })

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
    observation:
      "NF emitida sem destaque de imposto por imunidade tributária",
  })
}

function testAccountPayableDefaultsTaxMetadataForUntaxedInvoices(): void {
  const account = AccountPayable.create({
    supplier: {
      supplierId: "supplier-003",
      supplierType: SupplierType.COMPANY,
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
  const account = AccountPayable.create({
    supplier: {
      supplierId: "supplier-004",
      supplierType: SupplierType.COMPANY,
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
  const account = AccountPayable.create({
    supplier: {
      supplierId: "supplier-007",
      supplierType: SupplierType.COMPANY,
      supplierDNI: "98765432100",
      name: "Engenharia Estrutural", 
      phone: "11933332222",
    },
    churchId: "church-008",
    description: "Montagem de estrutura metálica",
    amountTotal,
    taxes: [
      { taxType: "ISS", percentage: 3 },
    ],
  })

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
    AccountPayable.create({
      supplier: {
        supplierId: "supplier-008",
        supplierType: SupplierType.COMPANY,
        supplierDNI: "98765432100",
        name: "Serviços Técnicos", 
        phone: "11933335555",
      },
      churchId: "church-009",
      description: "Consultoria estrutural",
    })
  }, InvalidInstallmentsConfiguration)
}

function testAccountPayableRejectsMismatchedInstallments(): void {
  assert.throws(() => {
    AccountPayable.create({
      supplier: {
        supplierId: "supplier-005",
        supplierType: SupplierType.COMPANY,
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
  }, InvalidInstallmentsConfiguration)
}

function testAccountPayableStatusTransitionsWithPayments(): void {
  const account = AccountPayable.create({
    supplier: {
      supplierId: "supplier-006",
      supplierType: SupplierType.COMPANY,
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

runTests()
