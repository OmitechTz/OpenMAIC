'use client';
import { useState } from 'react';
import type { EducationArtifact } from '@/lib/education/artifacts';
import { makeResearchHandoff } from '@/lib/education/research-handoff';
import { handoffResearchToParent } from '@/lib/omitech/parent-navigation';
import { Button } from '@/components/ui/button';

export function ResearchHandoffPanel({ artifact }: { artifact: EducationArtifact }) {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState(artifact.brief.topic);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const excerpts = artifact.brief.sources
    .filter((source) => source.id in selected)
    .map((source) => ({ title: source.title, text: selected[source.id] }));
  return (
    <section className="space-y-3 rounded-xl border p-4">
      <Button variant="outline" onClick={() => setOpen((value) => !value)}>
        Draft a manuscript in Research Studio
      </Button>
      {open && (
        <div className="space-y-3">
          <p className="text-sm">
            Review exactly what will cross into Research Studio. No files, full course, credentials,
            or other materials are transferred. Research starts only when you submit its form.
          </p>
          <label className="block text-sm">
            Research question
            <textarea
              className="mt-1 w-full rounded border p-2"
              value={topic}
              maxLength={1000}
              onChange={(e) => setTopic(e.target.value)}
            />
          </label>
          <p className="text-xs text-muted-foreground">
            Optional source excerpts (2,000 characters total including titles). Nothing is selected
            by default.
          </p>
          {artifact.brief.sources.map((source) => (
            <div key={source.id} className="space-y-2">
              <label className="text-sm">
                <input
                  type="checkbox"
                  checked={source.id in selected}
                  onChange={(event) => {
                    setSelected((current) => {
                      const next = { ...current };
                      if (event.target.checked) next[source.id] = '';
                      else delete next[source.id];
                      return next;
                    });
                  }}
                />{' '}
                {source.title}
              </label>
              {source.id in selected && (
                <label className="block text-xs">
                  Paste the excerpt you want to transfer
                  <textarea
                    className="mt-1 w-full rounded border p-2"
                    value={selected[source.id]}
                    maxLength={1800}
                    onChange={(e) =>
                      setSelected((current) => ({ ...current, [source.id]: e.target.value }))
                    }
                  />
                </label>
              )}
            </div>
          ))}
          <p className="text-xs">
            Selected excerpt characters:{' '}
            {excerpts.reduce(
              (sum, source) => sum + source.title.length + source.text.length + 2,
              0,
            )}
          </p>
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          <Button
            onClick={() => {
              try {
                if (excerpts.some((source) => !source.text.trim()))
                  throw new Error('Paste an excerpt for each selected source or deselect it.');
                const payload = makeResearchHandoff(topic, excerpts);
                if (!handoffResearchToParent(payload))
                  throw new Error(
                    'Open Learning Studio inside Omitech Agent to transfer this brief.',
                  );
                setError('');
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Handoff failed.');
              }
            }}
          >
            Transfer selected text and open Research Studio
          </Button>
        </div>
      )}
    </section>
  );
}
