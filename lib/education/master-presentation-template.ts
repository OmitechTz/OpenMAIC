import pptxgen from 'pptxgenjs';

export interface MasterTemplateProfile {
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

function prepareMasterDocument(profile: MasterTemplateProfile, title: string) {
  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = profile.lecturer || 'Learning Studio';
  pptx.company = 'Learning Studio';
  pptx.subject = `${profile.courseCode} ${profile.courseName}`.trim();
  pptx.title = title;
  pptx.theme = {
    headFontFace: profile.headingFont,
    bodyFontFace: profile.bodyFont,
  };
  return pptx;
}

function defineMasterLayouts(pptx: pptxgen, profile: MasterTemplateProfile) {
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
    title: 'MASTER_TITLE',
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
          text: profile.courseCode || ' ',
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
    title: 'MASTER_CONTENT',
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
    title: 'MASTER_SECTION',
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

export async function downloadMasterPresentationTemplate(profile: MasterTemplateProfile) {
  const pptx = prepareMasterDocument(
    profile,
    `${profile.courseCode} ${profile.courseName} presentation template`.trim(),
  );
  const primary = hex(profile.primary);
  defineMasterLayouts(pptx, profile);

  const title = pptx.addSlide({ masterName: 'MASTER_TITLE' });
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

  const section = pptx.addSlide({ masterName: 'MASTER_SECTION' });
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

  const content = pptx.addSlide({ masterName: 'MASTER_CONTENT' });
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

  const activity = pptx.addSlide({ masterName: 'MASTER_CONTENT' });
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
  await pptx.writeFile({ fileName: `${safeCode}-master-template.pptx` });
}
