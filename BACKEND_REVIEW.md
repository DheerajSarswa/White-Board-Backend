# Backend fixes and verification

This review focuses on existing failures and access-control bugs. It adds no
runtime dependencies and preserves the current frontend API routes and token
format.

| Problem | Fix | Verification |
| --- | --- | --- |
| Failed MongoDB startup was swallowed while the server accepted requests that later timed out. | Connect before listening, propagate startup failure, disable query buffering, and return 503 during disconnection. | Missing-config startup tests; HTTP health and unavailable-API tests. |
| Credential validation called string helpers on objects and arrays; missing users referenced an undefined variable. | Validate input types first and return a clear missing-account response. | Invalid body tests; missing-user, valid-login and wrong-password tests against MongoDB. |
| Duplicate registration and unexpected errors exposed internal database messages; JSON parser errors returned inconsistent responses. | Use a small shared error handler with safe JSON messages and appropriate 400/401/403/409/413/500 responses. | Duplicate-email, malformed JSON, body-size and error-message tests. |
| Canvas endpoints accepted invalid IDs, element types and sharing data that could break queries or rendering. | Validate canvas IDs, names, email and drawing data; keep sharing in its owner-checked endpoint. | Invalid payload tests and validation of every existing drawing tool. |
| Sharing used read-then-push/save, allowing duplicate recipients during concurrent requests. | Use atomic $addToSet. | Six concurrent share requests leave one recipient. |
| Canvas load/update/share used document saves, risking stale writes and version conflicts during collaboration. | Update only the necessary fields with atomic queries and permission filters. | Concurrent load/share/update test verifies saved elements and recipient list. |
| Identical REST saves broadcast repeatedly, contributing to client autosave echo. | Compare the atomic update's previous elements and broadcast only changed content. | Two identical saves produce one broadcast. |
| Socket clients could broadcast drawing, cursor and presence events without authorization; null payloads could throw. | Require room membership, validate payloads and recheck database access for each broadcast. | Authenticated outsider is blocked for all three event types; authorized events still arrive. |
| Socket authentication accepted signed tokens without an email identity. | Share REST/socket token verification and require a string email. | Missing identity, invalid signature and expired-token tests. |
| Disconnecting users left stale collaborator presence; deleted canvases retained socket rooms. | Notify peers during disconnect and remove clients from deleted canvas rooms. | Disconnect notification and deletion/room-eviction tests. |

## Scope limits

Canvas updates still use the existing full-canvas, last-write-wins behavior.
Simultaneous independent edits are not merged. No conflict-resolution framework,
new session-expiry policy, rate-limiter service or extra infrastructure was added.
