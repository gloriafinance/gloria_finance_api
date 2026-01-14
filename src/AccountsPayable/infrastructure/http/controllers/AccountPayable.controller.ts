import {
  Can,
  PermissionMiddleware,
  QueueService,
} from "@/Shared/infrastructure"
import type { AuthenticatedRequest } from "@/Shared/infrastructure"
import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  Use,
} from "@abejarano/ts-express-server"
import type { ServerResponse } from "@abejarano/ts-express-server"

import CreateAccountPayableValidator from "../validators/CreateAccountPayable.validator"
import PayAccountPayableValidator from "../validators/PayAccountPayable.validator"
import RegisterSupplierValidator from "../validators/RegisterSupplier.validator"
import type {
  AccountPayableRequest,
  FilterAccountPayableRequest,
  PayAccountPayableRequest,
} from "@/AccountsPayable/domain"
import {
  AccountsPayableMongoRepository,
  SupplierMongoRepository,
} from "../../persistence"
import {
  FinancialConceptMongoRepository,
  FinancialConfigurationMongoRepository,
} from "@/FinanceConfig/infrastructure/presistence"
import { AmountValue, HttpStatus } from "@/Shared/domain"
import domainResponse from "@/Shared/helpers/domainResponse"
import {
  AllSupplier,
  CreateAccountPayable,
  ListAccountsPayable,
  PayAccountPayable,
  RegisterSuppliers,
} from "@/AccountsPayable/applications"
import { Cache } from "@/Shared/decorators"
import type { ISupplier } from "@/AccountsPayable/domain/interfaces/Supplier"
import { Logger } from "@/Shared/adapter"
import { AvailabilityAccountMongoRepository } from "@/Financial/infrastructure/persistence"

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
    @Res() res: ServerResponse
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

  @Post("/pay")
  @Use([
    PermissionMiddleware,
    Can("accounts_payable", "reconcile"),
    PayAccountPayableValidator,
  ])
  async pay(
    @Body()
    body: PayAccountPayableRequest & {
      amount: number
    },
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      const installmentIds = body.installmentId.includes(",")
        ? body.installmentId.split(",")
        : [body.installmentId]

      await new PayAccountPayable(
        AvailabilityAccountMongoRepository.getInstance(),
        AccountsPayableMongoRepository.getInstance(),
        QueueService.getInstance(),
        FinancialConceptMongoRepository.getInstance(),
        FinancialConfigurationMongoRepository.getInstance()
      ).execute({
        ...body,
        createdBy: req.auth.name,
        installmentIds,
        amount: AmountValue.create(body.amount),
        file: req?.files?.file,
      })

      res
        .status(HttpStatus.OK)
        .json({ message: "Account payable paid successfully" })
    } catch (e) {
      domainResponse(e, res)
    }
  }

  @Get("/")
  @Use([PermissionMiddleware, Can("accounts_payable", "read")])
  async list(
    @Query() query: FilterAccountPayableRequest,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      const logger = Logger("ListAccountPayableController")

      const list = await new ListAccountsPayable(
        AccountsPayableMongoRepository.getInstance()
      ).execute({
        ...query,
        churchId: req.auth.churchId,
      })

      logger.info("Response list account payable", list)

      res.status(HttpStatus.OK).send(list)
    } catch (e) {
      domainResponse(e, res)
    }
  }

  @Post("/supplier")
  @Use([
    PermissionMiddleware,
    Can("accounts_payable", "suppliers_manage"),
    RegisterSupplierValidator,
  ])
  async registerSupplier(
    @Body() body: ISupplier,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      await new RegisterSuppliers(
        SupplierMongoRepository.getInstance()
      ).execute({
        ...body,
        churchId: req.auth.churchId,
      })

      res.status(HttpStatus.CREATED).json({
        message: "Successfully registered",
      })
    } catch (e) {
      domainResponse(e, res)
    }
  }

  @Cache("suppliers", 600)
  @Get("/supplier")
  @Use([PermissionMiddleware, Can("accounts_payable", "suppliers_manage")])
  async listSuppliers(
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      res
        .status(HttpStatus.OK)
        .send(
          await new AllSupplier(SupplierMongoRepository.getInstance()).execute(
            req.auth.churchId
          )
        )
    } catch (e) {
      domainResponse(e, res)
    }
  }
}
