import { Logger } from "@/Shared/adapter"
import { HttpStatus } from "@/Shared/domain"
import { UploadedFile } from "express-fileupload"

const logger = Logger("ImportInventoryValidator")

const extractFile = (files: Record<string, unknown> | undefined) => {
  if (!files) {
    return undefined
  }

  const candidates = ["file", "inventoryFile"]

  for (const candidate of candidates) {
    const value = files[candidate] as UploadedFile | UploadedFile[] | undefined

    if (!value) {
      continue
    }

    if (Array.isArray(value)) {
      return value[0]
    }

    return value
  }

  return undefined
}

export default async (req, res, next) => {
  const file = extractFile(req.files as Record<string, unknown> | undefined)

  if (!file) {
    logger.info("Inventory import called without file")

    return res.status(HttpStatus.UNPROCESSABLE_ENTITY).send({
      file: {
        message: "Arquivo CSV de inventário é obrigatório.",
        rule: "required",
      },
    })
  }

  req["inventoryFile"] = file

  next()
}
