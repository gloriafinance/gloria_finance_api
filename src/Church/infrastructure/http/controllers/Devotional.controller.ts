import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  type ServerResponse,
  Use,
} from "bun-platform-kit"
import { HttpStatus } from "@/Shared/domain"
import domainResponse from "@/Shared/helpers/domainResponse"
import { Logger } from "@/Shared/adapter"
import { FindChurchById } from "@/Church/applications/church/FindChurchById"
import { DevotionalPlanService } from "@/Church/applications/devotional/services/DevotionalPlanService"
import { DevotionalQueriesService } from "@/Church/applications/devotional/services/DevotionalQueriesService"
import { DevotionalDeliveryService } from "@/Church/applications/devotional/services/DevotionalDeliveryService"
import { DevotionalGenerationService } from "@/Church/applications/devotional/services/DevotionalGenerationService"
import {
  ChurchMongoRepository,
  DevotionalDateDayjsService,
  DevotionalDeliveryLogMongoRepository,
  DevotionalMongoRepository,
  DevotionalWeeklyPlanMongoRepository,
  MemberMongoRepository,
} from "@/Church/infrastructure"
import {
  type AuthenticatedRequest,
  PermissionMiddleware,
  QueueService,
} from "@/Shared/infrastructure"
import {
  DevotionalPlanMode,
  DevotionalStatus,
  type ListDevotionalAgendaRequest,
  type ListDevotionalHistoryRequest,
  type UpdateDevotionalContentRequest,
  type UpsertDevotionalWeeklyPlanRequest,
} from "@/Church/domain"
import UpsertDevotionalWeeklyPlanValidator from "../validators/UpsertDevotionalWeeklyPlan.validator"
import UpdateDevotionalContentValidator from "../validators/UpdateDevotionalContent.validator"
import ListDevotionalAgendaValidator from "../validators/ListDevotionalAgenda.validator"
import ListDevotionalHistoryValidator from "../validators/ListDevotionalHistory.validator"
import { DevotionalGeneratorJob } from "../jobs/DevotionalGenerator.job"
import {
  AIProviderError,
  AIProviderErrorCode,
} from "@/package/ai/errors/AIProviderError"
import { QueueName } from "@/package/queue/domain"
import { DevotionalApproved } from "@/Church/applications/devotional"

@Controller("/api/v1/church/devotional")
export class DevotionalController {
  private readonly logger = Logger(DevotionalController.name)

  @Post("/plan")
  @Use([PermissionMiddleware, UpsertDevotionalWeeklyPlanValidator])
  async upsertPlan(
    @Body()
    body: Omit<
      UpsertDevotionalWeeklyPlanRequest,
      "churchId" | "currentUserId" | "weekStartDate" | "timezone" | "mode"
    >,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      const church = await new FindChurchById(
        ChurchMongoRepository.getInstance()
      ).execute(req.auth.churchId)

      const timezone = church.getTimezone()
      const weekStartDate =
        DevotionalDateDayjsService.getInstance().getWeekStartDateForTimezone(
          timezone
        )

      const response = await this.planService().upsertWeeklyPlan({
        ...body,
        church,
        currentUserId: req.auth.userId!,
        weekStartDate,
        mode: body.requiresPastorReview
          ? DevotionalPlanMode.REVIEW
          : DevotionalPlanMode.AUTOMATIC,
        timezone,
      })

      if (response.plan.getIsEnabled()) {
        const devotionals =
          await DevotionalMongoRepository.getInstance().findByChurchAndWeek(
            req.auth.churchId,
            weekStartDate
          )

        devotionals
          .filter(
            (devotional) => devotional.getStatus() === DevotionalStatus.PENDING
          )
          .forEach((devotional) => {
            QueueService.getInstance().dispatch(
              QueueName.GenerateDevotionalJob,
              {
                churchId: devotional.getChurchId(),
                devotionalId: devotional.getDevotionalId(),
              }
            )
          })
      }

      res.status(HttpStatus.ACCEPTED).send({
        message: "Devotional generation queued",
        weekStartDate,
        timezone,
        data: response.plan.toPrimitives(),
        warning: response.warning,
      })
    } catch (error) {
      domainResponse(error, res)
    }
  }

  @Get("/plan")
  @Use(PermissionMiddleware)
  async getPlan(
    @Query() query: { weekStartDate?: string },
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      if (!query.weekStartDate) {
        return res
          .status(HttpStatus.UNPROCESSABLE_ENTITY)
          .send({ message: "weekStartDate is required" })
      }

      const plan = await this.planService().getWeeklyPlan(
        req.auth.churchId,
        query.weekStartDate
      )

      res.status(HttpStatus.OK).send({
        data: plan ? plan.toPrimitives() : null,
      })
    } catch (error) {
      domainResponse(error, res)
    }
  }

  @Get("/agenda")
  @Use([PermissionMiddleware, ListDevotionalAgendaValidator])
  async agenda(
    @Query() query: Omit<ListDevotionalAgendaRequest, "churchId">,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      const data = await this.queriesService().listAgenda({
        ...query,
        churchId: req.auth.churchId,
      })
      res.status(HttpStatus.OK).send(data)
    } catch (error) {
      domainResponse(error, res)
    }
  }

  @Get("/history")
  @Use([PermissionMiddleware, ListDevotionalHistoryValidator])
  async history(
    @Query() query: Omit<ListDevotionalHistoryRequest, "churchId">,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      const data = await this.queriesService().listHistory({
        ...query,
        churchId: req.auth.churchId,
      })
      res.status(HttpStatus.OK).send(data)
    } catch (error) {
      domainResponse(error, res)
    }
  }

  @Get("/:devotionalId")
  @Use(PermissionMiddleware)
  async getById(
    @Param("devotionalId") devotionalId: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      const data = await this.queriesService().getDevotionalById(
        req.auth.churchId,
        devotionalId
      )

      res.status(HttpStatus.OK).send({ data })
    } catch (error) {
      domainResponse(error, res)
    }
  }

  @Patch("/:devotionalId/edit")
  @Use([PermissionMiddleware, UpdateDevotionalContentValidator])
  async edit(
    @Param("devotionalId") devotionalId: string,
    @Body()
    body: Omit<
      UpdateDevotionalContentRequest,
      "churchId" | "devotionalId" | "currentUserId"
    >,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      const data = await this.queriesService().editDevotionalContent({
        ...body,
        churchId: req.auth.churchId,
        devotionalId,
        currentUserId: req.auth.userId!,
      })

      res.status(HttpStatus.OK).send({ data })
    } catch (error) {
      domainResponse(error, res)
    }
  }

  @Post("/:devotionalId/regenerate")
  @Use(PermissionMiddleware)
  async regenerate(
    @Param("devotionalId") devotionalId: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      this.logger.info("Devotional regenerate requested", {
        churchId: req.auth.churchId,
        devotionalId,
        userId: req.auth.userId,
      })

      const { devotional, church } = await this.generationService().regenerate(
        req.auth.churchId,
        devotionalId,
        req.auth.userId!
      )

      if (devotional.getPlanSnapshot().mode === DevotionalPlanMode.AUTOMATIC) {
        this.logger.info("Devotional regenerate completed in automatic mode", {
          churchId: req.auth.churchId,
          devotionalId,
          status: devotional.getStatus(),
        })
        this.deliveryService().scheduleDelivery(devotional)
      } else {
        this.logger.info("Devotional regenerate completed in review mode", {
          churchId: req.auth.churchId,
          devotionalId,
          status: devotional.getStatus(),
        })
        await this.deliveryService().notifyPastorsForReview(church, devotional)
      }

      const data = this.queriesService().mapDevotionalDetail(devotional)

      this.logger.info("Devotional regenerate response ready", {
        churchId: req.auth.churchId,
        devotionalId,
        status: devotional.getStatus(),
      })
      res.status(HttpStatus.OK).send({ data })
    } catch (error) {
      domainResponse(error, res)
    }
  }

  @Post("/:devotionalId/approve")
  @Use(PermissionMiddleware)
  async approve(
    @Param("devotionalId") devotionalId: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      this.logger.info("Devotional approve requested", {
        churchId: req.auth.churchId,
        devotionalId,
        userId: req.auth.userId,
      })

      const devotional = await new DevotionalApproved(
        DevotionalMongoRepository.getInstance()
      ).execute(req.auth.churchId, devotionalId, req.auth.userId!)

      this.logger.info("Devotional approved, scheduling delivery", {
        churchId: req.auth.churchId,
        devotionalId,
        status: devotional.getStatus(),
      })
      this.deliveryService().scheduleDelivery(devotional)

      const data = this.queriesService().mapDevotionalDetail(devotional)

      this.logger.info("Devotional approve response ready", {
        churchId: req.auth.churchId,
        devotionalId,
        status: devotional.getStatus(),
      })
      res.status(HttpStatus.OK).send({ data })
    } catch (error) {
      domainResponse(error, res)
    }
  }

  @Post("/:devotionalId/retry-send")
  @Use(PermissionMiddleware)
  async retrySend(
    @Param("devotionalId") devotionalId: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      const devotional = await this.deliveryService().retrySend(
        req.auth.churchId,
        devotionalId
      )
      const data = this.queriesService().mapDevotionalDetail(devotional)

      res.status(HttpStatus.OK).send({ data })
    } catch (error) {
      domainResponse(error, res)
    }
  }

  // Manual test endpoint kept for provider troubleshooting.
  @Post("/generate")
  @Use(PermissionMiddleware)
  async generate(
    @Body()
    body: {
      purpose: string
      theme: string
      title_hint: string
      lang: string
      tone: string
      audience: string
    },
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      const church = await new FindChurchById(
        ChurchMongoRepository.getInstance()
      ).execute(req.auth.churchId)

      const response = await new DevotionalGeneratorJob().handler({
        ...body,
        church_doctrinal_profile_text: church.getDoctrinalBases().join(". "),
      })

      res.status(HttpStatus.OK).send(response)
    } catch (error) {
      if (error instanceof AIProviderError) {
        if (error.code === AIProviderErrorCode.LIMIT_EXCEEDED) {
          return res.status(HttpStatus.TOO_MANY_REQUESTS).send({
            message: error.message,
            provider: error.provider,
            status: error.status,
            code: error.code,
          })
        }

        if (error.code === AIProviderErrorCode.AUTH_ERROR) {
          return res.status(HttpStatus.UNAUTHORIZED).send({
            message: error.message,
            provider: error.provider,
            status: error.status,
            code: error.code,
          })
        }

        return res.status(HttpStatus.BAD_REQUEST).send({
          message: error.message,
          provider: error.provider,
          status: error.status,
          code: error.code,
        })
      }

      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
        message: "Unexpected error generating devotional",
      })
    }
  }

  private planService() {
    return new DevotionalPlanService(
      DevotionalWeeklyPlanMongoRepository.getInstance(),
      DevotionalMongoRepository.getInstance(),
      DevotionalDateDayjsService.getInstance()
    )
  }

  private queriesService() {
    return new DevotionalQueriesService(
      DevotionalMongoRepository.getInstance(),
      DevotionalDeliveryLogMongoRepository.getInstance()
    )
  }

  private deliveryService() {
    return new DevotionalDeliveryService(
      DevotionalMongoRepository.getInstance(),
      DevotionalDeliveryLogMongoRepository.getInstance(),
      ChurchMongoRepository.getInstance(),
      MemberMongoRepository.getInstance(),
      QueueService.getInstance()
    )
  }

  private generationService() {
    return new DevotionalGenerationService(
      DevotionalMongoRepository.getInstance(),
      ChurchMongoRepository.getInstance()
      //this.deliveryService()
    )
  }
}
