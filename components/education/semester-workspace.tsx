'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { nanoid } from 'nanoid';
import { Button } from '@/components/ui/button';
import {
  classroomApi,
  downloadClassroomFile,
  downloadText,
  type Announcement,
  type Assignment,
  type ManagedCourse,
  type SemesterMaterial,
  type SemesterWorkspace,
} from '@/lib/education/classroom-api';
import { briefSchema, parseEducationContent } from '@/lib/education/artifacts';
import { useEducationStudioStore } from '@/lib/store/education-studio';
import { useLearningResourcesStore } from '@/lib/store/learning-resources';
import { useSettingsStore } from '@/lib/store/settings';
import { isLLMProviderConfigured } from '@/lib/store/settings-validation';
import { getCurrentModelConfig } from '@/lib/utils/model-config';
import { AcademicOperations } from './academic-operations';
import { downloadMasterPresentationTemplate } from '@/lib/education/master-presentation-template';

const field = 'block w-full rounded-lg border bg-background p-2 text-sm';
const MATERIALS: { id: SemesterMaterial; label: string }[] = [
  { id: 'lecturer-notes', label: 'Lecturer notes' },
  { id: 'student-notes', label: 'Student notes' },
  { id: 'presentation', label: 'PPTX' },
  { id: 'software-lab', label: 'Software lab' },
  { id: 'exercise', label: 'Exercise' },
  { id: 'quiz', label: 'Quiz' },
  { id: 'assignment', label: 'Assignment' },
  { id: 'answer-key', label: 'Lecturer answers' },
  { id: 'diagram', label: 'Technical diagrams' },
];

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

function groundedSources(
  workspace: SemesterWorkspace,
  sourceIds: string[],
): { id: string; title: string; text: string; location: string }[] {
  let remaining = 60000;
  return workspace.sources
    .filter((source) => sourceIds.includes(source.id) && source.text.trim())
    .slice(0, 10)
    .map((source) => {
      const text = source.text.slice(0, remaining);
      remaining -= text.length;
      return {
        id: source.id,
        title: source.title,
        text,
        location: source.location || source.reference,
      };
    })
    .filter((source) => source.text.length > 0);
}

function offlineSemesterGuide(
  course: ManagedCourse,
  workspace: SemesterWorkspace,
  announcements: Announcement[],
) {
  const weeks = workspace.weeks.filter(
    (week) => course.role !== 'student' || week.status === 'published',
  );
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(course.name)}</title><style>body{font:16px/1.55 system-ui;max-width:850px;margin:auto;padding:24px}article{border:1px solid #bbb;border-radius:8px;padding:12px;margin:12px 0}h1,h2{color:#12345b}@media print{body{max-width:none}article{break-inside:avoid}}</style></head><body><h1>${escapeHtml(course.code)} ${escapeHtml(course.name)}</h1><p>${escapeHtml(workspace.semester)} · ${escapeHtml(workspace.academic_year)}</p><h2>Announcements and dates</h2>${announcements.map((item) => `<article><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.body)}</p><small>${item.starts_at ? `Starts ${escapeHtml(new Date(item.starts_at).toLocaleString())}` : ''}${item.due_at ? ` · Due ${escapeHtml(new Date(item.due_at).toLocaleString())}` : ''}</small></article>`).join('')}<h2>Weekly plan</h2>${weeks.map((week) => `<article><strong>Week ${week.week}: ${escapeHtml(week.title)}</strong><p>${escapeHtml(week.topic)}</p><ul>${week.outcomes.map((outcome) => `<li>${escapeHtml(outcome)}</li>`).join('')}</ul><p><small>Materials: ${escapeHtml(week.materials.join(', '))}${week.software.length ? ` · Software: ${escapeHtml(week.software.join(', '))}` : ''}</small></p></article>`).join('')}<p>This lightweight guide contains the plan only. Download individual assigned lessons for full offline content and answer recovery.</p></body></html>`;
}

export function StudentJoinPanel({ onJoined }: { onJoined: () => Promise<void> }) {
  const [code, setCode] = useState('');
  const [registration, setRegistration] = useState('');
  const [programme, setProgramme] = useState('BMTE');
  const [year, setYear] = useState(3);
  const [academicYear, setAcademicYear] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void classroomApi<{
      registration_number: string;
      programme: string;
      year_of_study: number;
      academic_year: string;
    } | null>('student-profile')
      .then((profile) => {
        if (!profile) return;
        setRegistration(profile.registration_number);
        setProgramme(profile.programme);
        setYear(profile.year_of_study);
        setAcademicYear(profile.academic_year);
      })
      .catch(() => undefined);
  }, []);
  return (
    <details className="rounded-xl border p-3">
      <summary>Join a semester class with your unique code</summary>
      <form
        className="mt-3 grid gap-2 md:grid-cols-2"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setMessage('');
          try {
            const result = await classroomApi<{ status: string }>('join', {
              code,
              profile: {
                registration_number: registration,
                programme,
                year_of_study: year,
                academic_year: academicYear,
              },
            });
            setMessage(
              result.status === 'pending'
                ? 'Request sent. Your lecturer must approve access.'
                : 'Class access is ready.',
            );
            await onJoined();
          } catch (error) {
            setMessage((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Class join code
          <input
            className={field}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
        </label>
        <label>
          Registration number
          <input
            className={field}
            value={registration}
            onChange={(e) => setRegistration(e.target.value)}
            required
          />
        </label>
        <label>
          Programme
          <input
            className={field}
            value={programme}
            onChange={(e) => setProgramme(e.target.value)}
            required
          />
        </label>
        <label>
          Year of study
          <input
            className={field}
            type="number"
            min={1}
            max={8}
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            required
          />
        </label>
        <label>
          Academic year
          <input
            className={field}
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            placeholder="2026/2027"
            required
          />
        </label>
        <Button className="self-end" disabled={busy}>
          {busy ? 'Joining…' : 'Save profile and join'}
        </Button>
      </form>
      {message && (
        <p className="mt-2 text-sm" role="status">
          {message}
        </p>
      )}
    </details>
  );
}

const STARTER_UNITS = [
  'Course orientation and foundations',
  'Core concepts and terminology',
  'Methods and worked examples',
  'Applied practice',
  'Analysis and troubleshooting',
  'Integrated project',
];

function starterWeeks() {
  const weeks = Array.from({ length: 15 }, (_, index) => {
    const week = index + 1;
    const unit = STARTER_UNITS[Math.min(Math.floor(index / 2), STARTER_UNITS.length - 1)];
    const ending =
      week === 13
        ? 'Integrated project'
        : week === 14
          ? 'Assessment and revision'
          : week === 15
            ? 'Feedback and consolidation'
            : unit;
    return {
      id: nanoid(),
      week,
      title: ending,
      topic: ending,
      outcomes: [] as string[],
      materials: [
        'lecturer-notes',
        'student-notes',
        'presentation',
        week % 2 === 0 ? 'software-lab' : 'exercise',
        'quiz',
      ] as SemesterMaterial[],
      status: 'planned' as const,
      software: [] as string[],
      lab_steps:
        week % 2 === 0
          ? [
              'Install or open the approved software.',
              'Load the starter data or simulation.',
              'Follow the worked procedure.',
              'Capture and explain the expected output.',
              'Record one troubleshooting observation.',
            ]
          : [],
      expected_output:
        week % 2 === 0 ? 'A saved working file, output evidence, and a short interpretation.' : '',
      troubleshooting:
        week % 2 === 0
          ? [
              'Check versions and file paths.',
              'Compare inputs, units, and settings with the worked example.',
            ]
          : [],
      source_ids: [],
    };
  });
  return weeks;
}

export function SemesterOperations({
  course,
  members,
  assignments,
  onReload,
}: {
  course: ManagedCourse;
  members: { id: number; user_id: number; name: string; email: string; role: string }[];
  assignments: Assignment[];
  onReload: () => Promise<void>;
}) {
  const [workspace, setWorkspace] = useState<SemesterWorkspace>();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [requests, setRequests] = useState<
    {
      id: number;
      name: string;
      email: string;
      status: string;
      profile_snapshot: Record<string, unknown>;
    }[]
  >([]);
  const [review, setReview] = useState<{
    weeks: number;
    weeks_published: number;
    draft_lessons: number;
    published_lessons: number;
    assignments: number;
    ungraded_submissions: number;
    pending_enrollment: number;
    quality_issues: string[];
  }>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinCodes, setJoinCodes] = useState<
    {
      id: number;
      code_hint: string;
      require_approval: boolean;
      max_uses: number | null;
      use_count: number;
      expires_at: string | null;
      revoked_at: string | null;
    }[]
  >([]);
  const [joinMaxUses, setJoinMaxUses] = useState(100);
  const [joinExpiry, setJoinExpiry] = useState('');
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementBody, setAnnouncementBody] = useState('');
  const [announcementKind, setAnnouncementKind] = useState<Announcement['kind']>('announcement');
  const [announcementStarts, setAnnouncementStarts] = useState('');
  const [announcementDue, setAnnouncementDue] = useState('');
  const [sourceTitle, setSourceTitle] = useState('');
  const [sourceAuthor, setSourceAuthor] = useState('');
  const [sourceYear, setSourceYear] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceReference, setSourceReference] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [sourceLocation, setSourceLocation] = useState('');
  const [copyName, setCopyName] = useState(`${course.name} — next semester`);
  const [copyTerm, setCopyTerm] = useState('');
  const [copyAcademicYear, setCopyAcademicYear] = useState('');
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [batchProgress, setBatchProgress] = useState('');
  const staff = course.role !== 'student';
  const edit = course.role === 'owner' || course.role === 'teacher';

  const load = useCallback(async () => {
    const [semester, notices] = await Promise.all([
      classroomApi<SemesterWorkspace>(`classrooms/${course.id}/semester`),
      classroomApi<Announcement[]>(`classrooms/${course.id}/announcements`),
    ]);
    setWorkspace(semester);
    setAnnouncements(notices);
    if (staff) {
      const [enrollment, dashboard] = await Promise.all([
        classroomApi<typeof requests>(`classrooms/${course.id}/enrollment-requests`),
        classroomApi<NonNullable<typeof review>>(`classrooms/${course.id}/review-dashboard`),
      ]);
      setRequests(enrollment);
      setReview(dashboard);
      if (course.role === 'owner') {
        setJoinCodes(await classroomApi<typeof joinCodes>(`classrooms/${course.id}/join-codes`));
      }
    }
  }, [course.id, course.role, staff]);
  useEffect(() => {
    void load().catch((cause: Error) => setError(cause.message));
  }, [load]);

  const save = async (next = workspace) => {
    if (!next) return;
    setBusy(true);
    setError('');
    try {
      const saved = await classroomApi<SemesterWorkspace>(
        `classrooms/${course.id}/semester`,
        next,
        'PUT',
      );
      setWorkspace(saved);
      await onReload();
      await load();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const presentationInstruction = useMemo(() => {
    if (!workspace) return '';
    const p = workspace.presentation;
    return [
      `Create ${p.slide_count} editable ${p.aspect_ratio === 'wide' ? '16:9' : '4:3'} slides for approximately ${p.duration_minutes} minutes.`,
      `Use the ${p.theme} visual theme; show course ${course.code || course.name}, semester ${workspace.semester || course.term || ''}, academic year ${workspace.academic_year}, and lecturer ${p.lecturer_name || 'name to be confirmed'}.`,
      p.enforce_master_template
        ? `Enforce the master template on every slide: ${p.primary_colour} primary and ${p.accent_colour} accent colours, ${p.heading_font} headings, ${p.body_font} body text, and footer “${p.footer_text}”. Keep title, section, content, activity, worked-example and closing layouts consistent.`
        : '',
      p.include_speaker_notes ? 'Add delivery-ready speaker notes to every teaching slide.' : '',
      p.include_worked_examples
        ? 'Include checked worked examples with symbols, assumptions, units, and intermediate steps.'
        : '',
      p.include_software_demo
        ? 'Include an annotated software demonstration with inputs, steps, expected output, and troubleshooting.'
        : '',
      p.include_discussion ? 'Include discussion prompts and short knowledge checks.' : '',
      p.lecturer_answers_only
        ? 'Keep answers and marking guidance in lecturer-only speaker notes.'
        : '',
      workspace.lecturer_edition
        ? 'Prepare a lecturer edition with delivery notes and marking guidance.'
        : '',
      workspace.student_edition
        ? 'Prepare a student edition with all answer keys and private notes removed.'
        : '',
      workspace.accessible_edition
        ? 'Prepare an accessible edition with descriptive labels, readable contrast, logical reading order and plain-language alternatives for visual information.'
        : '',
      'Use labelled technical diagrams where they improve understanding. Do not invent references, equations, software output, equipment limits, or experimental results.',
    ]
      .filter(Boolean)
      .join(' ');
  }, [course, workspace]);

  const openWeekDraft = (
    week: SemesterWorkspace['weeks'][number],
    target: 'presentation' | 'lesson-pack',
  ) => {
    const citedSources = workspace ? groundedSources(workspace, week.source_ids) : [];
    useEducationStudioStore.getState().setMode('teacher');
    const resources = useLearningResourcesStore.getState();
    resources.setDraft({
      mode: 'teacher',
      output: 'lesson-pack',
      topic: `${course.code || ''} ${course.subject || course.name} — Week ${week.week}: ${week.topic}`,
      level: course.education_level,
      curriculum: `${course.code || ''} · ${workspace?.semester || course.term || ''} · ${workspace?.academic_year || ''}`,
      minutes: workspace?.presentation.duration_minutes || 90,
      objectives: [
        ...week.outcomes.map((item) => `- ${item}`),
        week.software.length ? `Approved software: ${week.software.join(', ')}.` : '',
        week.lab_steps.length ? `Software lab steps: ${week.lab_steps.join(' ')}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
      sources: citedSources,
    });
    resources.setComposer({
      mode: 'teacher',
      target: target === 'presentation' ? 'classroom' : 'lesson-pack',
      workflow: target === 'presentation' ? 'lecture-slides' : 'lesson-plan',
      instruction:
        target === 'presentation'
          ? presentationInstruction
          : `Create ${workspace?.lecturer_edition ? 'a lecturer edition with guidance and answers' : ''}${workspace?.lecturer_edition && workspace?.student_edition ? ' and ' : ''}${workspace?.student_edition ? 'a student edition without answers' : ''}. ${workspace?.accessible_edition ? 'Include an accessible edition with descriptive labels and a logical reading order.' : ''} Include activities, technical visuals, checked examples, a quiz, an assignment, and clearly separated lecturer-only answers.`,
    });
    window.dispatchEvent(new Event('omitech:open-education-create'));
  };

  const generateSemesterDrafts = async () => {
    if (!workspace) return;
    const semester = workspace;
    const settingsState = useSettingsStore.getState();
    const provider = settingsState.providersConfig[settingsState.providerId];
    if (!provider || !isLLMProviderConfigured(provider)) {
      setError('Connect a model in Settings before starting batch draft generation.');
      return;
    }
    const config = getCurrentModelConfig();
    setBusy(true);
    setError('');
    try {
      for (let index = 0; index < semester.weeks.length; index += 1) {
        const week = semester.weeks[index];
        const citedSources = groundedSources(semester, week.source_ids);
        setBatchProgress(
          `Generating draft ${index + 1} of ${semester.weeks.length}: Week ${week.week}`,
        );
        const brief = briefSchema.parse({
          mode: 'teacher',
          output: 'lesson-pack',
          topic: `${course.code || ''} ${course.subject || course.name} — Week ${week.week}: ${week.topic}`,
          level: course.education_level,
          language: 'English',
          objectives: [
            'Create distinct lecturer guidance and student-facing notes.',
            ...week.outcomes.map((item) => `- ${item}`),
            week.software.length ? `Software: ${week.software.join(', ')}.` : '',
            week.lab_steps.length ? `Lab procedure: ${week.lab_steps.join(' ')}` : '',
            'Include a checked worked example, a labelled technical visual, an activity, quiz, assignment and lecturer-only answer guidance. State assumptions and units. Never invent references, software output, equipment limits or experimental results.',
          ]
            .filter(Boolean)
            .join('\n'),
          curriculum: `${course.code || ''} · ${semester.semester || course.term || ''} · ${semester.academic_year}`,
          minutes: semester.presentation.duration_minutes,
          classSize: 30,
          examDate: '',
          questionCount: 8,
          sources: citedSources,
        });
        const response = await fetch('/api/education/generate', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-model': config.modelString,
            ...(config.apiKey ? { 'x-api-key': config.apiKey } : {}),
            ...(config.baseUrl ? { 'x-base-url': config.baseUrl } : {}),
            ...(config.providerType ? { 'x-provider-type': config.providerType } : {}),
          },
          body: JSON.stringify(brief),
          signal: AbortSignal.timeout(180000),
        });
        const payload = await response.json();
        if (!response.ok || !payload.success)
          throw new Error(payload.error || `Week ${week.week} generation failed.`);
        useLearningResourcesStore
          .getState()
          .save(
            brief,
            parseEducationContent(JSON.stringify(payload.content), brief),
            String(course.id),
          );
      }
      setBatchProgress(
        `${semester.weeks.length} private drafts are ready in Learning resources. Review and explicitly import each approved resource into the class.`,
      );
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!workspace) return <p>Loading semester workspace…</p>;
  return (
    <section className="space-y-4 rounded-xl border p-3" aria-label="Semester operations">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="font-semibold">Semester workspace</h4>
          <p className="text-xs text-muted-foreground">
            Weeks, learning materials, PowerPoint standards, labs, references, class communication
            and end-of-semester records.
          </p>
        </div>
        {edit && (
          <Button disabled={busy} onClick={() => void save()}>
            {busy ? 'Saving…' : 'Save semester workspace'}
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      )}

      {edit && (
        <details open={!workspace.weeks.length} className="rounded-lg border p-3">
          <summary>Semester builder and weekly material plan</summary>
          <div className="mt-3 grid gap-2 md:grid-cols-4">
            <label>
              Academic year
              <input
                className={field}
                value={workspace.academic_year}
                onChange={(e) => setWorkspace({ ...workspace, academic_year: e.target.value })}
              />
            </label>
            <label>
              Semester
              <input
                className={field}
                value={workspace.semester}
                onChange={(e) => setWorkspace({ ...workspace, semester: e.target.value })}
              />
            </label>
            <label>
              Start date
              <input
                className={field}
                type="date"
                value={workspace.start_date}
                onChange={(e) => setWorkspace({ ...workspace, start_date: e.target.value })}
              />
            </label>
            <label>
              End date
              <input
                className={field}
                type="date"
                value={workspace.end_date}
                onChange={(e) => setWorkspace({ ...workspace, end_date: e.target.value })}
              />
            </label>
          </div>
          {!workspace.weeks.length && (
            <Button
              className="mt-3"
              variant="outline"
              onClick={() => setWorkspace({ ...workspace, weeks: starterWeeks() })}
            >
              Build a 15-week editable plan
            </Button>
          )}
          {!!workspace.weeks.length && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void generateSemesterDrafts()}
              >
                Generate all weekly lesson-pack drafts
              </Button>
              <span className="text-xs">
                Private drafts only—nothing is assigned or published automatically.
              </span>
            </div>
          )}
          {batchProgress && (
            <p className="mt-2 text-sm" role="status">
              {batchProgress}
            </p>
          )}
          <div className="mt-3 space-y-2">
            {workspace.weeks.map((week, index) => (
              <details className="rounded-lg border p-3" key={week.id}>
                <summary>
                  Week {week.week}: {week.title} · {week.status}
                </summary>
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  <label>
                    Title
                    <input
                      className={field}
                      value={week.title}
                      onChange={(e) =>
                        setWorkspace({
                          ...workspace,
                          weeks: workspace.weeks.map((item, i) =>
                            i === index ? { ...item, title: e.target.value } : item,
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    Topic
                    <input
                      className={field}
                      value={week.topic}
                      onChange={(e) =>
                        setWorkspace({
                          ...workspace,
                          weeks: workspace.weeks.map((item, i) =>
                            i === index ? { ...item, topic: e.target.value } : item,
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    Status
                    <select
                      className={field}
                      value={week.status}
                      onChange={(e) =>
                        setWorkspace({
                          ...workspace,
                          weeks: workspace.weeks.map((item, i) =>
                            i === index
                              ? { ...item, status: e.target.value as typeof item.status }
                              : item,
                          ),
                        })
                      }
                    >
                      <option value="planned">Planned</option>
                      <option value="draft">Draft</option>
                      <option value="review">Review</option>
                      <option value="published">Published</option>
                    </select>
                  </label>
                </div>
                <label className="mt-2 block">
                  Learning outcomes
                  <textarea
                    className={field}
                    rows={3}
                    value={week.outcomes.join('\n')}
                    onChange={(e) =>
                      setWorkspace({
                        ...workspace,
                        weeks: workspace.weeks.map((item, i) =>
                          i === index
                            ? {
                                ...item,
                                outcomes: e.target.value
                                  .split('\n')
                                  .map((v) => v.trim())
                                  .filter(Boolean),
                              }
                            : item,
                        ),
                      })
                    }
                  />
                </label>
                <div className="mt-2 flex flex-wrap gap-3">
                  {MATERIALS.map((material) => (
                    <label className="text-xs" key={material.id}>
                      <input
                        type="checkbox"
                        checked={week.materials.includes(material.id)}
                        onChange={(e) =>
                          setWorkspace({
                            ...workspace,
                            weeks: workspace.weeks.map((item, i) =>
                              i === index
                                ? {
                                    ...item,
                                    materials: e.target.checked
                                      ? [...item.materials, material.id]
                                      : item.materials.filter((id) => id !== material.id),
                                  }
                                : item,
                            ),
                          })
                        }
                      />{' '}
                      {material.label}
                    </label>
                  ))}
                </div>
                {!!workspace.sources.length && (
                  <div className="mt-2 flex flex-wrap gap-3">
                    <span className="text-xs font-semibold">Week references:</span>
                    {workspace.sources.map((source) => (
                      <label className="text-xs" key={source.id}>
                        <input
                          type="checkbox"
                          checked={week.source_ids.includes(source.id)}
                          onChange={(e) =>
                            setWorkspace({
                              ...workspace,
                              weeks: workspace.weeks.map((item, i) =>
                                i === index
                                  ? {
                                      ...item,
                                      source_ids: e.target.checked
                                        ? [...item.source_ids, source.id]
                                        : item.source_ids.filter((id) => id !== source.id),
                                    }
                                  : item,
                              ),
                            })
                          }
                        />{' '}
                        {source.title}
                      </label>
                    ))}
                  </div>
                )}
                {week.materials.includes('software-lab') && (
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    <label>
                      Software and versions
                      <textarea
                        className={field}
                        value={week.software.join('\n')}
                        onChange={(e) =>
                          setWorkspace({
                            ...workspace,
                            weeks: workspace.weeks.map((item, i) =>
                              i === index
                                ? {
                                    ...item,
                                    software: e.target.value
                                      .split('\n')
                                      .map((v) => v.trim())
                                      .filter(Boolean),
                                  }
                                : item,
                            ),
                          })
                        }
                      />
                    </label>
                    <label>
                      Lab procedure
                      <textarea
                        className={field}
                        value={week.lab_steps.join('\n')}
                        onChange={(e) =>
                          setWorkspace({
                            ...workspace,
                            weeks: workspace.weeks.map((item, i) =>
                              i === index
                                ? {
                                    ...item,
                                    lab_steps: e.target.value
                                      .split('\n')
                                      .map((v) => v.trim())
                                      .filter(Boolean),
                                  }
                                : item,
                            ),
                          })
                        }
                      />
                    </label>
                    <label>
                      Expected output
                      <textarea
                        className={field}
                        value={week.expected_output}
                        onChange={(e) =>
                          setWorkspace({
                            ...workspace,
                            weeks: workspace.weeks.map((item, i) =>
                              i === index ? { ...item, expected_output: e.target.value } : item,
                            ),
                          })
                        }
                      />
                    </label>
                    <label>
                      Troubleshooting
                      <textarea
                        className={field}
                        value={week.troubleshooting.join('\n')}
                        onChange={(e) =>
                          setWorkspace({
                            ...workspace,
                            weeks: workspace.weeks.map((item, i) =>
                              i === index
                                ? {
                                    ...item,
                                    troubleshooting: e.target.value
                                      .split('\n')
                                      .map((v) => v.trim())
                                      .filter(Boolean),
                                  }
                                : item,
                            ),
                          })
                        }
                      />
                    </label>
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => openWeekDraft(week, 'lesson-pack')}>
                    Prepare complete material draft
                  </Button>
                  <Button variant="outline" onClick={() => openWeekDraft(week, 'presentation')}>
                    Prepare complete PPTX
                  </Button>
                </div>
              </details>
            ))}
          </div>
        </details>
      )}

      {!edit && (
        <details className="rounded-lg border p-3" open>
          <summary>Semester weeks and learning materials</summary>
          {course.role === 'student' &&
            workspace.weeks.filter((week) => week.status === 'published').length === 0 && (
              <p className="mt-2 text-sm">Your lecturer has not published the weekly plan yet.</p>
            )}
          {workspace.weeks
            .filter((week) => course.role !== 'student' || week.status === 'published')
            .map((week) => (
              <article className="mt-2 rounded border p-3" key={week.id}>
                <strong>
                  Week {week.week}: {week.title}
                </strong>
                <p className="text-sm">{week.topic}</p>
                {!!week.outcomes.length && (
                  <ul className="list-disc pl-5 text-sm">
                    {week.outcomes.map((outcome) => (
                      <li key={outcome}>{outcome}</li>
                    ))}
                  </ul>
                )}
                <p className="text-xs">
                  Materials: {week.materials.map((item) => item.replaceAll('-', ' ')).join(', ')}
                </p>
                {!!week.software.length && (
                  <p className="text-xs">Software: {week.software.join(', ')}</p>
                )}
              </article>
            ))}
        </details>
      )}

      {edit && (
        <details className="rounded-lg border p-3">
          <summary>PowerPoint quality and presentation standard</summary>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            <label>
              Slides
              <input
                className={field}
                type="number"
                min={6}
                max={80}
                value={workspace.presentation.slide_count}
                onChange={(e) =>
                  setWorkspace({
                    ...workspace,
                    presentation: {
                      ...workspace.presentation,
                      slide_count: Number(e.target.value),
                    },
                  })
                }
              />
            </label>
            <label>
              Teaching minutes
              <input
                className={field}
                type="number"
                min={10}
                max={240}
                value={workspace.presentation.duration_minutes}
                onChange={(e) =>
                  setWorkspace({
                    ...workspace,
                    presentation: {
                      ...workspace.presentation,
                      duration_minutes: Number(e.target.value),
                    },
                  })
                }
              />
            </label>
            <label>
              Lecturer
              <input
                className={field}
                value={workspace.presentation.lecturer_name}
                onChange={(e) =>
                  setWorkspace({
                    ...workspace,
                    presentation: { ...workspace.presentation, lecturer_name: e.target.value },
                  })
                }
              />
            </label>
            <label>
              Aspect ratio
              <select
                className={field}
                value={workspace.presentation.aspect_ratio}
                onChange={(e) =>
                  setWorkspace({
                    ...workspace,
                    presentation: {
                      ...workspace.presentation,
                      aspect_ratio: e.target.value as 'wide' | 'standard',
                    },
                  })
                }
              >
                <option value="wide">16:9 widescreen</option>
                <option value="standard">4:3 standard</option>
              </select>
            </label>
            <label>
              Theme
              <select
                className={field}
                value={workspace.presentation.theme}
                onChange={(e) =>
                  setWorkspace({
                    ...workspace,
                    presentation: {
                      ...workspace.presentation,
                      theme: e.target.value as typeof workspace.presentation.theme,
                    },
                  })
                }
              >
                <option value="institution-navy">Institution navy</option>
                <option value="omitech-light">Omitech light</option>
                <option value="plain">Plain academic</option>
              </select>
            </label>
            <label>
              Logo URL
              <input
                className={field}
                value={workspace.presentation.logo_url}
                onChange={(e) =>
                  setWorkspace({
                    ...workspace,
                    presentation: { ...workspace.presentation, logo_url: e.target.value },
                  })
                }
              />
            </label>
            <label>
              Primary colour
              <input
                className={field}
                type="color"
                value={workspace.presentation.primary_colour}
                onChange={(e) =>
                  setWorkspace({
                    ...workspace,
                    presentation: { ...workspace.presentation, primary_colour: e.target.value },
                  })
                }
              />
            </label>
            <label>
              Accent colour
              <input
                className={field}
                type="color"
                value={workspace.presentation.accent_colour}
                onChange={(e) =>
                  setWorkspace({
                    ...workspace,
                    presentation: { ...workspace.presentation, accent_colour: e.target.value },
                  })
                }
              />
            </label>
            <label>
              Footer text
              <input
                className={field}
                value={workspace.presentation.footer_text}
                onChange={(e) =>
                  setWorkspace({
                    ...workspace,
                    presentation: { ...workspace.presentation, footer_text: e.target.value },
                  })
                }
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            {(
              [
                'include_speaker_notes',
                'include_discussion',
                'include_worked_examples',
                'include_software_demo',
                'lecturer_answers_only',
                'enforce_master_template',
              ] as const
            ).map((key) => (
              <label className="text-xs" key={key}>
                <input
                  type="checkbox"
                  checked={workspace.presentation[key]}
                  onChange={(e) =>
                    setWorkspace({
                      ...workspace,
                      presentation: { ...workspace.presentation, [key]: e.target.checked },
                    })
                  }
                />{' '}
                {key.replaceAll('_', ' ')}
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs">
            Every generated deck is instructed to use labelled diagrams, checked equations and
            units, real references, software inputs/outputs, speaker notes and separated lecturer
            answers.
          </p>
          <Button
            className="mt-3"
            variant="outline"
            onClick={() =>
              void downloadMasterPresentationTemplate({
                courseCode: course.code || '',
                courseName: course.subject || course.name,
                semester: workspace.semester || course.term || '',
                academicYear: workspace.academic_year,
                lecturer: workspace.presentation.lecturer_name,
                primary: workspace.presentation.primary_colour,
                accent: workspace.presentation.accent_colour,
                headingFont: workspace.presentation.heading_font,
                bodyFont: workspace.presentation.body_font,
                footer: workspace.presentation.footer_text,
              }).catch((cause: Error) => setError(cause.message))
            }
          >
            Download editable master PPTX
          </Button>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {(['lecturer_edition', 'student_edition', 'accessible_edition'] as const).map((key) => (
              <label className="text-xs" key={key}>
                <input
                  type="checkbox"
                  checked={workspace[key]}
                  onChange={(e) => setWorkspace({ ...workspace, [key]: e.target.checked })}
                />{' '}
                {key.replaceAll('_', ' ')}
              </label>
            ))}
            <label>
              Notify before deadlines (days)
              <input
                className={field}
                type="number"
                min={0}
                max={30}
                value={workspace.notification_days_before}
                onChange={(e) =>
                  setWorkspace({ ...workspace, notification_days_before: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Retention (months)
              <input
                className={field}
                type="number"
                min={1}
                max={120}
                value={workspace.retention_months}
                onChange={(e) =>
                  setWorkspace({ ...workspace, retention_months: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Storage quota (MB)
              <input
                className={field}
                type="number"
                min={100}
                max={102400}
                value={workspace.storage_quota_mb}
                onChange={(e) =>
                  setWorkspace({ ...workspace, storage_quota_mb: Number(e.target.value) })
                }
              />
            </label>
          </div>
        </details>
      )}

      {edit && (
        <details className="rounded-lg border p-3">
          <summary>Reference library ({workspace.sources.length})</summary>
          <form
            className="mt-3 grid gap-2 md:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault();
              setWorkspace({
                ...workspace,
                sources: [
                  ...workspace.sources,
                  {
                    id: nanoid(),
                    title: sourceTitle,
                    author: sourceAuthor,
                    year: sourceYear,
                    url: sourceUrl,
                    reference: sourceReference,
                    text: sourceText,
                    location: sourceLocation,
                  },
                ],
              });
              setSourceTitle('');
              setSourceAuthor('');
              setSourceYear('');
              setSourceUrl('');
              setSourceReference('');
              setSourceText('');
              setSourceLocation('');
            }}
          >
            <label>
              Source title
              <input
                className={field}
                required
                value={sourceTitle}
                onChange={(e) => setSourceTitle(e.target.value)}
              />
            </label>
            <label>
              Author / organization
              <input
                className={field}
                value={sourceAuthor}
                onChange={(e) => setSourceAuthor(e.target.value)}
              />
            </label>
            <label>
              Year
              <input
                className={field}
                value={sourceYear}
                onChange={(e) => setSourceYear(e.target.value)}
              />
            </label>
            <label>
              URL / DOI
              <input
                className={field}
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
              />
            </label>
            <label>
              Reference / edition
              <input
                className={field}
                value={sourceReference}
                onChange={(e) => setSourceReference(e.target.value)}
              />
            </label>
            <label>
              Section or page
              <input
                className={field}
                value={sourceLocation}
                onChange={(e) => setSourceLocation(e.target.value)}
              />
            </label>
            <label className="md:col-span-3">
              Approved source excerpt for grounded generation
              <textarea
                className={field}
                rows={5}
                maxLength={20000}
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
              />
            </label>
            <Button className="self-end">Add source</Button>
          </form>
          {workspace.sources.map((source) => (
            <div className="mt-2 flex justify-between gap-2 rounded border p-2" key={source.id}>
              <span>
                {source.title}
                {source.author && ` · ${source.author}`}
                {source.year && ` (${source.year})`}
                {source.reference && ` · ${source.reference}`}
                {source.location && ` · ${source.location}`}
                {source.text && ` · ${source.text.length} source characters`}
                {source.url && (
                  <>
                    {' · '}
                    <a className="underline" href={source.url} target="_blank" rel="noreferrer">
                      source link
                    </a>
                  </>
                )}
              </span>
              <Button
                variant="outline"
                onClick={() =>
                  setWorkspace({
                    ...workspace,
                    sources: workspace.sources.filter((item) => item.id !== source.id),
                    weeks: workspace.weeks.map((week) => ({
                      ...week,
                      source_ids: week.source_ids.filter((id) => id !== source.id),
                    })),
                  })
                }
              >
                Remove
              </Button>
            </div>
          ))}
        </details>
      )}

      {course.role === 'owner' && (
        <details className="rounded-lg border p-3">
          <summary>Student access, approval and roster</summary>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <label>
              Maximum joins
              <input
                className={field}
                type="number"
                min={1}
                max={5000}
                value={joinMaxUses}
                onChange={(e) => setJoinMaxUses(Number(e.target.value))}
              />
            </label>
            <label>
              Code expiry (optional)
              <input
                className={field}
                type="datetime-local"
                value={joinExpiry}
                onChange={(e) => setJoinExpiry(e.target.value)}
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() =>
                void classroomApi<{ code: string }>(`classrooms/${course.id}/join-codes`, {
                  require_approval: true,
                  max_uses: joinMaxUses,
                  expires_at: joinExpiry ? new Date(joinExpiry).toISOString() : null,
                })
                  .then(async (value) => {
                    setJoinCode(value.code);
                    await load();
                  })
                  .catch((cause: Error) => setError(cause.message))
              }
            >
              Create approval join code
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                void classroomApi<{ code: string }>(`classrooms/${course.id}/join-codes`, {
                  require_approval: false,
                  max_uses: joinMaxUses,
                  expires_at: joinExpiry ? new Date(joinExpiry).toISOString() : null,
                })
                  .then(async (value) => {
                    setJoinCode(value.code);
                    await load();
                  })
                  .catch((cause: Error) => setError(cause.message))
              }
            >
              Create instant join code
            </Button>
            {joinCode && <strong className="rounded bg-muted p-2">Copy now: {joinCode}</strong>}
          </div>
          <p className="mt-2 text-xs">
            Only a one-way hash is stored. The complete code is shown once. You can revoke codes and
            review access from this class.
          </p>
          {joinCodes.map((item) => (
            <div
              className="mt-2 flex flex-wrap items-center gap-2 rounded border p-2"
              key={item.id}
            >
              <span className="flex-1">
                {item.code_hint} · {item.use_count}/{item.max_uses || 'unlimited'} joins ·{' '}
                {item.require_approval ? 'approval' : 'instant'}
                {item.expires_at && ` · expires ${new Date(item.expires_at).toLocaleString()}`}
                {item.revoked_at && ' · revoked'}
              </span>
              {!item.revoked_at && (
                <Button
                  variant="outline"
                  onClick={() =>
                    void classroomApi(
                      `classrooms/${course.id}/join-codes/${item.id}`,
                      undefined,
                      'DELETE',
                    )
                      .then(load)
                      .catch((cause: Error) => setError(cause.message))
                  }
                >
                  Revoke
                </Button>
              )}
            </div>
          ))}
          {requests
            .filter((item) => item.status === 'pending')
            .map((item) => (
              <div
                className="mt-2 flex flex-wrap items-center gap-2 rounded border p-2"
                key={item.id}
              >
                <span className="flex-1">
                  {item.name} · {item.email} ·{' '}
                  {String(item.profile_snapshot.registration_number || '')}
                </span>
                <Button
                  onClick={() =>
                    void classroomApi(`enrollment-requests/${item.id}/decision`, {
                      decision: 'approved',
                    }).then(load)
                  }
                >
                  Approve
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    void classroomApi(`enrollment-requests/${item.id}/decision`, {
                      decision: 'rejected',
                    }).then(load)
                  }
                >
                  Reject
                </Button>
              </div>
            ))}
          <label className="mt-3 block text-sm">
            Import roster CSV (registration_number,email)
            <input
              className={field}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                void file
                  .text()
                  .then((csv_text) =>
                    classroomApi<{ added: number; errors: unknown[] }>(
                      `classrooms/${course.id}/roster/import`,
                      { csv_text },
                    ).then((result) => {
                      setError(
                        `Roster imported: ${result.added} new students; ${result.errors.length} issues.`,
                      );
                      return onReload();
                    }),
                  )
                  .catch((cause: Error) => setError(cause.message));
              }}
            />
          </label>
        </details>
      )}

      <details className="rounded-lg border p-3" open={announcements.length > 0}>
        <summary>Announcements and class calendar ({announcements.length})</summary>
        {edit && (
          <form
            className="mt-3 grid gap-2 md:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault();
              void classroomApi(`classrooms/${course.id}/announcements`, {
                kind: announcementKind,
                title: announcementTitle,
                body: announcementBody,
                starts_at: announcementStarts ? new Date(announcementStarts).toISOString() : null,
                due_at: announcementDue ? new Date(announcementDue).toISOString() : null,
                status: 'published',
              })
                .then(() => {
                  setAnnouncementTitle('');
                  setAnnouncementBody('');
                  setAnnouncementStarts('');
                  setAnnouncementDue('');
                  return load();
                })
                .catch((cause: Error) => setError(cause.message));
            }}
          >
            <label>
              Type
              <select
                className={field}
                value={announcementKind}
                onChange={(e) => setAnnouncementKind(e.target.value as Announcement['kind'])}
              >
                <option value="announcement">Announcement</option>
                <option value="class">Class session</option>
                <option value="deadline">Deadline</option>
                <option value="exam">Exam</option>
              </select>
            </label>
            <label>
              Title
              <input
                className={field}
                value={announcementTitle}
                onChange={(e) => setAnnouncementTitle(e.target.value)}
                required
              />
            </label>
            <label>
              Starts
              <input
                className={field}
                type="datetime-local"
                value={announcementStarts}
                onChange={(e) => setAnnouncementStarts(e.target.value)}
              />
            </label>
            <label>
              Due / ends
              <input
                className={field}
                type="datetime-local"
                value={announcementDue}
                onChange={(e) => setAnnouncementDue(e.target.value)}
              />
            </label>
            <label>
              Message
              <textarea
                className={field}
                value={announcementBody}
                onChange={(e) => setAnnouncementBody(e.target.value)}
              />
            </label>
            <Button className="self-end">Publish announcement</Button>
          </form>
        )}
        {announcements.map((item) => (
          <article className="mt-2 rounded border p-2" key={item.id}>
            <strong>
              {item.title} · {item.kind}
            </strong>
            <p className="text-sm whitespace-pre-wrap">{item.body}</p>
            {item.starts_at && (
              <p className="text-xs">Starts {new Date(item.starts_at).toLocaleString()}</p>
            )}
            {item.due_at && <p className="text-xs">Due {new Date(item.due_at).toLocaleString()}</p>}
            {edit && (
              <Button
                variant="ghost"
                onClick={() =>
                  void classroomApi(
                    `classrooms/${course.id}/announcements/${item.id}`,
                    undefined,
                    'DELETE',
                  )
                    .then(load)
                    .catch((cause: Error) => setError(cause.message))
                }
              >
                Remove
              </Button>
            )}
          </article>
        ))}
      </details>

      <Button
        variant="outline"
        onClick={() =>
          downloadText(
            `${course.code || `course-${course.id}`}-semester-guide.html`,
            offlineSemesterGuide(course, workspace, announcements),
            'text/html',
          )
        }
      >
        Download lightweight offline semester guide
      </Button>

      {staff && review && (
        <details className="rounded-lg border p-3">
          <summary>Lecturer review dashboard</summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <p>
              {review.weeks_published}/{review.weeks} weeks published
            </p>
            <p>{review.draft_lessons} lesson drafts</p>
            <p>{review.published_lessons} reviewed lessons</p>
            <p>{review.assignments} assignments</p>
            <p>{review.ungraded_submissions} awaiting marking</p>
            <p>{review.pending_enrollment} access requests</p>
          </div>
          {review.quality_issues.map((issue) => (
            <p className="mt-1 text-sm" key={issue}>
              • {issue}
            </p>
          ))}
        </details>
      )}

      <AcademicOperations course={course} members={members} onSemesterImported={load} />

      {edit && members.some((member) => member.role === 'student') && (
        <details className="rounded-lg border p-3">
          <summary>Attendance</summary>
          <div className="mt-3 flex flex-wrap gap-2">
            <label>
              Session date
              <input
                className={field}
                type="date"
                value={attendanceDate}
                onChange={(e) => setAttendanceDate(e.target.value)}
              />
            </label>
          </div>
          {members
            .filter((member) => member.role === 'student')
            .map((member) => (
              <div className="mt-2 flex flex-wrap items-center gap-2" key={member.id}>
                <span className="flex-1">{member.name}</span>
                {(['present', 'late', 'absent', 'excused'] as const).map((status) => (
                  <Button
                    variant="outline"
                    key={status}
                    onClick={() =>
                      void classroomApi(
                        `classrooms/${course.id}/attendance`,
                        { user_id: member.user_id, session_date: attendanceDate, status, note: '' },
                        'PUT',
                      ).catch((cause: Error) => setError(cause.message))
                    }
                  >
                    {status}
                  </Button>
                ))}
              </div>
            ))}
        </details>
      )}

      {staff && (
        <details className="rounded-lg border p-3">
          <summary>Offline pack and end-of-semester archive</summary>
          <p className="mt-2 text-sm">
            The ZIP contains the course structure, semester plan, roster, lessons, assignments,
            submissions, announcements, marks and attendance. Student files stay protected and are
            downloaded separately by authorized staff.
          </p>
          {edit && (
            <label className="mt-3 block">
              Improvement notes for the next semester
              <textarea
                className={field}
                rows={4}
                value={workspace.improvement_notes}
                onChange={(e) => setWorkspace({ ...workspace, improvement_notes: e.target.value })}
              />
            </label>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() =>
                void downloadClassroomFile(
                  `classrooms/${course.id}/archive`,
                  `semester-${course.id}-archive.zip`,
                ).catch((cause: Error) => setError(cause.message))
              }
            >
              Download semester ZIP
            </Button>
            {course.role === 'owner' && (
              <>
                <input
                  className={`${field} max-w-xs`}
                  value={copyName}
                  onChange={(e) => setCopyName(e.target.value)}
                  aria-label="Copied semester name"
                />
                <input
                  className={`${field} max-w-40`}
                  value={copyTerm}
                  onChange={(e) => setCopyTerm(e.target.value)}
                  placeholder="Next semester"
                  aria-label="Next semester"
                />
                <input
                  className={`${field} max-w-40`}
                  value={copyAcademicYear}
                  onChange={(e) => setCopyAcademicYear(e.target.value)}
                  placeholder="Academic year"
                  aria-label="Next academic year"
                />
                <Button
                  variant="outline"
                  onClick={() =>
                    void classroomApi(`classrooms/${course.id}/copy`, {
                      name: copyName,
                      term: copyTerm,
                      academic_year: copyAcademicYear,
                    })
                      .then(onReload)
                      .catch((cause: Error) => setError(cause.message))
                  }
                >
                  Copy structure only
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (
                      !window.confirm(
                        'Archive this semester class after checking your downloaded ZIP?',
                      )
                    )
                      return;
                    void classroomApi(`classrooms/${course.id}/archive`, {})
                      .then(onReload)
                      .catch((cause: Error) => setError(cause.message));
                  }}
                >
                  Archive class
                </Button>
              </>
            )}
          </div>
          <p className="mt-2 text-xs">
            Archive the class only after downloading and checking the ZIP. Archiving removes it from
            active class lists but preserves records.
          </p>
        </details>
      )}

      {staff && assignments.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Assignment submissions accept PDF, Word, PowerPoint, notebooks, Python, images, ZIP,
          spreadsheets, video and HTTPS repository links, up to 50 MB per file.
        </p>
      )}
    </section>
  );
}
