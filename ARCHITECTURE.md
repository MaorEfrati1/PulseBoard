# PulseBoard — Architecture Document

> Real-Time Team Activity Dashboard  
> Senior React Native Portfolio Project

---

## Table of Contents

1. [Overview](#1-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [System Architecture Diagram](#4-system-architecture-diagram)
5. [Data Flow](#5-data-flow)
6. [Database Schema](#6-database-schema)
7. [API Design](#7-api-design)
8. [Authentication & Security](#8-authentication--security)
9. [Redis — Cache, Sessions, Pub/Sub](#9-redis--cache-sessions-pubsub)
10. [Real-Time Layer](#10-real-time-layer)
11. [Firebase Integration](#11-firebase-integration)
12. [State Management (Client)](#12-state-management-client)
13. [Error Handling Strategy](#13-error-handling-strategy)
14. [Performance Patterns](#14-performance-patterns)
15. [Testing Strategy](#15-testing-strategy)
16. [Environment Variables](#16-environment-variables)

---

## 1. Overview

**PulseBoard** is a real-time team activity dashboard built as a mobile-first application.  
It solves the problem of fragmented visibility — teams use Jira, Slack, GitHub all separately.  
PulseBoard brings a unified, live feed of everything happening in the team.

### Core Capabilities

| Capability | Technology |
|---|---|
| Live activity feed | Firebase Firestore (onSnapshot) |
| Real-time chat per task | Socket.io + Redis Pub/Sub |
| Team presence (who's online) | Socket.io rooms |
| Push notifications | Firebase FCM |
| Task CRUD with optimistic UI | React Query mutations |
| Auth with token rotation | JWT + Redis sessions |

### Why This Stack for Interviews

- **Zustand** — shows understanding of lightweight state management vs Redux overhead
- **React Query** — demonstrates server state vs UI state separation
- **Redis Pub/Sub** — decoupled event-driven architecture (not just a cache)
- **JWT Rotation** — security awareness (refresh token rotation on every use)
- **Optimistic updates** — UX-first thinking, not just happy-path coding
- **Socket.io + Redis adapter** — horizontal scaling awareness

---

## 2. Tech Stack

### Client (Mobile)

```
React Native 0.73+        → Cross-platform iOS / Android
Expo SDK 50               → Build toolchain, EAS, native APIs
TypeScript 5.3            → Strict mode enabled
React Navigation v6       → Stack + Bottom Tabs + Modal
Zustand 4.x               → UI state (auth, online status, UI flags)
@tanstack/react-query v5  → Server state, caching, optimistic updates
Axios                     → HTTP client with interceptors
Socket.io-client          → WebSocket connection
Firebase JS SDK v10       → Firestore real-time listeners
Expo Notifications        → Push notification handling
Zod                       → Client-side validation
AsyncStorage              → Persisted auth tokens
react-native-gesture-handler → Swipe gestures on task cards
```

### Server (API)

```
Node.js 20 LTS            → Runtime
Express 4.x               → HTTP framework
TypeScript 5.3            → Strict mode
Prisma 5.x                → ORM + migrations
Socket.io 4.x             → WebSocket server
@socket.io/redis-adapter  → Horizontal scaling
ioredis                   → Redis client
firebase-admin            → Firestore + FCM server SDK
jsonwebtoken              → JWT sign/verify
bcryptjs                  → Password hashing (cost: 12)
zod                       → Request validation
winston                   → Structured logging
helmet                    → Security headers
cors                      → CORS policy
compression               → Gzip responses
express-rate-limit        → Rate limiting
```

### Infrastructure

```
PostgreSQL 16             → Primary relational database
Redis 7                   → Cache + sessions + pub/sub + queues
Firebase Firestore        → Real-time activity feed
Firebase FCM              → Push notifications
Firebase Storage          → User avatar uploads
Docker + Docker Compose   → Local development environment
```

---

## 3. Project Structure

```
pulseboard/
│
├── server/                          # Node.js + Express API
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.ts          # Prisma client singleton
│   │   │   ├── redis.ts             # RedisService class
│   │   │   └── firebase.ts          # Firebase Admin + service classes
│   │   │
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts   # JWT verify + Redis session lookup
│   │   │   ├── error.middleware.ts  # Global error handler
│   │   │   ├── validate.middleware.ts # Zod schema validation
│   │   │   └── rateLimiter.ts       # Redis-backed rate limiter
│   │   │
│   │   ├── routes/
│   │   │   ├── auth.routes.ts       # /api/auth/*
│   │   │   ├── user.routes.ts       # /api/users/*
│   │   │   ├── task.routes.ts       # /api/tasks/*
│   │   │   └── activity.routes.ts   # /api/activity/*
│   │   │
│   │   ├── controllers/
│   │   │   ├── auth.controller.ts
│   │   │   ├── task.controller.ts
│   │   │   ├── user.controller.ts
│   │   │   └── activity.controller.ts
│   │   │
│   │   ├── services/
│   │   │   ├── auth.service.ts      # Business logic: register/login/refresh/logout
│   │   │   ├── task.service.ts      # CRUD + activity log writes
│   │   │   ├── user.service.ts      # Profile management
│   │   │   ├── notification.service.ts # FCM push logic
│   │   │   └── activity.service.ts  # Feed queries
│   │   │
│   │   ├── sockets/
│   │   │   ├── socket.manager.ts    # Socket.io init + Redis adapter
│   │   │   └── handlers/
│   │   │       ├── chat.handler.ts
│   │   │       ├── presence.handler.ts
│   │   │       └── task.handler.ts
│   │   │
│   │   ├── types/
│   │   │   ├── express.d.ts         # req.user type augmentation
│   │   │   └── index.ts             # Shared interfaces
│   │   │
│   │   └── utils/
│   │       ├── logger.ts            # Winston logger
│   │       ├── errors.ts            # AppError class
│   │       └── asyncHandler.ts      # Express async wrapper
│   │
│   ├── prisma/
│   │   ├── schema.prisma            # DB models
│   │   └── migrations/              # Auto-generated migration files
│   │
│   ├── __tests__/
│   │   ├── auth.test.ts
│   │   ├── tasks.test.ts
│   │   └── redis.service.test.ts
│   │
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── tsconfig.json
│   └── package.json
│
├── client/                          # React Native + Expo
│   ├── src/
│   │   ├── api/
│   │   │   ├── axios.ts             # Axios instance + interceptors
│   │   │   ├── auth.api.ts
│   │   │   ├── tasks.api.ts
│   │   │   └── activity.api.ts
│   │   │
│   │   ├── store/
│   │   │   ├── auth.store.ts        # Zustand: user, tokens (persisted)
│   │   │   └── ui.store.ts          # Zustand: online status, unread count
│   │   │
│   │   ├── hooks/
│   │   │   ├── useTasks.ts          # React Query: useInfiniteTasks, useTask, mutations
│   │   │   ├── useActivity.ts       # Firestore onSnapshot listener
│   │   │   ├── useSocket.ts         # Socket.io hook: connect, events
│   │   │   └── usePushNotifications.ts # FCM token + listeners
│   │   │
│   │   ├── navigation/
│   │   │   ├── RootNavigator.tsx    # Auth/App stack switch
│   │   │   ├── MainTabs.tsx         # Bottom tab navigator
│   │   │   └── types.ts             # Navigation param types
│   │   │
│   │   ├── screens/
│   │   │   ├── auth/
│   │   │   │   ├── LoginScreen.tsx
│   │   │   │   └── RegisterScreen.tsx
│   │   │   └── main/
│   │   │       ├── FeedScreen.tsx
│   │   │       ├── TasksScreen.tsx
│   │   │       ├── TaskDetailScreen.tsx
│   │   │       ├── TaskFormScreen.tsx
│   │   │       ├── TeamScreen.tsx
│   │   │       └── ProfileScreen.tsx
│   │   │
│   │   ├── components/
│   │   │   ├── common/
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Input.tsx
│   │   │   │   ├── Avatar.tsx
│   │   │   │   ├── Badge.tsx
│   │   │   │   └── LoadingSpinner.tsx
│   │   │   ├── feed/
│   │   │   │   └── ActivityItem.tsx
│   │   │   ├── tasks/
│   │   │   │   ├── TaskCard.tsx
│   │   │   │   └── KanbanColumn.tsx
│   │   │   └── chat/
│   │   │       └── MessageBubble.tsx
│   │   │
│   │   └── types/
│   │       └── index.ts             # Shared TS interfaces (Task, User, Message...)
│   │
│   ├── app.json
│   └── package.json
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 4. System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     React Native Client                         │
│                                                                 │
│  ┌──────────────┐  ┌────────────────┐  ┌────────────────────┐  │
│  │   Zustand    │  │  React Query   │  │  React Navigation  │  │
│  │  Auth Store  │  │ Server Cache   │  │  Stack + Tabs      │  │
│  │   UI Store   │  │  Optimistic    │  │                    │  │
│  └──────────────┘  └────────────────┘  └────────────────────┘  │
│                                                                 │
│  ┌──────────────┐  ┌────────────────┐  ┌────────────────────┐  │
│  │    Axios     │  │  Socket.io     │  │  Firebase SDK      │  │
│  │ Interceptors │  │   Client       │  │  onSnapshot        │  │
│  └──────┬───────┘  └───────┬────────┘  └─────────┬──────────┘  │
└─────────┼──────────────────┼────────────────────┼──────────────┘
          │ REST             │ WebSocket           │ Firestore
          │ HTTPS            │ WSS                 │ HTTPS
          ▼                  ▼                     ▼
┌─────────────────────────┐   ┌──────────────────────────────────┐
│  Node.js / Express API  │   │          Firebase Cloud          │
│                         │   │                                  │
│  ┌───────────────────┐  │   │  ┌──────────────┐  ┌─────────┐  │
│  │  Auth Middleware  │  │   │  │  Firestore   │  │   FCM   │  │
│  │  JWT + Redis      │  │   │  │  activity_   │  │  Push   │  │
│  │  session check    │  │   │  │  feed (RT)   │  │  Notif  │  │
│  └───────────────────┘  │   │  └──────────────┘  └─────────┘  │
│                         │   │  ┌──────────────┐               │
│  ┌───────────────────┐  │   │  │   Storage    │               │
│  │  Rate Limiter     │  │   │  │  (avatars)   │               │
│  │  Redis-backed     │  │   │  └──────────────┘               │
│  └───────────────────┘  │   └──────────────────────────────────┘
│                         │
│  ┌───────────────────┐  │
│  │    Socket.io      │  │
│  │  Redis Adapter    │  │   ← Enables horizontal scaling
│  └───────────────────┘  │
│                         │
└───────┬──────────┬───────┘
        │          │
        ▼          ▼
┌──────────┐  ┌────────────────────────────────┐
│PostgreSQL│  │              Redis              │
│          │  │                                │
│  Users   │  │  session:{userId}  → User data │
│  Tasks   │  │  ratelimit:{key}   → Counter   │
│  Messages│  │  cache:tasks:*     → JSON      │
│  Activity│  │  channel:task:upd  → Pub/Sub   │
│  Sessions│  │  queue:notifications→ List     │
└──────────┘  └────────────────────────────────┘
```

---

## 5. Data Flow

### Flow 1 — User Updates Task Status

```
1.  User taps "DOING" status chip on TaskDetailScreen
2.  useUpdateTask() mutation fires (React Query)
3.  Optimistic update: React Query cache updated immediately
    → UI shows new status instantly (no loading state)
4.  PATCH /api/tasks/:id → Express API
5.  Auth middleware: reads Bearer token → verify JWT
    → Redis GET session:{userId} → user data (no DB hit)
6.  Zod validates request body
7.  task.service.updateTask():
    → Prisma: UPDATE tasks SET status = 'DOING'
    → Prisma: INSERT INTO activity_logs (task.updated, metadata)
8.  Redis PUBLISH 'channel:task:updated' { taskId, status, userId }
9.  Firebase Firestore: setDocument('activity_feed/{id}', event)
    → All clients with onSnapshot listener receive update instantly
10. Redis subscriber in API picks up Pub/Sub message
    → Socket.io emit to room 'task:{taskId}' → all viewers updated
11. FCM: if task has assignee → send push notification
12. API returns 200 { task }
13. React Query onSettled: invalidate task queries → background refetch
```

### Flow 2 — Real-Time Chat Message

```
1.  User types in chat input, taps Send
2.  useSocket.sendMessage(taskId, content)
3.  Socket.io emit: 'message:send' { taskId, content }
4.  Server chat.handler.ts:
    → Saves to PostgreSQL via Prisma
    → Redis PUBLISH 'chat:{taskId}' { message }
    → Socket.io emit to room 'task:{taskId}' → 'message:receive'
5.  All users in that task's room receive the message instantly
6.  FCM push notification to users who have task open (background)
```

### Flow 3 — Token Refresh (Silent)

```
1.  API returns 401 (access token expired)
2.  Axios response interceptor catches 401
3.  isRefreshing flag set (prevents parallel refresh calls)
4.  Failed requests queued in failedQueue[]
5.  POST /api/auth/refresh { refreshToken }
6.  Server: verify refresh token JWT
    → Prisma: find session by refreshToken
    → Generate new access + refresh token pair
    → Prisma: DELETE old session, CREATE new session (rotation)
    → Redis: UPDATE session:{userId}
7.  New tokens saved to Zustand + AsyncStorage
8.  Queued requests replayed with new token
9.  If refresh also fails → logout() → navigate to Login
```

---

## 6. Database Schema

```prisma
// prisma/schema.prisma

model User {
  id           String    @id @default(uuid())
  email        String    @unique
  passwordHash String    @map("password_hash")
  name         String
  avatarUrl    String?   @map("avatar_url")
  role         Role      @default(USER)
  fcmToken     String?   @map("fcm_token")      // Firebase push token
  isActive     Boolean   @default(true)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  sessions         Session[]
  authoredTasks    Task[]    @relation("AuthoredTasks")
  assignedTasks    Task[]    @relation("AssignedTasks")
  sentMessages     Message[]
  activityLogs     ActivityLog[]

  @@map("users")
  @@index([email])
}

model Session {
  id           String   @id @default(uuid())
  userId       String   @map("user_id")
  refreshToken String   @unique @map("refresh_token")
  deviceInfo   String?  @map("device_info")
  expiresAt    DateTime @map("expires_at")
  createdAt    DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("sessions")
  @@index([userId])
}

model Task {
  id          String     @id @default(uuid())
  title       String
  description String?
  status      TaskStatus @default(TODO)
  priority    Priority   @default(MEDIUM)
  authorId    String     @map("author_id")
  assigneeId  String?    @map("assignee_id")
  dueDate     DateTime?  @map("due_date")
  tags        String[]   @default([])
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  author   User  @relation("AuthoredTasks",  fields: [authorId],   references: [id])
  assignee User? @relation("AssignedTasks",  fields: [assigneeId], references: [id])
  messages Message[]
  logs     ActivityLog[]

  @@map("tasks")
  @@index([authorId])
  @@index([assigneeId])
  @@index([status])
  @@index([createdAt])
}

model Message {
  id        String   @id @default(uuid())
  taskId    String   @map("task_id")
  senderId  String   @map("sender_id")
  content   String
  createdAt DateTime @default(now())

  task   Task @relation(fields: [taskId],   references: [id], onDelete: Cascade)
  sender User @relation(fields: [senderId], references: [id])

  @@map("messages")
  @@index([taskId])
  @@index([createdAt])
}

model ActivityLog {
  id         String   @id @default(uuid())
  userId     String   @map("user_id")
  action     String                           // "task.created" | "task.updated" | ...
  entityId   String   @map("entity_id")       // taskId
  entityType String   @map("entity_type")     // "task"
  metadata   Json     @default("{}")
  createdAt  DateTime @default(now())

  user User  @relation(fields: [userId], references: [id])
  task Task? @relation(fields: [entityId], references: [id])

  @@map("activity_logs")
  @@index([userId])
  @@index([createdAt])
}

enum TaskStatus { TODO DOING DONE }
enum Priority  { LOW MEDIUM HIGH }
enum Role      { USER ADMIN }
```

---

## 7. API Design

### Base URL: `/api/v1`

### Auth Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /auth/register | ✗ | Register + return token pair |
| POST | /auth/login | ✗ | Login + return token pair |
| POST | /auth/refresh | ✗ | Rotate refresh token |
| POST | /auth/logout | ✓ | Delete session from Redis + DB |

### User Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /users/me | ✓ | Get own profile |
| PATCH | /users/me | ✓ | Update name / avatar / fcmToken |
| GET | /users | ✓ | List team members (with online status from Redis) |

### Task Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /tasks | ✓ | List with filters + pagination |
| POST | /tasks | ✓ | Create task |
| GET | /tasks/:id | ✓ | Task detail + messages |
| PATCH | /tasks/:id | ✓ | Update task (partial update) |
| DELETE | /tasks/:id | ✓ | Delete task |
| GET | /tasks/:id/messages | ✓ | Chat messages (paginated) |
| POST | /tasks/:id/messages | ✓ | Send message |

### Activity Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /activity | ✓ | Paginated activity log feed |

### Standard Response Format

```typescript
// Success
{
  "status": "success",
  "data": { ... },
  "meta": { "page": 1, "limit": 20, "total": 142 }  // for lists
}

// Error
{
  "status": "error",
  "message": "Invalid credentials",
  "errors": [{ "field": "email", "message": "Invalid email" }]  // Zod errors
}
```

---

## 8. Authentication & Security

### JWT Strategy

```
Access Token:
  - Expires: 15 minutes
  - Contains: { userId, role, iat, exp }
  - Verified on every request by auth middleware
  - NOT stored in Redis — stateless

Refresh Token:
  - Expires: 7 days
  - Stored in: PostgreSQL sessions table + Redis session:{userId}
  - ROTATED on every use (old token invalidated, new one issued)
  - Stored on client: AsyncStorage (Expo SecureStore recommended for prod)
```

### Auth Middleware Flow

```typescript
// Every protected request:
1. Extract Bearer token from Authorization header
2. jwt.verify(token, ACCESS_SECRET) → payload or throw 401
3. Redis GET session:{userId} → session data or throw 401
   (Redis miss = user logged out from another device)
4. Attach req.user = { userId, role, email }
5. Continue to route handler
```

### Security Checklist

- ✅ `helmet()` — sets 11 security headers (X-Frame-Options, CSP, etc.)
- ✅ `cors` — whitelist origins only
- ✅ Rate limiting — 100 req / 15 min per IP (Redis counter)
- ✅ Password hashing — bcrypt cost factor 12
- ✅ JWT rotation — every refresh issues new pair
- ✅ Session invalidation — logout deletes from Redis + DB
- ✅ Zod validation — all inputs validated before controllers
- ✅ `compression` — gzip all responses
- ✅ No sensitive data in logs — passwords, tokens sanitized
- ✅ Environment variables — never hardcoded secrets

---

## 9. Redis — Cache, Sessions, Pub/Sub

### Key Naming Convention

```
session:{userId}            → User session data           TTL: 7d
ratelimit:{userId}:{window} → Rate limit counter          TTL: window
cache:tasks:{userId}        → Tasks list cache            TTL: 5m
cache:task:{taskId}         → Single task cache           TTL: 2m
online:{userId}             → Online presence flag        TTL: 30s (heartbeat)
queue:notifications         → FCM send queue              No TTL
```

### Cache-Aside Pattern

```typescript
// GET /tasks — Cache-aside implementation
async getTasks(userId: string, filters: TaskFilters) {
  const cacheKey = `cache:tasks:${userId}:${JSON.stringify(filters)}`;

  // 1. Try cache
  const cached = await redis.get<Task[]>(cacheKey);
  if (cached) return cached;

  // 2. Miss → query DB
  const tasks = await prisma.task.findMany({ where: buildWhere(filters) });

  // 3. Populate cache
  await redis.set(cacheKey, tasks, 300); // 5 min TTL
  return tasks;
}

// On task update → invalidate
await redis.invalidatePattern(`cache:tasks:*`);
```

### Pub/Sub for Event-Driven Updates

```
Publisher (task.service.ts):
  PUBLISH 'channel:task:updated' → JSON payload

Subscriber (socket.manager.ts):
  SUBSCRIBE 'channel:task:updated'
  → Socket.io emit to room 'task:{taskId}'
  → All connected clients receive update

Why Pub/Sub instead of direct emit?
  → Decoupling: services don't know about sockets
  → Scalability: works across multiple Node.js instances
  → Testability: services can be tested without Socket.io
```

---

## 10. Real-Time Layer

### Socket.io Events

```typescript
// Client → Server
'message:send'        { taskId, content }
'room:join'           { taskId }
'room:leave'          { taskId }
'typing:start'        { taskId }
'typing:stop'         { taskId }
'presence:heartbeat'  {}

// Server → Client
'message:receive'     { id, senderId, content, createdAt, senderName }
'task:updated'        { taskId, changes, updatedBy }
'typing:update'       { taskId, userId, typing: boolean }
'presence:update'     { userId, online: boolean }
'error'               { message }
```

### Presence System

```typescript
// On connect:
await redis.set(`online:${userId}`, '1', 30);  // 30s TTL
io.emit('presence:update', { userId, online: true });

// Heartbeat every 20s from client:
socket.on('presence:heartbeat', async () => {
  await redis.set(`online:${userId}`, '1', 30);  // Reset TTL
});

// On disconnect:
await redis.del(`online:${userId}`);
io.emit('presence:update', { userId, online: false });
```

---

## 11. Firebase Integration

### Firestore — Activity Feed

```
Collection: activity_feed
Document:   {auto-id}
Fields:
  userId     string
  userName   string
  action     string   "task.created" | "task.updated" | "task.completed"
  taskId     string
  taskTitle  string
  metadata   map
  createdAt  timestamp

Client listener (useActivity.ts):
  firestore
    .collection('activity_feed')
    .orderBy('createdAt', 'desc')
    .limit(50)
    .onSnapshot(snapshot => { ... })

Why Firestore for this and not Socket.io?
  → Persisted — user can see history when they open the app
  → Offline support — Firestore caches locally
  → No server needed — direct client-to-Firestore
```

### FCM Push Notifications

```typescript
// Trigger points:
- Task assigned to user         → notify assignee
- Comment on task you're in     → notify all participants
- Task status changed           → notify author + assignee
- Mention in comment (@name)    → notify mentioned user
```

---

## 12. State Management (Client)

### Rule: Server State vs UI State

```
Zustand (UI state — never re-fetched from server):
  - auth: user object, accessToken, refreshToken
  - ui: activeTaskId, unreadCount, isConnected

React Query (server state — fetched, cached, synced):
  - tasks list, task detail, activity feed, team members
  - Automatic background refetch, stale-while-revalidate
  - Optimistic updates for mutations

Never duplicate: if data comes from API → it lives in React Query, not Zustand
```

### Optimistic Update Pattern

```typescript
useMutation({
  mutationFn: updateTask,
  onMutate: async (vars) => {
    // 1. Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: taskKeys.detail(vars.id) });
    // 2. Snapshot old value
    const snapshot = queryClient.getQueryData(taskKeys.detail(vars.id));
    // 3. Apply optimistic change
    queryClient.setQueryData(taskKeys.detail(vars.id), (old) => ({
      ...old, ...vars.changes
    }));
    return { snapshot };
  },
  onError: (_err, _vars, ctx) => {
    // 4. Rollback on error
    queryClient.setQueryData(taskKeys.detail(vars.id), ctx.snapshot);
  },
  onSettled: () => {
    // 5. Always refetch to sync with server
    queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
  },
})
```

---

## 13. Error Handling Strategy

### Server

```typescript
// 3 tiers of errors:

1. Operational errors (AppError) — expected, safe to surface to client
   → 400/401/403/404/409/429
   → logged at 'warn' level

2. Zod validation errors — invalid input
   → 400 with field-level details
   → not logged (noise)

3. Programming errors — unexpected, never surface details to client
   → 500 "Internal server error"
   → logged at 'error' level with full stack trace
   → trigger alerting in production
```

### Client

```typescript
// Axios interceptor handles:
- 401 → attempt silent token refresh → replay request
- 429 → show rate limit toast
- 5xx → show "Something went wrong" toast + retry option
- Network error → show offline banner

// React Query handles:
- retry: 2 (auto-retry on network errors)
- Error boundary for critical failures
```

---

## 14. Performance Patterns

| Pattern | Implementation |
|---------|---------------|
| Memoized list items | `React.memo(TaskCard)` + `useCallback` for handlers |
| Infinite scroll | `useInfiniteQuery` + `onEndReached` on FlatList |
| Image caching | `expo-image` (built-in disk + memory cache) |
| Response compression | `compression` middleware (gzip) |
| DB query optimization | Prisma `select` — never `findMany` without field selection |
| DB indexes | All FK columns + status + createdAt indexed |
| Redis cache | GET /tasks cached 5 min, single task 2 min |
| Code splitting | React Navigation lazy loads screens |
| Bundle size | No lodash — native JS methods only |

---

## 15. Testing Strategy

### Server Tests

```
Unit tests:
  - auth.service.test.ts  → mock Prisma + Redis
  - redis.service.test.ts → mock ioredis
  - task.service.test.ts  → mock Prisma

Integration tests (Supertest):
  - auth.test.ts          → full HTTP cycle, real DB (test schema)
  - tasks.test.ts         → CRUD with auth header

Coverage target: 80%+ for services and routes
```

### Client Tests

```
Unit tests (Jest + React Testing Library):
  - auth.store.test.ts    → Zustand store actions
  - useTasks.test.ts      → React Query hooks (msw mock)

E2E (Detox — optional for portfolio):
  - login.e2e.ts
  - create-task.e2e.ts
```

---

## 16. Environment Variables

```bash
# ── Server ──────────────────────────────
PORT=4000
NODE_ENV=development
LOG_LEVEL=info

# ── PostgreSQL ──────────────────────────
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pulseboard

# ── Redis ───────────────────────────────
REDIS_URL=redis://localhost:6379

# ── JWT ─────────────────────────────────
JWT_ACCESS_SECRET=change-this-to-64-char-random-string
JWT_REFRESH_SECRET=change-this-to-different-64-char-string
# Generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# ── Firebase Admin (paste entire JSON as one line) ──
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"..."}
FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com

# ── CORS ────────────────────────────────
CLIENT_URL=http://localhost:8081

# ── Client (Expo) ───────────────────────
EXPO_PUBLIC_API_URL=http://localhost:4000/api/v1
EXPO_PUBLIC_WS_URL=ws://localhost:4000
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
```

---

*PulseBoard — Senior React Native Portfolio Project*  
*Stack: React Native • Node.js • PostgreSQL • Redis • Firebase*
