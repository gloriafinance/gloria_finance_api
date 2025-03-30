import { BaseReportRequest } from "../../../domain"
import { Response } from "express"
import domainResponse from "../../../../Shared/helpers/domainResponse"
import { MonthlyTithes } from "../../../applications"
import { FinanceRecordMongoRepository } from "../../../../Financial/infrastructure"
import { ChurchMongoRepository } from "../../../../Church/infrastructure"
import { HttpStatus } from "../../../../Shared/domain"

/**
 * TithesController
 *
 * @description Fetch a list of tithes for the given church and date range.
 *
 * @param {BaseReportRequest} req - The request object.
 * @param {Response} res - The response object.
 *
 * @returns {Promise<void>} - A promise that resolves when the request has been
 * processed.
 *
 * @throws {Error} - If the request is invalid or an error occurs.
 *
 * @example
 * // Request
 * GET /monthly-tithes?churchId=123&year=2022&month=1
 *
 * // Response
 * [
 *   {
 *     "amount": 100,
 *     "date": "2022-01-01T00:00:00.000Z",
 *     "availabilityAccountName": "Iglesia de Dios",
 *     "availabilityAccountType": "BANK"
 *   }
 * ]
 */
export const TithesController = async (
  req: BaseReportRequest,
  res: Response
): Promise<void> => {
  try {
    const list = await new MonthlyTithes(
      FinanceRecordMongoRepository.getInstance(),
      ChurchMongoRepository.getInstance()
    ).execute(req)

    res.status(HttpStatus.OK).send(list)
  } catch (e) {
    domainResponse(e, res)
  }
}
