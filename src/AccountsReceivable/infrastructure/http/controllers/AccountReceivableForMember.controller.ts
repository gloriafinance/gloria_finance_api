import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  Req,
  Res,
  type ServerResponse,
  Use,
} from "@abejarano/ts-express-server"
import {
  type AuthenticatedRequest,
  Can,
  PermissionMiddleware,
  StorageGCP,
} from "@/Shared/infrastructure"
import DeclareInstallmentPaymentValidator from "@/AccountsReceivable/infrastructure/http/validators/DeclareInstallmentPayment.validator"
import {
  AccountReceivable,
  ActionsPaymentCommitment,
} from "@/AccountsReceivable/domain"
import type {
  ConfirmOrDenyPaymentCommitmentRequest,
  DeclareInstallmentPaymentRequest,
  FilterMemberAccountReceivableRequest,
} from "@/AccountsReceivable/domain"
import {
  ConfirmOrDenyPaymentCommitment,
  DeclareInstallmentPayment,
  ListMemberAccountReceivable,
} from "@/AccountsReceivable/applications"
import { AccountsReceivableMongoRepository } from "@/AccountsReceivable/infrastructure/persistence/AccountsReceivableMongoRepository"
import {
  ChurchMongoRepository,
  MemberMongoRepository,
} from "@/Church/infrastructure"
import { AvailabilityAccountMongoRepository } from "@/FinanceConfig/infrastructure/presistence"
import { RegisterContributionsOnline } from "@/Financial/applications"
import { OnlineContributionsMongoRepository } from "@/Financial/infrastructure"
import { FinancialYearMongoRepository } from "@/ConsolidatedFinancial/infrastructure"
import { HttpStatus } from "@/Shared/domain"
import domainResponse from "@/Shared/helpers/domainResponse"
import { FindMemberById } from "@/Church/applications"
import { Paginate } from "@abejarano/ts-mongodb-criteria"
import { HandlebarsHTMLAdapter, PuppeteerAdapter } from "@/Shared/adapter"

@Controller("/api/v1/account-receivable")
export class AccountReceivableForMemberController {
  @Patch("/confirm-payment-commitment")
  @Use(PermissionMiddleware)
  async confirmPaymentCommitment(
    @Body() req: ConfirmOrDenyPaymentCommitmentRequest,
    @Res() res: ServerResponse
  ) {
    try {
      const store = StorageGCP.getInstance(process.env.BUCKET_FILES)
      const account = await new ConfirmOrDenyPaymentCommitment(
        AccountsReceivableMongoRepository.getInstance(),
        new PuppeteerAdapter(new HandlebarsHTMLAdapter(), store),
        ChurchMongoRepository.getInstance(),
        //MinisterMongoRepository.getInstance(),
        MemberMongoRepository.getInstance()
      ).execute(req)

      if (req.action === ActionsPaymentCommitment.DENIED) {
        res.status(HttpStatus.OK).json({
          message: "Payment commitment rejected successfully.",
          contract: "",
        })

        return
      }

      const link = await store.downloadFile(account.getContract())

      res.status(HttpStatus.OK).json({
        message: "Payment commitment accepted successfully.",
        contract: link,
      })
    } catch (e) {
      domainResponse(e, res)
    }
  }

  @Get("/member/commitments")
  @Use([
    PermissionMiddleware,
    Can("accounts_receivable", ["member_commitments"]),
  ])
  async memberCommitments(
    @Query() req: FilterMemberAccountReceivableRequest,
    @Res() res: ServerResponse
  ) {
    try {
      const member = await new FindMemberById(
        MemberMongoRepository.getInstance()
      ).execute(req.memberId)

      const list: Paginate<AccountReceivable> =
        await new ListMemberAccountReceivable(
          AccountsReceivableMongoRepository.getInstance()
        ).execute({ ...req, debtorDNI: member.getDni() })

      res.status(HttpStatus.OK).json(list)
    } catch (e) {
      domainResponse(e, res)
    }
  }

  @Post("/payment-declaration")
  @Use([
    PermissionMiddleware,
    Can("accounts_receivable", "member_commitments"),
    DeclareInstallmentPaymentValidator,
  ])
  async paymentDeclaration(
    @Body() body: DeclareInstallmentPaymentRequest,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      await new DeclareInstallmentPayment(
        AccountsReceivableMongoRepository.getInstance(),
        MemberMongoRepository.getInstance(),
        AvailabilityAccountMongoRepository.getInstance(),
        new RegisterContributionsOnline(
          OnlineContributionsMongoRepository.getInstance(),
          StorageGCP.getInstance(process.env.BUCKET_FILES),
          FinancialYearMongoRepository.getInstance()
        )
      ).execute({
        ...body,
        memberId: req.auth.memberId,
        amount: Number(body.amount),
        file: req?.files?.file,
      })

      res.status(HttpStatus.OK).json({
        message: "Contribuição registrada e aguardando verificação.",
      })
    } catch (e) {
      domainResponse(e, res)
    }
  }
}
