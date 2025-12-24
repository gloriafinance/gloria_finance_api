import { createReadStream, promises as fs } from "fs"
import { parse } from "@fast-csv/parse"
import { Logger } from "@/Shared/adapter"
import {
  AssetInventoryStatus,
  IAssetRepository,
  ImportInventoryRequest,
} from "../domain"
import { IJob, IQueueService, QueueName } from "@/Shared/domain"
import { TemplateEmail } from "@/SendMail/enum/templateEmail.enum"

type InventoryCsvRow = {
  assetId: string
  inventoryCode: string
  inventoryQuantity: number
  inventoryStatus: AssetInventoryStatus
  notes?: string
}

type ImportInventorySummary = {
  processed: number
  updated: number
  skipped: Array<{ assetId?: string; reason: string }>
  errors: Array<{ assetId?: string; reason: string }>
}

const normalizeHeader = (header: string): string =>
  header
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")

const HEADER_KEYS: Record<string, string> = {
  id_do_ativo: "assetId",
  codigo_atual: "currentCode",
  codigo_inventario: "inventoryCode",
  quantidade_inventario: "inventoryQuantity",
  quantidade_registrada: "registeredQuantity",
  status_inventario: "inventoryStatus",
  observacoes: "notes",
}

const detectDelimiter = async (filePath: string): Promise<string> => {
  try {
    const content = await fs.readFile(filePath, { encoding: "utf-8" })
    const firstLine = content.split(/\r?\n/, 1)[0] ?? ""

    const semicolonCount = (firstLine.match(/;/g) || []).length
    const commaCount = (firstLine.match(/,/g) || []).length
    const tabCount = (firstLine.match(/\t/g) || []).length

    if (
      semicolonCount >= commaCount &&
      semicolonCount >= tabCount &&
      semicolonCount > 0
    ) {
      return ";"
    }

    if (
      commaCount >= semicolonCount &&
      commaCount >= tabCount &&
      commaCount > 0
    ) {
      return ","
    }

    if (tabCount > 0) {
      return "\t"
    }
  } catch (error) {
    // Fallback handled below
  }

  return ";"
}

const parseInventoryStatus = (
  value: string | undefined
): AssetInventoryStatus => {
  const normalized = (value ?? "").trim().toUpperCase()

  if (normalized === AssetInventoryStatus.NOT_FOUND) {
    return AssetInventoryStatus.NOT_FOUND
  }

  return AssetInventoryStatus.CONFIRMED
}

export class ProcessInventoryFromFileJob implements IJob {
  private readonly logger = Logger(ProcessInventoryFromFileJob.name)

  constructor(
    private readonly repository: IAssetRepository,
    private readonly queueService: IQueueService
  ) {}

  async handle(args: ImportInventoryRequest): Promise<any | void> {
    this.logger.info("Importing physical inventory from CSV", args)

    const startedAt = new Date()
    const summary = await this.execute(args)
    const finishedAt = new Date()

    const emailContext = {
      startedAt: startedAt.toLocaleString("pt-BR"),
      finishedAt: finishedAt.toLocaleString("pt-BR"),
      performer: args.performedByDetails,
      processed: summary.processed,
      updated: summary.updated,
      skipped: summary.skipped,
      errors: summary.errors,
    }

    this.queueService.dispatch(QueueName.SendMailJob, {
      to: args.performedByDetails.email,
      subject: "Status de inventario",
      template: TemplateEmail.SummaryInventory,
      userName: args.performedByDetails.name,
      context: emailContext,
    })

    await fs.unlink(args.filePath).catch(() => undefined)
  }

  private async execute(
    request: ImportInventoryRequest
  ): Promise<ImportInventorySummary> {
    const rows = await this.readRows(request.filePath)
    const summary: ImportInventorySummary = {
      processed: rows.length,
      updated: 0,
      skipped: [],
      errors: [],
    }

    for (const row of rows) {
      if (!row.assetId) {
        summary.skipped.push({
          reason: "Linha sem identificador de ativo",
        })
        continue
      }

      if (!row.inventoryCode) {
        summary.skipped.push({
          assetId: row.assetId,
          reason: "Código inventariado ausente",
        })
        continue
      }

      if (Number.isNaN(row.inventoryQuantity)) {
        summary.skipped.push({
          assetId: row.assetId,
          reason: "Quantidade inventariada inválida",
        })
        continue
      }

      try {
        const asset = await this.repository.one({ assetId: row.assetId })

        if (!asset) {
          summary.errors.push({
            assetId: row.assetId,
            reason: "Ativo não encontrado",
          })
          continue
        }

        asset.markInventory({
          performedByDetails: request.performedByDetails,
          status: row.inventoryStatus,
          notes: row.notes,
          code: row.inventoryCode,
          quantity: row.inventoryQuantity,
        })

        await this.repository.upsert(asset)
        summary.updated += 1
      } catch (error) {
        this.logger.error("Failed to import inventory row", {
          assetId: row.assetId,
          error,
        })

        summary.errors.push({
          assetId: row.assetId,
          reason: "Erro ao atualizar ativo",
        })
      }
    }

    return summary
  }

  private async readRows(filePath: string): Promise<InventoryCsvRow[]> {
    const rows: InventoryCsvRow[] = []
    const delimiter = await detectDelimiter(filePath)

    await new Promise<void>((resolve, reject) => {
      const stream = createReadStream(filePath).pipe(
        parse({
          headers: (headers: string[]) =>
            headers.map((header) => {
              const normalized = normalizeHeader(header)
              return HEADER_KEYS[normalized] ?? normalized
            }),
          delimiter,
          ignoreEmpty: true,
          trim: true,
        })
      )

      stream
        .on("error", (error) => reject(error))
        .on("data", (data: Record<string, string>) => {
          const assetId = (data["assetId"] ?? "").trim()
          const inventoryCode = (
            data["inventoryCode"] ??
            data["currentCode"] ??
            ""
          ).trim()

          const quantityRaw = (
            data["inventoryQuantity"] ??
            data["registeredQuantity"] ??
            ""
          ).trim()

          const inventoryQuantity = quantityRaw
            ? Number(quantityRaw.replace(/\./g, "").replace(",", "."))
            : Number.NaN

          const inventoryStatusRaw = (data["inventoryStatus"] ?? "").trim()
          const inventoryStatus = parseInventoryStatus(inventoryStatusRaw)

          const notesRaw = (data["notes"] ?? "").trim()
          const notes = notesRaw.length > 0 ? notesRaw : undefined

          rows.push({
            assetId,
            inventoryCode,
            inventoryQuantity,
            inventoryStatus,
            notes,
          })
        })
        .on("end", () => resolve())
    })

    return rows
  }
}
