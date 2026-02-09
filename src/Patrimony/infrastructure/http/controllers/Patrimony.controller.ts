import type { BunMultipartFile, ServerResponse } from "bun-platform-kit"
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
  Use,
} from "bun-platform-kit"
import type {
  CreateAssetRequest,
  DisposeAssetRequest,
  ImportInventoryRequest,
  InventoryReportFormat,
  PhysicalInventorySheetRequest,
  RecordAssetInventoryRequest,
  UpdateAssetRequest,
} from "@/Patrimony"
import {
  type AssetInventoryChecker,
  AssetInventoryStatus,
  AssetStatus,
  CreateAsset,
  DisposeAsset,
  GenerateInventoryReport,
  GeneratePhysicalInventorySheet,
  GetAsset,
  ListAssets,
  RecordAssetInventory,
  UpdateAsset,
} from "@/Patrimony"
import type { AuthenticatedRequest } from "@/Shared/infrastructure"
import {
  Can,
  NoOpStorage,
  PermissionMiddleware,
  QueueService,
} from "@/Shared/infrastructure"
import CreateAssetValidator from "../validators/CreateAsset.validator"
import UpdateAssetValidator from "../validators/UpdateAsset.validator"
import ListAssetsValidator from "../validators/ListAssets.validator"
import InventoryReportValidator from "../validators/InventoryReport.validator"
import DisposeAssetValidator from "../validators/DisposeAsset.validator"
import RecordAssetInventoryValidator from "../validators/RecordAssetInventory.validator"
import PhysicalInventorySheetValidator from "../validators/PhysicalInventorySheet.validator"
import ImportInventoryValidator from "../validators/ImportInventory.validator"
import {
  AttachmentValidationError,
  cleanupUploads,
  normalizeAttachments,
} from "@/Patrimony/infrastructure/http/controllers/Helper.controller"
import { QueueName } from "@/package/queue/domain"
import domainResponse from "@/Shared/helpers/domainResponse"
import { AssetMongoRepository } from "@/Patrimony/infrastructure/persistence"
import {
  ChurchMongoRepository,
  MemberMongoRepository,
} from "@/Church/infrastructure"
import { mapAssetToResponse } from "../mappers/AssetResponse.mapper"
import { promises as fs } from "fs"
import {
  HandlebarsHTMLAdapter,
  PuppeteerAdapter,
  XLSExportAdapter,
} from "@/Shared/adapter"
import { HttpStatus } from "@/Shared/domain"

type ListAssetsQuery = {
  category?: string
  page?: string | number
  perPage?: string | number
  status?: AssetStatus
  search?: string
}

type PhysicalInventorySheetQuery = {
  churchId?: string
  category?: string
  status?: AssetStatus
}

type InventoryReportQuery = {
  churchId?: string
  category?: string
  status?: AssetStatus
  format?: InventoryReportFormat
}

@Controller("/api/v1/patrimony")
export class PatrimonyController {
  @Post("/")
  @Use([
    PermissionMiddleware,
    Can("patrimony", "manage_assets"),
    CreateAssetValidator,
  ])
  async createAsset(
    @Body() body: CreateAssetRequest,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    const uploadedPaths: string[] = []

    try {
      const normalizedAttachments = await normalizeAttachments(
        body.attachments,
        uploadedPaths
      )

      const result = await new CreateAsset(
        AssetMongoRepository.getInstance(),
        MemberMongoRepository.getInstance()
      ).execute({
        ...body,
        churchId: req.auth.churchId,
        attachments: normalizedAttachments ?? [],
        value: Number(body.value),
        quantity: Number(body.quantity),
        status: body.status as AssetStatus,
        performedByDetails: this.resolveInventoryPerformerDetails(req.auth),
      })

      res.status(HttpStatus.CREATED).send(result)
    } catch (error) {
      await cleanupUploads(uploadedPaths)

      if (error instanceof AttachmentValidationError) {
        res.status(HttpStatus.UNPROCESSABLE_ENTITY).send({
          attachments: {
            message: error.message,
            rule: "invalid",
          },
        })
        return
      }

      domainResponse(error, res)
    }
  }

  @Get("/")
  @Use([
    PermissionMiddleware,
    Can("patrimony", ["list_assets", "manage_assets"]),
    ListAssetsValidator,
  ])
  async listAssets(
    @Query() query: ListAssetsQuery,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      const performedBy = this.resolveUserId(req)

      const result = await new ListAssets(
        AssetMongoRepository.getInstance()
      ).execute({
        churchId: req.auth.churchId,
        category:
          typeof query.category === "string" ? query.category : undefined,
        page: query.page ? Number(query.page) : undefined,
        perPage: query.perPage ? Number(query.perPage) : undefined,
        status: query.status as AssetStatus,
        search: typeof query.search === "string" ? query.search : undefined,
        performedBy,
      })

      res.status(HttpStatus.OK).send({
        ...result,
        results: await mapAssetToResponse(result.results),
      })
    } catch (error) {
      domainResponse(error, res)
    }
  }

  @Get("/:assetId")
  @Use([
    PermissionMiddleware,
    Can("patrimony", ["read_assets", "manage_assets"]),
  ])
  async getAsset(
    @Param("assetId") assetId: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      const result = await new GetAsset(
        AssetMongoRepository.getInstance()
      ).execute({
        assetId,
        performedBy: this.resolveUserId(req),
      })

      res.status(HttpStatus.OK).send(result)
    } catch (error) {
      domainResponse(error, res)
    }
  }

  @Put("/:assetId")
  @Use([
    PermissionMiddleware,
    Can("patrimony", "manage_assets"),
    UpdateAssetValidator,
  ])
  async updateAsset(
    @Param("assetId") assetId: string,
    @Body() body: UpdateAssetRequest,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    const uploadedPaths: string[] = []
    const attachmentsProvided = Array.isArray(body.attachments)

    try {
      const normalizedAttachments = await normalizeAttachments(
        body.attachments,
        uploadedPaths
      )

      const { asset, removedAttachments } = await new UpdateAsset(
        AssetMongoRepository.getInstance(),
        MemberMongoRepository.getInstance()
      ).execute({
        ...body,
        assetId,
        value: body.value !== undefined ? Number(body.value) : undefined,
        quantity: body.quantity,
        status: body.status as AssetStatus,
        attachments: attachmentsProvided
          ? (normalizedAttachments ?? [])
          : undefined,
        performedByDetails: this.resolveInventoryPerformerDetails(req.auth),
      })

      await cleanupUploads(
        removedAttachments.map((attachment) => attachment.url)
      )

      res.status(HttpStatus.OK).send(asset)
    } catch (error) {
      await cleanupUploads(uploadedPaths)

      if (error instanceof AttachmentValidationError) {
        res.status(HttpStatus.UNPROCESSABLE_ENTITY).send({
          attachments: {
            message: error.message,
            rule: "invalid",
          },
        })
        return
      }

      domainResponse(error, res)
    }
  }

  @Post("/:assetId/disposal")
  @Use([
    PermissionMiddleware,
    Can("patrimony", "manage_assets"),
    DisposeAssetValidator,
  ])
  async disposeAsset(
    @Param("assetId") assetId: string,
    @Body() body: DisposeAssetRequest,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      const asset = await new DisposeAsset(
        AssetMongoRepository.getInstance()
      ).execute({
        ...body,
        assetId,
        status: body.status as DisposeAssetRequest["status"],
        performedByDetails: this.resolveInventoryPerformerDetails(req.auth),
      })

      res.status(HttpStatus.OK).send(asset)
    } catch (error) {
      domainResponse(error, res)
    }
  }

  @Post("/:assetId/inventory")
  @Use([
    PermissionMiddleware,
    Can("patrimony", "inventory"),
    RecordAssetInventoryValidator,
  ])
  async recordInventory(
    @Param("assetId") assetId: string,
    @Body() body: RecordAssetInventoryRequest,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      const asset = await new RecordAssetInventory(
        AssetMongoRepository.getInstance()
      ).execute({
        ...body,
        assetId,
        status: body.status as AssetInventoryStatus,
        quantity: Number(body.quantity),
        performedByDetails: this.resolveInventoryPerformerDetails(req.auth),
      })

      res.status(HttpStatus.OK).send(asset)
    } catch (error) {
      domainResponse(error, res)
    }
  }

  @Post("/inventory/import")
  @Use([
    PermissionMiddleware,
    Can("patrimony", "inventory"),
    ImportInventoryValidator,
  ])
  async importInventory(
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      const file = req.files?.inventoryFile as BunMultipartFile
      if (!file) {
        res.status(HttpStatus.BAD_REQUEST).send({
          file: {
            message: "Arquivo do extrato é obrigatório",
            rule: "required",
          },
        })
        return
      }
      const performerDetails = this.resolveInventoryPerformerDetails(req.auth)

      const fileContent = file?.text ? await file.text() : ""

      // @ts-ignore
      QueueService.getInstance().dispatch(
        QueueName.ProcessInventoryFromFileJob,
        {
          fileContent,
          performedByDetails: performerDetails,
        } as ImportInventoryRequest
      )

      res
        .status(HttpStatus.OK)
        .send({ message: "Processo de importação de inventário iniciado." })
    } catch (error) {
      domainResponse(error, res)
    }
  }

  @Get("/report/inventory/physical")
  @Use([
    PermissionMiddleware,
    Can("patrimony", "inventory"),
    PhysicalInventorySheetValidator,
  ])
  async physicalInventorySheet(
    @Query() query: PhysicalInventorySheetQuery,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      const performedBy = this.resolveUserId(req)
      const churchIdFromQuery =
        typeof query.churchId === "string" && query.churchId.trim().length > 0
          ? query.churchId.trim()
          : undefined
      const churchId = churchIdFromQuery ?? req.auth.churchId

      if (!churchId) {
        res.status(HttpStatus.BAD_REQUEST).send({
          churchId: {
            message:
              "Não foi possível determinar a congregação. Informe o parâmetro churchId ou utilize um token com o campo churchId.",
            rule: "required",
          },
        })
        return
      }

      res.setHeader!("Cache-Control", "no-store")

      const file = await new GeneratePhysicalInventorySheet(
        AssetMongoRepository.getInstance()
      ).execute({
        churchId,
        category:
          typeof query.category === "string" ? query.category : undefined,
        status: query.status as AssetStatus,
        performedBy,
      } as PhysicalInventorySheetRequest)

      const { path, filename } = file

      res.download!(path, filename, (error) => {
        fs.unlink(path).catch(() => undefined)

        //if (error && !res.headersSent) {
        if (error) {
          domainResponse(error, res)
        }
      })
    } catch (error) {
      domainResponse(error, res)
    }
  }

  @Get("/report/inventory")
  @Use([
    PermissionMiddleware,
    Can("patrimony", ["inventory", "patrimony:report_inventory"]),
    InventoryReportValidator,
  ])
  async inventoryReport(
    @Query() query: InventoryReportQuery,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      const performedBy = this.resolveUserId(req)

      const file = await new GenerateInventoryReport(
        ChurchMongoRepository.getInstance(),
        AssetMongoRepository.getInstance(),
        new PuppeteerAdapter(
          new HandlebarsHTMLAdapter(),
          NoOpStorage.getInstance()
        ),
        new XLSExportAdapter()
      ).execute({
        ...query,
        churchId: req.auth.churchId,
        format: query.format as InventoryReportFormat,
        status: query.status as AssetStatus,
        performedBy,
      })

      const { path, filename } = file

      res.download!(path, filename, (error) => {
        fs.unlink(path).catch(() => undefined)

        // if (error && !res.headersSent) {
        if (error) {
          domainResponse(error, res)
        }
      })
    } catch (error) {
      domainResponse(error, res)
    }
  }

  private resolveUserId(request: AuthenticatedRequest) {
    const user = request.auth

    return user?.userId || "system"
  }

  private resolveInventoryPerformerDetails(user: any): AssetInventoryChecker {
    return {
      name: user.name,
      email: user.email,
      memberId: user.userId.trim(),
    }
  }
}
