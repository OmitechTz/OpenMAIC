import { test, expect } from '@playwright/test';
import { content } from '../../tests/omitech/education-fixtures';

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
