## Goal

Start extracting **links** (relationships) from encrypted blobs into clear database columns **without breaking existing clients**.

This document covers **Phase 1 only**:

- Add new DB columns to store links (initially only for `Action` → `Person` and `Action` → `Teams`, plus `Action` → `User`).
- Update dashboard + mobile (app + expo) to **dual-write**:
  - Keep the legacy fields **inside encrypted JSON** (unchanged).
  - Also send the same fields as **top-level clear fields** so the API persists them.
- Keep reads unchanged (everything still works even if DB link columns are empty).

## Non-goals (Phase 1)

- No backfill of existing rows.
- No deletion/removal of legacy link fields from encrypted JSON.
- No code path that _requires_ link columns.
- No forced upgrade / version gating.

## Current state (before Phase 1)

For `Action`, the following fields are inside the encrypted payload on all clients:

- `person` (uuid)
- `teams` (uuid[])
- `team` (uuid, legacy fallback)
- `user` (uuid)

See the action encryption preparation on dashboard/app/expo (`prepareActionForEncryption`) where these appear in the encrypted fields list.

The API currently stores only:

- `encrypted`, `encryptedEntityKey`
- `status`, `dueAt`, `completedAt`, `recurrence`

## Phase 1 design

### Database

Add **nullable** columns on `mano."Action"`:

- `person` UUID NULL
- `user` UUID NULL
- `teams` UUID[] NULL
- `team` UUID NULL (legacy single-team mirror; optional but helps capture old data shape)

Notes:

- All are optional so old clients continue to work.
- `teams` has no FK because Postgres arrays can’t enforce element-level FK.
- Add indexes later only when we start reading/querying on those fields.

### API write endpoints

Update `POST /action`, `POST /action/multiple`, `PUT /action/:id` to accept and persist these **optional** fields:

- `person`
- `user`
- `teams`
- `team`

Rules:

- Never require them.
- If `teams` is missing but `team` exists, store `team` and optionally store `teams=[team]` (implementation choice).
- Continue to require `encrypted` and `encryptedEntityKey` as today.

### Clients (dashboard + app + expo)

Update `prepareActionForEncryption` so the encrypted payload **still contains** the legacy link fields, but the outgoing object also contains top-level clear fields.

Example shape sent to API (simplified):

```json
{
  "status": "A FAIRE",
  "dueAt": "...",
  "encrypted": "...",
  "encryptedEntityKey": "...",

  "person": "<uuid>",
  "teams": ["<uuid>", "<uuid>"],
  "team": "<uuid>",
  "user": "<uuid>"
}
```

Important:

- Reads remain unchanged. UI continues to rely on decrypted content.
- Dual-write is safe even if the API ignores these fields (Zod objects are not strict by default).

## Rollout plan

- Deploy API migration + API code changes.
- Release dashboard.
- Release mobile builds (app/expo) when possible.
- Wait a few weeks/months → then design Phase 2 (backfill + read switch + cutover + removal from encrypted).

## Validation / acceptance criteria

- Creating/updating an action from any client still works.
- API now stores `Action.person`, `Action.user`, `Action.team`, `Action.teams` when clients send them.
- No change in UI behavior.
- No migration flags or compatibility gates are introduced yet.
