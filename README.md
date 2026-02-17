# Gloria Finance API

**Gloria Finance** es una plataforma de **gestión financiera y administrativa para iglesias**, creada para traer **orden, transparencia y control** a todo lo que sucede en la operación diaria: miembros, contribuciones, compras, patrimonio y programación ministerial.

La **Gloria Finance API** es el backend que impulsa esa experiencia: centraliza los datos, automatiza procesos y permite generar reportes claros para la toma de decisiones.

## ¿Qué puedes hacer con Gloria Finance?

### ✅ Gestión de Miembros (Member Experience)
- Registro y administración de **miembros** y responsables
- Organización por **roles / permisos** (liderazgo, tesorería, administración)
- Historial de participación y relación con contribuciones y compromisos

### 💰 Registros Financieros con trazabilidad
- Registro de **ingresos**: diezmos, ofrendas, votos, campañas, eventos
- Registro de **egresos**: gastos operativos, mantenimiento, ministerios, servicios
- Catálogo de **conceptos financieros** (categorías contables + administrativas)
- Control por **cuentas** (caja/bancos) y **centros de costo / ministerios**
- Adjuntos y evidencias (comprobantes) para mayor transparencia

### 🛒 Módulo de Compras (de punta a punta)
- **Solicitudes** de compra y flujo de aprobación
- Gestión de **proveedores**
- Registro de **órdenes** y **facturas/comprobantes**
- Vinculación automática con el egreso y el centro de costo correspondiente

### 🏛️ Administración de Patrimonio (Activos)
- Inventario de bienes: equipos, instrumentos, mobiliario, tecnología
- Control por **ubicación**, responsable, estado y movimientos (alta/baja/traslado)
- Historial de mantenimiento y gastos asociados
- Reportes del patrimonio para control y auditoría

### 📅 Programación Ministerial y operación
- Agenda de **servicios, cultos y eventos**
- Organización de **equipos** por ministerio (música, multimedia, ujieres, niños, etc.)
- Asignación de responsables y planificación por turnos
- Recordatorios y notificaciones (cuando aplica)

---

## Reportes que ayudan a tomar decisiones

- **DRE (Demostrativo de Resultados)** por período
- **Entradas vs Salidas** (mensual y acumulado)
- **Ingresos y Gastos por Categoría** (ranking y tendencias)
- **Por Centro de Costo / Ministerio** (dónde se invierte y con qué impacto)
- **Flujo de Caja** por cuentas (caja/bancos)
- **Contribuciones por Miembro** (historial y resumen)
- **Compras** por proveedor, estado y período
- **Patrimonio** (inventario y movimientos del período)

---

## ¿Por qué Gloria Finance?

- **Transparencia con propósito:** claridad para la iglesia y sus líderes
- **Orden y control:** procesos consistentes para entradas, salidas y compras
- **Trazabilidad real:** cada movimiento con contexto, evidencia y responsable
- **Crecimiento sostenible:** estructura lista para escalar con la iglesia

---

## Principios del proyecto

- **Seguridad primero:** secretos por variables de entorno (nunca hardcodeados).
- **Escalable:** jobs asíncronos con colas (**BullMQ + Redis**).
- **Mantenible:** TypeScript + estructura modular.
- **Listo para producción:** Docker, servicios externos y configuración por entorno.

---

## Stack

- **Runtime:** [Bun](https://bun.com/)
- **Toolkit:** [bun-platform-kit](https://github.com/abejarano/bun-platform-kit)
- **Lenguaje:** [TypeScript](https://www.typescriptlang.org/)
- **Infra local:** [Docker](https://www.docker.com/) + [Docker Compose](https://docs.docker.com/compose/)
- **Cache/colas:** [Redis](https://redis.io/) + [BullMQ](https://bullmq.io/)
- **Archivos:** [GCP Storage](https://cloud.google.com/storage)

---

## Requisitos

- **Docker** y **Docker Compose**
- **Bun** instalado (recomendado)
- *(Opcional)* Node.js 22 si tu flujo local lo requiere, pero el runtime principal es **Bun**

---

## Ejecutar en local

### 1) Variables de entorno

Crea un archivo `.env` en la raíz del proyecto (**no lo subas al repo**).

Ejemplo mínimo:

```env
NODE_ENV=local
APP_PORT=5200

# Base de datos
MONGO_URI=

# JWT
JWT_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=30d

# Notificaciones (Telegram)
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# Archivos (GCP)
BUCKET_FILES=
GOOGLE_APPLICATION_CREDENTIALS=/ruta/credenciales.json

# Redis / BullMQ
REDIS_HOST=
REDIS_PORT=
BULL_USER=
BULL_PASS=

# Email (si aplica)
SEND_MAIL_SERVICE_CLIENT_EMAIL=
SEND_MAIL_USER=
SEND_MAIL_PRIVATE_KEY=

# Logs (producción)
# options: stdout | axiom | gcp
LOGGER_TRANSPORT=stdout
GCP_LOG_NAME=gloria_finance_api
# opcional: si se omite, el SDK lo autodetecta
GCP_PROJECT_ID=
```

### 2) Instalar dependencias y correr la API

```bash
bun install
bun dev
```

### 3) Levantar servicios (si aplica)

Si usas Docker para Redis/Mongo local, levántalo con:

```bash
docker compose up -d
```



La API debería quedar disponible en:

- `http://localhost:5200` (o el puerto que definas en `APP_PORT`)

---

## Convenciones de commits (Conventional Commits)

Usamos **Conventional Commits** para mantener un historial consistente y facilitar automatizaciones (releases, changelog, etc.).

- `feat:` Nueva funcionalidad
- `fix:` Corrección de bug
- `docs:` Documentación
- `style:` Formato (espacios, lint, etc.)
- `refactor:` Refactor sin cambiar comportamiento
- `test:` Pruebas
- `chore:` Tareas de mantenimiento (deps, scripts, tooling)

**Ejemplos:**

- `feat: agregar endpoint para registrar contribuciones`
- `fix: corregir validación de monto en contribución`
- `chore: actualizar dependencias`

---

## 👨‍💻 Author

**Ángel Bejarano**  
📧 [angel.bejarano@jaspesoft.com](mailto:angel.bejarano@jaspesoft.com)  
🐙 [GitHub](https://github.com/abejarano)  
🏢 [Whatsapp](+5511965990791)

---

## Licencia

El código de este proyecto se publica bajo la licencia **GNU AGPLv3**.

- Puedes **usar, estudiar, modificar y redistribuir** el software.
- Si ejecutas una versión modificada **como servicio** (por ejemplo, un SaaS) o la **distribuyes**, debes **poner a disposición el código fuente** de tus cambios bajo la misma licencia.

Consulta el archivo [LICENSE](LICENSE) para más detalles.
