import { ChurchMongoRepository } from "@/Church/infrastructure"
import { HttpStatus } from "@/Shared/domain"
import domainResponse from "@/Shared/helpers/domainResponse"
import { BankRequest } from "@/Banking/domain"
import { CreateOrUpdateBank } from "@/Banking/applications"
import { BankMongoRepository } from "@/Banking/infrastructure/persistence"

export const CreateOrUpdateBankController = async (
  request: BankRequest,
  res
) => {
  try {
    await new CreateOrUpdateBank(
      BankMongoRepository.getInstance(),
      ChurchMongoRepository.getInstance()
    ).execute(request)

    if (!request.bankId) {
      res.status(HttpStatus.CREATED).send({
        message: "Registered bank",
      })
    } else {
      res.status(HttpStatus.OK).send({ message: "Updated bank" })
    }
  } catch (e) {
    domainResponse(e, res)
  }
}
