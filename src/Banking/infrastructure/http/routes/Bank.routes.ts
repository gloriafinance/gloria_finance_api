import { Router } from "express"
import { PermissionMiddleware } from "@/Shared/infrastructure"
import { BankRequest } from "@/Banking/domain"
import { CreateOrUpdateBankController } from "@/Banking/infrastructure/http/controllers/CreateOrUpdateBank.controller"
import { FindBankByBankIdController } from "@/Banking/infrastructure/http/controllers/SearchBank.controller"
import bankValidator from "@/Banking/infrastructure/http/validators/Bank.validator"
import bankBRValidator from "@/Banking/infrastructure/http/validators/BankBR.validator"
import { listBankByChurchIdController } from "@/Banking/infrastructure/http/controllers/ListBanks.controller"

const bankRoute = Router()

//TODO sera necesario crear endpoint por pais para el registro de banco?
bankRoute.post(
  "/",
  [PermissionMiddleware, bankValidator, bankBRValidator],
  async (req, res) => {
    await CreateOrUpdateBankController(req.body as BankRequest, res)
  }
)

bankRoute.get("/data/:bankId", PermissionMiddleware, async (req, res) => {
  await FindBankByBankIdController(req.params.bankId, res)
})

bankRoute.get("/list/:churchId", PermissionMiddleware, async (req, res) => {
  await listBankByChurchIdController(req.params.churchId, res)
})

export default bankRoute
