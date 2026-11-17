import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Timestamp,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import type {
  AppStatus,
  ConnectedAppCheckStatus,
  ConnectedAppMethod,
  ConnectedAppRecord,
  ConnectedAppType,
  PublishedAppRecord,
  RouterAuthScheme,
  RouterConnectionStatus,
  RouterDnsProtection,
  RouterHealthStatus,
  RouterPriorityMode,
  RouterProfileRecord,
  RouterReachMode,
  RouterSecurityLevel,
  RouterVendor,
} from './types/jarvis';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: Array<{
      providerId?: string | null;
      email?: string | null;
    }>;
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

let connectionTested = false;
export async function testConnection(): Promise<void> {
  if (connectionTested) return;
  connectionTested = true;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export function sanitizeSlug(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
  if (cleaned.length >= 3) return cleaned;
  return `app-${Math.random().toString(36).slice(2, 7)}`;
}

export function sanitizeConnectedAppId(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 68);
  const suffix = Math.random().toString(36).slice(2, 7);
  if (cleaned.length >= 3) return `${cleaned}-${suffix}`;
  return `conn-${suffix}`;
}

export function subscribeToUserPublishedApps(
  uid: string,
  onData: (apps: PublishedAppRecord[]) => void,
  onError: (err: Error) => void
): () => void {
  const path = 'published_apps';
  const q = query(collection(db, path), where('authorUid', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: PublishedAppRecord[] = snapshot.docs.map((d) => {
        const data = d.data() as {
          slug: string;
          title: string;
          summary: string;
          prompt: string;
          htmlCode: string;
          status?: string;
          authorUid: string;
          authorName: string;
          createdAt?: Timestamp;
          updatedAt?: Timestamp;
        };
        return {
          slug: data.slug || d.id,
          title: data.title || 'Aplicación',
          summary: data.summary || '',
          prompt: data.prompt || '',
          htmlCode: data.htmlCode || '',
          status: data.status === 'paused' ? 'paused' : 'active',
          authorUid: data.authorUid,
          authorName: data.authorName || 'Usuario',
          createdAtMs: data.createdAt?.toMillis?.() ?? Date.now(),
          updatedAtMs: data.updatedAt?.toMillis?.() ?? Date.now(),
        };
      });
      items.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(
          wrapped instanceof Error ? wrapped : new Error(String(wrapped))
        );
      }
    }
  );
}

export async function publishAppDocument(input: {
  slug: string;
  title: string;
  summary: string;
  prompt: string;
  htmlCode: string;
}): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Debes iniciar sesión con Google para publicar aplicaciones.');
  }

  const safeSlug = sanitizeSlug(input.slug);
  const safeTitle = input.title.trim().slice(0, 120) || 'Mi Aplicación';
  const safeSummary =
    input.summary.trim().slice(0, 300) || 'Aplicación web creada con OpenJarvis.';
  const safePrompt = input.prompt.trim().slice(0, 2000) || 'Aplicación personalizada';
  const safeHtml = input.htmlCode.slice(0, 400000);
  const authorName = (user.displayName || 'Creador').trim().slice(0, 80) || 'Creador';

  const docPath = `published_apps/${safeSlug}`;
  const docRef = doc(db, 'published_apps', safeSlug);

  let existingSnap;
  try {
    existingSnap = await getDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, docPath);
  }

  if (existingSnap && existingSnap.exists()) {
    const existingData = existingSnap.data() as {
      authorUid?: string;
      status?: AppStatus;
    };
    if (existingData.authorUid === user.uid) {
      try {
        await updateDoc(docRef, {
          title: safeTitle,
          summary: safeSummary,
          prompt: safePrompt,
          htmlCode: safeHtml,
          status: existingData.status === 'paused' ? 'paused' : 'active',
          authorName,
          updatedAt: serverTimestamp(),
        });
        return safeSlug;
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, docPath);
      }
    } else {
      // Slug belongs to another user; append unique suffix for unlimited publishing
      const uniqueSlug = `${safeSlug.slice(0, 65)}-${Math.random().toString(36).slice(2, 7)}`;
      const uniquePath = `published_apps/${uniqueSlug}`;
      try {
        await setDoc(doc(db, 'published_apps', uniqueSlug), {
          slug: uniqueSlug,
          title: safeTitle,
          summary: safeSummary,
          prompt: safePrompt,
          htmlCode: safeHtml,
          status: 'active',
          authorUid: user.uid,
          authorName,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return uniqueSlug;
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, uniquePath);
      }
    }
  }

  try {
    await setDoc(docRef, {
      slug: safeSlug,
      title: safeTitle,
      summary: safeSummary,
      prompt: safePrompt,
      htmlCode: safeHtml,
      status: 'active',
      authorUid: user.uid,
      authorName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return safeSlug;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, docPath);
  }
}

export async function updatePublishedAppStatus(
  slug: string,
  status: AppStatus
): Promise<void> {
  const docPath = `published_apps/${slug}`;
  try {
    await updateDoc(doc(db, 'published_apps', slug), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

export async function updatePublishedAppMetadata(
  slug: string,
  title: string,
  summary: string
): Promise<void> {
  const docPath = `published_apps/${slug}`;
  const safeTitle = title.trim().slice(0, 120) || 'Mi Aplicación';
  const safeSummary =
    summary.trim().slice(0, 300) || 'Aplicación web creada con OpenJarvis.';
  try {
    await updateDoc(doc(db, 'published_apps', slug), {
      title: safeTitle,
      summary: safeSummary,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

export async function deletePublishedAppDocument(slug: string): Promise<void> {
  const docPath = `published_apps/${slug}`;
  try {
    await deleteDoc(doc(db, 'published_apps', slug));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

// ==========================================
// Connected Applications CRUD & Management
// ==========================================

export function subscribeToUserConnectedApps(
  uid: string,
  onData: (apps: ConnectedAppRecord[]) => void,
  onError: (err: Error) => void
): () => void {
  const path = 'connected_apps';
  const q = query(collection(db, path), where('ownerUid', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: ConnectedAppRecord[] = snapshot.docs.map((d) => {
        const data = d.data() as {
          id?: string;
          name?: string;
          appType?: ConnectedAppType;
          baseUrl?: string;
          healthPath?: string;
          defaultMethod?: ConnectedAppMethod;
          description?: string;
          status?: AppStatus;
          lastCheckStatus?: ConnectedAppCheckStatus;
          lastHttpCode?: number;
          lastLatencyMs?: number;
          lastCheckedAtMs?: number;
          linkedPublishedSlug?: string;
          ownerUid: string;
          createdAt?: Timestamp;
          updatedAt?: Timestamp;
        };
        return {
          id: data.id || d.id,
          name: data.name || 'Aplicación conectada',
          appType: data.appType || 'web_app',
          baseUrl: data.baseUrl || '',
          healthPath: data.healthPath || '',
          defaultMethod: data.defaultMethod || 'GET',
          description: data.description || '',
          status: data.status === 'paused' ? 'paused' : 'active',
          lastCheckStatus: data.lastCheckStatus || 'unknown',
          lastHttpCode: typeof data.lastHttpCode === 'number' ? data.lastHttpCode : 0,
          lastLatencyMs: typeof data.lastLatencyMs === 'number' ? data.lastLatencyMs : 0,
          lastCheckedAtMs:
            typeof data.lastCheckedAtMs === 'number' ? data.lastCheckedAtMs : 0,
          linkedPublishedSlug: data.linkedPublishedSlug || '',
          ownerUid: data.ownerUid,
          createdAtMs: data.createdAt?.toMillis?.() ?? Date.now(),
          updatedAtMs: data.updatedAt?.toMillis?.() ?? Date.now(),
        };
      });
      items.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(
          wrapped instanceof Error ? wrapped : new Error(String(wrapped))
        );
      }
    }
  );
}

export async function saveConnectedAppDocument(input: {
  id?: string;
  name: string;
  appType: ConnectedAppType;
  baseUrl: string;
  healthPath?: string;
  defaultMethod: ConnectedAppMethod;
  description?: string;
  status?: AppStatus;
  linkedPublishedSlug?: string;
}): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Debes iniciar sesión con Google para conectar aplicaciones.');
  }

  const rawUrl = input.baseUrl.trim().slice(0, 500);
  if (!/^(https?:\/\/|\/p\/).+/.test(rawUrl)) {
    throw new Error(
      'La URL base debe empezar por https://, http:// o /p/ (ej. https://miapp.com).'
    );
  }

  const safeName = input.name.trim().slice(0, 100) || 'Mi App Conectada';
  const safeHealthPath = (input.healthPath ?? '').trim().slice(0, 200);
  const safeDescription = (input.description ?? '').trim().slice(0, 300);
  const safeLinkedSlug = (input.linkedPublishedSlug ?? '').trim().slice(0, 80);
  const safeStatus: AppStatus = input.status === 'paused' ? 'paused' : 'active';
  const safeAppType: ConnectedAppType = [
    'openjarvis_app',
    'web_app',
    'api_rest',
    'webhook',
  ].includes(input.appType)
    ? input.appType
    : 'web_app';
  const safeMethod: ConnectedAppMethod = ['GET', 'POST', 'PUT', 'DELETE'].includes(
    input.defaultMethod
  )
    ? input.defaultMethod
    : 'GET';

  if (input.id) {
    const docId = input.id.slice(0, 80);
    const docPath = `connected_apps/${docId}`;
    try {
      await updateDoc(doc(db, 'connected_apps', docId), {
        name: safeName,
        appType: safeAppType,
        baseUrl: rawUrl,
        healthPath: safeHealthPath,
        defaultMethod: safeMethod,
        description: safeDescription,
        status: safeStatus,
        linkedPublishedSlug: safeLinkedSlug,
        updatedAt: serverTimestamp(),
      });
      return docId;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, docPath);
    }
  }

  const newId = sanitizeConnectedAppId(safeName);
  const docPath = `connected_apps/${newId}`;
  try {
    await setDoc(doc(db, 'connected_apps', newId), {
      id: newId,
      name: safeName,
      appType: safeAppType,
      baseUrl: rawUrl,
      healthPath: safeHealthPath,
      defaultMethod: safeMethod,
      description: safeDescription,
      status: safeStatus,
      lastCheckStatus: 'unknown',
      lastHttpCode: 0,
      lastLatencyMs: 0,
      lastCheckedAtMs: 0,
      linkedPublishedSlug: safeLinkedSlug,
      ownerUid: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return newId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, docPath);
  }
}

export async function updateConnectedAppStatus(
  id: string,
  status: AppStatus
): Promise<void> {
  const docPath = `connected_apps/${id}`;
  try {
    await updateDoc(doc(db, 'connected_apps', id), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

export async function recordConnectedAppCheck(
  id: string,
  check: {
    lastCheckStatus: ConnectedAppCheckStatus;
    lastHttpCode: number;
    lastLatencyMs: number;
  }
): Promise<void> {
  const docPath = `connected_apps/${id}`;
  const safeCode = Math.max(0, Math.min(599, Math.round(check.lastHttpCode)));
  const safeLatency = Math.max(0, Math.min(120000, Math.round(check.lastLatencyMs)));
  try {
    await updateDoc(doc(db, 'connected_apps', id), {
      lastCheckStatus: check.lastCheckStatus,
      lastHttpCode: safeCode,
      lastLatencyMs: safeLatency,
      lastCheckedAtMs: Date.now(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

export async function deleteConnectedAppDocument(id: string): Promise<void> {
  const docPath = `connected_apps/${id}`;
  try {
    await deleteDoc(doc(db, 'connected_apps', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

// ==========================================
// Router Profiles CRUD (Zero Secrets Stored)
// ==========================================

export function sanitizeRouterProfileId(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 68);
  const suffix = Math.random().toString(36).slice(2, 7);
  if (cleaned.length >= 3) return `${cleaned}-${suffix}`;
  return `router-${suffix}`;
}

export function subscribeToUserRouterProfiles(
  uid: string,
  onData: (profiles: RouterProfileRecord[]) => void,
  onError: (err: Error) => void
): () => void {
  const path = 'router_profiles';
  const q = query(collection(db, path), where('ownerUid', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: RouterProfileRecord[] = snapshot.docs.map((d) => {
        const data = d.data() as Partial<RouterProfileRecord> & {
          ownerUid: string;
          createdAt?: Timestamp;
          updatedAt?: Timestamp;
        };
        return {
          id: data.id || d.id,
          name: data.name || 'Router Principal',
          vendor: (data.vendor || 'openwrt') as RouterVendor,
          hostUrl: data.hostUrl || '',
          adminUsername: data.adminUsername || 'admin',
          authScheme: (data.authScheme || 'basic') as RouterAuthScheme,
          connectionStatus: (data.connectionStatus ||
            'unknown') as RouterConnectionStatus,
          lastHttpCode: typeof data.lastHttpCode === 'number' ? data.lastHttpCode : 0,
          lastLatencyMs: typeof data.lastLatencyMs === 'number' ? data.lastLatencyMs : 0,
          lastDiagnosticHealth: (data.lastDiagnosticHealth ||
            'unknown') as RouterHealthStatus,
          lastDiagnosticSummary: data.lastDiagnosticSummary || '',
          wifiName: data.wifiName || 'MiRedWiFi',
          reachMode: (data.reachMode || 'balanced') as RouterReachMode,
          securityLevel: (data.securityLevel ||
            'wpa2_standard') as RouterSecurityLevel,
          priorityMode: (data.priorityMode || 'general') as RouterPriorityMode,
          dnsProtection: (data.dnsProtection ||
            'fast_private') as RouterDnsProtection,
          guestWifiEnabled: Boolean(data.guestWifiEnabled),
          guestWifiName: data.guestWifiName || 'MiRed-Invitados',
          autoOptimizeChannel:
            data.autoOptimizeChannel !== undefined
              ? Boolean(data.autoOptimizeChannel)
              : true,
          ownerUid: data.ownerUid,
          createdAtMs: data.createdAt?.toMillis?.() ?? Date.now(),
          updatedAtMs: data.updatedAt?.toMillis?.() ?? Date.now(),
        };
      });
      items.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(
          wrapped instanceof Error ? wrapped : new Error(String(wrapped))
        );
      }
    }
  );
}

export async function saveRouterProfileDocument(input: {
  id?: string;
  name: string;
  vendor: RouterVendor;
  hostUrl: string;
  adminUsername: string;
  authScheme: RouterAuthScheme;
  connectionStatus?: RouterConnectionStatus;
  lastHttpCode?: number;
  lastLatencyMs?: number;
  lastDiagnosticHealth?: RouterHealthStatus;
  lastDiagnosticSummary?: string;
  wifiName: string;
  reachMode: RouterReachMode;
  securityLevel: RouterSecurityLevel;
  priorityMode: RouterPriorityMode;
  dnsProtection: RouterDnsProtection;
  guestWifiEnabled: boolean;
  guestWifiName: string;
  autoOptimizeChannel: boolean;
}): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Debes iniciar sesión con Google para guardar perfiles de router.');
  }

  const safeName = input.name.trim().slice(0, 100) || 'Router Principal';
  const safeHostUrl = input.hostUrl.trim().slice(0, 300);
  const safeAdminUser = input.adminUsername.trim().slice(0, 64) || 'admin';
  const safeWifiName = input.wifiName.trim().slice(0, 64) || 'MiRedWiFi';
  const safeGuestName = input.guestWifiName.trim().slice(0, 64);
  const safeDiagSummary = (input.lastDiagnosticSummary ?? '').trim().slice(0, 2000);
  const safeCode = Math.max(0, Math.min(599, Math.round(input.lastHttpCode ?? 0)));
  const safeLatency = Math.max(
    0,
    Math.min(120000, Math.round(input.lastLatencyMs ?? 0))
  );

  const safeVendor: RouterVendor = [
    'openwrt',
    'mikrotik',
    'asus',
    'tplink',
    'generic_rest',
    'manual',
  ].includes(input.vendor)
    ? input.vendor
    : 'openwrt';

  const safeAuthScheme: RouterAuthScheme = [
    'basic',
    'bearer',
    'api_key_header',
    'cookie_session',
  ].includes(input.authScheme)
    ? input.authScheme
    : 'basic';

  const safeConnStatus: RouterConnectionStatus = [
    'unknown',
    'connected',
    'unreachable',
    'snapshot_only',
  ].includes(input.connectionStatus ?? 'unknown')
    ? (input.connectionStatus as RouterConnectionStatus)
    : 'unknown';

  const safeHealth: RouterHealthStatus = [
    'unknown',
    'optimal',
    'attention',
    'critical',
  ].includes(input.lastDiagnosticHealth ?? 'unknown')
    ? (input.lastDiagnosticHealth as RouterHealthStatus)
    : 'unknown';

  const safeReach: RouterReachMode = ['balanced', 'max_speed', 'max_range'].includes(
    input.reachMode
  )
    ? input.reachMode
    : 'balanced';

  const safeSec: RouterSecurityLevel = [
    'wpa2_standard',
    'wpa3_max',
    'strict_isolated',
  ].includes(input.securityLevel)
    ? input.securityLevel
    : 'wpa2_standard';

  const safePriority: RouterPriorityMode = [
    'general',
    'video_calls',
    'gaming_low_latency',
    'streaming_4k',
  ].includes(input.priorityMode)
    ? input.priorityMode
    : 'general';

  const safeDns: RouterDnsProtection = [
    'isp_default',
    'fast_private',
    'family_safe',
  ].includes(input.dnsProtection)
    ? input.dnsProtection
    : 'fast_private';

  if (input.id) {
    const docId = input.id.slice(0, 80);
    const docPath = `router_profiles/${docId}`;
    try {
      await updateDoc(doc(db, 'router_profiles', docId), {
        name: safeName,
        vendor: safeVendor,
        hostUrl: safeHostUrl,
        adminUsername: safeAdminUser,
        authScheme: safeAuthScheme,
        connectionStatus: safeConnStatus,
        lastHttpCode: safeCode,
        lastLatencyMs: safeLatency,
        lastDiagnosticHealth: safeHealth,
        lastDiagnosticSummary: safeDiagSummary,
        wifiName: safeWifiName,
        reachMode: safeReach,
        securityLevel: safeSec,
        priorityMode: safePriority,
        dnsProtection: safeDns,
        guestWifiEnabled: Boolean(input.guestWifiEnabled),
        guestWifiName: safeGuestName,
        autoOptimizeChannel: Boolean(input.autoOptimizeChannel),
        updatedAt: serverTimestamp(),
      });
      return docId;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, docPath);
    }
  }

  const newId = sanitizeRouterProfileId(safeName);
  const docPath = `router_profiles/${newId}`;
  try {
    await setDoc(doc(db, 'router_profiles', newId), {
      id: newId,
      name: safeName,
      vendor: safeVendor,
      hostUrl: safeHostUrl,
      adminUsername: safeAdminUser,
      authScheme: safeAuthScheme,
      connectionStatus: safeConnStatus,
      lastHttpCode: safeCode,
      lastLatencyMs: safeLatency,
      lastDiagnosticHealth: safeHealth,
      lastDiagnosticSummary: safeDiagSummary,
      wifiName: safeWifiName,
      reachMode: safeReach,
      securityLevel: safeSec,
      priorityMode: safePriority,
      dnsProtection: safeDns,
      guestWifiEnabled: Boolean(input.guestWifiEnabled),
      guestWifiName: safeGuestName,
      autoOptimizeChannel: Boolean(input.autoOptimizeChannel),
      ownerUid: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return newId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, docPath);
  }
}

export async function deleteRouterProfileDocument(id: string): Promise<void> {
  const docPath = `router_profiles/${id}`;
  try {
    await deleteDoc(doc(db, 'router_profiles', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}
