# Trip sharing, invitations, and membership management

## Objective and scope

Complete owner-controlled trip collaboration: an owner can create share links for Editor or Viewer access, inspect membership, change a non-owner’s role, remove a member, and let an authenticated recipient redeem a link safely on web or mobile.

- **Web:** Add sharing controls and a member-management surface in trip settings/header, plus robust invitation redemption and login return behavior.
- **Mobile:** Add the same owner-only sharing/member controls and continue redemption through the existing deep-link route.
- **Out of scope:** Ownership transfer, invite-by-email delivery, organization-wide groups, and public/read-only trip links.

## Dependencies

None. This plan finalizes the membership authorization that later collaboration infrastructure will rely on.

## Shared contracts, database, API, and authorization

- Build on the existing `OWNER`, `EDITOR`, and `VIEWER` domain unions. Add validated response schemas for `TripMember`, invitation list/create input, and a compact `TripAccess` capability object (`role`, `canEdit`, `canManageMembers`) returned with trip data where the UI needs it. Capabilities are display hints only; server/RLS remain authoritative.
- Keep the existing invitation table/RPCs, but add a forward migration for owner-only member updates and removals. Security-definer functions must verify `auth.uid()` is the trip owner, accept only Editor/Viewer as target roles, and reject demoting or removing the owner. Use the same guard in RLS/triggers so a direct table call cannot bypass it.
- Keep invitation creation/revocation owner-only. Validate future expiries and positive use limits; create opaque, high-entropy tokens and never log them. Redemptions must be transactional and increment use count only when a new membership row is inserted.
- Make redemption idempotent for an already joined recipient: it returns the trip without creating another membership or consuming another use. Decide and test the exact revoked/expired-link behavior for an existing member; the recommended behavior is to return their existing trip access while never granting a new member through an invalid link.
- Add authenticated Next.js API routes for invitation create/list/revoke, member list, role update, member removal, and redemption. Replace browser-side direct RPC use with this boundary so cookies and mobile bearer tokens receive identical validation/errors. The member directory is owner-only because it contains email/name data.

## Implementation details

1. In owner trip settings, present a role picker (Editor/Viewer), optional expiry and use-limit controls, then copy/share the resulting `/invite/[token]` URL. Show active, expired, exhausted, and revoked invitations with revoke confirmation.
2. List the owner first, followed by Editors and Viewers. The owner row is labeled immutable. For all other rows, offer a role change and a destructive removal confirmation. Disable the controls while the respective request is pending and refresh/invalidate trip summary, access, invitation, and member queries after success.
3. Editors can edit trip content but see no invitation/member-management affordances; viewers have no write controls. Hiding controls is not authorization—every API route and database function must enforce the role again.
4. On invitation visit, preserve the token through login/sign-up and return to redemption after authentication. A successful redemption refreshes the trip list, selects the joined trip, and opens it. Invalid, expired, revoked, exhausted, and unauthorized errors are distinct and actionable.
5. On mobile, keep route files limited to token handoff and put sharing/redeeming logic in feature/API modules. Use the protected Next.js API, TanStack Query invalidation, native copy/share affordances, and existing online-only mutation policy.

## User behavior and edge cases

- One invitation may be reused until its configured limit is reached; concurrent redemptions cannot exceed that limit.
- A recipient who already belongs to a trip cannot accidentally get a duplicate member row or consume an additional use by reopening the link.
- Removing a member immediately removes their ordinary API/RLS access. The owner cannot remove or demote themself, and no non-owner can alter roles.
- Revoking an invitation blocks future joins but does not remove people who redeemed it earlier.
- A copied link has no embedded personal data. Treat it as a credential: do not include it in analytics events, error logs, or rendered invitation lists beyond the owner’s explicit copy UI.

## Tests, acceptance criteria, and verification

Automated coverage:

- Add schema/API tests for token input, role validation, expiry/use-limit validation, mapping of access capabilities, and redemption idempotency.
- Add database/RLS integration tests for owner/editor/viewer/unrelated users, concurrent use-limit redemption, owner protection, revocation, and member-directory privacy.
- Component-test owner-only controls, role-change/removal confirmations, link copy/share behavior, login-resume redemption, query invalidation, and mobile deep-link handling.

Acceptance criteria:

- Only an owner can create/revoke invitations, read the member directory, change roles, or remove a non-owner member.
- Editor and Viewer permissions are enforced in both API and RLS, on web and mobile.
- A valid invitation joins the authenticated recipient exactly once and opens the correct trip; all invalid-link states are understandable.

Run before handoff:

```bash
npm run lint
npm run typecheck
npm test
npm run format:check
npm run build
```

Manually validate invitations with owner/editor/viewer/recipient accounts in a browser and on an iPhone, including expired, revoked, and max-use links.
