'use client';

import { useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  BrainCircuit,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardCheck,
  Cloud,
  FileText,
  FolderOpen,
  GraduationCap,
  Library,
  Link2,
  Loader2,
  Mail,
  Plus,
  Presentation,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  buildEducationWorkflowPrompt,
  EDUCATION_WORKFLOWS,
  TEACHING_ROLE_COPY,
  type AssessmentOptions,
  type EducationWorkflowId,
} from '@/lib/education/workflows';
import { navigateOmitechParent } from '@/lib/omitech/parent-navigation';
import {
  type EducationIntegrationId,
  type EducationLevel,
  type TeachingRoleId,
  useEducationStudioStore,
} from '@/lib/store/education-studio';
import type { SelectedCourseMaterial } from '@/lib/types/generation';
import { deleteDocumentBlob, loadDocumentBlob, storeDocumentBlob } from '@/lib/utils/image-storage';
import { cn } from '@/lib/utils/cn';

type StudioTab = 'create' | 'library' | 'team' | 'progress' | 'integrations';

interface LearningStudioHubProps {
  generatedExperienceCount: number;
  currentMaterials: SelectedCourseMaterial[];
  onMaterialsAdd: (files: File[]) => void;
  onPromptChange: (prompt: string) => void;
  onFocusComposer: () => void;
}

const LEVELS: { id: EducationLevel; label: string }[] = [
  { id: 'primary', label: 'Primary school' },
  { id: 'secondary', label: 'Secondary school' },
  { id: 'undergraduate', label: 'Undergraduate' },
  { id: 'postgraduate', label: 'Postgraduate' },
  { id: 'professional', label: 'Professional learning' },
];

const WORKFLOW_ICONS: Record<EducationWorkflowId, typeof BookOpen> = {
  'lesson-plan': BookOpen,
  syllabus: CalendarDays,
  'lecture-slides': Presentation,
  assessment: ClipboardCheck,
  'class-activity': Users,
  'research-synthesis': BrainCircuit,
  'student-feedback': FileText,
  'study-support': GraduationCap,
};

const ROLE_ICONS: Record<TeachingRoleId, typeof BookOpen> = {
  'course-designer': CalendarDays,
  'subject-expert': BookOpen,
  'assessment-coach': ClipboardCheck,
  'research-assistant': BrainCircuit,
  'presentation-designer': Presentation,
  'student-tutor': GraduationCap,
};

const INTEGRATIONS: {
  id: EducationIntegrationId;
  name: string;
  description: string;
  icon: typeof Cloud;
}[] = [
  {
    id: 'omitech-agent',
    name: 'Omitech Agent',
    description: 'Documents, presentations, calendar, tasks, diagrams, and recordings.',
    icon: Sparkles,
  },
  {
    id: 'google-classroom',
    name: 'Google Classroom',
    description: 'Prepare course and assignment synchronization.',
    icon: GraduationCap,
  },
  {
    id: 'moodle',
    name: 'Moodle',
    description: 'Configure an institutional Moodle URL.',
    icon: Cloud,
  },
  {
    id: 'canvas',
    name: 'Canvas',
    description: 'Configure a Canvas institution workspace.',
    icon: Cloud,
  },
  {
    id: 'microsoft-teams',
    name: 'Microsoft Teams',
    description: 'Prepare Teams for Education course synchronization.',
    icon: Users,
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    description: 'Prepare a shared course-material workspace.',
    icon: FolderOpen,
  },
  {
    id: 'onedrive',
    name: 'OneDrive',
    description: 'Prepare a Microsoft course library.',
    icon: FolderOpen,
  },
  {
    id: 'zotero',
    name: 'Zotero',
    description: 'Configure a research library or group.',
    icon: Library,
  },
];

const OMITECH_TOOLS = [
  { label: 'Documents', path: '/documents', icon: FileText },
  { label: 'Presentations', path: '/presentations', icon: Presentation },
  { label: 'Calendar', path: '/calendar', icon: CalendarDays },
  { label: 'Tasks', path: '/todos', icon: Check },
  { label: 'Diagrams', path: '/flow-diagrams', icon: BrainCircuit },
  { label: 'Recordings', path: '/transcribe', icon: Mail },
] as const;

const DEFAULT_ASSESSMENT: AssessmentOptions = {
  questionCount: 10,
  difficulty: 'mixed',
  bloomLevel: 'mixed',
  questionTypes: ['multiple choice', 'short answer'],
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function CourseDialog({ onClose }: { onClose: () => void }) {
  const createCourse = useEducationStudioStore((state) => state.createCourse);
  const institution = useEducationStudioStore((state) => state.institution);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [subject, setSubject] = useState('');
  const [level, setLevel] = useState<EducationLevel>('undergraduate');
  const [term, setTerm] = useState('');
  const [audience, setAudience] = useState('');

  const save = () => {
    if (!name.trim()) return;
    createCourse({
      name,
      code,
      subject,
      level,
      term,
      audience,
      institution: institution.name,
    });
    toast.success(`${name.trim()} is ready`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-course-title"
        className="w-full max-w-2xl rounded-3xl border border-border bg-background p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              Course workspace
            </p>
            <h2 id="new-course-title" className="mt-1 text-xl font-semibold">
              Create a course
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Group resources, teaching roles, learning experiences, and assessments by course.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-2 hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-medium sm:col-span-2">
            Course name
            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Introduction to Economics"
              className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="text-xs font-medium">
            Course code
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="ECO 101"
              className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="text-xs font-medium">
            Subject
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Economics"
              className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="text-xs font-medium">
            Education level
            <select
              value={level}
              onChange={(event) => setLevel(event.target.value as EducationLevel)}
              className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            >
              {LEVELS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium">
            Academic term
            <input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Semester 1 · 2026"
              className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="text-xs font-medium sm:col-span-2">
            Learner audience
            <input
              value={audience}
              onChange={(event) => setAudience(event.target.value)}
              placeholder="First-year students; mixed prior knowledge"
              className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!name.trim()}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            Create course
          </button>
        </div>
      </div>
    </div>
  );
}

function IntegrationDialog({ id, onClose }: { id: EducationIntegrationId; onClose: () => void }) {
  const integration = useEducationStudioStore((state) => state.integrations[id]);
  const configure = useEducationStudioStore((state) => state.configureIntegration);
  const definition = INTEGRATIONS.find((item) => item.id === id)!;
  const [endpoint, setEndpoint] = useState(integration.endpoint);
  const [workspace, setWorkspace] = useState(integration.workspace);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg rounded-3xl border border-border bg-background p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              Integration setup
            </p>
            <h2 className="mt-1 text-xl font-semibold">{definition.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{definition.description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-2 hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="mt-6 space-y-4">
          <label className="block text-xs font-medium">
            Institution or service URL
            <input
              value={endpoint}
              onChange={(event) => setEndpoint(event.target.value)}
              placeholder="https://your-institution.example"
              className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="block text-xs font-medium">
            Course, workspace, or library name
            <input
              value={workspace}
              onChange={(event) => setWorkspace(event.target.value)}
              placeholder="Teaching workspace"
              className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </label>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-200">
            This saves the institution configuration. An administrator must add the provider&apos;s
            OAuth or API credentials before live synchronization can be enabled.
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              configure(id, { endpoint: endpoint.trim(), workspace: workspace.trim() });
              toast.success(`${definition.name} configuration saved`);
              onClose();
            }}
            disabled={!endpoint.trim()}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            Save configuration
          </button>
        </div>
      </div>
    </div>
  );
}

export function LearningStudioHub({
  generatedExperienceCount,
  currentMaterials,
  onMaterialsAdd,
  onPromptChange,
  onFocusComposer,
}: LearningStudioHubProps) {
  const [tab, setTab] = useState<StudioTab>('create');
  const [expanded, setExpanded] = useState(true);
  const [courseDialogOpen, setCourseDialogOpen] = useState(false);
  const [integrationDialog, setIntegrationDialog] = useState<EducationIntegrationId | null>(null);
  const [assessment, setAssessment] = useState<AssessmentOptions>(DEFAULT_ASSESSMENT);
  const [resourceBusy, setResourceBusy] = useState(false);
  const resourceInputRef = useRef<HTMLInputElement>(null);

  const mode = useEducationStudioStore((state) => state.mode);
  const setMode = useEducationStudioStore((state) => state.setMode);
  const courses = useEducationStudioStore((state) => state.courses);
  const selectedCourseId = useEducationStudioStore((state) => state.selectedCourseId);
  const selectCourse = useEducationStudioStore((state) => state.selectCourse);
  const resources = useEducationStudioStore((state) => state.resources);
  const addResource = useEducationStudioStore((state) => state.addResource);
  const removeResource = useEducationStudioStore((state) => state.removeResource);
  const teachingRoleIds = useEducationStudioStore((state) => state.teachingRoleIds);
  const toggleTeachingRole = useEducationStudioStore((state) => state.toggleTeachingRole);
  const guardrails = useEducationStudioStore((state) => state.guardrails);
  const updateGuardrails = useEducationStudioStore((state) => state.updateGuardrails);
  const institution = useEducationStudioStore((state) => state.institution);
  const updateInstitution = useEducationStudioStore((state) => state.updateInstitution);
  const integrations = useEducationStudioStore((state) => state.integrations);
  const disconnectIntegration = useEducationStudioStore((state) => state.disconnectIntegration);

  const selectedCourse = courses.find((course) => course.id === selectedCourseId);
  const courseResources = resources.filter((resource) => resource.courseId === selectedCourseId);
  const configuredIntegrations = Object.values(integrations).filter(
    (integration) => integration.status !== 'not_configured',
  ).length;
  const attachedFingerprints = useMemo(
    () => new Set(currentMaterials.map((material) => `${material.name}:${material.size}`)),
    [currentMaterials],
  );

  const chooseWorkflow = (workflowId: EducationWorkflowId) => {
    const prompt = buildEducationWorkflowPrompt({
      workflowId,
      mode,
      course: selectedCourse,
      roleIds: teachingRoleIds,
      guardrails,
      assessment,
    });
    onPromptChange(prompt);
    onFocusComposer();
    toast.success(`${EDUCATION_WORKFLOWS[workflowId].title} is ready to customize`);
  };

  const uploadResources = async (files: File[]) => {
    if (!selectedCourse) {
      setCourseDialogOpen(true);
      toast.info('Create or select a course before adding resources');
      return;
    }
    const existing = new Set(
      courseResources.map((resource) => `${resource.name}:${resource.size}`),
    );
    const unique = files.filter((file) => !existing.has(`${file.name}:${file.size}`));
    if (unique.length === 0) {
      toast.info('Those resources are already in this course');
      return;
    }
    setResourceBusy(true);
    try {
      for (const file of unique) {
        const storageKey = await storeDocumentBlob(file);
        addResource({
          courseId: selectedCourse.id,
          name: file.name,
          size: file.size,
          mimeType: file.type || 'application/octet-stream',
          storageKey,
        });
      }
      onMaterialsAdd(unique);
      toast.success(`${unique.length} course resource${unique.length === 1 ? '' : 's'} added`);
    } catch {
      toast.error('A course resource could not be stored');
    } finally {
      setResourceBusy(false);
    }
  };

  const attachResource = async (resource: (typeof resources)[number]) => {
    if (attachedFingerprints.has(`${resource.name}:${resource.size}`)) {
      toast.info(`${resource.name} is already attached`);
      return;
    }
    const blob = await loadDocumentBlob(resource.storageKey);
    if (!blob) {
      toast.error('This resource is not available on this device');
      return;
    }
    onMaterialsAdd([
      new File([blob], resource.name, { type: resource.mimeType, lastModified: resource.addedAt }),
    ]);
    toast.success(`${resource.name} attached to the next learning experience`);
  };

  const deleteResource = async (resource: (typeof resources)[number]) => {
    await deleteDocumentBlob(resource.storageKey).catch(() => undefined);
    removeResource(resource.id);
    toast.success('Resource removed');
  };

  const tabs: { id: StudioTab; label: string; icon: typeof BookOpen }[] = [
    { id: 'create', label: 'Create', icon: Sparkles },
    { id: 'library', label: 'Course library', icon: Library },
    { id: 'team', label: 'Teaching team', icon: Users },
    { id: 'progress', label: 'Dashboard', icon: BarChart3 },
    { id: 'integrations', label: 'Integrations', icon: Link2 },
  ];

  return (
    <section
      className="relative z-20 mt-7 w-full max-w-6xl"
      aria-label="Omitech Learning Studio tools"
    >
      <div className="overflow-hidden rounded-3xl border border-border/70 bg-background/82 shadow-xl shadow-slate-950/[0.04] backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <GraduationCap className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {selectedCourse ? selectedCourse.name : 'Set up your first course'}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {selectedCourse
                  ? [selectedCourse.code, selectedCourse.term, selectedCourse.audience]
                      .filter(Boolean)
                      .join(' · ') || 'Course workspace'
                  : 'Organize resources, teaching roles, lessons, assessments, and progress'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {courses.length > 0 ? (
              <label className="relative">
                <span className="sr-only">Select course</span>
                <select
                  value={selectedCourseId ?? ''}
                  onChange={(event) => selectCourse(event.target.value || null)}
                  className="h-8 appearance-none rounded-xl border border-border bg-background pl-3 pr-8 text-xs font-medium outline-none focus:border-primary"
                >
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 size-3 text-muted-foreground" />
              </label>
            ) : null}
            <button
              type="button"
              onClick={() => setCourseDialogOpen(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-semibold hover:bg-muted"
            >
              <Plus className="size-3.5" /> Course
            </button>
            <div className="flex h-8 rounded-xl bg-muted p-0.5" aria-label="Learning Studio mode">
              {(['teacher', 'student'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setMode(item)}
                  className={cn(
                    'rounded-[10px] px-3 text-xs font-semibold capitalize transition',
                    mode === item
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {item}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              aria-expanded={expanded}
              className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ChevronDown
                className={cn('size-4 transition-transform', expanded && 'rotate-180')}
              />
            </button>
          </div>
        </div>

        {expanded ? (
          <>
            <nav
              className="flex gap-1 overflow-x-auto border-b border-border/60 px-3 py-2 sm:px-5"
              aria-label="Learning Studio sections"
            >
              {tabs.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    className={cn(
                      'inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition',
                      tab === item.id
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <Icon className="size-3.5" /> {item.label}
                  </button>
                );
              })}
            </nav>

            <div className="p-4 sm:p-5">
              {tab === 'create' ? (
                <div>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold">
                        {mode === 'teacher'
                          ? 'What are you teaching today?'
                          : 'What would you like to learn?'}
                      </h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Choose a workflow, then refine the generated brief in the composer above.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
                      <ShieldCheck className="size-3.5 text-emerald-600" />
                      {mode === 'teacher'
                        ? `${teachingRoleIds.length} teaching roles active`
                        : 'Guided-learning safeguards active'}
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {(Object.keys(EDUCATION_WORKFLOWS) as EducationWorkflowId[]).map((id) => {
                      const workflow = EDUCATION_WORKFLOWS[id];
                      const Icon = WORKFLOW_ICONS[id];
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => chooseWorkflow(id)}
                          className="group rounded-2xl border border-border/70 bg-background p-4 text-left transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lg hover:shadow-primary/[0.06]"
                        >
                          <div className="flex size-9 items-center justify-center rounded-xl bg-primary/8 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                            <Icon className="size-4" />
                          </div>
                          <p className="mt-3 text-sm font-semibold">{workflow.title}</p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            {workflow.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-4 grid gap-3 rounded-2xl border border-border/70 bg-muted/25 p-4 md:grid-cols-4">
                    <label className="text-[11px] font-medium">
                      Assessment questions
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={assessment.questionCount}
                        onChange={(event) =>
                          setAssessment((current) => ({
                            ...current,
                            questionCount: Math.max(
                              1,
                              Math.min(100, Number(event.target.value) || 1),
                            ),
                          }))
                        }
                        className="mt-1.5 h-9 w-full rounded-xl border border-border bg-background px-3 text-xs"
                      />
                    </label>
                    <label className="text-[11px] font-medium">
                      Difficulty
                      <select
                        value={assessment.difficulty}
                        onChange={(event) =>
                          setAssessment((current) => ({
                            ...current,
                            difficulty: event.target.value as AssessmentOptions['difficulty'],
                          }))
                        }
                        className="mt-1.5 h-9 w-full rounded-xl border border-border bg-background px-3 text-xs"
                      >
                        <option value="introductory">Introductory</option>
                        <option value="mixed">Mixed</option>
                        <option value="advanced">Advanced</option>
                      </select>
                    </label>
                    <label className="text-[11px] font-medium">
                      Bloom level
                      <select
                        value={assessment.bloomLevel}
                        onChange={(event) =>
                          setAssessment((current) => ({
                            ...current,
                            bloomLevel: event.target.value as AssessmentOptions['bloomLevel'],
                          }))
                        }
                        className="mt-1.5 h-9 w-full rounded-xl border border-border bg-background px-3 text-xs"
                      >
                        <option value="mixed">Mixed</option>
                        <option value="remember-understand">Remember & understand</option>
                        <option value="apply-analyse">Apply & analyse</option>
                        <option value="evaluate-create">Evaluate & create</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={() => chooseWorkflow('assessment')}
                      className="mt-auto inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground"
                    >
                      <ClipboardCheck className="size-3.5" />
                      Build assessment
                    </button>
                  </div>
                </div>
              ) : null}

              {tab === 'library' ? (
                <div>
                  <input
                    ref={resourceInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md,.csv,.xlsx,.xls,image/*"
                    onChange={(event) => {
                      const files = Array.from(event.target.files ?? []);
                      event.target.value = '';
                      void uploadResources(files);
                    }}
                  />
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold">Course knowledge library</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Syllabi, readings, slides, research, rubrics, and policies stay on this
                        device.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => resourceInputRef.current?.click()}
                      disabled={resourceBusy}
                      className="inline-flex h-9 items-center gap-2 rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                    >
                      {resourceBusy ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Upload className="size-3.5" />
                      )}
                      Add resources
                    </button>
                  </div>
                  {!selectedCourse ? (
                    <button
                      type="button"
                      onClick={() => setCourseDialogOpen(true)}
                      className="mt-5 w-full rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-8 text-sm text-primary"
                    >
                      Create a course to start its knowledge library
                    </button>
                  ) : courseResources.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => resourceInputRef.current?.click()}
                      className="mt-5 w-full rounded-2xl border border-dashed border-border p-8 text-center"
                    >
                      <Library className="mx-auto size-7 text-muted-foreground" />
                      <p className="mt-2 text-sm font-medium">No course resources yet</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Upload material once, then attach it to any new lesson or assessment.
                      </p>
                    </button>
                  ) : (
                    <div className="mt-5 grid gap-2 md:grid-cols-2">
                      {courseResources.map((resource) => {
                        const attached = attachedFingerprints.has(
                          `${resource.name}:${resource.size}`,
                        );
                        return (
                          <div
                            key={resource.id}
                            className="flex items-center gap-3 rounded-2xl border border-border/70 p-3"
                          >
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                              <FileText className="size-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-semibold">{resource.name}</p>
                              <p className="mt-0.5 text-[10px] text-muted-foreground">
                                {formatBytes(resource.size)} · Local course resource
                              </p>
                            </div>
                            <button
                              type="button"
                              disabled={attached}
                              onClick={() => void attachResource(resource)}
                              className="rounded-lg border border-border px-2.5 py-1.5 text-[10px] font-semibold hover:bg-muted disabled:text-emerald-600 disabled:opacity-100"
                            >
                              {attached ? 'Attached' : 'Attach'}
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteResource(resource)}
                              aria-label={`Remove ${resource.name}`}
                              className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : null}

              {tab === 'team' ? (
                <div>
                  <div>
                    <h3 className="text-sm font-semibold">AI teaching team</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Selected roles collaborate in every generated brief.
                    </p>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                          className={cn(
                            'rounded-2xl border p-4 text-left transition',
                            active
                              ? 'border-primary/40 bg-primary/6'
                              : 'border-border/70 hover:border-primary/25',
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
                            {active ? (
                              <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                                Active
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-3 text-sm font-semibold">{role.name}</p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            {role.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-5 rounded-2xl border border-border/70 bg-muted/25 p-4">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="size-4 text-emerald-600" />
                      <h4 className="text-xs font-semibold">Student-safe learning controls</h4>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                      {(
                        Object.entries({
                          socraticGuidance: 'Socratic guidance',
                          hintsBeforeAnswers: 'Hints before answers',
                          explainReasoning: 'Explain reasoning',
                          sourceCitations: 'Source citations',
                          teacherReview: 'Teacher review',
                        }) as [keyof typeof guardrails, string][]
                      ).map(([key, label]) => (
                        <label
                          key={key}
                          className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-[11px] font-medium"
                        >
                          <input
                            type="checkbox"
                            checked={guardrails[key]}
                            onChange={(event) => updateGuardrails({ [key]: event.target.checked })}
                            className="accent-[var(--primary)]"
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              {tab === 'progress' ? (
                <div>
                  <div>
                    <h3 className="text-sm font-semibold">Teacher dashboard</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      A private overview of your teaching workspace. Student performance is not
                      collected automatically.
                    </p>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      { label: 'Courses', value: courses.length, icon: BookOpen },
                      {
                        label: 'Learning experiences',
                        value: generatedExperienceCount,
                        icon: Sparkles,
                      },
                      { label: 'Course resources', value: resources.length, icon: Library },
                      {
                        label: 'Configured connections',
                        value: configuredIntegrations,
                        icon: Link2,
                      },
                    ].map((metric) => (
                      <div
                        key={metric.label}
                        className="rounded-2xl border border-border/70 bg-background p-4"
                      >
                        <metric.icon className="size-4 text-primary" />
                        <p className="mt-3 text-2xl font-semibold tabular-nums">{metric.value}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{metric.label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
                    <div className="rounded-2xl border border-border/70 p-4">
                      <h4 className="text-xs font-semibold">Course readiness</h4>
                      <div className="mt-3 space-y-3">
                        {courses.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            Create a course to start tracking readiness.
                          </p>
                        ) : (
                          courses.slice(0, 5).map((course) => {
                            const count = resources.filter(
                              (resource) => resource.courseId === course.id,
                            ).length;
                            const readiness = Math.min(
                              100,
                              25 + Math.min(count, 5) * 15 + (teachingRoleIds.length > 0 ? 15 : 0),
                            );
                            return (
                              <div key={course.id}>
                                <div className="flex justify-between gap-3 text-[11px]">
                                  <span className="truncate font-medium">{course.name}</span>
                                  <span className="text-muted-foreground">{readiness}% ready</span>
                                </div>
                                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                                  <div
                                    className="h-full rounded-full bg-primary"
                                    style={{ width: `${readiness}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-emerald-50/50 p-4 dark:bg-emerald-950/15">
                      <ShieldCheck className="size-5 text-emerald-600" />
                      <h4 className="mt-3 text-sm font-semibold">Privacy-first analytics</h4>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        This dashboard measures your content setup, not student surveillance.
                        Participation and achievement data can be added later only with
                        institutional approval.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {tab === 'integrations' ? (
                <div>
                  <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                    <div className="rounded-2xl border border-border/70 p-4">
                      <div className="flex items-center gap-2">
                        <Sparkles className="size-4 text-primary" />
                        <h3 className="text-sm font-semibold">Continue in Omitech Agent</h3>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Move teaching work into the tools already included with your workspace.
                      </p>
                      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {OMITECH_TOOLS.map((tool) => (
                          <button
                            key={tool.path}
                            type="button"
                            onClick={() => navigateOmitechParent(tool.path)}
                            className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-[11px] font-medium hover:border-primary/30 hover:bg-primary/5"
                          >
                            <tool.icon className="size-3.5 text-primary" />
                            {tool.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border/70 p-4">
                      <div className="flex items-center gap-2">
                        <Settings2 className="size-4 text-primary" />
                        <h3 className="text-sm font-semibold">Institution branding</h3>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_0.65fr_auto]">
                        <label className="text-[11px] font-medium">
                          Institution name
                          <input
                            value={institution.name}
                            onChange={(event) => updateInstitution({ name: event.target.value })}
                            placeholder="Your school or university"
                            className="mt-1.5 h-9 w-full rounded-xl border border-border bg-background px-3 text-xs"
                          />
                        </label>
                        <label className="text-[11px] font-medium">
                          Short name
                          <input
                            value={institution.shortName}
                            onChange={(event) =>
                              updateInstitution({ shortName: event.target.value })
                            }
                            placeholder="Institution"
                            className="mt-1.5 h-9 w-full rounded-xl border border-border bg-background px-3 text-xs"
                          />
                        </label>
                        <label className="text-[11px] font-medium">
                          Accent
                          <input
                            type="color"
                            value={institution.primaryColor}
                            onChange={(event) =>
                              updateInstitution({ primaryColor: event.target.value })
                            }
                            className="mt-1.5 block h-9 w-14 cursor-pointer rounded-xl border border-border bg-background p-1"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {INTEGRATIONS.map((definition) => {
                      const state = integrations[definition.id];
                      const Icon = definition.icon;
                      return (
                        <div
                          key={definition.id}
                          className="rounded-2xl border border-border/70 p-4"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex size-9 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                              <Icon className="size-4" />
                            </div>
                            <span
                              className={cn(
                                'rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-wide',
                                state.status === 'connected'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : state.status === 'configured'
                                    ? 'bg-sky-50 text-sky-700'
                                    : 'bg-muted text-muted-foreground',
                              )}
                            >
                              {state.status.replace('_', ' ')}
                            </span>
                          </div>
                          <p className="mt-3 text-sm font-semibold">{definition.name}</p>
                          <p className="mt-1 min-h-10 text-[11px] leading-5 text-muted-foreground">
                            {definition.description}
                          </p>
                          {definition.id === 'omitech-agent' ? (
                            <p className="mt-3 text-[10px] font-medium text-emerald-700">
                              Securely connected
                            </p>
                          ) : (
                            <div className="mt-3 flex gap-2">
                              <button
                                type="button"
                                onClick={() => setIntegrationDialog(definition.id)}
                                className="rounded-lg border border-border px-2.5 py-1.5 text-[10px] font-semibold hover:bg-muted"
                              >
                                {state.status === 'configured' ? 'Edit' : 'Configure'}
                              </button>
                              {state.status === 'configured' ? (
                                <button
                                  type="button"
                                  onClick={() => disconnectIntegration(definition.id)}
                                  className="rounded-lg px-2 py-1.5 text-[10px] text-red-600 hover:bg-red-50"
                                >
                                  Remove
                                </button>
                              ) : null}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
      {courseDialogOpen ? <CourseDialog onClose={() => setCourseDialogOpen(false)} /> : null}
      {integrationDialog ? (
        <IntegrationDialog id={integrationDialog} onClose={() => setIntegrationDialog(null)} />
      ) : null}
    </section>
  );
}
