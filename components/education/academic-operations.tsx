'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  classroomApi,
  downloadClassroomFile,
  type Gradebook,
  type ManagedCourse,
  type MaterialMatrix,
} from '@/lib/education/classroom-api';
import { navigateOmitechParent } from '@/lib/omitech/parent-navigation';

const field = 'block w-full rounded-lg border bg-background p-2 text-sm';

interface Member {
  user_id: number;
  name: string;
  role: string;
}

interface Discussion {
  id: number;
  name: string;
  week_id: string;
  body: string;
  created_at: string;
}

export function AcademicOperations({
  course,
  members,
  onSemesterImported,
}: {
  course: ManagedCourse;
  members: Member[];
  onSemesterImported: () => Promise<void>;
}) {
  const staff = course.role !== 'student';
  const canEdit = course.role === 'owner' || course.role === 'teacher';
  const [matrix, setMatrix] = useState<MaterialMatrix>();
  const [gradebook, setGradebook] = useState<Gradebook>();
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [interventions, setInterventions] = useState<
    { user_id: number; name: string; email: string; flags: string[] }[]
  >([]);
  const [health, setHealth] = useState<{
    status: string;
    retention_months: number;
    storage_quota_mb: number;
    pending_verifications: number;
    grade_weight_total: number;
    recommendations: string[];
  }>();
  const [studentHome, setStudentHome] = useState<{
    published_weeks: unknown[];
    upcoming: { id: number; title: string; due_at: string | null }[];
    attendance: { sessions: number; present: number };
  }>();
  const [syllabus, setSyllabus] = useState('');
  const [gradeTitle, setGradeTitle] = useState('');
  const [gradeWeight, setGradeWeight] = useState(0);
  const [gradeMax, setGradeMax] = useState(100);
  const [gradeStudent, setGradeStudent] = useState(0);
  const [gradeItem, setGradeItem] = useState(0);
  const [gradeScore, setGradeScore] = useState('');
  const [checkKind, setCheckKind] = useState('equation');
  const [checkStatement, setCheckStatement] = useState('');
  const [checkEvidence, setCheckEvidence] = useState('');
  const [expectedValue, setExpectedValue] = useState('');
  const [calculatedValue, setCalculatedValue] = useState('');
  const [calculationUnit, setCalculationUnit] = useState('');
  const [discussion, setDiscussion] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [nextMatrix, nextGrades, nextDiscussions] = await Promise.all([
      classroomApi<MaterialMatrix>(`classrooms/${course.id}/material-matrix`),
      classroomApi<Gradebook>(`classrooms/${course.id}/gradebook`),
      classroomApi<Discussion[]>(`classrooms/${course.id}/discussions`),
    ]);
    setMatrix(nextMatrix);
    setGradebook(nextGrades);
    setDiscussions(nextDiscussions);
    if (staff) {
      const [nextInterventions, nextHealth] = await Promise.all([
        classroomApi<typeof interventions>(`classrooms/${course.id}/interventions`),
        classroomApi<NonNullable<typeof health>>(`classrooms/${course.id}/operations-health`),
      ]);
      setInterventions(nextInterventions);
      setHealth(nextHealth);
    } else {
      setStudentHome(
        await classroomApi<NonNullable<typeof studentHome>>(`classrooms/${course.id}/student-home`),
      );
    }
  }, [course.id, staff]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((cause: Error) => setError(cause.message));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const act = async (action: () => Promise<unknown>) => {
    setError('');
    try {
      await action();
      await load();
    } catch (cause) {
      setError((cause as Error).message);
    }
  };

  return (
    <details className="rounded-lg border p-3">
      <summary>Academic quality, progress and communication</summary>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {!staff && studentHome && (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <p>{studentHome.published_weeks.length} published weeks</p>
          <p>{studentHome.upcoming.length} activities to complete</p>
          <p>
            Attendance {studentHome.attendance.present}/{studentHome.attendance.sessions}
          </p>
        </div>
      )}

      {canEdit && (
        <section className="mt-4 space-y-2">
          <h5 className="font-medium">Import an approved syllabus</h5>
          <p className="text-xs text-muted-foreground">
            Paste headings such as “Week 1: Introduction”. The result stays editable before
            publication.
          </p>
          <textarea
            className={field}
            rows={5}
            value={syllabus}
            onChange={(event) => setSyllabus(event.target.value)}
          />
          <Button
            variant="outline"
            onClick={() =>
              void act(async () => {
                await classroomApi(`classrooms/${course.id}/syllabus/import`, {
                  text: syllabus,
                  replace_weeks: true,
                });
                await onSemesterImported();
              })
            }
          >
            Import weekly structure
          </Button>
        </section>
      )}

      {!!gradebook?.items.length && (
        <section className="mt-4 overflow-x-auto">
          <h5 className="font-medium">Published marks</h5>
          <table className="mt-2 w-full text-left text-sm">
            <thead>
              <tr>
                <th>Assessment</th>
                {staff && <th>Student</th>}
                <th>Score</th>
                <th>Weight</th>
                <th>Feedback</th>
              </tr>
            </thead>
            <tbody>
              {gradebook.grades.map((grade) => {
                const item = gradebook.items.find((entry) => entry.id === grade.grade_item_id);
                return (
                  <tr className="border-t" key={grade.id}>
                    <td className="py-2">{item?.title}</td>
                    {staff && <td>{grade.name}</td>}
                    <td>
                      {grade.score ?? '—'} / {item?.maximum_score}
                    </td>
                    <td>{item?.weight_percent}%</td>
                    <td>{grade.feedback || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {matrix && (
        <section className="mt-4 overflow-x-auto">
          <h5 className="font-medium">
            Material completeness ({matrix.complete}/{matrix.rows.length} ready)
          </h5>
          <table className="mt-2 w-full text-left text-sm">
            <thead>
              <tr>
                <th>Week</th>
                <th>Sources</th>
                <th>Lesson</th>
                <th>Assignment</th>
                {staff && <th>Missing</th>}
              </tr>
            </thead>
            <tbody>
              {matrix.rows.map((row) => (
                <tr className="border-t" key={row.week}>
                  <td className="py-2">
                    {row.week}: {row.title}
                  </td>
                  <td>
                    {row.source_excerpt_count}/{row.source_count}
                  </td>
                  <td>{row.lesson_ready ? 'Ready' : 'Not linked'}</td>
                  <td>{row.assignment_ready ? 'Ready' : 'Not linked'}</td>
                  {staff && <td>{row.missing.join(', ') || '—'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {canEdit && (
        <section className="mt-4 space-y-2">
          <h5 className="font-medium">Weighted gradebook</h5>
          <div className="grid gap-2 md:grid-cols-4">
            <input
              className={field}
              placeholder="Assessment title"
              value={gradeTitle}
              onChange={(e) => setGradeTitle(e.target.value)}
            />
            <input
              className={field}
              aria-label="Maximum score"
              type="number"
              min={1}
              value={gradeMax}
              onChange={(e) => setGradeMax(Number(e.target.value))}
            />
            <input
              className={field}
              aria-label="Weight percent"
              type="number"
              min={0}
              max={100}
              value={gradeWeight}
              onChange={(e) => setGradeWeight(Number(e.target.value))}
            />
            <Button
              variant="outline"
              onClick={() =>
                void act(() =>
                  classroomApi(`classrooms/${course.id}/grade-items`, {
                    title: gradeTitle,
                    category: 'coursework',
                    maximum_score: gradeMax,
                    weight_percent: gradeWeight,
                    published: true,
                  }),
                )
              }
            >
              Add column
            </Button>
          </div>
          {!!gradebook?.items.length && (
            <div className="grid gap-2 md:grid-cols-4">
              <select
                className={field}
                value={gradeItem}
                onChange={(e) => setGradeItem(Number(e.target.value))}
              >
                <option value={0}>Choose assessment</option>
                {gradebook.items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title} / {item.maximum_score}
                  </option>
                ))}
              </select>
              <select
                className={field}
                value={gradeStudent}
                onChange={(e) => setGradeStudent(Number(e.target.value))}
              >
                <option value={0}>Choose student</option>
                {members
                  .filter((item) => item.role === 'student')
                  .map((item) => (
                    <option key={item.user_id} value={item.user_id}>
                      {item.name}
                    </option>
                  ))}
              </select>
              <input
                className={field}
                placeholder="Score"
                type="number"
                min={0}
                value={gradeScore}
                onChange={(e) => setGradeScore(e.target.value)}
              />
              <Button
                variant="outline"
                disabled={!gradeItem || !gradeStudent || gradeScore === ''}
                onClick={() =>
                  void act(() =>
                    classroomApi(
                      `grade-items/${gradeItem}/grade`,
                      { user_id: gradeStudent, score: Number(gradeScore), feedback: '' },
                      'PUT',
                    ),
                  )
                }
              >
                Save mark
              </Button>
            </div>
          )}
          <p className="text-xs">Current assessment weight: {gradebook?.weight_total || 0}%</p>
        </section>
      )}

      {staff && (
        <section className="mt-4 space-y-2">
          <h5 className="font-medium">Engineering and source verification</h5>
          <div className="grid gap-2 md:grid-cols-3">
            <select
              className={field}
              value={checkKind}
              onChange={(e) => setCheckKind(e.target.value)}
            >
              {['source', 'equation', 'calculation', 'unit', 'diagram', 'software-output'].map(
                (kind) => (
                  <option key={kind}>{kind}</option>
                ),
              )}
            </select>
            <input
              className={field}
              placeholder="What was checked?"
              value={checkStatement}
              onChange={(e) => setCheckStatement(e.target.value)}
            />
            <input
              className={field}
              placeholder="Evidence or method"
              value={checkEvidence}
              onChange={(e) => setCheckEvidence(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            onClick={() =>
              void act(() =>
                classroomApi(`classrooms/${course.id}/verifications`, {
                  kind: checkKind,
                  statement: checkStatement,
                  evidence: checkEvidence,
                  status: 'verified',
                }),
              )
            }
          >
            Record verified check
          </Button>
          <Button
            className="ml-2"
            variant="outline"
            onClick={() => navigateOmitechParent('/flow-diagrams')}
          >
            Open technical diagram studio
          </Button>
          <div className="grid gap-2 md:grid-cols-4">
            <input
              className={field}
              type="number"
              step="any"
              placeholder="Expected value"
              value={expectedValue}
              onChange={(e) => setExpectedValue(e.target.value)}
            />
            <input
              className={field}
              type="number"
              step="any"
              placeholder="Calculated value"
              value={calculatedValue}
              onChange={(e) => setCalculatedValue(e.target.value)}
            />
            <input
              className={field}
              placeholder="Unit, for example Pa"
              value={calculationUnit}
              onChange={(e) => setCalculationUnit(e.target.value)}
            />
            <Button
              variant="outline"
              disabled={!checkStatement || !expectedValue || !calculatedValue || !calculationUnit}
              onClick={() =>
                void act(() =>
                  classroomApi(`classrooms/${course.id}/verifications/calculation`, {
                    statement: checkStatement,
                    expected: expectedValue,
                    calculated: calculatedValue,
                    unit: calculationUnit,
                    relative_tolerance: '0.001',
                  }),
                )
              }
            >
              Check calculation
            </Button>
          </div>
          {interventions.map((item) => (
            <p className="text-sm" key={item.user_id}>
              <strong>{item.name}:</strong> {item.flags.join('; ')}
            </p>
          ))}
        </section>
      )}

      <section className="mt-4 space-y-2">
        <h5 className="font-medium">Class questions and discussion</h5>
        {discussions.map((item) => (
          <article className="rounded border p-2 text-sm" key={item.id}>
            <strong>{item.name}</strong>
            {item.week_id ? ` · ${item.week_id}` : ''}
            <p>{item.body}</p>
          </article>
        ))}
        <div className="flex gap-2">
          <input
            className={field}
            placeholder="Ask or answer a course question"
            value={discussion}
            onChange={(e) => setDiscussion(e.target.value)}
          />
          <Button
            variant="outline"
            disabled={!discussion.trim()}
            onClick={() =>
              void act(async () => {
                await classroomApi(`classrooms/${course.id}/discussions`, {
                  body: discussion,
                  week_id: '',
                });
                setDiscussion('');
              })
            }
          >
            Post
          </Button>
        </div>
      </section>

      {staff && health && (
        <section className="mt-4 space-y-2">
          <h5 className="font-medium">Operations and recovery</h5>
          <p className="text-sm">
            Status: {health.status} · verification queue: {health.pending_verifications} ·
            retention: {health.retention_months} months · quota: {health.storage_quota_mb} MB
          </p>
          {health.recommendations.map((item) => (
            <p className="text-sm" key={item}>
              • {item}
            </p>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() =>
                void downloadClassroomFile(
                  `classrooms/${course.id}/lab-pack`,
                  `course-${course.id}-lab-pack.zip`,
                )
              }
            >
              Download software lab pack
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                void classroomApi(`classrooms/${course.id}/notifications`)
                  .then((result) =>
                    window.alert(
                      `${(result as { items: unknown[] }).items.length} in-app notices are available.`,
                    ),
                  )
                  .catch((cause: Error) => setError(cause.message))
              }
            >
              Check notifications
            </Button>
            {course.role === 'owner' && (
              <Button
                variant="outline"
                onClick={() => {
                  if (
                    !window.confirm(
                      'Remove expired draft submissions and their files according to this course retention policy? Published and submitted records are preserved.',
                    )
                  )
                    return;
                  void act(() =>
                    classroomApi(`classrooms/${course.id}/retention/apply`, {
                      confirm: true,
                      dry_run: false,
                    }),
                  );
                }}
              >
                Apply draft retention policy
              </Button>
            )}
          </div>
        </section>
      )}
    </details>
  );
}
