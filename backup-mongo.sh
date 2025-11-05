#!/bin/bash

# Cargar variables desde .env
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | grep -v '^$' | xargs)
else
  echo "Error: Archivo .env no encontrado"
  exit 1
fi

# Verificar que las variables existan
if [ -z "$MONGO_USER" ] || [ -z "$MONGO_PASS" ] || [ -z "$MONGO_DB" ] || [ -z "$MONGO_SERVER" ]; then
  echo "Error: Variables de MongoDB no configuradas en .env"
  echo "Requeridas: MONGO_USER, MONGO_PASS, MONGO_DB, MONGO_SERVER"
  exit 1
fi

# Directorio de backup con timestamp
BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"

# Crear directorio si no existe
mkdir -p "$BACKUP_DIR"

# URI de conexión
MONGO_URI="mongodb+srv://${MONGO_USER}:${MONGO_PASS}@${MONGO_SERVER}/${MONGO_DB}?retryWrites=true&w=majority"

# Ejecutar backup
mongodump --uri="$MONGO_URI" --out="$BACKUP_DIR"

echo "Backup completado en: $BACKUP_DIR"
