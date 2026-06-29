import {
  clearManifestResolveCache,
  listManifestResolveCacheEntries,
  manifestResolveCacheKey,
  prefetch,
  type ManifestResolveCacheSummary,
  type RheoConfig,
} from '@getrheo/react-native-bare';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';

const panelStyle = {
  gap: 10,
  paddingVertical: 8,
  paddingHorizontal: 12,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: '#27272a',
  backgroundColor: '#18181b',
} as const;

const mono = {
  fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
} as const;

const formatCachedAt = (ms: number): string => {
  if (!ms) return 'unknown';
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return String(ms);
  }
};

const actionButtonStyle = (pressed: boolean, disabled: boolean) => ({
  flex: 1,
  paddingVertical: 10,
  borderRadius: 8,
  borderWidth: 1,
  borderColor: '#3f3f46',
  alignItems: 'center' as const,
  opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
});

const CacheEntryRow = ({ entry, highlighted }: { entry: ManifestResolveCacheSummary; highlighted: boolean }) => (
  <View
    style={{
      gap: 4,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: highlighted ? '#a78bfa' : '#3f3f46',
      backgroundColor: highlighted ? '#1f1a2e' : '#0f0f10',
    }}
  >
    <Text style={{ color: '#fafafa', fontSize: 13, fontWeight: '600' }}>
      {entry.channelId}
      {entry.locale ? ` · ${entry.locale}` : ''}
    </Text>
    <Text style={{ color: '#a1a1aa', fontSize: 11, ...mono }} selectable>
      etag {entry.etag}
    </Text>
    <Text style={{ color: '#71717a', fontSize: 11, ...mono }} selectable>
      flow {entry.flowId.slice(0, 8)}… · v {entry.versionId.slice(0, 8)}…
    </Text>
    <Text style={{ color: '#71717a', fontSize: 11 }}>
      cached {formatCachedAt(entry.cachedAt)}
      {entry.inMemory ? ' · memory' : ' · disk'}
    </Text>
  </View>
);

export type ManifestPrefetchPanelProps = {
  channelId: string;
  publishableKey: string;
  apiBaseUrl: string;
  userId?: string;
  locale?: string;
};

const buildPrefetchConfig = (
  props: Pick<ManifestPrefetchPanelProps, 'publishableKey' | 'apiBaseUrl' | 'userId' | 'locale'>,
): RheoConfig | null => {
  const publishableKey = props.publishableKey.trim();
  const apiBaseUrl = props.apiBaseUrl.trim();
  if (!publishableKey || !apiBaseUrl) return null;
  return {
    publishableKey,
    apiBaseUrl,
    userId: props.userId?.trim() || 'example-user',
    locale: props.locale ?? 'en',
  };
};

export const ManifestPrefetchPanel = ({
  channelId,
  publishableKey,
  apiBaseUrl,
  userId,
  locale = 'en',
}: ManifestPrefetchPanelProps) => {
  const [entries, setEntries] = useState<ManifestResolveCacheSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [prefetching, setPrefetching] = useState(false);
  const [clearing, setClearing] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setEntries(await listManifestResolveCacheEntries());
    } finally {
      setLoading(false);
    }
  }, []);

  const trimmedChannel = channelId.trim();
  const prefetchConfig = buildPrefetchConfig({ publishableKey, apiBaseUrl, userId, locale });
  const canPrefetch = Boolean(trimmedChannel && prefetchConfig);

  const targetKey =
    trimmedChannel && publishableKey.trim() && apiBaseUrl.trim()
      ? manifestResolveCacheKey(apiBaseUrl.trim(), publishableKey.trim(), trimmedChannel, locale)
      : null;
  const targetCached = targetKey ? entries.find((e) => e.key === targetKey) : undefined;

  const handlePrefetch = async () => {
    if (!canPrefetch || !prefetchConfig) return;
    setPrefetching(true);
    try {
      await prefetch(trimmedChannel, { config: prefetchConfig });
      await refresh();
    } finally {
      setPrefetching(false);
    }
  };

  const handleClear = async () => {
    setClearing(true);
    try {
      await clearManifestResolveCache();
      await refresh();
    } finally {
      setClearing(false);
    }
  };

  return (
    <View style={panelStyle}>
      <Text style={{ color: '#a1a1aa', fontSize: 12, fontWeight: '600' }}>Manifest prefetch</Text>
      <Text style={{ color: '#71717a', fontSize: 12 }}>
        Prefetch is manual in this example. Use the buttons below to warm the cache, inspect
        stored manifests, or clear them. <Text style={mono}>&lt;Flow /&gt;</Text> still resolves on
        demand when the cache is cold.
      </Text>
      {trimmedChannel ? (
        <Text style={{ color: '#71717a', fontSize: 12 }}>
          Target channel: <Text style={{ color: '#fafafa', ...mono }}>{trimmedChannel}</Text>
          {targetCached ? (
            <Text style={{ color: '#86efac' }}> · cached</Text>
          ) : (
            <Text style={{ color: '#fbbf24' }}> · not cached yet</Text>
          )}
        </Text>
      ) : (
        <Text style={{ color: '#71717a', fontSize: 12 }}>Enter a channel id to prefetch.</Text>
      )}

      <Text style={{ color: '#a1a1aa', fontSize: 12, fontWeight: '600', marginTop: 4 }}>
        Stored manifests ({entries.length})
      </Text>
      {loading ? (
        <ActivityIndicator />
      ) : entries.length === 0 ? (
        <Text style={{ color: '#71717a', fontSize: 12 }}>
          No cached manifests yet. Tap Trigger prefetch while the API is reachable.
        </Text>
      ) : (
        <View style={{ gap: 8 }}>
          {entries.map((entry) => (
            <CacheEntryRow
              key={entry.key}
              entry={entry}
              highlighted={Boolean(targetKey && entry.key === targetKey)}
            />
          ))}
        </View>
      )}

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
        <Pressable
          onPress={() => void handlePrefetch()}
          disabled={!canPrefetch || prefetching}
          style={({ pressed }) => actionButtonStyle(pressed, !canPrefetch || prefetching)}
        >
          <Text style={{ color: '#e4e4e7', fontSize: 12, fontWeight: '600' }}>
            {prefetching ? 'Prefetching…' : 'Trigger prefetch'}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => void refresh()}
          disabled={loading}
          style={({ pressed }) => actionButtonStyle(pressed, loading)}
        >
          <Text style={{ color: '#e4e4e7', fontSize: 12, fontWeight: '600' }}>Refresh</Text>
        </Pressable>
        <Pressable
          onPress={() => void handleClear()}
          disabled={clearing}
          style={({ pressed }) => ({
            ...actionButtonStyle(pressed, clearing),
            borderColor: '#7f1d1d',
            backgroundColor: '#450a0a',
          })}
        >
          <Text style={{ color: '#fecaca', fontSize: 12, fontWeight: '600' }}>
            {clearing ? 'Clearing…' : 'Clear'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
};
