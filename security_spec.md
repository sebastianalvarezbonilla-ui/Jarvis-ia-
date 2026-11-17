# Firestore Security Specification (`published_apps`, `connected_apps`, `router_profiles`)

## 1. Data Invariants
1. Every document enforces strict `hasAll` + `hasOnly` key checks, bounded string sizes, and valid document IDs (`^[a-zA-Z0-9_-]+$`).
2. `authorUid` (`published_apps`) and `ownerUid` (`connected_apps`, `router_profiles`) must equal `request.auth.uid` on creation and remain immutable on update.
3. Only verified authenticated users (`request.auth != null && request.auth.token.email_verified == true`) can create, update, or delete records.
4. No PII (`email`, phone, address), router admin keys/passwords, or Wi-Fi passwords are ever stored in Firestore.
5. `createdAt` and `updatedAt` must equal `request.time` on create; `createdAt` is immutable on update and `updatedAt` must equal `request.time`.
6. Public single-document `get` is permitted only on `published_apps/{appId}` for valid slugs; `connected_apps` and `router_profiles` are strictly private (`get`, `list`, `create`, `update`, `delete` all require verified owner UID).

## 2. Dirty Dozen Adversarial Payloads
1. Unauthenticated `create` on `/router_profiles/home-router` -> `PERMISSION_DENIED`.
2. Unverified email (`email_verified: false`) `create` on `/router_profiles/home-router` -> `PERMISSION_DENIED`.
3. Identity spoofing (`ownerUid: "other-user"`) -> `PERMISSION_DENIED`.
4. Secret/Shadow field injection (`adminPassword: "123"`, `wifiPassword: "abc"`, or `isAdmin: true`) -> `PERMISSION_DENIED`.
5. Document ID mismatch (`profileId: "router-a"`, `id: "router-b"`) -> `PERMISSION_DENIED`.
6. Path variable poisoning (`profileId` > 128 chars or invalid symbols `../hack`) -> `PERMISSION_DENIED`.
7. Client timestamp spoofing (`createdAt` != `request.time`) -> `PERMISSION_DENIED`.
8. Invalid enum or oversized string (`priorityMode: "hacked"`, `lastDiagnosticSummary` > 2000 chars) -> `PERMISSION_DENIED`.
9. Cross-user `get` on `/router_profiles/{profileId}` -> `PERMISSION_DENIED`.
10. Immutable field tampering on `update` (`createdAt`, `ownerUid`, `id` changed) -> `PERMISSION_DENIED`.
11. Unscoped `list` query without `where('ownerUid', '==', uid)` -> `PERMISSION_DENIED`.
12. Cross-user `delete` on `/router_profiles/{profileId}` -> `PERMISSION_DENIED`.
