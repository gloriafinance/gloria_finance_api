import { Response } from "express"
import {
  ActionsPaymentCommitment,
  ConfirmOrDenyPaymentCommitmentRequest,
} from "@/AccountsReceivable/domain"
import { ConfirmOrDenyPaymentCommitment } from "@/AccountsReceivable/applications"
import { AccountsReceivableMongoRepository } from "@/AccountsReceivable/infrastructure/persistence/AccountsReceivableMongoRepository"
import domainResponse from "@/Shared/helpers/domainResponse"
import { HandlebarsHTMLAdapter, PuppeteerAdapter } from "@/Shared/adapter"
import { QueueService, StorageGCP } from "@/Shared/infrastructure"
import { HttpStatus } from "@/Shared/domain"
import {
  ChurchMongoRepository,
  MinisterMongoRepository,
} from "@/Church/infrastructure"

export const ConfirmOrDenyPaymentCommitmentController = async (
  req: ConfirmOrDenyPaymentCommitmentRequest,
  res: Response
) => {
  try {
    const store = StorageGCP.getInstance(process.env.BUCKET_FILES)
    const account = await new ConfirmOrDenyPaymentCommitment(
      AccountsReceivableMongoRepository.getInstance(),
      new PuppeteerAdapter(new HandlebarsHTMLAdapter(), store),
      ChurchMongoRepository.getInstance(),
      MinisterMongoRepository.getInstance(),
      QueueService.getInstance()
    ).execute(req)

    if (req.action === ActionsPaymentCommitment.DENIED) {
      res.status(HttpStatus.OK).json({
        message: "Payment commitment rejected successfully.",
        contract: "",
      })

      return
    }

    const link = await store.downloadFile(account.getContract())

    res.status(HttpStatus.OK).json({
      message: "Payment commitment accepted successfully.",
      contract: link,
    })
  } catch (e) {
    domainResponse(e, res)
  }
}
