import { promises as fs } from "fs"
import { join } from "path"
import { tmpdir } from "os"
import { Logger } from "@/Shared/adapter"
import {
  AssetCodeGenerator,
  AssetInventoryStatus,
  AssetInventoryStatusLabels,
  AssetResponse,
  AssetStatusLabels,
  IAssetRepository,
  PhysicalInventorySheetRequest,
} from "../domain"
import { mapAssetToResponse } from "./mappers/AssetResponse.mapper"

type PhysicalInventorySheetFile = {
  path: string
  filename: string
}

const CSV_SEPARATOR = ";"

export class GeneratePhysicalInventorySheet {
  private readonly logger = Logger(GeneratePhysicalInventorySheet.name)

  constructor(private readonly repository: IAssetRepository) {}

  async execute(
    request: PhysicalInventorySheetRequest
  ): Promise<PhysicalInventorySheetFile> {
    this.logger.info("Generating physical inventory checklist", request)

    const filters = AssetCodeGenerator.buildFilters({
      churchId: request.churchId,
      category: request.category,
      status: request.status,
    })

    const assets = await this.repository.search(filters)
    const responses = assets.map(mapAssetToResponse)

    return await this.buildCsvFile(responses)
  }

  private async buildCsvFile(
    assets: AssetResponse[]
  ): Promise<PhysicalInventorySheetFile> {
    const header = [
      "Código",
      "Nome",
      "Categoria",
      "Responsável",
      "Localização",
      "Status atual",
      "Última conferência",
      "Resultado",
      "Observações",
    ]

    const rows = assets.map((asset) => {
      const inventoryStatus = asset.inventoryStatus as AssetInventoryStatus | null

      return [
        asset.code,
        asset.name,
        asset.category,
        asset.responsibleId,
        asset.location,
        AssetStatusLabels[asset.status],
        asset.inventoryCheckedAt
          ? new Date(asset.inventoryCheckedAt).toLocaleDateString("pt-BR")
          : "",
        inventoryStatus
          ? AssetInventoryStatusLabels[inventoryStatus]
          : "",
        "",
      ]
    })

    const csv = [header, ...rows]
      .map((row) =>
        row
          .map((value) => `"${(value ?? "").toString().replace(/"/g, '""')}"`)
          .join(CSV_SEPARATOR)
      )
      .join("\n")

    const timestamp = Date.now()
    const filename = `inventario-fisico-${timestamp}.csv`
    const tempFilePath = join(
      tmpdir(),
      `${timestamp}-${Math.random().toString(16).slice(2)}.csv`
    )

    await fs.writeFile(tempFilePath, csv, "utf-8")

    return {
      path: tempFilePath,
      filename,
    }
  }
}
