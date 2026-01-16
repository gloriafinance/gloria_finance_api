import { FilterFinanceRecordRequest } from "../../../domain"
import { FetchingFinanceRecord } from "../../../applications"
import { FinanceRecordMongoRepository } from "../../persistence"
import domainResponse from "@/Shared/helpers/domainResponse"
import { HttpStatus } from "@/Shared/domain"
import FinanceRecordPaginateDTO from "../dto/FinanceRecordPaginate.dto"
import { Logger } from "@/Shared/adapter"

export const FetchingFinanceRecordController = async (
  filter: FilterFinanceRecordRequest,
  res: ServerResponse
) => {
  const logger = Logger("FinanceRecordListController")

  try {
    logger.info(`Filtering financial records with: ${JSON.stringify(filter)}`)
    const list = await new FetchingFinanceRecord(
      FinanceRecordMongoRepository.getInstance()
    ).execute(filter)

    res.status(HttpStatus.OK).send(await FinanceRecordPaginateDTO(list))
  } catch (e) {
    return domainResponse(e, res)
  }
}
