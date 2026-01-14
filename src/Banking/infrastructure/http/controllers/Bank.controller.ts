import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  Use,
} from "@abejarano/ts-express-server"
import type { BankRequest } from "@/Banking/domain"
import {
  CreateOrUpdateBank,
  FinBankByBankId,
  SearchBankByChurchId,
} from "@/Banking/applications"
import { BankMongoRepository } from "@/Banking/infrastructure/persistence"
import { ChurchMongoRepository } from "@/Church/infrastructure"
import { HttpStatus } from "@/Shared/domain"
import domainResponse from "@/Shared/helpers/domainResponse"
import { Can, PermissionMiddleware } from "@/Shared/infrastructure"
import bankValidator from "@/Banking/infrastructure/http/validators/Bank.validator"

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
