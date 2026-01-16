import { HttpStatus } from "@/Shared/domain"
import domainResponse from "@/Shared/helpers/domainResponse"
import { FinBankByBankId } from "@/Banking/applications"
import { BankMongoRepository } from "@/Banking/infrastructure/persistence"
import { AccountType } from "@/FinanceConfig/domain"
import type { AvailabilityAccountRequest } from "@/FinanceConfig/domain"
import {
  CreateOrUpdateAvailabilityAccount,
  SearchAvailabilityAccountByChurchId,
} from "@/FinanceConfig/applications"
import { AvailabilityAccountMongoRepository } from "@/FinanceConfig/infrastructure/presistence"
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  Use,
} from "@abejarano/ts-express-server"
import { Can, PermissionMiddleware } from "@/Shared/infrastructure"
import type { AuthenticatedRequest } from "@/Shared/infrastructure"
import AvailabilityAccountValidator from "@/Financial/infrastructure/http/validators/AvailabilityAccount.validator"

@Controller("/api/v1/finance/configuration/availability-account")
export class AvailabilityAccountController {
  @Post("/")
  @Use([
    PermissionMiddleware,
    Can("financial_configuration", "availability_accounts"),
    AvailabilityAccountValidator,
  ])
  async createOrUpdateAvailabilityAccount(
    @Body() request: AvailabilityAccountRequest,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
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
          BankMongoRepository.getInstance()
        ).execute(request.source)
      }

      if (request.accountType === AccountType.WALLET && request.source != "") {
        //TODO implement search wallet
      }

      await new CreateOrUpdateAvailabilityAccount(
        AvailabilityAccountMongoRepository.getInstance()
      ).execute({ ...request, churchId: req.auth.churchId })

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

  @Get("/:churchId")
  @Use([
    PermissionMiddleware,
    Can("financial_configuration", [
      "availability_accounts",
      "read_availability_accounts",
    ]),
  ])
  async listAvailabilityAccountByChurchId(
    @Param("churchId") churchId: string,
    @Res() res: ServerResponse
  ) {
    try {
      const availabilityAccount = await new SearchAvailabilityAccountByChurchId(
        AvailabilityAccountMongoRepository.getInstance()
      ).execute(churchId)

      res.status(HttpStatus.OK).send(availabilityAccount)
    } catch (e) {
      domainResponse(e, res)
    }
  }
}
