import type { EducationContent, EducationSource } from './artifacts';

export type CourseRole = 'owner' | 'teacher' | 'reviewer' | 'student';
export interface ManagedCourse {
  id: number;
  name: string;
  education_level: string;
  role: CourseRole;
}
export interface ManagedLesson {
  id: number;
  course_id: number;
  title: string;
  content: EducationContent;
  sources: EducationSource[];
  status: 'draft' | 'published';
  version: number;
}
export interface Assignment {
  id: number;
  title: string;
  instructions: string;
  due_at: string | null;
  answer_release: string;
  lesson_id: number;
}
export interface Answer {
  text: string;
  option: number | null;
  hint_used: boolean;
}
export interface Result {
  question: number;
  objectiveIndex: number;
  topic: string;
  score: number | null;
  scoring: string;
  hint_used: boolean;
}
export interface Submission {
  id: number;
  name?: string;
  answers: Record<string, Answer>;
  status: string;
  version: number;
  results: Result[];
  feedback: string;
}
export interface AssignedLesson extends Assignment {
  sources?: { id: string; title: string; location: string }[];
  content: EducationContent;
  role: CourseRole;
  lesson_version: number;
  answers_released: boolean;
  submission: Submission | null;
}
export interface ObjectiveResult {
  objective: string;
  lesson_id: number;
  scored: number;
  correct: number;
  pending: number;
  hints: number;
  recommendation: string;
  examples: { submission_id: number; assignment_id: number; question: number; response: Answer }[];
}

export async function classroomApi<T>(
  path: string,
  body?: unknown,
  method = body ? 'POST' : 'GET',
): Promise<T> {
  const response = await fetch(`/api/omitech/learning-studio/${path}`, {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(60000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = typeof data?.detail === 'string' ? data.detail : data?.error;
    throw new Error(
      detail ||
        (response.status === 401
          ? 'Reload Learning Studio to reconnect your session.'
          : `Could not save or load classroom work (${response.status}). Your local draft is kept.`),
    );
  }
  return data as T;
}

export function downloadText(name: string, content: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
