import { Response } from "express"
import { Logger } from "@/Shared/adapter"
import { CacheService } from "@/Shared/infrastructure/services/Cache.service"

export function Cache(prefix: string, ttlSeconds: number = 300) {
  const logger = Logger(Cache.name)
  const cacheService = CacheService.getInstance()

  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      // Obtenemos los parámetros para la clave de caché (todos menos el Response)
      const cacheParams = args
        .filter((arg) =>
          arg !== null &&
          typeof arg === "object" &&
          "status" in arg &&
          "send" in arg
            ? false
            : true
        )
        .map((param) =>
          typeof param === "object" ? JSON.stringify(param) : String(param)
        )
        .join(":")

      // Construimos la clave con prefijo, método y parámetros
      const cacheKey = `${prefix}:${propertyKey}${cacheParams ? ":" + cacheParams : ""}`

      // Buscamos el objeto Response por sus propiedades características
      const res = args.find(
        (arg) =>
          arg !== null &&
          typeof arg === "object" &&
          "status" in arg &&
          "send" in arg
      ) as Response<any, Record<string, any>>

      if (!res) {
        logger.error(`No response object found for ${cacheKey}`)
        return originalMethod.apply(this, args)
      }

      // Intentamos obtener de la caché
      const cachedResult = cacheService.get(cacheKey)

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
        cacheService.set(cacheKey, body, ttlSeconds)
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
