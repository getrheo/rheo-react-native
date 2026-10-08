import { useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BannerManifest } from '@getrheo/contracts/bannerManifest';
import type { Branding } from '@getrheo/contracts/branding';
import { BANNER_DISMISSED_EVENT, BANNER_IMPRESSION_EVENT } from '@getrheo/contracts/bannerChannelEvents';
import { useChannel } from '../useChannel.js';
import { logChannelEvent } from '../resolve/resolveChannel.js';
import { RHEO_DEFAULT_SDK_API_BASE_URL } from '@getrheo/contracts/sdk';
import { useRheo } from '../client.js';

export type UseBannerOptions = {
  channelId: string;
  enabled?: boolean;
};

export type BannerChannelBody = {
  kind: 'banner';
  bannerId: string;
  versionId: string;
  assignmentVersion: number;
  control?: boolean;
  manifest: BannerManifest;
  mediaMap: Record<string, string>;
  branding?: Branding;
  experiment: { id: string; variantKey: string; variantId: string } | null;
};

export type UseBannerResult = {
  loading: boolean;
  error: Error | null;
  banner: BannerChannelBody | null;
  dismiss: () => void;
  dismissed: boolean;
};

const dismissStorageKey = (channelId: string, assignmentVersion: number, versionId: string) =>
  `rheo:banner-dismissed:${channelId}:${assignmentVersion}:${versionId}`;

export const useBanner = ({ channelId, enabled = true }: UseBannerOptions): UseBannerResult => {
  const config = useRheo();
  const { loading, error, channel } = useChannel({ channelId, enabled });
  const [dismissed, setDismissed] = useState(false);
  const impressedRef = useRef(false);

  const banner = useMemo((): BannerChannelBody | null => {
    if (!channel || channel.kind !== 'banner') return null;
    return channel;
  }, [channel]);

  useEffect(() => {
    if (!banner || banner.control) return;
    const key = dismissStorageKey(channelId, banner.assignmentVersion, banner.versionId);
    void AsyncStorage.getItem(key).then((value) => {
      if (value === '1') setDismissed(true);
    });
  }, [banner, channelId]);

  useEffect(() => {
    if (!banner || banner.control || dismissed || impressedRef.current) return;
    impressedRef.current = true;
    logChannelEvent({
      apiBaseUrl: config.apiBaseUrl ?? RHEO_DEFAULT_SDK_API_BASE_URL,
      publishableKey: config.publishableKey,
      channelId,
      config,
      name: BANNER_IMPRESSION_EVENT,
      properties: { bannerId: banner.bannerId, versionId: banner.versionId },
    });
  }, [banner, channelId, config, dismissed]);

  const dismiss = () => {
    if (!banner || banner.control) return;
    setDismissed(true);
    const key = dismissStorageKey(channelId, banner.assignmentVersion, banner.versionId);
    void AsyncStorage.setItem(key, '1');
    logChannelEvent({
      apiBaseUrl: config.apiBaseUrl ?? RHEO_DEFAULT_SDK_API_BASE_URL,
      publishableKey: config.publishableKey,
      channelId,
      config,
      name: BANNER_DISMISSED_EVENT,
      properties: { bannerId: banner.bannerId, versionId: banner.versionId },
    });
  };

  return { loading, error, banner, dismiss, dismissed };
};
