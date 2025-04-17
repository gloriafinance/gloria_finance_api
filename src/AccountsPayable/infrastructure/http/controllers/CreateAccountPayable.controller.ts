import { Response } from "express"
import { AccountPayableRequest } from "@/AccountsPayable/domain"
import { CreateAccountPayable } from "@/AccountsPayable/applications"
import {
  AccountsPayableMongoRepository,
} from "@/AccountsPayable/infrastructure/persistence/AccountsPayableMongoRepository"
import { HttpStatus } from "@/Shared/domain"
import domainResponse from "@/Shared/helpers/domainResponse"

/**
 * @function CreateAccountPayableController
 * @description Handles the creation of accounts payable
 *
 * @param {AccountPayableRequest} req - Object with the necessary data to create an account payable
 * @param {Response} res - Express response object
 *
 * @returns {Promise<void>} - Promise that resolves when the operation is completed</void>
 *
 * @throws {Error} - Errors are caught and handled by the domainResponse helper
 */
export const CreateAccountPayableController = async (
  req: AccountPayableRequest,
  res: Response
): Promise<void> => {
  try {
    await new CreateAccountPayable(
      AccountsPayableMongoRepository.getInstance()
    ).execute(req)
    res
      .status(HttpStatus.CREATED)
      .json({ message: "Account payable created successfully" })
  } catch (e) {
    domainResponse(e, res)
  }
}
