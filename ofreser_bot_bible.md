# OFRESER BOT — MASTER TECHNICAL BIBLE (VERSIÓN COMPLETA UNIFICADA)

---

## 1. IDENTIDAD DEL SISTEMA

El sistema es un **Asistente Virtual Comercial (Chatbot) + CRM integrado** diseñado para la empresa **Ofreser** (control de plagas).

**Función principal:**

- Atención automática omnicanal (WhatsApp + Webchat)
- Calificación de leads (Lead Scoring)
- Recolección de datos estructurados
- Derivación a humano (handoff)
- Gestión completa desde CRM

> El sistema no está dividido en microservicios. Es un **backend monolítico con frontend embebido**.

---

## 2. ARQUITECTURA GENERAL

**Tipo de arquitectura:** Monolito modular

**Separación por capas:**

- `domain`
- `application`
- `infrastructure`
- `shared`

---

## 3. FLUJO DE INICIALIZACIÓN

1. Se ejecuta `server.js`
2. Se cargan variables de entorno (`dotenv`)
3. Se valida configuración (`env.js`)
4. Se inicializa SQLite (`initDb()`)
5. Se crean tablas si no existen
6. Se ejecutan migraciones seguras
7. Se levanta Express (`app.js`)
8. Se registran logs con Winston
9. Se habilitan endpoints HTTP

---

## 4. MODELO DE EJECUCIÓN

- Node.js (CommonJS)
- Event Loop
- Async/Await
- Request/Response HTTP
- Sin uso de EventEmitter custom
- Control basado en middlewares

---

## 5. STACK TECNOLÓGICO

### Backend

| Tecnología | Detalle |
|---|---|
| Runtime | Node.js |
| Framework | Express 5.2.1 |

### Base de datos

| Tecnología | Estado |
|---|---|
| SQLite (`better-sqlite3`) | ✅ Activo |
| PostgreSQL (`pg`) | ⚠️ Presente pero no activo |

### Seguridad

- `bcrypt`
- `crypto.scryptSync` (implementación real)
- CORS

### Utilidades

- `axios`
- `uuid`
- `dotenv`

### Logging

- `winston`
- `winston-daily-rotate-file`

---

## 6. ARQUITECTURA INTERNA DETALLADA

### Entry Point

**Archivo:** `server.js`

**Responsabilidades:**
- Cargar variables de entorno
- Inicializar DB
- Iniciar servidor
- Graceful shutdown

---

### Capa Infrastructure (HTTP)

**Archivo:** `app.js`

**Define rutas:**
- `crm`
- `admin`
- `webhook whatsapp`
- `webchat`

**Controladores:**
- `crm-auth.controller`
- `crm.controller`
- `admin.controller`
- `whatsapp-webhook.controller`
- `webchat.controller`

**Middleware:**
- `crmAuthMiddleware`

---

### Capa Application

**Archivo:** `process-incoming-message.js`

**Responsabilidad:** Orquestar:
- Sesión
- Mensajes
- Lead
- Motor conversacional

---

### Capa Domain

#### `conversation-engine`
- Lógica principal del bot
- Decide respuestas

#### `detect-intent`
- Detección por keywords

#### `detect-faq`
- Respuestas rápidas

#### `response-builder`
- Formato estándar de respuesta:

```json
{
  "message": "...",
  "options": [],
  "extra": {}
}
```

---

### Capa Lead

#### `contact-parser`
Parsea:
- Nombre
- Teléfono

#### `lead-scorer`
Calcula score basado en:
- Intención
- Datos
- Palabras clave
- Profundidad de conversación

---

## 7. BASE DE DATOS (ESQUEMA COMPLETO)

**Motor activo:** SQLite

**Ubicación:**
- Local: `/storage/ofreser.db`
- Render: `/var/data/ofreser.db`

---

### Tabla: `sessions`

**Propósito:** Estado de conversación

| Campo | Descripción |
|---|---|
| `session_id` | PK |
| `channel` | Canal de origen |
| `external_user_id` | ID externo del usuario |
| `step` | Paso actual del flujo |
| `data_json` | Datos estructurados |
| `invalid_count` | Contador de inputs inválidos |
| `control_mode` | `bot` / `human` / `closed` |
| `human_requested_at` | Timestamp de solicitud de humano |
| `human_taken_at` | Timestamp de toma por humano |
| `closed_at` | Timestamp de cierre |
| `human_notice_sent_at` | Timestamp de aviso enviado |

---

### Tabla: `messages`

**Propósito:** Historial de mensajes

| Campo | Descripción |
|---|---|
| `id` | PK |
| `session_id` | FK → sessions |
| `channel` | Canal |
| `external_user_id` | ID externo del usuario |
| `direction` | Dirección del mensaje |
| `sender_type` | Tipo de remitente |
| `text` | Contenido del mensaje |
| `raw_payload_json` | Payload crudo |
| `created_at` | Timestamp |

**Índice:** `session_id`

---

### Tabla: `leads`

**Propósito:** CRM

| Campo | Descripción |
|---|---|
| `id` | PK |
| `session_id` | FK → sessions |
| `category` | Categoría del lead |
| `name` | Nombre del contacto |
| `phone` | Teléfono |
| `normalized_phone` | Teléfono normalizado |
| `pest` | Tipo de plaga |
| `status` | Estado comercial |
| `internal_note` | Nota interna |
| `requires_human` | Flag de derivación |
| `partial` | Flag de lead parcial |
| `created_at` | Timestamp |

**Estados posibles:**
- `nuevo`
- `calificado`
- `seguimiento`
- `cerrado`

---

### Tabla: `crm_users`

| Campo | Descripción |
|---|---|
| `id` | PK |
| `username` | UNIQUE |
| `password_hash` | Hash de contraseña |
| `is_active` | Flag de activo |
| `role` | Rol del usuario |
| `failed_attempts` | Intentos fallidos |
| `is_blocked` | Flag de bloqueo |
| `created_at` | Timestamp |
| `updated_at` | Timestamp |

---

### Tabla: `crm_sessions`

| Campo | Descripción |
|---|---|
| `token` | PK |
| `user_id` | FK → crm_users |
| `username` | Nombre de usuario |
| `role` | Rol |
| `issued_at` | Timestamp de emisión |
| `expires_at` | Timestamp de expiración |

**Índice:** `expires_at`

---

### Tabla: `audit_logs`

| Campo | Descripción |
|---|---|
| `id` | PK |
| `actor_user_id` | ID del actor |
| `actor_username` | Username del actor |
| `actor_role` | Rol del actor |
| `action` | Acción realizada |
| `entity_type` | Tipo de entidad afectada |
| `entity_id` | ID de entidad afectada |
| `details_json` | Detalles en JSON |
| `ip_address` | IP de origen |
| `created_at` | Timestamp |

---

## 8. POSTGRESQL

| Estado | Detalle |
|---|---|
| Dependencia | Instalada (`pg`) |
| Integración | ❌ No integrada |
| Uso en repositorios | ❌ No usada |
| DB activa | ✅ 100% SQLite |

### Instalación local PostgreSQL (Windows)

Se instaló PostgreSQL localmente en Windows utilizando instalador oficial EDB.

Configuración:

- Usuario: postgres
- Puerto: 5432
- Base de datos: ofreser

Se validó conexión mediante:

- pgAdmin
- Query: SELECT NOW()

Se configuró variable:

DATABASE_URL=postgresql://postgres:****@localhost:5432/ofreser

Estado:

- PostgreSQL funcionando localmente.
- Conexión validada desde script Node.js.
- SQLite continúa como base principal.

### Conexión local validada

Se configuró PostgreSQL en entorno local (Windows) y se validó la conexión desde el backend Node.js.

Configuración:

- Usuario: postgres
- Host: localhost
- Puerto: 5432
- Base de datos: ofreser

Variable de entorno utilizada:

DATABASE_URL=postgresql://postgres:****@localhost:5432/ofreser

Validación realizada mediante:

- Script: scripts/test-postgres-connection.js
- Query ejecutada: SELECT NOW()

Resultado:

- Conexión exitosa
- PostgreSQL responde correctamente

Estado actualizado:

- PostgreSQL disponible en entorno local
- NO integrado en repositories
- NO utilizado en producción (Render)
- SQLite continúa como base principal activa

### Repository PostgreSQL inicial

Se creó:

- src/infrastructure/persistence/postgres/leads.repository.js

Estado:

- Versión parcial (solo saveLead)
- No integrada al sistema
- No reemplaza SQLite
- Usada solo para pruebas controladas

### Tabla leads en PostgreSQL

Se creó la tabla `leads` en PostgreSQL alineada con la estructura SQLite.

Características:

- Tipos TEXT para mantener flexibilidad
- BOOLEAN para flags (requires_human, partial)
- TIMESTAMP para fechas

Estado:

- Tabla creada correctamente
- Lista para pruebas de inserción
- No integrada al sistema aún

---

## 9. FUNCIONALIDADES DEL SISTEMA

### Chatbot

**Flujos:**
- Servicios
- Productos
- Certificados
- Administración

**Capacidades:**
- Manejo de contexto
- Validación de input
- Fallback a humano
- Parsing de contacto

---

### CRM

- Login persistente
- Roles (`admin`)
- Gestión de leads
- Estados comerciales
- Notas internas
- Paginación
- Filtros

---

### Handoff

**Cambio de control entre:**
- `bot`
- `human`
- `closed`

Envío manual desde CRM.

---

### Lead Scoring

- Historial
- Intención
- Datos estructurados
- Urgencia

---

### Admin

- ABM de usuarios
- Bloqueo / desbloqueo
- Reset de contraseña
- Auditoría
- Backups
- Restore
- Reset de datos

---

## 10. BACKUPS

- SQLite `VACUUM INTO`
- Rotación máxima de 10 archivos
- Validación de archivo
- Restore en caliente

---

## 11. SEGURIDAD

- Hash con `scrypt`
- Bloqueo por intentos fallidos
- Validación de roles
- Protección de rutas admin
- Rate limit de login (en RAM)

---

## 12. LOGGING

- `winston`
- Formato JSON
- Rotación diaria
- Logs separados: `error` / `general`

---

## 13. CONFIGURACIÓN DE NEGOCIO

**Archivo:** `business.config.js`

**Contiene:**
- Nombre de empresa
- Horarios
- Dirección
- Textos
- Certificados
- `businessHours` estructurado

---

## 14. ENDPOINTS HTTP COMPLETOS

> Listado completo, no resumido.

| Endpoint | Descripción |
|---|---|
| `/chat` | Webchat |
| `/webhook/whatsapp` | Webhook de WhatsApp |
| `/crm/*` | Rutas del CRM |
| `/admin/*` | Rutas de administración |
| `/leads` | Gestión de leads |
| `/messages` | Historial de mensajes |
| `/sessions` | Gestión de sesiones |

**Control por:** middleware + roles

---

## 15. FRONTEND CRM

**Scripts modulares:**
- `crm-api`
- `crm-leads`
- `crm-render`
- `crm-drawer`
- `crm-events`
- `crm-actions`
- *(entre otros)*

**Integración:** Consumo REST del backend

---

## 16. ESTRUCTURA REAL DEL REPOSITORIO

Estructura física actual del proyecto:

- `/server.js`
  - Entry point principal del backend.

- `/scripts`
  - Scripts manuales y operativos.
  - No forman parte del flujo normal del backend.
  - Se ejecutan manualmente desde consola.
  - Ejemplos actuales:
    - `delete-session.js`
    - `run-backup.js`
    - `test-backup.js`
    - `test-postgres-connection.js`
    - `test-restore.js`

- `/src`
  - Código productivo del sistema.

- `/src/application`
  - Casos de uso.

- `/src/config`
  - Configuración del sistema y del negocio.

- `/src/domain`
  - Lógica de negocio pura.

- `/src/infrastructure`
  - Implementaciones técnicas: HTTP, base de datos, canales externos y persistencia.

- `/src/infrastructure/database`
  - Inicialización, backup, restore y conexiones de base de datos.
  - Contiene:
    - `sqlite.js`
    - `init-db.js`
    - `backup.js`
    - `restore.js`
    - `postgres.js`

- `/src/infrastructure/persistence/sqlite`
  - Repositorios activos actuales usando SQLite.

- `/src/infrastructure/http/public`
  - Frontend embebido del CRM y webchat.

- `/storage`
  - Base SQLite local.

Regla estructural:

- Código productivo: `/src`
- Scripts manuales/operativos: `/scripts`
- Base de datos local: `/storage`
- Documentación: `/docs`
- Logs locales: `/logs`

---

## 17. REGLAS OPERATIVAS DE DESARROLLO

Estas reglas aplican a todo cambio técnico del proyecto.

### Código

- Todo archivo nuevo debe entregarse completo.
- Todo archivo completo debe incluir al inicio un comentario en español explicando:
  - qué hace el archivo;
  - para qué existe;
  - si forma parte del flujo productivo o si es un script manual.
- Cada bloque importante, función o decisión técnica debe estar comentada en español.
- No se deben entregar parches ambiguos sin contexto.
- No se deben usar rutas asumidas.
- Toda ruta debe respetar la estructura real documentada del proyecto.

### Seguridad del cambio

- No modificar archivos fuera del alcance indicado.
- No cambiar SQLite mientras PostgreSQL esté en preparación paralela.
- No tocar Render hasta que se indique explícitamente.
- No migrar todo de golpe.
- Todo avance debe ser incremental, verificable y reversible.

### Git

Después de cada cambio técnico, se deben indicar siempre los pasos de Git:

git status
git add <archivo_modificado>
git commit -m "<mensaje_claro_del_cambio>"
git push origin feature/postgres-migration
git status

### Biblia técnica

Después de cada paso crítico, se debe indicar qué actualizar en:

ofreser_bot_bible.md

La biblia debe mantenerse como fuente de verdad actualizada del sistema, debe reflejar estructura, archivos, funcionalidades, etc todo lo reflejado en esta biblia nivel de detalle extremo para que sea interpretado por cualqiuer IA con solo leer este md.

---

## 19. ENTORNO DE DESPLIEGUE — RENDER

### Tipo de servicio

- Web Service (Node.js)
- Nombre: ofreser-crm

---

### Plan

- Starter (Hobby / Legacy)
- Recursos:
  - 0.5 CPU
  - 512 MB RAM

---

### Región

- Oregon (US West)

---

### Repositorio

- GitHub: javierjavier22/ofreser-crm
- Branch: main

---

### Build & Deploy

- Build Command: npm install
- Start Command: node server.js
- Auto Deploy: On Commit

---

### URL pública

https://ofreser-crm.onrender.com

---

### Variables de entorno

Configuradas actualmente:

- ALLOW_ADMIN_RESET
- CRM_API_KEY
- CRM_PASSWORD
- CRM_USERNAME
- NODE_ENV
- PHONE_NUMBER_ID
- PORT
- VERIFY_TOKEN
- WA_PRODUCTION
- WHATSAPP_TOKEN

Notas:

- DATABASE_URL aún NO está configurada.
- PostgreSQL no está activo en producción.

---

### Persistencia

- Disco montado en: /var/data
- Tamaño: 1 GB

Uso actual:

- Base SQLite en:
  /var/data/ofreser.db

- Persistencia garantizada entre deploys.

---

### Snapshots

- Snapshots automáticos activos
- Restauración disponible desde panel Render

---

### Logging

- Logs accesibles desde Render Dashboard
- Logging adicional con Winston en aplicación

---

### Estado actual

- Sistema productivo activo
- SQLite como base principal
- PostgreSQL no implementado aún

---

## 20. CONCLUSIÓN DEL ESTADO ACTUAL

El sistema es:

| Aspecto | Estado |
|---|---|
| Arquitectura | Monolito modular |
| Backend | Node.js (Express) |
| Entorno productivo | Activo en Render (Web Service) |
| Plan Render | Starter (Hobby / Legacy) |
| DB activa | SQLite (persistente en /var/data) |
| Persistencia | Configurada con disk en Render + snapshots |
| CRM | Funcional completo en producción |
| Chatbot | Productivo (WhatsApp + Webchat) |
| Logging | Profesional (Winston + logs Render) |
| Seguridad | Básica implementada (auth, roles, hashing) |
| Deploy | Automático (On Commit desde GitHub) |
| PostgreSQL | Preparado en código, no configurado ni integrado |
| Estado general | Sistema estable en producción, en fase de mejora incremental controlada |