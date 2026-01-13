import { Request, Response } from "express"
import {
  Can,
  PermissionMiddleware,
  QueueService,
} from "@/Shared/infrastructure"
import { HttpStatus, QueueName } from "@/Shared/domain"
import RebuildMasterDataValidator from "@/Financial/infrastructure/http/validators/RebuildMasterData.validator"
import { Controller, Post, Use } from "@abejarano/ts-express-server"

@Controller("/api/v1/finance/tools")
export class FinancialRecordJobController {
  /**
   * Reconstruye el maestro de cuentas de disponibilidad
   * @param req
   * @param res
   */
  @Post("/rebuild/availabilityAccount")
  @Use([
    PermissionMiddleware,
    RebuildMasterDataValidator,
    Can("tools", ["admin"]),
  ])
  async rebuildAvailabilityAccount(req: Request, res: Response) {
    QueueService.getInstance().dispatch(
      QueueName.RebuildAvailabilityMasterAccountJob,
      {
        ...req.body,
        month: Number(req.body.month),
        year: Number(req.body.year),
      }
    )

    res.status(HttpStatus.OK).send({ message: "process" })
  }

  /**
   * Reconstruye el maestro de los centros de costo
   * @param req
   * @param res
   */
  @Post("/rebuild/costcenter")
  @Use([
    PermissionMiddleware,
    RebuildMasterDataValidator,
    Can("tools", ["admin"]),
  ])
  async rebuildCostCentral(req: Request, res: Response) {
    QueueService.getInstance().dispatch(QueueName.RebuildCostCenterMasterJob, {
      ...req.body,
      month: Number(req.body.month),
      year: Number(req.body.year),
    })
    res.status(HttpStatus.OK).send({ message: "process" })
  }
}

// financialJobRoute.post(
//   "/rebuild/availabilityAccount",
//   [PermissionMiddleware, RebuildMasterDataValidator, Can("tools", ["admin"])],
//   async (req: Request, res: Response) => {
//     QueueService.getInstance().dispatch(
//       QueueName.RebuildAvailabilityMasterAccountJob,
//       {
//         ...req.body,
//         month: Number(req.body.month),
//         year: Number(req.body.year),
//       }
//     )
//
//     res.status(HttpStatus.OK).send({ message: "process" })
//   }
// )

// financialJobRoute.post(
//   "/rebuild/costcenter",
//   [PermissionMiddleware, RebuildMasterDataValidator, Can("tools", ["admin"])],
//   async (req: Request, res) => {
//     QueueService.getInstance().dispatch(QueueName.RebuildCostCenterMasterJob, {
//       ...req.body,
//       month: Number(req.body.month),
//       year: Number(req.body.year),
//     })
//     res.status(HttpStatus.OK).send({ message: "process" })
//   }
// )
//
// export default financialJobRoute
