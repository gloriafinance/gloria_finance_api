import { Response } from "express"
import { AccountReceivable, FilterAccountReceivableRequest } from "@/AccountsReceivable/domain"
import { ListAccountReceivable } from "@/AccountsReceivable/applications"
import { AccountsReceivableMongoRepository } from "../../persistence/AccountsReceivableMongoRepository"
import { HttpStatus, Paginate } from "@/Shared/domain"
import domainResponse from "@/Shared/helpers/domainResponse"
import { Logger } from "@/Shared/adapter"

/**
 * @function ListAccountReceivableController
 * @description Handles the retrieval of accounts receivable based on filtering criteria
 *
 * @param {FilterAccountReceivableRequest} req - Object with filter parameters for accounts receivable
 * @param {Response} res - Express response object
 *
 * @returns {Promise<void>} - Promise that resolves when the operation is completed
 *
 * @example
 * // Example request:
 * {
 *   "churchId": "church123",
 *   "startDate": "2023-01-01T00:00:00.000Z",
 *   "endDate": "2023-12-31T23:59:59.999Z",
 *   "status": "PENDING",
 *   "page": 1,
 *   "perPage": 10
 * }
 *
 * // Example response:
 * {
 *   "nextPag": 2,
 *   "count": 25,
 *   "results": [
 *     {
 *       "status": "PENDING",
 *       "createdAt": "2023-05-15T14:30:00.000Z",
 *       "updatedAt": "2023-05-15T14:30:00.000Z",
 *       "debtor": {
 *         "debtorType": "MEMBER",
 *         "debtorId": "member123",
 *         "name": "John Doe"
 *       },
 *       "accountReceivableId": "acc123",
 *       "churchId": "church123",
 *       "description": "Monthly tithe",
 *       "amountTotal": 500,
 *       "amountPaid": 0,
 *       "amountPending": 500,
 *       "installments": [
 *         {
 *           "installmentId": "inst123",
 *           "amount": 500,
 *           "dueDate": "2023-06-01T00:00:00.000Z",
 *           "status": "PENDING"
 *         }
 *       ]
 *     }
 *     // More accounts receivable...
 *   ]
 * }
 *
 * @throws {Error} - Errors are caught and handled by the domainResponse helper
 */
export const ListAccountReceivableController = async (
  req: FilterAccountReceivableRequest,
  res: Response
): Promise<void> => {
  try {
    const list: Paginate<AccountReceivable> = await new ListAccountReceivable(
      AccountsReceivableMongoRepository.getInstance()
    ).execute(req)

    const logger = Logger("ListAccountReceivableController")

    logger.info("Response list account receivable", list)

    res.status(HttpStatus.OK).send(list)
  } catch (e) {
    domainResponse(e, res)
  }
}
