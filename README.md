# Que es Church Finance

Church Finance API es una solución moderna y flexible para la gestión financiera de iglesias. Permite administrar
miembros, donaciones, conceptos financieros y notificaciones de manera eficiente y segura.

¡Optimiza la administración de tu iglesia con tecnología de vanguardia!

# Stack

- [`node v22`](https://nodejs.org/)
- [`express`](https://expressjs.com/)
- [`typescript`](https://www.typescriptlang.org/)
- [`docker`](https://www.docker.com/) [`docker-compose`](https://docs.docker.com/compose/)
- [`redis`](https://redis.io/)
- [`bull`](https://github.com/OptimalBits/bull)

# Ejecutar el proyecto en local

Debe tener instalado docker y nodejs en la version 22

- Crear .env en la raiz del proyecto

```
NODE_ENV=local
APP_PORT=5200

MONGO_PASS=
MONGO_USER=
MONGO_DB=
MONGO_SERVER=

JWT_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=30d

TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

BUCKET_FILES=

REDIS_HOST=
REDIS_PORT=

BULL_USER=
BULL_PASS=
```

- ejecutar el proyecto

```
npm i
npm run dev
```

## Conventional Commits

We use Conventional Commits to automatically generate releases:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `style:` - Format, spaces, etc.
- `refactor:` - Code refactoring
- `test:` - Add tests
- `chore:` - Maintenance tasks
