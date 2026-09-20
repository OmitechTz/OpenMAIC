'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  BrainCircuit,
  CalendarDays,
  Check,
  ClipboardCheck,
  Download,
  FileText,
  GraduationCap,
  Library,
  Loader2,
  Presentation,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  TEACHING_TEMPLATES,
  teachingTemplateBrief,
  type TeachingTemplate,
} from '@/lib/education/teaching-templates';
import {
  buildEducationWorkflowPrompt,
  EDUCATION_WORKFLOWS,
  TEACHING_ROLE_COPY,
  type EducationWorkflowId,
} from '@/lib/education/workflows';
import {
  briefSchema,
  parseEducationContent,
  type EducationOutput,
} from '@/lib/education/artifacts';
import { downloadResource } from '@/lib/education/export';
import { downloadDmiResourcePresentation } from '@/lib/education/dmi-presentation-template';
import { useLearningResourcesStore } from '@/lib/store/learning-resources';
import { useSettingsStore } from '@/lib/store/settings';
import { isLLMProviderConfigured } from '@/lib/store/settings-validation';
import { getCurrentModelConfig } from '@/lib/utils/model-config';
import { type TeachingRoleId, useEducationStudioStore } from '@/lib/store/education-studio';
import { cn } from '@/lib/utils/cn';

const ROLE_ICONS: Record<TeachingRoleId, typeof BookOpen> = {
  'course-designer': CalendarDays,
  'subject-expert': BookOpen,
  'assessment-coach': ClipboardCheck,
  'research-assistant': BrainCircuit,
  'presentation-designer': Presentation,
  'student-tutor': GraduationCap,
};

const WORKFLOW_ICONS: Record<EducationWorkflowId, typeof BookOpen> = {
  'lesson-plan': CalendarDays,
  syllabus: Library,
  'lecture-slides': Presentation,
  assessment: ClipboardCheck,
  'class-activity': Users,
  'research-synthesis': BrainCircuit,
  'student-feedback': FileText,
  'study-support': GraduationCap,
};

/** research-synthesis needs supplied source excerpts; this page has none, so it
 * falls back to a lesson pack while keeping the synthesis instruction. */
const WORKFLOW_OUTPUT: Record<EducationWorkflowId, EducationOutput> = {
  'lesson-plan': 'lesson-plan',
  syllabus: 'syllabus',
  'lecture-slides': 'lesson-pack',
  assessment: 'assessment',
  'class-activity': 'activity',
  'research-synthesis': 'lesson-pack',
  'student-feedback': 'feedback',
  'study-support': 'study-pack',
};

const DMI_PROFILE_DEFAULTS = {
  semester: 'Semester 1',
  academicYear: '',
  lecturer: '',
  primary: '#12345B',
  accent: '#D6A84B',
  headingFont: 'Aptos Display',
  bodyFont: 'Aptos',
  footer: 'Dar es Salaam Maritime Institute',
};

export function TeachingHub() {
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [workflowId, setWorkflowId] = useState<EducationWorkflowId | null>(null);
  const [topic, setTopic] = useState('');
  const [busy, setBusy] = useState(false);
  const [pptxBusy, setPptxBusy] = useState(false);
  const [error, setError] = useState('');
  const [stage, setStage] = useState('');
  const [artifactId, setArtifactId] = useState<string | null>(null);

  const teachingRoleIds = useEducationStudioStore((state) => state.teachingRoleIds);
  const toggleTeachingRole = useEducationStudioStore((state) => state.toggleTeachingRole);
  const guardrails = useEducationStudioStore((state) => state.guardrails);
  const artifact = useLearningResourcesStore((state) =>
    state.artifacts.find((item) => item.id === artifactId),
  );

  const template: TeachingTemplate | undefined = TEACHING_TEMPLATES.find(
    (item) => item.id === templateId,
  );
  const workflow = workflowId ? EDUCATION_WORKFLOWS[workflowId] : undefined;

  const chooseTemplate = (item: TeachingTemplate) => {
    setTemplateId(item.id);
    setTopic(item.topic);
    setArtifactId(null);
    setError('');
  };

  const generate = async () => {
    setError('');
    setStage('');
    if (!template || !workflowId || !workflow) {
      setError('Choose a semester subject and a teaching workflow first.');
      return;
    }
    const output = WORKFLOW_OUTPUT[workflowId];
    const base = teachingTemplateBrief(template, output === 'syllabus' ? 'syllabus' : 'lesson-pack');
    const prompt = buildEducationWorkflowPrompt({
      workflowId,
      mode: 'teacher',
      roleIds: teachingRoleIds,
      guardrails,
    });
    const validated = briefSchema.safeParse({
      ...base,
      output,
      topic: topic.trim() || base.topic,
      objectives: [prompt, base.objectives].join('\n'),
    });
    if (!validated.success) {
      setError(validated.error.issues[0]?.message || 'Complete your teaching brief.');
      return;
    }
    const brief = validated.data;

    const settingsState = useSettingsStore.getState();
    const provider = settingsState.providersConfig[settingsState.providerId];
    if (!provider || !isLLMProviderConfigured(provider)) {
      setError(
        'Choose a connected model in the Learning Studio settings, or ask your administrator to configure the server model.',
      );
      return;
    }
    const config = getCurrentModelConfig();
    setBusy(true);
    setStage('Generating your teaching materials…');
    try {
      const response = await fetch('/api/education/generate', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-model': config.modelString,
          ...(config.apiKey ? { 'x-api-key': config.apiKey } : {}),
          ...(config.baseUrl ? { 'x-base-url': config.baseUrl } : {}),
          ...(config.providerType ? { 'x-provider-type': config.providerType } : {}),
        },
        body: JSON.stringify({ ...brief, thinkingConfig: config.thinkingConfig }),
        signal: AbortSignal.timeout(180000),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success)
        throw new Error(payload.error || 'Material generation failed.');
      setStage('Checking structure, questions and source references…');
      const content = parseEducationContent(JSON.stringify(payload.content), brief);
      setArtifactId(useLearningResourcesStore.getState().save(brief, content, null));
      setStage('Materials ready. Review them before sharing with your class.');
      toast.success(`${workflow.title} is ready to review and download`);
    } catch (cause) {
      setStage('');
      setError(cause instanceof Error ? cause.message : 'Generation failed. Please retry.');
    } finally {
      setBusy(false);
    }
  };

  const downloadPptx = async () => {
    if (!artifact || !template) return;
    setPptxBusy(true);
    try {
      await downloadDmiResourcePresentation(
        {
          courseCode: template.code,
          courseName: template.title,
          ...DMI_PROFILE_DEFAULTS,
        },
        artifact,
      );
      toast.success('DMI-branded PowerPoint downloaded');
    } catch {
      toast.error('The PowerPoint could not be created. Retry the download.');
    } finally {
      setPptxBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-muted/30">
      <header className="bg-[#12345B] text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[#D6A84B] text-[#12345B]">
              <GraduationCap className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Dar es Salaam Maritime Institute</p>
              <p className="text-xs text-white/70">DMI Teaching Hub</p>
            </div>
          </div>
          <nav className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="inline-flex h-9 items-center rounded-xl border border-white/25 px-3 text-xs font-semibold text-white transition hover:bg-white/10"
            >
              My courses
            </Link>
            <Link
              href="/learning-studio"
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/25 px-3 text-xs font-semibold text-white transition hover:bg-white/10"
            >
              <Sparkles className="size-3.5" />
              Open the full Learning Studio
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <section className="pt-10 text-center" aria-label="Teaching hub introduction">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            What are you teaching today?
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground">
            Choose a DMI semester subject and a teaching workflow, then generate reviewed
            materials and a downloadable DMI-branded PowerPoint. Generated content is a starting
            point — review it against the approved syllabus before teaching.
          </p>
        </section>

        <section className="mt-8" aria-label="Teaching roles">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {(Object.keys(TEACHING_ROLE_COPY) as TeachingRoleId[]).map((id) => {
              const role = TEACHING_ROLE_COPY[id];
              const Icon = ROLE_ICONS[id];
              const active = teachingRoleIds.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleTeachingRole(id)}
                  aria-pressed={active}
                  title={role.description}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition',
                    active
                      ? 'border-primary/50 bg-primary/10 text-primary'
                      : 'border-border bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground',
                  )}
                >
                  <Icon className="size-3.5" />
                  {role.name}
                  {active ? <Check className="size-3" /> : null}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Teaching perspectives guide the generated materials. They do not represent independent
            specialist reviews.
          </p>
        </section>

        <section className="mt-10" aria-label="DMI semester subjects">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            1 · Choose your semester subject
          </h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {TEACHING_TEMPLATES.map((item) => {
              const active = item.id === templateId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => chooseTemplate(item)}
                  aria-pressed={active}
                  className={cn(
                    'rounded-2xl border bg-background p-4 text-left transition',
                    active
                      ? 'border-primary/60 shadow-md ring-2 ring-primary/20'
                      : 'border-border/70 hover:border-primary/30',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                      {item.code} · {item.programme} {item.year}
                    </p>
                    {active ? <Check className="size-4 shrink-0 text-primary" /> : null}
                  </div>
                  <p className="mt-1 font-semibold">{item.title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.description}</p>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Software: {item.software.join(' · ')}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-10" aria-label="Teaching workflows">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            2 · Choose a teaching workflow
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(Object.entries(EDUCATION_WORKFLOWS) as [EducationWorkflowId, typeof workflow][]).map(
              ([id, item]) => {
                const Icon = WORKFLOW_ICONS[id];
                const active = id === workflowId;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setWorkflowId(id);
                      setArtifactId(null);
                      setError('');
                    }}
                    aria-pressed={active}
                    className={cn(
                      'rounded-2xl border bg-background p-4 text-left transition',
                      active
                        ? 'border-primary/60 shadow-md ring-2 ring-primary/20'
                        : 'border-border/70 hover:border-primary/30',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div
                        className={cn(
                          'flex size-9 items-center justify-center rounded-xl',
                          active
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        <Icon className="size-4" />
                      </div>
                      {active ? <Check className="size-4 text-primary" /> : null}
                    </div>
                    <p className="mt-3 text-sm font-semibold">{item!.title}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {item!.description}
                    </p>
                  </button>
                );
              },
            )}
          </div>
        </section>

        <section
          className="mt-10 rounded-3xl border border-border/70 bg-background p-5 shadow-sm sm:p-6"
          aria-label="Generate teaching materials"
        >
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            3 · Generate and download
          </h2>
          <label className="mt-4 block text-xs font-medium">
            Topic or learning question
            <textarea
              rows={2}
              maxLength={20000}
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              placeholder="Choose a semester subject above to prefill its starter topic"
              className="mt-1.5 w-full rounded-xl border border-border bg-background p-3 text-sm outline-none focus:border-primary"
            />
          </label>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              disabled={busy || !template || !workflowId}
              onClick={() => void generate()}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {busy ? 'Generating…' : 'Generate teaching materials'}
            </Button>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <ShieldCheck className="size-3.5 text-emerald-600" />
              {template && workflow
                ? `${template.code} ${template.title} · ${workflow.title}`
                : 'Select a subject and a workflow to continue'}
            </div>
          </div>
          {stage ? (
            <p role="status" className="mt-3 text-sm">
              {stage}
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="mt-3 text-sm text-red-600">
              {error}
            </p>
          ) : null}

          {artifact ? (
            <div className="mt-5 rounded-2xl border border-border/70 bg-muted/25 p-4">
              <p className="text-sm font-semibold">{artifact.content.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {artifact.content.sections.length} teaching sections ·{' '}
                {artifact.content.questions.length} practice questions ·{' '}
                {artifact.content.objectives.length} objectives
              </p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-xs leading-5 text-muted-foreground">
                {artifact.content.objectives.slice(0, 4).map((objective) => (
                  <li key={objective}>{objective}</li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={pptxBusy}
                  onClick={() => void downloadPptx()}
                >
                  {pptxBusy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Presentation className="size-4" />
                  )}
                  Download DMI PowerPoint
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void downloadResource(artifact, 'docx', 'full')}
                >
                  <Download className="size-4" /> Word document
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void downloadResource(artifact, 'md', 'full')}
                >
                  <Download className="size-4" /> Markdown
                </Button>
                <Button type="button" variant="ghost" asChild>
                  <Link href="/learning-studio">Continue in the Learning Studio</Link>
                </Button>
              </div>
              <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
                The PowerPoint uses the DMI master with lecturer answers and marking guidance in
                speaker notes. Review factual claims, equations, units and source attributions
                before delivery.
              </p>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
