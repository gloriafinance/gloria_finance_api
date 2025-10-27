import { createReadStream, promises as fs } from "fs"
import { parse } from "@fast-csv/parse"
import { Logger } from "@/Shared/adapter"
import {
  AssetInventoryStatus,
  IAssetRepository,
  ImportInventoryRequest,
} from "../domain"
import { IQueue, IQueueService, QueueName } from "@/Shared/domain"
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

const CSV_DELIMITER = ";"

const normalizeHeader = (header: string): string =>
  header
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")

const HEADER_MAPPING: Record<string, string> = {
  id_do_ativo: "assetId",
  id: "assetId",
  asset_id: "assetId",
  codigo_inventario: "inventoryCode",
  codigo: "inventoryCode",
  codigo_de_inventario: "inventoryCode",
  quantidade_inventario: "inventoryQuantity",
  quantidade: "inventoryQuantity",
  quantidade_inventariada: "inventoryQuantity",
  status_inventario: "inventoryStatus",
  status: "inventoryStatus",
  observacoes: "notes",
  observacao: "notes",
  comentarios: "notes",
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

export class ImportInventoryFromFile implements IQueue {
  private readonly logger = Logger(ImportInventoryFromFile.name)

  constructor(
    private readonly repository: IAssetRepository,
    private readonly queueService: IQueueService
  ) {}

  async handle(args: ImportInventoryRequest): Promise<any | void> {
    this.logger.info("Importing physical inventory from CSV", args)

    const summary = await this.execute(args)

    this.queueService.dispatch(QueueName.SendMail, {
      to: args.performedByDetails.email,
      subject: "Status de inventario",
      template: TemplateEmail.SummaryInventory,
      userName: args.performedByDetails.name,
      context: summary,
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

    await new Promise<void>((resolve, reject) => {
      const stream = createReadStream(filePath).pipe(
        parse({
          headers: (headers: string[]) =>
            headers.map((header) => {
              const normalized = normalizeHeader(header)

              return HEADER_MAPPING[normalized] ?? normalized
            }),
          delimiter: CSV_DELIMITER,
          ignoreEmpty: true,
          trim: true,
        })
      )

      stream
        .on("error", (error) => reject(error))
        .on("data", (data: Record<string, string>) => {
          const assetId = (data["assetId"] ?? "").trim()
          const inventoryCode = (data["inventoryCode"] ?? "").trim()
          const quantityValue = data["inventoryQuantity"]
          const notes = (data["notes"] ?? "").trim() || undefined

          const inventoryQuantity = quantityValue
            ? Number(quantityValue.replace(/\./g, "").replace(",", ".").trim())
            : Number.NaN

          const inventoryStatus = parseInventoryStatus(data["inventoryStatus"])

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
