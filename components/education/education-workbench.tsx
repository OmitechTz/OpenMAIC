'use client';
import { useEffect, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import { Button } from '@/components/ui/button';
import { useLearningResourcesStore } from '@/lib/store/learning-resources';
import {
  useEducationStudioStore,
  type EducationCourse,
  type StudioMode,
} from '@/lib/store/education-studio';
import { useSettingsStore } from '@/lib/store/settings';
import { isLLMProviderConfigured } from '@/lib/store/settings-validation';
import { getCurrentModelConfig } from '@/lib/utils/model-config';
import { briefSchema, OUTPUT_LABELS, parseEducationContent } from '@/lib/education/artifacts';
import {
  EDUCATION_WORKFLOWS,
  buildEducationWorkflowPrompt,
  type EducationWorkflowId,
} from '@/lib/education/workflows';
import { STUDENT_WORKFLOWS, TEACHER_OUTPUTS } from '@/lib/education/student-workflows';
import { importSourceText } from '@/lib/education/source-import';
import type { SelectedCourseMaterial } from '@/lib/types/generation';
import { ResourceView } from './resource-view';
import { toast } from 'sonner';

export function EducationWorkbench({
  mode,
  course,
  currentMaterials,
  onClassroomPrompt,
}: {
  mode: StudioMode;
  course?: EducationCourse;
  currentMaterials: SelectedCourseMaterial[];
  onClassroomPrompt: (prompt: string) => void;
}) {
  const draft = useLearningResourcesStore((s) => s.draft);
  const setDraft = useLearningResourcesStore((s) => s.setDraft);
  const save = useLearningResourcesStore((s) => s.save);
  const artifacts = useLearningResourcesStore((s) => s.artifacts);
  const composer = useLearningResourcesStore((s) => s.composer);
  const setComposer = useLearningResourcesStore((s) => s.setComposer);
  const { target, workflow, instruction } =
    composer.mode === mode
      ? composer
      : {
          target: mode === 'teacher' ? ('lesson-plan' as const) : ('study-notes' as const),
          workflow: mode === 'teacher' ? ('lesson-plan' as const) : ('study-support' as const),
          instruction: '',
        };
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const [sourceTitle, setSourceTitle] = useState('');
  const [sourceText, setSourceText] = useState('');
  const controller = useRef<AbortController | null>(null);
  const importController = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(
    () => () => {
      controller.current?.abort();
      importController.current?.abort();
    },
    [],
  );
  const presets =
    mode === 'student'
      ? STUDENT_WORKFLOWS
      : Object.entries(EDUCATION_WORKFLOWS).map(([id, item]) => ({
          id,
          title: item.title,
          description: item.description,
          workflowId: id as EducationWorkflowId,
          output: TEACHER_OUTPUTS[id as EducationWorkflowId],
          instruction: item.teacherInstruction,
        }));
  const selected = artifacts.find((a) => a.id === selectedId);
  const relevant = artifacts.filter((a) => !course || a.courseId === course.id);
  const readFile = async (file: File) => {
    const abort = new AbortController();
    importController.current?.abort();
    importController.current = abort;
    setImporting(true);
    setError('');
    try {
      const text = await importSourceText(file, abort.signal);
      if (abort.signal.aborted) return;
      setSourceTitle(file.name);
      setSourceText(text);
      if (text.length > 20000)
        setError(
          'This document is long. Select and keep an excerpt of at most 20,000 characters before adding it.',
        );
    } catch (e) {
      if (!abort.signal.aborted) setError(e instanceof Error ? e.message : 'Import failed.');
    } finally {
      if (importController.current === abort) setImporting(false);
    }
  };
  const generate = async () => {
    setError('');
    const validated = briefSchema.safeParse({
      ...draft,
      mode,
      output: target === 'classroom' ? draft.output : target,
    });
    if (!validated.success) {
      setError(validated.error.issues[0]?.message || 'Complete your brief.');
      return;
    }
    const brief = validated.data;
    setDraft({ mode });
    if (target === 'classroom') {
      const education = useEducationStudioStore.getState();
      const prompt = buildEducationWorkflowPrompt({
        workflowId: workflow,
        mode,
        course,
        roleIds: mode === 'student' ? ['student-tutor'] : education.teachingRoleIds,
        guardrails: education.guardrails,
      });
      onClassroomPrompt(
        `${prompt}\nTopic: ${brief.topic}\nLevel: ${brief.level}; language: ${brief.language}; duration: ${brief.minutes} minutes; class size: ${brief.classSize}.\nCurriculum: ${brief.curriculum}\nGoals: ${brief.objectives}\n${instruction}\n${brief.sources.map((s) => `Source [${s.id}] ${s.title}:\n${s.text}`).join('\n\n')}`,
      );
      toast.success(
        'Your classroom brief is ready in the composer. Choose interactive mode if needed, then generate.',
      );
      return;
    }
    const state = useSettingsStore.getState();
    const provider = state.providersConfig[state.providerId];
    if (!provider || !isLLMProviderConfigured(provider)) {
      setError(
        'Choose a connected model in the model picker above, or add your API key in Settings.',
      );
      return;
    }
    const config = getCurrentModelConfig();
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    try {
      const body = {
        ...brief,
        objectives: [instruction, brief.objectives].filter(Boolean).join('\n'),
        thinkingConfig: config.thinkingConfig,
      };
      const response = await fetch('/api/education/generate', {
        method: 'POST',
        signal: abort.signal,
        headers: {
          'content-type': 'application/json',
          'x-model': config.modelString,
          ...(config.apiKey ? { 'x-api-key': config.apiKey } : {}),
          ...(config.baseUrl ? { 'x-base-url': config.baseUrl } : {}),
          ...(config.providerType ? { 'x-provider-type': config.providerType } : {}),
        },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success)
        throw new Error(payload.error || 'Resource generation failed.');
      const content = parseEducationContent(JSON.stringify(payload.content), brief);
      if (abort.signal.aborted) return;
      setSelectedId(save(brief, content, course?.id || null));
      toast.success('Resource saved. You can read, edit, download and practise below.');
    } catch (e) {
      setError(
        abort.signal.aborted
          ? 'Generation cancelled. Your brief is saved.'
          : e instanceof Error
            ? e.message
            : 'Generation failed. Your brief is saved.',
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {presets.map((preset) => (
          <button
            type="button"
            key={preset.id}
            disabled={busy}
            className="rounded-xl border p-4 text-left hover:border-primary focus-visible:outline-primary"
            onClick={() => {
              setComposer({
                mode,
                workflow: preset.workflowId,
                instruction: preset.instruction,
                target: preset.output,
              });
              setDraft({
                mode,
                ...(preset.output !== 'classroom' ? { output: preset.output } : {}),
                ...(course ? { level: course.level } : {}),
              });
            }}
          >
            <p className="text-sm font-semibold">{preset.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{preset.description}</p>
          </button>
        ))}
      </div>
      <form
        className="space-y-3 rounded-2xl border bg-muted/20 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          void generate();
        }}
        aria-label="Learning resource brief"
      >
        <fieldset disabled={busy} className="space-y-3">
          <legend className="font-semibold">Customize your learning output</legend>
          <label className="block text-sm">
            Topic or learning question
            <textarea
              required
              minLength={3}
              maxLength={1000}
              className="mt-1 w-full rounded border bg-background p-2"
              value={draft.topic}
              onChange={(e) => setDraft({ topic: e.target.value })}
              placeholder="Why is shipping important in Tanzania and Africa?"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm">
              Create
              <select
                className="mt-1 block w-full rounded border bg-background p-2"
                value={target}
                onChange={(e) => {
                  const output = e.target.value as typeof target;
                  setComposer({ mode, target: output, workflow, instruction });
                  if (output !== 'classroom') setDraft({ output });
                }}
              >
                <option value="classroom">Interactive classroom / lecture slides</option>
                {Object.entries(OUTPUT_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <Field
              label="Learning level"
              value={draft.level}
              onChange={(level) => setDraft({ level })}
            />
            <Field
              label="Language"
              value={draft.language}
              onChange={(language) => setDraft({ language })}
            />
            <Field
              label={mode === 'teacher' ? 'Lesson duration (minutes)' : 'Study minutes per day'}
              type="number"
              value={String(draft.minutes)}
              onChange={(minutes) => setDraft({ minutes: Number(minutes) })}
              min={5}
              max={240}
            />
            {mode === 'teacher' ? (
              <Field
                label="Class size"
                type="number"
                value={String(draft.classSize)}
                onChange={(value) => setDraft({ classSize: Number(value) })}
                min={1}
                max={1000}
              />
            ) : (
              <Field
                label="Exam date (optional)"
                type="date"
                value={draft.examDate}
                onChange={(examDate) => setDraft({ examDate })}
              />
            )}
            <Field
              label="Practice / assessment questions"
              type="number"
              value={String(draft.questionCount)}
              onChange={(value) => setDraft({ questionCount: Number(value) })}
              min={1}
              max={30}
            />
          </div>
          <Field
            label="Curriculum or course requirements (optional)"
            value={draft.curriculum}
            onChange={(curriculum) => setDraft({ curriculum })}
          />
          <label className="block text-sm">
            Goals, available materials or your attempted answer
            <textarea
              className="mt-1 w-full rounded border bg-background p-2"
              maxLength={2500}
              value={draft.objectives}
              onChange={(e) => setDraft({ objectives: e.target.value })}
            />
          </label>
          <details className="rounded-xl border bg-background p-3">
            <summary className="cursor-pointer text-sm font-medium">
              Sources and notes ({draft.sources.length} selected)
            </summary>
            <p className="my-2 text-xs text-muted-foreground">
              Only excerpts added here are sent for this resource. Import uses your Document Parsing
              settings. Review extracted text before adding it.
            </p>
            <input
              ref={fileInput}
              type="file"
              accept=".txt,.md,.pdf,.docx"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void readFile(file);
                e.target.value = '';
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={importing}
              onClick={() => fileInput.current?.click()}
            >
              {importing ? 'Importing…' : 'Import a source file'}
            </Button>
            {currentMaterials.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {currentMaterials.map((material) => (
                  <Button
                    type="button"
                    key={material.id}
                    size="sm"
                    variant="outline"
                    disabled={importing}
                    onClick={() => void readFile(material.file)}
                  >
                    Import excerpt: {material.name}
                  </Button>
                ))}
              </div>
            )}
            <Field label="Source title" value={sourceTitle} onChange={setSourceTitle} />
            <label className="mt-2 block text-sm">
              Source excerpt
              <textarea
                rows={5}
                className="mt-1 w-full rounded border p-2"
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
              />
            </label>
            <p className="text-xs">
              {sourceText.length.toLocaleString()} / 20,000 characters per excerpt; 60,000 total.
            </p>
            <Button
              type="button"
              size="sm"
              disabled={
                !sourceTitle.trim() ||
                !sourceText.trim() ||
                sourceText.length > 20000 ||
                sourceTitle.length > 200 ||
                draft.sources.length >= 10
              }
              onClick={() => {
                if (
                  draft.sources.reduce((sum, s) => sum + s.text.length, 0) + sourceText.length >
                  60000
                ) {
                  setError(
                    'Selected sources exceed 60,000 characters. Shorten or remove an excerpt.',
                  );
                  return;
                }
                setDraft({
                  sources: [
                    ...draft.sources,
                    { id: nanoid(10), title: sourceTitle.trim(), text: sourceText.trim() },
                  ],
                });
                setSourceTitle('');
                setSourceText('');
              }}
            >
              Add this excerpt
            </Button>
            {draft.sources.map((source) => (
              <details key={source.id} className="mt-2 rounded border p-2">
                <summary>
                  {source.title} · {source.text.length} characters
                </summary>
                <p className="my-2 max-h-40 overflow-auto whitespace-pre-wrap text-xs">
                  {source.text}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setDraft({ sources: draft.sources.filter((s) => s.id !== source.id) })
                  }
                >
                  Remove excerpt
                </Button>
              </details>
            ))}
          </details>
          <Button type="submit" disabled={importing}>
            {busy
              ? 'Generating…'
              : target === 'classroom'
                ? 'Prepare classroom brief'
                : 'Generate and save resource'}
          </Button>
        </fieldset>
        {busy && (
          <Button type="button" variant="outline" onClick={() => controller.current?.abort()}>
            Cancel generation
          </Button>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Your brief is saved as you work. Document generation uses the model selected above.
          Classroom generation continues through the existing preview and interactive lesson
          builder.
        </p>
      </form>
      <section className="space-y-3" aria-label="Saved resources">
        <h3 className="font-semibold">Saved resources{course ? ` · ${course.name}` : ''}</h3>
        {!relevant.length ? (
          <p className="text-sm text-muted-foreground">
            Generate a resource to start your library, downloads and practice history.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {relevant.map((artifact) => (
              <Button
                type="button"
                key={artifact.id}
                variant={selectedId === artifact.id ? 'default' : 'outline'}
                onClick={() => setSelectedId(artifact.id)}
              >
                {artifact.content.title}
              </Button>
            ))}
          </div>
        )}
        {selected && (!course || selected.courseId === course.id) && (
          <ResourceView key={selected.id} artifact={selected} />
        )}
      </section>
    </div>
  );
}
function Field({
  label,
  value,
  onChange,
  type = 'text',
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  min?: number;
  max?: number;
}) {
  return (
    <label className="block text-sm">
      {label}
      <input
        type={type}
        value={value}
        min={min}
        max={max}
        className="mt-1 block w-full rounded border bg-background p-2"
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
