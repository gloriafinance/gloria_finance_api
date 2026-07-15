import { HttpStatus } from "@/Shared/domain"
import domainResponse from "@/Shared/helpers/domainResponse"
import { FinBankByBankId } from "@/Banking/applications"
import { BankMongoRepository } from "@/Banking/infrastructure/persistence"
import type { AvailabilityAccountRequest } from "@/FinanceConfig/domain"
import type { UpdateAvailabilityAccountRequest } from "@/FinanceConfig/domain"
import { AccountType } from "@/FinanceConfig/domain"
import {
  CreateAvailabilityAccount,
  DeleteAvailabilityAccount,
  SearchAvailabilityAccountByChurchId,
  UpdateAvailabilityAccount,
} from "@/FinanceConfig/applications"
import { AvailabilityAccountMongoRepository } from "@/FinanceConfig/infrastructure/presistence"
import { BankStatementMongoRepository } from "@/Banking/infrastructure/persistence"
import { FinanceRecordMongoRepository } from "@/Financial/infrastructure/persistence"
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  Res,
  type ServerResponse,
  Use,
} from "bun-platform-kit"
import type { AuthenticatedRequest } from "@/Shared/infrastructure"
import { Can, PermissionMiddleware } from "@/Shared/infrastructure"
import AvailabilityAccountValidator from "@/Financial/infrastructure/http/validators/AvailabilityAccount.validator"
import AvailabilityAccountUpdateValidator from "@/Financial/infrastructure/http/validators/AvailabilityAccountUpdate.validator"

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
      if (request.availabilityAccountId) {
        res.status(HttpStatus.BAD_REQUEST).send({
          availabilityAccountId: {
            message:
              "The availabilityAccountId field is not allowed on create.",
            rule: "prohibited",
          },
        })
        return
      }

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

      await new CreateAvailabilityAccount(
        AvailabilityAccountMongoRepository.getInstance()
      ).execute({
        churchId: req.auth.churchId,
        accountName: request.accountName,
        active: request.active,
        accountType: request.accountType,
        symbol: request.symbol,
        source: request.source,
      })

      res.status(HttpStatus.CREATED).send({
        message: "Registered availability account",
      })
    } catch (e) {
      domainResponse(e, res)
    }
  }

  @Put("/:availabilityAccountId")
  @Use([
    PermissionMiddleware,
    Can("financial_configuration", "availability_accounts"),
    AvailabilityAccountUpdateValidator,
  ])
  async updateAvailabilityAccount(
    @Param("availabilityAccountId") availabilityAccountId: string,
    @Body() request: UpdateAvailabilityAccountRequest,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      await new UpdateAvailabilityAccount(
        AvailabilityAccountMongoRepository.getInstance()
      ).execute({
        availabilityAccountId,
        churchId: req.auth.churchId,
        accountName: request.accountName,
        active: request.active,
      })

      res.status(HttpStatus.OK).send({
        message: "Updated availability account",
      })
    } catch (e) {
      domainResponse(e, res)
    }
  }

  @Delete("/:availabilityAccountId")
  @Use([
    PermissionMiddleware,
    Can("financial_configuration", "availability_accounts"),
  ])
  async deleteAvailabilityAccount(
    @Param("availabilityAccountId") availabilityAccountId: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      await new DeleteAvailabilityAccount(
        AvailabilityAccountMongoRepository.getInstance(),
        {
          exists: async (accountId: string, churchId: string) => {
            const financialMovement =
              await FinanceRecordMongoRepository.getInstance().one({
                churchId,
                "availabilityAccount.availabilityAccountId": accountId,
              })

            return financialMovement !== undefined
          },
        },
        {
          exists: async (accountId: string, churchId: string) => {
            const bankStatement =
              await BankStatementMongoRepository.getInstance().one({
                churchId,
                "availabilityAccount.availabilityAccountId": accountId,
              })

            return bankStatement !== undefined
          },
        }
      ).execute({
        availabilityAccountId,
        churchId: req.auth.churchId,
      })

      res.status(HttpStatus.OK).send({
        message: "Deleted availability account",
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
