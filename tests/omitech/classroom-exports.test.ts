import { describe, expect, it } from 'vitest';
import { content, brief } from './education-fixtures';
import { moodleQuestionBank } from '@/lib/education/moodle-export';
import { offlineAssignmentHtml } from '@/lib/education/offline-assignment';
import { educationPrompt, parseEducationContent } from '@/lib/education/artifacts';
import type { AssignedLesson } from '@/lib/education/classroom-api';
import { TEACHING_TEMPLATES, teachingTemplateBrief } from '@/lib/education/teaching-templates';
import { briefSchema } from '@/lib/education/artifacts';

describe('teaching subject templates', () => {
  it('contains the four configured semester subjects', () => {
    expect(TEACHING_TEMPLATES.map(({ code, title }) => ({ code, title }))).toEqual([
      { code: 'MEU 07571', title: 'Artificial Intelligence' },
      { code: 'MEU 07569', title: 'Industrial Automation' },
      { code: 'MEU 08130', title: 'Engineering Maintenance' },
      { code: 'OGU 07538', title: 'Fluid Mechanics' },
    ]);
  });

  it.each(TEACHING_TEMPLATES)(
    'prepares valid lesson and syllabus briefs for $title',
    (template) => {
      for (const output of ['lesson-pack', 'syllabus'] as const) {
        const draft = briefSchema.parse(teachingTemplateBrief(template, output));
        expect(draft.output).toBe(output);
        expect(draft.mode).toBe('teacher');
        expect(draft.bilingual).toBe(true);
        expect(draft.objectives).toContain(template.activity);
        expect(draft.sources).toEqual([]);
      }
    },
  );

  it.each(TEACHING_TEMPLATES)('provides a full PowerPoint instruction for $title', (template) => {
    expect(template.presentationInstruction).toContain('complete semester lecture deck');
    expect(template.presentationInstruction).toContain('speaker notes');
    expect(template.software.length).toBeGreaterThan(0);
  });
});

describe('classroom export boundaries', () => {
  it('creates Moodle questions with one correct answer and escaped content', () => {
    const copy = structuredClone(content);
    copy.questions[0].prompt = 'A < B & C?';
    copy.questions.push({
      ...copy.questions[0],
      options: [],
      correctOption: null,
      answer: 'Teacher marking guidance',
    });
    const xml = moodleQuestionBank(copy);
    expect(xml).toContain('A &lt; B &amp; C?');
    expect(xml.match(/fraction="100"/g)).toHaveLength(1);
    expect(xml).toContain('type="essay"');
    expect(xml).toContain('Teacher marking guidance');
  });
  it('keeps answers and scripts out of the offline student handout', () => {
    const copy = structuredClone(content);
    copy.sections[0].body = '</script><script>alert("unsafe")</script>';
    const lesson = {
      id: 42,
      title: 'Offline <lesson>',
      instructions: 'Read & answer',
      lesson_version: 2,
      content: copy,
    } as AssignedLesson;
    const html = offlineAssignmentHtml(lesson);
    expect(html).not.toContain('SECRET_KEY_ANSWER');
    expect(html).not.toContain('alert("unsafe")</script>');
    expect(html).toContain('&lt;/script&gt;');
    expect(html).toContain('assignment_id');
    expect(html).not.toContain('fetch(');
  });
  it('requires a complete lesson pack and valid objective mappings', () => {
    expect(() =>
      parseEducationContent(JSON.stringify(content), { ...brief, output: 'lesson-pack' }),
    ).toThrow('Lesson pack');
    const complete = {
      ...content,
      flashcards: Array.from({ length: 8 }, () => content.flashcards[0]),
    };
    expect(
      parseEducationContent(JSON.stringify(complete), { ...brief, output: 'lesson-pack' })
        .flashcards,
    ).toHaveLength(8);
    expect(() =>
      parseEducationContent(
        JSON.stringify({ ...content, questions: [{ ...content.questions[0], objectiveIndex: 5 }] }),
        brief,
      ),
    ).toThrow('objective');
  });
  it('applies student guidance and differentiation to document generation', () => {
    const prompt = educationPrompt({
      ...brief,
      mode: 'student',
      bilingual: true,
      differentiation: 'supported',
    });
    expect(prompt).toContain('English/Kiswahili');
    expect(prompt).toContain('guided questions');
    expect(prompt).toContain('supported');
  });
});
