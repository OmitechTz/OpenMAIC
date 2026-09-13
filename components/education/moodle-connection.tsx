'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { classroomApi, type Assignment } from '@/lib/education/classroom-api';

export function MoodleConnection({
  courseId,
  assignments,
  onImported,
}: {
  courseId: number;
  assignments: Assignment[];
  onImported: () => Promise<void>;
}) {
  const [remoteId, setRemoteId] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [roster, setRoster] = useState<
    { id: number; name: string; email: string; account_exists: boolean }[]
  >([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [remoteAssignments, setRemoteAssignments] = useState<
    { id: number; name: string; grade: number }[]
  >([]);
  const [localAssignment, setLocalAssignment] = useState('');
  const [remoteAssignment, setRemoteAssignment] = useState('');
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setMessage('');
    try {
      await action();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <details className="rounded-xl border p-3 space-y-3">
      <summary>Institutional Moodle connection</summary>
      <p className="text-sm">
        The institution configures its Moodle service connection. Preview the course and student
        roster before importing. Grade transfer requires a separate preview and explicit send for
        each reviewed submission.
      </p>
      <Button
        variant="outline"
        disabled={busy}
        onClick={() =>
          void run(async () => {
            const status = await classroomApi<{
              configured: boolean;
              remote_course_id: number | null;
            }>(`classrooms/${courseId}/moodle`);
            setRemoteId(status.remote_course_id ? String(status.remote_course_id) : '');
            setMessage(
              status.configured
                ? 'Moodle credentials configured. Link / check the course to test live access.'
                : 'Ask the administrator to configure LEARNING_MOODLE_URL and LEARNING_MOODLE_TOKEN. Moodle XML export is available meanwhile.',
            );
          })
        }
      >
        Check configuration
      </Button>
      <label className="block">
        Moodle course ID
        <input
          type="number"
          min={1}
          className="ml-2 rounded border bg-background p-2"
          value={remoteId}
          onChange={(e) => setRemoteId(e.target.value)}
        />
      </label>
      <Button
        disabled={busy || !remoteId}
        onClick={() =>
          void run(async () => {
            const result = await classroomApi<{ name: string }>(
              `classrooms/${courseId}/moodle/link`,
              { remote_course_id: Number(remoteId) },
            );
            setMessage(`Linked to ${result.name}`);
            setRoster([]);
            setSelected([]);
          })
        }
      >
        Link / check course
      </Button>
      <Button
        variant="outline"
        disabled={busy}
        onClick={() =>
          void run(async () => {
            setRoster(await classroomApi<typeof roster>(`classrooms/${courseId}/moodle/roster`));
            setSelected([]);
          })
        }
      >
        Preview student roster
      </Button>
      {roster.map((m) => (
        <label key={m.id} className="block p-2">
          <input
            type="checkbox"
            disabled={!m.account_exists || busy}
            checked={selected.includes(m.id)}
            onChange={(e) =>
              setSelected(
                e.target.checked ? [...selected, m.id] : selected.filter((id) => id !== m.id),
              )
            }
          />{' '}
          {m.name} · {m.email}
          {!m.account_exists ? ' — needs an Omitech account' : ''}
        </label>
      ))}
      {!!roster.length && (
        <Button
          disabled={busy || !selected.length}
          onClick={() =>
            void run(async () => {
              const result = await classroomApi<{ imported: number; skipped: number }>(
                `classrooms/${courseId}/moodle/roster`,
                { remote_user_ids: selected },
              );
              setMessage(
                `${result.imported} students added; ${result.skipped} already present or unavailable.`,
              );
              setSelected([]);
              await onImported();
            })
          }
        >
          Import selected students into this class
        </Button>
      )}
      <Button
        variant="outline"
        disabled={busy}
        onClick={() =>
          void run(async () =>
            setRemoteAssignments(
              await classroomApi<typeof remoteAssignments>(
                `classrooms/${courseId}/moodle/assignments`,
              ),
            ),
          )
        }
      >
        Load Moodle assignments
      </Button>
      {!!remoteAssignments.length && (
        <div className="flex flex-wrap gap-2">
          <label>
            Omitech assignment
            <select
              className="block rounded border bg-background p-2"
              value={localAssignment}
              onChange={(e) => setLocalAssignment(e.target.value)}
            >
              <option value="">Choose</option>
              {assignments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Moodle destination
            <select
              className="block rounded border bg-background p-2"
              value={remoteAssignment}
              onChange={(e) => setRemoteAssignment(e.target.value)}
            >
              <option value="">Choose</option>
              {remoteAssignments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · out of {a.grade}
                </option>
              ))}
            </select>
          </label>
          <Button
            disabled={busy || !localAssignment || !remoteAssignment}
            onClick={() =>
              void run(async () => {
                await classroomApi(`assignments/${localAssignment}/moodle/link`, {
                  remote_assignment_id: Number(remoteAssignment),
                });
                setMessage(
                  'Assignment destination saved. Review individual grades before sending.',
                );
              })
            }
          >
            Link grade destination
          </Button>
        </div>
      )}
      <p role="status" className="text-sm">
        {message}
      </p>
    </details>
  );
}

export function MoodleGradeTransfer({ submissionId }: { submissionId: number }) {
  const [preview, setPreview] = useState<{
    preview_hash: string;
    name: string;
    assignment: string;
    grade: number;
    maximum: number;
    feedback: string;
  }>();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <section className="my-3 rounded border p-3">
      <Button
        disabled={busy}
        variant="outline"
        onClick={async () => {
          setBusy(true);
          setPreview(undefined);
          try {
            setPreview(await classroomApi(`submissions/${submissionId}/moodle/preview`));
            setMessage('');
          } catch (e) {
            setMessage((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        Preview Moodle grade transfer
      </Button>
      {preview && (
        <>
          <p>
            {preview.name} → {preview.assignment}: {preview.grade}/{preview.maximum}
          </p>
          <p className="whitespace-pre-wrap">{preview.feedback}</p>
          <p className="text-xs">
            Sending updates this student’s grade and feedback in the linked Moodle assignment. It
            does not enable automatic future transfers.
          </p>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const result = await classroomApi<{ message: string }>(
                  `submissions/${submissionId}/moodle/send`,
                  { preview_hash: preview.preview_hash },
                );
                setMessage(result.message);
                setPreview(undefined);
              } catch (e) {
                setMessage((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Send this reviewed grade to Moodle
          </Button>
        </>
      )}
      <p role="status">{message}</p>
    </section>
  );
}
