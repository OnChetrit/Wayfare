# Reminder notifications

## Objective and scope

Deliver due personal reminders through Expo Push notifications and make them visible in a web in-app notification center. A protected job evaluates due reminders every five minutes, claims work atomically, and records delivery state so normal retries/concurrent runs do not create duplicate notifications.

- **Web:** Provide a personal notification center with unread state, source context, and read/mark-all-read actions.
- **Mobile:** Request notification permission at a user-initiated moment, register/manage Expo Push tokens, and deep-link notification taps into the relevant trip/reminder.
- **Server/database:** Add delivery/token/notification records and a protected five-minute scheduled delivery job.
- **Out of scope:** Email/SMS channels, recurring schedules, notification marketing, and a guarantee that an operating-system push can never be duplicated after a network crash.

## Dependencies

Requires [Plan 04 — Personal reminders from notes](./04-reminders-from-notes.md), which provides reminders, ownership, status, and absolute `remindAt` timestamps. The delivery job must not be introduced against ad-hoc note data.

## Shared contracts, database, API, and authorization

- Extend the reminder contract with delivery-facing read state only where needed; keep provider tokens and delivery errors out of ordinary trip responses. Define `InAppNotification` and safe paginated notification response schemas in `@wayfare/domain`.
- Add `user_push_tokens` with user ID, Expo token (unique), platform/project metadata, last-seen timestamp, and disabled timestamp. Tokens are personal credentials: RLS lets a user register/revoke only their own token; the service job uses server credentials, never a mobile-exposed secret.
- Add `reminder_deliveries` with reminder ID, channel, due time, status/attempt count, claim/send timestamps, Expo receipt/error metadata, and a unique idempotency key such as `(reminder_id, channel, scheduled_for)`. Add `user_notifications` with owner user ID, reminder ID, title/body/source snapshot, created/read timestamps, and a unique reminder/kind key for in-app idempotency.
- Create a security-definer, transaction-safe `claim_due_reminder_deliveries` procedure using `FOR UPDATE SKIP LOCKED` (or an equivalent atomic claim) to select open due reminders, create/claim one delivery per channel, and return only the minimal data required to send. Mark sent/failed/retry state through guarded procedures; never scan reminder rows from a public client.
- Add authenticated user APIs for push-token registration/revocation and notification list/read/read-all. Add a server-only internal delivery route protected by a dedicated cron secret, and schedule it every five minutes in the hosting configuration. Do not accept this secret from a browser or Expo app.

## Implementation details

1. Add `expo-notifications` and the supported Expo configuration/plugin changes, then request permission only after explaining the value—for example, when a person enables reminder alerts or creates their first reminder. On success, obtain the Expo token for the configured project and register it through the authenticated Next.js API. Refresh `lastSeenAt` on app launch and remove/disable invalid tokens.
2. The five-minute route first claims a bounded batch in the database, then sends Expo Push payloads with only reminder title/body, notification ID, trip ID, and reminder ID. Record an in-app notification in the same claim/delivery workflow. On success, mark the delivery sent; on a retryable failure, release it with bounded exponential backoff; on `DeviceNotRegistered`, disable that token.
3. Design for idempotent application behavior: concurrent cron invocations and normal retries produce one delivery record and one in-app notification per reminder/channel/scheduled time. Because a network timeout can occur after Expo accepts a message, document push transport as at-least-once at that boundary and make notification-center/read handling idempotent.
4. Build a web header notification center backed by paginated personal notification APIs. Show unread count, reminder/source context, relative/due time, and an action that opens the relevant trip/reminder. Mark an item read when opened; support explicit mark-all-read without touching reminder completion status.
5. On mobile notification tap, route through Expo Router to the selected trip/reminder after auth restoration. Do not show notification content on a locked public screen beyond the platform’s configured privacy policy. Cached token/notification operations remain online-only and use actionable errors.

## User behavior and edge cases

- A user may decline permissions and still create/manage reminders and see them in the web center; show a non-blocking way to enable alerts later.
- Multiple active devices can receive push notifications for the same personal reminder, but each web in-app notification is shown once. Revoked/invalid tokens stop receiving sends.
- Completing or deleting a reminder before its claim prevents a new delivery. Completing it while a delivery is already claimed follows a documented race policy: recheck open status before sending and mark the claim cancelled when possible.
- The job uses UTC/database time; clients format `remindAt` locally. A five-minute cadence means delivery is expected shortly after the due time, not at a falsely precise second.
- Notification records are private to the reminder owner. Trip owners and collaborators cannot read another person’s tokens, notification center, or delivery history.

## Tests, acceptance criteria, and verification

Automated coverage:

- Add schema/database tests for token ownership, idempotency keys, due selection, claim locking, completion/delete races, retry/backoff, invalid-token disabling, and notification RLS.
- Unit-test Expo payload construction, permission/token lifecycle adapters, deep-link parsing, unread count/read transitions, and cron-secret rejection.
- Add route/integration tests that run two delivery workers against the same due reminder and assert one in-app notification/normal send claim. Mock Expo responses for success, transient failure, and `DeviceNotRegistered`.
- Component-test the web notification center’s empty/unread/read/mark-all states and the mobile permission rationale/error states.

Acceptance criteria:

- A due open reminder is picked up by the protected five-minute job, generates one in-app notification, and sends to each valid registered Expo device under normal conditions.
- Repeated job execution and retries do not create duplicate database notifications or uncontrolled repeat sends.
- A person can read and mark their own web notifications, while no collaborator can access them.

Run before handoff:

```bash
npm run lint
npm run typecheck
npm test
npm run format:check
npm run build
npm run config:check --workspace=@wayfare/mobile
npm run doctor --workspace=@wayfare/mobile
```

Apply the migration in a non-production environment, invoke the protected delivery route with a test secret, then verify a real Expo development build receives and opens a reminder notification on iPhone.
