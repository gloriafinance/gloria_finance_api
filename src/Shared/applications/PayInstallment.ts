import { Installments, InstallmentsStatus } from "@/Shared/domain"

export const PayInstallment = (
  installment: Installments,
  amountTransferred: number,
  logger: any
): number => {
  if (installment.status === InstallmentsStatus.PAID) {
    logger.debug(`Installment ${installment.installmentId} already paid`)
    return
  }

  logger.info(
    `Installment ${installment.installmentId} is was ${installment.status.toLowerCase()} payment`
  )

  const amountToCompare =
    installment.status === InstallmentsStatus.PENDING
      ? installment.amount
      : installment.amountPending

  installment.status =
    amountTransferred >= amountToCompare
      ? InstallmentsStatus.PAID
      : InstallmentsStatus.PARTIAL

  const amountPending = installment.amountPending ?? installment.amount

  const newAmountPending = amountPending - amountTransferred

  if (newAmountPending < 0) {
    installment.amountPending = 0
    installment.amountPaid = installment.amount
  } else {
    installment.amountPending = newAmountPending
    installment.amountPaid =
      amountTransferred + (installment.amountPending || 0)
  }

  logger.info(`Installment ${installment.installmentId} updated`, installment)

  return amountTransferred - amountPending
}
