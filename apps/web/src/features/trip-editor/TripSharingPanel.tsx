'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Check, Copy, Link2, Trash2, UsersRound } from 'lucide-react';
import type {
  InvitationRole,
  TripInvitation,
  TripMember,
  TripMemberRoleUpdateInput,
} from '@wayfare/domain';

import styles from './TripSettingsModal.module.scss';

type CreatedInvitation = TripInvitation & { token: string };

function errorMessage(value: unknown, fallback: string) {
  if (typeof value === 'string' && value.trim()) return value;
  if (!value || typeof value !== 'object') return fallback;
  const error = value as { message?: unknown; formErrors?: unknown; fieldErrors?: unknown };
  const messages: string[] = [];
  if (typeof error.message === 'string') messages.push(error.message);
  if (Array.isArray(error.formErrors)) {
    messages.push(
      ...error.formErrors.filter((message): message is string => typeof message === 'string'),
    );
  }
  if (error.fieldErrors && typeof error.fieldErrors === 'object') {
    Object.values(error.fieldErrors).forEach(value => {
      if (Array.isArray(value))
        messages.push(...value.filter((message): message is string => typeof message === 'string'));
    });
  }
  return messages.join(' ') || fallback;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = (await response.json().catch(() => ({}))) as { error?: unknown } & T;
  if (!response.ok)
    throw new Error(errorMessage(payload.error, 'Could not complete that request.'));
  return payload;
}

function invitationStatus(invitation: TripInvitation) {
  if (invitation.revokedAt) return 'Revoked';
  if (invitation.expiresAt && new Date(invitation.expiresAt).getTime() <= Date.now())
    return 'Expired';
  if (invitation.maxUses !== null && invitation.useCount >= invitation.maxUses) return 'Used up';
  return 'Active';
}

function formatExpiry(value: string | null) {
  if (!value) return 'No expiry';
  return `Expires ${new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))}`;
}

export function TripSharingPanel({ tripId }: { tripId: string }) {
  const [invitations, setInvitations] = useState<TripInvitation[]>([]);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [role, setRole] = useState<InvitationRole>('EDITOR');
  const [expiresAt, setExpiresAt] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [activeRequest, setActiveRequest] = useState<string | null>(null);
  const [freshLink, setFreshLink] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setMessage(null);
    try {
      const [invitationResult, memberResult] = await Promise.all([
        requestJson<{ invitations: TripInvitation[] }>(`/api/trips/${tripId}/invitations`),
        requestJson<{ members: TripMember[] }>(`/api/trips/${tripId}/members`),
      ]);
      setInvitations(invitationResult.invitations);
      setMembers(memberResult.members);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load sharing controls.');
    } finally {
      setIsLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function createInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const numericMaxUses = maxUses.trim() ? Number(maxUses) : null;
    const normalizedExpiry = expiresAt ? new Date(expiresAt).toISOString() : null;
    if (expiresAt && Number.isNaN(new Date(expiresAt).getTime())) {
      setMessage('Choose a valid invitation expiry.');
      return;
    }
    if (numericMaxUses !== null && (!Number.isInteger(numericMaxUses) || numericMaxUses <= 0)) {
      setMessage('Invitation use limit must be a positive whole number.');
      return;
    }

    setIsCreating(true);
    setMessage(null);
    try {
      const result = await requestJson<{ invitation: CreatedInvitation }>(
        `/api/trips/${tripId}/invitations`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role, expiresAt: normalizedExpiry, maxUses: numericMaxUses }),
        },
      );
      const { token, ...invitation } = result.invitation;
      const link = `${window.location.origin}/invite/${token}`;
      setInvitations(current => [invitation, ...current]);
      setFreshLink(link);
      setExpiresAt('');
      setMaxUses('');
      setMessage('Invitation link created. Copy it before sharing.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not create the invitation.');
    } finally {
      setIsCreating(false);
    }
  }

  async function copyLink() {
    if (!freshLink) return;
    try {
      await navigator.clipboard.writeText(freshLink);
      setMessage('Invitation link copied.');
    } catch {
      setMessage('Could not copy the link. Select and copy it manually.');
    }
  }

  async function revokeInvitation(invitation: TripInvitation) {
    if (!window.confirm('Revoke this invitation? People who already joined keep their access.'))
      return;
    setActiveRequest(`invite-${invitation.id}`);
    setMessage(null);
    try {
      const result = await requestJson<{ invitation: TripInvitation }>(
        `/api/trips/${tripId}/invitations/${invitation.id}`,
        { method: 'DELETE' },
      );
      setInvitations(current =>
        current.map(item => (item.id === invitation.id ? result.invitation : item)),
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not revoke the invitation.');
    } finally {
      setActiveRequest(null);
    }
  }

  async function updateMember(member: TripMember, nextRole: InvitationRole) {
    if (member.role === nextRole) return;
    setActiveRequest(`member-${member.userId}`);
    setMessage(null);
    try {
      const result = await requestJson<{ member: TripMember }>(
        `/api/trips/${tripId}/members/${member.userId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: nextRole } satisfies TripMemberRoleUpdateInput),
        },
      );
      setMembers(current =>
        current.map(item => (item.userId === member.userId ? result.member : item)),
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update the member role.');
    } finally {
      setActiveRequest(null);
    }
  }

  async function removeMember(member: TripMember) {
    if (!window.confirm(`Remove ${member.name} from this trip?`)) return;
    setActiveRequest(`member-${member.userId}`);
    setMessage(null);
    try {
      await requestJson(`/api/trips/${tripId}/members/${member.userId}`, { method: 'DELETE' });
      setMembers(current => current.filter(item => item.userId !== member.userId));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not remove the member.');
    } finally {
      setActiveRequest(null);
    }
  }

  return (
    <section className={styles.sharingSection} aria-labelledby="sharing-heading">
      <div className={styles.sharingHeading}>
        <div>
          <h3 id="sharing-heading">
            <UsersRound size={15} /> Share this trip
          </h3>
          <p>Create a private link for an editor or viewer. Treat every link like a credential.</p>
        </div>
        {isLoading ? <span className={styles.sharingLoading}>Loading…</span> : null}
      </div>

      <form className={styles.invitationForm} onSubmit={createInvitation}>
        <label>
          Access
          <select value={role} onChange={event => setRole(event.target.value as InvitationRole)}>
            <option value="EDITOR">Editor — can change trip plans</option>
            <option value="VIEWER">Viewer — can only view the trip</option>
          </select>
        </label>
        <div className={styles.invitationFields}>
          <label>
            Expiry <small>Optional</small>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={event => setExpiresAt(event.target.value)}
            />
          </label>
          <label>
            Uses <small>Optional</small>
            <input
              type="number"
              min="1"
              inputMode="numeric"
              value={maxUses}
              onChange={event => setMaxUses(event.target.value)}
              placeholder="Unlimited"
            />
          </label>
        </div>
        <button
          className={styles.createInviteButton}
          type="submit"
          disabled={isCreating || isLoading}
        >
          <Link2 size={14} /> {isCreating ? 'Creating…' : 'Create invitation'}
        </button>
      </form>

      {freshLink ? (
        <div className={styles.freshLink}>
          <span>New invitation link</span>
          <input value={freshLink} readOnly aria-label="New invitation link" />
          <button type="button" onClick={copyLink}>
            <Copy size={13} /> Copy
          </button>
        </div>
      ) : null}

      <div className={styles.sharingList}>
        <span className={styles.resultsLabel}>INVITATIONS · {invitations.length}</span>
        {invitations.length ? (
          invitations.map(invitation => {
            const status = invitationStatus(invitation);
            const revocable = !invitation.revokedAt;
            return (
              <div className={styles.invitationRow} key={invitation.id}>
                <div>
                  <strong>{invitation.role === 'EDITOR' ? 'Editor' : 'Viewer'}</strong>
                  <span>
                    {status} · {formatExpiry(invitation.expiresAt)} · {invitation.useCount}
                    {invitation.maxUses === null ? ' uses' : `/${invitation.maxUses} uses`}
                  </span>
                </div>
                {revocable ? (
                  <button
                    type="button"
                    onClick={() => void revokeInvitation(invitation)}
                    disabled={activeRequest !== null}
                  >
                    {activeRequest === `invite-${invitation.id}` ? 'Revoking…' : 'Revoke'}
                  </button>
                ) : null}
              </div>
            );
          })
        ) : (
          <p className={styles.emptySharingList}>No invitations yet.</p>
        )}
      </div>

      <div className={styles.sharingList}>
        <span className={styles.resultsLabel}>MEMBERS · {members.length}</span>
        {members.map(member => {
          const isOwner = member.role === 'OWNER';
          const pending = activeRequest === `member-${member.userId}`;
          return (
            <div className={styles.memberRow} key={member.userId}>
              <div className={styles.memberIdentity}>
                <strong>{member.name}</strong>
                <span>{member.email}</span>
              </div>
              {isOwner ? (
                <span className={styles.ownerBadge}>
                  <Check size={12} /> Owner
                </span>
              ) : (
                <div className={styles.memberActions}>
                  <select
                    value={member.role}
                    disabled={activeRequest !== null}
                    aria-label={`Change ${member.name}'s role`}
                    onChange={event =>
                      void updateMember(member, event.target.value as InvitationRole)
                    }
                  >
                    <option value="EDITOR">Editor</option>
                    <option value="VIEWER">Viewer</option>
                  </select>
                  <button
                    type="button"
                    disabled={activeRequest !== null}
                    onClick={() => void removeMember(member)}
                    aria-label={`Remove ${member.name}`}
                  >
                    {pending ? '…' : <Trash2 size={13} />}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {message ? (
        <p className={styles.sharingMessage} role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
