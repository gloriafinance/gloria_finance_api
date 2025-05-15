import { Response } from "express"
import { ConfirmOrDenyPaymentCommitmentRequest } from "@/AccountsReceivable/domain"
import { ConfirmOrDenyPaymentCommitment } from "@/AccountsReceivable/applications"
import { AccountsReceivableMongoRepository } from "@/AccountsReceivable/infrastructure/persistence/AccountsReceivableMongoRepository"
import domainResponse from "@/Shared/helpers/domainResponse"
import { HandlebarsHTMLAdapter, PuppeteerAdapter } from "@/Shared/adapter"
import { StorageGCP } from "@/Shared/infrastructure"

export const ConfirmOrDenyPaymentCommitmentController = async (
  req: ConfirmOrDenyPaymentCommitmentRequest,
  res: Response
) => {
  try {
    const store = StorageGCP.getInstance(process.env.BUCKET_FILES)
    const account = await new ConfirmOrDenyPaymentCommitment(
      AccountsReceivableMongoRepository.getInstance(),
      new PuppeteerAdapter(new HandlebarsHTMLAdapter(), store)
    ).execute(req)

    if (req.status !== "ACCEPTED") {
      res.status(200).json({
        message: "Payment commitment rejected successfully.",
      })

      return
    }

    const link = store.downloadFile(account.getContract())

    res.status(200).json({
      message: "Payment commitment accepted successfully.",
      contract: link,
    })
  } catch (e) {
    domainResponse(e, res)
  }
}
