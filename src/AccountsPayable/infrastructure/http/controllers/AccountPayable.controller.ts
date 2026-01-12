import {
  AuthenticatedRequest,
  Can,
  PermissionMiddleware,
  QueueService,
} from "@/Shared/infrastructure"
import {
  Body,
  Controller,
  Post,
  Req,
  Res,
  Use,
} from "@abejarano/ts-express-server"
import CreateAccountPayableValidator from "../validators/CreateAccountPayable.validator"
import { Response } from "express"
import { AccountPayableRequest } from "@/AccountsPayable/domain"
import {
  AccountsPayableMongoRepository,
  SupplierMongoRepository,
} from "../../persistence"
import { FinancialConceptMongoRepository } from "@/FinanceConfig/infrastructure/presistence"
import { HttpStatus } from "@/Shared/domain"
import domainResponse from "@/Shared/helpers/domainResponse"
import { CreateAccountPayable } from "@/AccountsPayable/applications"

@Controller("/api/v1/account-payable")
export class AccountPayableController {
  @Post("/")
  @Use([
    PermissionMiddleware,
    Can("accounts_payable", "manage"),
    CreateAccountPayableValidator,
  ])
  async create(
    @Body() body: AccountPayableRequest,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response
  ) {
    try {
      await new CreateAccountPayable(
        AccountsPayableMongoRepository.getInstance(),
        SupplierMongoRepository.getInstance(),
        FinancialConceptMongoRepository.getInstance(),
        QueueService.getInstance()
      ).execute({
        ...body,
        churchId: req.auth.churchId,
        createdBy: req.auth.name,
        symbol: req.auth.symbolFormatMoney,
      })
      res
        .status(HttpStatus.CREATED)
        .json({ message: "Account payable created successfully" })
    } catch (e) {
      domainResponse(e, res)
    }
  }
}
