'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  classroomApi,
  classroomUpload,
  downloadClassroomFile,
  downloadText,
  type Answer,
  type AssignedLesson,
  type Submission,
  type SubmissionAsset,
} from '@/lib/education/classroom-api';
import { offlineAssignmentHtml } from '@/lib/education/offline-assignment';

const emptyAnswer = (): Answer => ({ text: '', option: null, hint_used: false });
export function AssignedLessonReader({ id, onBack }: { id: number; onBack: () => void }) {
  const [lesson, setLesson] = useState<AssignedLesson>();
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [recovery, setRecovery] = useState<Record<string, Answer>>();
  const [storageKey, setStorageKey] = useState('');
  const [status, setStatus] = useState('Loading assignment…');
  const [busy, setBusy] = useState(false);
  const [large, setLarge] = useState(false);
  const [assets, setAssets] = useState<SubmissionAsset[]>([]);
  const [link, setLink] = useState('');
  const pending = useRef<{ signature: string; body: unknown } | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const session = await fetch('/api/omitech/session', { credentials: 'same-origin' }).then(
          (r) => r.json(),
        );
        const learner = session.user?.learner_key;
        if (!session.authenticated || typeof learner !== 'string')
          throw new Error('Reload Learning Studio to verify your account.');
        const value = await classroomApi<AssignedLesson>(`assignments/${id}`);
        const uploaded = await classroomApi<SubmissionAsset[]>(
          `assignments/${id}/submission-assets`,
        );
        if (cancelled) return;
        const key = `omitech-classroom-draft:${learner}:${id}`;
        setLesson(value);
        setAssets(uploaded);
        setAnswers(value.submission?.answers || {});
        setStorageKey(key);
        try {
          const cached = JSON.parse(localStorage.getItem(key) || 'null');
          if (
            cached?.lesson_version === value.lesson_version &&
            cached?.answers &&
            value.submission?.status !== 'submitted' &&
            value.submission?.status !== 'reviewed'
          )
            setRecovery(cached.answers);
        } catch {
          /* Recovery is optional. */
        }
        setStatus(
          value.submission
            ? `Account save: ${value.submission.status}`
            : 'Ready. Answers are saved locally as you type.',
        );
      } catch (e) {
        if (!cancelled) setStatus((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
      window.speechSynthesis?.cancel();
    };
  }, [id]);
  const change = (key: string, patch: Partial<Answer>) => {
    const next = { ...answers, [key]: { ...(answers[key] || emptyAnswer()), ...patch } };
    setAnswers(next);
    pending.current = undefined;
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ lesson_version: lesson?.lesson_version, answers: next }),
      );
      setStatus('Saved on this device. Use Save to account when online.');
    } catch {
      setStatus(
        'Device storage is unavailable. Save to account or download your answers before leaving.',
      );
    }
  };
  const save = async (finalized: boolean) => {
    if (!lesson) return;
    setBusy(true);
    try {
      const signature = JSON.stringify({
        answers,
        finalized,
        version: lesson.submission?.version || 0,
      });
      if (pending.current?.signature !== signature)
        pending.current = {
          signature,
          body: {
            answers,
            finalized,
            version: lesson.submission?.version || 0,
            request_key: crypto.randomUUID(),
          },
        };
      const submission = await classroomApi<Submission>(
        `assignments/${id}/submission`,
        pending.current.body,
      );
      setLesson({ ...lesson, submission });
      pending.current = undefined;
      if (finalized) {
        try {
          localStorage.removeItem(storageKey);
        } catch {
          /* Account submission succeeded. */
        }
        setRecovery(undefined);
        setLesson(await classroomApi<AssignedLesson>(`assignments/${id}`));
      }
      setStatus(finalized ? 'Submitted to your teacher.' : 'Saved to your account.');
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const locked =
    lesson?.role !== 'student' || (lesson.submission && lesson.submission.status !== 'draft');
  return (
    <article
      className={`mx-auto max-w-3xl space-y-4 ${large ? 'text-xl leading-loose' : 'text-base leading-relaxed'}`}
      aria-label="Assigned lesson reader"
    >
      <Button variant="outline" onClick={onBack}>
        Back to classes
      </Button>
      <p role="status">{status}</p>
      {lesson && (
        <>
          <h3 className="text-2xl font-semibold">{lesson.title}</h3>
          <p className="whitespace-pre-wrap">{lesson.instructions}</p>
          {lesson.role !== 'student' && (
            <p>
              This is a staff preview. Staff can see answers; students receive them only after the
              release rule is satisfied.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setLarge(!large)}>
              {large ? 'Standard text' : 'Larger text'}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (!window.speechSynthesis) {
                  setStatus('Read aloud is unavailable in this browser.');
                  return;
                }
                window.speechSynthesis.cancel();
                const speech = new SpeechSynthesisUtterance(
                  lesson.content.sections.map((s) => `${s.heading}. ${s.body}`).join('\n'),
                );
                window.speechSynthesis.speak(speech);
              }}
            >
              Read aloud (optional)
            </Button>
            <Button variant="ghost" onClick={() => window.speechSynthesis?.cancel()}>
              Stop audio
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                downloadText(`assignment-${id}.html`, offlineAssignmentHtml(lesson), 'text/html')
              }
            >
              Download offline lesson
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                downloadText(
                  `assignment-${id}-answers.json`,
                  JSON.stringify({
                    assignment_id: id,
                    lesson_version: lesson.lesson_version,
                    answers,
                  }),
                  'application/json',
                )
              }
            >
              Download my answers
            </Button>
          </div>
          {!locked && (
            <label className="block">
              Import offline answers (review before submitting)
              <input
                type="file"
                accept="application/json,.json"
                onChange={async (e) => {
                  try {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 300000) throw new Error('Answer file too large');
                    const imported = JSON.parse(await file.text());
                    if (
                      imported.assignment_id !== id ||
                      imported.lesson_version !== lesson.lesson_version ||
                      !imported.answers ||
                      typeof imported.answers !== 'object'
                    )
                      throw new Error(
                        'This file belongs to a different assignment or lesson version',
                      );
                    for (const [key, value] of Object.entries(imported.answers)) {
                      const a = value as Answer;
                      if (
                        !/^\d+$/.test(key) ||
                        Number(key) >= lesson.content.questions.length ||
                        typeof a.text !== 'string' ||
                        a.text.length > 8000 ||
                        !(a.option === null || Number.isInteger(a.option)) ||
                        typeof a.hint_used !== 'boolean'
                      )
                        throw new Error('Invalid answer file');
                    }
                    setRecovery(imported.answers);
                    setStatus(
                      'Offline answers loaded for review. Restore them below, then save or submit.',
                    );
                  } catch (err) {
                    setStatus((err as Error).message);
                  } finally {
                    e.target.value = '';
                  }
                }}
              />
            </label>
          )}
          {recovery && !locked && (
            <section className="rounded border p-3">
              <p>A recovery draft is available. It has not overwritten your account answers.</p>
              <details>
                <summary>Review recovered answers</summary>
                <pre className="whitespace-pre-wrap">{JSON.stringify(recovery, null, 2)}</pre>
              </details>
              <Button
                onClick={() => {
                  setAnswers(recovery);
                  setRecovery(undefined);
                  pending.current = undefined;
                  setStatus('Recovery draft restored locally. Review and save to your account.');
                }}
              >
                Restore reviewed draft
              </Button>
              <Button variant="ghost" onClick={() => setRecovery(undefined)}>
                Keep account answers
              </Button>
            </section>
          )}
          <section>
            <h4 className="font-semibold">Learning objectives</h4>
            <ul className="list-disc pl-5">
              {lesson.content.objectives.map((o, i) => (
                <li key={i}>{o}</li>
              ))}
            </ul>
          </section>
          {lesson.content.sections.map((s, i) => (
            <section key={i}>
              <h4 className="font-semibold">{s.heading}</h4>
              <p className="whitespace-pre-wrap">{s.body}</p>
            </section>
          ))}
          {!!lesson.sources?.length && (
            <details>
              <summary>Lesson references</summary>
              <ul>
                {lesson.sources.map((source) => (
                  <li key={source.id}>
                    [{source.id}] {source.title}
                    {source.location ? ` — ${source.location}` : ''}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <fieldset disabled={busy || !!locked} className="space-y-5">
            <legend className="font-semibold">Check your understanding</legend>
            {lesson.content.questions.map((q, i) => (
              <fieldset key={i} className="rounded-xl border p-3">
                <legend>
                  {i + 1}. {q.prompt}
                </legend>
                {q.options.length ? (
                  q.options.map((option, j) => (
                    <label key={j} className="flex items-center gap-3 p-3">
                      <input
                        type="radio"
                        name={`q${i}`}
                        checked={answers[i]?.option === j}
                        onChange={() => change(String(i), { option: j })}
                      />
                      {option}
                    </label>
                  ))
                ) : (
                  <textarea
                    aria-label={`Answer ${i + 1}`}
                    rows={4}
                    maxLength={8000}
                    className="w-full rounded border bg-background p-3"
                    value={answers[i]?.text || ''}
                    onChange={(e) => change(String(i), { text: e.target.value })}
                  />
                )}
                <details
                  onToggle={(e) => {
                    if (e.currentTarget.open && !locked && !answers[i]?.hint_used)
                      change(String(i), { hint_used: true });
                  }}
                >
                  <summary className="cursor-pointer p-2">Show a hint</summary>
                  <p>{q.hint}</p>
                </details>
              </fieldset>
            ))}
          </fieldset>
          <section className="rounded-xl border p-3 space-y-3">
            <h4 className="font-semibold">Project files and evidence</h4>
            <p className="text-xs">
              PDF, Word, PowerPoint, notebook, Python, images, ZIP, spreadsheets, video and HTTPS
              repository links are supported. Files are limited to 50 MB each.
            </p>
            {assets.map((asset) => (
              <div className="flex flex-wrap items-center gap-2" key={asset.id}>
                <span className="flex-1">
                  {asset.filename} ·{' '}
                  {asset.asset_type === 'file'
                    ? `${Math.ceil(asset.size_bytes / 1024)} KB`
                    : 'link'}
                </span>
                {asset.external_url && (
                  <a
                    className="underline"
                    href={asset.external_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open link
                  </a>
                )}
                {asset.download_url && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      void downloadClassroomFile(
                        `submission-assets/${asset.id}/download`,
                        asset.filename,
                      ).catch((e: Error) => setStatus(e.message))
                    }
                  >
                    Download
                  </Button>
                )}
                {!locked && (
                  <Button
                    variant="ghost"
                    onClick={() =>
                      void classroomApi(`submission-assets/${asset.id}`, undefined, 'DELETE')
                        .then(() =>
                          setAssets((current) => current.filter((item) => item.id !== asset.id)),
                        )
                        .catch((e: Error) => setStatus(e.message))
                    }
                  >
                    Remove
                  </Button>
                )}
              </div>
            ))}
            {!locked && (
              <>
                <label className="block">
                  Attach a project file
                  <input
                    type="file"
                    accept=".pdf,.docx,.pptx,.ipynb,.py,.png,.jpg,.jpeg,.zip,.xlsx,.csv,.mp4,.txt"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      setBusy(true);
                      void classroomUpload<SubmissionAsset>(
                        `assignments/${id}/submission-assets`,
                        file,
                      )
                        .then((asset) => setAssets((current) => [...current, asset]))
                        .catch((e: Error) => setStatus(e.message))
                        .finally(() => setBusy(false));
                      event.target.value = '';
                    }}
                  />
                </label>
                <form
                  className="flex flex-wrap gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void classroomApi<SubmissionAsset>(`assignments/${id}/submission-links`, {
                      url: link,
                      label: 'Repository or project link',
                    })
                      .then((asset) => {
                        setAssets((current) => [...current, asset]);
                        setLink('');
                      })
                      .catch((e: Error) => setStatus(e.message));
                  }}
                >
                  <input
                    className="min-w-64 flex-1 rounded border bg-background p-2"
                    type="url"
                    pattern="https://.*"
                    placeholder="https://repository-or-project-link"
                    value={link}
                    onChange={(event) => setLink(event.target.value)}
                  />
                  <Button variant="outline">Add link</Button>
                </form>
              </>
            )}
          </section>
          {!locked && (
            <div className="flex flex-wrap gap-3">
              <Button disabled={busy} variant="outline" onClick={() => void save(false)}>
                Save to account
              </Button>
              <Button disabled={busy} onClick={() => void save(true)}>
                Submit to teacher
              </Button>
            </div>
          )}
          {lesson.submission && (
            <section>
              <h4 className="font-semibold">Feedback</h4>
              {lesson.answers_released ? (
                <>
                  <p>{lesson.submission.feedback || 'Teacher feedback has not been added yet.'}</p>
                  {lesson.content.questions.map((q, i) => (
                    <details key={i}>
                      <summary>Question {i + 1}: review answer</summary>
                      <p>{q.options.length ? q.options[q.correctOption ?? 0] : q.answer}</p>
                      <p>{q.explanation}</p>
                    </details>
                  ))}
                </>
              ) : (
                <p>
                  Your work is saved. Answers and feedback will appear when your teacher’s release
                  rule allows them.
                </p>
              )}
            </section>
          )}
        </>
      )}
    </article>
  );
}
