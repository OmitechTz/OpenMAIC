'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useLearningResourcesStore } from '@/lib/store/learning-resources';
import { useEducationStudioStore } from '@/lib/store/education-studio';
import {
  classroomApi,
  type ManagedCourse,
  type ManagedLesson,
  type Assignment,
  type Submission,
  type ObjectiveResult,
} from '@/lib/education/classroom-api';
import { parseEducationContent } from '@/lib/education/artifacts';
import { AssignedLessonReader } from './classroom-reader';
import { MoodleExport } from './moodle-export';
import { MoodleConnection, MoodleGradeTransfer } from './moodle-connection';

const field = 'block w-full rounded-lg border bg-background p-2 text-sm';

export function ClassroomBoard() {
  const [courses, setCourses] = useState<ManagedCourse[]>([]);
  const [courseId, setCourseId] = useState<number>();
  const [name, setName] = useState('');
  const [level, setLevel] = useState('undergraduate');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [opened, setOpened] = useState<number>();
  const reload = useCallback(async () => {
    const result = await classroomApi<ManagedCourse[]>('classrooms');
    setCourses(result);
    setCourseId((previous) => (result.some((c) => c.id === previous) ? previous : result[0]?.id));
  }, []);
  useEffect(() => {
    void reload().catch((e: Error) => setError(e.message));
  }, [reload]);
  const course = courses.find((c) => c.id === courseId);
  if (opened) return <AssignedLessonReader id={opened} onBack={() => setOpened(undefined)} />;
  return (
    <section className="space-y-4" aria-label="Managed classrooms">
      <h3 className="text-lg font-semibold">Classes and assigned learning</h3>
      <p className="text-sm text-muted-foreground">
        Published lessons, class membership and submitted work are saved to your Omitech account.
        Personal resources are shared only when you explicitly import them below.
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <label className="min-w-48 flex-1">
          Class
          <select
            className={field}
            value={courseId ?? ''}
            onChange={(e) => setCourseId(Number(e.target.value))}
          >
            <option value="" disabled>
              Select a class
            </option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.role}
              </option>
            ))}
          </select>
        </label>
        <Button
          variant="outline"
          onClick={() => void reload().catch((e: Error) => setError(e.message))}
        >
          Refresh classes
        </Button>
      </div>
      <details className="rounded-xl border p-3">
        <summary>Create a class you will teach</summary>
        <form
          className="mt-2 flex flex-wrap gap-2"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError('');
            try {
              const created = await classroomApi<{ id: number }>('courses', {
                name,
                education_level: level,
              });
              await reload();
              setCourseId(created.id);
              setName('');
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="flex-1">
            Class name
            <input
              className={field}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={240}
            />
          </label>
          <label>
            Class level
            <select className={field} value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="secondary">Secondary</option>
              <option value="technical">Technical / vocational</option>
              <option value="undergraduate">Undergraduate</option>
              <option value="postgraduate">Postgraduate</option>
              <option value="professional">Professional</option>
            </select>
          </label>
          <Button disabled={busy} type="submit">
            Create class
          </Button>
        </form>
        <p className="text-xs mt-2">
          You become owner of this new class. Switching personal Teacher/Student preferences does
          not change class permissions.
        </p>
      </details>
      {course && <CourseWorkspace key={course.id} course={course} onOpen={setOpened} />}
    </section>
  );
}

function CourseWorkspace({
  course,
  onOpen,
}: {
  course: ManagedCourse;
  onOpen: (id: number) => void;
}) {
  const [lessons, setLessons] = useState<ManagedLesson[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [members, setMembers] = useState<
    { id: number; name: string; email: string; role: string }[]
  >([]);
  const [report, setReport] = useState<{
    submitted: number;
    basis: string;
    objectives: ObjectiveResult[];
  }>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('student');
  const [resourceId, setResourceId] = useState('');
  const [reviewLesson, setReviewLesson] = useState<ManagedLesson>();
  const resources = useLearningResourcesStore((s) => s.artifacts);
  const staff = course.role !== 'student';
  const edit = course.role === 'owner' || course.role === 'teacher';
  const reload = useCallback(async () => {
    setAssignments(await classroomApi<Assignment[]>(`classrooms/${course.id}/assignments`));
    if (staff) {
      const [ls, ms, rs] = await Promise.all([
        classroomApi<ManagedLesson[]>(`classrooms/${course.id}/lessons`),
        classroomApi<typeof members>(`classrooms/${course.id}/members`),
        classroomApi<NonNullable<typeof report>>(`classrooms/${course.id}/results`),
      ]);
      setLessons(ls);
      setMembers(ms);
      setReport(rs);
    }
  }, [course.id, staff]);
  useEffect(() => {
    void reload().catch((e: Error) => setError(e.message));
  }, [reload]);
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await action();
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      )}
      {course.role === 'owner' && (
        <details className="rounded-xl border p-3">
          <summary>Class members and permissions ({members.length})</summary>
          <form
            className="mt-3 flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await classroomApi(`classrooms/${course.id}/members`, { email, role });
                setEmail('');
              });
            }}
          >
            <label className="flex-1">
              Existing account email
              <input
                className={field}
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              Course role
              <select className={field} value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="student">Student</option>
                <option value="teacher">Teacher (author and assess)</option>
                <option value="reviewer">Reviewer (publish)</option>
              </select>
            </label>
            <Button disabled={busy}>Add / update access</Button>
          </form>
          <p className="my-2 text-xs">
            Adding a member shares assigned material with that account. Teachers can view
            submissions. No invitation email is sent.
          </p>
          {members.map((m) => (
            <div className="flex flex-wrap justify-between gap-2 py-2" key={m.id}>
              <span>
                {m.name} · {m.email} · {m.role}
              </span>
              <Button
                disabled={busy}
                variant="outline"
                onClick={() =>
                  void run(() =>
                    classroomApi(`classrooms/${course.id}/members/${m.id}`, undefined, 'DELETE'),
                  )
                }
              >
                Remove class access
              </Button>
            </div>
          ))}
        </details>
      )}
      {edit && (
        <section className="rounded-xl border p-3 space-y-2">
          <h4 className="font-semibold">Import a personal resource for teacher review</h4>
          <label>
            Resource
            <select
              className={field}
              value={resourceId}
              onChange={(e) => setResourceId(e.target.value)}
            >
              <option value="">Choose a resource</option>
              {resources.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.content.title}
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs">
            This explicitly copies the selected content and source excerpts into this class.
            Students receive it only after review and assignment.
          </p>
          <Button
            disabled={!resourceId || busy}
            onClick={() =>
              void run(async () => {
                const resource = resources.find((r) => r.id === resourceId)!;
                const content = parseEducationContent(
                  JSON.stringify(resource.content),
                  resource.brief,
                );
                await classroomApi(`classrooms/${course.id}/lessons`, {
                  import_key: `${resource.id}:${resource.updatedAt}`,
                  content,
                  sources: resource.brief.sources,
                });
              })
            }
          >
            Copy into class as draft
          </Button>
        </section>
      )}
      {staff && (
        <section className="space-y-2">
          <h4 className="font-semibold">Lesson versions</h4>
          {!lessons.length && (
            <p>No imported lessons yet. Create a resource, then copy it into this class.</p>
          )}
          {lessons.map((lesson) => (
            <div
              className="flex flex-wrap items-center gap-2 rounded-xl border p-3"
              key={lesson.id}
            >
              <span className="flex-1">
                {lesson.title} · {lesson.status} · v{lesson.version}
              </span>
              <Button variant="outline" onClick={() => setReviewLesson(lesson)}>
                Read / review
              </Button>
              {edit && lesson.status === 'published' && (
                <AssignmentForm courseId={course.id} lesson={lesson} onSaved={reload} />
              )}
            </div>
          ))}
          {reviewLesson && (
            <LessonReview
              key={`${reviewLesson.id}:${reviewLesson.version}`}
              lesson={reviewLesson}
              role={course.role}
              onClose={() => setReviewLesson(undefined)}
              onSaved={async () => {
                setReviewLesson(undefined);
                await reload();
              }}
            />
          )}
          <MoodleExport lessons={lessons.filter((l) => l.status === 'published')} />
        </section>
      )}
      <section className="space-y-2">
        <h4 className="font-semibold">
          {staff ? 'Assignments and responses' : 'My assigned lessons'}
        </h4>
        {!assignments.length && <p>No assignments yet.</p>}
        {assignments.map((a) => (
          <div className="rounded-xl border p-3 space-y-2" key={a.id}>
            <div className="flex flex-wrap gap-2 items-center">
              <span className="flex-1">
                {a.title}
                {a.due_at && ` · Due ${new Date(a.due_at).toLocaleString()}`}
              </span>
              <Button onClick={() => onOpen(a.id)}>
                {staff ? 'Preview student lesson' : 'Open / resume'}
              </Button>
            </div>
            {staff && (
              <SubmissionReview assignment={a} canGrade={edit} canSync={course.role === 'owner'} />
            )}
          </div>
        ))}
      </section>
      {course.role === 'owner' && (
        <MoodleConnection courseId={course.id} assignments={assignments} onImported={reload} />
      )}
      {report && (
        <section className="rounded-xl border p-3 space-y-3">
          <h4 className="font-semibold">What to teach next</h4>
          <p className="text-xs">
            {report.submitted} submissions. {report.basis}
          </p>
          {report.objectives.map((o, i) => (
            <div key={i} className="rounded border p-3">
              <strong>{o.objective}</strong>
              <p>
                {o.correct}/{o.scored} scored answers correct · {o.pending} awaiting marking ·{' '}
                {o.hints} hints reported
              </p>
              <p>{o.recommendation}</p>
              {o.examples.map((example) => (
                <p key={example.submission_id + ':' + example.question} className="text-xs">
                  Response #{example.submission_id}, question {example.question + 1}:{' '}
                  {example.response?.text || `Option ${(example.response?.option ?? 0) + 1}`}
                </p>
              ))}
              {edit && (
                <Button
                  variant="outline"
                  onClick={() => {
                    const store = useLearningResourcesStore.getState();
                    store.setDraft({
                      topic: `Reteach: ${o.objective}`,
                      objectives: `${o.recommendation}. Address misconceptions with a worked example and two fresh understanding checks.`,
                      output: 'lesson-pack',
                    });
                    useEducationStudioStore.getState().setMode('teacher');
                    store.setComposer({
                      mode: 'teacher',
                      target: 'lesson-pack',
                      workflow: 'lesson-plan',
                      instruction: '',
                    });
                    window.dispatchEvent(new Event('omitech:open-education-create'));
                  }}
                >
                  Prepare targeted follow-up
                </Button>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function LessonReview({
  lesson,
  role,
  onClose,
  onSaved,
}: {
  lesson: ManagedLesson;
  role: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [content, setContent] = useState(() => structuredClone(lesson.content));
  const unsaved = JSON.stringify(content) !== JSON.stringify(lesson.content);
  const canPublish = ['owner', 'reviewer'].includes(role) && lesson.status === 'draft';
  const canEdit = ['owner', 'teacher'].includes(role);
  const labels: Record<string, string> = {
    factual_accuracy: 'Facts, calculations, units and assumptions checked',
    answer_key: 'Answers and objective mappings checked',
    accessibility: 'Language, readability and access checked',
    source_support: 'Cited passages checked; unsupported claims corrected',
  };
  const act = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await action();
      await onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="rounded-xl border-2 p-4 space-y-3" aria-label="Teacher lesson review">
      <div className="flex justify-between">
        <h4 className="font-semibold">Review {lesson.title}</h4>
        <Button variant="ghost" onClick={onClose}>
          Close review
        </Button>
      </div>
      {lesson.content.sections.map((s, i) => (
        <section key={i}>
          <h5 className="font-semibold">{s.heading}</h5>
          <p className="whitespace-pre-wrap">{s.body}</p>
          <p className="text-xs">
            Sources: {s.sourceIds.join(', ') || 'No supplied source; teacher verification required'}
          </p>
        </section>
      ))}
      <details>
        <summary>Questions, answers and learning objectives</summary>
        {lesson.content.questions.map((q, i) => (
          <div key={i} className="my-3">
            <p>
              {i + 1}. {q.prompt}
            </p>
            <p>Objective: {lesson.content.objectives[q.objectiveIndex ?? 0]}</p>
            <p>Answer: {q.options.length ? q.options[q.correctOption ?? 0] : q.answer}</p>
            <p>{q.explanation}</p>
          </div>
        ))}
      </details>
      <details>
        <summary>Inspect source passages ({lesson.sources.length})</summary>
        {lesson.sources.map((s) => (
          <article key={s.id} className="my-3">
            <strong>
              [{s.id}] {s.title}
            </strong>
            <p>{s.location}</p>
            <p className="whitespace-pre-wrap">{s.text}</p>
          </article>
        ))}
        <p>
          Source identifiers are attribution, not automated verification. Review the actual passage
          above.
        </p>
      </details>
      {canEdit && (
        <details>
          <summary>{lesson.status === 'draft' ? 'Edit lesson' : 'Create a revised draft'}</summary>
          <label>
            Lesson title
            <input
              className={field}
              maxLength={240}
              value={content.title}
              onChange={(e) => setContent({ ...content, title: e.target.value })}
            />
          </label>
          <label>
            Learning objectives (one per line)
            <textarea
              className={field}
              value={content.objectives.join('\n')}
              onChange={(e) => setContent({ ...content, objectives: e.target.value.split('\n') })}
            />
          </label>
          {content.sections.map((section, index) => (
            <fieldset key={index} className="my-3 space-y-2 rounded border p-3">
              <legend>Lesson section {index + 1}</legend>
              <label>
                Heading
                <input
                  className={field}
                  value={section.heading}
                  onChange={(e) =>
                    setContent({
                      ...content,
                      sections: content.sections.map((s, i) =>
                        i === index ? { ...s, heading: e.target.value } : s,
                      ),
                    })
                  }
                />
              </label>
              <label>
                Teaching content
                <textarea
                  rows={6}
                  className={field}
                  value={section.body}
                  onChange={(e) =>
                    setContent({
                      ...content,
                      sections: content.sections.map((s, i) =>
                        i === index ? { ...s, body: e.target.value } : s,
                      ),
                    })
                  }
                />
              </label>
            </fieldset>
          ))}
          {content.questions.map((question, index) => (
            <fieldset key={index} className="my-3 space-y-2 rounded border p-3">
              <legend>Question {index + 1}</legend>
              {(['prompt', 'answer', 'hint', 'explanation'] as const).map((key) => (
                <label key={key} className="block capitalize">
                  {key}
                  <textarea
                    className={field}
                    value={question[key]}
                    onChange={(e) =>
                      setContent({
                        ...content,
                        questions: content.questions.map((q, i) =>
                          i === index ? { ...q, [key]: e.target.value } : q,
                        ),
                      })
                    }
                  />
                </label>
              ))}
              <label>
                Learning objective
                <select
                  className={field}
                  value={question.objectiveIndex ?? 0}
                  onChange={(e) =>
                    setContent({
                      ...content,
                      questions: content.questions.map((q, i) =>
                        i === index ? { ...q, objectiveIndex: Number(e.target.value) } : q,
                      ),
                    })
                  }
                >
                  {content.objectives.map((o, i) => (
                    <option key={i} value={i}>
                      {o}
                    </option>
                  ))}
                </select>
              </label>
              {question.options.length > 0 && (
                <>
                  <label>
                    Choices (one per line)
                    <textarea
                      className={field}
                      value={question.options.join('\n')}
                      onChange={(e) =>
                        setContent({
                          ...content,
                          questions: content.questions.map((q, i) =>
                            i === index ? { ...q, options: e.target.value.split('\n') } : q,
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    Correct choice
                    <select
                      className={field}
                      value={question.correctOption ?? 0}
                      onChange={(e) =>
                        setContent({
                          ...content,
                          questions: content.questions.map((q, i) =>
                            i === index ? { ...q, correctOption: Number(e.target.value) } : q,
                          ),
                        })
                      }
                    >
                      {question.options.map((o, i) => (
                        <option key={i} value={i}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
            </fieldset>
          ))}
          <Button
            disabled={busy}
            onClick={() =>
              void act(() =>
                lesson.status === 'draft'
                  ? classroomApi(
                      `lessons/${lesson.id}`,
                      {
                        version: lesson.version,
                        content,
                        sources: lesson.sources,
                      },
                      'PATCH',
                    )
                  : classroomApi(`classrooms/${lesson.course_id}/lessons`, {
                      import_key: crypto.randomUUID(),
                      content,
                      sources: lesson.sources,
                    }),
              )
            }
          >
            Save {lesson.status === 'draft' ? 'changes' : 'new draft version'}
          </Button>
        </details>
      )}
      {canPublish && (
        <>
          {unsaved && <p role="status">Save your lesson edits before approving publication.</p>}
          <p>
            Approval applies to this exact version. Publication shares it with class staff;
            assignment makes it available to students.
          </p>
          {Object.entries(labels).map(([key, label]) => (
            <label key={key} className="block">
              <input
                type="checkbox"
                checked={!!checks[key]}
                onChange={(e) => setChecks({ ...checks, [key]: e.target.checked })}
              />{' '}
              {label}
            </label>
          ))}
          <label>
            Review notes
            <textarea
              className={field}
              value={notes}
              maxLength={4000}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <Button
            disabled={busy || unsaved || Object.keys(labels).some((k) => !checks[k])}
            onClick={() =>
              void act(() =>
                classroomApi(`lessons/${lesson.id}/publish`, {
                  version: lesson.version,
                  ...checks,
                  notes,
                }),
              )
            }
          >
            Approve and publish this version
          </Button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}

function AssignmentForm({
  courseId,
  lesson,
  onSaved,
}: {
  courseId: number;
  lesson: ManagedLesson;
  onSaved: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [due, setDue] = useState('');
  const [release, setRelease] = useState('after_submit');
  const [instructions, setInstructions] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const requestKey = useRef(crypto.randomUUID());
  return (
    <div>
      <Button variant="outline" onClick={() => setOpen(!open)}>
        Assign to class
      </Button>
      {open && (
        <form
          className="space-y-2 mt-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await classroomApi(`classrooms/${courseId}/assignments`, {
                lesson_id: lesson.id,
                title: lesson.title,
                instructions,
                due_at: due ? new Date(due).toISOString() : null,
                answer_release: release,
                request_key: requestKey.current,
              });
              await onSaved();
              setOpen(false);
              requestKey.current = crypto.randomUUID();
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Instructions
            <textarea
              className={field}
              value={instructions}
              maxLength={8000}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </label>
          <label>
            Due date (your local time)
            <input
              className={field}
              type="datetime-local"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              required={release === 'after_due'}
            />
          </label>
          <label>
            Release answers
            <select className={field} value={release} onChange={(e) => setRelease(e.target.value)}>
              <option value="after_submit">After each student submits</option>
              <option value="after_due">After due date and submission</option>
              <option value="teacher">When teacher releases, after submission</option>
            </select>
          </label>
          <p className="text-xs">
            Assigning makes this published version available to all students in this class.
          </p>
          <Button disabled={busy}>Publish assignment</Button>
          {error && <p role="alert">{error}</p>}
        </form>
      )}
    </div>
  );
}

function SubmissionReview({
  assignment,
  canGrade,
  canSync,
}: {
  assignment: Assignment;
  canGrade: boolean;
  canSync: boolean;
}) {
  const [items, setItems] = useState<Submission[]>([]);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const load = async () => {
    try {
      setItems(await classroomApi<Submission[]>(`assignments/${assignment.id}/submissions`));
      setOpen(true);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <div className="space-y-2">
      <Button variant="outline" onClick={() => void load()}>
        Load submitted work
      </Button>
      {canGrade && (
        <Button
          variant="ghost"
          onClick={async () => {
            try {
              await classroomApi(`assignments/${assignment.id}/release`, {});
              setError('Answers released to students who submitted.');
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          Release answers and feedback
        </Button>
      )}
      {error && <p role="status">{error}</p>}
      {open && !items.length && <p>No responses saved yet.</p>}
      {open &&
        items.map((s) => (
          <FeedbackForm
            key={`${s.id}:${s.version}`}
            submission={s}
            canGrade={canGrade}
            canSync={canSync}
            onSaved={load}
          />
        ))}
    </div>
  );
}
function FeedbackForm({
  submission: s,
  canGrade,
  canSync,
  onSaved,
}: {
  submission: Submission;
  canGrade: boolean;
  canSync: boolean;
  onSaved: () => Promise<void>;
}) {
  const [feedback, setFeedback] = useState(s.feedback);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <details className="rounded border p-2">
      <summary>
        {s.name} · {s.status}
      </summary>
      {Object.entries(s.answers).map(([key, a]) => (
        <p key={key}>
          Question {Number(key) + 1}: {a.text || `Option ${(a.option ?? 0) + 1}`}
          {a.hint_used ? ' (hint used)' : ''}
        </p>
      ))}
      {s.results.map((r) => (
        <div key={r.question}>
          <p>
            Question {r.question + 1}: {r.score === null ? 'Awaiting marking' : `${r.score}/1`} ·{' '}
            {r.scoring}
          </p>
          {canGrade && r.scoring !== 'automatic' && (
            <label>
              Mark question {r.question + 1}
              <select
                className={field}
                value={scores[String(r.question)] ?? ''}
                onChange={(e) => setScores({ ...scores, [r.question]: Number(e.target.value) })}
              >
                <option value="" disabled>
                  Review against answer key
                </option>
                <option value="0">Needs correction (0)</option>
                <option value="1">Meets objective (1)</option>
              </select>
            </label>
          )}
        </div>
      ))}
      {canGrade && s.status !== 'draft' && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await classroomApi(`submissions/${s.id}/feedback`, {
                version: s.version,
                feedback,
                open_scores: scores,
              });
              await onSaved();
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Teacher feedback
            <textarea
              className={field}
              required
              maxLength={8000}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
            />
          </label>
          <Button disabled={busy}>Save reviewed feedback</Button>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
      {canSync && s.status === 'reviewed' && <MoodleGradeTransfer submissionId={s.id} />}
    </details>
  );
}
