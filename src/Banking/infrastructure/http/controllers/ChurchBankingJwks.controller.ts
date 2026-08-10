import { Controller, Get, Res, type ServerResponse } from "bun-platform-kit"
import { churchBankingSigningKeyProvider } from "@/Banking/infrastructure/church-banking/ChurchBankingSigningKey.provider"

@Controller("/.well-known/banking-jwks.json")
export class ChurchBankingJwksController {
  @Get("/")
  async handle(@Res() res: ServerResponse) {
    const signing = await churchBankingSigningKeyProvider.get()

    res
      .set("Cache-Control", "public, max-age=300")
      .status(200)
      .json({ keys: [signing.publicJwk] })
  }
}
