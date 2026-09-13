'use client';
import { useSettingsStore } from '@/lib/store/settings';
import { useProviderHealth } from '@/lib/store/provider-health';
import { hasUsableLLMProvider } from '@/lib/store/settings-validation';
import { Button } from '@/components/ui/button';

export function GenerationReadiness({ onConfigure }: { onConfigure: () => void }) {
  const providers = useSettingsStore((s) => s.providersConfig);
  const retry = useSettingsStore((s) => s.fetchServerProviders);
  const { status, message } = useProviderHealth();
  const ready = hasUsableLLMProvider(providers);
  return (
    <div
      className="mt-2 flex flex-wrap items-center gap-2 text-sm"
      role="status"
      id="generation-readiness"
    >
      <span>
        {status === 'error'
          ? message
          : ready
            ? 'AI connection configured. Generation will verify provider availability.'
            : status === 'checking'
              ? 'Checking your AI connection…'
              : 'Your prompt can be saved. Connect an AI provider to create a learning experience.'}
      </span>
      {(!ready || status === 'error') && (
        <>
          <Button size="sm" variant="outline" onClick={onConfigure}>
            Connect AI
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={status === 'checking'}
            onClick={() => void retry()}
          >
            Check again
          </Button>
        </>
      )}
    </div>
  );
}
