import { Request, Response } from "express"
import { Logger } from "@/Shared/adapter"
import { CacheService } from "@/Shared/infrastructure/services/Cache.service"

export function Cache(prefix: string, ttlSeconds: number = 300) {
  const logger = Logger(Cache.name)
  const cacheService = CacheService.getInstance()
  const isResponse = (arg: any): arg is Response =>
    arg !== null && typeof arg === "object" && "status" in arg && "send" in arg
  const isRequest = (arg: any): arg is Request =>
    arg !== null &&
    typeof arg === "object" &&
    "method" in arg &&
    "url" in arg &&
    "headers" in arg
  const safeStringify = (value: unknown) => {
    const seen = new WeakSet()
    try {
      return JSON.stringify(value, (_key, val) => {
        if (typeof val === "object" && val !== null) {
          if (seen.has(val)) return "[Circular]"
          seen.add(val)
        }
        return val
      })
    } catch {
      return String(value)
    }
  }

  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      // Obtenemos los parámetros para la clave de caché (todos menos el Response)
      const cacheParams = args
        .filter(
          (arg) =>
            !isResponse(arg) && !isRequest(arg) && typeof arg !== "function"
        )
        .map((param) =>
          typeof param === "object" ? safeStringify(param) : String(param)
        )
        .join(":")

      // Construimos la clave con prefijo, método y parámetros
      const cacheKey = `${prefix}:${propertyKey}${cacheParams ? ":" + cacheParams : ""}`

      // Buscamos el objeto Response por sus propiedades características
      const res = args.find((arg) => isResponse(arg)) as Response<
        any,
        Record<string, any>
      >

      if (!res) {
        logger.error(`No response object found for ${cacheKey}`)
        return originalMethod.apply(this, args)
      }

      // Intentamos obtener de la caché
      const cachedResult = await cacheService.get(cacheKey)

      if (cachedResult) {
        logger.info(`Cache hit for ${cacheKey}`)
        res.status(200).send(cachedResult)
        return
      }

      logger.info(`Cache miss for ${cacheKey}`)

      // Interceptamos la función send del objeto response
      const originalSend = res.send
      res.send = function (body) {
        // Guardamos en caché antes de enviar
        cacheService
          .set(cacheKey, body, ttlSeconds)
          .catch((error) =>
            logger.error(`Cache set failed for ${cacheKey}`, error)
          )
        // Restauramos el método original y lo llamamos
        res.send = originalSend
        return res.send(body)
      }

      // Ejecutamos el método original
      return originalMethod.apply(this, args)
    }

    return descriptor
  }
}
