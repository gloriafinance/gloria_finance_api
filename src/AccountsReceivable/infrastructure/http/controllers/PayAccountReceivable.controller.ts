import { PayAccountReceivableRequest } from "@/AccountsReceivable/domain"
import { Response } from "express"
import domainResponse from "@/Shared/helpers/domainResponse"
import { PayAccountReceivable } from "@/AccountsReceivable/applications"
import { AccountsReceivableMongoRepository } from "../../persistence/AccountsReceivableMongoRepository"
import { HttpStatus } from "@/Shared/domain"
import { QueueService } from "@/Shared/infrastructure"
import {
  AvailabilityAccountMongoRepository,
  FinanceRecordMongoRepository,
} from "@/Financial/infrastructure/persistence"

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
    await new PayAccountReceivable(
      FinanceRecordMongoRepository.getInstance(),
      AvailabilityAccountMongoRepository.getInstance(),
      AccountsReceivableMongoRepository.getInstance(),
      QueueService.getInstance()
    ).execute(req)

    res
      .status(HttpStatus.OK)
      .json({ message: "Account receivable paid successfully" })
  } catch (e) {
    domainResponse(e, res)
  }
}
