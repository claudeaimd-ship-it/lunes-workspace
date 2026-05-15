# 🏗️ Arquitectura Hexagonal — Proyectos Lunes

> Cada proyecto vive en `workspace/<proyecto>/` y sigue esta misma estructura.
> Nada del core se toca. Solo se agrega en el lugar correcto.

```
workspace/
├── _core/                      ← Núcleo compartido entre proyectos
│   ├── domain/                 ← Lógica de negocio pura (sin dependencias externas)
│   │   ├── entities/           ← Entidades del dominio
│   │   ├── value-objects/      ← Objetos de valor
│   │   └── ports/              ← Interfaces (puertos) que definen qué necesita el negocio
│   ├── application/            ← Casos de uso (orquestan el dominio)
│   │   └── use-cases/          ← Cada caso de uso es un archivo/función
│   ├── infrastructure/         ← Implementaciones concretas de los puertos
│   │   ├── database/           ← Drivers de BD (SQLite, InfluxDB, etc.)
│   │   ├── messaging/          ← MQTT, WebSocket, colas
│   │   ├── http/               ← Clientes HTTP, APIs externas
│   │   └── filesystem/         ← Lectura/escritura de archivos
│   └── adapters/               ← Adaptadores de entrada (cómo se conecta el mundo exterior)
│       ├── cli/                ← Comandos por terminal
│       ├── events/             ← Eventos internos (OpenClaw hooks)
│       └── web/                ← Endpoints HTTP/Socket.io
│
├── <proyecto>/                 ← Cada proyecto sigue esta misma estructura
│   ├── domain/
│   ├── application/
│   ├── infrastructure/
│   └── adapters/
│
└── README.md                   ← Este archivo general
```

## Principios

### 1. Las dependencias apuntan hacia adentro
```
adapters → application → domain
infrastructure → domain
```
El **domain** NO sabe nada del mundo exterior. No imports de Express, Socket.io, BD, nada.

### 2. Puertos y Adaptadores
- **Puerto** (interface): define el contrato. Vive en `domain/ports/`.
- **Adaptador**: implementa ese contrato. Vive en `infrastructure/`.

Ejemplo:
```js
// _core/domain/ports/session-repository.js
// Puerto: define cómo recuperar sesiones
export class SessionRepository {
  async getAll() { throw new Error('Not implemented') }
  async getByAgent(agentId) { throw new Error('Not implemented') }
}

// _core/infrastructure/database/session-repository-impl.js
// Adaptador: implementa con el sessions.json real
export class SessionJsonRepository extends SessionRepository {
  async getAll() { ... }
  async getByAgent(agentId) { ... }
}
```

### 3. Casos de uso en application/
Los casos de uso orquestan: toman datos de entrada, llaman al dominio y a los puertos, devuelven resultado. No saben si la BD es SQLite o MongoDB.

### 4. El adaptador es lo ÚNICO que cambia al migrar
¿Cambias de SQLite a PostgreSQL? Solo tocas `infrastructure/database/`. El domain y application quedan intactos.

---

## Reglas para Lunes 🦎

1. **No modifiques archivos existentes a menos que sea estrictamente necesario** → agrega archivos nuevos en la carpeta correcta.
2. Si un proyecto necesita lógica que ya existe en `_core/`, impórtala desde ahí. No copies.
3. Los puertos (interfaces) van PRIMERO. Define el contrato antes de implementar.
4. Los adapters nuevos se registran en un punto de entrada (index.js / config) sin tocar el domain.

---

## Proyectos actuales

| Proyecto | Status | Descripción |
|----------|--------|-------------|
| `neural-dashboard/` | ✅ Funcionando | Dashboard tipo neurona |
| (próximo) | | |

---

*Esta arquitectura crece con los proyectos. Si algo no encaja, se ajusta el `_core/`, no se fuerza en el proyecto.*
