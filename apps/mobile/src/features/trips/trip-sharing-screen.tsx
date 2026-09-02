import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { Alert, Share, Text, View } from 'react-native';
import type { InvitationRole, TripInvitation, TripMember } from '@wayfare/domain';
import {
  Button as SwiftButton,
  ConfirmationDialog,
  DatePicker,
  Form,
  Host,
  HStack,
  Label,
  Picker,
  ProgressView,
  Section,
  Spacer,
  Text as SwiftText,
  TextField,
  Toggle,
  VStack,
  useNativeState,
} from '@expo/ui/swift-ui';
import {
  datePickerStyle,
  disabled,
  foregroundStyle,
  keyboardType,
  pickerStyle,
  refreshable,
  scrollDismissesKeyboard,
  tag,
} from '@expo/ui/swift-ui/modifiers';

import { tripKeys } from '@/api/query-keys';
import {
  createTripInvitation,
  getTripInvitations,
  getTripMembers,
  removeTripMember,
  revokeTripInvitation,
  updateTripMember,
} from '@/api/trips';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChipGroup } from '@/components/ui/controls';
import { DateTimeField } from '@/components/ui/date-time-field';
import { dateTimeFieldValue, dateTimePickerDate } from '@/components/ui/date-time-field-value';
import { Field } from '@/components/ui/field';
import { Screen } from '@/components/ui/screen';
import { EmptyState, ErrorState, LoadingState, OfflineNotice } from '@/components/ui/state';
import { useTripEditor } from '@/features/trips/use-trip-editor';
import { useTrips } from '@/features/trips/trip-context';
import { invalidateTripSharingData } from '@/features/trips/trip-sharing-query-invalidation';
import { useTripMutation } from '@/features/itinerary/use-trip-mutation';
import { useAuth } from '@/features/auth/auth-context';
import { messageFromError } from '@/lib/format';
import { useTheme } from '@/theme/theme-provider';

const roleOptions = [
  { label: 'Editor', value: 'EDITOR' },
  { label: 'Viewer', value: 'VIEWER' },
] as const;

function invitationStatus(invitation: TripInvitation) {
  if (invitation.revokedAt) return 'Revoked';
  if (invitation.expiresAt && new Date(invitation.expiresAt).getTime() <= Date.now())
    return 'Expired';
  if (invitation.maxUses !== null && invitation.useCount >= invitation.maxUses) return 'Used up';
  return 'Active';
}

function invitationExpiry(value: string | null) {
  if (!value) return 'No expiry';
  return `Expires ${new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(value))}`;
}

function expiryFromDate(value: string) {
  if (!value.trim()) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const expiry = new Date(`${value}T23:59:59.999Z`);
  return Number.isNaN(expiry.getTime()) ? undefined : expiry.toISOString();
}

export function TripSharingScreen() {
  const { colors, theme } = useTheme();
  const { session } = useAuth();
  const { selectedTrip } = useTrips();
  const tripQuery = useTripEditor();
  const queryClient = useQueryClient();
  const [role, setRole] = React.useState<InvitationRole>('EDITOR');
  const [expiryDate, setExpiryDate] = React.useState('');
  const [maxUses, setMaxUses] = React.useState('');
  const [newLink, setNewLink] = React.useState<string | null>(null);
  const [isExpiryEnabled, setIsExpiryEnabled] = React.useState(false);
  const [revokeConfirmationId, setRevokeConfirmationId] = React.useState<string | null>(null);
  const [removalConfirmationId, setRemovalConfirmationId] = React.useState<string | null>(null);
  const nativeMaxUses = useNativeState(maxUses);
  const trip = tripQuery.data;
  const isLegacyOwner = selectedTrip?.ownerId === session?.user.id;
  const canManageMembers = Boolean(trip?.access.canManageMembers || isLegacyOwner);

  const invitationsQuery = useQuery({
    queryKey: trip ? tripKeys.invitations(trip.id) : ['trips', 'none', 'invitations'],
    queryFn: ({ signal }) => getTripInvitations(trip!.id, signal),
    enabled: Boolean(trip && canManageMembers),
  });
  const membersQuery = useQuery({
    queryKey: trip ? tripKeys.members(trip.id) : ['trips', 'none', 'members'],
    queryFn: ({ signal }) => getTripMembers(trip!.id, signal),
    enabled: Boolean(trip && canManageMembers),
  });

  const invalidateSharing = React.useCallback(async () => {
    if (!trip) return;
    await invalidateTripSharingData(queryClient, trip.id);
  }, [queryClient, trip]);

  const { isOnline, mutation: createMutation } = useTripMutation(
    trip?.id ?? null,
    async () => {
      if (!trip) throw new Error('Choose a trip first.');
      const hasExpiryDate =
        process.env.EXPO_OS === 'ios' ? isExpiryEnabled : Boolean(expiryDate.trim());
      const expiresAt = hasExpiryDate ? expiryFromDate(expiryDate) : null;
      if (expiresAt === undefined) throw new Error('Use an expiry date in YYYY-MM-DD format.');
      const currentMaxUses = process.env.EXPO_OS === 'ios' ? nativeMaxUses.get() : maxUses;
      const normalizedMaxUses = currentMaxUses.trim() ? Number(currentMaxUses) : null;
      if (
        normalizedMaxUses !== null &&
        (!Number.isInteger(normalizedMaxUses) || normalizedMaxUses <= 0)
      ) {
        throw new Error('Invitation use limit must be a positive whole number.');
      }
      return createTripInvitation(trip.id, { role, expiresAt, maxUses: normalizedMaxUses });
    },
    {
      onSuccess: async invitation => {
        const webUrl = process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/$/, '');
        setNewLink(webUrl ? `${webUrl}/invite/${invitation.token}` : null);
        setExpiryDate('');
        setMaxUses('');
        setIsExpiryEnabled(false);
        nativeMaxUses.set('');
        await invalidateSharing();
      },
    },
  );
  const { mutation: revokeMutation } = useTripMutation(
    trip?.id ?? null,
    (invitationId: string) => revokeTripInvitation(trip!.id, invitationId),
    { onSuccess: invalidateSharing },
  );
  const { mutation: updateMemberMutation } = useTripMutation(
    trip?.id ?? null,
    ({ userId, role }: { userId: string; role: InvitationRole }) =>
      updateTripMember(trip!.id, userId, { role }),
    { onSuccess: invalidateSharing },
  );
  const { mutation: removeMemberMutation } = useTripMutation(
    trip?.id ?? null,
    (userId: string) => removeTripMember(trip!.id, userId),
    { onSuccess: invalidateSharing },
  );

  async function shareNewLink() {
    if (!newLink) return;
    try {
      await Share.share({
        message: newLink,
        url: newLink,
        title: `Join ${trip?.name ?? 'this trip'}`,
      });
    } catch {
      // The platform share sheet may be dismissed without an error worth surfacing.
    }
  }

  function confirmRevoke(invitation: TripInvitation) {
    Alert.alert('Revoke invitation?', 'People who already joined keep their access.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke',
        style: 'destructive',
        onPress: () => revokeMutation.mutate(invitation.id),
      },
    ]);
  }

  function confirmRemoval(member: TripMember) {
    Alert.alert(`Remove ${member.name}?`, 'They will no longer be able to open this trip.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => removeMemberMutation.mutate(member.userId),
      },
    ]);
  }

  if (tripQuery.isLoading) return <LoadingState label="Loading sharing controls…" />;
  if (tripQuery.error)
    return (
      <ErrorState message={messageFromError(tripQuery.error)} onRetry={() => tripQuery.refetch()} />
    );
  if (!trip)
    return <EmptyState title="Choose a trip" detail="Select a trip before managing sharing." />;
  if (!canManageMembers)
    return (
      <Screen>
        <EmptyState
          title="Only the trip owner can manage sharing"
          detail="You can still view or edit the trip according to your access level."
        />
      </Screen>
    );

  const isMutating =
    createMutation.isPending ||
    revokeMutation.isPending ||
    updateMemberMutation.isPending ||
    removeMemberMutation.isPending;
  const sharingError =
    createMutation.error ??
    revokeMutation.error ??
    updateMemberMutation.error ??
    removeMemberMutation.error;

  const isInvitationFormDisabled = !isOnline || isMutating;

  if (process.env.EXPO_OS === 'ios') {
    return (
      <Host colorScheme={theme} seedColor={colors.accent} style={{ flex: 1 }}>
        <Form
          modifiers={[
            refreshable(async () => {
              await Promise.all([invitationsQuery.refetch(), membersQuery.refetch()]);
            }),
            scrollDismissesKeyboard('interactively'),
          ]}
        >
          {!isOnline ? (
            <Section title="Connection">
              <Label title="You’re offline" systemImage="wifi.slash" />
              <SwiftText>Reconnect to create, revoke, or update access.</SwiftText>
            </Section>
          ) : null}

          <Section
            title="New invitation"
            footer={
              <SwiftText>
                Create a private link for an editor or viewer. Treat every link like a credential.
              </SwiftText>
            }
          >
            <Picker
              label="Access"
              onSelectionChange={setRole}
              selection={role}
              systemImage="person.badge.key"
              modifiers={[pickerStyle('segmented'), disabled(isInvitationFormDisabled)]}
            >
              {roleOptions.map(option => (
                <SwiftText key={option.value} modifiers={[tag(option.value)]}>
                  {option.label}
                </SwiftText>
              ))}
            </Picker>
            <Toggle
              isOn={isExpiryEnabled}
              label="Set an expiry date"
              onIsOnChange={enabled => {
                setIsExpiryEnabled(enabled);
                if (enabled && !expiryDate) setExpiryDate(dateTimeFieldValue(new Date(), 'date'));
                if (!enabled) setExpiryDate('');
              }}
              modifiers={[disabled(isInvitationFormDisabled)]}
            />
            {isExpiryEnabled ? (
              <DatePicker
                displayedComponents={['date']}
                onDateChange={date => setExpiryDate(dateTimeFieldValue(date, 'date'))}
                selection={dateTimePickerDate(expiryDate, 'date')}
                title="Expiry date"
                modifiers={[datePickerStyle('compact'), disabled(isInvitationFormDisabled)]}
              />
            ) : null}
            <TextField
              onTextChange={setMaxUses}
              placeholder="Use limit (unlimited)"
              text={nativeMaxUses}
              modifiers={[
                keyboardType('ascii-capable-number-pad'),
                disabled(isInvitationFormDisabled),
              ]}
            />
            <SwiftButton
              label={createMutation.isPending ? 'Creating…' : 'Create invitation'}
              systemImage="link.badge.plus"
              onPress={() => createMutation.mutate()}
              modifiers={[disabled(isInvitationFormDisabled)]}
            />
          </Section>

          {newLink ? (
            <Section title="Invitation link created">
              <SwiftText>{newLink}</SwiftText>
              <SwiftButton
                label="Share invitation link"
                systemImage="square.and.arrow.up"
                onPress={() => void shareNewLink()}
                modifiers={[disabled(!isOnline)]}
              />
            </Section>
          ) : null}

          <Section
            title="Invitations"
            footer={
              !invitationsQuery.isLoading &&
              !invitationsQuery.error &&
              !invitationsQuery.data?.length ? (
                <SwiftText>Create a link when you’re ready to invite someone.</SwiftText>
              ) : undefined
            }
          >
            {invitationsQuery.isLoading ? (
              <HStack spacing={10}>
                <ProgressView />
                <SwiftText>Loading invitations…</SwiftText>
              </HStack>
            ) : null}
            {invitationsQuery.error ? (
              <VStack alignment="leading" spacing={8}>
                <SwiftText modifiers={[foregroundStyle(colors.danger)]}>
                  {messageFromError(invitationsQuery.error)}
                </SwiftText>
                <SwiftButton label="Try again" onPress={() => invitationsQuery.refetch()} />
              </VStack>
            ) : null}
            {invitationsQuery.data?.map(invitation => (
              <HStack key={invitation.id} spacing={12}>
                <VStack alignment="leading" spacing={3}>
                  <SwiftText>
                    {invitation.role === 'EDITOR' ? 'Editor' : 'Viewer'} ·{' '}
                    {invitationStatus(invitation)}
                  </SwiftText>
                  <SwiftText
                    modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}
                  >
                    {invitationExpiry(invitation.expiresAt)} · {invitation.useCount}
                    {invitation.maxUses === null ? ' uses' : `/${invitation.maxUses} uses`}
                  </SwiftText>
                </VStack>
                <Spacer />
                {!invitation.revokedAt ? (
                  <ConfirmationDialog
                    isPresented={revokeConfirmationId === invitation.id}
                    onIsPresentedChange={presented =>
                      setRevokeConfirmationId(presented ? invitation.id : null)
                    }
                    title="Revoke invitation?"
                    titleVisibility="visible"
                  >
                    <ConfirmationDialog.Trigger>
                      <SwiftButton
                        label={
                          revokeMutation.isPending && revokeMutation.variables === invitation.id
                            ? 'Revoking…'
                            : 'Revoke'
                        }
                        role="destructive"
                        onPress={() => setRevokeConfirmationId(invitation.id)}
                        modifiers={[disabled(isInvitationFormDisabled)]}
                      />
                    </ConfirmationDialog.Trigger>
                    <ConfirmationDialog.Actions>
                      <SwiftButton
                        label="Revoke"
                        role="destructive"
                        onPress={() => {
                          setRevokeConfirmationId(null);
                          revokeMutation.mutate(invitation.id);
                        }}
                      />
                      <SwiftButton label="Cancel" role="cancel" />
                    </ConfirmationDialog.Actions>
                    <ConfirmationDialog.Message>
                      <SwiftText>People who already joined keep their access.</SwiftText>
                    </ConfirmationDialog.Message>
                  </ConfirmationDialog>
                ) : null}
              </HStack>
            ))}
          </Section>

          <Section title="Members">
            {membersQuery.isLoading ? (
              <HStack spacing={10}>
                <ProgressView />
                <SwiftText>Loading members…</SwiftText>
              </HStack>
            ) : null}
            {membersQuery.error ? (
              <VStack alignment="leading" spacing={8}>
                <SwiftText modifiers={[foregroundStyle(colors.danger)]}>
                  {messageFromError(membersQuery.error)}
                </SwiftText>
                <SwiftButton label="Try again" onPress={() => membersQuery.refetch()} />
              </VStack>
            ) : null}
            {membersQuery.data?.map(member => (
              <VStack key={member.userId} alignment="leading" spacing={6}>
                <SwiftText>{member.name}</SwiftText>
                <SwiftText
                  modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}
                >
                  {member.email}
                </SwiftText>
                {member.role === 'OWNER' ? (
                  <SwiftText modifiers={[foregroundStyle(colors.success)]}>Owner</SwiftText>
                ) : (
                  <>
                    <Picker
                      label="Access"
                      onSelectionChange={nextRole =>
                        updateMemberMutation.mutate({ userId: member.userId, role: nextRole })
                      }
                      selection={member.role}
                      modifiers={[pickerStyle('segmented'), disabled(isInvitationFormDisabled)]}
                    >
                      {roleOptions.map(option => (
                        <SwiftText key={option.value} modifiers={[tag(option.value)]}>
                          {option.label}
                        </SwiftText>
                      ))}
                    </Picker>
                    <ConfirmationDialog
                      isPresented={removalConfirmationId === member.userId}
                      onIsPresentedChange={presented =>
                        setRemovalConfirmationId(presented ? member.userId : null)
                      }
                      title={`Remove ${member.name}?`}
                      titleVisibility="visible"
                    >
                      <ConfirmationDialog.Trigger>
                        <SwiftButton
                          label={
                            removeMemberMutation.isPending &&
                            removeMemberMutation.variables === member.userId
                              ? 'Removing…'
                              : 'Remove member'
                          }
                          role="destructive"
                          onPress={() => setRemovalConfirmationId(member.userId)}
                          modifiers={[disabled(isInvitationFormDisabled)]}
                        />
                      </ConfirmationDialog.Trigger>
                      <ConfirmationDialog.Actions>
                        <SwiftButton
                          label="Remove member"
                          role="destructive"
                          onPress={() => {
                            setRemovalConfirmationId(null);
                            removeMemberMutation.mutate(member.userId);
                          }}
                        />
                        <SwiftButton label="Cancel" role="cancel" />
                      </ConfirmationDialog.Actions>
                      <ConfirmationDialog.Message>
                        <SwiftText>They will no longer be able to open this trip.</SwiftText>
                      </ConfirmationDialog.Message>
                    </ConfirmationDialog>
                  </>
                )}
              </VStack>
            ))}
          </Section>

          {sharingError ? (
            <Section title="Couldn’t update sharing">
              <SwiftText modifiers={[foregroundStyle(colors.danger)]}>
                {messageFromError(sharingError)}
              </SwiftText>
            </Section>
          ) : null}
        </Form>
      </Host>
    );
  }

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <Text selectable style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>
          Share {trip.name}
        </Text>
        <Text selectable style={{ color: colors.textMuted, lineHeight: 20 }}>
          Create a private link for an editor or viewer. Treat every link like a credential.
        </Text>
      </View>
      <OfflineNotice visible={!isOnline} />
      <Card>
        <View style={{ gap: 12 }}>
          <Text selectable style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
            New invitation
          </Text>
          <View style={{ gap: 7 }}>
            <Text selectable style={{ color: colors.textMuted, fontSize: 13, fontWeight: '700' }}>
              Access
            </Text>
            <ChipGroup
              disabled={!isOnline || isMutating}
              options={[...roleOptions]}
              value={role}
              onChange={setRole}
            />
          </View>
          <DateTimeField
            disabled={!isOnline || isMutating}
            label="Expiry date (optional)"
            mode="date"
            onChangeText={setExpiryDate}
            value={expiryDate}
          />
          <Field
            accessibilityLabel="Invitation use limit"
            editable={isOnline && !isMutating}
            keyboardType="number-pad"
            label="Use limit (optional)"
            onChangeText={setMaxUses}
            placeholder="Unlimited"
            value={maxUses}
          />
          <Button
            disabled={!isOnline || isMutating}
            loading={createMutation.isPending}
            onPress={() => createMutation.mutate()}
          >
            Create invitation
          </Button>
          {newLink ? (
            <View style={{ gap: 8 }}>
              <Text selectable style={{ color: colors.success, fontWeight: '700' }}>
                Invitation link created
              </Text>
              <Text selectable style={{ color: colors.textMuted, fontSize: 12 }}>
                {newLink}
              </Text>
              <Button disabled={!isOnline} onPress={() => void shareNewLink()} tone="secondary">
                Share invitation link
              </Button>
            </View>
          ) : null}
        </View>
      </Card>
      <View style={{ gap: 8 }}>
        <Text selectable style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>
          Invitations
        </Text>
        {invitationsQuery.isLoading ? <LoadingState label="Loading invitations…" /> : null}
        {invitationsQuery.error ? (
          <ErrorState
            message={messageFromError(invitationsQuery.error)}
            onRetry={() => invitationsQuery.refetch()}
          />
        ) : null}
        {invitationsQuery.data?.map(invitation => (
          <Card key={invitation.id}>
            <View style={{ gap: 4 }}>
              <Text selectable style={{ color: colors.text, fontWeight: '700' }}>
                {invitation.role === 'EDITOR' ? 'Editor' : 'Viewer'} ·{' '}
                {invitationStatus(invitation)}
              </Text>
              <Text selectable style={{ color: colors.textMuted, fontSize: 13 }}>
                {invitationExpiry(invitation.expiresAt)} · {invitation.useCount}
                {invitation.maxUses === null ? ' uses' : `/${invitation.maxUses} uses`}
              </Text>
            </View>
            {!invitation.revokedAt ? (
              <Button
                disabled={!isOnline || isMutating}
                onPress={() => confirmRevoke(invitation)}
                tone="danger"
              >
                {revokeMutation.isPending && revokeMutation.variables === invitation.id
                  ? 'Revoking…'
                  : 'Revoke'}
              </Button>
            ) : null}
          </Card>
        ))}
        {!invitationsQuery.isLoading &&
        !invitationsQuery.error &&
        !invitationsQuery.data?.length ? (
          <EmptyState
            title="No invitations yet"
            detail="Create a link when you’re ready to invite someone."
          />
        ) : null}
      </View>
      <View style={{ gap: 8 }}>
        <Text selectable style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>
          Members
        </Text>
        {membersQuery.isLoading ? <LoadingState label="Loading members…" /> : null}
        {membersQuery.error ? (
          <ErrorState
            message={messageFromError(membersQuery.error)}
            onRetry={() => membersQuery.refetch()}
          />
        ) : null}
        {membersQuery.data?.map(member => (
          <Card key={member.userId}>
            <View style={{ gap: 3 }}>
              <Text selectable style={{ color: colors.text, fontWeight: '700' }}>
                {member.name}
              </Text>
              <Text selectable style={{ color: colors.textMuted, fontSize: 13 }}>
                {member.email}
              </Text>
            </View>
            {member.role === 'OWNER' ? (
              <Text selectable style={{ color: colors.success, fontWeight: '700' }}>
                Owner
              </Text>
            ) : (
              <View style={{ gap: 8 }}>
                <ChipGroup
                  options={[...roleOptions]}
                  value={member.role}
                  disabled={!isOnline || isMutating}
                  onChange={nextRole =>
                    updateMemberMutation.mutate({ userId: member.userId, role: nextRole })
                  }
                />
                <Button
                  disabled={!isOnline || isMutating}
                  onPress={() => confirmRemoval(member)}
                  tone="danger"
                >
                  {removeMemberMutation.isPending &&
                  removeMemberMutation.variables === member.userId
                    ? 'Removing…'
                    : 'Remove member'}
                </Button>
              </View>
            )}
          </Card>
        ))}
      </View>
      {sharingError ? (
        <Text selectable style={{ color: colors.danger }}>
          {messageFromError(sharingError)}
        </Text>
      ) : null}
    </Screen>
  );
}
