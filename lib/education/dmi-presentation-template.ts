import pptxgen from 'pptxgenjs';

import type { EducationArtifact } from './artifacts';

export interface DmiTemplateProfile {
  courseCode: string;
  courseName: string;
  semester: string;
  academicYear: string;
  lecturer: string;
  primary: string;
  accent: string;
  headingFont: string;
  bodyFont: string;
  footer: string;
}

const hex = (value: string) => value.replace('#', '').toUpperCase();

function prepareDmiDocument(profile: DmiTemplateProfile, title: string) {
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = profile.lecturer || 'DMI Teaching Hub';
  pptx.company = 'DMI Teaching Hub';
  pptx.subject = `${profile.courseCode} ${profile.courseName}`.trim();
  pptx.title = title;
  pptx.theme = {
    headFontFace: profile.headingFont,
    bodyFontFace: profile.bodyFont,
  };
  return pptx;
}

function defineDmiMasters(pptx: pptxgen, profile: DmiTemplateProfile) {
  const primary = hex(profile.primary);
  const accent = hex(profile.accent);

  const footerObjects: pptxgen.SlideMasterProps['objects'] = [
    {
      rect: {
        x: 0,
        y: 7.18,
        w: 13.333,
        h: 0.32,
        fill: { color: primary },
        line: { color: primary },
      },
    },
    {
      text: {
        text: `${profile.footer}  |  ${profile.courseCode}  |  ${profile.semester} ${profile.academicYear}`,
        options: {
          x: 0.45,
          y: 7.22,
          w: 11.9,
          h: 0.18,
          fontFace: profile.bodyFont,
          fontSize: 8,
          color: 'FFFFFF',
          margin: 0,
        },
      },
    },
  ];

  pptx.defineSlideMaster({
    title: 'DMI_TITLE',
    background: { color: primary },
    objects: [
      {
        rect: {
          x: 0.55,
          y: 0.6,
          w: 0.12,
          h: 5.95,
          fill: { color: accent },
          line: { color: accent },
        },
      },
      {
        text: {
          text: 'DMI',
          options: {
            x: 11.45,
            y: 0.55,
            w: 1.25,
            h: 0.5,
            fontFace: profile.headingFont,
            fontSize: 24,
            bold: true,
            align: 'right',
            color: accent,
            margin: 0,
          },
        },
      },
    ],
  });
  pptx.defineSlideMaster({
    title: 'DMI_CONTENT',
    background: { color: 'FFFFFF' },
    objects: [
      {
        rect: {
          x: 0,
          y: 0,
          w: 13.333,
          h: 0.18,
          fill: { color: accent },
          line: { color: accent },
        },
      },
      ...footerObjects,
    ],
    slideNumber: {
      x: 12.45,
      y: 7.21,
      w: 0.4,
      h: 0.18,
      fontFace: profile.bodyFont,
      fontSize: 8,
      color: 'FFFFFF',
      align: 'right',
      margin: 0,
    },
  });
  pptx.defineSlideMaster({
    title: 'DMI_SECTION',
    background: { color: primary },
    objects: [
      {
        rect: {
          x: 0.65,
          y: 5.85,
          w: 3.2,
          h: 0.1,
          fill: { color: accent },
          line: { color: accent },
        },
      },
    ],
  });
}

const safeFileCode = (value: string) => (value || 'course').replace(/[^A-Za-z0-9_-]+/g, '-');

export async function downloadDmiPresentationTemplate(profile: DmiTemplateProfile) {
  const pptx = prepareDmiDocument(
    profile,
    `${profile.courseCode} ${profile.courseName} presentation template`.trim(),
  );
  const primary = hex(profile.primary);
  defineDmiMasters(pptx, profile);

  const title = pptx.addSlide({ masterName: 'DMI_TITLE' });
  title.addText(profile.courseName || 'Course title', {
    x: 0.95,
    y: 2.15,
    w: 10.9,
    h: 1.1,
    fontFace: profile.headingFont,
    fontSize: 34,
    bold: true,
    color: 'FFFFFF',
    margin: 0,
  });
  title.addText(
    `${profile.courseCode}\n${profile.semester} ${profile.academicYear}\n${profile.lecturer || 'Lecturer name'}`,
    {
      x: 0.95,
      y: 3.55,
      w: 8.8,
      h: 1.2,
      fontFace: profile.bodyFont,
      fontSize: 18,
      breakLine: false,
      color: 'FFFFFF',
      margin: 0,
    },
  );

  const section = pptx.addSlide({ masterName: 'DMI_SECTION' });
  section.addText('Section title', {
    x: 0.65,
    y: 2.55,
    w: 11.7,
    h: 0.85,
    fontFace: profile.headingFont,
    fontSize: 32,
    bold: true,
    color: 'FFFFFF',
    margin: 0,
  });
  section.addText('Brief section description', {
    x: 0.65,
    y: 3.65,
    w: 9.8,
    h: 0.55,
    fontFace: profile.bodyFont,
    fontSize: 18,
    color: 'FFFFFF',
    margin: 0,
  });

  const content = pptx.addSlide({ masterName: 'DMI_CONTENT' });
  content.addText('Slide title', {
    x: 0.55,
    y: 0.48,
    w: 12.1,
    h: 0.55,
    fontFace: profile.headingFont,
    fontSize: 27,
    bold: true,
    color: primary,
    margin: 0,
  });
  content.addText(
    'Replace this text with concise teaching content. Keep equations, units and sources visible.',
    {
      x: 0.72,
      y: 1.45,
      w: 11.8,
      h: 1.25,
      fontFace: profile.bodyFont,
      fontSize: 20,
      color: '222222',
      margin: 0,
      breakLine: false,
    },
  );
  content.addNotes('Add lecturer guidance, source citations and answer notes here.');

  const activity = pptx.addSlide({ masterName: 'DMI_CONTENT' });
  activity.addText('Activity or knowledge check', {
    x: 0.55,
    y: 0.48,
    w: 12.1,
    h: 0.55,
    fontFace: profile.headingFont,
    fontSize: 27,
    bold: true,
    color: primary,
    margin: 0,
  });
  activity.addText('Question or task\n\nInstructions\n\nExpected time', {
    x: 0.72,
    y: 1.45,
    w: 11.8,
    h: 3.5,
    fontFace: profile.bodyFont,
    fontSize: 20,
    color: '222222',
    margin: 0,
    breakLine: false,
  });
  activity.addNotes(
    'Keep the answer and marking guidance in speaker notes for the lecturer edition.',
  );

  const safeCode = safeFileCode(profile.courseCode);
  await pptx.writeFile({ fileName: `${safeCode}-DMI-master-template.pptx` });
}

const SLIDE_BODY_CHARS = 1100;
const QUESTIONS_PER_SLIDE = 4;

function splitBody(text: string): string[] {
  const chunks: string[] = [];
  let current = '';
  for (const paragraph of text.split(/\n{2,}/)) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length > SLIDE_BODY_CHARS && current) {
      chunks.push(current);
      current = paragraph;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks.flatMap((chunk) => {
    if (chunk.length <= SLIDE_BODY_CHARS) return [chunk];
    const parts: string[] = [];
    for (let index = 0; index < chunk.length; index += SLIDE_BODY_CHARS) {
      parts.push(chunk.slice(index, index + SLIDE_BODY_CHARS));
    }
    return parts;
  });
}

function addContentSlide(
  pptx: pptxgen,
  profile: DmiTemplateProfile,
  heading: string,
  body: string,
  notes?: string,
) {
  const slide = pptx.addSlide({ masterName: 'DMI_CONTENT' });
  slide.addText(heading, {
    x: 0.55,
    y: 0.48,
    w: 12.1,
    h: 0.55,
    fontFace: profile.headingFont,
    fontSize: 27,
    bold: true,
    color: hex(profile.primary),
    margin: 0,
  });
  slide.addText(body, {
    x: 0.72,
    y: 1.45,
    w: 11.8,
    h: 5.4,
    fontFace: profile.bodyFont,
    fontSize: 16,
    color: '222222',
    margin: 0,
    breakLine: false,
    valign: 'top',
  });
  if (notes) slide.addNotes(notes);
}

/**
 * Render a generated teaching resource into the DMI master and download it as
 * an editable PPTX. Answers, rationales and marking guidance stay in lecturer
 * speaker notes, matching the classroom presentation standard.
 */
export async function downloadDmiResourcePresentation(
  profile: DmiTemplateProfile,
  artifact: EducationArtifact,
) {
  const { content } = artifact;
  const pptx = prepareDmiDocument(
    profile,
    `${profile.courseCode} ${content.title}`.trim() || 'DMI teaching resource',
  );
  defineDmiMasters(pptx, profile);

  const title = pptx.addSlide({ masterName: 'DMI_TITLE' });
  title.addText(content.title, {
    x: 0.95,
    y: 2.15,
    w: 10.9,
    h: 1.1,
    fontFace: profile.headingFont,
    fontSize: 34,
    bold: true,
    color: 'FFFFFF',
    margin: 0,
  });
  title.addText(
    `${profile.courseCode}\n${profile.semester} ${profile.academicYear}\n${profile.lecturer || 'Lecturer name'}`,
    {
      x: 0.95,
      y: 3.55,
      w: 8.8,
      h: 1.2,
      fontFace: profile.bodyFont,
      fontSize: 18,
      breakLine: false,
      color: 'FFFFFF',
      margin: 0,
    },
  );

  addContentSlide(
    pptx,
    profile,
    'Learning objectives',
    content.objectives.map((objective) => `• ${objective}`).join('\n'),
    `Course: ${profile.courseCode} ${profile.courseName}. Confirm each objective against the approved syllabus before teaching.`,
  );

  for (const section of content.sections) {
    const chunks = splitBody(section.body);
    chunks.forEach((chunk, index) => {
      addContentSlide(
        pptx,
        profile,
        chunks.length > 1 ? `${section.heading} (${index + 1}/${chunks.length})` : section.heading,
        chunk,
        section.sourceIds.length ? `Sources: ${section.sourceIds.join(', ')}` : undefined,
      );
    });
  }

  for (let index = 0; index < content.questions.length; index += QUESTIONS_PER_SLIDE) {
    const batch = content.questions.slice(index, index + QUESTIONS_PER_SLIDE);
    addContentSlide(
      pptx,
      profile,
      index === 0 ? 'Activity and knowledge check' : `Knowledge check (continued)`,
      batch
        .map(
          (question, offset) =>
            `${index + offset + 1}. ${question.prompt}${
              question.options.length
                ? `\n${question.options
                    .map((option, i) => `   ${String.fromCharCode(65 + i)}. ${option}`)
                    .join('\n')}`
                : ''
            }`,
        )
        .join('\n\n'),
      `Lecturer answers and marking guidance:\n${batch
        .map(
          (question, offset) =>
            `${index + offset + 1}. ${
              question.options.length && question.correctOption !== null
                ? question.options[question.correctOption]
                : question.answer
            }\n${question.explanation}`,
        )
        .join('\n\n')}`,
    );
  }

  addContentSlide(
    pptx,
    profile,
    'Recap and review',
    [
      ...content.objectives.slice(0, 4).map((objective) => `• ${objective}`),
      '',
      'AI-generated teaching material. Review factual claims, equations, units and source attributions before delivery.',
    ].join('\n'),
    content.rubric.length
      ? `Marking rubric:\n${content.rubric
          .map((criterion) => `${criterion.criterion}: ${criterion.guidance}`)
          .join('\n')}`
      : undefined,
  );

  const safeCode = safeFileCode(profile.courseCode);
  const safeTitle = content.title
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '-')
    .slice(0, 60);
  await pptx.writeFile({ fileName: `${safeCode}-${safeTitle || 'teaching-resource'}.pptx` });
}
