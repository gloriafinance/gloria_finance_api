import { type Installments, InstallmentsStatus } from "@/Shared/domain"
import { DateBR } from "@/Shared/helpers"

export const PayInstallment = (
  installment: Installments,
  amountTransferred: number,
  logger: any
): number => {
  if (installment.status === InstallmentsStatus.PAID) {
    installment.paymentDate = installment.paymentDate ?? DateBR()
    logger.debug(`Installment ${installment.installmentId} already paid`)
    return amountTransferred
  }

  logger.info(
    `Installment ${installment.installmentId} is was ${installment.status!.toLowerCase()} payment`
  )

  const amountPending = installment.amountPending ?? installment.amount
  const amountPaid = installment.amountPaid ?? 0
  const amountApplied = Math.min(amountTransferred, amountPending)

  installment.status =
    amountApplied === amountPending
      ? InstallmentsStatus.PAID
      : InstallmentsStatus.PARTIAL

  installment.paymentDate = DateBR()
  installment.amountPending = amountPending - amountApplied
  installment.amountPaid = amountPaid + amountApplied

  logger.info(`Installment ${installment.installmentId} updated`, installment)

  return amountTransferred - amountApplied
}
