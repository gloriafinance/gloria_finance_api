import { OnboardingStatus } from "@/Customers/domain/enums/CustomerStatus.enum"
import { Response } from "express"
import { QueueService } from "@/Shared/infrastructure"
import { QueueName } from "@/Shared/domain"
import { CustomerMongoRepository } from "@/Customers/infrastructure/persistence/CustomerMongoRepository"
import domainResponse from "@/Shared/helpers/domainResponse"

export const UpdateOnboardingStatusController = async (
  req: {
    status: OnboardingStatus
    customerId: string
    church: {
      openingDate: Date
      registerNumber?: string
    }
  },
  res: Response
) => {
  try {
    if (req.status === OnboardingStatus.COMPLETED) {
      const customer = await CustomerMongoRepository.getInstance().one({
        customerId: req.customerId,
      })

      QueueService.getInstance().dispatch(QueueName.OnboardingCustomerJob, {
        church: req.church,
        customer: customer.toPrimitives(),
      })
    }

    res.status(200).send({ message: "Onboarding process started" })
  } catch (e) {
    domainResponse(e, res)
  }
}
