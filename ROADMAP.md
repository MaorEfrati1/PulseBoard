# PulseBoard — Development Roadmap

> פירוט מלא של כל המשימות לפי שלבים  
> כל משימה כתובה ברמה שניתן להעביר ישירות ל-AI coder

---

## הוראות שימוש

**כיצד לעבוד עם המסמך הזה:**

1. עבוד שלב אחד בכל פעם — אל תדלג
2. כל משימה שמסומנת בـ `[ ]` — זו משימה לבצע
3. כדי לתת ל-AI לכתוב קוד: העתק את הבלוק כולו (כותרת + תיאור + דרישות)
4. לאחר השלמת משימה — סמן `[x]`
5. בכל שלב יש "Checkpoint" — ודא שהכל עובד לפני שמתקדם

---

## שלב 0 — סביבת עבודה (Prerequisites)

### דרישות מוקדמות — התקנות

```bash
# ודא שמותקן:
node --version    # צריך להיות 20+
npm --version     # צריך להיות 10+
docker --version  # צריך להיות 24+
git --version

# אם לא מותקן Docker:
# https://docs.docker.com/get-docker/
```

- [ ] **0.1** — התקן Node.js 20 LTS מ-https://nodejs.org
- [ ] **0.2** — התקן Docker Desktop מ-https://docs.docker.com/get-docker
- [ ] **0.3** — צור חשבון Firebase ב-https://console.firebase.google.com
  - צור פרויקט חדש בשם `pulseboard`
  - הפעל Firestore Database (בחר Test mode בהתחלה)
  - הפעל Cloud Messaging (FCM)
  - לך ל-Project Settings → Service Accounts → Generate new private key
  - שמור את קובץ ה-JSON שנוצר בשם `firebase-service-account.json`
- [ ] **0.4** — צור תיקיית פרויקט:
  ```bash
  mkdir pulseboard && cd pulseboard
  git init
  echo "node_modules\n.env\n*.log\ndist\n.expo" > .gitignore
  ```

---

## שלב 1 — Infrastructure (Docker + DB + Redis)

### 1.1 — Docker Compose

- [ ] **1.1.1** — צור קובץ `docker-compose.yml` בתיקיית הroot של הפרויקט:

**תוכן הקובץ:**
```yaml
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    container_name: pulseboard_postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: pulseboard
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: pulseboard_redis
    restart: unless-stopped
    command: >
      redis-server
      --appendonly yes
      --maxmemory 256mb
      --maxmemory-policy allkeys-lru
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 5s
      retries: 5

  redis-commander:
    image: rediscommander/redis-commander:latest
    container_name: pulseboard_redis_ui
    environment:
      - REDIS_HOSTS=local:redis:6379
    ports:
      - '8081:8081'
    depends_on:
      - redis

volumes:
  postgres_data:
  redis_data:
```

- [ ] **1.1.2** — הרץ את הcontainers:
  ```bash
  docker-compose up -d
  # ✅ Postgres זמין ב-localhost:5432
  # ✅ Redis זמין ב-localhost:6379
  # ✅ Redis UI זמין ב-http://localhost:8081
  ```

- [ ] **1.1.3** — בדוק שהכל רץ:
  ```bash
  docker-compose ps
  # כל service צריך להיות "healthy"
  ```

### ✅ Checkpoint 1 — Docker
```bash
docker-compose ps | grep "healthy"
# צריך לראות: pulseboard_postgres (healthy), pulseboard_redis (healthy)
```

---

## שלב 2 — Server Setup (Node.js + TypeScript)

### 2.1 — אתחול פרויקט Server

- [ ] **2.1.1** — צור תיקיית server:
  ```bash
  mkdir server && cd server
  npm init -y
  ```

- [ ] **2.1.2** — **תן ל-AI לבצע:** "צור package.json לפרויקט Node.js+TypeScript עם Express. Dependencies נדרשים:
  - production: `express`, `cors`, `helmet`, `compression`, `dotenv`, `@prisma/client`, `ioredis`, `firebase-admin`, `jsonwebtoken`, `bcryptjs`, `zod`, `winston`, `socket.io`, `@socket.io/redis-adapter`
  - dev: `typescript`, `ts-node`, `nodemon`, `prisma`, `@types/express`, `@types/node`, `@types/jsonwebtoken`, `@types/bcryptjs`, `@types/cors`, `@types/compression`, `jest`, `@types/jest`, `ts-jest`, `supertest`, `@types/supertest`
  - scripts: `dev` (nodemon), `build` (tsc), `start` (node dist/index.js), `test` (jest)"

- [ ] **2.1.3** — **תן ל-AI לבצע:** "צור `tsconfig.json` לפרויקט Node.js+TypeScript עם הגדרות:
  - target: ES2022, module: commonjs
  - strict: true, strictNullChecks: true
  - outDir: ./dist, rootDir: ./src
  - esModuleInterop: true, resolveJsonModule: true
  - exclude: node_modules, dist, **/*.test.ts"

- [ ] **2.1.4** — **תן ל-AI לבצע:** "צור `nodemon.json` שמריץ ts-node על src/index.ts, עם watch על תיקיית src, restartable על קבצי .ts ו-.json"

- [ ] **2.1.5** — הרץ: `npm install`

### 2.2 — Environment Variables

- [ ] **2.2.1** — צור `.env` בתיקיית server:
  ```bash
  PORT=4000
  NODE_ENV=development
  DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pulseboard
  REDIS_URL=redis://localhost:6379
  JWT_ACCESS_SECRET=dev-access-secret-change-in-production
  JWT_REFRESH_SECRET=dev-refresh-secret-change-in-production
  CLIENT_URL=http://localhost:8081
  FIREBASE_SERVICE_ACCOUNT_JSON=PASTE_YOUR_JSON_HERE
  FIREBASE_STORAGE_BUCKET=your-project.appspot.com
  ```

- [ ] **2.2.2** — פתח את קובץ ה-JSON שהורדת מFirebase (firebase-service-account.json), העתק את כל התוכן שלו (כולל הסוגריים המסולסלים), הדבק כערך של `FIREBASE_SERVICE_ACCOUNT_JSON` בשורה אחת

### ✅ Checkpoint 2 — Server Init
```bash
cd server && npx ts-node -e "console.log('TypeScript OK')"
# צריך להדפיס: TypeScript OK
```

---

## שלב 3 — Database Schema (Prisma)

### 3.1 — Prisma Setup

- [ ] **3.1.1** — אתחל Prisma:
  ```bash
  npx prisma init --datasource-provider postgresql
  ```

- [ ] **3.1.2** — **תן ל-AI לבצע:** "צור `prisma/schema.prisma` עם המודלים הבאים. **חשוב:** כל שדה חייב להיות עם סוג מדויק, כל relation חייב להיות עם onDelete, כל טבלה חייבת @@map ו-@@index על FK columns.

  מודלים:
  - **User**: id(uuid), email(unique), passwordHash, name, avatarUrl?, role(enum USER/ADMIN default USER), fcmToken?, isActive(default true), createdAt, updatedAt
  - **Session**: id(uuid), userId(FK→User cascade delete), refreshToken(unique), deviceInfo?, expiresAt, createdAt
  - **Task**: id(uuid), title, description?, status(enum TODO/DOING/DONE default TODO), priority(enum LOW/MEDIUM/HIGH default MEDIUM), authorId(FK→User), assigneeId?(FK→User), dueDate?, tags(String[] default []), createdAt, updatedAt
  - **Message**: id(uuid), taskId(FK→Task cascade delete), senderId(FK→User), content, createdAt
  - **ActivityLog**: id(uuid), userId(FK→User), action(String), entityId, entityType, metadata(Json default {}), createdAt

  הוסף indexes על: sessions.userId, tasks.authorId, tasks.assigneeId, tasks.status, tasks.createdAt, messages.taskId, activityLogs.userId, activityLogs.createdAt"

- [ ] **3.1.3** — הרץ migration:
  ```bash
  npx prisma migrate dev --name init
  ```

- [ ] **3.1.4** — הרץ generate:
  ```bash
  npx prisma generate
  ```

- [ ] **3.1.5** — **תן ל-AI לבצע:** "צור `src/config/database.ts` שמייצא singleton של PrismaClient. הוסף graceful shutdown handler שקורא prisma.$disconnect() ב-SIGINT ו-SIGTERM"

### ✅ Checkpoint 3 — Database
```bash
npx prisma studio
# פותח UI ב-http://localhost:5555
# ודא שרואים את כל הטבלאות
```

---

## שלב 4 — Utilities & Base Classes

### 4.1 — Logger

- [ ] **4.1.1** — **תן ל-AI לבצע:** "צור `src/utils/logger.ts` עם Winston logger.
  - Development format: colorized, timestamp HH:mm:ss, format: `TIME [LEVEL]: message {meta}`
  - Production format: JSON structured logging
  - Transports: Console תמיד. בproduction גם File לogs/error.log (errors בלבד) ולogs/combined.log (הכל)
  - Level: מגיע מ-process.env.LOG_LEVEL, default 'info'
  - ייצא: `export const logger`"

### 4.2 — Error Classes

- [ ] **4.2.1** — **תן ל-AI לבצע:** "צור `src/utils/errors.ts` עם:
  - `class AppError extends Error` עם fields: message, statusCode, isOperational=true
  - constructor שקורא `Object.setPrototypeOf(this, AppError.prototype)`
  - `class NotFoundError extends AppError` — default 404
  - `class UnauthorizedError extends AppError` — default 401
  - `class ForbiddenError extends AppError` — default 403
  - `class ConflictError extends AppError` — default 409"

### 4.3 — Async Handler

- [ ] **4.3.1** — **תן ל-AI לבצע:** "צור `src/utils/asyncHandler.ts` — Express wrapper שעוטף async route handlers ומעביר שגיאות ל-next(err) אוטומטית. Type-safe עם TypeScript."

### 4.4 — Error Middleware

- [ ] **4.4.1** — **תן ל-AI לבצע:** "צור `src/middleware/error.middleware.ts` — Express error handler (4 params).
  - ZodError → 400 עם field-level errors array
  - AppError (isOperational) → statusCode + message
  - Prisma P2002 (unique constraint) → 409 Conflict
  - Prisma P2025 (not found) → 404
  - כל שאר → 500, log.error, אל תחשוף פרטים
  - בdevelopment: הוסף stack trace לresponse"

### ✅ Checkpoint 4
```bash
npx ts-node -e "
  const { logger } = require('./src/utils/logger');
  logger.info('Logger works');
  const { AppError } = require('./src/utils/errors');
  const e = new AppError('test', 400);
  console.log(e.statusCode); // 400
"
```

---

## שלב 5 — Redis Service

- [ ] **5.1** — **תן ל-AI לבצע:** "צור `src/config/redis.ts` — class RedisService שמשתמש ב-ioredis.

  **חשוב:** צור 3 connections נפרדות: main, publisher, subscriber.

  Methods נדרשות:
  ```typescript
  connect(): Promise<void>
  get<T>(key: string): Promise<T | null>
  set(key: string, value: unknown, ttlSeconds?: number): Promise<void>
  del(key: string): Promise<void>
  invalidatePattern(pattern: string): Promise<void>  // uses SCAN, not KEYS (production safe)
  setSession(userId: string, data: object, ttl?: number): Promise<void>
  getSession<T>(userId: string): Promise<T | null>
  deleteSession(userId: string): Promise<void>
  incrementRateLimit(key: string, windowSeconds: number): Promise<number>
  publish(channel: string, message: unknown): Promise<void>
  subscribe(channel: string, callback: (msg: unknown) => void): Promise<void>
  enqueue(queue: string, item: unknown): Promise<void>
  dequeue<T>(queue: string): Promise<T | null>
  setOnline(userId: string, ttl?: number): Promise<void>  // default 30s
  deleteOnline(userId: string): Promise<void>
  getOnlineUsers(userIds: string[]): Promise<string[]>
  getPublisher(): Redis  // expose for Socket.io adapter
  getSubscriber(): Redis
  ```

  - SCAN בinvalidatePattern (לא KEYS — KEYS חוסם ב-production)
  - Exponential backoff reconnection strategy
  - log על connect/disconnect
  - ייצא singleton: `export const redisService = new RedisService()`"

- [ ] **5.2** — **תן ל-AI לבצע:** "כתוב unit tests לRedisService ב-`__tests__/redis.service.test.ts` עם mock של ioredis. תכסה: get/set עם TTL, session operations, rate limiting, pub/sub"

### ✅ Checkpoint 5
```bash
npm test -- redis.service
```

---

## שלב 6 — Firebase Config

- [ ] **6.1** — **תן ל-AI לבצע:** "צור `src/config/firebase.ts`.

  - אתחל Firebase Admin SDK מ-process.env.FIREBASE_SERVICE_ACCOUNT_JSON (JSON.parse)
  - אם `admin.apps.length > 0` — אל תאתחל שוב
  - ייצא: `firestore`, `fcm`, `storage`

  **class FirestoreService:**
  ```typescript
  setDocument(collection, docId, data, merge?): Promise<void>
  getDocument<T>(collection, docId): Promise<T | null>
  deleteDocument(collection, docId): Promise<void>
  addDocument(collection, data): Promise<string>  // returns new doc ID
  listenToCollection(path, query?, callback): () => void  // returns unsubscribe
  ```

  **class PushNotificationService:**
  ```typescript
  sendToDevice(fcmToken, notification, data?): Promise<string>
  sendToTopic(topic, notification, data?): Promise<string>
  sendMulticast(tokens, notification, data?): Promise<BatchResponse>
  subscribeToTopic(tokens, topic): Promise<void>
  ```

  - Handle gracefully if FIREBASE_SERVICE_ACCOUNT_JSON is missing (log warning, don't crash)
  - ייצא singletons: `firestoreService`, `pushService`"

---

## שלב 7 — Authentication Module

### 7.1 — Auth Service

- [ ] **7.1.1** — **תן ל-AI לבצע:** "צור `src/services/auth.service.ts` — class AuthService.

  **Methods:**
  ```typescript
  register(email, password, name): Promise<TokenPair>
  login(email, password, deviceInfo?): Promise<TokenPair>
  refresh(refreshToken): Promise<TokenPair>
  logout(userId, refreshToken): Promise<void>
  verifyAccessToken(token): JwtPayload
  ```

  **חוקים חשובים:**
  - register: בדוק duplicate email → throw ConflictError. bcrypt cost 12.
  - login: בדוק isActive. השתמש ב-bcrypt.compare. שמור session ב-Redis (TTL 7d).
  - refresh: jwt.verify → Prisma מצא session → צור tokens חדשים → **מחק session ישן → צור session חדש** (token rotation). אם session פג תוקף → UnauthorizedError.
  - logout: מחק מRedis + מחק מDB (Promise.all).
  - generateTokens (private): access JWT 15m, refresh JWT 7d. שמור session בDB.

  **interface TokenPair:** `{ accessToken: string, refreshToken: string }`
  **interface JwtPayload:** `{ userId: string, role: string }`

  השתמש ב-prismaClient ו-redisService singletons."

### 7.2 — Auth Middleware

- [ ] **7.2.1** — **תן ל-AI לבצע:** "צור `src/middleware/auth.middleware.ts`.

  **Augment Express Request type** (ב-src/types/express.d.ts):
  ```typescript
  declare global {
    namespace Express {
      interface Request {
        user?: { userId: string; role: string; email: string }
      }
    }
  }
  ```

  **Middlewares:**
  1. `authenticate` — Extract Bearer token → verify JWT → Redis getSession → attach req.user → next()
     - אם אין token → 401
     - אם JWT invalid → 401
     - אם Redis miss (logged out) → 401 'Session expired'
  2. `authorize(...roles)` — בדוק req.user.role. throw ForbiddenError אם לא מורשה.
  3. `rateLimiter(max, windowSec)` — Redis incrementRateLimit. key = userId או IP. throw 429 אם חרגת."

### 7.3 — Auth Routes

- [ ] **7.3.1** — **תן ל-AI לבצע:** "צור `src/routes/auth.routes.ts` עם Zod validation:

  ```
  POST /register — schema: { email: z.string().email(), password: z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/), name: z.string().min(2).max(50) }
  POST /login    — schema: { email, password: z.string().min(1), deviceInfo?: z.string() }
  POST /refresh  — schema: { refreshToken: z.string() }
  POST /logout   — protected (authenticate). body: { refreshToken }
  ```

  Response format:
  ```json
  { \"status\": \"success\", \"data\": { \"accessToken\": \"...\", \"refreshToken\": \"...\" } }
  ```

  השתמש ב-asyncHandler wrapper. Zod parse בתחילת כל handler."

- [ ] **7.3.2** — **תן ל-AI לבצע:** "כתוב integration tests ב-`__tests__/auth.test.ts` עם supertest:
  - register: happy path, duplicate email (409), weak password (400)
  - login: valid creds, wrong password (401), inactive user (401)
  - refresh: valid token, expired token (401), already used token (401)
  - logout: removes session from Redis

  השתמש ב-test database נפרד. Clean up בין tests."

### ✅ Checkpoint 7 — Auth
```bash
npm run dev
# בטרמינל נפרד:
curl -X POST http://localhost:4000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Test1234","name":"Test User"}'
# צריך לקבל: {"status":"success","data":{"accessToken":"...","refreshToken":"..."}}
```

---

## שלב 8 — Tasks Module

### 8.1 — Task Service

- [ ] **8.1.1** — **תן ל-AI לבצע:** "צור `src/services/task.service.ts` — class TaskService.

  **Methods:**
  ```typescript
  createTask(data: CreateTaskInput, authorId: string): Promise<Task>
  getTasks(filters: TaskFilters, pagination: Pagination): Promise<PaginatedResult<Task>>
  getTaskById(id: string): Promise<Task & { messages: Message[] }>
  updateTask(id: string, data: UpdateTaskInput, userId: string): Promise<Task>
  deleteTask(id: string, userId: string): Promise<void>
  getMessages(taskId: string, pagination: Pagination): Promise<PaginatedResult<Message>>
  addMessage(taskId: string, senderId: string, content: string): Promise<Message>
  ```

  **חוקים:**
  - createTask: שמור ב-DB → כתוב ActivityLog 'task.created' → כתוב Firestore activity_feed → invalidate Redis cache
  - updateTask: אם status השתנה → כתוב ActivityLog 'task.status_changed' → כתוב Firestore → Redis PUBLISH 'channel:task:updated' → invalidate cache
  - deleteTask: רק author יכול למחוק → ForbiddenError אחרת
  - getTasks: Cache-aside (Redis 5 min). Prisma select רק שדות נדרשים.

  **interface TaskFilters:** `{ status?, priority?, assigneeId?, authorId? }`
  **interface Pagination:** `{ page: number, limit: number }`"

### 8.2 — Task Routes

- [ ] **8.2.1** — **תן ל-AI לבצע:** "צור `src/routes/task.routes.ts` — כל routes מוגנות ב-authenticate.

  ```
  GET    /tasks          — query params: status, priority, page(default 1), limit(default 20)
  POST   /tasks          — body: { title, description?, priority?, assigneeId?, dueDate?, tags? }
  GET    /tasks/:id      — returns task + messages[]
  PATCH  /tasks/:id      — partial update, כל שדה אופציונלי
  DELETE /tasks/:id
  GET    /tasks/:id/messages — query: page, limit
  POST   /tasks/:id/messages — body: { content: z.string().min(1).max(2000) }
  ```

  Zod schemas לכל endpoint. asyncHandler לכל handler."

- [ ] **8.2.2** — **תן ל-AI לבצע:** "כתוב integration tests ב-`__tests__/tasks.test.ts`:
  - CRUD happy paths
  - 401 בלי token
  - 403 כשuser לא author מנסה למחוק
  - pagination: page 2 מחזיר נתונים נכונים
  - filters: status=TODO מחזיר רק TODO tasks"

### ✅ Checkpoint 8 — Tasks
```bash
npm test -- tasks
```

---

## שלב 9 — Socket.io + Real-Time

- [ ] **9.1** — **תן ל-AI לבצע:** "צור `src/sockets/socket.manager.ts` — function `initSocketServer(httpServer)`.

  **Setup:**
  - Socket.io server עם cors (origin מ-CLIENT_URL)
  - Redis adapter: `createAdapter(publisher, subscriber)` מ-@socket.io/redis-adapter
  - Auth middleware: extract token מ-`socket.handshake.auth.token` → verify → Redis getSession → attach socket.userId, socket.role

  **On connection:**
  - join personal room: `user:{userId}`
  - שמור online status ב-Redis (TTL 30s)
  - emit presence update לכולם

  **Register handlers:** importם מ-handlers/ folder"

- [ ] **9.2** — **תן ל-AI לבצע:** "צור `src/sockets/handlers/chat.handler.ts`.

  Events:
  - `message:send` { taskId, content } → save to DB → Redis PUBLISH 'chat:{taskId}' → emit 'message:receive' לroom 'task:{taskId}'
  - include: id, content, senderId, senderName, createdAt בmessage שנשלח"

- [ ] **9.3** — **תן ל-AI לבצע:** "צור `src/sockets/handlers/presence.handler.ts`.

  Events:
  - `room:join` { taskId } → socket.join('task:{taskId}')
  - `room:leave` { taskId } → socket.leave('task:{taskId}')
  - `typing:start` { taskId } → emit 'typing:update' { userId, typing: true } לroom
  - `typing:stop` { taskId } → emit 'typing:update' { userId, typing: false } לroom
  - `presence:heartbeat` → redis.setOnline(userId, 30) לrenew TTL

  On disconnect:
  - redis.deleteOnline(userId)
  - emit 'presence:update' { userId, online: false } לכולם"

- [ ] **9.4** — **תן ל-AI לבצע:** "ב-`src/sockets/socket.manager.ts` הוסף Redis subscriber לevents:
  - subscribe לchannel 'channel:task:updated' → emit 'task:updated' לroom 'task:{taskId}'
  - subscribe לchannel 'chat:{taskId}' → emit 'message:receive' לroom 'task:{taskId}' (fallback)"

### ✅ Checkpoint 9 — WebSocket
```bash
# בדוק logs ב-npm run dev
# אמור לרשום: "✅ Socket.io initialized with Redis adapter"
```

---

## שלב 10 — Express App Entry Point

- [ ] **10.1** — **תן ל-AI לבצע:** "צור `src/index.ts` — entry point של הserver.

  **סדר הגדרה חשוב:**
  1. `dotenv/config` import ראשון
  2. `http.createServer(app)`
  3. Middleware: helmet → cors → compression → express.json (limit 10mb)
  4. Health route: GET /health → { status: 'ok', uptime, timestamp }
  5. Routes: mount כל routers תחת /api/v1
  6. 404 handler: כל route שלא נמצא
  7. Error middleware: **חייב להיות אחרון**

  **bootstrap() function:**
  - await redisService.connect()
  - await prisma.\$connect()
  - initSocketServer(server)
  - server.listen(PORT)

  **Graceful shutdown:**
  - SIGTERM / SIGINT → close server → disconnect Redis → disconnect Prisma → process.exit(0)"

### ✅ Checkpoint 10 — Full Server
```bash
npm run dev
# צריך לראות:
# ✅ Redis connected
# ✅ PostgreSQL connected
# ✅ Socket.io initialized
# 🚀 Server running on port 4000

curl http://localhost:4000/health
# { "status": "ok", "uptime": ..., "timestamp": "..." }
```

---

## שלב 11 — Client Setup (React Native)

### 11.1 — Expo Init

- [ ] **11.1.1** — צור את הclient:
  ```bash
  cd ..  # חזור לroot
  npx create-expo-app client --template blank-typescript
  cd client
  ```

- [ ] **11.1.2** — התקן dependencies:
  ```bash
  npm install \
    @tanstack/react-query \
    zustand \
    axios \
    @react-navigation/native \
    @react-navigation/bottom-tabs \
    @react-navigation/stack \
    @react-native-async-storage/async-storage \
    react-native-gesture-handler \
    react-native-reanimated \
    react-native-safe-area-context \
    react-native-screens \
    socket.io-client \
    firebase \
    expo-notifications \
    expo-secure-store \
    zod
  ```

- [ ] **11.1.3** — **תן ל-AI לבצע:** "הגדר React Native Reanimated ב-babel.config.js — הוסף `plugins: ['react-native-reanimated/plugin']`. חשוב: reanimated plugin חייב להיות אחרון ברשימת plugins."

- [ ] **11.1.4** — צור `.env` בתיקיית client:
  ```bash
  EXPO_PUBLIC_API_URL=http://localhost:4000/api/v1
  EXPO_PUBLIC_WS_URL=ws://localhost:4000
  EXPO_PUBLIC_FIREBASE_API_KEY=your-key
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
  EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
  EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
  EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
  EXPO_PUBLIC_FIREBASE_APP_ID=your-app-id
  ```

### ✅ Checkpoint 11
```bash
npx expo start
# אפליקציה נפתחת בSimulator/Expo Go
```

---

## שלב 12 — Client — Types, API, Zustand

### 12.1 — TypeScript Types

- [ ] **12.1.1** — **תן ל-AI לבצע:** "צור `src/types/index.ts` עם interfaces:
  ```typescript
  User { id, email, name, avatarUrl?, role, fcmToken?, createdAt }
  Task { id, title, description?, status (TaskStatus enum), priority (Priority enum), authorId, assigneeId?, dueDate?, tags, createdAt, updatedAt, author?: User, assignee?: User }
  Message { id, taskId, senderId, content, createdAt, sender?: User }
  ActivityLog { id, userId, action, entityId, entityType, metadata, createdAt, user?: User }
  TokenPair { accessToken: string, refreshToken: string }
  PaginatedResponse<T> { data: T[], meta: { page, limit, total } }
  TaskFilters { status?, priority?, assigneeId?, authorId? }
  enum TaskStatus { TODO = 'TODO', DOING = 'DOING', DONE = 'DONE' }
  enum Priority { LOW = 'LOW', MEDIUM = 'MEDIUM', HIGH = 'HIGH' }
  ```"

### 12.2 — Axios Client

- [ ] **12.2.1** — **תן ל-AI לבצע:** "צור `src/api/axios.ts`.

  - Axios instance עם baseURL מ-EXPO_PUBLIC_API_URL, timeout 10000ms
  - **Request interceptor:** הוסף `Authorization: Bearer {accessToken}` מ-Zustand auth store
  - **Response interceptor — Token Refresh Logic:**
    - על 401: בדוק `_retry` flag (למנוע לולאה אינסופית)
    - אם `isRefreshing`: תור הbRequest לfailedQueue[]
    - אחרת: set isRefreshing=true, קרא refreshTokens() מZustand, replay כל failedQueue, return request מחדש
    - אם refresh נכשל: logout() → navigate to Login
  - ייצא: `export const apiClient`"

### 12.3 — API Modules

- [ ] **12.3.1** — **תן ל-AI לבצע:** "צור `src/api/auth.api.ts`:
  ```typescript
  login(email, password): Promise<TokenPair & { user: User }>
  register(email, password, name): Promise<TokenPair & { user: User }>
  refresh(refreshToken): Promise<TokenPair>
  logout(refreshToken): Promise<void>
  ```"

- [ ] **12.3.2** — **תן ל-AI לבצע:** "צור `src/api/tasks.api.ts`:
  ```typescript
  getTasks(filters?, page?, limit?): Promise<PaginatedResponse<Task>>
  getTask(id): Promise<Task & { messages: Message[] }>
  createTask(data): Promise<Task>
  updateTask(id, data): Promise<Task>
  deleteTask(id): Promise<void>
  getMessages(taskId, page?, limit?): Promise<PaginatedResponse<Message>>
  sendMessage(taskId, content): Promise<Message>
  ```"

### 12.4 — Zustand Stores

- [ ] **12.4.1** — **תן ל-AI לבצע:** "צור `src/store/auth.store.ts` עם Zustand + persist (AsyncStorage).

  **State:**
  - user: User | null
  - accessToken: string | null
  - refreshToken: string | null
  - isLoading: boolean
  - error: string | null

  **Actions:**
  - login(email, password): calls auth.api → set tokens + user
  - register(email, password, name)
  - logout(): calls auth.api (best effort) → clear state
  - refreshTokens(): calls auth.api.refresh → update tokens
  - setTokens(access, refresh)
  - clearError()

  **Persist:** שמור רק user, accessToken, refreshToken. לא isLoading/error."

- [ ] **12.4.2** — **תן ל-AI לבצע:** "צור `src/store/ui.store.ts` (ללא persist):
  - State: activeTaskId: string|null, isSocketConnected: boolean, unreadCount: number
  - Actions: setActiveTask, setSocketConnected, incrementUnread, resetUnread"

### ✅ Checkpoint 12
```bash
npx ts-node -e "console.log('Types OK')" 2>/dev/null || echo "Check types manually"
```

---

## שלב 13 — Client — Navigation

- [ ] **13.1** — **תן ל-AI לבצע:** "צור `src/navigation/types.ts` — TypeScript navigation param types:
  ```typescript
  AuthStackParamList { Login: undefined, Register: undefined }
  MainTabParamList { Feed: undefined, Tasks: undefined, Team: undefined, Profile: undefined }
  TasksStackParamList { TaskList: undefined, TaskDetail: { taskId: string }, TaskForm: { taskId?: string } }
  RootStackParamList { Auth: NavigatorScreenParams<AuthStackParamList>, Main: NavigatorScreenParams<MainTabParamList> }
  ```"

- [ ] **13.2** — **תן ל-AI לבצע:** "צור `src/navigation/RootNavigator.tsx`.
  - השתמש ב-useAuthStore לבדוק אם יש accessToken
  - אם יש token → render AppStack (Main tabs)
  - אם אין → render AuthStack (Login/Register)
  - הוסף loading state בזמן שבודקים AsyncStorage
  - Wrap ב-NavigationContainer"

- [ ] **13.3** — **תן ל-AI לבצע:** "צור `src/navigation/MainTabs.tsx` — Bottom Tab Navigator עם 4 tabs:
  - Feed (icon: home), Tasks (icon: check-square), Team (icon: users), Profile (icon: user)
  - Tab bar style: background לבן, active color #1D4ED8, inactive #9CA3AF
  - Badge על Feed tab (unreadCount מ-ui.store)"

---

## שלב 14 — Client — Hooks

### 14.1 — React Query Tasks Hook

- [ ] **14.1.1** — **תן ל-AI לבצע:** "צור `src/hooks/useTasks.ts`.

  ```typescript
  // Query keys
  taskKeys = {
    all: ['tasks'],
    lists: () => [...taskKeys.all, 'list'],
    list: (filters) => [...taskKeys.lists(), filters],
    detail: (id) => [...taskKeys.all, 'detail', id],
  }

  useInfiniteTasks(filters?) — InfiniteQuery:
    - queryFn: getTasks(filters, page)
    - getNextPageParam: lastPage.meta.total > page * limit → page + 1
    - staleTime: 5 minutes

  useTask(id) — Query, enabled: !!id, staleTime 2 min

  useCreateTask() — Mutation:
    - onMutate: cancel queries → snapshot → optimistic add
    - onError: rollback
    - onSettled: invalidate lists

  useUpdateTask() — Mutation:
    - onMutate: optimistic update של task detail
    - onError: rollback
    - onSettled: invalidate detail + lists

  useDeleteTask() — Mutation:
    - onMutate: optimistic remove from list
    - onError: rollback
  ```"

### 14.2 — Socket Hook

- [ ] **14.2.1** — **תן ל-AI לבצע:** "צור `src/hooks/useSocket.ts`.

  - connect(token): יצור socket connection ל-EXPO_PUBLIC_WS_URL עם auth: { token }
  - disconnect(): ניתוק clean
  - joinTaskRoom(taskId) / leaveTaskRoom(taskId)
  - sendMessage(taskId, content): emit 'message:send'
  - startTyping(taskId) / stopTyping(taskId)
  - heartbeat: setInterval כל 20s לemit 'presence:heartbeat'

  **Listeners (useEffect):**
  - 'message:receive' → callback
  - 'task:updated' → invalidate React Query task detail
  - 'typing:update' → callback
  - 'presence:update' → callback

  **Cleanup:** disconnect + clearInterval ב-useEffect cleanup

  ייצא singleton instance (לא hook) — אחרת יווצרו connections מרובות."

### 14.3 — Firebase Activity Feed Hook

- [ ] **14.3.1** — **תן ל-AI לבצע:** "צור `src/hooks/useActivityFeed.ts`.

  - אתחל Firebase JS SDK מ-EXPO_PUBLIC_FIREBASE_* env vars (אחת פעם, בדוק `getApps().length`)
  - `useActivityFeed()` hook:
    - Firestore onSnapshot על collection 'activity_feed', orderBy createdAt desc, limit 50
    - state: `items: ActivityLog[]`, `loading: boolean`, `error: Error|null`
    - cleanup: unsubscribe() ב-useEffect cleanup
    - return { items, loading, error }"

### 14.4 — Push Notifications Hook

- [ ] **14.4.1** — **תן ל-AI לבצע:** "צור `src/hooks/usePushNotifications.ts`.

  - בקש permissions עם `expo-notifications`
  - אם approved: getDevicePushTokenAsync → שלח PATCH /users/me עם { fcmToken }
  - `addNotificationReceivedListener`: incrementUnread ב-ui.store
  - `addNotificationResponseReceivedListener`: navigate לtask הרלוונטי (מdata.taskId)
  - הגדר notification handler: `setNotificationHandler` עם shouldShowAlert: true
  - cleanup listeners ב-useEffect cleanup"

---

## שלב 15 — Client — Screens

### 15.1 — Auth Screens

- [ ] **15.1.1** — **תן ל-AI לבצע:** "צור `src/screens/auth/LoginScreen.tsx`.

  **UI (כמו ב-wireframe):**
  - Header עם gradient כחול, logo 'PB' בעיגול, כותרת 'PulseBoard'
  - Card לבן עגול עם shadow
  - Email input + Password input (עם show/hide)
  - כפתור 'Sign In' בכחול עם loading spinner
  - קישור 'Create account' לRegistration

  **Logic:**
  - Zod validation לפני submit
  - authStore.login() → navigate to Main
  - הצג error inline (לא alert)
  - KeyboardAvoidingView
  - Disable button בזמן loading"

- [ ] **15.1.2** — **תן ל-AI לבצע:** "צור `src/screens/auth/RegisterScreen.tsx`.
  - שדות: Name, Email, Password, Confirm Password
  - Password strength indicator (Weak / Medium / Strong)
  - Zod validation: confirm === password
  - authStore.register() → navigate to Main"

### 15.2 — Feed Screen

- [ ] **15.2.1** — **תן ל-AI לבצע:** "צור `src/screens/main/FeedScreen.tsx`.

  **Sections:**
  1. Stats row: 2 cards — Active Tasks (count TODO+DOING), Completed Today (count DONE today)
  2. Online presence strip: avatars של users שonline, green dot indicator
  3. Activity Feed: FlatList של ActivityLog items מ-useActivityFeed()
     - כל item: avatar + name + action text + badge של status + timestamp
     - onEndReached: אין infinite scroll כאן — Firestore מנהל את זה
     - 'LIVE' indicator badge כשיש connection

  **חשוב:** השתמש ב-React.memo ל-ActivityItem component"

### 15.3 — Tasks Screen

- [ ] **15.3.1** — **תן ל-AI לבצע:** "צור `src/screens/main/TasksScreen.tsx`.

  **Layout:**
  - Filter chips בראש: All / Mine / High Priority
  - Kanban: 3 עמודות (TODO / DOING / DONE) עם ScrollView אופקי
  - כל עמודה: header עם count + FlatList של task cards
  - TaskCard: priority badge, task ID, title (truncated), assignee avatar
  - Swipe gesture על card (react-native-gesture-handler): left swipe = next status
  - FAB button: '+' לפתיחת TaskFormScreen

  **Performance:** React.memo על TaskCard, useCallback על handlers"

### 15.4 — Task Detail Screen

- [ ] **15.4.1** — **תן ל-AI לבצע:** "צור `src/screens/main/TaskDetailScreen.tsx`.

  **Sections:**
  1. Header: back arrow + task title + Edit button
  2. Badges: Status + Priority + tags
  3. Meta: Assignee, Created date, Due date
  4. Description (expandable אם ארוכה)
  5. Status change chips: TODO / DOING / DONE (active = highlighted)
  6. Chat section:
     - FlatList של messages (מ-useTask)
     - useSocket: join room on mount, leave on unmount
     - real-time messages מתווספים לlist
     - Typing indicator
  7. Input bar בתחתית עם Send button

  **על join room:**
  ```typescript
  useEffect(() => {
    socketService.joinTaskRoom(taskId);
    return () => socketService.leaveTaskRoom(taskId);
  }, [taskId]);
  ```"

### 15.5 — Task Form Screen

- [ ] **15.5.1** — **תן ל-AI לבצע:** "צור `src/screens/main/TaskFormScreen.tsx` — Modal/Bottom Sheet.

  - mode: create (ללא taskId) או edit (עם taskId)
  - שדות: Title*, Description, Priority (chips), Assignee (dropdown), Due Date (DatePicker)
  - Zod validation לפני submit
  - useCreateTask() או useUpdateTask()
  - Optimistic update visible immediately
  - KeyboardAvoidingView + ScrollView"

### 15.6 — Team Screen

- [ ] **15.6.1** — **תן ל-AI לבצע:** "צור `src/screens/main/TeamScreen.tsx`.

  - פתח GET /users ← מחזיר users עם online status מRedis
  - 2 sections: Online Now (green dot) ו-Offline (gray dot)
  - כל user card: avatar, name, role, current task (אם online), last seen (אם offline)"

### ✅ Checkpoint 15 — All Screens
```bash
npx expo start
# בדוק כל מסך ידנית
# Login → Register → Dashboard → Tasks → Task Detail → Create Task → Team
```

---

## שלב 16 — App Entry Point + Provider Setup

- [ ] **16.1** — **תן ל-AI לבצע:** "עדכן `App.tsx` ל-wrapper מלא:

  ```tsx
  export default function App() {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <RootNavigator />
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }
  ```

  הגדר QueryClient עם:
  - defaultOptions.queries: staleTime 5min, retry 2, retryDelay exponential backoff
  - defaultOptions.mutations: retry 0"

- [ ] **16.2** — **תן ל-AI לבצע:** "ב-RootNavigator, הוסף `usePushNotifications()` hook call כדי לאתחל את FCM token ב-App startup"

---

## שלב 17 — Docker — Production Build

### 17.1 — Server Dockerfile

- [ ] **17.1.1** — **תן ל-AI לבצע:** "צור `server/Dockerfile` — multi-stage build:

  **Stage 1 (deps):** node:20-alpine, WORKDIR /app, COPY package*.json, RUN npm ci --only=production
  **Stage 2 (build):** FROM node:20-alpine, COPY package*.json, RUN npm ci (dev deps), COPY . ., RUN npx prisma generate, RUN npm run build
  **Stage 3 (prod):** FROM node:20-alpine, ENV NODE_ENV=production, COPY --from=deps node_modules, COPY --from=build dist/, COPY --from=build prisma/, EXPOSE 4000, CMD node dist/index.js"

- [ ] **17.1.2** — צור `server/.dockerignore`:
  ```
  node_modules
  dist
  .env
  *.log
  coverage
  __tests__
  ```

- [ ] **17.1.3** — עדכן `docker-compose.yml` — הוסף api service:
  ```yaml
  api:
    build:
      context: ./server
      dockerfile: Dockerfile
    container_name: pulseboard_api
    restart: unless-stopped
    env_file: .env
    ports:
      - '4000:4000'
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/pulseboard
      REDIS_URL: redis://redis:6379
  ```

### ✅ Checkpoint 17 — Docker Full Stack
```bash
docker-compose up --build
# כל שלושת הservices עולים
# curl http://localhost:4000/health
```

---

## שלב 18 — Tests & Final Polish

### 18.1 — Run All Tests

- [ ] **18.1.1** — הרץ כל tests:
  ```bash
  cd server && npm test
  # target: 0 failures
  ```

### 18.2 — Interview Polish

- [ ] **18.2.1** — **תן ל-AI לבצע:** "הוסף `src/utils/asyncHandler.ts` ל-server — ודא שכל route handler עטוף בו"

- [ ] **18.2.2** — **תן ל-AI לבצע:** "ב-server/src/index.ts הוסף request logging middleware: log כל request עם method, path, status code, duration בmilliseconds (אחרי response)"

- [ ] **18.2.3** — **תן ל-AI לבצע:** "ב-client, הוסף Error Boundary component שmatch כל crash ומציג מסך 'Something went wrong' עם כפתור Retry"

- [ ] **18.2.4** — **תן ל-AI לבצע:** "ב-client, הוסף offline detection: NetInfo מ-@react-native-community/netinfo. הצג banner 'No internet connection' כשoffline"

### 18.3 — README

- [ ] **18.3.1** — **תן ל-AI לבצע:** "צור `README.md` בroot של הפרויקט עם:
  - תיאור קצר של האפליקציה
  - Tech stack עם badges
  - Getting Started (prerequisites + docker-compose up + expo start)
  - Architecture overview קצר
  - Key technical decisions (למה Zustand, למה Redis Pub/Sub, token rotation)"

---

## Summary — Interview Talking Points

לאחר השלמת הפרויקט, אלה הנושאים שכדאי לדעת להסביר:

| נושא | מה להסביר |
|------|-----------|
| Redis | Cache-aside pattern, TTL strategy, Pub/Sub decoupling, SCAN vs KEYS |
| JWT | Access vs Refresh token, rotation on every use, Redis session invalidation |
| React Query | Server state vs UI state, optimistic updates, stale-while-revalidate |
| Socket.io | Redis adapter for horizontal scaling, room-based messaging |
| Prisma | Type-safe ORM, migration workflow, relation handling |
| Firestore | When to use vs PostgreSQL, onSnapshot listeners, offline support |
| TypeScript | Strict mode, Express type augmentation, generic hooks |
| Docker | Multi-stage build, health checks, service dependencies |

---

*PulseBoard — Senior React Native Portfolio Project*
