import { Customer, OnboardingStatus } from "@/Customers/domain"
import type { ICreateCustomer } from "@/Customers/domain"

import { QueueService } from "@/Shared/infrastructure"
import { HttpStatus, QueueName } from "@/Shared/domain"
import { CustomerMongoRepository } from "../../persistence/CustomerMongoRepository"
import domainResponse from "@/Shared/helpers/domainResponse"
import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  Res,
  Use,
} from "bun-platform-kit"
import type { ServerResponse, ServerRequest } from "bun-platform-kit"

import CustomerValidator from "../validators/Customer.validator"
import {
  Criteria,
  Filters,
  Order,
  OrderTypes,
} from "@abejarano/ts-mongodb-criteria"
import { OnboardingCustomerRequest } from "../../jobs/OnboardingCustomer.job"

@Controller("/api/v1/onboarding")
export class OnboardingController {
  @Post("/")
  @Use([CustomerValidator])
  async create(@Body() payload: ICreateCustomer, @Res() res: ServerResponse) {
    try {
      const customer = Customer.create(payload)
      await CustomerMongoRepository.getInstance().upsert(customer)

      res.status(HttpStatus.CREATED).send({
        message: "Customer created successfully",
        customerId: customer.getCustomerId(),
      })
    } catch (e) {
      domainResponse(e, res)
    }
  }

  @Get("/")
  async list(
    @Query()
    query: {
      page: number
      perPage: number
    },
    @Res() res: ServerResponse
  ) {
    try {
      const criteria = new Criteria(
        new Filters([]),
        Order.fromValues("createdAt", OrderTypes.DESC),
        Number(query.perPage) ?? 10,
        Number(query.page)
      )
      const customers =
        await CustomerMongoRepository.getInstance().list(criteria)

      res.status(HttpStatus.OK).send(customers)
    } catch (e) {
      domainResponse(e, res)
    }
  }
  @Patch("/")
  async update(
    @Body()
    req: {
      status: OnboardingStatus
      customerId: string
      church: {
        openingDate: Date
        registerNumber?: string
        symbol: string
      }
    },
    @Res() res: ServerResponse
  ) {
    try {
      if (req.status === OnboardingStatus.COMPLETED) {
        const customer = await CustomerMongoRepository.getInstance().one({
          customerId: req.customerId,
        })

        QueueService.getInstance().dispatch<OnboardingCustomerRequest>(
          QueueName.OnboardingCustomerJob,
          {
            church: req.church,
            customer: { ...customer.toPrimitives(), id: customer.getId() },
          }
        )
      }

      res.status(HttpStatus.OK).send({ message: "Onboarding process started" })
    } catch (e) {
      domainResponse(e, res)
    }
  }
}
