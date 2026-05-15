# 🏗️ Ecosistema OpenClaw — Integración de Agentes

**Versión:** 1.0  
**Fecha:** 2026-05-02  
**Propósito:** Documento técnico para que Claude.ai entienda cómo integrar un bot en el ecosistema OpenClaw de Polo.

---

## 1. ¿Qué es OpenClaw?

OpenClaw es un **gateway de agentes de IA** que corre en una Raspberry Pi. Administra canales de comunicación (Telegram, Discord, WhatsApp, etc.), sesiones de agentes, y herramientas. Un solo proceso Gateway puede ejecutar **múltiples agentes aislados** simultáneamente.

**Ubicación física en la Raspberry:**
- Ejecutable: `/home/mdzac/.npm-global/lib/node_modules/openclaw/`
- Estado/config: `/home/mdzac/.openclaw/`
- Workspace: `/home/mdzac/.openclaw/workspace/`

---

## 2. Estructura de un Agente

```
~/.openclaw/agents/<agentId>/
├── agent/                    ← Config del agente (auth, modelos)
│   └── auth-profiles.json    ← Credenciales (API keys)
└── sessions/                 ← Historial de conversaciones
    ├── sessions.json         ← Índice maestro de sesiones (lo usa el dashboard)
    └── <sessionId>.jsonl     ← Transcripts individuales
```

**Propiedades de cada agente:**

| Propiedad | Descripción | Ejemplo |
|---|---|---|
| `agentId` | Identificador único | `main`, `analytics-bot` |
| `workspace` | Directorio de trabajo | `~/.openclaw/workspace` |
| `model` | Modelo de IA que usa | `deepseek/deepseek-chat` |
| `channel` | Cómo se comunica con humanos | `telegram`, `discord` |

### Agente actual (Lunes 🦎)

```
agentId: main
workspace: /home/mdzac/.openclaw/workspace/
model: deepseek/deepseek-chat
channel: Telegram (bot: @LunesBot)
```

---

## 3. Formato de Sesiones (`sessions.json`)

El archivo `~/.openclaw/agents/main/sessions/sessions.json` tiene este formato:

```json
{
  "agent:main:main": {
    "sessionId": "56690eec-...",
    "totalTokens": 22224,
    "status": "done",
    "updatedAt": 1777650425000
  },
  "agent:main:telegram:direct:1072294086": {
    "sessionId": "bb981f78-...",
    "totalTokens": 19657,
    "status": "running",
    "updatedAt": 1777745407000
  }
}
```

**Parseo de la clave:** `agent:<agentId>:<channel>:<tipo>:<userId>`

| Segmento | Significado | Ejemplo |
|---|---|---|
| `agent` | Prefijo fijo | — |
| `main` | agentId del agente | `main`, `analytics-bot` |
| `telegram` | Canal | `telegram`, `discord`, `whatsapp` |
| `direct` | Tipo de chat | `direct` (DM), `slash` (comandos) |
| `1072294086` | ID del usuario humano | Telegram user ID |

---

## 4. Cómo crear un bot nuevo

### Opción A: CLI (recomendada)

```bash
openclaw agents add <agentId>
```

Esto crea automáticamente:
- `~/.openclaw/agents/<agentId>/` con su estructura
- Workspace en `~/.openclaw/workspace-<agentId>/`
- Archivos bootstrap (`AGENTS.md`, `SOUL.md`, etc.)

### Opción B: Manual en `openclaw.json`

```json
{
  "agents": {
    "defaults": {
      "workspace": "/home/mdzac/.openclaw/workspace"
    },
    "list": [
      { "id": "main", "workspace": "~/.openclaw/workspace" },
      { "id": "analytics-bot", "workspace": "~/.openclaw/workspace-analytics" }
    ]
  }
}
```

Luego crear manualmente el workspace y los archivos bootstrap.

### Asignar canal a un bot (ej: Telegram)

```json
{
  "channels": {
    "telegram": {
      "accounts": {
        "default": {
          "botToken": "123456:ABC..."  ← token de BotFather
        },
        "analytics": {
          "botToken": "789012:DEF..."  ← otro bot de BotFather
        }
      }
    }
  },
  "bindings": [
    { "agentId": "main", "match": { "channel": "telegram", "accountId": "default" } },
    { "agentId": "analytics-bot", "match": { "channel": "telegram", "accountId": "analytics" } }
  ]
}
```

---

## 5. Comunicación entre Agentes

### Método 1: `sessions_send` (Recomendado)

Lunes (el agente principal) puede enviar un mensaje directamente a otro agente:

```
Lunes: sessions_send(agentId="analytics-bot", message="Procesa estos datos: {...}")
analytics-bot: [procesa y responde]
Lunes: recibe la respuesta
```

El agente destino procesa el mensaje como si fuera una conversación normal, con toda su capacidad de razonamiento.

### Método 2: `sessions_spawn` (Sub-agente temporal)

```
Lunes: sessions_spawn(task="Ejecuta el análisis de anomalías con estos parámetros")
       → Crea un sub-agente temporal
       → El sub-agente ejecuta, piensa, devuelve resultado
       → Se cierra automáticamente
```

### Método 3: Archivos compartidos

Ambos agentes tienen acceso al sistema de archivos. Pueden leer/escribir JSON en:

```
/home/mdzac/.openclaw/workspace/_core/shared/
```

---

## 6. Proyectos existentes en el workspace

### Neural Dashboard

```
workspace/neural-dashboard/
├── domain/                          ← Lógica de negocio pura (sin dependencias externas)
│   ├── ports/                       ← Contratos (interfaces)
│   │   ├── session-repository.js    ← "Necesito obtener sesiones"
│   │   └── identity-reader.js       ← "Necesito saber quién soy"
│   └── entities/                    ← Entidades del dominio
│       ├── agent.js
│       └── session.js
├── application/                     ← Casos de uso
│   └── use-cases/
│       └── build-agent-network.js   ← Construye la red de agentes
├── infrastructure/                  ← Implementaciones concretas
│   ├── database/
│   │   └── session-json-repository.js   ← Lee sessions.json
│   └── filesystem/
│       ├── identity-from-file.js        ← Lee IDENTITY.md
│       ├── log-reader.js                ← Lee logs/
│       └── memory-reader.js            ← Lee memory/
├── adapters/                        ← Cómo se conecta al mundo
│   └── web/
│       └── socket-handler.js        ← Socket.io (cambia si migras)
├── public/index.html                ← Frontend (visualización neurona)
└── server.js                        ← Punto de entrada (inyecta dependencias, inicia Express)
```

**Flujo de datos actual:**

```
sessions.json  →  session-json-repository.js  →  build-agent-network.js  →  WebSocket  →  navegador
(archivo)          (infrastructure)               (application/use-case)     (adapter)      (frontend)
```

**Endpoint:** `http://192.168.153.177:3456`  
**Tecnología:** Node.js + Express + Socket.io + Canvas API

### Arquitectura Hexagonal (Core Compartido)

```
workspace/_core/
├── ARQUITECTURA.md                  ← Documentación de la arquitectura
├── domain/                          ← Lógica de negocio pura
│   ├── entities/
│   ├── value-objects/
│   └── ports/                       ← Interfaces
├── application/                     ← Casos de uso
│   └── use-cases/
├── infrastructure/                  ← Implementaciones concretas
│   ├── database/
│   ├── messaging/
│   ├── http/
│   └── filesystem/
└── adapters/                        ← Conexión con el mundo exterior
    ├── cli/
    ├── events/
    └── web/
```

**Principio rector:** Las dependencias apuntan hacia adentro. El dominio no sabe del exterior. Los adaptadores cambian sin tocar el negocio.

---

## 7. Habilidades (Skills) instaladas

OpenClaw carga skills desde el workspace para darle capacidades especializadas al agente:

```
workspace/skills/
├── fox-data-analyst/               ← Visualización de datos, dashboards, SQL
├── influxdb/                       ← Time-series DB
├── markdown-converter/             ← Conversión de documentos a Markdown
├── mqtt/                           ← MQTT messaging
├── mqtt-client-openclaw/           ← Cliente MQTT universal
└── mssql/                          ← SQL Server
```

---

## 8. Arquitectura Propuesta para el Bot Intermediario

### Componentes

```
┌─────────────────────────────────────────────────────┐
│                   Raspberry Pi                        │
│                                                       │
│  ┌──────────┐    ┌──────────────┐    ┌────────────┐ │
│  │ Claude   │───►│  Algoritmo   │───►│  Bot       │ │
│  │ .ai      │    │  Anomalías   │    │  Analytics │ │
│  └──────────┘    └──────────────┘    └─────┬──────┘ │
│                                            │        │
│                                            ▼        │
│                                     ┌──────────┐   │
│                                     │  MQTT    │   │
│                                     │  Broker  │   │
│                                     └─────┬────┘   │
│                                           │        │
│                                           ▼        │
│  ┌──────────────┐               ┌──────────────┐   │
│  │  Neural      │◄──────────────│  Dashboard   │   │
│  │  Dashboard   │   Socket.io   │  (frontend)  │   │
│  └──────────────┘               └──────────────┘   │
│                                                       │
└─────────────────────────────────────────────────────┘
```

### Flujo de datos

1. **Claude.ai** ejecuta el algoritmo de detección de anomalías
2. **El algoritmo** genera datos en tiempo real (detecciones, métricas, alertas)
3. **Bot Analytics** (nuevo agente OpenClaw) recibe estos datos, los **procesa con razonamiento** (no solo imprime), y los convierte a logs estructurados
4. **MQTT** transporta los logs hacia el dashboard
5. **Neural Dashboard** los recibe por Socket.io (conectado a MQTT) y los visualiza

### Lo que el bot Analytics hará

- Recibir datos del algoritmo (por API, archivo compartido, o a través de Lunes)
- **Pensar sobre los datos**: interpretar anomalías, correlacionar eventos, decidir qué es relevante
- Convertir su razonamiento a **logs estructurados** con metadatos (timestamp, severidad, tipo de anomalía, recomendación)
- Publicar en MQTT en tópicos como:
  - `anomalies/detected` → nueva anomalía detectada
  - `anomalies/summary` → resumen periódico
  - `system/health` → estado del sistema
- Comunicarse con Lunes para coordinar acciones

### Comunicación Lunes ↔ Bot Analytics

```
Tú (Polo) ──► Telegram ──► Lunes ──► sessions_send ──► Bot Analytics
                                      ▲                        │
                                      │                        ▼
                                      └─────── respuesta ─────┘
```

Tú le dices a Lunes "ejecuta el análisis", Lunes se lo pasa al bot Analytics, el bot lo procesa y devuelve los resultados.

---

## 9. Puertos actualmente en uso

| Puerto | Servicio | Descripción |
|---|---|---|
| 3456 | Neural Dashboard | Frontend + Socket.io |
| 18789 | OpenClaw Gateway | API interna (loopback) |
| (libre) | MQTT | Para el nuevo bot (típicamente 1883) |

---

## 10. Referencias técnicas

- **Docs OpenClaw (locales):** `/home/mdzac/.npm-global/lib/node_modules/openclaw/docs/`
- **Multi-agente:** docs sobre `agents.list`, `bindings`, `sessions_send`
- **MQTT Skill:** `/home/mdzac/.openclaw/workspace/skills/mqtt/SKILL.md`
- **MQTT Client Skill:** `workspace/skills/mqtt-client-openclaw/SKILL.md`
- **GitHub:** https://github.com/openclaw/openclaw

---

*Documento preparado por Lunes 🦎 — Asistente personal de Polo*
