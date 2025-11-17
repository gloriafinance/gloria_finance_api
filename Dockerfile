# Etapa de construcción (builder)
FROM node:22-alpine3.19 AS builder

# Directorio de trabajo dentro de la imagen
WORKDIR /app

# Copia solo los archivos necesarios para instalar dependencias
COPY package.json package-lock.json ./

# Instala las dependencias de producción
RUN npm ci --only=production

# Copia el resto de los archivos necesarios para la construcción
COPY dist ./dist

# Etapa final (imagen ligera para producción)
FROM node:22-alpine3.19

# Directorio de trabajo dentro de la imagen
WORKDIR /app

# Copia las dependencias de producción desde la etapa de construcción
COPY --from=builder /app/node_modules ./node_modules

# Copia solo los archivos necesarios para la ejecución
COPY --from=builder /app/dist ./dist

# Expone el puerto en el que se ejecutará la aplicación (ajusta según tu aplicación)
EXPOSE 8080

# Comando para ejecutar la aplicación
CMD ["node", "dist/app.js"]
