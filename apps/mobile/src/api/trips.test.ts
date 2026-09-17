import { describe, expect, it, vi } from 'vitest';

import {
  getGooglePlace,
  importGoogleMapsList,
  createLocationDivision,
  createSchedule,
  createTripInvitation,
  createStay,
  moveLocationBoundary,
  createTrip,
  deleteTrip,
  getTripEditor,
  getTripInvitations,
  getTripMembers,
  getTrips,
  redeemTripInvitation,
  removeTripMember,
  revokeTripInvitation,
  updateTripMember,
} from './trips';

import { WayfareApiError } from './error';

const { requestWayfareApi } = vi.hoisted(() => ({ requestWayfareApi: vi.fn() }));

vi.mock('@/api/client', () => ({ requestWayfareApi }));
vi.mock('@/api/query-keys', () => ({
  tripKeys: { all: ['trips'], detail: (tripId: string) => ['trips', tripId] },
}));

const rawTrip = {
  id: '018f7f0e-7c54-7b24-a9d2-4e3683c98f41',
  owner_id: '018f7f0e-7c54-7b24-a9d2-4e3683c98f42',
  name: 'Rome',
  start_date: '2026-10-10',
  end_date: '2026-10-12',
  destination_label: 'Rome, Italy',
};

describe('trip API', () => {
  it('maps the API owner identifier into the shared trip summary', async () => {
    requestWayfareApi.mockResolvedValueOnce({ trips: [rawTrip] });

    await expect(getTrips()).resolves.toEqual([
      {
        id: rawTrip.id,
        ownerId: rawTrip.owner_id,
        name: rawTrip.name,
        startDate: rawTrip.start_date,
        endDate: rawTrip.end_date,
        destinationLabel: rawTrip.destination_label,
        revision: 0,
      },
    ]);
  });

  it('accepts an editor response from a server that does not include ownerId', async () => {
    requestWayfareApi.mockResolvedValueOnce({
      trip: {
        id: rawTrip.id,
        name: rawTrip.name,
        startDate: rawTrip.start_date,
        endDate: rawTrip.end_date,
        destinationLabel: rawTrip.destination_label,
        defaultTimeZone: 'Europe/Rome',
        defaultCurrency: 'EUR',
        access: { role: 'VIEWER', canEdit: false, canManageMembers: false },
        days: [],
        places: [],
        schedule: [],
        locationSegments: [],
        stays: [],
        flights: [],
        expenses: [],
      },
    });

    await expect(getTripEditor(rawTrip.id)).resolves.toMatchObject({
      id: rawTrip.id,
      name: rawTrip.name,
    });
  });

  it('uses authenticated API routes for invitation and member management', async () => {
    const invitationId = '018f7f0e-7c54-7b24-a9d2-4e3683c98f43';
    const memberId = '018f7f0e-7c54-7b24-a9d2-4e3683c98f44';
    const invitation = {
      id: invitationId,
      tripId: rawTrip.id,
      role: 'EDITOR',
      createdAt: '2026-10-10T09:00:00Z',
      expiresAt: null,
      revokedAt: null,
      maxUses: 2,
      useCount: 0,
    };
    const member = {
      userId: memberId,
      tripId: rawTrip.id,
      role: 'VIEWER',
      joinedAt: '2026-10-10T09:00:00Z',
      email: 'viewer@example.com',
      name: 'Viewer',
    };
    requestWayfareApi
      .mockResolvedValueOnce({ invitations: [invitation] })
      .mockResolvedValueOnce({ members: [member] })
      .mockResolvedValueOnce({ invitation: { ...invitation, token: 'a'.repeat(48) } })
      .mockResolvedValueOnce({ invitation: { ...invitation, revokedAt: '2026-10-10T10:00:00Z' } })
      .mockResolvedValueOnce({ member: { ...member, role: 'EDITOR' } })
      .mockResolvedValueOnce({ removed: memberId });

    await expect(getTripInvitations(rawTrip.id)).resolves.toEqual([invitation]);
    await expect(getTripMembers(rawTrip.id)).resolves.toEqual([member]);
    await expect(
      createTripInvitation(rawTrip.id, { role: 'EDITOR', expiresAt: null, maxUses: 2 }),
    ).resolves.toMatchObject({ ...invitation, token: 'a'.repeat(48) });
    await expect(revokeTripInvitation(rawTrip.id, invitationId)).resolves.toMatchObject({
      revokedAt: '2026-10-10T10:00:00Z',
    });
    await expect(updateTripMember(rawTrip.id, memberId, { role: 'EDITOR' })).resolves.toMatchObject(
      {
        role: 'EDITOR',
      },
    );
    await expect(removeTripMember(rawTrip.id, memberId)).resolves.toEqual({ removed: memberId });

    expect(requestWayfareApi).toHaveBeenCalledWith(`/api/trips/${rawTrip.id}/invitations`, {
      signal: undefined,
    });
    expect(requestWayfareApi).toHaveBeenCalledWith(`/api/trips/${rawTrip.id}/members`, {
      signal: undefined,
    });
    expect(requestWayfareApi).toHaveBeenCalledWith(`/api/trips/${rawTrip.id}/invitations`, {
      method: 'POST',
      body: JSON.stringify({ role: 'EDITOR', expiresAt: null, maxUses: 2 }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(requestWayfareApi).toHaveBeenCalledWith(
      `/api/trips/${rawTrip.id}/invitations/${invitationId}`,
      { method: 'DELETE' },
    );
    expect(requestWayfareApi).toHaveBeenCalledWith(`/api/trips/${rawTrip.id}/members/${memberId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role: 'EDITOR' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(requestWayfareApi).toHaveBeenCalledWith(`/api/trips/${rawTrip.id}/members/${memberId}`, {
      method: 'DELETE',
    });
  });

  it('creates a trip with the expected authenticated API request', async () => {
    requestWayfareApi.mockResolvedValueOnce({ trip: rawTrip });
    const input = {
      name: 'Rome',
      destinationLabel: 'Rome, Italy',
      startDate: '2026-10-10',
      endDate: '2026-10-12',
      defaultTimeZone: 'Europe/Rome',
      defaultCurrency: 'EUR',
    };

    await expect(createTrip(input)).resolves.toMatchObject({ id: rawTrip.id });
    expect(requestWayfareApi).toHaveBeenCalledWith('/api/trips', {
      method: 'POST',
      body: JSON.stringify(input),
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('deletes with the trip path and preserves authentication failures', async () => {
    const authenticationError = new WayfareApiError('Sign in again.', 401, 'SESSION_INVALID');
    requestWayfareApi.mockRejectedValueOnce(authenticationError);

    await expect(deleteTrip(rawTrip.id)).rejects.toBe(authenticationError);
    expect(requestWayfareApi).toHaveBeenCalledWith(`/api/trips/${rawTrip.id}`, {
      method: 'DELETE',
    });
  });

  it('redeems an invitation through the authenticated API boundary', async () => {
    requestWayfareApi.mockResolvedValueOnce({ tripId: rawTrip.id });

    await expect(redeemTripInvitation('invite-token')).resolves.toBe(rawTrip.id);
    expect(requestWayfareApi).toHaveBeenCalledWith('/api/invitations/redeem', {
      method: 'POST',
      body: JSON.stringify({ token: 'invite-token' }),
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('imports a shared Google Maps list through the selected trip API', async () => {
    requestWayfareApi.mockResolvedValueOnce({
      listName: 'Rome favorites',
      places: [],
      importedCount: 2,
      skippedCount: 1,
    });

    await expect(
      importGoogleMapsList(rawTrip.id, 'https://maps.app.goo.gl/example'),
    ).resolves.toMatchObject({
      importedCount: 2,
      skippedCount: 1,
    });
    expect(requestWayfareApi).toHaveBeenCalledWith(`/api/trips/${rawTrip.id}/places/import`, {
      method: 'POST',
      body: JSON.stringify({ url: 'https://maps.app.goo.gl/example' }),
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('loads Google place details through the authenticated API', async () => {
    const controller = new AbortController();
    requestWayfareApi.mockResolvedValueOnce({
      place: { id: 'google-place', name: 'Trevi Fountain' },
    });

    await expect(getGooglePlace('google-place', controller.signal)).resolves.toMatchObject({
      name: 'Trevi Fountain',
    });
    expect(requestWayfareApi).toHaveBeenCalledWith('/api/places/google-place', {
      signal: controller.signal,
    });
  });

  it('creates a safely bounded location division through the trip API', async () => {
    requestWayfareApi.mockResolvedValueOnce({ segments: [] });

    await expect(
      createLocationDivision(rawTrip.id, {
        locationName: 'Florence',
        startDate: '2026-10-11',
        endDate: '2026-10-12',
      }),
    ).resolves.toEqual({ segments: [] });
    expect(requestWayfareApi).toHaveBeenCalledWith(
      `/api/trips/${rawTrip.id}/location-segments/division`,
      {
        method: 'POST',
        body: JSON.stringify({
          locationName: 'Florence',
          startDate: '2026-10-11',
          endDate: '2026-10-12',
        }),
        headers: { 'Content-Type': 'application/json' },
      },
    );
  });

  it('moves an adjacent location boundary through the protected trip API', async () => {
    requestWayfareApi.mockResolvedValueOnce({ segments: [] });

    await expect(
      moveLocationBoundary(rawTrip.id, {
        leftSegmentId: '018f7f0e-7c54-7b24-a9d2-4e3683c98f42',
        rightSegmentId: '018f7f0e-7c54-7b24-a9d2-4e3683c98f43',
        newBoundary: '2026-10-11',
      }),
    ).resolves.toEqual({ segments: [] });
    expect(requestWayfareApi).toHaveBeenCalledWith(
      `/api/trips/${rawTrip.id}/location-segments/boundary`,
      {
        method: 'POST',
        body: JSON.stringify({
          leftSegmentId: '018f7f0e-7c54-7b24-a9d2-4e3683c98f42',
          rightSegmentId: '018f7f0e-7c54-7b24-a9d2-4e3683c98f43',
          newBoundary: '2026-10-11',
        }),
        headers: { 'Content-Type': 'application/json' },
      },
    );
  });

  it('sends an optional activity price through the schedule API', async () => {
    requestWayfareApi.mockResolvedValueOnce({ schedule: {} });
    const input = {
      date: '2026-10-10',
      startTime: '09:30',
      duration: 90,
      title: 'Museum tickets',
      category: 'ATTRACTION' as const,
      amount: 42.5,
      currency: 'USD',
    };

    await createSchedule(rawTrip.id, input);

    expect(requestWayfareApi).toHaveBeenCalledWith(`/api/trips/${rawTrip.id}/schedule`, {
      method: 'POST',
      body: JSON.stringify(input),
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('sends all linked-hotel stay details through the authenticated API', async () => {
    requestWayfareApi.mockResolvedValueOnce({ stay: {} });
    const input = {
      name: 'Hotel Artemide',
      savedPlaceId: '018f7f0e-7c54-7b24-a9d2-4e3683c98f99',
      address: 'Via Nazionale 22',
      locationLabel: 'Rome',
      priceAmount: 489.5,
      priceCurrency: 'EUR',
      cancellationTime: '18:00 local time',
      checkInDate: '2026-10-10',
      checkOutDate: '2026-10-12',
      confirmationNumber: 'ABC123',
      secretCode: '9412',
      notes: 'Breakfast included',
    };

    await createStay(rawTrip.id, input);

    expect(requestWayfareApi).toHaveBeenCalledWith(`/api/trips/${rawTrip.id}/stays`, {
      method: 'POST',
      body: JSON.stringify(input),
      headers: { 'Content-Type': 'application/json' },
    });
  });
});
