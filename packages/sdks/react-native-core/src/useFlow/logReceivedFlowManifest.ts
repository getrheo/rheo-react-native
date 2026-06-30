import type { SdkResolveResponse } from '@getrheo/contracts';
import { getSdkLogLevel, isSdkDevDiagnosticsEnabled } from '../logging/sdkLogger';

const logRule = (): string => '─'.repeat(58);

/** Dev-only: pretty-print the resolved flow manifest in Metro / device logs. */
export const logReceivedFlowManifest = (data: SdkResolveResponse): void => {
  if (!isSdkDevDiagnosticsEnabled(getSdkLogLevel())) return;

  const {
    manifest,
    channelId,
    environment,
    flowId,
    versionId,
    versionNumber,
    experimentId,
    variantId,
  } = data;
  const screens = manifest.screens ?? [];
  const decisionCount = manifest.decisionNodes?.length ?? 0;
  const externalCount = manifest.externalSurfaceNodes?.length ?? 0;
  const rule = logRule();

  console.log(`\n${rule}`);
  console.log('%c Rheo %c Flow manifest received ', 'background:#4f46e5;color:#fff;font-weight:700;padding:2px 6px;border-radius:4px 0 0 4px', 'color:#4f46e5;font-weight:700');
  console.log(rule);
  console.log('Assignment', {
    channelId,
    environment,
    flowId,
    versionId,
    versionNumber,
    experimentId: experimentId ?? null,
    variantId: variantId ?? null,
  });
  console.log('Manifest meta', {
    manifestVersion: manifest.version,
    schemaVersion: manifest.schemaVersion ?? null,
    defaultLocale: manifest.defaultLocale,
    entryScreenId: manifest.entryScreenId,
    screens: screens.length,
    decisionNodes: decisionCount,
    externalSurfaces: externalCount,
  });
  if (screens.length > 0) {
    console.table(
      screens.map((screen, index) => ({
        '#': index,
        id: screen.id,
        name: screen.name,
        entry: screen.id === manifest.entryScreenId ? '→' : '',
      })),
    );
  }
  console.log('Manifest (JSON)\n' + JSON.stringify(manifest, null, 2));
  console.log(`${rule}\n`);
};
