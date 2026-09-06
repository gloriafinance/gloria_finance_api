import {
  ConnectProviderBankAccount,
  CreateOrUpdateBank,
  FinBankByBankId,
  SearchBankByChurchId,
} from "@/Banking/applications"
import {
  type BankRequest,
  type ConnectExternalAccountRequest,
  CreateStaticPixForOfferingsDomainEvent,
  TypeBankAccount,
} from "@/Banking/domain"
import { CreateAvailabilityAccountDomainEvent } from "@/Banking/domain/events/CreateAvailabilityAccount.event.ts"
import {
  ChurchBankingClient,
  ChurchBankingClientError,
} from "@/Banking/infrastructure/church-banking/ChurchBankingClient"
import bankValidator from "@/Banking/infrastructure/http/validators/Bank.validator"
import connectAsaasAccountValidator from "@/Banking/infrastructure/http/validators/ConnectAsaasAccount.validator"
import { BankMongoRepository } from "@/Banking/infrastructure/persistence"
import { ChurchMongoRepository } from "@/Church/infrastructure"
import { AccountType } from "@/FinanceConfig/domain"
import { EventBus } from "@/package/events"
import { HttpStatus } from "@/Shared/domain"
import domainResponse from "@/Shared/helpers/domainResponse"
import {
  type AuthenticatedRequest,
  Can,
  PermissionMiddleware,
} from "@/Shared/infrastructure"
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
    @Body() request: Omit<ConnectExternalAccountRequest, "churchId">,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      const result = await new ConnectProviderBankAccount(
        new ChurchBankingClient()
      ).execute({
        ...request,
        churchId: req.auth.churchId,
      })

      const bank = new CreateOrUpdateBank(
        BankMongoRepository.getInstance(),
        ChurchMongoRepository.getInstance()
      ).execute({
        accountType: TypeBankAccount.CURRENT_ACCOUNT,
        active: true,
        name: request.connectionName,
        tag: request.connectionName,
        addressInstancePayment: "",
        bankInstruction: {
          codeBank: result.accountNumber.codeBank,
          agency: result.accountNumber.agency,
          account: `${result.accountNumber.account}-${result.accountNumber.accountDigit}`,
        },
        churchId: req.auth.churchId,
      })

      EventBus.instance().publish(
        new CreateAvailabilityAccountDomainEvent({
          balance: Number(result.availableBalanceInCents) / 100,
          churchId: req.auth.churchId,
          accountName: request.connectionName,
          accountType: AccountType.BANK,
          symbol: req.auth.symbolFormatMoney,
          source: bank,
        })
      )

      EventBus.instance().publish(
        new CreateStaticPixForOfferingsDomainEvent({
          churchId: req.auth.churchId,
        })
      )

      const church = await ChurchMongoRepository.getInstance().one({
        churchId: req.auth.churchId,
      })
      church!.enableAsaasConnect()
      await ChurchMongoRepository.getInstance().upsert(church!)

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
