import {
  AggregateRoot,
  type AggregateRelations,
} from "@abejarano/ts-mongodb-criteria"
import { Urn } from "@/Shared/adapter/Urn"
import { RecurringPaymentException } from "./exceptions/RecurringPayment.exception"

export type RecurringPaymentMethod = "PIX" | "BILL"
export type RecurringPaymentStatus = "ACTIVE" | "INACTIVE"
export type RecurringPaymentExecutionStatus =
  "PROCESSING" | "BLOCKED" | "FAILED"
export type PixKeyType = "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP"

export type RecurringPaymentConfigurationData = {
  recurringPaymentsId: string
  churchId: string
  financialConceptId: string
  name: string
  type: "FIXED" | "VARIABLE"
  amount?: number
  dayOfMonth: number
  payment:
    | { method: "PIX"; pixKey: string; pixKeyType: PixKeyType }
    | { method: "BILL" }
  status: RecurringPaymentStatus
}

export type RecurringPaymentConfigurationChanges = Omit<
  RecurringPaymentConfigurationData,
  "recurringPaymentsId" | "churchId"
>

export type RecurringPaymentConfiguration =
  RecurringPaymentConfigurationData & {
    currentPayment?: CurrentRecurringPayment
  }

export type CurrentRecurringPayment = {
  competence: string
  attempt: number
  externalReference: string
  amount: number
  bankId: string
  availabilityAccountId: string
  status: RecurringPaymentExecutionStatus
  providerStatus: string
  failureCode?: string
  identificationField?: string
  paymentDate?: string
  transactionReceiptUrl?: string
  updatedAt: Date
}

export class RecurringPayments extends AggregateRoot {
  static collectionName(): string {
    return "recurringPayments"
  }

  static relations(): AggregateRelations {
    return {}
  }

  private constructor(private props: RecurringPaymentConfiguration) {
    super()
  }

  static create(
    input: Omit<
      RecurringPaymentConfiguration,
      "recurringPaymentsId" | "currentPayment"
    >
  ): RecurringPayments {
    return new RecurringPayments({
      ...input,
      recurringPaymentsId: Urn.create({ entity: "recurringPayments" }),
    })
  }

  static fromPrimitives(
    primitives: RecurringPaymentConfiguration
  ): RecurringPayments {
    return new RecurringPayments(primitives)
  }

  getRecurringPaymentsId(): string {
    return this.props.recurringPaymentsId
  }

  getChurchId(): string {
    return this.props.churchId
  }

  getFinancialConceptId(): string {
    return this.props.financialConceptId
  }

  getName(): string {
    return this.props.name
  }

  getType(): RecurringPaymentConfiguration["type"] {
    return this.props.type
  }

  getAmount(): number | undefined {
    return this.props.type === "FIXED" ? this.props.amount : undefined
  }

  getDayOfMonth(): number {
    return this.props.dayOfMonth
  }

  getPayment(): RecurringPaymentConfiguration["payment"] {
    return this.props.payment
  }

  getStatus(): RecurringPaymentStatus {
    return this.props.status
  }

  getCurrentPayment(): CurrentRecurringPayment | undefined {
    return this.props.currentPayment
  }

  updateConfiguration(changes: RecurringPaymentConfigurationChanges): void {
    const currentPayment = this.props.currentPayment
    if (currentPayment && currentPayment.status !== "FAILED") {
      throw new RecurringPaymentException("RECURRING_PAYMENT_IN_PROGRESS")
    }

    const updated = {
      ...changes,
      recurringPaymentsId: this.props.recurringPaymentsId,
      churchId: this.props.churchId,
      ...(currentPayment ? { currentPayment } : {}),
    }
    this.props = updated
  }

  reserveCurrentPayment(payment: CurrentRecurringPayment): void {
    if (
      this.props.status !== "ACTIVE" ||
      (this.props.currentPayment &&
        this.props.currentPayment.status !== "FAILED")
    ) {
      throw new RecurringPaymentException("RECURRING_PAYMENT_IN_PROGRESS")
    }
    this.props.currentPayment = payment
  }

  updateCurrentPayment(payment: CurrentRecurringPayment): void {
    if (
      !this.props.currentPayment ||
      this.props.currentPayment.externalReference !== payment.externalReference
    ) {
      throw new RecurringPaymentException(
        "RECURRING_PAYMENT_BANKING_REFERENCE_MISMATCH"
      )
    }
    this.props.currentPayment = payment
  }

  closeCurrentPayment(externalReference: string): void {
    if (
      !this.props.currentPayment ||
      this.props.currentPayment.externalReference !== externalReference
    ) {
      throw new RecurringPaymentException(
        "RECURRING_PAYMENT_BANKING_REFERENCE_MISMATCH"
      )
    }
    delete this.props.currentPayment
  }

  getPaymentStatusForCompetence(
    competence: string
  ): RecurringPaymentExecutionStatus | undefined {
    const currentPayment = this.props.currentPayment
    if (currentPayment?.competence !== competence) return undefined
    return currentPayment.status
  }

  toConfiguration(): RecurringPaymentConfigurationData {
    const {
      recurringPaymentsId,
      churchId,
      financialConceptId,
      name,
      type,
      amount,
      dayOfMonth,
      payment,
      status,
    } = this.props
    return {
      recurringPaymentsId,
      churchId,
      financialConceptId,
      name,
      type,
      ...(amount !== undefined ? { amount } : {}),
      dayOfMonth,
      payment,
      status,
    }
  }

  toPrimitives(): RecurringPaymentConfiguration {
    return this.props
  }
}
