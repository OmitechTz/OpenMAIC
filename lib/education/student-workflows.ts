import type { EducationWorkflowId } from './workflows';
import type { EducationOutput } from './artifacts';

export const STUDENT_WORKFLOWS: {
  id: string;
  title: string;
  description: string;
  workflowId: EducationWorkflowId;
  output: EducationOutput | 'classroom';
  instruction: string;
}[] = [
  {
    id: 'teach',
    title: 'Teach me a topic',
    description: 'A guided lesson with examples and understanding checks.',
    workflowId: 'lesson-plan',
    output: 'classroom',
    instruction: 'Diagnose what I know and teach progressively, checking understanding.',
  },
  {
    id: 'notes',
    title: 'Explain my notes',
    description: 'Turn your material into clear explanations and worked examples.',
    workflowId: 'study-support',
    output: 'study-notes',
    instruction: 'Explain my supplied notes, define terminology and show worked examples.',
  },
  {
    id: 'exam',
    title: 'Prepare for an exam',
    description: 'A study pack, practice questions and a revision plan.',
    workflowId: 'study-support',
    output: 'study-pack',
    instruction: 'Prepare me for my exam, prioritizing prerequisites and practice.',
  },
  {
    id: 'quiz',
    title: 'Quiz me',
    description: 'Attempt questions, reveal hints and learn from feedback.',
    workflowId: 'assessment',
    output: 'study-pack',
    instruction: 'Create diagnostic practice questions with helpful hints and explanations.',
  },
  {
    id: 'cards',
    title: 'Create flashcards',
    description: 'Recall key ideas and schedule your next review.',
    workflowId: 'study-support',
    output: 'study-pack',
    instruction: 'Create atomic flashcards testing understanding rather than rote wording.',
  },
  {
    id: 'problem',
    title: 'Help me solve a problem',
    description: 'Guidance, checkpoints and feedback on your attempt.',
    workflowId: 'class-activity',
    output: 'classroom',
    instruction: 'Ask for my attempted solution and guide me with hints before revealing answers.',
  },
  {
    id: 'paper',
    title: 'Help me understand a paper',
    description: 'Compare research questions, methods, findings and limitations.',
    workflowId: 'research-synthesis',
    output: 'research-synthesis',
    instruction:
      'Explain the supplied research in accessible language and distinguish evidence from interpretation.',
  },
  {
    id: 'assignment',
    title: 'Review my assignment',
    description: 'Feedback and a revision checklist based on your draft.',
    workflowId: 'student-feedback',
    output: 'feedback',
    instruction: 'Coach improvements to my supplied draft; do not rewrite it or invent a grade.',
  },
  {
    id: 'presentation',
    title: 'Practise a presentation',
    description: 'Rehearse your explanation and respond to audience questions.',
    workflowId: 'lecture-slides',
    output: 'classroom',
    instruction:
      'Help me rehearse, ask audience questions and give specific feedback on my explanation.',
  },
  {
    id: 'plan',
    title: 'Build my study plan',
    description: 'Organize goals and practice around your available time.',
    workflowId: 'syllabus',
    output: 'study-pack',
    instruction:
      'Build a realistic study schedule using my exam date and available minutes per day.',
  },
];

export const TEACHER_OUTPUTS: Record<EducationWorkflowId, EducationOutput | 'classroom'> = {
  'lesson-plan': 'lesson-plan',
  syllabus: 'syllabus',
  'lecture-slides': 'classroom',
  assessment: 'assessment',
  'class-activity': 'activity',
  'research-synthesis': 'research-synthesis',
  'student-feedback': 'feedback',
  'study-support': 'study-pack',
};
