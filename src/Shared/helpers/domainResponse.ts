import { DomainException, HttpStatus, QueueName } from "../domain"
import { Logger } from "../adapter"
import { QueueService } from "@/Shared/infrastructure/queue/QueueService"
import { Response } from "express"

export default (e, res: Response) => {
  const logger = Logger("domainResponse")

  if (e instanceof DomainException) {
    res.status(HttpStatus.BAD_REQUEST).send({
      code: e.getErrorCode(),
      message: e.getMessage(),
    })

    // QueueService.getInstance().dispatch(QueueName.TelegramNotification, {
    //   message: e.getMessage() + " RequestId:" + logger.getRequestId(),
    // })
    return
  }

  QueueService.getInstance().dispatch(QueueName.TelegramNotificationJob, {
    message: e.message + " RequestId:" + logger.getRequestId(),
  })

  res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({ message: e.message })
}
