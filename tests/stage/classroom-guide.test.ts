import { describe, expect, it } from 'vitest';
import { classroomGuideStorageKey } from '@/components/stage/classroom-guide-dialog';

describe('classroom guide', () => {
  it('stores first-view state separately for each classroom', () => {
    expect(classroomGuideStorageKey('biology-101')).toBe(
      'openmaic:classroom-guide-seen:biology-101',
    );
    expect(classroomGuideStorageKey('chemistry-101')).not.toBe(
      classroomGuideStorageKey('biology-101'),
    );
  });
});
