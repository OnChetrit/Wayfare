import { describe, expect, it } from 'vitest';
import {
  currencyInputSchema,
  moneyMinorUnits,
  splitMoneyEqually,
  validateAllocation,
  paymentTotals,
  documentContentType,
  documentLinkInputSchema,
  documentUpdateInputSchema,
  tripDayRoutes,
  toggleTripDay,
  reservationAcknowledgements,
} from '../src';

describe('money and payments', () => {
  it('validates active currencies and exact precision', () => {
    for (const currency of ['USD', 'JPY', 'KWD'])
      expect(currencyInputSchema.safeParse(currency).success).toBe(true);
    expect(currencyInputSchema.safeParse('XYZ').success).toBe(false);
    expect(moneyMinorUnits('1.234', 'KWD')).toBe(1234n);
    expect(moneyMinorUnits('1200', 'JPY')).toBe(1200n);
    expect(() => moneyMinorUnits('1.01', 'JPY')).toThrow('not rounded');
    expect(() => moneyMinorUnits('1.2345', 'KWD')).toThrow('not rounded');
  });
  it('distributes remainders and requires complete reconciled shares', () => {
    expect(splitMoneyEqually('10', 'USD', 3)).toEqual(['3.34', '3.33', '3.33']);
    expect(() =>
      validateAllocation('10', 'USD', [
        { allocatedAmount: '3.34' },
        { allocatedAmount: '3.33' },
        { allocatedAmount: '3.33' },
      ]),
    ).not.toThrow();
    expect(() => validateAllocation('10', 'USD', [{ allocatedAmount: '5' }, {}])).toThrow('every');
    expect(() => validateAllocation('10', 'USD', [{ allocatedAmount: '9.99' }])).toThrow('exactly');
  });
  it('keeps unknown statuses unconfirmed and currencies separate', () => {
    expect(
      paymentTotals([
        { amount: 10, currency: 'USD' },
        { amount: 5, currency: 'USD', paymentStatus: 'PAID' },
        { amount: 10, currency: 'JPY', paymentStatus: 'UNPAID' },
      ]),
    ).toEqual({
      USD: { PAID: '5.00', UNPAID: '0.00', NEEDS_REVIEW: '10.00' },
      JPY: { PAID: '0', UNPAID: '10', NEEDS_REVIEW: '0' },
    });
  });
});
describe('documents and route contracts', () => {
  it('rejects executable link protocols and unsupported bytes', () => {
    expect(
      documentLinkInputSchema.safeParse({
        kind: 'FLIGHT',
        itemId: '00000000-0000-4000-8000-000000000001',
        label: 'Ticket',
        url: 'javascript:alert(1)',
      }).success,
    ).toBe(false);
    expect(documentContentType(new TextEncoder().encode('%PDF-1.7'))).toBe('application/pdf');
    expect(documentContentType(new TextEncoder().encode('<script>'))).toBeNull();
  });
  it('validates document renames and editable web links', () => {
    expect(
      documentUpdateInputSchema.parse({ label: '  Museum tickets  ', url: 'https://example.com' }),
    ).toEqual({ label: 'Museum tickets', url: 'https://example.com' });
    expect(documentUpdateInputSchema.safeParse({ label: 'Ticket' }).success).toBe(true);
    expect(
      documentUpdateInputSchema.safeParse({ label: 'Ticket', url: 'file:///private/ticket.pdf' })
        .success,
    ).toBe(false);
  });
  it('includes empty days without renumbering', () => {
    const days = tripDayRoutes('2030-01-01', '2030-01-03', [], []);
    expect(days.map(day => day.dayNumber)).toEqual([1, 2, 3]);
    expect(days[1].date).toBe('2030-01-02');
    expect(days[1].stops).toEqual([]);
    expect(toggleTripDay('2030-01-01', '2030-01-01')).toBe('');
  });
  it('routes from the morning hotel through activities to the overnight hotel', () => {
    const places: Parameters<typeof tripDayRoutes>[3] = [
      {
        id: 'old-hotel',
        name: 'Old hotel',
        subtitle: '',
        category: 'HOTEL',
        emoji: '',
        color: '',
        lat: 1,
        lng: 1,
      },
      {
        id: 'museum',
        name: 'Museum',
        subtitle: '',
        category: 'ATTRACTION',
        emoji: '',
        color: '',
        lat: 2,
        lng: 2,
      },
      {
        id: 'new-hotel',
        name: 'New hotel',
        subtitle: '',
        category: 'HOTEL',
        emoji: '',
        color: '',
        lat: 3,
        lng: 3,
      },
    ];
    const stays = [
      {
        id: 'old',
        tripId: 'trip',
        name: 'Old hotel',
        savedPlaceId: 'old-hotel',
        checkInDate: '2030-01-01',
        checkOutDate: '2030-01-02',
      },
      {
        id: 'new',
        tripId: 'trip',
        name: 'New hotel',
        savedPlaceId: 'new-hotel',
        checkInDate: '2030-01-02',
        checkOutDate: '2030-01-04',
      },
    ];
    const schedule = [
      {
        id: 'museum-visit',
        savedPlaceId: 'museum',
        date: '2030-01-02',
        startTime: '10:00',
        duration: 60,
      },
    ] as Parameters<typeof tripDayRoutes>[2];
    const days = tripDayRoutes('2030-01-01', '2030-01-03', schedule, places, stays);
    expect(days.map(day => day.routePlaces.map(place => place.id))).toEqual([
      ['old-hotel'],
      ['old-hotel', 'museum', 'new-hotel'],
      ['new-hotel'],
    ]);
    expect(days[1].stops.map(stop => stop.itemId)).toEqual(['museum-visit']);
  });
  it('binds bulk acknowledgement to each reviewed version', () => {
    expect(
      reservationAcknowledgements({
        code: 'RESERVATION_CONFIRMATION_REQUIRED',
        title: 'Reservations',
        changes: {},
        reservations: [
          { id: 'a', version: 3, title: 'A' },
          { id: 'b', version: 7, title: 'B' },
        ],
      }),
    ).toEqual({ a: 3, b: 7 });
  });
});
