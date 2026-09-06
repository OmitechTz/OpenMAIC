'use client';
import { useEffect, useRef, useState } from 'react';

/** Only reviewed text crosses this bridge; recording and credentials stay in the parent. */
export function OmitechVoiceInput({ origins }: { origins: Set<string> }) {
  const [field, setField] = useState<HTMLTextAreaElement | null>(null);
  const [text, setText] = useState('');
  const [waiting, setWaiting] = useState(false);
  const request = useRef<string | null>(null);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (window.parent === window || !origins.size) return;
    const focus = (event: FocusEvent) => {
      if (request.current) return;
      const el = event.target;
      if (el instanceof HTMLTextAreaElement && !el.disabled && !el.readOnly && !el.closest('[data-omitech-voice]') && !/key|secret|token|password/i.test(el.name + el.id)) setField(el);
    };
    const receive = (event: MessageEvent) => {
      if (event.source !== window.parent || !origins.has(event.origin) || event.data?.type !== 'omitech:learning-studio:voice-result' || event.data.requestId !== request.current) return;
      request.current = null; setWaiting(false);
      if (typeof event.data.text === 'string' && event.data.text.length <= 20000) setText(event.data.text);
      else setNotice('Dictation closed. You can try again.');
    };
    window.addEventListener('focusin', focus); window.addEventListener('message', receive);
    return () => { window.removeEventListener('focusin', focus); window.removeEventListener('message', receive); };
  }, [origins]);
  if (!field) return null;
  return <div data-omitech-voice className="fixed bottom-4 right-4 z-[100] max-w-sm rounded-xl border border-border bg-card p-3 text-card-foreground shadow-lg">
    <button type="button" disabled={waiting} onClick={() => {
      request.current = crypto.randomUUID(); setWaiting(true); setNotice('Use the voice panel above Learning Studio.');
      for (const origin of origins) window.parent.postMessage({ type: 'omitech:learning-studio:voice-request', requestId: request.current }, origin);
    }}>{waiting ? 'Dictation open in Omitech Agent…' : 'Dictate with Omitech Agent'}</button>
    {text && <><textarea aria-label="Reviewed voice transcript" value={text} onChange={(e) => setText(e.target.value)} className="my-2 w-full rounded border p-2" />
      <button type="button" onClick={() => {
        const next = [field.value.trimEnd(), text.trim()].filter(Boolean).join('\n');
        if (!field.isConnected || field.disabled || field.readOnly || (field.maxLength >= 0 && next.length > field.maxLength)) { setNotice('The original field is unavailable or too short. Copy your transcript or select another field.'); return; }
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(field, next);
        field.dispatchEvent(new Event('input', { bubbles: true })); field.dispatchEvent(new Event('change', { bubbles: true }));
        setText(''); setField(null);
      }}>Insert transcript into field</button></>}
    {notice && <p role="status" className="mt-1 text-xs">{notice}</p>}
    <button type="button" className="ml-3 text-xs" onClick={() => { request.current = null; setWaiting(false); setField(null); setText(''); }}>Close</button>
  </div>;
}
