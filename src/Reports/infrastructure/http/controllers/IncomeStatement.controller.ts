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
 * summarizing revenues, margins, and a cash snapshot used for validation.

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
 *   "period": { "year": 2024, "month": 5 },
 *   "summary": {
 *     "revenue": 12000,
 *     "cogs": 3000,
 *     "grossProfit": 9000,
 *     "operatingExpenses": 4500,
 *     "operatingIncome": 4500,
 *     "otherIncome": 500,
 *     "otherExpenses": 200,
 *     "otherNet": 300,
 *     "netIncome": 4800
 *   },
 *   "breakdown": [
 *     { "category": "REVENUE", "income": 12500, "expenses": 500, "net": 12000 },
 *     { "category": "COGS", "income": 0, "expenses": 3000, "net": -3000 },
 *     { "category": "OPEX", "income": 0, "expenses": 4500, "net": -4500 },
 *     { "category": "OTHER", "income": 500, "expenses": 200, "net": 300 }
 *   ],
 *   "cashFlowSnapshot": {
 *     "availabilityAccounts": {
 *       "accounts": [...],
 *       "total": 18000,
 *       "income": 15000,
 *       "expenses": 2000
 *     },
 *     "costCenters": {
 *       "costCenters": [...],
 *       "total": 5000
 *     }
 *   }
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
