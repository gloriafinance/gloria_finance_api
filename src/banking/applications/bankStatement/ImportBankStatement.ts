import { promises as fs } from "fs"
import path from "path"
import os from "os"
import { Logger } from "@/Shared/adapter/CustomLogger"
import { IQueueService, QueueName } from "@/Shared/domain"
import { ImportBankStatementRequest } from "@/banking/domain/requests/ImportBankStatement.request"

export class ImportBankStatement {
  private readonly logger = Logger(ImportBankStatement.name)

  constructor(private readonly queueService: IQueueService) {}

  async execute(request: ImportBankStatementRequest): Promise<{
    queuedAt: Date
    filePath: string
  }> {
    this.logger.info("Queueing bank statement import", {
      bank: request.bank,
      churchId: request.churchId,
      month: request.month,
      year: request.year,
      uploadedBy: request.uploadedBy,
    })

    const filePath = await this.persistTempFile(request)

    this.queueService.dispatch(QueueName.ImportBankStatementJob, {
      churchId: request.churchId,
      bank: request.bank,
      accountName: request.accountName,
      month: request.month,
      year: request.year,
      filePath,
      uploadedBy: request.uploadedBy,
    })

    return {
      queuedAt: new Date(),
      filePath,
    }
  }

  private async persistTempFile(request: ImportBankStatementRequest) {
    const baseDir = path.join(
      os.tmpdir(),
      "church-finance-api",
      "bank-statements"
    )
    await fs.mkdir(baseDir, { recursive: true })

    const timestamp = Date.now()
    const normalizedName = request.file.name.replace(/\s+/g, "_")
    const tempPath = path.join(
      baseDir,
      `${request.churchId}-${request.month
        .toString()
        .padStart(2, "0")}-${request.year}-${timestamp}-${normalizedName}`
    )

    if (request.file.tempFilePath) {
      await fs.copyFile(request.file.tempFilePath, tempPath)
    } else if (request.file.data) {
      await fs.writeFile(tempPath, request.file.data)
    } else {
      throw new Error("Uploaded file does not contain data to persist")
    }

    return tempPath
  }
}
