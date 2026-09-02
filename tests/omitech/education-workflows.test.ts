import { describe, expect, it } from 'vitest';

import { buildEducationWorkflowPrompt, EDUCATION_WORKFLOWS } from '@/lib/education/workflows';

const course = {
  id: 'course-1',
  name: 'Introduction to Economics',
  code: 'ECO 101',
  subject: 'Economics',
  level: 'undergraduate' as const,
  term: 'Semester 1',
  institution: 'Omitech University',
  audience: 'First-year students',
  createdAt: 1,
  updatedAt: 1,
};

const guardrails = {
  socraticGuidance: true,
  hintsBeforeAnswers: true,
  explainReasoning: true,
  sourceCitations: true,
  teacherReview: true,
};

describe('Omitech education workflows', () => {
  it('builds a course-aware teacher assessment brief', () => {
    const prompt = buildEducationWorkflowPrompt({
      workflowId: 'assessment',
      mode: 'teacher',
      course,
      roleIds: ['course-designer', 'assessment-coach'],
      guardrails,
      assessment: {
        questionCount: 12,
        difficulty: 'mixed',
        bloomLevel: 'apply-analyse',
        questionTypes: ['multiple choice', 'short answer'],
      },
    });

    expect(prompt).toContain('Introduction to Economics (ECO 101)');
    expect(prompt).toContain('student version');
    expect(prompt).toContain('teacher answer key');
    expect(prompt).toContain('12 questions');
    expect(prompt).toContain('apply-analyse');
    expect(prompt).toContain('align formative and summative checks');
  });

  it('enforces guided-learning safeguards in student mode', () => {
    const prompt = buildEducationWorkflowPrompt({
      workflowId: 'study-support',
      mode: 'student',
      course,
      roleIds: ['student-tutor'],
      guardrails,
    });

    expect(prompt).toContain('Socratic questions');
    expect(prompt).toContain('hint before revealing a complete answer');
    expect(prompt).toContain('Explain the reasoning');
    expect(prompt).toContain('Cite the supplied course sources');
    expect(prompt).toContain('teacher review');
  });

  it('ships the complete teacher workflow set', () => {
    expect(Object.keys(EDUCATION_WORKFLOWS)).toEqual([
      'lesson-plan',
      'syllabus',
      'lecture-slides',
      'assessment',
      'class-activity',
      'research-synthesis',
      'student-feedback',
      'study-support',
    ]);
  });
});
