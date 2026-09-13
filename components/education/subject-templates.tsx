'use client';
import { Button } from '@/components/ui/button';
import { TEACHING_TEMPLATES, teachingTemplateBrief } from '@/lib/education/teaching-templates';
import { useLearningResourcesStore } from '@/lib/store/learning-resources';

export function SubjectTemplates() {
  const apply = (id: string, output: 'lesson-pack' | 'syllabus') => {
    const template = TEACHING_TEMPLATES.find((item) => item.id === id)!;
    const store = useLearningResourcesStore.getState();
    store.setDraft(teachingTemplateBrief(template, output));
    store.setComposer({
      mode: 'teacher',
      target: output,
      workflow: 'lesson-plan',
      instruction: '',
    });
  };
  return (
    <section aria-label="Teaching subject templates" className="space-y-3">
      <h3 className="font-semibold">Your teaching subjects</h3>
      <p className="text-sm text-muted-foreground">
        Start a new editable brief for a lesson pack or course outline. Add the relevant syllabus
        and approved source excerpts before generating. Applying a template replaces the current
        brief and selected sources.
      </p>
      <div className="grid gap-3 lg:grid-cols-3">
        {TEACHING_TEMPLATES.map((template) => (
          <article key={template.id} className="rounded-xl border p-4 space-y-3">
            <h4 className="font-semibold">{template.title}</h4>
            <p className="text-sm">{template.description}</p>
            <details className="text-sm">
              <summary>Course sequence and practical activity</summary>
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
                Use lesson template
              </Button>
              <Button variant="ghost" onClick={() => apply(template.id, 'syllabus')}>
                Use course outline
              </Button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
