/**
 * External prompt staging — the channel through which a bridged prompt (the
 * Omitech Agent Master Prompt, over the versioned Learning Studio bridge) is
 * delivered into the workbench composer.
 *
 * One rule governs everything here: an externally staged prompt is a DRAFT.
 * It lands in the composer for the user to read, edit and send themselves —
 * the bridge never submits it. That keeps every send on the same manual,
 * reviewable path the composer already has, and keeps Omitech-side material
 * out of a run until the user says so.
 */

import type {
  BridgeAttachmentMetadata,
  BridgePromptInputMethod,
} from '@/lib/omitech/bridge-protocol';

export interface ExternalPromptStaging {
  /** Correlates progress/result messages back to the host's request. */
  requestId?: string;
  text: string;
  inputMethod: BridgePromptInputMethod;
  attachments: BridgeAttachmentMetadata[];
}

type ExternalPromptListener = (staging: ExternalPromptStaging) => void;

const listeners = new Set<ExternalPromptListener>();

export function publishExternalPrompt(staging: ExternalPromptStaging): void {
  for (const listener of listeners) listener(staging);
}

export function subscribeExternalPrompt(listener: ExternalPromptListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
