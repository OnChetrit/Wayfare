import { useEffect, useRef, useState } from 'react';
import { Alert, Linking, ScrollView, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  documentTargetSchema,
  documentMaxBytes,
  formatMoney,
  paymentStatusLabels,
  type DocumentTarget,
  type TripDocument,
} from '@wayfare/domain';
import {
  createTripDocumentLink,
  getTripDocumentAccess,
  getTripDocuments,
  linkExistingTripDocument,
  removeTripDocument,
  updateTripDocument,
} from '@/api/documents';
import { tripKeys } from '@/api/query-keys';
import { updateReservationLock } from '@/api/trips';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { ErrorState, LoadingState, OfflineNotice } from '@/components/ui/state';
import { useTripEditor } from '@/features/trips/use-trip-editor';
import { useTripMutation } from './use-trip-mutation';
import {
  documentUploadMimeType,
  documentsForTarget,
  removalTargetForDocument,
} from './activity-documents';
import { invalidateTripData } from './trip-query-invalidation';
import { messageFromError } from '@/lib/format';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/theme-provider';

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function ItemDetailsScreen() {
  const params = useLocalSearchParams<{
    kind?: string | string[];
    itemId?: string | string[];
  }>();
  const target = documentTargetSchema.safeParse({
    kind: first(params.kind),
    itemId: first(params.itemId),
  });
  const tripQuery = useTripEditor();
  const trip = tripQuery.data;
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const upload = useRef<XMLHttpRequest | null>(null);
  useEffect(() => () => upload.current?.abort(), []);
  const base = `/api/trips/${trip?.id}/documents`;
  const documents = useQuery({
    queryKey: [...tripKeys.documents(trip?.id ?? ''), trip?.revision],
    enabled: Boolean(trip),
    queryFn: ({ signal }) => getTripDocuments(trip!.id, signal),
  });
  const { isOnline, mutation } = useTripMutation(
    trip?.id ?? '',
    async (
      change:
        | { type: 'create-link'; label: string; url: string }
        | { type: 'edit'; documentId: string; label: string; url?: string }
        | { type: 'link-existing'; documentId: string }
        | { type: 'remove'; documentId: string; target: DocumentTarget },
    ) => {
      if (!trip || !target.success) throw new Error('Select a valid trip item.');
      if (change.type === 'create-link')
        return createTripDocumentLink(trip.id, {
          ...target.data,
          label: change.label,
          url: change.url,
        });
      if (change.type === 'edit')
        return updateTripDocument(trip.id, change.documentId, {
          label: change.label,
          ...(change.url === undefined ? {} : { url: change.url }),
        });
      if (change.type === 'link-existing')
        return linkExistingTripDocument(trip.id, change.documentId, target.data);
      return removeTripDocument(trip.id, change.documentId, change.target);
    },
    {
      onSuccess: () => {
        if (trip?.id) void queryClient.invalidateQueries({ queryKey: tripKeys.documents(trip.id) });
      },
    },
  );
  const { mutation: reservationMutation } = useTripMutation(
    trip?.id ?? '',
    ({ kind, itemId, locked }: { kind: 'HOTEL' | 'FLIGHT'; itemId: string; locked: boolean }) =>
      updateReservationLock(trip!.id, kind, itemId, locked),
  );
  if (tripQuery.isLoading) return <LoadingState label="Loading reservation…" />;
  if (!trip || !target.success) return <ErrorState message="Select a valid trip item." />;
  const tripId = trip.id;
  const documentTarget = target.data;
  const { kind, itemId } = documentTarget;
  const item =
    kind === 'HOTEL'
      ? trip.stays.find(item => item.id === itemId)
      : kind === 'FLIGHT'
        ? trip.flights.find(item => item.id === itemId)
        : kind === 'ACTIVITY'
          ? trip.schedule.find(item => item.id === itemId)
          : undefined;
  const payment = trip.expenses.find(
    expense =>
      expense.coverage?.some(link => link.itemId === itemId && link.kind === kind) ||
      expense.stayId === itemId ||
      expense.flightId === itemId ||
      expense.scheduleItemId === itemId,
  );
  const linked = documentsForTarget(documents.data ?? [], documentTarget, payment?.id);
  const activityLocked = kind === 'ACTIVITY' && Boolean(item?.reservationLocked);
  const disabled = !isOnline || !trip.access.canEdit || activityLocked || mutation.isPending;
  async function pick() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled) {
        if ((result.assets[0].size ?? 0) > documentMaxBytes)
          throw new Error('Files must be 20 MB or smaller.');
        setSelectedFile(result.assets[0]);
      }
    } catch (failure) {
      setError((failure as Error).message);
    }
  }
  async function sendFile() {
    if (!selectedFile) return;
    setError('');
    const mimeType = documentUploadMimeType(selectedFile.name, selectedFile.mimeType);
    if (!mimeType) {
      setError('Choose a PDF, JPEG, PNG, or WebP file.');
      return;
    }
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      setError('Sign in again to upload.');
      return;
    }
    const form = new FormData();
    form.append('file', {
      uri: selectedFile.uri,
      name: selectedFile.name,
      type: mimeType,
    } as unknown as Blob);
    form.append('kind', kind);
    form.append('itemId', itemId);
    const xhr = new XMLHttpRequest();
    upload.current = xhr;
    setProgress(0);
    xhr.open('POST', `${process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/$/, '')}${base}`);
    xhr.setRequestHeader('Authorization', `Bearer ${data.session.access_token}`);
    xhr.upload.onprogress = event => {
      if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      setProgress(null);
      if (xhr.status >= 200 && xhr.status < 300) {
        setSelectedFile(null);
        void documents.refetch();
        void invalidateTripData(queryClient, trip!.id);
      } else {
        try {
          setError(JSON.parse(xhr.responseText).error);
        } catch {
          setError('Upload failed. Retry when connected.');
        }
      }
    };
    xhr.onerror = () => {
      setProgress(null);
      setError('Upload failed. Retry when connected.');
    };
    xhr.onabort = () => {
      setProgress(null);
      setError('Upload cancelled. You can retry.');
    };
    xhr.send(form);
  }
  async function open(document: TripDocument, share = false) {
    try {
      const access = await getTripDocumentAccess(tripId, document.id);
      if (share && document.storage_path) {
        const local = await File.downloadFileAsync(
          access.url,
          new File(
            Paths.cache,
            `${document.id}-${document.label.replace(/[^a-zA-Z0-9. -]/g, '_')}`,
          ),
          { idempotent: true },
        );
        try {
          await Sharing.shareAsync(local.uri, { mimeType: document.mime_type ?? undefined });
        } finally {
          local.delete();
        }
      } else await Linking.openURL(access.url);
    } catch (failure) {
      setError((failure as Error).message);
    }
  }
  function closeEditor() {
    setEditId(null);
    setEditLabel('');
    setEditUrl('');
  }
  function confirmRemove(document: TripDocument) {
    const removalTarget = removalTargetForDocument(document, documentTarget, payment?.id);
    if (!removalTarget) return;
    Alert.alert(
      'Delete attachment?',
      'This removes the attachment from this activity or its payment. The stored file is deleted when no references remain.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            mutation.mutate({ type: 'remove', documentId: document.id, target: removalTarget }),
        },
      ],
    );
  }
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: space.md, paddingBottom: 36, gap: space.md }}
      style={{ backgroundColor: colors.background }}
    >
      <Stack.Screen
        options={{ title: kind === 'ACTIVITY' ? 'Activity files & links' : 'Details' }}
      />
      <OfflineNotice visible={!isOnline} />
      {activityLocked ? (
        <Card style={{ backgroundColor: colors.lockedSurface, borderColor: colors.lockedBorder }}>
          <Text selectable style={{ color: colors.locked, fontSize: 17, fontWeight: '800' }}>
            🔒 Activity locked
          </Text>
          <Text selectable style={{ color: colors.textMuted, lineHeight: 19 }}>
            Files and links remain available to view. Unlock the activity before adding, editing, or
            removing attachments.
          </Text>
        </Card>
      ) : null}
      {item && (kind === 'HOTEL' || kind === 'FLIGHT') && (
        <Card>
          <View style={{ gap: space.xs }}>
            <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>
              Reservation
            </Text>
            <Text selectable style={{ color: colors.textMuted, lineHeight: 19 }}>
              {item.reservationLocked
                ? 'Locked changes require confirmation before saving.'
                : 'Lock this reservation to protect its planned booking details.'}
            </Text>
          </View>
          <Button
            disabled={!isOnline || !trip.access.canEdit || reservationMutation.isPending}
            loading={reservationMutation.isPending}
            onPress={() =>
              reservationMutation.mutate({
                kind,
                itemId,
                locked: !item.reservationLocked,
              })
            }
            tone={item.reservationLocked ? 'secondary' : 'primary'}
          >
            {item.reservationLocked ? '🔒 Reservation locked · Unlock' : 'Lock reservation'}
          </Button>
        </Card>
      )}
      {payment ? (
        <Card>
          <View style={{ gap: space.xs }}>
            <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>
              Payment
            </Text>
            <Text selectable style={{ color: colors.textMuted }}>
              {paymentStatusLabels[payment.paymentStatus ?? 'NEEDS_REVIEW']}
            </Text>
          </View>
          <Button
            onPress={() =>
              router.push({ pathname: '/expense-editor', params: { expenseId: payment.id } })
            }
            tone="secondary"
          >
            {payment.title} · {formatMoney(payment.amount, payment.currency)}
          </Button>
          {payment.coverage?.map((link, index) => (
            <Text selectable key={index} style={{ color: colors.textMuted, lineHeight: 19 }}>
              {link.title} · {link.date} ·{' '}
              {link.allocatedAmount != null
                ? formatMoney(link.allocatedAmount, payment.currency)
                : 'Covered by shared payment'}
            </Text>
          ))}
        </Card>
      ) : (
        item && (
          <Card>
            <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>
              Payment
            </Text>
            <Text selectable style={{ color: colors.textMuted }}>
              Unpaid · No payment recorded
            </Text>
          </Card>
        )
      )}
      <View style={{ gap: space.xs }}>
        <Text selectable style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>
          Tickets &amp; links
        </Text>
        <Text selectable style={{ color: colors.textMuted, lineHeight: 19 }}>
          {linked.length} attached · Reconnect to open or share files. Offline downloads are not
          available.
        </Text>
      </View>
      {documents.isLoading ? <LoadingState label="Loading documents…" /> : null}
      {!documents.isLoading && !linked.length ? (
        <Card style={{ backgroundColor: colors.surfaceMuted }}>
          <Text selectable style={{ color: colors.text, fontWeight: '700' }}>
            No tickets or links yet
          </Text>
          <Text selectable style={{ color: colors.textMuted, lineHeight: 19 }}>
            Add a booking link, receipt, PDF, or image below.
          </Text>
        </Card>
      ) : null}
      {linked.map(document => (
        <Card key={document.id}>
          <View style={{ gap: space.xs }}>
            <Text selectable style={{ color: colors.text, fontWeight: '700' }}>
              {document.label}
            </Text>
            <Text selectable style={{ color: colors.textMuted, fontSize: 13 }}>
              {document.storage_path ? document.mime_type : 'Web link'}
            </Text>
          </View>
          <Button disabled={!isOnline} onPress={() => void open(document)} tone="secondary">
            {document.storage_path ? 'View file' : 'Open link'}
          </Button>
          {document.storage_path ? (
            <Button disabled={!isOnline} onPress={() => void open(document, true)} tone="secondary">
              Download / share
            </Button>
          ) : null}
          {trip.access.canEdit && (
            <>
              <Button
                disabled={disabled}
                onPress={() => {
                  setEditId(document.id);
                  setEditLabel(document.label);
                  setEditUrl(document.url ?? '');
                }}
                tone="quiet"
              >
                Edit
              </Button>
              {editId === document.id ? (
                <View style={{ gap: space.sm }}>
                  <Field
                    editable={!activityLocked}
                    label="Name"
                    value={editLabel}
                    onChangeText={setEditLabel}
                  />
                  {document.url ? (
                    <Field
                      autoCapitalize="none"
                      keyboardType="url"
                      label="HTTP or HTTPS link"
                      value={editUrl}
                      onChangeText={setEditUrl}
                      editable={!activityLocked}
                    />
                  ) : (
                    <Text selectable style={{ color: colors.textMuted, lineHeight: 19 }}>
                      File contents cannot be edited. You can rename this file or delete it and
                      upload a replacement.
                    </Text>
                  )}
                  <View style={{ flexDirection: 'row', gap: space.sm }}>
                    <Button
                      disabled={disabled}
                      onPress={() => {
                        mutation.mutate(
                          {
                            type: 'edit',
                            documentId: document.id,
                            label: editLabel,
                            ...(document.url ? { url: editUrl } : {}),
                          },
                          { onSuccess: closeEditor },
                        );
                      }}
                      style={{ flex: 1 }}
                    >
                      Save changes
                    </Button>
                    <Button onPress={closeEditor} style={{ flex: 1 }} tone="quiet">
                      Cancel
                    </Button>
                  </View>
                </View>
              ) : null}
              <Button
                disabled={
                  disabled || !removalTargetForDocument(document, documentTarget, payment?.id)
                }
                onPress={() => confirmRemove(document)}
                tone="danger"
              >
                Delete
              </Button>
            </>
          )}
        </Card>
      ))}
      {trip.access.canEdit && (
        <Card>
          <View style={{ gap: space.xs }}>
            <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>
              Add a ticket or link
            </Text>
            <Text selectable style={{ color: colors.textMuted, lineHeight: 19 }}>
              PDF, JPEG, PNG, or WebP · 20 MB maximum
            </Text>
          </View>
          <Field
            editable={!activityLocked}
            label="Link label"
            value={label}
            onChangeText={setLabel}
          />
          <Field
            editable={!activityLocked}
            label="HTTP or HTTPS link"
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
          />
          <Button
            disabled={disabled}
            onPress={() =>
              mutation.mutate(
                { type: 'create-link', label, url },
                {
                  onSuccess: () => {
                    setLabel('');
                    setUrl('');
                  },
                },
              )
            }
            tone="secondary"
          >
            Add link
          </Button>
          <Button
            disabled={disabled || progress !== null}
            onPress={() => void pick()}
            tone="secondary"
          >
            Choose PDF or image
          </Button>
          {selectedFile && (
            <Button disabled={disabled || progress !== null} onPress={() => void sendFile()}>
              Upload / retry {selectedFile.name}
            </Button>
          )}
          {progress !== null && (
            <>
              <Text accessibilityRole="progressbar" style={{ color: colors.text }}>
                Uploading {progress}%
              </Text>
              <Button onPress={() => upload.current?.abort()} tone="quiet">
                Cancel upload
              </Button>
            </>
          )}
        </Card>
      )}
      {trip.access.canEdit && documents.data?.some(document => !linked.includes(document)) ? (
        <Card>
          <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>
            Use an existing trip document
          </Text>
          {documents.data
            .filter(document => !linked.includes(document))
            .map(document => (
              <Button
                disabled={disabled}
                key={document.id}
                onPress={() => mutation.mutate({ type: 'link-existing', documentId: document.id })}
                tone="secondary"
              >
                {document.label}
              </Button>
            ))}
        </Card>
      ) : null}
      {(error || mutation.error || reservationMutation.error || documents.error) && (
        <Text accessibilityRole="alert" selectable style={{ color: colors.danger }}>
          {error ||
            messageFromError(mutation.error ?? reservationMutation.error ?? documents.error)}
        </Text>
      )}
    </ScrollView>
  );
}
