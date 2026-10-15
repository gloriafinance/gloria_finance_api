import { FinancialConceptMongoRepository } from "@/FinanceConfig/infrastructure/presistence/FinancialConceptMongoRepository"
import { FinancialConfigurationMongoRepository } from "@/FinanceConfig/infrastructure/presistence/FinancialConfigurationMongoRepository"
import { AvailabilityAccountMongoRepository } from "@/FinanceConfig/infrastructure/presistence/AvailabilityAccountMongoRepository"
import { BankMongoRepository } from "@/Banking/infrastructure/persistence/BankMongoRepository"
import { ChurchBankingClient } from "@/Banking/infrastructure/church-banking/ChurchBankingClient"
import { AsaasReceiptStorage } from "@/Webhook/infrastructure/services/AsaasReceiptStorage"
import { FinanceRecordMongoRepository } from "@/Financial/infrastructure/persistence/FinanceRecordMongoRepository"
import { RecurringPaymentsMongoRepository } from "@/Financial/infrastructure/persistence/RecurringPaymentsMongoRepository"
import { CreateOrUpdateRecurringPayment } from "@/Financial/applications/recurringPayments/CreateOrUpdateRecurringPayment"
import { ExecuteRecurringPayment } from "@/Financial/applications/recurringPayments/ExecuteRecurringPayment"
import {
  RegisterRecurringPaymentManually,
  type RegisterRecurringPaymentManuallyInput,
} from "@/Financial/applications/recurringPayments/RegisterRecurringPaymentManually"
import {
  ListRecurringPayments,
  type RecurringPaymentForCompetence,
} from "@/Financial/applications/recurringPayments/ListRecurringPayments"
import type { RecurringPaymentConfigurationData } from "@/Financial/domain/RecurringPayments"
import type {
  PayRecurringPaymentRequest,
  RecurringPaymentConfigurationRequest,
  RegisterRecurringPaymentRequest,
} from "@/Financial/domain/requests/RecurringPayment.request"
import { HttpStatus } from "@/Shared/domain/enums/HttpStatus.enum"
import domainResponse from "@/Shared/helpers/domainResponse"
import type { AuthenticatedRequest } from "@/Shared/infrastructure/types/AuthenticatedRequest.type"
import { Can } from "@/Shared/infrastructure/middleware/Can.middleware"
import { PermissionMiddleware } from "@/Shared/infrastructure/middleware/Permission.middleware"
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  type ServerResponse,
  Use,
} from "bun-platform-kit"
import {
  validatePayRecurringPayment,
  validateRecurringPaymentConfiguration,
  validateRegisterRecurringPayment,
} from "../validators/RecurringPayment.validator"
import { saoPauloDate } from "@/Financial/applications/recurringPayments/RecurringPaymentCompetence"

@Controller("/api/v1/recurring-payments")
export class RecurringPaymentController {
  @Post("/")
  @Use([
    PermissionMiddleware,
    Can("financial_configuration", "manage_concepts"),
    validateRecurringPaymentConfiguration,
  ])
  async create(
    @Body() body: RecurringPaymentConfigurationRequest,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      const payment = await new CreateOrUpdateRecurringPayment(
        RecurringPaymentsMongoRepository.getInstance(),
        FinancialConceptMongoRepository.getInstance(),
        FinancialConfigurationMongoRepository.getInstance()
      ).create(req.auth.churchId, body)
      const response: RecurringPaymentConfigurationData =
        payment.toConfiguration()
      res.status(HttpStatus.CREATED).send(response)
    } catch (error) {
      domainResponse(error, res)
    }
  }

  @Put("/:id")
  @Use([
    PermissionMiddleware,
    Can("financial_configuration", "manage_concepts"),
    validateRecurringPaymentConfiguration,
  ])
  async update(
    @Param("id") id: string,
    @Body() body: RecurringPaymentConfigurationRequest,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      const payment = await new CreateOrUpdateRecurringPayment(
        RecurringPaymentsMongoRepository.getInstance(),
        FinancialConceptMongoRepository.getInstance(),
        FinancialConfigurationMongoRepository.getInstance()
      ).update(req.auth.churchId, id, body)
      const response: RecurringPaymentConfigurationData =
        payment.toConfiguration()
      res.status(HttpStatus.OK).send(response)
    } catch (error) {
      domainResponse(error, res)
    }
  }

  @Get("/")
  @Use([PermissionMiddleware, Can("financial_records", "read")])
  async list(
    @Query() query: { competence?: string },
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      const competence = query.competence ?? saoPauloDate().slice(0, 7)
      const response: RecurringPaymentForCompetence[] =
        await new ListRecurringPayments(
          RecurringPaymentsMongoRepository.getInstance(),
          FinanceRecordMongoRepository.getInstance()
        ).execute(req.auth.churchId, competence)
      res.status(HttpStatus.OK).send(response)
    } catch (error) {
      domainResponse(error, res)
    }
  }

  @Post("/:recurringPaymentId/pay")
  @Use([
    PermissionMiddleware,
    Can("financial_records", "create"),
    validatePayRecurringPayment,
  ])
  async pay(
    @Param("recurringPaymentId") recurringPaymentId: string,
    @Body() body: PayRecurringPaymentRequest,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      const result = await new ExecuteRecurringPayment(
        RecurringPaymentsMongoRepository.getInstance(),
        FinanceRecordMongoRepository.getInstance(),
        BankMongoRepository.getInstance(),
        AvailabilityAccountMongoRepository.getInstance(),
        FinancialConceptMongoRepository.getInstance(),
        FinancialConfigurationMongoRepository.getInstance(),
        new ChurchBankingClient(),
        new AsaasReceiptStorage()
      ).execute(req.auth.churchId, recurringPaymentId, body)
      res.status(HttpStatus.OK).send(result)
    } catch (error) {
      domainResponse(error, res)
    }
  }

  /**
   * Manual registration for a commitment paid outside the bank. The voucher is
   * required and arrives as multipart/form-data.
   */
  @Post("/:recurringPaymentId/register-payment")
  @Use([
    PermissionMiddleware,
    Can("financial_records", "create"),
    validateRegisterRecurringPayment,
  ])
  async registerPayment(
    @Param("recurringPaymentId") recurringPaymentId: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      // Uploads arrive as multipart parts, never inside the parsed body.
      const body: RegisterRecurringPaymentManuallyInput = {
        ...(req.body as RegisterRecurringPaymentRequest),
        file: req.files?.file,
      }
      const result = await new RegisterRecurringPaymentManually(
        RecurringPaymentsMongoRepository.getInstance(),
        FinanceRecordMongoRepository.getInstance(),
        FinancialConceptMongoRepository.getInstance(),
        FinancialConfigurationMongoRepository.getInstance(),
        AvailabilityAccountMongoRepository.getInstance(),
        BankMongoRepository.getInstance()
      ).execute(
        req.auth.churchId,
        recurringPaymentId,
        req.auth.userId ?? req.auth.memberId ?? "unknown",
        body
      )
      res.status(HttpStatus.OK).send(result)
    } catch (error) {
      domainResponse(error, res)
    }
  }
}
