import { ImportInventoryRequest } from "@/Patrimony"
import { HttpStatus, QueueName } from "@/Shared/domain"
import domainResponse from "@/Shared/helpers/domainResponse"
import { Response } from "express"
import { QueueService } from "@/Shared/infrastructure"

export const importInventoryController = async (
  request: ImportInventoryRequest,
  res: Response
) => {
  try {
    QueueService.getInstance().dispatch(
      QueueName.ProcessInventoryFromFileJob,
      request
    )

    res
      .status(HttpStatus.OK)
      .send({ message: "Processo de importação de inventário iniciado." })
  } catch (error) {
    domainResponse(error, res)
  }
}
