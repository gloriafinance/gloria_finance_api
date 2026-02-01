import {
  type AuthenticatedRequest,
  Can,
  PermissionMiddleware,
  QueueService,
} from "@/Shared/infrastructure"
import { HttpStatus, QueueName } from "@/Shared/domain"
import RebuildMasterDataValidator from "@/Financial/infrastructure/http/validators/RebuildMasterData.validator"
import {
  Body,
  Controller,
  Post,
  Req,
  type ServerResponse,
  Use,
} from "bun-platform-kit"

@Controller("/api/v1/finance/tools")
export class FinancialRecordJobController {
  /**
   * Reconstruye el maestro de cuentas de disponibilidad
   * @param body
   * @param req
   * @param res
   */
  @Post("/rebuild/availabilityAccount")
  @Use([
    PermissionMiddleware,
    RebuildMasterDataValidator,
    Can("tools", ["admin"]),
  ])
  async rebuildAvailabilityAccount(
    @Body()
    body: {
      year: number
      month: number
    },
    @Req() req: AuthenticatedRequest,
    res: ServerResponse
  ) {
    QueueService.getInstance().dispatch<{
      churchId: string
      year: number
      month: number
    }>(QueueName.RebuildAvailabilityMasterAccountJob, {
      month: Number(body.month),
      year: Number(body.year),
      churchId: req.auth.churchId,
    })

    res.status(HttpStatus.OK).send({ message: "process" })
  }

  /**
   * Reconstruye el maestro de los centros de costo
   * @param body
   * @param req
   * @param res
   */
  @Post("/rebuild/costcenter")
  @Use([
    PermissionMiddleware,
    RebuildMasterDataValidator,
    Can("tools", ["admin"]),
  ])
  async rebuildCostCentral(
    @Body() body: { month: number; year: number },
    @Req() req: AuthenticatedRequest,
    res: ServerResponse
  ) {
    QueueService.getInstance().dispatch<{
      churchId: string
      year: number
      month: number
    }>(QueueName.RebuildCostCenterMasterJob, {
      churchId: req.auth.churchId,
      month: Number(body.month),
      year: Number(body.year),
    })
    res.status(HttpStatus.OK).send({ message: "process" })
  }
}

// financialJobRoute.post(
//   "/rebuild/availabilityAccount",
//   [PermissionMiddleware, RebuildMasterDataValidator, Can("tools", ["admin"])],
//   async (req: Request, res: ServerResponse) => {
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
