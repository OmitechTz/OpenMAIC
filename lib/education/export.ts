import type { EducationArtifact } from './artifacts';
export type DocumentEdition = 'full' | 'student' | 'answer-key';
export interface DocumentBlock {
  heading: string;
  paragraphs: string[];
}

/** Assessment handouts are constructed separately: no answer fields enter the student serializer. */
export function resourceBlocks(
  artifact: EducationArtifact,
  edition: DocumentEdition,
): DocumentBlock[] {
  const { content, brief } = artifact;
  const blocks: DocumentBlock[] = [];
  const assessment = brief.output === 'assessment';
  if (edition !== 'answer-key') {
    blocks.push({ heading: 'Learning objectives', paragraphs: content.objectives });
    if (!assessment)
      blocks.push(
        ...content.sections.map((section) => ({
          heading: section.heading,
          paragraphs: [
            section.body,
            ...(section.sourceIds.length ? [`Sources: ${section.sourceIds.join(', ')}`] : []),
          ],
        })),
      );
    if (assessment)
      blocks.push({
        heading: 'Instructions',
        paragraphs: ['Answer each question. Write your reasoning where appropriate.'],
      });
    if (content.questions.length)
      blocks.push({
        heading: 'Practice questions',
        paragraphs: content.questions.map(
          (q, index) =>
            `${index + 1}. ${q.prompt}${q.options.length ? '\n' + q.options.map((option, i) => `${String.fromCharCode(65 + i)}. ${option}`).join('\n') : ''}`,
        ),
      });
    if (!assessment && edition === 'full' && content.flashcards.length)
      blocks.push({
        heading: 'Flashcards',
        paragraphs: content.flashcards.map((c) => `${c.front}\n${c.back}`),
      });
  }
  if (edition === 'answer-key' || (!assessment && edition === 'full' && content.questions.length)) {
    blocks.push({
      heading: 'Answer key — for review',
      paragraphs: content.questions.map(
        (q, i) =>
          `${i + 1}. ${q.prompt}\nAnswer: ${q.options.length && q.correctOption !== null ? q.options[q.correctOption] : q.answer}\n${q.explanation}`,
      ),
    });
    blocks.push({
      heading: 'Marking rubric',
      paragraphs: content.rubric.map((r) => `${r.criterion}\n${r.guidance}`),
    });
  }
  // List selected sources without embedding entire copyrighted/source documents in every export.
  if (brief.sources.length)
    blocks.push({
      heading: 'Source references',
      paragraphs: brief.sources.map((s) => `[${s.id}] ${s.title}`),
    });
  blocks.push({
    heading: 'Review note',
    paragraphs: [
      brief.sources.length
        ? 'AI-generated from the selected excerpts. Source attribution has not been independently verified; review factual claims and citations.'
        : 'AI-generated general learning material. No source documents were supplied. Review factual claims before teaching or submission.',
    ],
  });
  return blocks;
}
export function resourceMarkdown(artifact: EducationArtifact, edition: DocumentEdition) {
  return `# ${artifact.content.title.replace(/[\r\n]/g, ' ')}\n\n${resourceBlocks(artifact, edition)
    .map((b) => `## ${b.heading}\n\n${b.paragraphs.join('\n\n')}`)
    .join('\n\n')}`;
}
export function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}
export function resourceHtml(artifact: EducationArtifact, edition: DocumentEdition) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(artifact.content.title)}</title><style>
  body{font:12pt/1.55 Arial,sans-serif;color:#172033;max-width:760px;margin:36px auto;padding:0 24px}h1{font-size:26pt;line-height:1.2}h2{font-size:16pt;margin-top:28px;break-after:avoid}p{white-space:pre-wrap;overflow-wrap:anywhere;orphans:3;widows:3}header{border-bottom:2px solid #3558a5;padding-bottom:16px}small{color:#52617a}@page{size:A4;margin:20mm}@media print{body{margin:0;padding:0;max-width:none}}
  </style></head><body><header><small>Omitech Learning Studio · ${escapeHtml(edition)}</small><h1>${escapeHtml(artifact.content.title)}</h1></header>${resourceBlocks(
    artifact,
    edition,
  )
    .map(
      (b) =>
        `<section><h2>${escapeHtml(b.heading)}</h2>${b.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('')}</section>`,
    )
    .join('')}</body></html>`;
}
export async function resourceDocx(
  artifact: EducationArtifact,
  edition: DocumentEdition,
): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx');
  const children = [new Paragraph({ text: artifact.content.title, heading: HeadingLevel.TITLE })];
  for (const block of resourceBlocks(artifact, edition)) {
    children.push(
      new Paragraph({ text: block.heading, heading: HeadingLevel.HEADING_1, keepNext: true }),
    );
    for (const text of block.paragraphs)
      children.push(
        new Paragraph({
          spacing: { after: 160 },
          children: text
            .split('\n')
            .map((line, i) => new TextRun({ text: line, break: i ? 1 : 0 })),
        }),
      );
  }
  return Packer.toBlob(
    new Document({
      sections: [{ children }],
      styles: { default: { document: { run: { font: 'Arial', size: 24 } } } },
    }),
  );
}
export async function downloadResource(
  artifact: EducationArtifact,
  format: 'docx' | 'md' | 'html',
  edition: DocumentEdition,
) {
  const { saveAs } = await import('file-saver');
  const blob =
    format === 'docx'
      ? await resourceDocx(artifact, edition)
      : new Blob(
          [format === 'md' ? resourceMarkdown(artifact, edition) : resourceHtml(artifact, edition)],
          { type: format === 'md' ? 'text/markdown;charset=utf-8' : 'text/html;charset=utf-8' },
        );
  saveAs(
    blob,
    `${artifact.content.title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 100)}-${edition}.${format}`,
  );
}
export function printResource(artifact: EducationArtifact, edition: DocumentEdition) {
  const target = window.open('', '_blank');
  if (!target) throw new Error('Allow the print window, then try again.');
  target.opener = null;
  target.document.open();
  target.document.write(resourceHtml(artifact, edition));
  target.document.close();
  target.focus();
  target.print();
}
