import { Router } from "express"
import { findByCountryIdController } from "../controllers/State.controller"

const worldRoute = Router()

worldRoute.get("/states/:countryId", async (req, res) => {
  await findByCountryIdController(req.params.countryId, res)
})

export default worldRoute
