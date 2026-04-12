import type {
  FilterPurchasesRequest,
  RecordPurchaseRequest,
} from "../../../domain/requests"

import type { ServerResponse } from "bun-platform-kit"
import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  Use,
} from "bun-platform-kit"

import domainResponse from "../../../../Shared/helpers/domainResponse"
import {
  RecordPurchase,
  RegisterCreditPurchases,
  SearchPurchase,
} from "../../../applications"
import { PurchaseMongoRepository } from "../../persistence/PurchaseMongoRepository"
import { AvailabilityAccountMongoRepository } from "@/Financial/infrastructure/persistence"
import { HttpStatus } from "@/Shared/domain"
import type { AuthenticatedRequest } from "@/Shared/infrastructure"
import {
  Can,
  PermissionMiddleware,
  StorageProviderService,
} from "@/Shared/infrastructure"
import { FinancialMonthValidator } from "@/ConsolidatedFinancial/applications"
import { FinancialYearMongoRepository } from "@/ConsolidatedFinancial/infrastructure"
import PurchasePaginateDto from "../dto/PurchasePaginate.dto"
import { QueueService } from "@/package/queue/infrastructure/QueueService.ts"
import { mergePdfFiles } from "@/Shared/helpers/mergePdfFiles"
import {
  FinancialConceptMongoRepository,
  FinancialConfigurationMongoRepository,
} from "@/FinanceConfig/infrastructure/presistence"
import PurchaseValidator from "../validators/Purchase.validator"
import {
  AccountPayableTaxStatus,
  TaxDocumentType,
} from "@/AccountsPayable/domain"
import { CreateAccountPayable } from "@/AccountsPayable/applications"
import {
  AccountsPayableMongoRepository,
  SupplierMongoRepository,
} from "@/AccountsPayable/infrastructure/persistence"
import CreditPurchaseValidator from "@/Purchases/infrastructure/http/validators/CreditPurchase.validator.ts"

type RecordPurchasePayload = Omit<
  RecordPurchaseRequest,
  "churchId" | "createdBy" | "invoice" | "file"
>

const normalizeFiles = (files: any): any[] =>
  Array.isArray(files) ? files : files ? [files] : []

@Controller("/api/v1/purchase")
export class PurchaseController {
  @Post("/")
  @Use([PermissionMiddleware, Can("purchases", "manage"), PurchaseValidator])
  async record(
    @Body() body: RecordPurchasePayload,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    let request: RecordPurchaseRequest | undefined

    try {
      request = await this.preparePayload(body, req)

      await new RecordPurchase(
        PurchaseMongoRepository.getInstance(),
        AvailabilityAccountMongoRepository.getInstance(),
        FinancialConfigurationMongoRepository.getInstance(),
        FinancialConceptMongoRepository.getInstance(),
        QueueService.getInstance()
      ).execute(request)

      res.status(HttpStatus.CREATED).send({ message: "Purchase recorded" })
    } catch (e) {
      if (request?.invoice) {
        await StorageProviderService.getInstance().deleteFile(request.invoice)
      }
      domainResponse(e, res)
    }
  }

  @Post("/credit")
  @Use([
    PermissionMiddleware,
    Can("purchases", "manage"),
    CreditPurchaseValidator,
  ])
  async creditPurchases(
    @Body()
    body: RecordPurchasePayload & {
      supplierId: string
      description: string
      amountTotal?: number
      taxDocument: {
        type: TaxDocumentType
        number?: string
        date: Date
      }
      installments?: {
        amount: number
        dueDate: Date
      }[]
      taxes?: {
        taxType: string
        percentage: number
        amount?: number
        status?: AccountPayableTaxStatus
      }[]
    },
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    let request: any
    try {
      request = {
        ...body,
        churchId: req.auth.churchId,
        createdBy: req.auth.name,
        symbol: req.auth.symbolFormatMoney,
        invoice: "",
      } as any

      await new RegisterCreditPurchases(
        new CreateAccountPayable(
          AccountsPayableMongoRepository.getInstance(),
          SupplierMongoRepository.getInstance()
        ),
        PurchaseMongoRepository.getInstance(),
        FinancialConfigurationMongoRepository.getInstance()
      ).execute(request)

      res.status(HttpStatus.CREATED).send({ message: "Purchase recorded" })
    } catch (e) {
      if (request?.invoice) {
        await StorageProviderService.getInstance().deleteFile(request.invoice)
      }

      return domainResponse(e, res)
    }
  }

  @Get("/")
  @Use([PermissionMiddleware, Can("purchases", "read")])
  async list(
    @Query() query: FilterPurchasesRequest,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      const list = await new SearchPurchase(
        PurchaseMongoRepository.getInstance()
      ).execute({
        ...query,
        churchId: req.auth.churchId,
      })

      res.status(HttpStatus.OK).send(await PurchasePaginateDto(list))
    } catch (e) {
      return domainResponse(e, res)
    }
  }

  private async preparePayload(
    @Body() body: RecordPurchasePayload,
    @Req() req: AuthenticatedRequest
  ): Promise<RecordPurchaseRequest> {
    const invoiceFiles = normalizeFiles(req.files?.file)
    const invoiceFile = await mergePdfFiles(invoiceFiles)

    const request = {
      ...body,
      churchId: req.auth.churchId,
      createdBy: req.auth.name,
      invoice: "",
    }
    const date = new Date(request.purchaseDate)

    await new FinancialMonthValidator(
      FinancialYearMongoRepository.getInstance()
    ).validate({
      churchId: request.churchId,
      month: date.getUTCMonth() + 1,
      year: date.getFullYear(),
    })

    request.invoice =
      await StorageProviderService.getInstance().uploadFile(invoiceFile)

    return request
  }
}
