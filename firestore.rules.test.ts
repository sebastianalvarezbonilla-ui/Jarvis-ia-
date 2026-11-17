/**
 * Verification matrix for adversarial payloads against /published_apps, /connected_apps, and /router_profiles.
 */
export interface SecurityTestCase {
  id: number;
  name: string;
  collection: 'published_apps' | 'connected_apps' | 'router_profiles';
  operation: 'create' | 'update' | 'delete' | 'list' | 'get';
  expected: 'PERMISSION_DENIED' | 'ALLOW';
}

export const DIRTY_DOZEN_CASES: SecurityTestCase[] = [
  { id: 1, name: 'Unauthenticated create', collection: 'router_profiles', operation: 'create', expected: 'PERMISSION_DENIED' },
  { id: 2, name: 'Unverified email create', collection: 'router_profiles', operation: 'create', expected: 'PERMISSION_DENIED' },
  { id: 3, name: 'Owner UID spoofing', collection: 'router_profiles', operation: 'create', expected: 'PERMISSION_DENIED' },
  { id: 4, name: 'Secret/Shadow field injection (adminPassword)', collection: 'router_profiles', operation: 'create', expected: 'PERMISSION_DENIED' },
  { id: 5, name: 'Document ID mismatch', collection: 'router_profiles', operation: 'create', expected: 'PERMISSION_DENIED' },
  { id: 6, name: 'Invalid document ID characters', collection: 'router_profiles', operation: 'create', expected: 'PERMISSION_DENIED' },
  { id: 7, name: 'Client-forged createdAt timestamp', collection: 'router_profiles', operation: 'create', expected: 'PERMISSION_DENIED' },
  { id: 8, name: 'Invalid enum value in simplified config', collection: 'router_profiles', operation: 'create', expected: 'PERMISSION_DENIED' },
  { id: 9, name: 'Cross-user get on router_profiles', collection: 'router_profiles', operation: 'get', expected: 'PERMISSION_DENIED' },
  { id: 10, name: 'Mutating immutable createdAt/ownerUid/id', collection: 'router_profiles', operation: 'update', expected: 'PERMISSION_DENIED' },
  { id: 11, name: 'Unscoped list query across all users', collection: 'router_profiles', operation: 'list', expected: 'PERMISSION_DENIED' },
  { id: 12, name: 'Cross-user delete', collection: 'router_profiles', operation: 'delete', expected: 'PERMISSION_DENIED' },
];
