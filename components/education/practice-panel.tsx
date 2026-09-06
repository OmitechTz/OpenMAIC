'use client';
import { useEffect, useState } from 'react';
import type { EducationArtifact } from '@/lib/education/artifacts';
import { revisionTopics, revisionPlan, type ReviewGrade } from '@/lib/education/practice';
import { useLearningResourcesStore } from '@/lib/store/learning-resources';
import { Button } from '@/components/ui/button';

function CardReview({ artifact, index }: { artifact: EducationArtifact; index: number }) {
  const [revealed, setRevealed] = useState(false);
  const review = useLearningResourcesStore((s) => s.reviewCard);
  const card = artifact.content.flashcards[index];
  return (
    <section className="rounded-xl border p-4 space-y-3" aria-label="Flashcard practice">
      <p className="text-xs text-muted-foreground">
        {card.topic} · Think of your answer before revealing it.
      </p>
      <p className="font-medium whitespace-pre-wrap">{card.front}</p>
      {!revealed ? (
        <Button onClick={() => setRevealed(true)}>Reveal answer</Button>
      ) : (
        <>
          <p className="whitespace-pre-wrap">{card.back}</p>
          <div className="flex flex-wrap gap-2">
            {(['again', 'hard', 'good', 'easy'] as ReviewGrade[]).map((grade) => (
              <Button
                key={grade}
                variant="outline"
                onClick={() => review(artifact.id, index, grade)}
              >
                {{ again: 'Again · 10 minutes', hard: 'Hard', good: 'Good', easy: 'Easy' }[grade]}
              </Button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function QuizPractice({ artifact }: { artifact: EducationArtifact }) {
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [graded, setGraded] = useState(false);
  const [score, setScore] = useState(0);
  const record = useLearningResourcesStore((s) => s.recordAttempt);
  const question = artifact.content.questions[index];
  if (!question)
    return (
      <div className="rounded-xl border p-4" role="status">
        Practice complete: {score} of {artifact.content.questions.length} correct or self-checked
        correct. Review the revision priorities below, then try another session.
        <Button
          className="ml-3"
          variant="outline"
          onClick={() => {
            setIndex(0);
            setAnswer('');
            setSubmitted(false);
            setGraded(false);
            setScore(0);
          }}
        >
          Practise again
        </Button>
      </div>
    );
  const grade = (correct: boolean, scoring: 'automatic' | 'self') => {
    if (graded) return;
    record({
      artifactId: artifact.id,
      itemId: `question:${index}`,
      topic: question.topic,
      correct,
      scoring,
      kind: 'quiz',
    });
    setGraded(true);
    if (correct) setScore((value) => value + 1);
  };
  return (
    <section className="space-y-3 rounded-xl border p-4" aria-label="Quiz practice">
      <p className="text-xs text-muted-foreground">
        Question {index + 1} of {artifact.content.questions.length} · {question.topic}
      </p>
      <p className="font-medium whitespace-pre-wrap">{question.prompt}</p>
      {question.options.length ? (
        <fieldset disabled={submitted} className="space-y-2">
          <legend className="sr-only">Choose your answer</legend>
          {question.options.map((option, i) => (
            <label className="block text-sm" key={i}>
              <input
                type="radio"
                name={`answer-${artifact.id}-${index}`}
                value={i}
                checked={answer === String(i)}
                onChange={(event) => setAnswer(event.target.value)}
              />{' '}
              {option}
            </label>
          ))}
        </fieldset>
      ) : (
        <label className="block text-sm">
          Your attempt
          <textarea
            className="mt-1 w-full rounded border p-2"
            value={answer}
            disabled={submitted}
            onChange={(event) => setAnswer(event.target.value)}
          />
        </label>
      )}
      {!submitted && (
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowHint(true)}>
            Show a hint
          </Button>
          <Button
            disabled={!answer.trim()}
            onClick={() => {
              setSubmitted(true);
              if (question.options.length)
                grade(Number(answer) === question.correctOption, 'automatic');
            }}
          >
            Check my attempt
          </Button>
        </div>
      )}
      {showHint && (
        <p className="text-sm">
          Hint: {question.hint || 'Explain the key concept first, then apply it to the question.'}
        </p>
      )}
      {submitted && (
        <div className="space-y-2 rounded-lg bg-muted p-3">
          {question.options.length > 0 && (
            <p className="font-semibold">
              {Number(answer) === question.correctOption ? 'Correct' : 'Review this concept'}
            </p>
          )}
          <p className="whitespace-pre-wrap">
            {question.options.length && question.correctOption !== null
              ? question.options[question.correctOption]
              : question.answer}
          </p>
          <p className="whitespace-pre-wrap text-sm">{question.explanation}</p>
          {!question.options.length && !graded && (
            <div className="flex flex-wrap gap-2">
              <span className="text-xs">Compare your answer. This is self-assessment:</span>
              <Button variant="outline" onClick={() => grade(true, 'self')}>
                I understood it
              </Button>
              <Button variant="outline" onClick={() => grade(false, 'self')}>
                I need more practice
              </Button>
            </div>
          )}
          <Button
            disabled={!graded}
            onClick={() => {
              setIndex((i) => i + 1);
              setAnswer('');
              setSubmitted(false);
              setGraded(false);
              setShowHint(false);
            }}
          >
            Next question
          </Button>
        </div>
      )}
    </section>
  );
}

export function PracticePanel({ artifact }: { artifact: EducationArtifact }) {
  const reviews = useLearningResourcesStore((s) => s.reviews);
  const attempts = useLearningResourcesStore((s) => s.attempts);
  const clearPractice = useLearningResourcesStore((s) => s.clearPractice);
  const [now, setNow] = useState(Date.now);
  const [resetVersion, setResetVersion] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const due = artifact.content.flashcards
    .map((_, index) => index)
    .filter((i) => !reviews[`${artifact.id}:${i}`] || reviews[`${artifact.id}:${i}`].dueAt <= now);
  const personal = attempts.filter((a) => a.artifactId === artifact.id);
  const topics = revisionTopics(personal);
  const plan = revisionPlan(personal, artifact.brief.minutes, artifact.brief.examDate, now);
  const scheduled = artifact.content.flashcards
    .map((_, i) => reviews[`${artifact.id}:${i}`]?.dueAt)
    .filter((at): at is number => !!at && at > now);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <span>
          {due.length} cards due · {personal.length} recorded attempts
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            if (
              window.confirm(
                'Clear your practice history and flashcard schedule for this resource?',
              )
            ) {
              clearPractice(artifact.id);
              setResetVersion((v) => v + 1);
            }
          }}
        >
          Reset practice
        </Button>
      </div>
      {due.length ? (
        <CardReview
          key={`${artifact.id}:${due[0]}:${resetVersion}`}
          artifact={artifact}
          index={due[0]}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          {scheduled.length
            ? `Next card review: ${new Date(Math.min(...scheduled)).toLocaleString()}`
            : 'Generate a study pack to add flashcards.'}
        </p>
      )}
      {artifact.content.questions.length > 0 && (
        <QuizPractice key={`${artifact.id}:${resetVersion}`} artifact={artifact} />
      )}
      <section className="rounded-xl border p-4 space-y-2">
        <h4 className="font-semibold">Your revision priorities</h4>
        <p className="text-xs text-muted-foreground">
          Based on recent attempts and your own ratings, not a verified grade.
        </p>
        {!topics.length ? (
          <p className="text-sm">Complete a few questions or cards to build a revision plan.</p>
        ) : (
          <ol className="list-decimal pl-5 space-y-2 text-sm">
            {plan.map((topic) => (
              <li key={topic.topic}>
                <strong>{topic.topic}</strong> — {topic.missed}/{topic.attempts} recent attempts
                need review. {topic.date}: spend {topic.minutes} minutes reviewing the explanation,
                answering practice questions and recalling the cards.
              </li>
            ))}
          </ol>
        )}
        {artifact.brief.examDate && (
          <p className="text-sm">
            Exam target: {artifact.brief.examDate}. Schedule these sessions before your exam; repeat
            the topics with the most missed attempts.
          </p>
        )}
      </section>
    </div>
  );
}

export function LearningProgress({ courseId }: { courseId: string | null }) {
  const artifacts = useLearningResourcesStore((s) => s.artifacts);
  const attempts = useLearningResourcesStore((s) => s.attempts);
  const reviews = useLearningResourcesStore((s) => s.reviews);
  const resources = artifacts.filter((a) => !courseId || a.courseId === courseId);
  const ids = new Set(resources.map((a) => a.id));
  const personal = attempts.filter((a) => ids.has(a.artifactId));
  const due = resources.reduce(
    (count, a) =>
      count +
      a.content.flashcards.filter(
        (_, i) => !reviews[`${a.id}:${i}`] || reviews[`${a.id}:${i}`].dueAt <= Date.now(),
      ).length,
    0,
  );
  return (
    <section className="mb-6 rounded-xl border p-4 space-y-3" aria-label="My learning progress">
      <h3 className="font-semibold">My learning progress</h3>
      <p>
        {resources.length} saved resources · {personal.length} attempts · {due} cards due
      </p>
      <p className="text-xs text-muted-foreground">
        Private practice history. Flashcard ratings and open-ended answers are self-assessed. Open
        Saved resources to practise.
      </p>
      <ul className="list-disc pl-5 text-sm">
        {revisionTopics(personal)
          .slice(0, 5)
          .map((topic) => (
            <li key={topic.topic}>
              {topic.topic}: {topic.missed} of {topic.attempts} recent attempts need review.
            </li>
          ))}
      </ul>
    </section>
  );
}
