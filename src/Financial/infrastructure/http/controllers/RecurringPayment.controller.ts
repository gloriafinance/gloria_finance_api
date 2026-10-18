import { AvailabilityAccountMongoRepository } from "@/FinanceConfig/infrastructure/presistence/AvailabilityAccountMongoRepository"
import { BankMongoRepository } from "@/Banking/infrastructure/persistence/BankMongoRepository"
import { ChurchBankingClient } from "@/Banking/infrastructure/church-banking/ChurchBankingClient"
import { ChurchBankingClientError } from "@/Banking/domain/exceptions/ChurchBankingClient.exception"
import { FinancialYearMongoRepository } from "@/ConsolidatedFinancial/infrastructure"
import { FinanceRecordMongoRepository } from "@/Financial/infrastructure/persistence/FinanceRecordMongoRepository"
import { RecurringPaymentsMongoRepository } from "@/Financial/infrastructure/persistence/RecurringPaymentsMongoRepository"
import { CreateOrUpdateRecurringPayment } from "@/Financial/applications/recurringPayments/CreateOrUpdateRecurringPayment"
import { ExecuteRecurringPayment } from "@/Financial/applications/recurringPayments/ExecuteRecurringPayment"
import { SimulateRecurringPaymentBill } from "@/Financial/applications/recurringPayments/SimulateRecurringPaymentBill"
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
  validateSimulateRecurringPaymentBill,
} from "../validators/RecurringPayment.validator"
import type {
  BillIdentificationInput,
  BillSimulation,
} from "@/Banking/domain/interfaces/ChurchBankingClient.interface"
import { saoPauloDate } from "@/Financial/applications/recurringPayments/RecurringPaymentCompetence"
import {
  FinancialConceptMongoRepository,
  FinancialConfigurationMongoRepository,
} from "@/FinanceConfig/infrastructure/presistence"
import { RegisterRecurringPaymentFinancialRecord } from "@/Financial/applications"
import { StorageProviderService } from "@/Shared/infrastructure"
import { FindAvailabilityAccountByAvailabilityAccountId } from "@/FinanceConfig/applications"
import { AccountType } from "@/FinanceConfig/domain"
import { RecurringPaymentException } from "@/Financial/domain"

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
        FinancialYearMongoRepository.getInstance(),
        new ChurchBankingClient()
      ).execute(req.auth.churchId, recurringPaymentId, body)
      res.status(HttpStatus.OK).send(result)
    } catch (error) {
      domainResponse(error, res)
    }
  }

  /**
   * Reads the boleto through church-banking so the payer can review it. It is a
   * preview: no money moves, no state is written and nothing is reserved.
   */
  @Post("/:recurringPaymentId/bill/simulate")
  @Use([
    PermissionMiddleware,
    Can("financial_records", "read"),
    validateSimulateRecurringPaymentBill,
  ])
  async simulateBill(
    @Param("recurringPaymentId") recurringPaymentId: string,
    @Body() body: BillIdentificationInput,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      const simulation: BillSimulation = await new SimulateRecurringPaymentBill(
        RecurringPaymentsMongoRepository.getInstance(),
        new ChurchBankingClient()
      ).execute(req.auth.churchId, recurringPaymentId, body)
      res.status(HttpStatus.OK).send(simulation)
    } catch (error) {
      // A provider outage stays an outage: it is never reported as an invalid
      // boleto, and no internal transport detail is exposed.
      if (error instanceof ChurchBankingClientError) {
        res.status(error.status).send({ code: error.code })
        return
      }
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
    @Body() bodyRequest: RegisterRecurringPaymentRequest,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      const file = req.files?.file

      const account = await new FindAvailabilityAccountByAvailabilityAccountId(
        AvailabilityAccountMongoRepository.getInstance()
      ).execute(bodyRequest.availabilityAccountId)

      if (!account) {
        throw new RecurringPaymentException(
          "RECURRING_PAYMENT_AVAILABILITY_ACCOUNT_UNAVAILABLE"
        )
      }

      if (
        (account.getType() === AccountType.BANK ||
          account.getType() === AccountType.WALLET) &&
        !file
      ) {
        throw new RecurringPaymentException(
          "RECURRING_PAYMENT_VOUCHER_REQUIRED"
        )
      }

      // Uploads arrive as multipart parts, never inside the parsed body.
      const body: RegisterRecurringPaymentManuallyInput = {
        ...bodyRequest,
        file,
      }
      const result = await new RegisterRecurringPaymentManually(
        RecurringPaymentsMongoRepository.getInstance(),
        FinanceRecordMongoRepository.getInstance(),
        AvailabilityAccountMongoRepository.getInstance(),
        BankMongoRepository.getInstance(),
        StorageProviderService.getInstance(),
        new RegisterRecurringPaymentFinancialRecord(
          FinanceRecordMongoRepository.getInstance(),
          AvailabilityAccountMongoRepository.getInstance(),
          FinancialConceptMongoRepository.getInstance(),
          FinancialConfigurationMongoRepository.getInstance()
        )
      ).execute(
        req.auth.churchId,
        recurringPaymentId,
        req.auth.userId ?? req.auth.memberId ?? "unknown",
        body
      )
      res.status(HttpStatus.ACCEPTED).send(result)
    } catch (error) {
      domainResponse(error, res)
    }
  }
}
