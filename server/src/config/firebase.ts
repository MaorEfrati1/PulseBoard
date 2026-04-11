import * as admin from "firebase-admin";
import type { BatchResponse } from "firebase-admin/messaging";

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

// ─── Exports ─────────────────────────────────────────────────────────────────

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

export const firestore = getFirestore();
export const fcm = getMessaging();
export const storage = getStorage();

// ─── FirestoreService ─────────────────────────────────────────────────────────

export class FirestoreService {
  private db: admin.firestore.Firestore;

  constructor() {
    if (!firestore) {
      throw new Error(
        "[FirestoreService] Firestore is not initialized. " +
          "Check FIREBASE_SERVICE_ACCOUNT_JSON."
      );
    }
    this.db = firestore;
  }

  /**
   * Set (create or overwrite) a document. Pass `merge: true` to only update
   * the provided fields instead of replacing the whole document.
   */
  async setDocument(
    collection: string,
    docId: string,
    data: Record<string, unknown>,
    merge = false
  ): Promise<void> {
    await this.db.collection(collection).doc(docId).set(data, { merge });
  }

  /**
   * Retrieve a document by ID. Returns `null` if the document doesn't exist.
   */
  async getDocument<T>(
    collection: string,
    docId: string
  ): Promise<T | null> {
    const snap = await this.db.collection(collection).doc(docId).get();
    if (!snap.exists) return null;
    return snap.data() as T;
  }

  /**
   * Delete a document.
   */
  async deleteDocument(collection: string, docId: string): Promise<void> {
    await this.db.collection(collection).doc(docId).delete();
  }

  /**
   * Add a new document with an auto-generated ID.
   * Returns the new document ID.
   */
  async addDocument(
    collection: string,
    data: Record<string, unknown>
  ): Promise<string> {
    const ref = await this.db.collection(collection).add(data);
    return ref.id;
  }

  /**
   * Listen to real-time updates on a collection (or sub-collection path).
   * Optionally supply a `query` builder to filter / order results.
   * Returns an `unsubscribe` function — call it to stop listening.
   */
  listenToCollection(
    path: string,
    query?: (
      ref: admin.firestore.CollectionReference
    ) => admin.firestore.Query,
    callback?: (
      docs: Array<{ id: string; data: Record<string, unknown> }>
    ) => void
  ): () => void {
    const colRef = this.db.collection(path);
    const queryRef = query ? query(colRef) : colRef;

    const unsubscribe = queryRef.onSnapshot((snapshot) => {
      const docs = snapshot.docs.map((doc) => ({
        id: doc.id,
        data: doc.data() as Record<string, unknown>,
      }));
      callback?.(docs);
    });

    return unsubscribe;
  }
}

// ─── PushNotificationService ──────────────────────────────────────────────────

type Notification = { title?: string; body?: string };
type DataPayload = Record<string, string>;

export class PushNotificationService {
  private messaging: admin.messaging.Messaging;

  constructor() {
    if (!fcm) {
      throw new Error(
        "[PushNotificationService] Firebase Messaging is not initialized. " +
          "Check FIREBASE_SERVICE_ACCOUNT_JSON."
      );
    }
    this.messaging = fcm;
  }

  /**
   * Send a push notification to a single device.
   * Returns the FCM message ID.
   */
  async sendToDevice(
    fcmToken: string,
    notification: Notification,
    data?: DataPayload
  ): Promise<string> {
    const messageId = await this.messaging.send({
      token: fcmToken,
      notification,
      data,
    });
    return messageId;
  }

  /**
   * Send a push notification to a topic.
   * Returns the FCM message ID.
   */
  async sendToTopic(
    topic: string,
    notification: Notification,
    data?: DataPayload
  ): Promise<string> {
    const messageId = await this.messaging.send({
      topic,
      notification,
      data,
    });
    return messageId;
  }

  /**
   * Send a push notification to multiple devices at once (multicast).
   * Returns the full `BatchResponse` with per-token success / failure details.
   */
  async sendMulticast(
    tokens: string[],
    notification: Notification,
    data?: DataPayload
  ): Promise<BatchResponse> {
    const response = await this.messaging.sendEachForMulticast({
      tokens,
      notification,
      data,
    });
    return response;
  }

  /**
   * Subscribe a list of devices to a FCM topic.
   */
  async subscribeToTopic(tokens: string[], topic: string): Promise<void> {
    await this.messaging.subscribeToTopic(tokens, topic);
  }
}

// ─── Singletons ───────────────────────────────────────────────────────────────

let firestoreService: FirestoreService | null = null;
let pushService: PushNotificationService | null = null;

try {
  firestoreService = new FirestoreService();
} catch (err) {
  console.warn("[Firebase] FirestoreService unavailable:", (err as Error).message);
}

try {
  pushService = new PushNotificationService();
} catch (err) {
  console.warn("[Firebase] PushNotificationService unavailable:", (err as Error).message);
}

export { firestoreService, pushService };
