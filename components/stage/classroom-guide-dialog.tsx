'use client';

import { useEffect, useState } from 'react';
import {
  BookOpenCheck,
  CheckCircle2,
  Download,
  MessageCircleQuestion,
  MonitorPlay,
  MousePointerClick,
  PencilLine,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useI18n } from '@/lib/hooks/use-i18n';

const GUIDE_STORAGE_PREFIX = 'openmaic:classroom-guide-seen:';

export function classroomGuideStorageKey(stageId: string): string {
  return `${GUIDE_STORAGE_PREFIX}${stageId}`;
}

interface ClassroomGuideDialogProps {
  readonly stageId?: string;
  readonly ready: boolean;
  readonly compact?: boolean;
}

export function ClassroomGuideDialog({
  stageId,
  ready,
  compact = false,
}: ClassroomGuideDialogProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!ready || !stageId || typeof window === 'undefined') return;

    const key = classroomGuideStorageKey(stageId);
    if (window.sessionStorage.getItem(key)) return;

    window.sessionStorage.setItem(key, '1');
    const timer = window.setTimeout(() => setOpen(true), 0);
    return () => window.clearTimeout(timer);
  }, [ready, stageId]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={
            compact
              ? 'inline-flex size-8 shrink-0 items-center justify-center rounded-full text-gray-400 transition-all hover:bg-white hover:text-gray-800 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-200'
              : 'inline-flex shrink-0 items-center gap-2 rounded-full p-2 text-gray-400 transition-all hover:bg-white hover:text-gray-800 hover:shadow-sm dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-200'
          }
          aria-label={t('classroomGuide.open')}
          title={t('classroomGuide.open')}
        >
          <BookOpenCheck className="size-4" aria-hidden="true" />
          {!compact && <span className="text-xs">{t('classroomGuide.guide')}</span>}
        </button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto p-0">
        <DialogHeader className="border-b bg-gradient-to-r from-violet-50 to-sky-50 px-6 py-5 dark:from-violet-950/30 dark:to-sky-950/20">
          <div className="flex items-center gap-3 pr-8">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm">
              <BookOpenCheck className="size-5" aria-hidden="true" />
            </span>
            <div>
              <DialogTitle className="text-lg">{t('classroomGuide.title')}</DialogTitle>
              <DialogDescription className="mt-1">
                {t('classroomGuide.description')}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 px-6 py-5">
          <ol className="grid gap-3 md:grid-cols-3">
            <li className="rounded-xl border bg-card p-4">
              <PencilLine className="size-5 text-violet-600" aria-hidden="true" />
              <p className="mt-3 font-semibold">1. {t('classroomGuide.prepareTitle')}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {t('classroomGuide.prepareDescription')}
              </p>
            </li>
            <li className="rounded-xl border bg-card p-4">
              <MonitorPlay className="size-5 text-sky-600" aria-hidden="true" />
              <p className="mt-3 font-semibold">2. {t('classroomGuide.presentTitle')}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {t('classroomGuide.presentDescription')}
              </p>
            </li>
            <li className="rounded-xl border bg-card p-4">
              <MessageCircleQuestion className="size-5 text-emerald-600" aria-hidden="true" />
              <p className="mt-3 font-semibold">3. {t('classroomGuide.engageTitle')}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {t('classroomGuide.engageDescription')}
              </p>
            </li>
          </ol>

          <section aria-labelledby="classroom-guide-controls">
            <h3 id="classroom-guide-controls" className="text-sm font-semibold">
              {t('classroomGuide.controlsTitle')}
            </h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {[
                ['Play / Pause', t('classroomGuide.controlPlayback')],
                ['Previous / Next', t('classroomGuide.controlNavigation')],
                ['Auto-play', t('classroomGuide.controlAutoplay')],
                ['Chat / Whiteboard', t('classroomGuide.controlTeachingTools')],
              ].map(([label, description]) => (
                <div key={label} className="flex gap-3 rounded-lg bg-muted/55 px-3 py-2.5">
                  <MousePointerClick
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-xs font-semibold">{label}</p>
                    <p className="mt-0.5 text-xs leading-4 text-muted-foreground">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section aria-labelledby="classroom-guide-downloads">
            <div className="flex items-center gap-2">
              <Download className="size-4 text-muted-foreground" aria-hidden="true" />
              <h3 id="classroom-guide-downloads" className="text-sm font-semibold">
                {t('classroomGuide.downloadsTitle')}
              </h3>
            </div>
            <div className="mt-3 overflow-hidden rounded-xl border">
              <div className="grid grid-cols-[minmax(8rem,0.8fr)_1.5fr] gap-3 border-b px-4 py-3 text-xs">
                <strong>{t('export.pptx')}</strong>
                <span className="text-muted-foreground">{t('export.pptxDesc')}</span>
              </div>
              <div className="grid grid-cols-[minmax(8rem,0.8fr)_1.5fr] gap-3 border-b px-4 py-3 text-xs">
                <strong>{t('export.resourcePack')}</strong>
                <span className="text-muted-foreground">
                  {t('classroomGuide.resourcePackDescription')}
                </span>
              </div>
              <div className="grid grid-cols-[minmax(8rem,0.8fr)_1.5fr] gap-3 px-4 py-3 text-xs">
                <strong>{t('export.classroomZip')}</strong>
                <span className="text-muted-foreground">
                  {t('classroomGuide.classroomZipDescription')}
                </span>
              </div>
            </div>
            <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-amber-700 dark:text-amber-300">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {t('classroomGuide.interactivityNotice')}
            </p>
          </section>
        </div>

        <DialogFooter className="border-t bg-muted/30 px-6 py-4">
          <DialogClose asChild>
            <Button>{t('classroomGuide.startTeaching')}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
