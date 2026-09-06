'use client';
import { useState } from 'react';
import { type EducationArtifact, parseEducationContent } from '@/lib/education/artifacts';
import {
  downloadResource,
  printResource,
  resourceBlocks,
  type DocumentEdition,
} from '@/lib/education/export';
import { useLearningResourcesStore } from '@/lib/store/learning-resources';
import { Button } from '@/components/ui/button';
import { PracticePanel } from './practice-panel';
import { ResearchHandoffPanel } from './research-handoff';

export function ResourceView({ artifact }: { artifact: EducationArtifact }) {
  const [tab, setTab] = useState<'read' | 'edit' | 'practice'>('read');
  const [edition, setEdition] = useState<DocumentEdition>(
    artifact.brief.output === 'assessment' ? 'student' : 'full',
  );
  const [edited, setEdited] = useState(() => structuredClone(artifact.content));
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const updateContent = useLearningResourcesStore((state) => state.updateContent);
  const remove = useLearningResourcesStore((state) => state.remove);
  const download = async (format: 'docx' | 'md' | 'html') => {
    setDownloading(true);
    setError('');
    try {
      await downloadResource(artifact, format, edition);
    } catch {
      setError('Download failed. Your saved resource is still available.');
    } finally {
      setDownloading(false);
    }
  };
  return (
    <article className="rounded-2xl border p-4 space-y-4" aria-label="Saved learning resource">
      <header className="space-y-2">
        <h3 className="text-lg font-semibold">{artifact.content.title}</h3>
        <p className="text-xs text-muted-foreground">
          Saved {new Date(artifact.updatedAt).toLocaleString()} · {artifact.brief.language} ·{' '}
          {artifact.brief.level}
        </p>
        <p className="text-xs text-muted-foreground">
          AI-generated draft. Review factual claims and source support before teaching or
          submission.
        </p>
      </header>
      <div className="flex flex-wrap gap-2" aria-label="Resource actions">
        {(['read', 'edit', 'practice'] as const).map((value) => (
          <Button
            key={value}
            size="sm"
            variant={tab === value ? 'default' : 'outline'}
            onClick={() => {
              setTab(value);
              if (value === 'edit') setEdited(structuredClone(artifact.content));
            }}
          >
            {value === 'read' ? 'Read' : value === 'edit' ? 'Edit resource' : 'Practise'}
          </Button>
        ))}
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            if (window.confirm('Delete this resource and its practice history?'))
              remove(artifact.id);
          }}
        >
          Delete resource
        </Button>
      </div>
      <section className="rounded-xl bg-muted/40 p-3 space-y-2" aria-label="Download resource">
        <p className="text-sm font-semibold">Download this resource</p>
        {artifact.brief.output === 'assessment' && (
          <label className="block text-sm">
            Edition{' '}
            <select
              className="rounded border p-1"
              value={edition}
              onChange={(e) => setEdition(e.target.value as DocumentEdition)}
            >
              <option value="student">Student handout (no answers)</option>
              <option value="answer-key">Separate answer key and rubric</option>
            </select>
          </label>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={downloading}
            onClick={() => void download('docx')}
          >
            Word (.docx)
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              try {
                printResource(artifact, edition);
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Print failed.');
              }
            }}
          >
            PDF / Print
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={downloading}
            onClick={() => void download('md')}
          >
            Markdown
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={downloading}
            onClick={() => void download('html')}
          >
            Offline reading (.html)
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          For PDF, choose Save as PDF in the print dialog. These downloads contain the structured
          resource; classroom slides and simulations have their own download menu.
        </p>
      </section>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {tab === 'read' && (
        <div className="max-h-[600px] overflow-auto space-y-4">
          {resourceBlocks(artifact, edition).map((block, index) => (
            <section key={index}>
              <h4 className="font-semibold">{block.heading}</h4>
              {block.paragraphs.map((text, i) => (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6" key={i}>
                  {text}
                </p>
              ))}
            </section>
          ))}
        </div>
      )}
      {tab === 'practice' && <PracticePanel artifact={artifact} />}
      {tab === 'edit' && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            try {
              const content = parseEducationContent(JSON.stringify(edited), artifact.brief);
              updateContent(artifact.id, content);
              setTab('read');
              setError('');
            } catch {
              setError(
                'Check that all required text, questions and source references are complete.',
              );
            }
          }}
        >
          <p className="text-xs text-muted-foreground">
            Editing questions or flashcards resets practice for this resource so results remain
            meaningful.
          </p>
          <EditText
            label="Resource title"
            value={edited.title}
            onChange={(title) => setEdited({ ...edited, title })}
          />
          <EditText
            label="Objectives (one per line)"
            value={edited.objectives.join('\n')}
            onChange={(value) => setEdited({ ...edited, objectives: value.split('\n') })}
          />
          {edited.sections.map((section, i) => (
            <fieldset key={i} className="rounded border p-3 space-y-2">
              <legend>Section {i + 1}</legend>
              <EditText
                label="Heading"
                value={section.heading}
                onChange={(heading) =>
                  setEdited({
                    ...edited,
                    sections: edited.sections.map((s, j) => (j === i ? { ...s, heading } : s)),
                  })
                }
              />
              <EditText
                label="Content"
                value={section.body}
                onChange={(body) =>
                  setEdited({
                    ...edited,
                    sections: edited.sections.map((s, j) => (j === i ? { ...s, body } : s)),
                  })
                }
              />
            </fieldset>
          ))}
          {edited.questions.map((question, i) => (
            <fieldset key={i} className="rounded border p-3 space-y-2">
              <legend>Question {i + 1}</legend>
              {(['prompt', 'topic', 'answer', 'hint', 'explanation'] as const).map((field) => (
                <EditText
                  key={field}
                  label={field}
                  value={question[field]}
                  onChange={(value) =>
                    setEdited({
                      ...edited,
                      questions: edited.questions.map((q, j) =>
                        j === i ? { ...q, [field]: value } : q,
                      ),
                    })
                  }
                />
              ))}
              {question.options.length > 0 && (
                <>
                  <EditText
                    label="Choices (one per line)"
                    value={question.options.join('\n')}
                    onChange={(value) =>
                      setEdited({
                        ...edited,
                        questions: edited.questions.map((q, j) =>
                          j === i ? { ...q, options: value.split('\n') } : q,
                        ),
                      })
                    }
                  />
                  <label className="text-sm">
                    Correct choice{' '}
                    <select
                      value={question.correctOption ?? 0}
                      onChange={(e) =>
                        setEdited({
                          ...edited,
                          questions: edited.questions.map((q, j) =>
                            j === i ? { ...q, correctOption: Number(e.target.value) } : q,
                          ),
                        })
                      }
                    >
                      {question.options.map((option, n) => (
                        <option key={n} value={n}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
            </fieldset>
          ))}
          {edited.flashcards.map((card, i) => (
            <fieldset key={i} className="rounded border p-3 space-y-2">
              <legend>Flashcard {i + 1}</legend>
              {(['front', 'back', 'topic'] as const).map((field) => (
                <EditText
                  key={field}
                  label={field}
                  value={card[field]}
                  onChange={(value) =>
                    setEdited({
                      ...edited,
                      flashcards: edited.flashcards.map((c, j) =>
                        j === i ? { ...c, [field]: value } : c,
                      ),
                    })
                  }
                />
              ))}
            </fieldset>
          ))}
          {edited.rubric.map((criterion, i) => (
            <fieldset key={i} className="rounded border p-3 space-y-2">
              <legend>Rubric {i + 1}</legend>
              {(['criterion', 'guidance'] as const).map((field) => (
                <EditText
                  key={field}
                  label={field}
                  value={criterion[field]}
                  onChange={(value) =>
                    setEdited({
                      ...edited,
                      rubric: edited.rubric.map((r, j) => (j === i ? { ...r, [field]: value } : r)),
                    })
                  }
                />
              ))}
            </fieldset>
          ))}
          <Button type="submit">Save changes</Button>
        </form>
      )}
      <ResearchHandoffPanel key={artifact.id} artifact={artifact} />
    </article>
  );
}

function EditText({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm capitalize">
      {label}
      <textarea
        className="mt-1 w-full rounded border p-2"
        rows={value.length > 200 ? 5 : 2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
