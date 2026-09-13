'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { downloadText, type ManagedLesson } from '@/lib/education/classroom-api';
import { moodleQuestionBank } from '@/lib/education/moodle-export';

export function MoodleExport({ lessons }: { lessons: ManagedLesson[] }) {
  const [selected, setSelected] = useState('');
  return (
    <details className="rounded-xl border p-3">
      <summary>Moodle question-bank export</summary>
      <p className="my-2 text-sm">
        Download reviewed questions as Moodle XML. In Moodle, open Question bank → Import → Moodle
        XML. This transfers questions and teacher answers in a file; it does not sync rosters or
        grades.
      </p>
      <label>
        Published lesson
        <select
          className="block w-full rounded border bg-background p-2"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">Choose a reviewed lesson</option>
          {lessons.map((l) => (
            <option key={l.id} value={l.id}>
              {l.title}
            </option>
          ))}
        </select>
      </label>
      <Button
        disabled={!selected}
        onClick={() => {
          const lesson = lessons.find((l) => l.id === Number(selected));
          if (lesson)
            downloadText(
              `moodle-lesson-${lesson.id}.xml`,
              moodleQuestionBank(lesson.content),
              'application/xml',
            );
        }}
      >
        Download for Moodle (includes answer key)
      </Button>
    </details>
  );
}
