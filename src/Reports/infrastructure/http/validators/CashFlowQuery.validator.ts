import type {
  NextFunction,
  ServerRequest,
  ServerResponse,
} from "bun-platform-kit"
import { HttpStatus } from "@/Shared/domain"
import { buildUtcDateTime, StringToDate } from "@/Shared/helpers/date.ts"
import type { CashFlowFilters, CashFlowGroupBy } from "@/Reports/domain"

const DAY_IN_MS = 24 * 60 * 60 * 1000

const sendValidationError = (
  res: ServerResponse,
  field: string,
  message: string,
  rule = "invalid"
) =>
  res.status(HttpStatus.UNPROCESSABLE_ENTITY).send({
    [field]: {
      message,
      rule,
    },
  })

const parseDateBoundary = (
  value: unknown,
  boundary: "start" | "end"
): Date | undefined => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined
  }

  const normalized = value.trim()

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return buildUtcDateTime(
      normalized,
      boundary === "start" ? "00:00:00" : "23:59:59"
    )
  }

  const parsed = StringToDate(normalized)

  if (!(parsed instanceof Date) || Number.isNaN(parsed.getTime())) {
    return undefined
  }

  return parsed
}

const parseBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === "boolean") {
    return value
  }

  if (typeof value !== "string") {
    return undefined
  }

  const normalized = value.trim().toLowerCase()

  if (["true", "1", "yes"].includes(normalized)) {
    return true
  }

  if (["false", "0", "no"].includes(normalized)) {
    return false
  }

  return undefined
}

const parsePositiveInteger = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === "") {
    return undefined
  }

  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return undefined
  }

  return parsed
}

const parseOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

const resolveGroupBy = (
  startDate: Date,
  endDate: Date,
  rawValue: unknown
): CashFlowGroupBy => {
  const requested = parseOptionalString(rawValue)

  if (requested === "day" || requested === "week" || requested === "month") {
    return requested
  }

  const diffDays =
    Math.floor((endDate.getTime() - startDate.getTime()) / DAY_IN_MS) + 1

  if (diffDays <= 45) {
    return "day"
  }

  if (diffDays <= 180) {
    return "week"
  }

  return "month"
}

const normalizeCommonQuery = (
  query: Record<string, unknown>
): CashFlowFilters | { field: string; message: string; rule?: string } => {
  const startDate = parseDateBoundary(query.startDate, "start")
  if (!startDate) {
    return {
      field: "startDate",
      message: "startDate es obligatorio y debe ser una fecha válida.",
      rule: "required_date",
    }
  }

  const endDate = parseDateBoundary(query.endDate, "end")
  if (!endDate) {
    return {
      field: "endDate",
      message: "endDate es obligatorio y debe ser una fecha válida.",
      rule: "required_date",
    }
  }

  if (startDate.getTime() > endDate.getTime()) {
    return {
      field: "dateRange",
      message: "startDate no puede ser mayor que endDate.",
      rule: "range_order",
    }
  }

  if (
    query.groupBy !== undefined &&
    !["day", "week", "month"].includes(String(query.groupBy))
  ) {
    return {
      field: "groupBy",
      message: "groupBy debe ser day, week o month.",
      rule: "in",
    }
  }

  const includeProjection =
    query.includeProjection === undefined
      ? false
      : parseBoolean(query.includeProjection)

  if (
    query.includeProjection !== undefined &&
    includeProjection === undefined
  ) {
    return {
      field: "includeProjection",
      message: "includeProjection debe ser booleano.",
      rule: "boolean",
    }
  }

  const projectionBuckets = parsePositiveInteger(query.projectionBuckets)
  if (
    query.projectionBuckets !== undefined &&
    projectionBuckets === undefined
  ) {
    return {
      field: "projectionBuckets",
      message: "projectionBuckets debe ser un entero mayor a 0.",
      rule: "integer",
    }
  }

  const availabilityAccountId = Array.isArray(query.availabilityAccountId)
    ? query.availabilityAccountId.map(String)
    : parseOptionalString(query.availabilityAccountId)

  return {
    churchId: parseOptionalString(query.churchId) ?? "",
    startDate,
    endDate,
    groupBy: resolveGroupBy(startDate, endDate, query.groupBy),
    availabilityAccountId,
    costCenterId: parseOptionalString(query.costCenterId),
    includeProjection,
    projectionBuckets,
  }
}

export const CashFlowQueryValidator = async (
  req: ServerRequest,
  res: ServerResponse,
  next: NextFunction
) => {
  const normalized = normalizeCommonQuery(
    (req.query ?? {}) as Record<string, unknown>
  )

  if ("field" in normalized) {
    return sendValidationError(
      res,
      normalized.field,
      normalized.message,
      normalized.rule
    )
  }

  req.query = normalized as unknown as typeof req.query
  next()
}

export const CashFlowBucketDetailsValidator = async (
  req: ServerRequest,
  res: ServerResponse,
  next: NextFunction
) => {
  const normalized = normalizeCommonQuery(
    (req.query ?? {}) as Record<string, unknown>
  )

  if ("field" in normalized) {
    return sendValidationError(
      res,
      normalized.field,
      normalized.message,
      normalized.rule
    )
  }

  req.query = normalized as unknown as typeof req.query

  next()
}

export const CashFlowExportQueryValidator = async (
  req: ServerRequest,
  res: ServerResponse,
  next: NextFunction
) => {
  const normalized = normalizeCommonQuery(
    (req.query ?? {}) as Record<string, unknown>
  )

  if ("field" in normalized) {
    return sendValidationError(
      res,
      normalized.field,
      normalized.message,
      normalized.rule
    )
  }

  const format = parseOptionalString(req.query?.format)

  if (format !== "csv" && format !== "pdf") {
    return sendValidationError(
      res,
      "format",
      "format debe ser csv o pdf.",
      "in"
    )
  }

  req.query = {
    ...(normalized as CashFlowFilters),
    format,
  } as unknown as typeof req.query

  next()
}
