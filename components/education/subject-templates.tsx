'use client';
import { Button } from '@/components/ui/button';
import { TEACHING_TEMPLATES, teachingTemplateBrief } from '@/lib/education/teaching-templates';
import { useLearningResourcesStore } from '@/lib/store/learning-resources';

export function SubjectTemplates() {
  const apply = (id: string, output: 'lesson-pack' | 'syllabus' | 'presentation') => {
    const template = TEACHING_TEMPLATES.find((item) => item.id === id)!;
    const store = useLearningResourcesStore.getState();
    store.setDraft(
      teachingTemplateBrief(template, output === 'presentation' ? 'lesson-pack' : output),
    );
    store.setComposer({
      mode: 'teacher',
      target: output === 'presentation' ? 'classroom' : output,
      workflow: output === 'presentation' ? 'lecture-slides' : 'lesson-plan',
      instruction: output === 'presentation' ? template.presentationInstruction : '',
    });
  };
  return (
    <section aria-label="Teaching subject templates" className="space-y-3">
      <h3 className="font-semibold">Semester teaching subjects</h3>
      <p className="text-sm text-muted-foreground">
        Prepare learning materials, a course outline, or a complete editable PowerPoint. Add the
        approved syllabus and source excerpts before generating. Applying a template replaces the
        current brief and selected sources.
      </p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {TEACHING_TEMPLATES.map((template) => (
          <article key={template.id} className="rounded-xl border p-4 space-y-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                {template.code} · {template.programme} {template.year}
              </p>
              <h4 className="mt-1 font-semibold">{template.title}</h4>
            </div>
            <p className="text-sm">{template.description}</p>
            <p className="text-xs text-muted-foreground">
              Software: {template.software.join(' · ')}
            </p>
            <details className="text-sm">
              <summary>Semester units and practical activity</summary>
              <ol className="list-decimal pl-5 my-2">
                {template.units.map((unit) => (
                  <li key={unit}>{unit}</li>
                ))}
              </ol>
              <p>{template.activity}</p>
              <p className="mt-2">{template.teachingNotes}</p>
            </details>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => apply(template.id, 'lesson-pack')}>
                Prepare materials
              </Button>
              <Button variant="ghost" onClick={() => apply(template.id, 'syllabus')}>
                Course outline
              </Button>
              <Button onClick={() => apply(template.id, 'presentation')}>Complete PPT</Button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
