import { MonthlyTithesRequest } from "../../requests"
import { Response } from "express"
import domainResponse from "../../../Shared/helpers/domainResponse"
import { MonthlyTithes } from "../../MonthlyTithes"
import { FinanceRecordMongoRepository } from "../../../Financial/infrastructure"
import { ChurchMongoRepository } from "../../../Church/infrastructure"
import { HttpStatus } from "../../../Shared/domain"

export const TithesController = async (
  req: MonthlyTithesRequest,
  res: Response
) => {
  try {
    const list = await new MonthlyTithes(
      FinanceRecordMongoRepository.getInstance(),
      ChurchMongoRepository.getInstance()
    ).execute(req)

    return res.status(HttpStatus.OK).send(list)
  } catch (e) {
    domainResponse(e, res)
  }
}
