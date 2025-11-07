import { FinBankByBankId } from "@/Banking/applications"
import { HttpStatus } from "@/Shared/domain"
import domainResponse from "@/Shared/helpers/domainResponse"
import { BankMongoRepository } from "@/Banking/infrastructure/persistence"

export const FindBankByBankIdController = async (bankId: string, res) => {
  try {
    const bank = await new FinBankByBankId(
      BankMongoRepository.getInstance()
    ).execute(bankId)

    res.status(HttpStatus.OK).send(bank)
  } catch (e) {
    domainResponse(e, res)
  }
}
