import { Response } from "express"
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Res,
  Use,
} from "@abejarano/ts-express-server"
import { HttpStatus } from "@/Shared/domain"
import domainResponse from "@/Shared/helpers/domainResponse"
import {
  ActivateScheduleItem,
  CreateScheduleItem,
  DeactivateScheduleItem,
  GetScheduleItem,
  ListScheduleItemsConfig,
  ListWeeklyScheduleOccurrences,
  UpdateScheduleItem,
} from "@/Schedule/application"
import { ScheduleItemMongoRepository } from "@/Schedule/infrastructure"
import { ChurchMongoRepository } from "@/Church/infrastructure"
import {
  CreateScheduleItemRequest,
  ListScheduleItemsFiltersRequest,
  UpdateScheduleItemRequest,
  WeeklyScheduleOccurrencesRequest,
} from "@/Schedule/domain/requests/ScheduleItem.request"
import {
  AuthenticatedRequest,
  Can,
  PermissionMiddleware,
} from "@/Shared/infrastructure"
import CreateScheduleItemValidator from "../validators/CreateScheduleItem.validator"
import UpdateScheduleItemValidator from "../validators/UpdateScheduleItem.validator"
import ScheduleItemsQueryValidator from "../validators/ScheduleItemsQuery.validator"
import WeeklyScheduleQueryValidator from "../validators/WeeklyScheduleQuery.validator"

import { ensureChurchScope } from "../utils/scheduleScope"
import { mapToConfigDTO } from "../utils/scheduleMapper"

type WeeklyScheduleQuery = Pick<
  WeeklyScheduleOccurrencesRequest,
  "weekStartDate" | "visibilityScope"
>

@Controller("/api/v1/schedule/churches/:churchId")
export class ScheduleController {
  private readonly scheduleItemRepository =
    ScheduleItemMongoRepository.getInstance()
  private readonly churchRepository = ChurchMongoRepository.getInstance()

  @Post("/schedule-items")
  @Use([
    PermissionMiddleware,
    Can("schedule", ["configure", "manage"]),
    CreateScheduleItemValidator,
  ])
  async createScheduleItem(
    @Param("churchId") churchId: string,
    @Body() body: CreateScheduleItemRequest,
    @Res() res: Response,
    req: AuthenticatedRequest
  ) {
    try {
      if (!ensureChurchScope(req, res, churchId)) return

      const scheduleItem = await new CreateScheduleItem(
        this.scheduleItemRepository,
        this.churchRepository
      ).execute({
        ...body,
        churchId,
        currentUserId: req.auth?.userId,
      })

      res.status(HttpStatus.CREATED).send(mapToConfigDTO(scheduleItem))
    } catch (error) {
      domainResponse(error, res)
    }
  }

  @Get("/schedule-items")
  @Use([
    PermissionMiddleware,
    Can("schedule", ["configure", "manage", "read"]),
    ScheduleItemsQueryValidator,
  ])
  async listScheduleItems(
    @Param("churchId") churchId: string,
    @Query() query: ListScheduleItemsFiltersRequest["filters"],
    @Res() res: Response,
    req: AuthenticatedRequest
  ) {
    try {
      if (!ensureChurchScope(req, res, churchId)) return

      const scheduleItems = await new ListScheduleItemsConfig(
        this.scheduleItemRepository
      ).execute({
        churchId,
        filters: query,
      })

      res.status(HttpStatus.OK).send(scheduleItems)
    } catch (error) {
      domainResponse(error, res)
    }
  }

  @Get("/schedule-items/:scheduleItemId")
  @Use([PermissionMiddleware, Can("schedule", ["configure", "manage", "read"])])
  async getScheduleItem(
    @Param("churchId") churchId: string,
    @Param("scheduleItemId") scheduleItemId: string,
    @Res() res: Response,
    req: AuthenticatedRequest
  ) {
    try {
      if (!ensureChurchScope(req, res, churchId)) return

      const scheduleItem = await new GetScheduleItem(
        this.scheduleItemRepository
      ).execute({
        churchId,
        scheduleItemId,
      })

      res.status(HttpStatus.OK).send(mapToConfigDTO(scheduleItem))
    } catch (error) {
      domainResponse(error, res)
    }
  }

  @Put("/schedule-items/:scheduleItemId")
  @Use([
    PermissionMiddleware,
    Can("schedule", ["configure", "manage"]),
    UpdateScheduleItemValidator,
  ])
  async updateScheduleItem(
    @Param("churchId") churchId: string,
    @Param("scheduleItemId") scheduleItemId: string,
    @Body() body: UpdateScheduleItemRequest,
    @Res() res: Response,
    req: AuthenticatedRequest
  ) {
    try {
      if (!ensureChurchScope(req, res, churchId)) return

      await new UpdateScheduleItem(this.scheduleItemRepository).execute({
        ...body,
        churchId,
        scheduleItemId,
        currentUserId: req.auth?.userId,
      })

      const scheduleItem = await new GetScheduleItem(
        this.scheduleItemRepository
      ).execute({
        churchId,
        scheduleItemId,
      })

      res.status(HttpStatus.OK).send(mapToConfigDTO(scheduleItem))
    } catch (error) {
      domainResponse(error, res)
    }
  }

  @Delete("/schedule-items/:scheduleItemId")
  @Use([PermissionMiddleware, Can("schedule", ["configure", "manage"])])
  async deactivateScheduleItem(
    @Param("churchId") churchId: string,
    @Param("scheduleItemId") scheduleItemId: string,
    @Res() res: Response,
    req: AuthenticatedRequest
  ) {
    try {
      if (!ensureChurchScope(req, res, churchId)) return

      await new DeactivateScheduleItem(this.scheduleItemRepository).execute({
        churchId,
        scheduleItemId,
        currentUserId: req.auth?.userId,
      })

      res
        .status(HttpStatus.OK)
        .send({ message: "Schedule item deactivated successfully" })
    } catch (error) {
      domainResponse(error, res)
    }
  }

  @Post("/schedule-items/:scheduleItemId/reactivate")
  @Use([PermissionMiddleware, Can("schedule", ["configure", "manage"])])
  async activateScheduleItem(
    @Param("churchId") churchId: string,
    @Param("scheduleItemId") scheduleItemId: string,
    @Res() res: Response,
    req: AuthenticatedRequest
  ) {
    try {
      if (!ensureChurchScope(req, res, churchId)) return

      await new ActivateScheduleItem(this.scheduleItemRepository).execute({
        churchId,
        scheduleItemId,
        currentUserId: req.auth?.userId,
      })

      res
        .status(HttpStatus.OK)
        .send({ message: "Schedule item activated successfully" })
    } catch (error) {
      domainResponse(error, res)
    }
  }

  @Get("/schedule/weekly")
  @Use([PermissionMiddleware, WeeklyScheduleQueryValidator])
  async weeklySchedule(
    @Param("churchId") churchId: string,
    @Query() query: WeeklyScheduleQuery,
    @Res() res: Response,
    req: AuthenticatedRequest
  ) {
    try {
      // validation handled by middleware
      if (!ensureChurchScope(req, res, churchId)) return

      const visibilityScope =
        query.visibilityScope ||
        (req.auth?.permissions?.some((permission) =>
          ["schedule:manage", "schedule:configure"].includes(permission)
        )
          ? "INTERNAL_LEADERS"
          : "PUBLIC")

      const occurrences = await new ListWeeklyScheduleOccurrences(
        this.scheduleItemRepository
      ).execute({
        churchId,
        weekStartDate: query.weekStartDate,
        visibilityScope,
      })

      res.status(HttpStatus.OK).send(occurrences)
    } catch (error) {
      domainResponse(error, res)
    }
  }
}
