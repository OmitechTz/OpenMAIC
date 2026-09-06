import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { briefSchema, parseEducationContent, educationPrompt } from '@/lib/education/artifacts';
import { resourceMarkdown, resourceHtml, resourceDocx } from '@/lib/education/export';
import { STUDENT_WORKFLOWS } from '@/lib/education/student-workflows';
import { makeResearchHandoff } from '@/lib/education/research-handoff';
import { artifact, brief, content } from './education-fixtures';

describe('structured educational resources', () => {
  it('supports ten genuinely student-labelled workflows', () => {
    expect(STUDENT_WORKFLOWS).toHaveLength(10);
    expect(new Set(STUDENT_WORKFLOWS.map((w) => w.id)).size).toBe(10);
    expect(STUDENT_WORKFLOWS.map((w) => w.title)).toContain('Explain my notes');
    expect(STUDENT_WORKFLOWS.map((w) => w.title)).not.toContain('Review student work');
  });
  it('validates structured content with exact known source IDs', () => {
    expect(parseEducationContent('```json\n' + JSON.stringify(content) + '\n```', brief)).toEqual(
      content,
    );
    expect(() =>
      parseEducationContent(
        JSON.stringify({
          ...content,
          sections: [{ ...content.sections[0], sourceIds: ['invented'] }],
        }),
        brief,
      ),
    ).toThrow();
    expect(() =>
      parseEducationContent(
        JSON.stringify({ ...content, sections: [{ ...content.sections[0], sourceIds: [] }] }),
        brief,
      ),
    ).toThrow();
  });
  it('rejects empty output, missing questions/rubric and invalid answer indices', () => {
    expect(() => parseEducationContent('{}', brief)).toThrow();
    expect(() =>
      parseEducationContent(JSON.stringify({ ...content, questions: [] }), brief),
    ).toThrow();
    expect(() =>
      parseEducationContent(JSON.stringify({ ...content, rubric: [] }), brief),
    ).toThrow();
    expect(() =>
      parseEducationContent(
        JSON.stringify({ ...content, questions: [{ ...content.questions[0], correctOption: 9 }] }),
        brief,
      ),
    ).toThrow();
  });
  it('requires evidence for research synthesis and limits source payloads', () => {
    expect(
      briefSchema.safeParse({ ...brief, output: 'research-synthesis', sources: [] }).success,
    ).toBe(false);
    expect(
      briefSchema.safeParse({
        ...brief,
        sources: Array.from({ length: 4 }, (_, i) => ({
          id: String(i),
          title: 'Source',
          text: 'x'.repeat(20000),
        })),
      }).success,
    ).toBe(false);
    expect(
      briefSchema.safeParse({ ...brief, sources: [brief.sources[0], brief.sources[0]] }).success,
    ).toBe(false);
    expect(educationPrompt(brief)).toContain('untrusted reference material');
  });
  it('keeps answers, explanations and rubric out of the student handout', async () => {
    for (const result of [
      resourceMarkdown(artifact, 'student'),
      resourceHtml(artifact, 'student'),
    ]) {
      expect(result).toContain(content.questions[0].prompt);
      expect(result).not.toContain('SECRET_KEY_ANSWER');
      expect(result).not.toContain(content.questions[0].explanation);
      expect(result).not.toContain(content.rubric[0].guidance);
    }
    const blob = await resourceDocx(artifact, 'student');
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const xml = await zip.file('word/document.xml')!.async('string');
    expect(xml).toContain('Shipping and regional trade');
    expect(xml).not.toContain('SECRET_KEY_ANSWER');
    expect(xml).not.toContain(content.questions[0].explanation);
    expect(resourceMarkdown(artifact, 'answer-key')).toContain(content.questions[0].explanation);
  });
  it('escapes malicious source/model text in printable and offline HTML', () => {
    const malicious = { ...artifact, content: { ...content, title: '<script>alert(1)</script>' } };
    expect(resourceHtml(malicious, 'student')).not.toContain('<script>');
    expect(resourceHtml(malicious, 'student')).toContain('&lt;script&gt;');
  });
  it('builds a handoff from only the selected text and rejects oversized excerpts', () => {
    expect(makeResearchHandoff(brief.topic, [])).toEqual({ topic: brief.topic, focus: '' });
    expect(
      makeResearchHandoff(brief.topic, [{ title: 'Chosen', text: 'Excerpt' }]).focus,
    ).toContain('Chosen\nExcerpt');
    expect(() =>
      makeResearchHandoff(brief.topic, [{ title: 'Source', text: 'x'.repeat(2000) }]),
    ).toThrow();
  });
});
