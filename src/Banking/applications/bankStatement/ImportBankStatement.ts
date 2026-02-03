import { promises as fs } from "fs"
import * as path from "path"
import * as os from "os"
import { Logger } from "@/Shared/adapter/CustomLogger"
import { type IQueueService, QueueName } from "@/package/queue/domain"
import { Bank } from "@/Banking/domain"
import type { IAvailabilityAccountRepository } from "@/Financial/domain/interfaces"
import { AvailabilityAccountNotFound } from "@/Financial/domain"

type ImportBankStatementRequest = {
  bank: Bank
  churchId: string
  month: number | string
  year: number | string
  uploadedBy: string
  file: any
}

export class ImportBankStatement {
  private readonly logger = Logger(ImportBankStatement.name)

  constructor(
    private readonly availabilityAccountRepository: IAvailabilityAccountRepository,
    private readonly queueService: IQueueService
  ) {}

  async execute(request: ImportBankStatementRequest): Promise<{
    queuedAt: Date
    filePath: string
  }> {
    this.logger.info("Queueing bank statement import", {
      bank: { ...request.bank.toPrimitives() },
      churchId: request.churchId,
      month: request.month,
      year: request.year,
      uploadedBy: request.uploadedBy,
    })

    const availabilityAccount = await this.availabilityAccountRepository.one({
      "source.bankId": request.bank.getBankId(),
      churchId: request.churchId,
    })

    if (!availabilityAccount) {
      throw new AvailabilityAccountNotFound()
    }

    const filePath = await this.persistTempFile(request)

    this.queueService.dispatch(QueueName.ImportBankStatementJob, {
      churchId: request.churchId,
      bank: request.bank,
      availabilityAccount: {
        accountName: availabilityAccount.getAccountName(),
        availabilityAccountId: availabilityAccount.getAvailabilityAccountId(),
      },
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

  private async persistTempFile(
    request: ImportBankStatementRequest
  ): Promise<string> {
    const baseDir = path.join(os.tmpdir())
    await fs.mkdir(baseDir, { recursive: true })

    const timestamp = Date.now()
    const safeOriginalName = this.sanitizeFilename(request.file.name)
    const tempPath = path.join(
      baseDir,
      `${request.churchId}-${request.month
        .toString()
        .padStart(2, "0")}-${request.year}-${timestamp}-${safeOriginalName}`
    )

    if (request.file.tempFilePath) {
      await fs.copyFile(request.file.tempFilePath, tempPath)
    } else if (request.file.data) {
      await fs.writeFile(tempPath, request.file.data)
    } else if (
      request.file.arrayBuffer &&
      typeof request.file.arrayBuffer === "function"
    ) {
      const buffer = Buffer.from(await request.file.arrayBuffer())
      await fs.writeFile(tempPath, buffer)
    } else {
      throw new Error("Uploaded file does not contain data to persist")
    }

    return tempPath
  }

  private sanitizeFilename(filename: string): string {
    const baseName = path.basename(filename || "upload")
    const normalized = baseName
      .replace(/\s+/g, "_")
      .replace(/[^\w.-]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "")

    return normalized || "upload"
  }
}
