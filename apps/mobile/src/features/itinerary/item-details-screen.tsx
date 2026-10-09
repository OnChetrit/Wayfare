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
  type TripDocument,
} from '@wayfare/domain';
import { requestWayfareApi } from '@/api/client';
import { tripKeys } from '@/api/query-keys';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { ErrorState, LoadingState, OfflineNotice } from '@/components/ui/state';
import { useTripEditor } from '@/features/trips/use-trip-editor';
import { useTripMutation } from './use-trip-mutation';
import { invalidateTripData } from './trip-query-invalidation';
import { messageFromError } from '@/lib/format';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/theme-provider';
export function ItemDetailsScreen() {
  const params = useLocalSearchParams<{ kind: string; itemId: string }>();
  const target = documentTargetSchema.safeParse(params);
  const tripQuery = useTripEditor();
  const trip = tripQuery.data;
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameLabel, setRenameLabel] = useState('');
  const [selectedFile, setSelectedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const upload = useRef<XMLHttpRequest | null>(null);
  useEffect(() => () => upload.current?.abort(), []);
  const base = `/api/trips/${trip?.id}/documents`;
  const documents = useQuery({
    queryKey: [...tripKeys.documents(trip?.id ?? ''), trip?.revision],
    enabled: Boolean(trip),
    queryFn: ({ signal }) => requestWayfareApi<{ documents: TripDocument[] }>(base, { signal }),
  });
  const { isOnline, mutation } = useTripMutation(
    trip?.id ?? '',
    async ({ path, method, body }: { path: string; method: string; body: unknown }) =>
      requestWayfareApi(path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    {
      onSuccess: () => {
        if (trip?.id) void queryClient.invalidateQueries({ queryKey: tripKeys.documents(trip.id) });
      },
    },
  );
  if (tripQuery.isLoading) return <LoadingState label="Loading reservation…" />;
  if (!trip || !target.success) return <ErrorState message="Select a valid trip item." />;
  const { kind, itemId } = target.data;
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
  const linked =
    documents.data?.documents.filter(document =>
      document.document_links.some(
        link =>
          (link.kind === kind && link.item_id === itemId) ||
          (payment && link.kind === 'EXPENSE' && link.item_id === payment.id),
      ),
    ) ?? [];
  const disabled = !isOnline || !trip.access.canEdit || mutation.isPending;
  const write = (path: string, method: string, body: unknown) =>
    mutation.mutate({ path, method, body });
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
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      setError('Sign in again to upload.');
      return;
    }
    const form = new FormData();
    form.append('file', {
      uri: selectedFile.uri,
      name: selectedFile.name,
      type: selectedFile.mimeType ?? 'application/octet-stream',
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
      const access = await requestWayfareApi<{ url: string }>(`${base}/${document.id}`);
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
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: space.md, paddingBottom: 36, gap: space.md }}
      style={{ backgroundColor: colors.background }}
    >
      <Stack.Screen options={{ title: 'Reservation details' }} />
      <OfflineNotice visible={!isOnline} />
      {item && kind !== 'ACTIVITY' && (
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
            disabled={disabled}
            loading={mutation.isPending}
            onPress={() =>
              write(`/api/trips/${trip.id}/reservations/${kind}/${itemId}`, 'PATCH', {
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
            Open
          </Button>
          <Button disabled={!isOnline} onPress={() => void open(document, true)} tone="secondary">
            Download / share
          </Button>
          {trip.access.canEdit && (
            <>
              <Button
                disabled={disabled}
                onPress={() => {
                  setRenameId(document.id);
                  setRenameLabel(document.label);
                }}
                tone="quiet"
              >
                Rename
              </Button>
              {renameId === document.id ? (
                <View style={{ gap: space.sm }}>
                  <Field label="Document label" value={renameLabel} onChangeText={setRenameLabel} />
                  <View style={{ flexDirection: 'row', gap: space.sm }}>
                    <Button
                      disabled={disabled}
                      onPress={() => {
                        write(`${base}/${renameId}`, 'PATCH', { label: renameLabel });
                        setRenameId(null);
                      }}
                      style={{ flex: 1 }}
                    >
                      Save label
                    </Button>
                    <Button onPress={() => setRenameId(null)} style={{ flex: 1 }} tone="quiet">
                      Cancel
                    </Button>
                  </View>
                </View>
              ) : null}
              <Button
                disabled={
                  disabled ||
                  !document.document_links.some(
                    link => link.kind === kind && link.item_id === itemId,
                  )
                }
                onPress={() =>
                  Alert.alert(
                    'Remove attachment?',
                    'This only unlinks the document here. The stored file is deleted when no references remain.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Remove',
                        style: 'destructive',
                        onPress: () => write(`${base}/${document.id}`, 'DELETE', target.data),
                      },
                    ],
                  )
                }
                tone="danger"
              >
                Remove
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
          <Field label="Link label" value={label} onChangeText={setLabel} />
          <Field
            label="HTTP or HTTPS link"
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
          />
          <Button
            disabled={disabled}
            onPress={() => write(base, 'POST', { ...target.data, label, url })}
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
      {trip.access.canEdit &&
      documents.data?.documents.some(document => !linked.includes(document)) ? (
        <Card>
          <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>
            Use an existing trip document
          </Text>
          {documents.data?.documents
            .filter(document => !linked.includes(document))
            .map(document => (
              <Button
                disabled={disabled}
                key={document.id}
                onPress={() => write(base, 'POST', { ...target.data, documentId: document.id })}
                tone="secondary"
              >
                {document.label}
              </Button>
            ))}
        </Card>
      ) : null}
      {(error || mutation.error || documents.error) && (
        <Text accessibilityRole="alert" selectable style={{ color: colors.danger }}>
          {error || messageFromError(mutation.error ?? documents.error)}
        </Text>
      )}
    </ScrollView>
  );
}
