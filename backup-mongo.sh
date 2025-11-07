#!/bin/bash
set -e

# ================================
# 📦 BACKUP COMPLETO DE MONGODB
# Incluye: datos + índices (todos, incluso parciales)
# ================================

# Cargar variables desde .env
if [ -f .env ]; then
  set -a  # activa export automático
  source .env
  set +a
else
  echo "❌ Error: Archivo .env no encontrado"
  exit 1
fi

# Validar variables obligatorias
if [ -z "$MONGO_USER" ] || [ -z "$MONGO_PASS" ] || [ -z "$MONGO_DB" ] || [ -z "$MONGO_SERVER" ]; then
  echo "❌ Error: Variables de MongoDB no configuradas en .env"
  echo "Requeridas: MONGO_USER, MONGO_PASS, MONGO_DB, MONGO_SERVER"
  exit 1
fi

# Directorio de backup con timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups/${TIMESTAMP}"
INDEX_DIR="${BACKUP_DIR}/indexes"

mkdir -p "$INDEX_DIR"

# URI de conexión
MONGO_URI="mongodb+srv://${MONGO_USER}:${MONGO_PASS}@${MONGO_SERVER}/${MONGO_DB}?retryWrites=true&w=majority"

echo "🧩 Iniciando backup para la base de datos: $MONGO_DB"
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
