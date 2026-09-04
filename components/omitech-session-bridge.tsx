'use client';

import { useEffect, useState, type ReactNode } from 'react';

import { useUserProfileStore } from '@/lib/store/user-profile';

interface SessionUser {
  id: string;
  name: string;
  role: string;
  learner_key: string;
}

interface SessionResponse {
  enabled: boolean;
  authenticated: boolean;
  user?: SessionUser;
  error?: string;
  expires_in?: number;
}

function allowedParentOrigins(): Set<string> {
  const configured = process.env.NEXT_PUBLIC_OMITECH_PARENT_ORIGINS ?? '';
  const values = configured
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (values.length === 0 && process.env.NODE_ENV !== 'production') {
    values.push('http://127.0.0.1:1420', 'http://localhost:1420');
  }
  return new Set(values);
}

export function OmitechSessionBridge({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'checking' | 'ready' | 'blocked'>('checking');
  const [message, setMessage] = useState('Connecting securely to Omitech Agent…');
  const setNickname = useUserProfileStore((profile) => profile.setNickname);

  useEffect(() => {
    let cancelled = false;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const requestRefresh = () => {
      for (const origin of allowedParentOrigins()) {
        window.parent.postMessage({ type: 'omitech:learning-studio:session-refresh' }, origin);
      }
    };
    const connect = async (launchToken?: string) => {
      if (!cancelled) {
        setState('checking');
        setMessage('Connecting securely to Omitech Agent…');
      }
      const response = await fetch('/api/omitech/session', {
        method: launchToken ? 'POST' : 'GET',
        credentials: 'same-origin',
        headers: launchToken ? { 'content-type': 'application/json' } : undefined,
        body: launchToken ? JSON.stringify({ launch_token: launchToken }) : undefined,
      });
      const payload = (await response.json().catch(() => ({}))) as Partial<SessionResponse>;
      if (cancelled) return;
      if (payload.enabled === false) {
        setState('ready');
        return;
      }
      if (response.ok && payload.authenticated && payload.user) {
        setNickname(payload.user.name);
        setState('ready');
        if (launchToken) {
          if (refreshTimer) clearTimeout(refreshTimer);
          refreshTimer = undefined;
        }
        if (launchToken && payload.expires_in) {
          // Renew before the HTTP-only session expires. The parent issues a new
          // short-lived launch token, so no reusable Omitech credential is kept here.
          const refreshAfterMs = Math.max(60, payload.expires_in - 120) * 1000;
          refreshTimer = setTimeout(requestRefresh, refreshAfterMs);
        }
        return;
      }
      setMessage(payload.error || 'Open Learning Studio from your Omitech Agent workspace.');
      setState('blocked');
    };
    const handleMessage = (event: MessageEvent) => {
      if (
        event.source !== window.parent ||
        !allowedParentOrigins().has(event.origin) ||
        !event.data ||
        typeof event.data !== 'object' ||
        event.data.type !== 'omitech:learning-studio:launch' ||
        typeof event.data.token !== 'string'
      ) {
        return;
      }
      void connect(event.data.token).catch(() => {
        if (!cancelled) {
          setMessage('Learning Studio could not verify your Omitech Agent session.');
          setState('blocked');
        }
      });
    };
    window.addEventListener('message', handleMessage);
    for (const origin of allowedParentOrigins()) {
      window.parent.postMessage({ type: 'omitech:learning-studio:ready' }, origin);
    }
    void connect().catch(() => {
      if (!cancelled) {
        setMessage('Learning Studio could not verify your Omitech Agent session.');
        setState('blocked');
      }
    });
    return () => {
      cancelled = true;
      if (refreshTimer) clearTimeout(refreshTimer);
      window.removeEventListener('message', handleMessage);
    };
  }, [setNickname]);

  if (state === 'ready') return children;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <section className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-xl">
        <img
          src="/omitech-learning-studio-logo.svg"
          alt="Omitech Learning Studio"
          className="mx-auto h-14 w-auto"
        />
        <p className="mt-5 text-sm text-muted-foreground">{message}</p>
        {state === 'blocked' ? (
          <a
            href={process.env.NEXT_PUBLIC_OMITECH_AGENT_URL || 'http://127.0.0.1:1420/learning-studio'}
            className="mt-6 inline-flex rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Return to Omitech Agent
          </a>
        ) : (
          <div className="mx-auto mt-6 h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        )}
      </section>
    </main>
  );
}
