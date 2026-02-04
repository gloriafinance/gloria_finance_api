# Gloria Finance API

**Gloria Finance API** es el backend de **Gloria Finance**, una plataforma moderna para la **gestión administrativa y financiera de iglesias**.  
Está diseñada para operar en un entorno **multi-tenant**, con foco en **seguridad**, **trazabilidad** y **automatización** de procesos.

Con esta API puedes:

- Gestionar **miembros** y sus datos clave
- Registrar **contribuciones** (diezmos, ofrendas, votos, campañas, etc.)
- Mantener un catálogo de **conceptos financieros** (categorías contables y administrativas)
- Automatizar **notificaciones** (por ejemplo Telegram) y procesos asíncronos (colas)
- Integrarte con servicios externos (almacenamiento de archivos, mensajería, etc.)

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
GOOGLE_APPLICATION_CREDENTIALS=

# Redis / BullMQ
REDIS_HOST=
REDIS_PORT=
BULL_USER=
BULL_PASS=

# Email (si aplica)
SEND_MAIL_CLIENT_ID=
SEND_MAIL_PRIVATE_KEY=
```

## 2) Levantar servicios (si aplica)

Si usas Docker para Redis/Mongo local, levántalo con:

```bash
docker compose up -d
```

## 3) Instalar dependencias y correr la API

```bash
bun install
bun dev
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
