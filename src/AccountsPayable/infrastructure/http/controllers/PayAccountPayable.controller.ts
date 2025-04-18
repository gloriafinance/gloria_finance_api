import domainResponse from "@/Shared/helpers/domainResponse"
import { Response } from "express"
import { PayAccountPayableRequest } from "@/AccountsPayable/domain"
import { QueueService, StorageGCP } from "@/Shared/infrastructure"
import {
  AvailabilityAccountMongoRepository,
  FinanceRecordMongoRepository,
  FinancialConceptMongoRepository,
  FinancialConfigurationMongoRepository,
} from "@/Financial/infrastructure/persistence"
import { FindCostCenterByCostCenterId, RegisterFinancialRecord } from "@/Financial/applications"
import { FinancialYearMongoRepository } from "@/ConsolidatedFinancial/infrastructure"
import { HttpStatus } from "@/Shared/domain"
import { PayAccountPayable } from "@/AccountsPayable/applications/PayAccountPayable"
import {
  AccountsPayableMongoRepository,
} from "@/AccountsPayable/infrastructure/persistence/AccountsPayableMongoRepository"

/**
 * @function PayAccountPayableController
 * @description Handles the payment of an account payable
 *
 * @param req
 * @param res
 *
 * @returns {Promise<void>} - Promise that resolves when the operation is completed
 */
export const PayAccountPayableController = async (
  req: PayAccountPayableRequest,
  res: Response
): Promise<void> => {
  try {
    await makeFinanceRecord(req)

    await new PayAccountPayable(
      AvailabilityAccountMongoRepository.getInstance(),
      AccountsPayableMongoRepository.getInstance(),
      QueueService.getInstance()
    ).execute(req)

    res
      .status(HttpStatus.OK)
      .json({ message: "Account payable paid successfully" })
  } catch (e) {
    domainResponse(e, res)
  }
}

const makeFinanceRecord = async (req: PayAccountPayableRequest) => {
  let voucher: string

  if (req.file) {
    voucher = await StorageGCP.getInstance(process.env.BUCKET_FILES).uploadFile(
      req.file
    )
  }

  req.concept = await FinancialConceptMongoRepository.getInstance().one({
    name: "Contas a Pagar",
    churchId: req.churchId,
  })

  const costCenter = await new FindCostCenterByCostCenterId(
    FinancialConfigurationMongoRepository.getInstance()
  ).execute(req.churchId, req.costCenterId)

  req.financialTransactionId = (
    await new RegisterFinancialRecord(
      FinancialYearMongoRepository.getInstance(),
      FinanceRecordMongoRepository.getInstance(),
      FinancialConceptMongoRepository.getInstance(),
      AvailabilityAccountMongoRepository.getInstance()
    ).handle(
      {
        churchId: req.churchId,
        availabilityAccountId: req.availabilityAccountId,
        voucher,
        amount: req.amount.getValue(),
        date: new Date(),
      },
      req.concept,
      costCenter
    )
  ).getFinancialRecordId()
}
