import { AggregateRoot } from "@abejarano/ts-mongodb-criteria"
import { ICreateCustomer } from "./interfaces/CreateCustomer"
import { IdentifyEntity } from "@/Shared/adapter"
import { DateBR } from "@/Shared/helpers"
import {
  CustomerStatus,
  OnboardingStatus,
} from "@/Customers/domain/enums/CustomerStatus.enum"

export class Customer extends AggregateRoot {
  private id?: string
  private customerId: string
  private representative: {
    name: string
    email: string
    phone: string
    rol: string
  }
  private name: string
  private email: string
  private phone: string
  private address: {
    street: string
    number: string
    city: string
    postalCode: string
    country: string
  }
  private tenantId: string
  private plan: string
  private status: CustomerStatus
  private onboardingStatus: OnboardingStatus
  private createdAt: Date

  private constructor() {
    super()
  }

  static create(data: Partial<ICreateCustomer>): Customer {
    const customer = new Customer()
    customer.customerId = IdentifyEntity.get(`customer`)
    customer.representative = data.representative
    customer.name = data.name
    customer.email = data.email
    customer.phone = data.phone
    customer.address = data.address
    customer.status = CustomerStatus.INACTIVE
    customer.onboardingStatus = OnboardingStatus.PENDING
    customer.createdAt = DateBR()

    return customer
  }

  static fromPrimitives(data: any): Customer {
    const customer = new Customer()
    customer.id = data.id
    customer.customerId = data.customerId
    customer.representative = data.representative
    customer.name = data.name
    customer.email = data.email
    customer.phone = data.phone
    customer.address = data.address
    customer.tenantId = data.tenantId
    customer.plan = data.plan
    customer.createdAt = data.createdAt

    return customer
  }

  getId(): string {
    return this.id
  }

  getName() {
    return this.name
  }

  getEmail() {
    return this.email
  }

  getAddress(): any {
    return this.address
  }

  setPlan(plan: string) {
    this.plan = plan
  }

  setOnboardingStatus(status: OnboardingStatus) {
    this.onboardingStatus = status
  }

  setStatus(status: CustomerStatus) {
    this.status = status
  }

  setTenantId(tenantId: string) {
    this.tenantId = tenantId
  }

  toPrimitives(): any {
    return {
      customerId: this.customerId,
      representative: this.representative,
      name: this.name,
      email: this.email,
      phone: this.phone,
      address: this.address,
      tenantId: this.tenantId,
      plan: this.plan,
      status: this.status,
      onboardingStatus: this.onboardingStatus,
      createdAt: this.createdAt,
    }
  }
}
