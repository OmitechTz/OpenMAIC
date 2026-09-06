export interface ReviewState {
  intervalDays: number;
  repetitions: number;
  lapses: number;
  dueAt: number;
  reviewedAt: number;
}
export type ReviewGrade = 'again' | 'hard' | 'good' | 'easy';
export interface PracticeAttempt {
  id: string;
  artifactId: string;
  itemId: string;
  topic: string;
  correct: boolean;
  kind: 'quiz' | 'flashcard';
  scoring: 'automatic' | 'self';
  at: number;
}
export function scheduleReview(
  previous: ReviewState | undefined,
  grade: ReviewGrade,
  now: number,
): ReviewState {
  const days = previous?.intervalDays || 0;
  const intervalDays =
    grade === 'again'
      ? 0
      : grade === 'hard'
        ? Math.max(1, Math.round(days * 1.2))
        : grade === 'good'
          ? Math.max(1, Math.round(days * 2.5))
          : Math.max(3, Math.round(days * 3.5));
  return {
    intervalDays,
    repetitions: grade === 'again' ? 0 : (previous?.repetitions || 0) + 1,
    lapses: (previous?.lapses || 0) + (grade === 'again' ? 1 : 0),
    reviewedAt: now,
    dueAt: now + (grade === 'again' ? 10 * 60 * 1000 : intervalDays * 86400000),
  };
}
export function revisionTopics(attempts: PracticeAttempt[]) {
  const topics = new Map<
    string,
    { topic: string; attempts: number; missed: number; lastAt: number }
  >();
  // Last 20 attempts per topic avoids permanently penalizing early mistakes.
  for (const attempt of [...attempts].sort((a, b) => b.at - a.at)) {
    const value = topics.get(attempt.topic) || {
      topic: attempt.topic,
      attempts: 0,
      missed: 0,
      lastAt: attempt.at,
    };
    if (value.attempts >= 20) continue;
    value.attempts++;
    if (!attempt.correct) value.missed++;
    topics.set(attempt.topic, value);
  }
  return [...topics.values()].sort(
    (a, b) => b.missed / b.attempts - a.missed / a.attempts || a.lastAt - b.lastAt,
  );
}

/** A deterministic, budgeted timetable; recomputed from actual recent attempts. */
export function revisionPlan(
  attempts: PracticeAttempt[],
  minutesPerDay: number,
  examDate: string,
  now: number,
) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const deadline = /^\d{4}-\d{2}-\d{2}$/.test(examDate) ? new Date(`${examDate}T00:00:00`) : null;
  const daysLeft =
    deadline && Number.isFinite(deadline.getTime())
      ? Math.max(1, Math.ceil((deadline.getTime() - start.getTime()) / 86400000))
      : 7;
  const days = Math.min(7, daysLeft);
  const topics = revisionTopics(attempts).slice(0, Math.min(7, minutesPerDay * days));
  return topics
    .map((topic, index) => {
      const dayIndex = index % days;
      const date = new Date(start);
      date.setDate(start.getDate() + dayIndex);
      const topicsOnDay = topics.filter((_, i) => i % days === dayIndex).length;
      const base = Math.floor(minutesPerDay / topicsOnDay);
      const positionOnDay = Math.floor(index / days);
      return {
        ...topic,
        date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
        minutes: base + (positionOnDay < minutesPerDay % topicsOnDay ? 1 : 0),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}
