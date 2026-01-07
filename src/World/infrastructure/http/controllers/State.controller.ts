import domainResponse from "../../../../Shared/helpers/domainResponse"
import { HttpStatus } from "../../../../Shared/domain"
import { FindStateByCountryId } from "../../../applications"
import { WorldMongoRepository } from "../../persistence/WorldMongoRepository"

export const findByCountryIdController = async (countryId: string, res) => {
  try {
    const states = await new FindStateByCountryId(
      WorldMongoRepository.getInstance()
    ).run(countryId)

    res.status(HttpStatus.OK).send({ data: states })
  } catch (e) {
    domainResponse(e, res)
  }
}
