import {
  AggregateRoot,
  type AggregateRelations,
} from "@abejarano/ts-mongodb-criteria"
import { Urn } from "@/Shared/adapter/Urn"
import { RecurringPaymentException } from "./exceptions/RecurringPayment.exception"

export type RecurringPaymentStatus = "ACTIVE" | "INACTIVE"
export type RecurringPaymentExecutionStatus =
  "PROCESSING" | "BLOCKED" | "FAILED"
export type PixKeyType = "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP"

const PIX_KEY_TYPES: readonly PixKeyType[] = [
  "CPF",
  "CNPJ",
  "EMAIL",
  "PHONE",
  "EVP",
]

/**
 * Reusable PIX destination for a recurring commitment.
 *
 * This is metadata about the payee, NOT a payment method. A recurrence with a
 * `pixDestination` may still be executed as a BILL payment. See ADR-007.
 */
export type PixDestination = {
  pixKey: string
  pixKeyType: PixKeyType
}

export type RecurringPaymentConfigurationData = {
  recurringPaymentId: string
  churchId: string
  financialConceptId: string
  costCenterId: string
  name: string
  type: "FIXED" | "VARIABLE"
  amount?: number
  dayOfMonth: number
  pixDestination?: PixDestination
  status: RecurringPaymentStatus
}

export type RecurringPaymentConfigurationChanges = Omit<
  RecurringPaymentConfigurationData,
  "recurringPaymentId" | "churchId"
>

export type RecurringPaymentConfiguration =
  RecurringPaymentConfigurationData & {
    currentPayment?: CurrentRecurringPayment
    /**
     * Set by migration on recurrences created before the cost center became
     * mandatory. They stay readable but cannot be executed until completed.
     */
    requiresCostCenter?: boolean
  }

export type CurrentRecurringPayment = {
  competence: string
  attempt: number
  externalReference: string
  amount: number
  /** Method chosen for this execution. Never part of the permanent config. */
  paymentMethod?: "PIX" | "BILL"
  /**
   * Destination actually sent for this execution, kept only so a retry of an
   * unknown outcome can prove it repeats the identical payload. This is
   * operational state, not permanent configuration (see ADR-001 / ADR-007).
   */
  executionDestination?: string
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
      "recurringPaymentId" | "currentPayment"
    >
  ): RecurringPayments {
    const recurring = new RecurringPayments({
      ...input,
      recurringPaymentId: Urn.create({ entity: "recurringPayments" }),
    })
    recurring.assertConfiguration()
    return recurring
  }

  static fromPrimitives(
    primitives: RecurringPaymentConfiguration
  ): RecurringPayments {
    return new RecurringPayments(primitives)
  }

  getRecurringPaymentId(): string {
    return this.props.recurringPaymentId
  }

  getChurchId(): string {
    return this.props.churchId
  }

  getFinancialConceptId(): string {
    return this.props.financialConceptId
  }

  getCostCenterId(): string {
    return this.props.costCenterId
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

  /**
   * Optional reusable PIX destination. Absence does not forbid PIX execution:
   * the execution command may supply a key for a single payment. See ADR-001.
   */
  getPixDestination(): PixDestination | undefined {
    return this.props.pixDestination
  }

  getStatus(): RecurringPaymentStatus {
    return this.props.status
  }

  getCurrentPayment(): CurrentRecurringPayment | undefined {
    return this.props.currentPayment
  }

  /**
   * A recurrence migrated without a cost center cannot produce an imputed
   * record, so execution must stop instead of writing an unallocated expense.
   */
  requiresCostCenterAssignment(): boolean {
    return (
      this.props.costCenterId === undefined ||
      this.props.requiresCostCenter === true
    )
  }

  updateConfiguration(changes: RecurringPaymentConfigurationChanges): void {
    const currentPayment = this.props.currentPayment
    if (currentPayment && currentPayment.status !== "FAILED") {
      throw new RecurringPaymentException("RECURRING_PAYMENT_IN_PROGRESS")
    }

    const updated: RecurringPaymentConfiguration = {
      ...changes,
      recurringPaymentId: this.props.recurringPaymentId,
      churchId: this.props.churchId,
      ...(currentPayment ? { currentPayment } : {}),
    }
    this.assertConfiguration(updated)
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
      recurringPaymentId,
      churchId,
      financialConceptId,
      costCenterId,
      name,
      type,
      amount,
      dayOfMonth,
      pixDestination,
      status,
    } = this.props
    return {
      recurringPaymentId,
      churchId,
      financialConceptId,
      costCenterId,
      name,
      type,
      ...(amount !== undefined ? { amount } : {}),
      dayOfMonth,
      ...(pixDestination ? { pixDestination } : {}),
      status,
    }
  }

  toPrimitives(): RecurringPaymentConfiguration {
    return this.props
  }

  /**
   * Single owner of the permanent-configuration invariants. The HTTP validator
   * only enforces transport shape; these rules hold for every caller.
   */
  private assertConfiguration(
    props: RecurringPaymentConfiguration = this.props
  ): void {
    if (
      !Number.isInteger(props.dayOfMonth) ||
      props.dayOfMonth < 1 ||
      props.dayOfMonth > 31
    ) {
      throw new RecurringPaymentException(
        "RECURRING_PAYMENT_DAY_OF_MONTH_INVALID"
      )
    }

    if (props.type === "FIXED") {
      if (
        props.amount === undefined ||
        !Number.isFinite(props.amount) ||
        props.amount <= 0
      ) {
        throw new RecurringPaymentException(
          "RECURRING_PAYMENT_FIXED_AMOUNT_REQUIRED"
        )
      }
    } else if (props.amount !== undefined) {
      throw new RecurringPaymentException(
        "RECURRING_PAYMENT_VARIABLE_AMOUNT_FORBIDDEN"
      )
    }

    if (props.pixDestination) {
      const { pixKey, pixKeyType } = props.pixDestination
      if (pixKey.trim() === "") {
        throw new RecurringPaymentException(
          "RECURRING_PAYMENT_PIX_KEY_REQUIRED"
        )
      }
      if (!PIX_KEY_TYPES.includes(pixKeyType)) {
        throw new RecurringPaymentException(
          "RECURRING_PAYMENT_PIX_KEY_REQUIRED"
        )
      }
    }
  }
}
