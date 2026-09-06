import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import { createKVPersistStorage } from './kv-persist';
import type {
  EducationArtifact,
  EducationBrief,
  EducationContent,
  EducationOutput,
} from '@/lib/education/artifacts';
import type { EducationWorkflowId } from '@/lib/education/workflows';
import {
  scheduleReview,
  type ReviewGrade,
  type ReviewState,
  type PracticeAttempt,
} from '@/lib/education/practice';

export const DEFAULT_BRIEF: EducationBrief = {
  topic: '',
  mode: 'student',
  output: 'study-notes',
  level: 'undergraduate',
  language: 'English',
  objectives: '',
  curriculum: '',
  minutes: 30,
  classSize: 1,
  examDate: '',
  questionCount: 8,
  sources: [],
};
interface LearningResourcesState {
  draft: EducationBrief;
  composer: {
    mode: 'teacher' | 'student';
    target: EducationOutput | 'classroom';
    workflow: EducationWorkflowId;
    instruction: string;
  };
  setComposer: (changes: Partial<LearningResourcesState['composer']>) => void;
  artifacts: EducationArtifact[];
  reviews: Record<string, ReviewState>;
  attempts: PracticeAttempt[];
  setDraft: (changes: Partial<EducationBrief>) => void;
  save: (brief: EducationBrief, content: EducationContent, courseId: string | null) => string;
  updateContent: (id: string, content: EducationContent) => void;
  remove: (id: string) => void;
  recordAttempt: (attempt: Omit<PracticeAttempt, 'id' | 'at'>) => void;
  reviewCard: (artifactId: string, index: number, grade: ReviewGrade) => void;
  clearPractice: (artifactId: string) => void;
}
const recovery: { rehydrate?: () => void | Promise<void> } = {};
export const useLearningResourcesStore = create<LearningResourcesState>()(
  persist(
    (set, get) => ({
      draft: DEFAULT_BRIEF,
      composer: {
        mode: 'student',
        target: 'study-notes',
        workflow: 'study-support',
        instruction: '',
      },
      setComposer: (changes) => set((state) => ({ composer: { ...state.composer, ...changes } })),
      artifacts: [],
      reviews: {},
      attempts: [],
      setDraft: (changes) => set((state) => ({ draft: { ...state.draft, ...changes } })),
      save: (brief, content, courseId) => {
        const id = nanoid();
        const now = Date.now();
        set((state) => ({
          artifacts: [
            {
              id,
              brief: structuredClone(brief),
              content: structuredClone(content),
              courseId,
              createdAt: now,
              updatedAt: now,
            },
            ...state.artifacts,
          ],
        }));
        return id;
      },
      updateContent: (id, content) => {
        const previous = get().artifacts.find((a) => a.id === id)?.content;
        if (
          JSON.stringify(previous?.questions) !== JSON.stringify(content.questions) ||
          JSON.stringify(previous?.flashcards) !== JSON.stringify(content.flashcards)
        )
          get().clearPractice(id);
        set((state) => ({
          artifacts: state.artifacts.map((item) =>
            item.id === id ? { ...item, content, updatedAt: Date.now() } : item,
          ),
        }));
      },
      remove: (id) => {
        get().clearPractice(id);
        set((state) => ({ artifacts: state.artifacts.filter((a) => a.id !== id) }));
      },
      recordAttempt: (attempt) => {
        if (!get().artifacts.some((a) => a.id === attempt.artifactId)) return;
        set((state) => ({
          attempts: [{ ...attempt, id: nanoid(), at: Date.now() }, ...state.attempts].slice(
            0,
            10000,
          ),
        }));
      },
      reviewCard: (artifactId, index, grade) => {
        const card = get().artifacts.find((a) => a.id === artifactId)?.content.flashcards[index];
        if (!card) return;
        const key = `${artifactId}:${index}`;
        const now = Date.now();
        // A double-click cannot advance the same card twice.
        if (get().reviews[key]?.dueAt > now) return;
        set((state) => ({
          reviews: { ...state.reviews, [key]: scheduleReview(state.reviews[key], grade, now) },
        }));
        get().recordAttempt({
          artifactId,
          itemId: key,
          topic: card.topic,
          kind: 'flashcard',
          scoring: 'self',
          correct: grade !== 'again',
        });
      },
      clearPractice: (id) =>
        set((state) => ({
          attempts: state.attempts.filter((a) => a.artifactId !== id),
          reviews: Object.fromEntries(
            Object.entries(state.reviews).filter(([key]) => !key.startsWith(`${id}:`)),
          ),
        })),
    }),
    {
      name: 'omitech-learning-resources',
      version: 1,
      skipHydration: true,
      merge: (persisted, current) => ({
        ...current,
        draft: DEFAULT_BRIEF,
        composer: {
          mode: 'student',
          target: 'study-notes',
          workflow: 'study-support',
          instruction: '',
        },
        artifacts: [],
        reviews: {},
        attempts: [],
        ...(persisted as Partial<LearningResourcesState>),
      }),
      storage: createKVPersistStorage<LearningResourcesState>('account', {
        onWriteRefused: () => recovery.rehydrate?.(),
      }),
    },
  ),
);
recovery.rehydrate = () => useLearningResourcesStore.persist.rehydrate();

/** Called by the session bridge before exposing personal learning data. */
export async function activateLearningResources(learnerKey: string) {
  if (!/^[a-zA-Z0-9_:-]{1,100}$/.test(learnerKey)) throw new Error('Invalid learner identity');
  useLearningResourcesStore.persist.setOptions({
    name: `omitech-learning-resources:${learnerKey}`,
  });
  await useLearningResourcesStore.persist.rehydrate();
  if (!useLearningResourcesStore.persist.hasHydrated())
    throw new Error('Learning resources could not be restored');
}
