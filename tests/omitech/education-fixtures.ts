import type {
  EducationBrief,
  EducationContent,
  EducationArtifact,
} from '@/lib/education/artifacts';
export const brief: EducationBrief = {
  topic: 'Shipping in Tanzania and Africa',
  mode: 'teacher',
  output: 'assessment',
  level: 'undergraduate',
  language: 'English',
  objectives: 'Understand regional trade',
  curriculum: '',
  minutes: 30,
  classSize: 20,
  questionCount: 1,
  examDate: '2026-09-20',
  sources: [{ id: 's1', title: 'Port study', text: 'Ports link land and sea transport.' }],
};
export const content: EducationContent = {
  title: 'Shipping and regional trade',
  objectives: ['Explain the role of ports'],
  sections: [{ heading: 'Preparation', body: 'Read the question carefully.', sourceIds: ['s1'] }],
  questions: [
    {
      prompt: 'Which connection do ports provide?',
      topic: 'Ports',
      options: ['Land and sea', 'Only roads'],
      correctOption: 0,
      answer: 'SECRET_KEY_ANSWER',
      hint: 'Think about transport modes.',
      explanation: 'They connect inland routes to shipping.',
      sourceIds: ['s1'],
    },
  ],
  flashcards: [
    {
      front: 'What is a port?',
      back: 'A connection between land and sea transport.',
      topic: 'Ports',
      sourceIds: ['s1'],
    },
  ],
  rubric: [{ criterion: 'Understanding', guidance: 'Explain both transport modes.' }],
};
export const artifact: EducationArtifact = {
  id: 'resource1',
  courseId: null,
  brief,
  content,
  createdAt: 1,
  updatedAt: 1,
};
