import type { AssignedLesson } from './classroom-api';
import { escapeHtml } from './export';

/** Only accepts the already-authorized, student-safe assignment response. */
export function offlineAssignmentHtml(lesson: AssignedLesson): string {
  const questions = lesson.content.questions
    .map(
      (q, index) =>
        `<fieldset><legend>${index + 1}. ${escapeHtml(q.prompt)}</legend>${
          q.options.length
            ? q.options
                .map(
                  (option, j) =>
                    `<label><input type="radio" name="q${index}" value="${j}">${escapeHtml(option)}</label>`,
                )
                .join('')
            : `<textarea name="q${index}" aria-label="Answer ${index + 1}" rows="4" maxlength="8000"></textarea>`
        }<details><summary>Hint</summary><p>${escapeHtml(q.hint)}</p></details></fieldset>`,
    )
    .join('');
  const metadata = JSON.stringify({
    assignment_id: lesson.id,
    lesson_version: lesson.lesson_version,
    count: lesson.content.questions.length,
  }).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(lesson.title)}</title><style>body{font:18px/1.6 system-ui;max-width:760px;margin:auto;padding:20px;color:#172033}p{white-space:pre-wrap}fieldset{margin:20px 0;border:1px solid #aaa;border-radius:12px}label{display:block;padding:10px}textarea{width:95%;font:inherit}button{padding:14px;font:inherit}h2{font-size:1.2em}@media print{button{display:none}}</style><h1>${escapeHtml(lesson.title)}</h1><p>This downloaded copy works without a network. Download your answers, then import them into the same assignment when online. No answers are sent automatically.</p><p>${escapeHtml(lesson.instructions)}</p>${lesson.content.sections.map((s) => `<section><h2>${escapeHtml(s.heading)}</h2><p>${escapeHtml(s.body)}</p></section>`).join('')}<form id="work">${questions}<button type="button" id="download">Download my answers</button></form><p id="status" role="status"></p><script>
const meta=${metadata};const form=document.getElementById('work');const hints=new Set();form.querySelectorAll('details').forEach((d,i)=>d.addEventListener('toggle',()=>{if(d.open)hints.add(i)}));
document.getElementById('download').onclick=()=>{const answers={};for(let i=0;i<meta.count;i++){const checked=form.querySelector('input[name="q'+i+'"]:checked');const text=form.querySelector('textarea[name="q'+i+'"]');answers[i]={text:text?text.value:'',option:checked?Number(checked.value):null,hint_used:hints.has(i)}}const url=URL.createObjectURL(new Blob([JSON.stringify({...meta,answers})],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='assignment-'+meta.assignment_id+'-answers.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);document.getElementById('status').textContent='Answers downloaded. Import and review them online before submitting.'};
</script></html>`;
}
