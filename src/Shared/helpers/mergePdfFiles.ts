import { readFile } from "node:fs/promises"
import { PDFDocument } from "pdf-lib"

const toBuffer = async (file: any): Promise<Buffer> => {
  const filePath = file?.tempFilePath || file?.path || file?.filePath

  if (filePath) {
    return await readFile(filePath)
  }

  if (file?.data && Buffer.isBuffer(file.data)) {
    return file.data
  }

  if (file?.arrayBuffer && typeof file.arrayBuffer === "function") {
    return Buffer.from(await file.arrayBuffer())
  }

  throw new Error("Unsupported file input for PDF merge.")
}

export const mergePdfFiles = async (files: any[]): Promise<any | undefined> => {
  if (!files.length) {
    return undefined
  }

  if (files.length === 1) {
    return files[0]
  }

  const mergedPdf = await PDFDocument.create()

  for (const file of files) {
    const buffer = await toBuffer(file)
    const pdf = await PDFDocument.load(buffer)
    const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices())
    pages.forEach((page) => mergedPdf.addPage(page))
  }

  const mergedBytes = await mergedPdf.save()

  return {
    data: Buffer.from(mergedBytes),
    name: "invoice.pdf",
    mimetype: "application/pdf",
  }
}
