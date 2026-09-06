import type { EducationSource } from './artifacts';
export interface ResearchHandoff {
  topic: string;
  focus: string;
}
export function makeResearchHandoff(
  topic: string,
  excerpts: Pick<EducationSource, 'title' | 'text'>[],
): ResearchHandoff {
  const cleanTopic = topic.trim();
  if (cleanTopic.length < 8 || cleanTopic.length > 1000)
    throw new Error('Use a research topic between 8 and 1,000 characters.');
  const focus = excerpts.length
    ? 'Selected Learning Studio excerpts for context; verify them independently:\n\n' +
      excerpts.map((source) => `${source.title}\n${source.text}`).join('\n\n')
    : '';
  if (focus.length > 2000)
    throw new Error(
      'Shorten the selected excerpts to fit the 2,000-character Research Studio context limit.',
    );
  return { topic: cleanTopic, focus };
}
