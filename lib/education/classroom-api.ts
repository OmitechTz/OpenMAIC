import type { EducationContent, EducationSource } from './artifacts';

export type CourseRole = 'owner' | 'teacher' | 'reviewer' | 'student';
export interface ManagedCourse {
  id: number;
  name: string;
  code: string | null;
  subject: string | null;
  education_level: string;
  term: string | null;
  version: number;
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

export type SemesterMaterial =
  | 'lecturer-notes'
  | 'student-notes'
  | 'presentation'
  | 'software-lab'
  | 'exercise'
  | 'quiz'
  | 'assignment'
  | 'answer-key'
  | 'diagram';
export interface SemesterWeek {
  id: string;
  week: number;
  title: string;
  topic: string;
  outcomes: string[];
  materials: SemesterMaterial[];
  status: 'planned' | 'draft' | 'review' | 'published';
  software: string[];
  lab_steps: string[];
  expected_output: string;
  troubleshooting: string[];
  source_ids: string[];
}
export interface SemesterSource {
  id: string;
  title: string;
  author: string;
  year: string;
  url: string;
  reference: string;
  text: string;
  location: string;
}
export interface SemesterWorkspace {
  version: number;
  academic_year: string;
  semester: string;
  start_date: string;
  end_date: string;
  improvement_notes: string;
  weeks: SemesterWeek[];
  sources: SemesterSource[];
  presentation: {
    slide_count: number;
    duration_minutes: number;
    aspect_ratio: 'wide' | 'standard';
    theme: 'institution-navy' | 'omitech-light' | 'plain';
    lecturer_name: string;
    logo_url: string;
    include_speaker_notes: boolean;
    include_discussion: boolean;
    include_worked_examples: boolean;
    include_software_demo: boolean;
    lecturer_answers_only: boolean;
    enforce_master_template: boolean;
    primary_colour: string;
    accent_colour: string;
    heading_font: string;
    body_font: string;
    footer_text: string;
  };
  syllabus_text: string;
  student_edition: boolean;
  lecturer_edition: boolean;
  accessible_edition: boolean;
  notification_days_before: number;
  retention_months: number;
  storage_quota_mb: number;
}

export interface Gradebook {
  items: {
    id: number;
    title: string;
    category: string;
    maximum_score: number;
    weight_percent: number;
    published: boolean;
    due_at: string | null;
  }[];
  grades: {
    id: number;
    grade_item_id: number;
    user_id: number;
    name: string;
    score: number | null;
    feedback: string;
  }[];
  weight_total: number;
}

export interface MaterialMatrix {
  complete: number;
  rows: {
    week: number;
    title: string;
    status: string;
    planned: string[];
    source_count: number;
    source_excerpt_count: number;
    lesson_ready: boolean;
    assignment_ready: boolean;
    missing: string[];
  }[];
}
export interface Announcement {
  id: number;
  kind: 'announcement' | 'class' | 'deadline' | 'exam';
  title: string;
  body: string;
  starts_at: string | null;
  due_at: string | null;
  status: 'draft' | 'published';
  created_at: string;
}
export interface SubmissionAsset {
  id: number;
  assignment_id: number;
  user_id: number;
  filename: string;
  mime_type: string;
  size_bytes: number;
  external_url: string | null;
  asset_type: 'file' | 'link';
  download_url: string | null;
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

export async function classroomUpload<T>(path: string, file: File): Promise<T> {
  const form = new FormData();
  form.set('file', file);
  const response = await fetch(`/api/omitech/learning-studio/${path}`, {
    method: 'POST',
    credentials: 'same-origin',
    body: form,
    signal: AbortSignal.timeout(60000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.detail || data?.error || 'File upload failed.');
  return data as T;
}

export async function downloadClassroomFile(path: string, fallbackName: string) {
  const response = await fetch(`/api/omitech/learning-studio/${path}`, {
    credentials: 'same-origin',
    cache: 'no-store',
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.detail || data?.error || 'Download failed.');
  }
  const disposition = response.headers.get('content-disposition') || '';
  const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] || fallbackName;
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(name: string, content: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
