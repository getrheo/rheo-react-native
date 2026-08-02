import type { ComponentType } from 'react';
import type { ExternalSurfaceNode, NormalizedSurfaceOutcome } from '@getrheo/contracts';

/**
 * Props Rheo passes to a host component registered under `externalSurfaces[hostKey]`.
 * Call one of the callbacks to advance the flow via the surface's wired outcomes.
 */
export type ExternalSurfaceHostProps = {
  /** Registry key (`config.hostKey` or node id). */
  surfaceId: string;
  node: ExternalSurfaceNode;
  /** Advances with outcome `completed`. */
  onComplete: () => void;
  /** Advances with outcome `back`. */
  onBack: () => void;
  /** Advances with outcome `dismissed`. */
  onDismiss: () => void;
};

/** Map of host keys (`config.hostKey` or `surf_*` node id) to host React components. */
export type ExternalSurfacesMap = Record<string, ComponentType<ExternalSurfaceHostProps>>;

export type HeadlessSurfaceOutcome = Extract<
  NormalizedSurfaceOutcome,
  'completed' | 'back' | 'dismissed' | 'failed'
>;
