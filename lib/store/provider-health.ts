import { create } from 'zustand';

/** Ephemeral discovery state; never persist errors or readiness across sessions. */
export const useProviderHealth = create<{
  status: 'checking' | 'ready' | 'error';
  message: string;
}>(() => ({ status: 'checking', message: '' }));
