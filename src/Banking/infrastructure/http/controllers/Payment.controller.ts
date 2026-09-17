import { CreatePixPayment } from "@/Banking/applications"
import type { CreatePixPaymentRequest } from "@/Banking/domain"
import {
  ChurchBankingClient,
  ChurchBankingClientError,
} from "@/Banking/infrastructure/church-banking/ChurchBankingClient"
import CreatePixPaymentValidator from "@/Banking/infrastructure/http/validators/CreatePixPayment.validator"
import { MemberMongoRepository } from "@/Church/infrastructure"
import { HttpStatus } from "@/Shared/domain"
import domainResponse from "@/Shared/helpers/domainResponse"
import {
  type AuthenticatedRequest,
  PermissionMiddleware,
} from "@/Shared/infrastructure"
import {
  Body,
  Controller,
  Post,
  Req,
  Res,
  type ServerResponse,
  Use,
} from "bun-platform-kit"

@Controller("/api/v1/banking/payment")
export class PaymentController {
  @Post("/pix")
  @Use([PermissionMiddleware, CreatePixPaymentValidator])
  async createPixPayment(
    @Body()
    body: Omit<CreatePixPaymentRequest, "memberId" | "churchId">,
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      const payment = await new CreatePixPayment(
        MemberMongoRepository.getInstance(),
        new ChurchBankingClient()
      ).execute({
        ...body,
        memberId: req.auth.memberId,
        churchId: req.auth.churchId,
      })

      res.status(HttpStatus.CREATED).json(payment)
    } catch (e) {
      if (e instanceof ChurchBankingClientError) {
        res.status(e.status).send({ code: e.code })
        return
      }

      domainResponse(e, res)
    }
  }
}
