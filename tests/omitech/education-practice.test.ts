import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  revisionPlan,
  revisionTopics,
  scheduleReview,
  type PracticeAttempt,
} from '@/lib/education/practice';
import { brief, content } from './education-fixtures';
const memory = vi.hoisted(() => new Map<string, string>());
vi.mock('@/lib/store/kv-persist', () => ({
  createKVPersistStorage: () => ({
    getItem: (key: string) => (memory.has(key) ? JSON.parse(memory.get(key)!) : null),
    setItem: (key: string, value: unknown) => {
      memory.set(key, JSON.stringify(value));
    },
    removeItem: (key: string) => {
      memory.delete(key);
    },
  }),
}));

describe('saved practice and revision', () => {
  beforeEach(() => {
    vi.resetModules();
    memory.clear();
  });
  it('schedules missed cards soon, extends successful intervals, and tracks lapses', () => {
    const missed = scheduleReview(undefined, 'again', 1000);
    expect(missed.dueAt).toBe(601000);
    expect(missed.lapses).toBe(1);
    const good = scheduleReview(missed, 'good', 2000);
    expect(good.intervalDays).toBe(1);
    expect(scheduleReview(good, 'easy', 3000).intervalDays).toBe(4);
  });
  it('prioritizes weak topics and fits revision into the daily budget', () => {
    const attempts: PracticeAttempt[] = Array.from({ length: 7 }, (_, i) => ({
      id: String(i),
      artifactId: 'a',
      itemId: String(i),
      topic: `Topic ${i}`,
      correct: i > 2,
      kind: 'quiz',
      scoring: 'automatic',
      at: i,
    }));
    expect(revisionTopics(attempts)[0].missed).toBe(1);
    const now = new Date('2026-09-06T10:00:00').getTime();
    const plan = revisionPlan(attempts, 30, '2026-09-08', now);
    for (const date of new Set(plan.map((p) => p.date)))
      expect(plan.filter((p) => p.date === date).reduce((sum, p) => sum + p.minutes, 0)).toBe(30);
    expect(plan.every((p) => p.date < '2026-09-08')).toBe(true);
    expect(revisionPlan(attempts, 5, '2026-09-07', now).every((p) => p.minutes > 0)).toBe(true);
  });
  it('rehydrates resources, drafts, attempts and due dates and prevents double-click reviews', async () => {
    const { useLearningResourcesStore: store } = await import('@/lib/store/learning-resources');
    await store.persist.rehydrate();
    store.getState().setDraft({ topic: 'Saved prompt' });
    store.getState().setComposer({ target: 'study-pack', instruction: 'Saved workflow' });
    const id = store.getState().save(brief, content, 'course');
    store.getState().reviewCard(id, 0, 'good');
    store.getState().reviewCard(id, 0, 'good');
    expect(store.getState().attempts).toHaveLength(1);
    await store.persist.rehydrate();
    expect(store.getState().draft.topic).toBe('Saved prompt');
    expect(store.getState().composer.instruction).toBe('Saved workflow');
    expect(store.getState().artifacts[0].id).toBe(id);
    expect(store.getState().reviews[`${id}:0`].intervalDays).toBe(1);
    store.getState().updateContent(id, {
      ...content,
      flashcards: [{ ...content.flashcards[0], back: 'New answer' }],
    });
    expect(store.getState().attempts).toHaveLength(0);
    expect(store.getState().reviews).toEqual({});
    store.getState().remove(id);
    expect(store.getState().artifacts).toHaveLength(0);
  });
  it('keeps personal resources and practice separate when the signed-in learner changes', async () => {
    const { useLearningResourcesStore: store, activateLearningResources } =
      await import('@/lib/store/learning-resources');
    await activateLearningResources(`omitech:${'a'.repeat(64)}`);
    const id = store.getState().save(brief, content, null);
    store.getState().reviewCard(id, 0, 'good');
    await activateLearningResources('learner-b');
    expect(store.getState().artifacts).toEqual([]);
    expect(store.getState().attempts).toEqual([]);
    await activateLearningResources(`omitech:${'a'.repeat(64)}`);
    expect(store.getState().artifacts[0].id).toBe(id);
    expect(store.getState().attempts).toHaveLength(1);
  });
});
