'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  classroomApi,
  classroomUpload,
  downloadClassroomFile,
  downloadText,
  type ManagedCourse,
} from '@/lib/education/classroom-api';

const field = 'block w-full rounded-lg border bg-background p-2 text-sm';
const PILOT_STEPS = {
  lecturer: ['Create course', 'Publish week', 'Download DMI PPTX', 'Mark work', 'Export archive'],
  student: ['Join class', 'Open week', 'Download offline material', 'Submit work', 'Read feedback'],
} as const;

interface GovernanceDashboard {
  objectives: { id: number; title: string; bloom_level: string | null }[];
  outcome_coverage: number;
  outcome_total: number;
  counts: Record<string, number>;
  official_template: { name: string; size_bytes: number; sha256: string } | null;
  backup_enabled: boolean;
  role: string;
}

interface PilotCheck {
  id: number;
  role: 'lecturer' | 'student';
  step: string;
  status: 'not_tested' | 'passed' | 'failed' | 'blocked';
  notes: string;
}

export function GovernanceTools({
  course,
  members,
}: {
  course: ManagedCourse;
  members: { user_id: number; name: string; role: string }[];
}) {
  const staff = course.role !== 'student';
  const canEdit = course.role === 'owner' || course.role === 'teacher';
  const [dashboard, setDashboard] = useState<GovernanceDashboard>();
  const [pilot, setPilot] = useState<PilotCheck[]>([]);
  const [progress, setProgress] = useState<
    { id: number; user_id: number; objective_id: number; status: string }[]
  >([]);
  const [templateFile, setTemplateFile] = useState<File>();
  const [newOutcome, setNewOutcome] = useState('');
  const [objectiveId, setObjectiveId] = useState(0);
  const [evidenceRef, setEvidenceRef] = useState('');
  const [questionPrompt, setQuestionPrompt] = useState('');
  const [questionAnswer, setQuestionAnswer] = useState('');
  const [rubricTitle, setRubricTitle] = useState('Laboratory report rubric');
  const [examTitle, setExamTitle] = useState('End of semester examination');
  const [examMarks, setExamMarks] = useState(100);
  const [reviewRef, setReviewRef] = useState('semester-materials');
  const [reviewStage, setReviewStage] = useState('technical_verification');
  const [studentId, setStudentId] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const nextDashboard = await classroomApi<GovernanceDashboard>(
      `classrooms/${course.id}/governance`,
    );
    setDashboard(nextDashboard);
    setObjectiveId((current) => current || nextDashboard.objectives[0]?.id || 0);
    if (staff) {
      setPilot(await classroomApi<PilotCheck[]>(`classrooms/${course.id}/pilot-checks`));
    }
    setProgress(await classroomApi<typeof progress>(`classrooms/${course.id}/progress`));
  }, [course.id, staff]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((cause: Error) => setError(cause.message));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const act = async (action: () => Promise<unknown>, success: string) => {
    setError('');
    setMessage('');
    try {
      await action();
      setMessage(success);
      await load();
    } catch (cause) {
      setError((cause as Error).message);
    }
  };

  if (!dashboard) return <p className="text-sm">Loading academic governance…</p>;

  return (
    <details className="rounded-lg border p-3">
      <summary>Course governance, assessment and pilot readiness</summary>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {message && <p className="mt-2 text-sm text-green-700">{message}</p>}

      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        <p>
          Outcomes assessed: {dashboard.outcome_coverage}/{dashboard.outcome_total}
        </p>
        <p>Question bank: {dashboard.counts.questions || 0}</p>
        <p>Rubrics: {dashboard.counts.rubrics || 0}</p>
        <p>Exam blueprints: {dashboard.counts.exams || 0}</p>
      </div>

      {course.role === 'owner' && (
        <section className="mt-4 space-y-2">
          <h5 className="font-medium">Official DMI PowerPoint template</h5>
          <p className="text-xs text-muted-foreground">
            Upload the institution-approved PPTX. The original file is preserved for lecturers to
            download and use without reconstructing its layouts.
          </p>
          {dashboard.official_template && (
            <p className="text-sm">
              Current: {dashboard.official_template.name} (
              {Math.ceil(dashboard.official_template.size_bytes / 1024)} KB)
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <input
              type="file"
              accept=".pptx"
              onChange={(e) => setTemplateFile(e.target.files?.[0])}
            />
            <Button
              disabled={!templateFile}
              variant="outline"
              onClick={() =>
                templateFile &&
                void act(
                  () =>
                    classroomUpload(
                      `classrooms/${course.id}/official-presentation-template`,
                      templateFile,
                    ),
                  'Official template saved.',
                )
              }
            >
              Upload official template
            </Button>
            {dashboard.official_template && (
              <Button
                variant="outline"
                onClick={() =>
                  void downloadClassroomFile(
                    `classrooms/${course.id}/official-presentation-template`,
                    dashboard.official_template?.name || 'DMI-template.pptx',
                  )
                }
              >
                Download official template
              </Button>
            )}
          </div>
        </section>
      )}

      {canEdit && (
        <>
          <section className="mt-4 space-y-2">
            <h5 className="font-medium">Learning outcomes and assessment coverage</h5>
            <div className="grid gap-2 md:grid-cols-3">
              <input
                className={field}
                placeholder="New learning outcome"
                value={newOutcome}
                onChange={(e) => setNewOutcome(e.target.value)}
              />
              <Button
                variant="outline"
                disabled={!newOutcome.trim()}
                onClick={() =>
                  void act(
                    () =>
                      classroomApi(`courses/${course.id}/objectives`, {
                        title: newOutcome,
                        bloom_level: 'apply',
                      }),
                    'Learning outcome added.',
                  )
                }
              >
                Add outcome
              </Button>
              <span />
              <select
                className={field}
                value={objectiveId}
                onChange={(e) => setObjectiveId(Number(e.target.value))}
              >
                <option value={0}>Choose outcome</option>
                {dashboard.objectives.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
              <input
                className={field}
                placeholder="Evidence reference, for example Assignment 1"
                value={evidenceRef}
                onChange={(e) => setEvidenceRef(e.target.value)}
              />
              <Button
                variant="outline"
                disabled={!objectiveId || !evidenceRef.trim()}
                onClick={() =>
                  void act(
                    () =>
                      classroomApi(`classrooms/${course.id}/outcome-evidence`, {
                        objective_id: objectiveId,
                        evidence_type: 'assignment',
                        evidence_ref: evidenceRef,
                        coverage_level: 'assessed',
                      }),
                    'Outcome coverage recorded.',
                  )
                }
              >
                Map assessment
              </Button>
            </div>
          </section>

          <section className="mt-4 space-y-2">
            <h5 className="font-medium">Question bank and revision versions</h5>
            <textarea
              className={field}
              rows={2}
              placeholder="Question"
              value={questionPrompt}
              onChange={(e) => setQuestionPrompt(e.target.value)}
            />
            <textarea
              className={field}
              rows={2}
              placeholder="Answer and marking guidance"
              value={questionAnswer}
              onChange={(e) => setQuestionAnswer(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={!questionPrompt.trim() || !questionAnswer.trim()}
                onClick={() =>
                  void act(
                    () =>
                      classroomApi(`classrooms/${course.id}/question-bank`, {
                        objective_id: objectiveId || null,
                        question_type: 'short-answer',
                        difficulty: 'standard',
                        prompt: questionPrompt,
                        answer: questionAnswer,
                        marking_guidance: questionAnswer,
                        status: course.role === 'owner' ? 'published' : 'draft',
                      }),
                    'Question added.',
                  )
                }
              >
                Add published question
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  void classroomApi(`classrooms/${course.id}/question-bank/build`, {
                    count: 10,
                    difficulty: 'any',
                    seed: Date.now() % 2147483647,
                    include_answers: true,
                  })
                    .then((value) =>
                      downloadText(
                        `${course.code || course.id}-quiz.json`,
                        JSON.stringify(value, null, 2),
                        'application/json',
                      ),
                    )
                    .catch((cause: Error) => setError(cause.message))
                }
              >
                Download randomized quiz
              </Button>
            </div>
          </section>

          <section className="mt-4 space-y-2">
            <h5 className="font-medium">Reusable rubric and exam blueprint</h5>
            <div className="grid gap-2 md:grid-cols-3">
              <input
                className={field}
                value={rubricTitle}
                onChange={(e) => setRubricTitle(e.target.value)}
              />
              <Button
                variant="outline"
                onClick={() =>
                  void act(
                    () =>
                      classroomApi(`classrooms/${course.id}/rubrics`, {
                        title: rubricTitle,
                        status: course.role === 'owner' ? 'approved' : 'draft',
                        criteria: [
                          {
                            criterion: 'Technical accuracy',
                            maximum_marks: 40,
                            descriptors: {
                              excellent: 'Accurate reasoning, units and evidence',
                              developing: 'Some correct reasoning with omissions',
                            },
                          },
                          {
                            criterion: 'Method and communication',
                            maximum_marks: 60,
                            descriptors: {
                              excellent: 'Clear method and reproducible evidence',
                              developing: 'Method needs clarification',
                            },
                          },
                        ],
                      }),
                    'Rubric saved.',
                  )
                }
              >
                Create approved rubric
              </Button>
              <span />
              <input
                className={field}
                value={examTitle}
                onChange={(e) => setExamTitle(e.target.value)}
              />
              <input
                className={field}
                type="number"
                min={1}
                max={1000}
                value={examMarks}
                onChange={(e) => setExamMarks(Number(e.target.value))}
              />
              <Button
                variant="outline"
                onClick={() =>
                  void act(
                    () =>
                      classroomApi(`classrooms/${course.id}/exam-blueprints`, {
                        title: examTitle,
                        duration_minutes: 180,
                        total_marks: examMarks,
                        status: 'moderation',
                        sections: [
                          {
                            title: 'Examination questions',
                            marks: examMarks,
                            question_ids: [],
                            objective_ids: dashboard.objectives.map((item) => item.id),
                            bloom_levels: ['understand', 'apply', 'analyse'],
                          },
                        ],
                      }),
                    'Exam blueprint created for moderation.',
                  )
                }
              >
                Create exam blueprint
              </Button>
            </div>
          </section>

          <section className="mt-4 space-y-2">
            <h5 className="font-medium">Material review workflow</h5>
            <div className="grid gap-2 md:grid-cols-3">
              <input
                className={field}
                value={reviewRef}
                onChange={(e) => setReviewRef(e.target.value)}
              />
              <select
                className={field}
                value={reviewStage}
                onChange={(e) => setReviewStage(e.target.value)}
              >
                {[
                  'draft',
                  'technical_verification',
                  'academic_review',
                  'approved',
                  'published',
                ].map((stage) => (
                  <option key={stage}>{stage}</option>
                ))}
              </select>
              <Button
                variant="outline"
                onClick={() =>
                  void act(
                    () =>
                      classroomApi(`classrooms/${course.id}/material-reviews`, {
                        artifact_type: 'notes',
                        artifact_ref: reviewRef,
                        stage: reviewStage,
                        notes: '',
                        snapshot: { semester: course.term, recorded_at: new Date().toISOString() },
                      }),
                    'Review stage recorded.',
                  )
                }
              >
                Record review stage
              </Button>
            </div>
          </section>

          {!!members.filter((item) => item.role === 'student').length &&
            !!dashboard.objectives.length && (
              <section className="mt-4 space-y-2">
                <h5 className="font-medium">Student outcome progress</h5>
                <div className="grid gap-2 md:grid-cols-3">
                  <select
                    className={field}
                    value={studentId}
                    onChange={(e) => setStudentId(Number(e.target.value))}
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
                  <select
                    className={field}
                    value={objectiveId}
                    onChange={(e) => setObjectiveId(Number(e.target.value))}
                  >
                    {dashboard.objectives.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="outline"
                    disabled={!studentId || !objectiveId}
                    onClick={() =>
                      void act(
                        () =>
                          classroomApi(
                            `classrooms/${course.id}/progress`,
                            {
                              user_id: studentId,
                              objective_id: objectiveId,
                              status: 'demonstrated',
                              evidence: [
                                { type: 'lecturer_review', recorded_at: new Date().toISOString() },
                              ],
                            },
                            'PUT',
                          ),
                        'Student progress updated.',
                      )
                    }
                  >
                    Mark demonstrated
                  </Button>
                </div>
              </section>
            )}
        </>
      )}

      {!staff && (
        <section className="mt-4 space-y-2">
          <h5 className="font-medium">Revision and outcome progress</h5>
          {progress.map((item) => (
            <p className="text-sm" key={item.id}>
              Outcome {item.objective_id}: {item.status.replaceAll('_', ' ')}
            </p>
          ))}
          <Button
            variant="outline"
            onClick={() =>
              void classroomApi(`classrooms/${course.id}/revision-pack`)
                .then((value) =>
                  downloadText(
                    `${course.code || course.id}-revision-pack.json`,
                    JSON.stringify(value, null, 2),
                    'application/json',
                  ),
                )
                .catch((cause: Error) => setError(cause.message))
            }
          >
            Download revision pack
          </Button>
          <Button
            className="ml-2"
            variant="outline"
            onClick={() =>
              void classroomApi(`classrooms/${course.id}/my-data`)
                .then((value) =>
                  downloadText(
                    `${course.code || course.id}-my-learning-data.json`,
                    JSON.stringify(value, null, 2),
                    'application/json',
                  ),
                )
                .catch((cause: Error) => setError(cause.message))
            }
          >
            Export my course data
          </Button>
        </section>
      )}

      {staff && (
        <section className="mt-4 space-y-2">
          <h5 className="font-medium">Lecturer and student acceptance pilot</h5>
          {(['lecturer', 'student'] as const).map((role) => (
            <div key={role}>
              <p className="mt-2 text-sm font-medium">{role}</p>
              <div className="flex flex-wrap gap-2">
                {PILOT_STEPS[role].map((step) => {
                  const current = pilot.find((item) => item.role === role && item.step === step);
                  return (
                    <Button
                      key={step}
                      variant="outline"
                      onClick={() =>
                        void act(
                          () =>
                            classroomApi(
                              `classrooms/${course.id}/pilot-checks`,
                              {
                                role,
                                step,
                                status: 'passed',
                                notes: 'Verified in acceptance session',
                              },
                              'PUT',
                            ),
                          `${role} check recorded.`,
                        )
                      }
                    >
                      {current?.status === 'passed' ? '✓ ' : ''}
                      {step}
                    </Button>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() =>
                void classroomApi(`classrooms/${course.id}/accessibility-audit`)
                  .then((value) =>
                    downloadText(
                      `${course.code || course.id}-accessibility-audit.json`,
                      JSON.stringify(value, null, 2),
                      'application/json',
                    ),
                  )
                  .catch((cause: Error) => setError(cause.message))
              }
            >
              Download accessibility audit
            </Button>
            {course.role === 'owner' && (
              <Button
                variant="outline"
                onClick={() =>
                  void classroomApi(`classrooms/${course.id}/backup-status`)
                    .then((value) => window.alert(JSON.stringify(value, null, 2)))
                    .catch((cause: Error) => setError(cause.message))
                }
              >
                Check backup status
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() =>
                void classroomApi(`classrooms/${course.id}/data-controls`)
                  .then((value) =>
                    downloadText(
                      `${course.code || course.id}-data-controls.json`,
                      JSON.stringify(value, null, 2),
                      'application/json',
                    ),
                  )
                  .catch((cause: Error) => setError(cause.message))
              }
            >
              Download data-control policy
            </Button>
          </div>
        </section>
      )}
    </details>
  );
}
