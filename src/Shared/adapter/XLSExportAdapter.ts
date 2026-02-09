import type { IXLSExportAdapter, ReportFile } from "@/Shared/domain"
import { join } from "path"
import { promises as fs } from "fs"

const TEMP_DIR = join(process.cwd(), "tmp")

const CSV_SEPARATOR = ";"

/**
 * Implementing the Excel Export Adapter
 */
export class XLSExportAdapter implements IXLSExportAdapter {
  async export(
    rows: any[],
    header: string[],
    sheetName: string
  ): Promise<ReportFile> {
    const csv = [header, ...rows]
      .map((row) =>
        row
          .map(
            (value: any) => `"${(value ?? "").toString().replace(/"/g, '""')}"`
          )
          .join(CSV_SEPARATOR)
      )
      .join("\n")

    const timestamp = Date.now()
    const filename = `${sheetName}-${timestamp}.csv`
    await fs.mkdir(TEMP_DIR, { recursive: true })
    const tempFilePath = join(
      TEMP_DIR,
      `${timestamp}-${Math.random().toString(16).slice(2)}.csv`
    )

    await fs.writeFile(tempFilePath, csv, "utf-8")

    return {
      filename,
      path: tempFilePath,
    }
  }
}
