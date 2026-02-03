#!/bin/bash

# restore-mongo.sh
# Restaura datos y vuelve a crear índices exportados por el script de backup.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env"

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a
else
  echo "❌ Error: Archivo .env no encontrado en ${ENV_FILE}"
  exit 1
fi

MONGO_URI="${MONGO_URI:-$(grep -E '^MONGO_URI=' "$ENV_FILE" | tail -n1 | cut -d'=' -f2-)}"
MONGO_DB="${MONGO_DB:-$(grep -E '^MONGO_DB=' "$ENV_FILE" | tail -n1 | cut -d'=' -f2-)}"

# Verificar que tengamos URI/DB
if [ -z "$MONGO_URI" ] || [ -z "$MONGO_DB" ]; then
  echo "❌ Error: MONGO_URI o MONGO_DB no están definidos en ${ENV_FILE}"
  exit 1
fi

# Verificar que se pasó el argumento
if [ -z "$1" ]; then
  echo "Error: Debes proporcionar el nombre del directorio de backup"
  echo "Uso: ./restore-mongo.sh <nombre-directorio-backup> [local|remote]"
  echo "Ejemplo: ./restore-mongo.sh 20241106_181932 remote"
  exit 1
fi

BACKUP_NAME="$1"
RESTORE_MODE="${2:-remote}"  # Por defecto usa remote
BACKUP_DIR="./backups/${BACKUP_NAME}"
INDEX_DIR="$BACKUP_DIR/indexes"

if [ ! -d "$BACKUP_DIR" ]; then
  echo "Error: El directorio $BACKUP_DIR no existe"
  exit 1
fi

# Función para restaurar índices
restore_indexes() {
  local uri="$1"
  local db="$2"

  if [ ! -d "$INDEX_DIR" ]; then
    echo "No hay índices para restaurar en: $INDEX_DIR"
    return
  fi

  # Elegir cliente (mongosh preferido)
  if command -v mongosh >/dev/null 2>&1; then
    SHELL_CMD=mongosh
  elif command -v mongo >/dev/null 2>&1; then
    SHELL_CMD=mongo
  else
    echo "Advertencia: ni 'mongosh' ni 'mongo' están disponibles; no se restaurarán índices"
    return
  fi

  echo "Restaurando índices..."
  for index_file in "$INDEX_DIR"/indexes_*.json; do
    [ -e "$index_file" ] || continue

    coll=$(basename "$index_file" | sed 's/^indexes_//; s/\.json$//')
    echo "  - Restaurando índices de colección: $coll"

    # Crear script temporal para restaurar índices
    tmpjs=$(mktemp /tmp/restore_indexes_XXXX.js)
    cat > "$tmpjs" <<'EOF'
const indexes = JSON.parse(cat());
indexes.forEach(idx => {
  try {
    if (idx.name === "_id_") return;

    // Extraer la clave del índice
    const key = idx.key;

    // Copiar todas las opciones excepto las que no deben pasarse a createIndex
    const options = Object.assign({}, idx);
    delete options.key;  // No se pasa como opción
    delete options.v;    // Versión del índice (se asigna automáticamente)
    delete options.ns;   // Namespace (se determina por la colección)

    db.getCollection("COLLECTION_NAME").createIndex(key, options);
    print("Índice creado: " + (idx.name || JSON.stringify(key)));
  } catch (e) {
    print("Error creando índice: " + e);
  }
});
EOF
    sed -i.bak "s/COLLECTION_NAME/$coll/g" "$tmpjs"

    cat "$index_file" | $SHELL_CMD "$uri" "$db" --quiet "$tmpjs" 2>/dev/null || true
    rm -f "$tmpjs" "$tmpjs.bak"
  done

  echo "Índices restaurados"
}

if [ "$RESTORE_MODE" == "remote" ]; then
  if [ -z "$MONGO_DB" ] || [ -z "$MONGO_URI" ]; then
    echo "Error: MONGO_DB y MONGO_URI deben estar definidos en ${ENV_FILE}"
    exit 1
  fi

  DATA_DIR="$BACKUP_DIR/$MONGO_DB"

  if [ ! -d "$DATA_DIR" ]; then
    echo "Error: El directorio de datos $DATA_DIR no existe"
    exit 1
  fi

  echo "Iniciando restauración remota a: ${MONGO_URI}"
  echo "Base de datos: ${MONGO_DB}"

  # Restaurar datos
  mongorestore --uri="$MONGO_URI" --nsInclude="${MONGO_DB}.*" "$DATA_DIR"

  if [ $? -eq 0 ]; then
    echo "Datos restaurados exitosamente"

    # Restaurar índices
    restore_indexes "$MONGO_URI" "$MONGO_DB"
  else
    echo "Error: mongorestore falló"
    exit 1
  fi

else
  # Restauración local en contenedor Docker
  CONTAINER_NAME=$(docker ps --format '{{.Names}}' --filter ancestor=mongo | head -n1)

  if [ -z "$CONTAINER_NAME" ]; then
    echo "Error: No se encontró un contenedor de MongoDB corriendo"
    exit 1
  fi

  echo "Contenedor detectado: $CONTAINER_NAME"
  LOCAL_DB="church_db"
  DATA_DIR="$BACKUP_DIR/$LOCAL_DB"

  if [ ! -d "$DATA_DIR" ]; then
    echo "Error: El directorio de datos $DATA_DIR no existe"
    exit 1
  fi

  echo "Iniciando restauración local desde: $DATA_DIR"

  # Copiar backup al contenedor
  docker cp "$DATA_DIR" "$CONTAINER_NAME":/tmp/backup

  # Restaurar datos
  docker exec "$CONTAINER_NAME" mongorestore --db="$LOCAL_DB" /tmp/backup

  if [ $? -eq 0 ]; then
    echo "Datos restaurados exitosamente"

    # Restaurar índices dentro del contenedor
    if [ -d "$INDEX_DIR" ]; then
      echo "Restaurando índices en contenedor..."
      for index_file in "$INDEX_DIR"/indexes_*.json; do
        [ -e "$index_file" ] || continue

        coll=$(basename "$index_file" | sed 's/^indexes_//; s/\.json$//')
        echo "  - Restaurando índices de colección: $coll"

        # Copiar archivo de índices al contenedor
        docker cp "$index_file" "$CONTAINER_NAME":/tmp/indexes.json

        # Ejecutar script de restauración dentro del contenedor
        docker exec "$CONTAINER_NAME" bash -c "mongosh $LOCAL_DB --quiet --eval \"
const indexes = JSON.parse(cat('/tmp/indexes.json'));
indexes.forEach(idx => {
  try {
    if (idx.name === '_id_') return;

    // Extraer la clave del índice
    const key = idx.key;

    // Copiar todas las opciones excepto las que no deben pasarse a createIndex
    const options = Object.assign({}, idx);
    delete options.key;  // No se pasa como opción
    delete options.v;    // Versión del índice (se asigna automáticamente)
    delete options.ns;   // Namespace (se determina por la colección)

    db.getCollection('$coll').createIndex(key, options);
    print('Índice creado: ' + (idx.name || JSON.stringify(key)));
  } catch (e) {
    print('Error: ' + e);
  }
});
\" 2>/dev/null" || echo "    (algunos índices pueden haber fallado)"
      done
      echo "Índices restaurados"
    fi
  else
    echo "Error: mongorestore falló"
    docker exec "$CONTAINER_NAME" rm -rf /tmp/backup
    exit 1
  fi

  # Limpiar archivos temporales del contenedor
  docker exec "$CONTAINER_NAME" rm -rf /tmp/backup /tmp/indexes.json
fi

echo "Restauración completada exitosamente"
