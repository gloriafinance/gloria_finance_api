import { Request, Response, Router } from "express"
import { UploadedFile } from "express-fileupload"
import { PermissionMiddleware, Can } from "@/Shared/infrastructure"
import {
  createAssetController,
  disposeAssetController,
  generateInventoryReportController,
  generatePhysicalInventorySheetController,
  getAssetController,
  importInventoryController,
  listAssetsController,
  recordAssetInventoryController,
  updateAssetController,
} from "../controllers"
import CreateAssetValidator from "../validators/CreateAsset.validator"
import UpdateAssetValidator from "../validators/UpdateAsset.validator"
import ListAssetsValidator from "../validators/ListAssets.validator"
import InventoryReportValidator from "../validators/InventoryReport.validator"
import DisposeAssetValidator from "../validators/DisposeAsset.validator"
import RecordAssetInventoryValidator from "../validators/RecordAssetInventory.validator"
import PhysicalInventorySheetValidator from "../validators/PhysicalInventorySheet.validator"
import ImportInventoryValidator from "../validators/ImportInventory.validator"
import {
  AssetInventoryChecker,
  AssetInventoryStatus,
  AssetStatus,
  CreateAssetRequest,
  DisposeAssetRequest,
  ImportInventoryRequest,
  InventoryReportFormat,
  PhysicalInventorySheetRequest,
  RecordAssetInventoryRequest,
  UpdateAssetRequest,
} from "@/Patrimony"

const router = Router()

const resolveUserId = (request: Request) => {
  const user = request["user"]

  return user.userId || "system"
}

const resolveInventoryPerformerDetails = (user: any): AssetInventoryChecker => {
  return {
    name: user.name,
    email: user.email,
    memberId: user.userId.trim(),
  }
}
//
// const collectAttachmentsFromRequest = (
//   req: Request
// ): { attachments?: CreateAssetAttachmentRequest[]; provided: boolean } => {
//   const hasAttachmentsProp = Object.prototype.hasOwnProperty.call(
//     req.body,
//     "attachments"
//   )
//
//   const filesInput = (
//     req as Request & {
//       files?: { [fieldname: string]: unknown }
//     }
//   ).files?.attachments as
//     | CreateAssetAttachmentRequest["file"]
//     | CreateAssetAttachmentRequest["file"][]
//     | undefined
//
//   const files = Array.isArray(filesInput)
//     ? filesInput
//     : filesInput
//       ? [filesInput]
//       : []
//
//   if (!hasAttachmentsProp) {
//     return { attachments: undefined, provided: false }
//   }
//
//   const metadata = Array.isArray(req.body.attachments)
//     ? (req.body.attachments as CreateAssetAttachmentRequest[])
//     : []
//
//   const attachments = metadata.map((attachment, index) => ({
//     ...attachment,
//     file: attachment.file ?? files[index],
//   }))
//
//   return { attachments, provided: true }
// }

router.post(
  "/",
  [PermissionMiddleware, Can("patrimony", "manage_assets"), CreateAssetValidator],
  async (req: Request, res: Response) => {
    //const { attachments, provided } = collectAttachmentsFromRequest(req)

    await createAssetController(
      {
        ...req.body,
        churchId: req["user"].churchId,
        //attachments: provided ? (attachments ?? []) : undefined,
        attachments: req.body?.attachments,
        value: Number(req.body.value),
        quantity: Number(req.body.quantity),
        status: req.body.status as AssetStatus,
        performedByDetails: resolveInventoryPerformerDetails(req["user"]),
      } as CreateAssetRequest,
      res
    )
  }
)

router.get(
  "/",
  [PermissionMiddleware, Can("patrimony", "manage_assets"), ListAssetsValidator],
  async (req: Request, res: Response) => {
    const performedBy = resolveUserId(req)

    await listAssetsController(
      {
        churchId: req["user"].churchId,
        category:
          typeof req.query.category === "string"
            ? req.query.category
            : undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
        perPage: req.query.perPage ? Number(req.query.perPage) : undefined,
        status: req.query.status as AssetStatus,
        search:
          typeof req.query.search === "string" ? req.query.search : undefined,
        performedBy,
      },
      res
    )
  }
)

router.get(
  "/:assetId",
  [PermissionMiddleware, Can("patrimony", "manage_assets")],
  async (req: Request, res: Response) => {
    const performedBy = resolveUserId(req)

    await getAssetController(
      {
        assetId: req.params.assetId,
        performedBy,
      },
      res
    )
  }
)

router.put(
  "/:assetId",
  [PermissionMiddleware, Can("patrimony", "manage_assets"), UpdateAssetValidator],
  async (req: Request, res: Response) => {
    //const { attachments, provided } = collectAttachmentsFromRequest(req)

    await updateAssetController(
      {
        ...req.body,
        assetId: req.params.assetId,
        value: Number(req.body.value),
        quantity: req.body.quantity,
        status: req.body.status as AssetStatus,
        //  attachments: provided ? (attachments ?? []) : undefined,
        attachments: req.body?.attachments,
        performedByDetails: resolveInventoryPerformerDetails(req["user"]),
      } as UpdateAssetRequest,
      res
    )
  }
)

router.post(
  "/:assetId/disposal",
  [PermissionMiddleware, Can("patrimony", "manage_assets"), DisposeAssetValidator],
  async (req: Request, res: Response) => {
    await disposeAssetController(
      {
        ...req.body,
        assetId: req.params.assetId,
        status: req.body.status as DisposeAssetRequest["status"],
        performedByDetails: resolveInventoryPerformerDetails(req["user"]),
      } as DisposeAssetRequest,
      res
    )
  }
)

router.post(
  "/:assetId/inventory",
  [
    PermissionMiddleware,
    Can("patrimony", "inventory"),
    RecordAssetInventoryValidator,
  ],
  async (req: Request, res: Response) => {
    await recordAssetInventoryController(
      {
        ...req.body,
        assetId: req.params.assetId,
        status: req.body.status as AssetInventoryStatus,
        quantity: Number(req.body.quantity),
        performedByDetails: resolveInventoryPerformerDetails(req["user"]),
      } as RecordAssetInventoryRequest,
      res
    )
  }
)

router.post(
  "/inventory/import",
  [
    PermissionMiddleware,
    Can("patrimony", "inventory"),
    ImportInventoryValidator,
  ],
  async (req: Request, res: Response) => {
    const file = req["inventoryFile"] as UploadedFile
    const performerDetails = resolveInventoryPerformerDetails(req["user"])

    await importInventoryController(
      {
        filePath: file.tempFilePath,
        performedByDetails: performerDetails,
      } as ImportInventoryRequest,
      res
    )
  }
)

router.get(
  "/report/inventory/physical",
  [
    PermissionMiddleware,
    Can("patrimony", "inventory"),
    PhysicalInventorySheetValidator,
  ],
  async (req: Request, res: Response) => {
    const performedBy = resolveUserId(req)
    const churchIdFromQuery =
      typeof req.query.churchId === "string" &&
      req.query.churchId.trim().length > 0
        ? req.query.churchId.trim()
        : undefined
    const churchId = churchIdFromQuery ?? req["user"].churchId

    if (!churchId) {
      res.status(400).send({
        churchId: {
          message:
            "Não foi possível determinar a congregação. Informe o parâmetro churchId ou utilize um token com o campo churchId.",
          rule: "required",
        },
      })
      return
    }

    res.setHeader("Cache-Control", "no-store")

    await generatePhysicalInventorySheetController(
      {
        churchId,
        category:
          typeof req.query.category === "string"
            ? req.query.category
            : undefined,
        status: req.query.status as AssetStatus,
        performedBy,
      } as PhysicalInventorySheetRequest,
      res
    )
  }
)

router.get(
  "/report/inventory",
  [
    PermissionMiddleware,
    Can("patrimony", "inventory"),
    InventoryReportValidator,
  ],
  async (req: Request, res: Response) => {
    const performedBy = resolveUserId(req)

    await generateInventoryReportController(
      {
        ...req.query,
        churchId: req["user"].churchId,
        format: req.query.format as InventoryReportFormat,
        status: req.query.status as AssetStatus,
        performedBy,
      },
      res
    )
  }
)

export default router
