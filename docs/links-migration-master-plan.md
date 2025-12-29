## Mano links migration (master plan)

### Objective

Move “links” (relationships: person/team/user/action/territory/etc.) out of encrypted blobs and into clear DB columns/tables so we can:

- Query and index relationships without decrypting.
- Reduce payload sizes / encryption churn.
- Make future refactors and analytics easier.

Constraints:

- Decryption/encryption happens client-side.
- Mobile releases lag behind dashboard.
- We must keep retro-compat while avoiding divergence.

---

## Definitions

- **Legacy**: links are stored only inside each entity’s `encrypted` JSON.
- **Dual-write**: clients keep writing legacy encrypted links **and** also write clear link fields (columns/tables).
- **Backfill**: populate clear links for existing rows (client-side migration).
- **Cutover**: make clear links the source of truth.
- **Cleanup**: remove legacy link fields from encrypted JSON.

---

## Key principle (safety)

Because the server cannot read encrypted blobs, it cannot repair link divergence. Therefore:

- **We must not remove legacy links from encrypted blobs until we can prevent old clients from writing legacy-only updates.**

This is achieved by an org-scoped cutover step that blocks (or read-only gates) outdated clients for write operations.

---

## Phase 0 — Preparation (capabilities and org control)

Deliverables:

- Define an org-level flag (or version/capability gate) for link storage mode:
  - `legacy`
  - `dual`
  - `v2only`
- Add telemetry/admin visibility to know which app versions are still in use in an org (Mano already logs `req.headers.version` on login).

Notes:

- This can be implemented later; Phase 1 can ship without it.

---

## Phase 1 — Add DB columns and dual-write (no behavior change)

Goal: start storing links in DB **without changing reads**.

- Add nullable columns (or link tables) for each entity that currently embeds links in encrypted JSON.
- Update API endpoints to accept and persist these fields as **optional**.
- Update dashboard + app + expo to send link fields both:
  - in encrypted JSON (legacy)
  - in clear fields (new)

Guarantees:

- No read path changes.
- Old clients continue to work.
- New clients are compatible even if API is not yet updated (because unknown keys are ignored by Zod when not `.strict()`).

---

## Phase 2 — Client-side backfill (org-scoped, safe)

Goal: populate clear link fields for historical data.

Approach:

- Implement a dashboard “migration runner” using the existing `/migration/:migrationName` mechanism.
- Steps per entity type:
  - Fetch entities in batches.
  - Decrypt.
  - Extract links.
  - Send to server:
    - Either via normal update endpoints (dual-write persists columns),
    - Or via a dedicated migration endpoint that accepts batches of `{_id, linkFields, encrypted, encryptedEntityKey}`.

Safety:

- Keep the legacy encrypted links untouched in Phase 2.
- Backfill can be repeated and is idempotent.

---

## Phase 3 — Cutover (org chooses the moment)

Goal: ensure no old client can re-introduce legacy-only writes.

Mechanism:

- Admin triggers cutover for an org.
- Server switches org to `v2only` and enforces a **minimum app capability** for writes.

Write gating options:

- **Hard block**: reject write requests from outdated clients with an “update required” message.
- **Read-only mode**: allow GET but reject any POST/PUT/PATCH/DELETE.

Notes:

- This is the crucial step that makes Phase 4 safe.

---

## Phase 4 — Cleanup migration (remove links from encrypted)

Goal: remove legacy link fields from encrypted JSON to reduce encrypted payload.

- Run a client-side migration:
  - decrypt
  - delete link fields from the decrypted JSON
  - re-encrypt
  - upload new encrypted payloads

Because outdated writers are blocked (Phase 3), the legacy fields cannot come back.

---

## Phase 5 — Read switch and simplification

- Switch reads to use DB links as the canonical source.
- Keep legacy fallback temporarily (time-boxed).
- Later remove fallback and legacy columns.

---

## Suggested rollout order of entities

Start with low-risk, high-value entities:

1. `Action` (person, teams, user)
2. `Comment` (person/action/team/user)
3. `Passage`, `Rencontre` (person/team/user)
4. `Consultation`, `Treatment`, `MedicalFile` (person/user/team as relevant)
5. `TerritoryObservation` (territory/team/user)
6. Reports and other aggregates only if needed

---

## Retro-compat strategy in code

- Keep UI models based on decrypted content for now.
- Add a thin “links adapter” later:
  - read prefer DB links when org in `v2only`.
  - read fallback to decrypted legacy when in `legacy`/`dual`.

---

## Acceptance criteria per phase

Phase 1:

- No user-visible change.
- All write paths still work across dashboard/app/expo.
- DB starts accumulating link columns/tables.

Phase 3/4:

- Org-scoped cutover is explicit.
- Outdated clients are prevented from writing after cutover.
- Encrypted payloads can be cleaned safely.
