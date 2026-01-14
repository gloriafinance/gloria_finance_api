import type {
  FilterPurchasesRequest,
  RecordPurchaseRequest,
} from "../../../domain/requests"

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

import domainResponse from "../../../../Shared/helpers/domainResponse"
import { RecordPurchase, SearchPurchase } from "../../../applications"
import { PurchaseMongoRepository } from "../../persistence/PurchaseMongoRepository"
import { AvailabilityAccountMongoRepository } from "@/Financial/infrastructure/persistence"
import { HttpStatus } from "@/Shared/domain"
import { Can, PermissionMiddleware, StorageGCP } from "@/Shared/infrastructure"
import type { AuthenticatedRequest } from "@/Shared/infrastructure"
import { FinancialMonthValidator } from "@/ConsolidatedFinancial/applications"
import { FinancialYearMongoRepository } from "@/ConsolidatedFinancial/infrastructure"
import PurchasePaginateDto from "../dto/PurchasePaginate.dto"
import { QueueService } from "@/Shared/infrastructure/queue/QueueService"
import {
  FinancialConceptMongoRepository,
  FinancialConfigurationMongoRepository,
} from "@/FinanceConfig/infrastructure/presistence"
import PurchaseValidator from "../validators/Purchase.validator"

type RecordPurchasePayload = Omit<
  RecordPurchaseRequest,
  "churchId" | "createdBy" | "invoice" | "file"
>

@Controller("/api/v1/purchase")
export class PurchaseController {
  @Post("/")
  @Use([PermissionMiddleware, Can("purchases", "manage"), PurchaseValidator])
  async record(
    @Body() body: RecordPurchasePayload,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    const request: RecordPurchaseRequest = {
      ...body,
      churchId: req.auth.churchId,
      file: req.files?.invoice,
      createdBy: req.auth.name,
      invoice: "",
    }

    try {
      const date = new Date(request.purchaseDate)

      await new FinancialMonthValidator(
        FinancialYearMongoRepository.getInstance()
      ).validate({
        churchId: request.churchId,
        month: date.getUTCMonth() + 1,
        year: date.getFullYear(),
      })

      request.invoice = await StorageGCP.getInstance(
        process.env.BUCKET_FILES
      ).uploadFile(request.file)

      await new RecordPurchase(
        PurchaseMongoRepository.getInstance(),
        AvailabilityAccountMongoRepository.getInstance(),
        FinancialConfigurationMongoRepository.getInstance(),
        FinancialConceptMongoRepository.getInstance(),
        QueueService.getInstance()
      ).execute(request)

      res.status(HttpStatus.CREATED).send({ message: "Purchase recorded" })
    } catch (e) {
      if (request.invoice) {
        await StorageGCP.getInstance(process.env.BUCKET_FILES).deleteFile(
          request.invoice
        )
      }
      domainResponse(e, res)
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
}
