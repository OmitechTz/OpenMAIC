import { test, expect } from '@playwright/test';
import { content } from '../../tests/omitech/education-fixtures';

test('assigned student work saves, resumes and submits with controlled answer release', async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.route('**/api/omitech/session', (route) =>
    route.fulfill({
      json: {
        enabled: true,
        authenticated: true,
        user: {
          id: 'b'.repeat(64),
          learner_key: 'omitech:classroom-test',
          name: 'Student',
          role: 'learner',
        },
      },
    }),
  );
  await page.route('**/api/server-providers*', (route) =>
    route.fulfill({
      json: { providers: {}, tts: {}, asr: {}, pdf: {}, image: {}, video: {}, webSearch: {} },
    }),
  );
  const assignment = {
    id: 7,
    title: 'AI practical',
    instructions: 'Classify the example.',
    lesson_id: 4,
    due_at: null,
    answer_release: 'after_submit',
  };
  let saved: {
    id: number;
    status: string;
    version: number;
    answers: unknown;
    results: unknown[];
    feedback: string;
  } | null = null;
  await page.route('**/api/omitech/learning-studio/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/submission')) {
      const body = route.request().postDataJSON();
      saved = {
        id: 11,
        status: body.finalized ? 'submitted' : 'draft',
        version: (saved?.version || 0) + 1,
        answers: body.answers,
        results: [],
        feedback: '',
      };
      return route.fulfill({ json: saved });
    }
    if (path.endsWith('/assignments/7')) {
      const released = saved?.status === 'submitted';
      return route.fulfill({
        json: {
          ...assignment,
          role: 'student',
          lesson_version: 2,
          answers_released: released,
          submission: saved,
          content: {
            ...content,
            questions: content.questions.map((q) =>
              released
                ? q
                : {
                    prompt: q.prompt,
                    topic: q.topic,
                    objectiveIndex: 0,
                    options: q.options,
                    hint: q.hint,
                    sourceIds: [],
                  },
            ),
            flashcards: [],
            rubric: [],
          },
        },
      });
    }
    if (path.endsWith('/classrooms/1/assignments')) return route.fulfill({ json: [assignment] });
    if (path.endsWith('/classrooms'))
      return route.fulfill({
        json: [{ id: 1, name: 'AI class', education_level: 'undergraduate', role: 'student' }],
      });
    return route.fulfill({ status: 404, json: { detail: 'Unexpected test request' } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Classes and assignments', exact: true }).click();
  await page.getByRole('button', { name: 'Open / resume' }).click();
  const reader = page.getByRole('article', { name: 'Assigned lesson reader' });
  await expect(reader.getByRole('heading', { name: 'AI practical' })).toBeVisible();
  await reader.getByLabel('Land and sea', { exact: true }).check();
  await reader.getByRole('button', { name: 'Save to account', exact: true }).click();
  await expect(reader.getByRole('status')).toHaveText('Saved to your account.');
  await reader.getByRole('button', { name: 'Back to classes' }).click();
  await page.getByRole('button', { name: 'Open / resume' }).click();
  await expect(reader.getByLabel('Land and sea', { exact: true })).toBeChecked();
  await reader.getByRole('button', { name: 'Submit to teacher', exact: true }).click();
  await expect(reader.getByRole('status')).toHaveText('Submitted to your teacher.');
  await expect(reader.getByRole('button', { name: 'Submit to teacher', exact: true })).toHaveCount(
    0,
  );
});

test('pasted brief recovers missing AI connection and subject templates fill the shared composer', async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.route('**/api/omitech/session', (route) =>
    route.fulfill({
      json: {
        enabled: true,
        authenticated: true,
        user: { id: 'a'.repeat(64), learner_key: 'omitech:test', name: 'Teacher', role: 'learner' },
      },
    }),
  );
  await page.route('**/api/server-providers*', (route) =>
    route.fulfill({
      json: { providers: {}, tts: {}, asr: {}, pdf: {}, image: {}, video: {}, webSearch: {} },
    }),
  );
  await page.route('**/api/models/openrouter*', (route) => route.fulfill({ json: { models: [] } }));
  await page.goto('/');
  await page.getByRole('button', { name: /^teacher$/i }).click();
  const prompt = page.getByRole('textbox', { name: 'Shared learning prompt' });
  await prompt.fill('Explain how a machine condition classifier works.');
  const connect = page.getByRole('button', { name: 'Connect AI to create', exact: true });
  await expect(connect).toBeEnabled();
  const briefForm = page.getByRole('form', { name: 'Learning resource brief' });
  await expect(briefForm.getByLabel('Topic or learning question')).toHaveValue(
    'Explain how a machine condition classifier works.',
  );
  for (const subject of [
    'Artificial Intelligence',
    'Industrial Automation',
    'Machine Maintenance',
  ]) {
    const card = page
      .getByRole('article')
      .filter({ has: page.getByRole('heading', { name: subject, exact: true }) });
    await card.getByRole('button', { name: 'Use lesson template' }).click();
    await expect(briefForm.getByLabel('Topic or learning question')).toHaveValue(
      new RegExp(subject),
    );
    await expect(prompt).toHaveValue(new RegExp(subject));
  }
  await connect.click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('student resource creation, saved practice, editing and downloads', async ({
  page,
}, testInfo) => {
  test.setTimeout(180000);
  page.setDefaultTimeout(15000);
  const browserErrors: string[] = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  await page.context().addInitScript(() => {
    window.print = () => {};
  });
  await page.route('**/api/omitech/session', (route) =>
    route.fulfill({
      json: {
        enabled: true,
        authenticated: true,
        user: {
          id: 'a'.repeat(64),
          learner_key: `omitech:${'a'.repeat(64)}`,
          name: 'Test learner',
          role: 'learner',
        },
      },
    }),
  );
  await page.route('**/api/server-providers*', (route) =>
    route.fulfill({
      json: {
        providers: { openrouter: { models: ['fixture/model'] } },
        tts: {},
        asr: {},
        pdf: {},
        image: {},
        video: {},
        webSearch: {},
      },
    }),
  );
  await page.route('**/api/education/generate', async (route) => {
    const brief = route.request().postDataJSON();
    const sourceIds = brief.sources.map((source: { id: string }) => source.id);
    await route.fulfill({
      json: {
        success: true,
        content: {
          ...content,
          title: 'Shipping study pack',
          sections: content.sections.map((s) => ({ ...s, sourceIds })),
          questions: content.questions.map((q) => ({ ...q, sourceIds })),
          flashcards: content.flashcards.map((c) => ({ ...c, sourceIds })),
        },
      },
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: /^student$/i }).click();
  await page.getByRole('button', { name: /^Create flashcards/ }).click();
  const form = page.getByRole('form', { name: 'Learning resource brief' });
  await form.getByLabel('Topic or learning question').fill('Shipping in Tanzania and Africa');
  await form.getByLabel('Practice / assessment questions').fill('1');
  await form.getByRole('button', { name: 'Generate and save resource' }).click();
  const resource = page.getByRole('article', { name: 'Saved learning resource' });
  await expect(resource.getByRole('heading', { name: 'Shipping study pack' })).toBeVisible();
  await resource.getByRole('button', { name: 'Practise', exact: true }).click();
  await resource.getByRole('button', { name: 'Reveal answer' }).click();
  await resource.getByRole('button', { name: 'Good', exact: true }).click();
  await expect(resource.getByText(/Next card review:/)).toBeVisible();
  await resource.getByLabel('Land and sea', { exact: true }).check();
  await resource.getByRole('button', { name: 'Check my attempt' }).click();
  await expect(resource.getByText('Correct', { exact: true })).toBeVisible();
  await resource.getByRole('button', { name: 'Next question' }).click();
  await expect(resource.getByText(/Practice complete/)).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Shipping study pack', exact: true }).click();
  await resource.getByRole('button', { name: 'Practise', exact: true }).click();
  await expect(resource.getByText('0 cards due · 2 recorded attempts')).toBeVisible();
  await resource.getByRole('button', { name: 'Edit resource' }).click();
  expect(browserErrors).toEqual([]);
  await expect(resource.getByRole('button', { name: 'Save changes' })).toBeVisible();
  await resource
    .getByRole('textbox', { name: 'Resource title', exact: true })
    .fill('Shipping revision notes');
  await resource.getByRole('button', { name: 'Save changes' }).click();
  const downloadEvent = page.waitForEvent('download');
  await resource.getByRole('button', { name: 'Word (.docx)' }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toContain('.docx');
  await download.saveAs(testInfo.outputPath('shipping-study-pack.docx'));
  const popupEvent = page.waitForEvent('popup');
  await resource.getByRole('button', { name: 'PDF / Print' }).click();
  const printable = await popupEvent;
  await expect(printable.getByRole('heading', { name: 'Shipping revision notes' })).toBeVisible();
  await printable.pdf({
    path: testInfo.outputPath('shipping-study-pack.pdf'),
    preferCSSPageSize: true,
  });
  await printable.screenshot({ path: testInfo.outputPath('print-layout.png'), fullPage: true });
  await printable.close();
  await page.screenshot({ path: testInfo.outputPath('learning-resource.png'), fullPage: true });
  await page.getByRole('button', { name: 'My progress', exact: true }).click();
  await expect(page.getByRole('region', { name: 'My learning progress' })).toContainText(
    '2 attempts',
  );
});
