import { PayAccountReceivableRequest } from "@/AccountsReceivable/domain"
import { Response } from "express"
import domainResponse from "@/Shared/helpers/domainResponse"
import { PayAccountReceivable } from "@/AccountsReceivable/applications"
import { AccountsReceivableMongoRepository } from "../../persistence/AccountsReceivableMongoRepository"
import { HttpStatus } from "@/Shared/domain"
import { StorageGCP } from "@/Shared/infrastructure"
import {
  AvailabilityAccountMongoRepository,
  FinanceRecordMongoRepository,
  FinancialConceptMongoRepository,
} from "@/Financial/infrastructure/persistence"
import { RegisterFinancialRecord } from "@/Financial/applications/financeRecord/RegisterFinancialRecord"
import { FinancialYearMongoRepository } from "@/ConsolidatedFinancial/infrastructure"

/**
 * @function PayAccountReceivableController
 * @description Handles the payment of an account receivable
 *
 * @param {PayAccountReceivableRequest} req - Object with the necessary data to pay an account receivable
 * @param {Response} res - Express response object
 *
 * @returns {Promise<void>} - Promise that resolves when the operation is completed</void>
 *
 * @throws {Error} - Errors are caught and handled by the domainResponse helper
 */
export const PayAccountReceivableController = async (
  req: PayAccountReceivableRequest,
  res: Response
): Promise<void> => {
  try {
    await makeFinanceRecord(req)

    await new PayAccountReceivable(
      AccountsReceivableMongoRepository.getInstance()
    ).execute(req)

    res
      .status(HttpStatus.OK)
      .json({ message: "Account receivable paid successfully" })
  } catch (e) {
    domainResponse(e, res)
  }
}

const makeFinanceRecord = async (req: PayAccountReceivableRequest) => {
  let voucher: string

  if (req.file) {
    voucher = await StorageGCP.getInstance(process.env.BUCKET_FILES).uploadFile(
      req.file
    )
  }

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
      await FinancialConceptMongoRepository.getInstance().one({
        name: "Conta a Receber",
        churchId: req.churchId,
      })
    )
  ).getFinancialRecordId()
}
