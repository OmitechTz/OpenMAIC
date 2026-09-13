import type { EducationContent } from './artifacts';
import { escapeHtml } from './export';

/** Moodle XML question-bank import format. No credentials or student records. */
export function moodleQuestionBank(content: EducationContent): string {
  const text = (value: string) => `<text>${escapeHtml(value)}</text>`;
  const questions = content.questions.map((q, i) => {
    const common = `<name>${text(`${content.title} — ${i + 1}`)}</name><questiontext format="plain_text">${text(q.prompt)}</questiontext><generalfeedback format="plain_text">${text(q.explanation)}</generalfeedback><defaultgrade>1</defaultgrade><penalty>0</penalty><hidden>0</hidden>`;
    if (q.options.length)
      return `<question type="multichoice">${common}<single>true</single><shuffleanswers>true</shuffleanswers><answernumbering>abc</answernumbering>${q.options.map((option, j) => `<answer fraction="${j === q.correctOption ? 100 : 0}" format="plain_text">${text(option)}<feedback format="plain_text">${text(j === q.correctOption ? q.explanation : q.hint)}</feedback></answer>`).join('')}</question>`;
    return `<question type="essay">${common}<responseformat>editor</responseformat><responserequired>1</responserequired><responsefieldlines>10</responsefieldlines><attachments>0</attachments><graderinfo format="plain_text">${text(`${q.answer}\n${q.explanation}`)}</graderinfo></question>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?><quiz>${questions.join('')}</quiz>`;
}
