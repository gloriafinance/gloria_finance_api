import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  type ServerResponse,
  Use,
} from "bun-platform-kit"
import type { AuthenticatedRequest } from "@/Shared/infrastructure"
import {
  Can,
  PermissionMiddleware,
  QueueService,
  StorageGCP,
} from "@/Shared/infrastructure"
import CreateAccountReceivableValidator from "@/AccountsReceivable/infrastructure/http/validators/CreateAccountReceivable.validator"
import { FindChurchById } from "@/Church/applications"
import {
  ChurchMongoRepository,
  MemberMongoRepository,
} from "@/Church/infrastructure"
import {
  CreateAccountReceivable,
  ListAccountReceivable,
  PayAccountReceivable,
} from "@/AccountsReceivable/applications"
import { AccountsReceivableMongoRepository } from "@/AccountsReceivable/infrastructure/persistence/AccountsReceivableMongoRepository"
import {
  AvailabilityAccountMongoRepository,
  FinancialConceptMongoRepository,
} from "@/FinanceConfig/infrastructure/presistence"
import {
  AccountReceivable,
  type AccountReceivableRequest,
  AccountReceivableType,
  type FilterAccountReceivableRequest,
  type PayAccountReceivableRequest,
} from "@/AccountsReceivable/domain"
import { NotifyPaymentCommitment } from "@/PushNotifications/applications"
import { AmountValue, HttpStatus } from "@/Shared/domain"
import domainResponse from "@/Shared/helpers/domainResponse"
import { Logger } from "@/Shared/adapter"
import type { Paginate } from "@abejarano/ts-mongodb-criteria"
import PayAccountReceivableValidator from "@/AccountsReceivable/infrastructure/http/validators/PayAccountReceivable.validator"
import { FinanceRecordMongoRepository } from "@/Financial/infrastructure"
import { CreateFinancialRecordJob } from "@/Financial/applications"
import { FinancialYearMongoRepository } from "@/ConsolidatedFinancial/infrastructure"
import { toFinancialRecordType } from "@/Financial/domain/mappers"
import {
  FinancialRecordSource,
  FinancialRecordStatus,
} from "@/Financial/domain"
import { DateBR } from "@/Shared/helpers"
import { SendMailPaymentCommitment } from "@/package/email/applications"

@Controller("/api/v1/account-receivable")
export class AccountReceivableController {
  @Post("/")
  @Use([
    PermissionMiddleware,
    Can("accounts_receivable", "manage"),
    CreateAccountReceivableValidator,
  ])
  async create(
    @Body() body: AccountReceivableRequest,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      const church = await new FindChurchById(
        ChurchMongoRepository.getInstance()
      ).execute(req.auth.churchId)

      const account = await new CreateAccountReceivable(
        AccountsReceivableMongoRepository.getInstance(),
        FinancialConceptMongoRepository.getInstance(),
        new SendMailPaymentCommitment(QueueService.getInstance())
      ).execute({
        ...body,
        createdBy: req.auth.name,
        church: church,
        symbol: req.auth.symbolFormatMoney,
      })

      if (
        body.type === AccountReceivableType.CONTRIBUTION ||
        body.type === AccountReceivableType.LOAN
      ) {
        await new NotifyPaymentCommitment(
          MemberMongoRepository.getInstance(),
          QueueService.getInstance()
        ).execute({
          account,
        })
      }

      if (body.type === AccountReceivableType.LOAN) {
        const financialConcept =
          (await FinancialConceptMongoRepository.getInstance().one({
            financialConceptId: body.financialConceptId,
          }))!

        const availabilityAccount =
          await AvailabilityAccountMongoRepository.getInstance().one({
            availabilityAccountId: body.availabilityAccountId,
          })

        let amount = 0
        body.installments.forEach(
          (installment) => (amount += installment.amount)
        )

        await new CreateFinancialRecordJob(
          FinancialYearMongoRepository.getInstance(),
          FinanceRecordMongoRepository.getInstance(),
          StorageGCP.getInstance(process.env.BUCKET_FILES!),
          QueueService.getInstance()
        ).handle({
          createdBy: req.auth.userId!,
          description: `${financialConcept.getName()}: ${body.debtor.name}`,
          financialConcept,
          churchId: availabilityAccount?.getChurchId()!,
          amount,
          date: DateBR(),
          financialRecordType: toFinancialRecordType(
            financialConcept.getType()
          ),
          availabilityAccount,
          status: FinancialRecordStatus.CLEARED,
          source: FinancialRecordSource.MANUAL,
        })
      }

      res
        .status(HttpStatus.CREATED)
        .json({ message: "Account receivable created successfully" })
    } catch (e) {
      domainResponse(e, res)
    }
  }

  @Get("/")
  @Use([PermissionMiddleware, Can("accounts_receivable", "read")])
  async list(
    @Query() query: FilterAccountReceivableRequest,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      const logger = Logger("ListAccountReceivableController")

      const list: Paginate<AccountReceivable> = await new ListAccountReceivable(
        AccountsReceivableMongoRepository.getInstance()
      ).execute({
        ...query,
        churchId: req.auth.churchId,
      })

      logger.info(`Response list account receivable ${list.results.length}`)

      res.status(HttpStatus.OK).send(list)
    } catch (e) {
      domainResponse(e, res)
    }
  }

  @Post("/pay")
  @Use([
    PermissionMiddleware,
    Can("accounts_receivable", "apply_payments"),
    PayAccountReceivableValidator,
  ])
  async pay(
    @Body() body: PayAccountReceivableRequest,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      const installmentId = body.installmentId
      let installmentIds: string[] = []

      if (installmentId.includes(",")) {
        installmentIds = installmentId.split(",")
      } else {
        installmentIds = [installmentId]
      }

      await new PayAccountReceivable(
        FinanceRecordMongoRepository.getInstance(),
        AvailabilityAccountMongoRepository.getInstance(),
        AccountsReceivableMongoRepository.getInstance(),
        QueueService.getInstance()
      ).execute({
        ...body,
        churchId: req.auth.churchId,
        createdBy: req.auth.name,
        installmentIds,
        amount: AmountValue.create(Number(body.amount)),
        file: req?.files?.file,
      })

      res
        .status(HttpStatus.OK)
        .json({ message: "Account receivable paid successfully" })
    } catch (e) {
      domainResponse(e, res)
    }
  }
}
