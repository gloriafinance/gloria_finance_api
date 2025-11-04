import { Response } from "express"
import { HttpStatus } from "@/Shared/domain"
import domainResponse from "@/Shared/helpers/domainResponse"
import { ImportBankStatement } from "@/banking/applications"
import { QueueService } from "@/Shared/infrastructure"

type ImportBankStatementHttpRequest = {
  bank: string
  month: number | string
  year: number | string
  accountName?: string
  churchId?: string
  files?: Record<string, any>
  user: {
    churchId: string
    name: string
    isSuperuser?: boolean
  }
}

export const importBankStatementController = async (
  req: ImportBankStatementHttpRequest,
  res: Response
): Promise<void> => {
  try {
    const file = req.files?.file

    if (!file) {
      res.status(HttpStatus.BAD_REQUEST).send({
        file: {
          message: "Arquivo do extrato é obrigatório",
          rule: "required",
        },
      })
      return
    }

    const bank = String(req.bank).toUpperCase()
    const month = Number(req.month)
    const year = Number(req.year)

    if (Number.isNaN(month) || Number.isNaN(year)) {
      res.status(HttpStatus.UNPROCESSABLE_ENTITY).send({
        month: {
          message: "Mês e ano devem ser numéricos",
          rule: "integer",
        },
      })
      return
    }
    const churchId = resolveChurchId(req)

    const result = await new ImportBankStatement(
      QueueService.getInstance()
    ).execute({
      bank,
      churchId,
      month,
      year,
      accountName: req.accountName,
      uploadedBy: req.user.name,
      file,
    })

    res.status(HttpStatus.ACCEPTED).send({
      bank,
      month,
      year,
      churchId,
      queuedAt: result.queuedAt,
    })
  } catch (error) {
    domainResponse(error, res)
  }
}

const resolveChurchId = (req: ImportBankStatementHttpRequest): string => {
  if (req.user?.isSuperuser && req.churchId) {
    return req.churchId
  }

  return req.user?.churchId
}
