import { strict as assert } from "assert"
import {
  AccountPayable,
  AccountPayableRequest,
  IAccountPayableRepository,
  ISupplierRepository,
  Supplier,
  SupplierType,
} from "@/AccountsPayable/domain"
import { CreateAccountPayable } from "@/AccountsPayable/applications"
import { Paginate } from "@abejarano/ts-mongodb-criteria"

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

  const iss = persisted.taxes.find((tax) => tax.taxType === "ISS")
  assert.ok(iss, "ISS tax should be present on persistence")
  assert.strictEqual(iss!.percentage, 5)
  assert.strictEqual(iss!.amount, expectedIss)

  const inss = persisted.taxes.find((tax) => tax.taxType === "INSS")
  assert.ok(inss, "INSS tax should be present on persistence")
  assert.strictEqual(inss!.amount, 330)
  assert.strictEqual(persisted.taxMetadata, undefined)
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
      status: "EXEMPT",
      exemptionReason: "Serviço enquadrado no art. 150, VI, b da CF",
      cstCode: "041",
      observation: "NF emitida sem destaque de imposto por imunidade tributária",
    },
  })

  assert.strictEqual(account.getTaxes().length, 0)
  assert.strictEqual(account.getTaxAmountTotal(), 0)

  const metadata = account.getTaxMetadata()
  assert.ok(metadata, "Tax metadata should be stored for exempt invoices")
  assert.strictEqual(metadata!.status, "EXEMPT")
  assert.strictEqual(metadata!.cstCode, "041")
  assert.strictEqual(metadata!.cfop, undefined)

  const persisted = account.toPrimitives()
  assert.strictEqual(persisted.taxAmountTotal, 0)
  assert.deepStrictEqual(persisted.taxes, [])
  assert.deepStrictEqual(persisted.taxMetadata, {
    status: "EXEMPT",
    exemptionReason: "Serviço enquadrado no art. 150, VI, b da CF",
    cstCode: "041",
    cfop: undefined,
    observation:
      "NF emitida sem destaque de imposto por imunidade tributária",
  })
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
