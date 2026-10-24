export const overviewCardIds = ['locations', 'flights-stays', 'expenses', 'reminders'] as const;
export type OverviewCardId = (typeof overviewCardIds)[number];
export type OverviewLayout = { order: OverviewCardId[]; hidden: OverviewCardId[] };

const isCardId = (value: unknown): value is OverviewCardId =>
  typeof value === 'string' && overviewCardIds.some(id => id === value);

export function overviewLayoutFromMetadata(metadata: unknown): OverviewLayout {
  const record =
    metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>) : {};
  const preferences = record.preferences;
  const layout =
    preferences && typeof preferences === 'object'
      ? (preferences as Record<string, unknown>).overviewLayout
      : null;
  const value = layout && typeof layout === 'object' ? (layout as Record<string, unknown>) : {};
  const unique = (items: unknown) =>
    Array.isArray(items) ? [...new Set(items.filter(isCardId))] : [];
  const ordered = unique(value.order);
  return {
    order: [...ordered, ...overviewCardIds.filter(id => !ordered.includes(id))],
    hidden: unique(value.hidden),
  };
}

export function overviewMetadataUpdate(metadata: unknown, layout: OverviewLayout) {
  const record =
    metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>) : {};
  const preferences =
    record.preferences && typeof record.preferences === 'object'
      ? (record.preferences as Record<string, unknown>)
      : {};
  return { ...record, preferences: { ...preferences, overviewLayout: layout } };
}

export function moveOverviewCard(order: OverviewCardId[], id: OverviewCardId, direction: -1 | 1) {
  const index = order.indexOf(id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= order.length) return order;
  const next = [...order];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
