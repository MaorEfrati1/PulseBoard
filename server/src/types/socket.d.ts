import { Socket } from 'socket.io';

// ─── Augment Socket with auth fields ─────────────────────────────────────────
// Attached by the auth middleware in socket.manager.ts after JWT + session verify.

declare module 'socket.io' {
  interface Socket {
    userId: string;
    role: string;
    userName: string;
  }
}
