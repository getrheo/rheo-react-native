import { useEffect, useState } from 'react';
import { RHEO_DEFAULT_SDK_API_BASE_URL } from '@getrheo/contracts/sdk';
import { useRheo } from './client.js';
import {
  logCodeExposure,
  rememberCodeResolve,
  resolveChannel,
  withCodeGet,
  type RheoChannel,
} from './resolve/resolveChannel.js';

export type UseChannelOptions = {
  channelId: string;
  enabled?: boolean;
  attempt?: number;
};

export type UseChannelResult = {
  loading: boolean;
  error: Error | null;
  channel: RheoChannel | null;
};

export const useChannel = ({
  channelId,
  enabled = true,
  attempt = 0,
}: UseChannelOptions): UseChannelResult => {
  const config = useRheo();
  const trimmed = channelId.trim();
  const [error, setError] = useState<Error | null>(null);
  const [channel, setChannel] = useState<RheoChannel | null>(null);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!enabled || !trimmed) {
      setSettled(true);
      return;
    }
    let cancelled = false;
    setSettled(false);
    setError(null);
    const apiBaseUrl = config.apiBaseUrl ?? RHEO_DEFAULT_SDK_API_BASE_URL;
    void resolveChannel({
      apiBaseUrl,
      publishableKey: config.publishableKey,
      channelId: trimmed,
      config,
    })
      .then((next) => {
        if (cancelled) return;
        rememberCodeResolve(trimmed, next);
        setChannel(next);
        setSettled(true);
        if (next?.kind === 'code') {
          void logCodeExposure({
            apiBaseUrl,
            publishableKey: config.publishableKey,
            channelId: trimmed,
            config,
            channel: next,
          });
        }
        if (next?.kind === 'banner' && next.experiment) {
          void logCodeExposure({
            apiBaseUrl,
            publishableKey: config.publishableKey,
            channelId: trimmed,
            config,
            channel: withCodeGet({
              kind: 'code',
              channelId: next.channelId,
              environment: next.environment,
              assignmentVersion: next.assignmentVersion,
              experiment: next.experiment,
              variantKey: next.experiment.variantKey,
              parameters: {},
            }),
          });
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setChannel(null);
        setError(err instanceof Error ? err : new Error(String(err)));
        setSettled(true);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt, config, enabled, trimmed]);

  return { loading: enabled && trimmed.length > 0 && !settled, error, channel };
};
