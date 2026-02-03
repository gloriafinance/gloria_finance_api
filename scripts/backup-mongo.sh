#!/bin/bash
set -e

# ================================
# 📦 BACKUP COMPLETO DE MONGODB
# Incluye: datos + índices (todos, incluso parciales)
# ================================

# Cargar variables desde .env (sin depender del cwd actual)
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

if [ -z "$MONGO_URI" ] || [ -z "$MONGO_DB" ]; then
  echo "❌ Error: MONGO_URI o MONGO_DB no están definidos en ${ENV_FILE}"
  exit 1
fi

echo "Usando URI: $MONGO_URI"


# Directorio de backup con timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups/${TIMESTAMP}"
INDEX_DIR="${BACKUP_DIR}/indexes"

mkdir -p "$INDEX_DIR"


echo "🧩 Iniciando backup para la base de datos: $MONGO_DB FILE ENV: $ENV_FILE"
echo "📁 Directorio destino: $BACKUP_DIR"
echo "---------------------------------------------"

# ================================
# 1️⃣ Backup de datos
# ================================
mongodump --uri="$MONGO_URI" --out="$BACKUP_DIR" --forceTableScan
if [ $? -ne 0 ]; then
  echo "❌ Error: mongodump falló"
  exit 1
fi
echo "✅ Backup de datos completado"

# ================================
# 2️⃣ Exportación de índices
# ================================

# Verificar cliente disponible
if command -v mongosh >/dev/null 2>&1; then
  SHELL_CMD=mongosh
elif command -v mongo >/dev/null 2>&1; then
  SHELL_CMD=mongo
else
  echo "❌ Error: ni 'mongosh' ni 'mongo' están disponibles en PATH"
  exit 1
fi

echo "🔍 Obteniendo lista de colecciones..."
COLLECTIONS=$($SHELL_CMD "$MONGO_URI" --quiet --eval "use('$MONGO_DB'); db.getCollectionNames().join('\n')" 2>/dev/null)

if [ -z "$COLLECTIONS" ]; then
  echo "⚠️ No se obtuvieron colecciones o hubo un error al listarlas"
else
  echo "---------------------------------------------"
  echo "📚 Colecciones detectadas:"
  echo "$COLLECTIONS"
  echo "---------------------------------------------"

IFS=$'\n'
for coll in $COLLECTIONS; do
  safe_name=$(echo "$coll" | sed 's/[^A-Za-z0-9._-]/_/g')
  echo "💾 Exportando índices de: $coll"

  TMP_JS=$(mktemp)
  cat > "$TMP_JS" <<EOF
const { EJSON } = require('bson');
const conn = new Mongo("${MONGO_URI}");
const db = conn.getDB("${MONGO_DB}");
const result = db.runCommand({ listIndexes: "${coll}" });
if (result.ok === 1 && result.cursor && result.cursor.firstBatch) {
  print(EJSON.stringify(result.cursor.firstBatch, { relaxed: false, indent: 2 }));
} else {
  print('[]');
}
EOF

  $SHELL_CMD --quiet --file "$TMP_JS" > "${INDEX_DIR}/indexes_${safe_name}.json" 2>/dev/null
  rm -f "$TMP_JS"

  if [ $? -eq 0 ]; then
    echo "✅ Índices exportados correctamente → indexes_${safe_name}.json"
  else
    echo "⚠️ Error al exportar índices de ${coll}"
  fi
done
unset IFS

fi

# ================================
# 3️⃣ Resultado final
# ================================
echo "---------------------------------------------"
echo "🎉 Backup completado con éxito"
echo "📦 Datos guardados en:   $BACKUP_DIR"
echo "🧠 Índices guardados en: $INDEX_DIR"
echo "---------------------------------------------"
