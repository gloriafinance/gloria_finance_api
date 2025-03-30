import { AccountReceivableRequest } from "@/AccountsReceivable/domain"
import { Response } from "express"
import domainResponse from "@/Shared/helpers/domainResponse"
import { CreateAccountReceivable } from "@/AccountsReceivable/applications"
import {
  AccountsReceivableMongoRepository,
} from "@/AccountsReceivable/infrastructure/persistence/AccountsReceivableMongoRepository"
import { HttpStatus } from "@/Shared/domain"

/**
 * @function CreateAccountReceivableController
 * @description Handles the creation of accounts receivable
 *
 * @param {AccountReceivableRequest} req - Object with the necessary data to create an account receivable
 * @param {Response} res - Express response object
 *
 * @returns {Promise<void>} - Promise that resolves when the operation is completed</void>
 *
 * @throws {Error} - Errors are caught and handled by the domainResponse helper
 */
export const CreateAccountReceivableController = async (
  req: AccountReceivableRequest,
  res: Response
): Promise<void> => {
  try {
    await new CreateAccountReceivable(
      AccountsReceivableMongoRepository.getInstance()
    ).execute(req)
    res
      .status(HttpStatus.CREATED)
      .json({ message: "Account receivable created successfully" })
  } catch (e) {
    domainResponse(e, res)
  }
}
