#!/bin/bash

# Verificar que se pasó el argumento
if [ -z "$1" ]; then
  echo "Error: Debes proporcionar el nombre del directorio de backup"
  echo "Uso: ./restore-mongo.sh <nombre-directorio-backup> [local|remote]"
  echo "Ejemplo: ./restore-mongo.sh 20241220_143022 remote"
  exit 1
fi

BACKUP_NAME="$1"
RESTORE_MODE="${2:-local}"  # Por defecto usa local
BACKUP_DIR="./backups/${BACKUP_NAME}/church_db"

if [ ! -d "$BACKUP_DIR" ]; then
  echo "Error: El directorio $BACKUP_DIR no existe"
  exit 1
fi

if [ "$RESTORE_MODE" == "remote" ]; then
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
    exit 1
  fi

  # URI de conexión remota
  MONGO_URI="mongodb+srv://${MONGO_USER}:${MONGO_PASS}@${MONGO_SERVER}/${MONGO_DB}?retryWrites=true&w=majority"

  echo "Iniciando restauración remota a: ${MONGO_SERVER}"
  mongorestore --uri="$MONGO_URI" --nsInclude="${MONGO_DB}.*" "$BACKUP_DIR"

else
  # Restauración local en contenedor Docker
  CONTAINER_NAME=$(docker ps --format '{{.Names}}' --filter ancestor=mongo)

  if [ -z "$CONTAINER_NAME" ]; then
    echo "Error: No se encontró un contenedor de MongoDB corriendo"
    exit 1
  fi

  echo "Contenedor detectado: $CONTAINER_NAME"
  LOCAL_DB="church_db"

  echo "Iniciando restauración local desde: $BACKUP_DIR"
  docker cp "$BACKUP_DIR" $CONTAINER_NAME:/tmp/backup
  docker exec $CONTAINER_NAME mongorestore --db=$LOCAL_DB /tmp/backup
  docker exec $CONTAINER_NAME rm -rf /tmp/backup
fi

echo "Restauración completada exitosamente"