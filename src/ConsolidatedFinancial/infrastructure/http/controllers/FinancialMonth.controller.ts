import { Request, Response } from "express"
import domainResponse from "@/Shared/helpers/domainResponse"
import { UpdateFinancialMonth } from "@/ConsolidatedFinancial/applications/FinancialMonth"
import { FinancialYearMongoRepository } from "@/ConsolidatedFinancial/infrastructure"
import { HttpStatus } from "@/Shared/domain"
import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Use,
} from "@abejarano/ts-express-server"
import { Can, PermissionMiddleware } from "@/Shared/infrastructure"
import { ListFinancialMonth } from "@/ConsolidatedFinancial/applications"
import { ListFinancialMonthRequest } from "@/ConsolidatedFinancial/domain"
import FinancialMonthValidator from "../validator/FinancialMonth.validator"
import { GenerateFinanceRecordReport } from "@/Financial/applications"
import { GenerateFinancialMonthsService } from "../../services/GenerateFinancialMonths.service"

@Controller("/api/v1/finance/consolidate")
export class FinancialMonthController {
  @Patch("/")
  @Use([PermissionMiddleware, Can("consolidated_financial", "generate_months")])
  async UpdateFinancialMonthController(req: Request, res: Response) {
    try {
      await new UpdateFinancialMonth(
        FinancialYearMongoRepository.getInstance()
      ).execute({
        ...req.body,
        churchId: req.auth.churchId,
        closedBy: req.auth.name,
      })

      res
        .status(HttpStatus.OK)
        .send({ message: "Financial month updated successfully" })
    } catch (e) {
      domainResponse(e, res)
    }
  }

  @Get("/")
  @Use([
    PermissionMiddleware,
    FinancialMonthValidator,
    Can("consolidated_financial", "generate_months"),
  ])
  async GetFinancialMonthController(req: Request, res: Response) {
    try {
      const list = await new ListFinancialMonth(
        FinancialYearMongoRepository.getInstance()
      ).execute({
        year: Number(req.query.year),
        churchId: req.auth.churchId,
      } as ListFinancialMonthRequest)

      res.status(HttpStatus.OK).send(list)
    } catch (e) {
      domainResponse(e, res)
    }
  }

  @Post("/")
  @Use([PermissionMiddleware, Can("consolidated_financial", "generate_months")])
  async generate(@Body() req: { year: number }, res: Response) {
    try {
      await GenerateFinancialMonthsService(req.year)

      res
        .status(HttpStatus.OK)
        .send({ message: "Financial month generate successfully" })
    } catch (e) {
      domainResponse(e, res)
    }
  }
}
