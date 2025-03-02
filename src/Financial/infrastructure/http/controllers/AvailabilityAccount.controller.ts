import { AccountType, AvailabilityAccountRequest } from "../../../domain"
import {
  CreateOrUpdateAvailabilityAccount,
  FinBankByBankId,
  SearchAvailabilityAccountByChurchId,
} from "../../../applications"
import {
  AvailabilityAccountMongoRepository,
  FinancialConfigurationMongoRepository,
} from "../../persistence"
import { HttpStatus } from "../../../../Shared/domain"
import domainResponse from "../../../../Shared/helpers/domainResponse"
import { Response } from "express"

export const createOrUpdateAvailabilityAccount = async (
  request: AvailabilityAccountRequest,
  res: Response
) => {
  try {
    if (
      (request.accountType === AccountType.BANK ||
        request.accountType === AccountType.WALLET) &&
      request.source == ""
    ) {
      res.status(HttpStatus.BAD_REQUEST).send({
        source: {
          message: "The source field is mandatory.",
          rule: "required",
        },
      })
      return
    }

    if (request.accountType === AccountType.BANK && request.source != "") {
      request.source = await new FinBankByBankId(
        FinancialConfigurationMongoRepository.getInstance()
      ).execute(request.source)
    }

    if (request.accountType === AccountType.WALLET && request.source != "") {
      //TODO implement search wallet
    }

    await new CreateOrUpdateAvailabilityAccount(
      AvailabilityAccountMongoRepository.getInstance()
    ).execute(request)

    if (!request.availabilityAccountId) {
      res.status(HttpStatus.CREATED).send({
        message: "Registered availability account",
      })
      return
    }

    res.status(HttpStatus.OK).send({
      message: "Updated availability account",
    })
  } catch (e) {
    domainResponse(e, res)
  }
}

export const listAvailabilityAccountByChurchId = async (
  churchId: string,
  res: Response
) => {
  try {
    const availabilityAccount = await new SearchAvailabilityAccountByChurchId(
      AvailabilityAccountMongoRepository.getInstance()
    ).execute(churchId)

    res.status(HttpStatus.OK).send(availabilityAccount)
  } catch (e) {
    domainResponse(e, res)
  }
}
