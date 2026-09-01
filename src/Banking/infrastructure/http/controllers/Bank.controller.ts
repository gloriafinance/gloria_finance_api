import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  type ServerResponse,
  Use,
} from "bun-platform-kit"
import type {
  BankRequest,
  ConnectExternalAccountRequest,
} from "@/Banking/domain"
import {
  ConnectAsaasAccount,
  CreateOrUpdateBank,
  FinBankByBankId,
  SearchBankByChurchId,
} from "@/Banking/applications"
import { BankMongoRepository } from "@/Banking/infrastructure/persistence"
import {
  ChurchBankingClient,
  ChurchBankingClientError,
} from "@/Banking/infrastructure/church-banking/ChurchBankingClient"
import { ChurchMongoRepository } from "@/Church/infrastructure"
import { HttpStatus } from "@/Shared/domain"
import domainResponse from "@/Shared/helpers/domainResponse"
import {
  type AuthenticatedRequest,
  Can,
  PermissionMiddleware,
} from "@/Shared/infrastructure"
import bankValidator from "@/Banking/infrastructure/http/validators/Bank.validator"
import connectAsaasAccountValidator from "@/Banking/infrastructure/http/validators/ConnectAsaasAccount.validator"

const churchBankingClient = new ChurchBankingClient()

@Controller("/api/v1/bank")
export class BankController {
  @Post("/")
  @Use([PermissionMiddleware, Can("banking", "manage"), bankValidator])
  async createOrUpdate(
    @Body() request: BankRequest,
    @Res() res: ServerResponse
  ) {
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

  @Post("/asaas/connect")
  @Use([
    PermissionMiddleware,
    Can("banking", "manage"),
    connectAsaasAccountValidator,
  ])
  async connectAsaasAccount(
    @Body() request: Pick<ConnectExternalAccountRequest, "apiKey">,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      const result = await new ConnectAsaasAccount(churchBankingClient).execute(
        {
          churchId: req.auth.churchId,
          apiKey: request.apiKey,
        }
      )

      res.status(HttpStatus.OK).send(result)
    } catch (e) {
      if (e instanceof ChurchBankingClientError) {
        res.status(e.status).send({ code: e.code })
        return
      }

      domainResponse(e, res)
    }
  }

  @Get("/data/:bankId")
  @Use([PermissionMiddleware, Can("banking", "read")])
  async findByBankId(
    @Param("bankId") bankId: string,
    @Res() res: ServerResponse
  ) {
    try {
      const bank = await new FinBankByBankId(
        BankMongoRepository.getInstance()
      ).execute(bankId)

      res.status(HttpStatus.OK).send(bank)
    } catch (e) {
      domainResponse(e, res)
    }
  }

  @Get("/list/:churchId")
  @Use([PermissionMiddleware, Can("banking", "read")])
  async listByChurchId(
    @Param("churchId") churchId: string,
    @Res() res: ServerResponse
  ) {
    try {
      const bank = await new SearchBankByChurchId(
        BankMongoRepository.getInstance()
      ).execute(churchId)

      res.status(HttpStatus.OK).send(bank)
    } catch (e) {
      domainResponse(e, res)
    }
  }
}
