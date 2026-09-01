import type {
  EducationCourse,
  StudentGuardrails,
  StudioMode,
  TeachingRoleId,
} from '@/lib/store/education-studio';

export type EducationWorkflowId =
  | 'lesson-plan'
  | 'syllabus'
  | 'lecture-slides'
  | 'assessment'
  | 'class-activity'
  | 'research-synthesis'
  | 'student-feedback'
  | 'study-support';

export interface AssessmentOptions {
  questionCount: number;
  difficulty: 'introductory' | 'mixed' | 'advanced';
  bloomLevel: 'remember-understand' | 'apply-analyse' | 'evaluate-create' | 'mixed';
  questionTypes: string[];
}

export const TEACHING_ROLE_COPY: Record<
  TeachingRoleId,
  { name: string; description: string; instruction: string }
> = {
  'course-designer': {
    name: 'Course Designer',
    description: 'Structures objectives, sequence, activities, and pacing.',
    instruction: 'structure the experience around measurable objectives and coherent progression',
  },
  'subject-expert': {
    name: 'Subject Expert',
    description: 'Checks accuracy, examples, terminology, and misconceptions.',
    instruction:
      'check disciplinary accuracy and address likely misconceptions with useful examples',
  },
  'assessment-coach': {
    name: 'Assessment Coach',
    description: 'Aligns checks, rubrics, and feedback to the objectives.',
    instruction:
      'align formative and summative checks to the objectives and provide actionable feedback',
  },
  'research-assistant': {
    name: 'Research Assistant',
    description: 'Synthesizes evidence and preserves source attribution.',
    instruction: 'separate evidence from interpretation and preserve clear source attribution',
  },
  'presentation-designer': {
    name: 'Presentation Designer',
    description: 'Creates clear visuals, speaker notes, and audience participation.',
    instruction:
      'design a presentation-ready narrative with visual cues, speaker notes, and participation',
  },
  'student-tutor': {
    name: 'Student Tutor',
    description: 'Explains patiently and adapts practice to the learner.',
    instruction:
      'teach patiently, diagnose understanding, and adapt hints and practice to the learner',
  },
};

export const EDUCATION_WORKFLOWS: Record<
  EducationWorkflowId,
  { title: string; description: string; teacherInstruction: string; studentInstruction: string }
> = {
  'lesson-plan': {
    title: 'Plan a lesson',
    description: 'Objectives, pacing, instruction, practice, and checks.',
    teacherInstruction:
      'Create a complete lesson plan with measurable objectives, prerequisite knowledge, a timed sequence, explicit teaching, active practice, differentiation, a formative check, and an exit ticket.',
    studentInstruction:
      'Create a guided mini-lesson that diagnoses what I know, explains the concept in stages, gives worked examples, and then lets me practise independently.',
  },
  syllabus: {
    title: 'Build a syllabus',
    description: 'Course outcomes, weekly sequence, readings, and assessment.',
    teacherInstruction:
      'Create a course syllabus with outcomes, a week-by-week sequence, readings, activities, assessment plan, grading approach, accessibility considerations, and academic-integrity expectations.',
    studentInstruction:
      'Turn the course expectations into a clear study roadmap with weekly goals, preparation tasks, checkpoints, and revision milestones.',
  },
  'lecture-slides': {
    title: 'Create lecture slides',
    description: 'Slides, speaker notes, examples, and discussion prompts.',
    teacherInstruction:
      'Create a presentation-ready lecture with a strong opening, concise slides, speaker notes, worked examples, visual suggestions, discussion questions, a recap, and a short knowledge check.',
    studentInstruction:
      'Create a concise visual study presentation that explains the topic, shows worked examples, highlights common errors, and ends with retrieval-practice questions.',
  },
  assessment: {
    title: 'Assessment Studio',
    description: 'Quizzes, exams, assignments, answer keys, and rubrics.',
    teacherInstruction:
      'Create a fair assessment aligned to the objectives. Produce a student version, a separate teacher answer key with rationales, a marking rubric, feedback guidance, and an accessibility review.',
    studentInstruction:
      'Create a practice assessment. Ask one question at a time, wait for my attempt, give a hint before the answer, explain the reasoning, and finish with a targeted revision plan.',
  },
  'class-activity': {
    title: 'Design an activity',
    description: 'Individual, collaborative, lab, or discussion-based learning.',
    teacherInstruction:
      'Design an active classroom, seminar, or lab activity with teacher preparation, student instructions, grouping, materials, checkpoints, safety or accessibility notes, reflection, and assessment evidence.',
    studentInstruction:
      'Guide me through an active practice task with clear steps, checkpoints, reflection questions, and feedback after each attempt.',
  },
  'research-synthesis': {
    title: 'Research synthesis',
    description: 'Evidence map, literature themes, gaps, and citations.',
    teacherInstruction:
      'Synthesize the supplied research into key themes, agreements, disagreements, methods, evidence quality, gaps, and teaching implications. Cite the supplied sources clearly and do not invent references.',
    studentInstruction:
      'Help me understand the supplied research by comparing claims, evidence, methods, limitations, and open questions. Require me to distinguish evidence from interpretation.',
  },
  'student-feedback': {
    title: 'Review student work',
    description: 'Rubric-aligned, constructive, and actionable feedback.',
    teacherInstruction:
      'Create a feedback workflow that identifies strengths, rubric-linked improvements, specific next steps, and an encouraging summary. Do not assign a final grade without an explicit teacher-provided rubric.',
    studentInstruction:
      'Coach me to improve my work through questions, rubric-based observations, and specific revision suggestions without rewriting the entire submission for me.',
  },
  'study-support': {
    title: 'Build study support',
    description: 'Study plans, flashcards, practice, and exam preparation.',
    teacherInstruction:
      'Create a differentiated study-support pack with a diagnostic check, concise summaries, flashcards, spaced-practice questions, worked examples, extension tasks, and a revision schedule.',
    studentInstruction:
      'Build an adaptive study session with a short diagnostic, explanation, flashcards, spaced retrieval, mixed practice, hints before answers, and a final plan for weak areas.',
  },
};

function courseContext(course?: EducationCourse): string[] {
  if (!course) return ['Course context: General learning workspace.'];
  return [
    `Course: ${course.name}${course.code ? ` (${course.code})` : ''}.`,
    course.subject ? `Subject: ${course.subject}.` : '',
    `Education level: ${course.level}.`,
    course.term ? `Academic term: ${course.term}.` : '',
    course.institution ? `Institution: ${course.institution}.` : '',
    course.audience ? `Learner audience: ${course.audience}.` : '',
  ].filter(Boolean);
}

function guardrailInstructions(guardrails: StudentGuardrails): string[] {
  const instructions: string[] = [];
  if (guardrails.socraticGuidance)
    instructions.push('Use Socratic questions to diagnose understanding.');
  if (guardrails.hintsBeforeAnswers)
    instructions.push('Give a useful hint before revealing a complete answer.');
  if (guardrails.explainReasoning)
    instructions.push('Explain the reasoning, not only the final result.');
  if (guardrails.sourceCitations)
    instructions.push('Cite the supplied course sources for factual claims.');
  if (guardrails.teacherReview)
    instructions.push('Flag generated feedback or assessment decisions for teacher review.');
  return instructions;
}

export function buildEducationWorkflowPrompt({
  workflowId,
  mode,
  course,
  roleIds,
  guardrails,
  assessment,
}: {
  workflowId: EducationWorkflowId;
  mode: StudioMode;
  course?: EducationCourse;
  roleIds: TeachingRoleId[];
  guardrails: StudentGuardrails;
  assessment?: AssessmentOptions;
}): string {
  const workflow = EDUCATION_WORKFLOWS[workflowId];
  const roleInstructions = roleIds.map((id) => TEACHING_ROLE_COPY[id].instruction);
  const sections = [
    `Create this as an Omitech Learning Studio ${mode === 'teacher' ? 'teacher workflow' : 'student learning session'}.`,
    ...courseContext(course),
    mode === 'teacher' ? workflow.teacherInstruction : workflow.studentInstruction,
  ];

  if (roleInstructions.length > 0) {
    sections.push(`Teaching team: ${roleInstructions.join('; ')}.`);
  }
  if (mode === 'student') sections.push(...guardrailInstructions(guardrails));
  if (workflowId === 'assessment' && assessment) {
    sections.push(
      `Assessment settings: ${assessment.questionCount} questions; ${assessment.difficulty} difficulty; Bloom level ${assessment.bloomLevel}; question types: ${assessment.questionTypes.join(', ') || 'mixed'}.`,
    );
  }
  sections.push(
    'Use only uploaded course materials when they are provided, visibly attribute those materials, and identify any point that needs teacher verification.',
  );
  return sections.join('\n');
}
