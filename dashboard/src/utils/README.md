# Utility Functions

## loadFreshPersonData

### Purpose

The `loadFreshPersonData` utility function is designed to prevent race conditions when multiple users are editing the same person simultaneously. This is especially important for long-running operations like file uploads.

### Problem

In an end-to-end encrypted system, the backend cannot merge changes automatically. When a user starts a long operation (like uploading multiple files), another user might modify the person's data in the meantime. Without loading fresh data before saving, the first user would overwrite the second user's changes.

### Solution

Before performing any update operation on person data, load the latest version from the server using `loadFreshPersonData()`.

### Usage

```typescript
import { loadFreshPersonData } from "../utils/loadFreshPersonData";

// Before saving, load fresh data
const freshPerson = await loadFreshPersonData(person._id);
if (!freshPerson) {
  toast.error("Erreur lors du chargement des données à jour. Veuillez réessayer.");
  return;
}

// Use fresh data instead of potentially stale props
const [error] = await tryFetchExpectOk(async () => {
  return API.put({
    path: `/person/${person._id}`,
    body: await encryptPerson({
      ...freshPerson, // Use fresh data, not stale props
      documents: [...freshPerson.documents, ...newDocuments],
    }),
  });
});
```

### When to Use

- Before any person update operation
- Especially important for:
  - File uploads (can take a long time)
  - Document management operations
  - Any operation where users might be collaborating on the same person

### Performance Considerations

The function uses the optimized `GET /person/:_id` endpoint to fetch only the specific person needed, ensuring minimal data transfer and fast response times.
