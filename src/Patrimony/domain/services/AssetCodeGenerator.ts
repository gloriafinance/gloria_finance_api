import { AssetListFilters, IAssetRepository } from "@/Patrimony"

const CODE_PREFIX = "BEM-"
const CODE_PAD_LENGTH = 6

export class AssetCodeGenerator {
  constructor(private readonly repository: IAssetRepository) {}

  static buildFilters(filter?: AssetListFilters): AssetListFilters {
    return {
      churchId: filter?.churchId,
      category: filter?.category,
      status: filter?.status,
    }
  }

  async generate(): Promise<string> {
    let attempts = 0

    while (attempts < 5) {
      const total = await this.repository.count()
      const next = total + 1 + attempts
      const candidate = `${CODE_PREFIX}${next.toString().padStart(CODE_PAD_LENGTH, "0")}`

      const exists = await this.repository.one({ code: candidate })

      if (!exists) {
        return candidate
      }

      attempts += 1
    }

    const fallback = Date.now().toString()

    return `${CODE_PREFIX}${fallback
      .slice(-CODE_PAD_LENGTH)
      .padStart(CODE_PAD_LENGTH, "0")}`
  }
}
