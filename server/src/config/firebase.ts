import * as admin from "firebase-admin";

// ─── Initialization ──────────────────────────────────────────────────────────

function initializeFirebase(): void {
  if (admin.apps.length > 0) return;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (!serviceAccountJson) {
    console.warn(
      "[Firebase] WARNING: FIREBASE_SERVICE_ACCOUNT_JSON is not set. " +
      "Firebase services will be unavailable."
    );
    return;
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountJson);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (err) {
    console.warn(
      "[Firebase] WARNING: Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON.",
      err
    );
  }
}

initializeFirebase();

// ─── Raw Clients ─────────────────────────────────────────────────────────────

function getFirestore(): admin.firestore.Firestore | null {
  if (!admin.apps.length) return null;
  return admin.firestore();
}

function getMessaging(): admin.messaging.Messaging | null {
  if (!admin.apps.length) return null;
  return admin.messaging();
}

function getStorage(): admin.storage.Storage | null {
  if (!admin.apps.length) return null;
  return admin.storage();
}

export const firestore: admin.firestore.Firestore | null = getFirestore();
// Explicit type annotation prevents ts(2883) — TypeScript cannot name the
// inferred type of Messaging without a direct import of the internal module.
export const fcm: admin.messaging.Messaging | null = getMessaging();
export const storage: admin.storage.Storage | null = getStorage();

// ─── Activity Feed Interface ──────────────────────────────────────────────────

export interface ActivityEntry {
  userId: string;
  userName: string;
  action: string;
  taskId: string;
  taskTitle: string;
  metadata: Record<string, unknown>;
  createdAt: FirebaseFirestore.FieldValue;
}

// ─── FirestoreService ─────────────────────────────────────────────────────────

class FirestoreService {
  private readonly ACTIVITY_FEED_COLLECTION = "activity_feed";

  /**
   * Writes an activity entry to the Firestore `activity_feed` collection.
   * Silently no-ops if Firestore is unavailable (missing credentials).
   */
  async addActivity(
    params: Omit<ActivityEntry, "createdAt">
  ): Promise<void> {
    if (!firestore) {
      console.warn(
        "[FirestoreService] Firestore unavailable — skipping addActivity."
      );
      return;
    }

    const entry: ActivityEntry = {
      ...params,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await firestore.collection(this.ACTIVITY_FEED_COLLECTION).add(entry);
  }

  /**
   * Verifies Firestore connectivity by attempting a lightweight document read.
   * Throws if the connection fails — does NOT throw if the doc simply
   * doesn't exist (that is expected and perfectly fine).
   *
   * Called by HealthService.getHealthReport().
   */
  async healthCheck(): Promise<void> {
    if (!firestore) {
      throw new Error("Firestore client is not initialized");
    }
    // A get() on a non-existent doc succeeds (exists = false).
    // It will only throw on auth / network failures — exactly what we need.
    await firestore.collection("_health").doc("ping").get();
  }
}

export const firestoreService = new FirestoreService();
