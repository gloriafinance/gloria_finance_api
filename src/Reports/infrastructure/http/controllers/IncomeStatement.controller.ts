import { Response } from "express"
import { BaseReportRequest } from "../../../domain"
import { FinanceRecordMongoRepository } from "../../../../Financial/infrastructure"
import { IncomeStatement } from "../../../applications"
import domainResponse from "../../../../Shared/helpers/domainResponse"
import { ChurchMongoRepository } from "../../../../Church/infrastructure"

/**
 * IncomeStatementController
 *
 * @description Generates a financial income statement for the specified church
 * showing assets, liabilities, and the final result.

 * @param {BaseReportRequest} req - The request object with filtering parameters.
 * @param {Response} res - The response object.
 *
 * @returns {Promise<void>} - A promise that resolves when the request has been</void>
 * processed.
 *
 * @throws {Error} - If the request is invalid or an error occurs.
 *
 * @example
 * // Request
 * GET /income-statement?churchId=123&year=2022&month=1
 *
 * // Response
 * {
 *   "assets": {
 *      "accounts": [...],
 *       "total": 10000
 *   },
 *   "liabilities": {
 *     "costCenters": [...],
 *     "total": 4000
 *   },
 *   "result": 6000
 * }
 *
 */
export const IncomeStatementController = async (
  req: BaseReportRequest,
  res: Response
): Promise<void> => {
  try {
    const result = await new IncomeStatement(
      FinanceRecordMongoRepository.getInstance(),
      ChurchMongoRepository.getInstance()
    ).execute(req)

    res.status(200).json(result)
  } catch (e) {
    domainResponse(e, res)
  }
}
