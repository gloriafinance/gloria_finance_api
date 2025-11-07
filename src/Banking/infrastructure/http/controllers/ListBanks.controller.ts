import { HttpStatus } from "@/Shared/domain"
import domainResponse from "@/Shared/helpers/domainResponse"
import { SearchBankByChurchId } from "@/Banking/applications"
import { BankMongoRepository } from "@/Banking/infrastructure/persistence"

export const listBankByChurchIdController = async (churchId: string, res) => {
  try {
    const bank = await new SearchBankByChurchId(
      BankMongoRepository.getInstance()
    ).execute(churchId)

    res.status(HttpStatus.OK).send(bank)
  } catch (e) {
    domainResponse(e, res)
  }
}
