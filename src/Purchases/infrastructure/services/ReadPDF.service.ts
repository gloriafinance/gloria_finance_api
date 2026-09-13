import { execFileSync } from "node:child_process"
import { existsSync } from "node:fs"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import type { BunMultipartFile } from "bun-platform-kit"
import { GenericException } from "@/Shared/domain"

export type ExtractedPurchase = {
  items: Array<{
    quantity: number
    price: number
    total: number
    name: string
  }>

  purchaseDate: Date
  total: number
  tax: number
  description: string
}

/* ============================================================
 * BASIC HELPERS
 * ============================================================ */

const compact = (value = "") => value.replace(/\s+/g, " ").trim()

function first(text: string, regex: RegExp, group = 1): string | null {
  return text.match(regex)?.[group]?.trim() ?? null
}

function money(value?: string | null): number | null {
  if (!value) {
    return null
  }

  const normalized = value
    .replace(/R\$\s*/gi, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^0-9.-]/g, "")

  const result = Number(normalized)

  return Number.isFinite(result) ? result : null
}

function decimal(value?: string | null): number | null {
  if (!value) {
    return null
  }

  const result = Number(
    value
      .replace(/\./g, "")
      .replace(",", ".")
      .replace(/[^0-9.-]/g, "")
  )

  return Number.isFinite(result) ? result : null
}

function unitPrice(value?: string | null): number | null {
  if (!value) {
    return null
  }

  const normalized = value.replace(/\s/g, "").replace(/[^0-9,.-]/g, "")

  if (!normalized.includes(",")) {
    const result = Number(normalized)

    return Number.isFinite(result) ? result : null
  }

  return money(normalized)
}

/**
 * Como Purchase trabaja con fecha y no necesitamos
 * preservar la hora fiscal, creamos siempre UTC midnight.
 *
 * Así evitamos:
 *
 * 2026-08-31 -> 2026-08-30 por timezone.
 */
function purchaseDate(value?: string | null): Date | null {
  if (!value) {
    return null
  }

  const match = value.match(/(\d{2})[/.](\d{2})[/.](\d{4})/)

  if (!match) {
    return null
  }

  const [, day, month, year] = match

  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
}

function section(text: string, start: RegExp, ends: RegExp[]): string {
  const startMatch = start.exec(text)

  if (!startMatch || startMatch.index == null) {
    return ""
  }

  const tail = text.slice(startMatch.index)

  let end = tail.length

  for (const pattern of ends) {
    const match = pattern.exec(tail.slice(1))

    if (match?.index != null) {
      end = Math.min(end, match.index + 1)
    }
  }

  return tail.slice(0, end)
}

/* ============================================================
 * PDF -> TEXT
 * ============================================================ */

function pdfToText(pdfPath: string): string {
  if (!existsSync(pdfPath)) {
    throw new Error(`Archivo no encontrado: ${pdfPath}`)
  }

  try {
    return execFileSync("pdftotext", ["-layout", "-nopgbrk", pdfPath, "-"], {
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    })
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      throw new Error(
        "pdftotext no está instalado. " + "macOS: brew install poppler"
      )
    }

    throw error
  }
}

/* ============================================================
 * DOCUMENT TYPE
 * ============================================================ */

type FiscalDocumentType = "NFE" | "NFCE" | "NFSE_NACIONAL" | "NFSE_MUNICIPAL"

function detectType(text: string): FiscalDocumentType {
  if (
    /Nota Fiscal de Consumidor\s+Eletr[oô]nica/i.test(text) ||
    /NFC-e/i.test(text)
  ) {
    return "NFCE"
  }

  if (/DANFSe\s+v/i.test(text) || /Documento Auxiliar da NFS-e/i.test(text)) {
    return "NFSE_NACIONAL"
  }

  if (/DANFE/i.test(text) && /Nota Fiscal\s+Eletr[oô]nica/i.test(text)) {
    return "NFE"
  }

  if (/NOTA FISCAL DE SERVIÇOS ELETRÔNICA\s*-\s*NFS-E/i.test(text)) {
    return "NFSE_MUNICIPAL"
  }

  throw new Error("Formato fiscal no reconocido.")
}

/* ============================================================
 * COLUMN EXTRACTION
 *
 * pdftotext -layout preserva posición horizontal.
 *
 * DANFE usa muchas tablas:
 *
 * VALOR DO ICMS        VALOR TOTAL ...
 *       120,96                 672,00
 *
 * No podemos simplemente buscar "el próximo número".
 * ============================================================ */

const KNOWN_LABELS = [
  "BASE DE CÁLCULO DO ICMS",
  "BASE DE CALCULO DO ICMS",

  "VALOR DO ICMS",

  "BASE DE CÁLC. ICMS S.T.",
  "BASE DE CÁLCULO DO ICMS SUBSTITUIÇÃO",

  "VALOR DO ICMS SUBST.",
  "VALOR DO ICMS SUBSTITUIÇÃO",

  "VALOR IMP. IMPORTAÇÃO",
  "VALOR DO PIS",

  "VALOR TOTAL DOS PRODUTOS",

  "VALOR DO FRETE",
  "VALOR DO SEGURO",
  "DESCONTO",

  "OUTRAS DESPESAS",
  "OUTRAS DESPESAS ACESSÓRIAS",

  "VALOR TOTAL DO IPI",
  "VALOR DO IPI",

  "VALOR DA COFINS",
  "VALOR TOTAL DA NOTA",

  "VALOR BRUTO DA NOTA",
  "VALOR LÍQUIDO DA NOTA",

  "VALOR TOTAL DAS DEDUÇÕES",
  "DESCONTO INCONDICIONADO",
  "DESCONTO CONDICIONADO",

  "BASE DE CÁLCULO",
  "ALÍQUOTA",
  "VALOR DO ISS",

  "VALOR DO SERVIÇO",
  "TOTAL DEDUÇÕES/REDUÇÕES",

  "BC ISSQN",
  "ALÍQUOTA APLICADA",
  "RETENÇÃO DO ISSQN",
  "ISSQN APURADO",

  "VALOR LÍQUIDO DA NFS-E",

  "DATA DA EMISSÃO",
]

function normalizeLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
}

function findColumn(text: string, labelRegex: RegExp) {
  const lines = text.split(/\r?\n/)

  const labels = KNOWN_LABELS.map((label) => ({
    raw: label,
    normalized: normalizeLabel(label),
  }))

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex]

    if (line == null) {
      continue
    }

    const match = labelRegex.exec(line)

    if (!match || match.index == null) {
      continue
    }

    const start = match.index

    const normalizedLine = normalizeLabel(line)

    const current = normalizeLabel(match[0])

    let end = line.length

    /*
     * Busca la próxima columna conocida.
     *
     * Funciona incluso cuando hay solamente
     * un espacio entre títulos:
     *
     * BASE DE CÁLCULO DO ICMS VALOR DO ICMS
     */
    for (const candidate of labels) {
      const index = normalizedLine.indexOf(
        candidate.normalized,
        start + current.length
      )

      if (index >= 0 && index < end) {
        end = index
      }
    }

    /*
     * Si es la última columna de la fila,
     * damos un ancho razonable.
     */
    if (end === line.length) {
      end = Math.max(line.length, start + match[0].length + 40)
    }

    return {
      lines,
      lineIndex,
      start,
      end,
    }
  }

  return null
}

function valueBelow(
  text: string,
  label: RegExp,
  valueRegex: RegExp,
  rows = 2
): string | null {
  const column = findColumn(text, label)

  if (!column) {
    return null
  }

  /*
   * Incluye la misma fila porque algunos
   * documentos tienen:
   *
   * VALOR BRUTO DA NOTA R$ 19.000,00
   */
  for (
    let i = column.lineIndex;
    i <= Math.min(column.lines.length - 1, column.lineIndex + rows);
    i++
  ) {
    const line = column.lines[i]

    if (line == null) {
      continue
    }

    const cell = line.slice(Math.max(0, column.start - 2), column.end + 2)

    const match = cell.match(valueRegex)

    if (match) {
      return match[0]
    }
  }

  return null
}

function moneyBelow(text: string, label: RegExp): number | null {
  return money(
    valueBelow(text, label, /(?:R\$\s*)?\d{1,3}(?:\.\d{3})*,\d{2}/, 2)
  )
}

function dateBelow(text: string, label: RegExp): Date | null {
  return purchaseDate(valueBelow(text, label, /\d{2}[/.]\d{2}[/.]\d{4}/, 2))
}

/* ============================================================
 * NF-e ITEMS
 * ============================================================ */

/**
 * Identifica algo razonable como código de producto.
 *
 * Ej:
 *
 * MLB4883895055
 * L123
 * ABC-123
 */
function looksLikeProductCode(value: string): boolean {
  if (!value || value.length > 30) {
    return false
  }

  if (/\d/.test(value)) {
    return true
  }

  return /^[A-Z][A-Z0-9._-]{1,15}$/.test(value)
}

function isProductHeader(line: string): boolean {
  return /C[ÓO]DIGO|DESCRI|NCM\/SH|VALOR UNIT|VLR UNIT|VALOR TOTAL|B\.C[ÁA]LC|DADOS (?:DO|DOS) PRODUTO|PRODUTO\s*$|PROD\.\s*ICMS/i.test(
    line
  )
}

/**
 * La parte más estable de las tablas DANFE es:
 *
 * NCM
 * CST / CSOSN
 * CFOP
 * UNIDADE
 * QUANTIDADE
 * VALOR UNITÁRIO
 * VALOR TOTAL
 *
 * Por eso la usamos como "ancla" del producto.
 */
const PRODUCT_DETAIL_REGEX =
  /\b(\d{4}(?:\.?\d{2}){2})\s+(\d{3,4})\s+(\d{4})\s+([A-Z0-9.]{1,8})\s+(\d+(?:[.,]\d+)?)\s+([\d.,]+)\s+([\d.]+,\d{2})/i

function parseNfeItems(productSection: string): ExtractedPurchase["items"] {
  const lines = productSection.split(/\r?\n/)

  const items: ExtractedPurchase["items"] = []

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]

    if (rawLine == null) {
      continue
    }

    const detail = PRODUCT_DETAIL_REGEX.exec(rawLine)

    if (!detail) {
      continue
    }

    let code: string | null = null

    let baseLine = -1

    const descriptionParts: string[] = []

    /*
     * CASO 1
     *
     * MLB4883895055 Creme Para O Corpo ...
     *                 33072090 0102 5102 ...
     *                 Caramelada ...
     *
     * Buscamos código + descripción
     * hasta 4 líneas arriba.
     */
    for (let j = i - 1; j >= Math.max(0, i - 4); j--) {
      const candidate = compact(lines[j])

      if (!candidate || isProductHeader(candidate)) {
        continue
      }

      const [, candidateCode, candidateDescription] =
        candidate.match(/^(\S+)\s+(.+)$/) ?? []

      if (
        candidateCode &&
        candidateDescription &&
        looksLikeProductCode(candidateCode)
      ) {
        code = candidateCode

        descriptionParts.push(candidateDescription)

        baseLine = j

        break
      }
    }

    /*
     * CASO 2
     *
     * L123  ETRURIA - FELTRO ... 56021000 000 5929...
     *
     * Todo comienza en la misma línea.
     */
    const prefix = compact(rawLine.slice(0, detail.index))

    if (!code && prefix) {
      const [, prefixCode, prefixDescription] =
        prefix.match(/^(\S+)\s+(.+)$/) ?? []

      if (prefixCode && prefixDescription && looksLikeProductCode(prefixCode)) {
        code = prefixCode

        descriptionParts.push(prefixDescription)

        baseLine = i
      }
    } else if (code && prefix) {
      /*
       * Puede ser continuación de la descripción
       * en la misma línea donde empiezan los números.
       */
      descriptionParts.push(prefix)
    }

    if (!code) {
      continue
    }

    /*
     * Continuaciones entre la línea del código
     * y la línea numérica.
     */
    for (let j = baseLine + 1; j < i; j++) {
      const value = compact(lines[j])

      if (
        !value ||
        isProductHeader(value) ||
        PRODUCT_DETAIL_REGEX.test(value)
      ) {
        continue
      }

      descriptionParts.push(value)
    }

    /*
     * Continuaciones posteriores.
     *
     * Caso Jacqueline:
     * Caramelada E Baunilha 400 Ml
     *
     * Caso Etruria:
     * C/ RESINA
     */
    for (let j = i + 1; j < Math.min(lines.length, i + 4); j++) {
      const value = compact(lines[j])

      if (!value) {
        break
      }

      if (
        /^(DADOS|C[ÁA]LCULO|INFORMAÇÕES|TRANSPORTADOR|RESERVADO)\b/i.test(value)
      ) {
        break
      }

      if (isProductHeader(value) || PRODUCT_DETAIL_REGEX.test(value)) {
        break
      }

      descriptionParts.push(value)
    }

    /*
     * Elimina duplicados que algunos PDFs
     * pueden generar al reconstruir líneas.
     */
    const name = Array.from(
      new Set(descriptionParts.map(compact).filter(Boolean))
    ).join(" ")

    items.push({
      quantity: decimal(detail[5]) ?? 1,

      price: unitPrice(detail[6]) ?? 0,

      total: money(detail[7]) ?? 0,

      name,
    })
  }

  return items
}

/* ============================================================
 * NF-e
 * ============================================================ */

function parseNfce(text: string): ExtractedPurchase {
  const productsSection = section(text, /C[oó]digo\s+Descri[cç][aã]o/i, [
    /Qtde\.\s+total de itens/i,
  ])

  const items: ExtractedPurchase["items"] = []
  const productLine =
    /^\s*(.+?)\s+(\d+(?:[.,]\d+)?)\s+([\d.,]+)\s+([\d.,]+)\s*$/

  for (const line of productsSection.split(/\r?\n/)) {
    const [, rawName, rawQuantity, , rawTotal] = productLine.exec(line) ?? []

    if (!rawName || !rawQuantity || !rawTotal) {
      continue
    }

    const quantity = decimal(rawQuantity)
    const total = money(rawTotal)

    if (quantity == null || quantity === 0 || total == null) {
      continue
    }

    items.push({
      quantity,
      price: total / quantity,
      total,
      name: rawName.replace(/^\d+\s*/, "").trim(),
    })
  }

  const date = purchaseDate(
    first(text, /NFC-e\s+nº[\s\S]*?(\d{2}[/.]\d{2}[/.]\d{4})/i)
  )
  const total = money(first(text, /Valor total\s+R\$\s*([\d.]+,\d{2})/i))
  const tax =
    money(
      first(
        text,
        /Informaç[aã]o dos Tributos Totais Incidentes[\s\S]*?R\$\s*([\d.]+,\d{2})/i
      )
    ) ?? 0

  if (!date) {
    throw new Error("No pude extraer la fecha de emisión de la NFC-e.")
  }

  if (total == null) {
    throw new Error("No pude extraer el valor total de la NFC-e.")
  }

  if (!items.length) {
    throw new Error("La NFC-e fue reconocida, pero no pude extraer sus items.")
  }

  return {
    items,
    purchaseDate: date,
    total,
    tax,
    description: items.map((item) => item.name).join("; "),
  }
}

function parseNfe(text: string): ExtractedPurchase {
  const productSection = section(
    text,
    /DADOS (?:DO|DOS) PRODUTO(?:S)?\s*\/\s*SERVIÇOS/i,
    [/C[ÁA]LCULO DO ISSQN/i, /DADOS ADICIONAIS/i]
  )

  const items = parseNfeItems(productSection)

  const date =
    dateBelow(text, /DATA DA EMISSÃO/i) ??
    purchaseDate(first(text, /EMISS[ÃA]O:\s*(\d{2}\/\d{2}\/\d{4})/i))

  const total = moneyBelow(text, /VALOR TOTAL DA (?:NOTA|NF)/i)

  /*
   * tax es informativo.
   *
   * NO se suma al total.
   *
   * Para NF-e agregamos tributos explícitos
   * que aparecen individualizados.
   */
  const tax = [
    moneyBelow(text, /VALOR DO ICMS(?!\s+SUBST)/i),

    moneyBelow(text, /VALOR TOTAL DO IPI/i) ??
      moneyBelow(text, /VALOR DO IPI/i),

    moneyBelow(text, /VALOR DO PIS/i),

    moneyBelow(text, /VALOR DA COFINS/i),
  ].reduce<number>((sum, value) => sum + (value ?? 0), 0)

  if (!date) {
    throw new Error("No pude extraer DATA DA EMISSÃO de la NF-e.")
  }

  if (total == null) {
    throw new Error("No pude extraer VALOR TOTAL DA NOTA de la NF-e.")
  }

  if (items.length === 0) {
    throw new Error("La NF-e fue reconocida, pero no pude extraer sus items.")
  }

  const description = items
    .map((item) => item.name)
    .filter(Boolean)
    .join("; ")

  return {
    items,
    purchaseDate: date,
    total,
    tax,
    description,
  }
}

/* ============================================================
 * NFS-e MUNICIPAL
 * ============================================================ */

function parseMunicipalNfse(text: string): ExtractedPurchase {
  const serviceSection = section(text, /DISCRIMINAÇÃO DO SERVIÇO/i, [
    /VALOR BRUTO DA NOTA/i,
    /IBS\/CBS\/NBS/i,
    /ENQUADRAMENTO DO SERVIÇO/i,
  ])

  /*
   * No hacemos join indiscriminado porque en algunos
   * modelos después del servicio aparecen:
   *
   * Valor Tributável
   * Valor não Tributável
   */
  const serviceLines = serviceSection
    .replace(/[\s\S]*?DISCRIMINAÇÃO DO SERVIÇO/i, "")
    .split(/\r?\n/)
    .map(compact)
    .filter(Boolean)

  const descriptionLines: string[] = []

  for (const line of serviceLines) {
    if (/^Valor Tributável:/i.test(line)) {
      break
    }

    if (/^R\$/i.test(line)) {
      break
    }

    descriptionLines.push(line)
  }

  const description = descriptionLines.join(" ") || "Serviço"

  const date = purchaseDate(
    first(text, /Data Emissão:\s*(\d{2}\/\d{2}\/\d{4})/i)
  )

  const gross =
    money(first(text, /VALOR BRUTO DA NOTA\s+(R\$\s*[\d.]+,\d{2})/i)) ??
    moneyBelow(text, /VALOR BRUTO DA NOTA/i)

  const total =
    money(first(text, /VALOR LÍQUIDO DA NOTA\s+(R\$\s*[\d.]+,\d{2})/i)) ??
    moneyBelow(text, /VALOR LÍQUIDO DA NOTA/i) ??
    gross

  const tax =
    moneyBelow(text, /Valor do ISS:/i) ?? moneyBelow(text, /Valor do ISS/i) ?? 0

  if (!date) {
    throw new Error("No pude extraer Data Emissão de la NFS-e.")
  }

  if (total == null) {
    throw new Error("No pude extraer el valor total de la NFS-e.")
  }

  const price = gross ?? total

  return {
    items: [
      {
        quantity: 1,
        price,
        total: price,
        name: description,
      },
    ],

    purchaseDate: date,

    total,

    tax,

    description,
  }
}

/* ============================================================
 * NFS-e NACIONAL / DANFSe
 * ============================================================ */

function parseNationalNfse(text: string): ExtractedPurchase {
  /*
   * Ej:
   *
   * Número       Competência      Data emissão
   * 68           10/04/2026       10/04/2026 09:43:21
   */
  const header = text.match(
    /Número da NFS-e\s+Competência da NFS-e\s+Data e Hora da emissão da NFS-e\s*\n\s*\d+\s+\d{2}\/\d{2}\/\d{4}\s+(\d{2}\/\d{2}\/\d{4})/i
  )

  const date = purchaseDate(header?.[1])

  const serviceSection = section(text, /SERVIÇO PRESTADO/i, [
    /\nTRIBUTAÇÃO MUNICIPAL/i,
  ])

  const rawDescription =
    first(serviceSection, /Descrição do Serviço\s*\n([\s\S]*)$/i) ?? ""

  const description =
    rawDescription.split(/\r?\n/).map(compact).filter(Boolean).join(" ") ||
    "Serviço"

  const municipalTaxSection = section(text, /TRIBUTAÇÃO MUNICIPAL/i, [
    /TRIBUTAÇÃO FEDERAL/i,
  ])

  const totalSection = section(text, /VALOR TOTAL DA NFS-E/i, [
    /TOTAIS APROXIMADOS/i,
  ])

  const serviceAmount =
    moneyBelow(municipalTaxSection, /Valor do Serviço/i) ??
    moneyBelow(totalSection, /Valor do Serviço/i)

  const total =
    moneyBelow(totalSection, /Valor Líquido da NFS-e/i) ?? serviceAmount

  const tax =
    moneyBelow(municipalTaxSection, /ISSQN Apurado/i) ??
    moneyBelow(totalSection, /ISSQN Retido/i) ??
    0

  if (!date) {
    throw new Error("No pude extraer la fecha de emisión de la DANFSe.")
  }

  if (total == null) {
    throw new Error("No pude extraer Valor Líquido da NFS-e.")
  }

  return {
    items: [
      {
        quantity: 1,
        price: serviceAmount ?? total,
        total: serviceAmount ?? total,
        name: description,
      },
    ],

    purchaseDate: date,

    total,

    tax,

    description,
  }
}

/* ============================================================
 * PUBLIC API
 * ============================================================ */

function extractPurchaseFromFiscalPdf(pdfPath: string): ExtractedPurchase {
  const text = pdfToText(pdfPath)

  const type = detectType(text)

  switch (type) {
    case "NFE":
      return parseNfe(text)

    case "NFCE":
      return parseNfce(text)

    case "NFSE_NACIONAL":
      return parseNationalNfse(text)

    case "NFSE_MUNICIPAL":
      return parseMunicipalNfse(text)
  }
}

export async function readPurchaseFromPdf(
  file: BunMultipartFile
): Promise<ExtractedPurchase> {
  if (file.type !== "application/pdf") {
    throw new GenericException("Field `file` must be a PDF")
  }

  const content = Buffer.from(await file.arrayBuffer())

  if (!content.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
    throw new GenericException("Field `file` must be a valid PDF")
  }

  const directory = await mkdtemp(join(tmpdir(), "purchase-pdf-"))
  const pdfPath = join(directory, "document.pdf")

  try {
    await writeFile(pdfPath, content)

    return extractPurchaseFromFiscalPdf(pdfPath)
  } catch {
    throw new GenericException(
      "Unable to extract purchase data from the provided PDF"
    )
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

export async function readPurchaseFromPdfs(
  files: BunMultipartFile[]
): Promise<ExtractedPurchase> {
  if (!files.length) {
    throw new GenericException("Field `file` is required")
  }

  const purchases = await Promise.all(files.map(readPurchaseFromPdf))
  const purchaseDate = purchases[0]?.purchaseDate

  if (!purchaseDate) {
    throw new GenericException("Unable to extract purchase data from PDFs")
  }

  if (
    purchases.some(
      (purchase) => purchase.purchaseDate.getTime() !== purchaseDate.getTime()
    )
  ) {
    throw new GenericException("All PDF invoices must have the same issue date")
  }

  const items = purchases.flatMap((purchase) => purchase.items)

  return {
    items,
    purchaseDate,
    total: purchases.reduce((sum, purchase) => sum + purchase.total, 0),
    tax: purchases.reduce((sum, purchase) => sum + purchase.tax, 0),
    description: items.map((item) => item.name).join("; "),
  }
}
