import { AggregateRoot } from "@/Shared/domain"
import { SupplierType } from "@/AccountsPayable/domain/enums/SupplierType"
import { ISupplier } from "@/AccountsPayable/domain/interfaces/Supplier"
import { IdentifyEntity } from "@/Shared/adapter"

export class Supplier extends AggregateRoot {
  private id?: string
  private churchId: string
  private supplierId: string
  private type: SupplierType

  private dni: string
  private name: string

  private address: {
    street: string
    number: string
    city: string
    state: string
    zipCode: string
  }
  private phone: string
  private email?: string

  private createdAt: Date
  private updatedAt: Date

  static create(params: Partial<ISupplier>) {
    const { churchId, type, dni, name, address, phone, email } = params

    const supplier: Supplier = new Supplier()
    supplier.churchId = churchId
    supplier.supplierId = IdentifyEntity.get(`supplier`)
    supplier.type = type

    supplier.dni = dni
    supplier.name = name

    supplier.address = address
    supplier.phone = phone
    supplier.email = email

    supplier.createdAt = new Date()
    supplier.updatedAt = new Date()

    return supplier
  }

  static fromPrimitives(params: any): Supplier {
    const supplier: Supplier = new Supplier()
    supplier.churchId = params.churchId
    supplier.supplierId = params.supplierId
    supplier.type = params.type

    supplier.dni = params.dni
    supplier.name = params.name

    supplier.address = params.address
    supplier.phone = params.phone
    supplier.email = params.email

    supplier.createdAt = params.createdAt
    supplier.updatedAt = params.updatedAt

    return supplier
  }

  getSupplierId(): string {
    return this.supplierId
  }

  getType(): SupplierType {
    return this.type
  }

  getDNI(): string {
    return this.dni
  }

  getName(): string {
    return this.name
  }

  getPhone(): string {
    return this.phone
  }

  getId(): string {
    return this.id
  }

  toPrimitives() {
    return {
      churchId: this.churchId,
      providerId: this.supplierId,
      type: this.type,

      dni: this.dni,
      name: this.name,

      address: this.address,
      phone: this.phone,
      email: this.email,

      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    }
  }
}
