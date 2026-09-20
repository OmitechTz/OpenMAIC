'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  GraduationCap,
  LayoutDashboard,
  Loader2,
  Lock,
  LogIn,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { classroomApi, type ManagedCourse } from '@/lib/education/classroom-api';
import { cn } from '@/lib/utils/cn';

interface SessionState {
  enabled: boolean;
  authenticated: boolean;
  user?: { name: string; role: string };
}

export default function DashboardPage() {
  const [session, setSession] = useState<SessionState | null>(null);
  const [sessionError, setSessionError] = useState('');
  const [courses, setCourses] = useState<ManagedCourse[] | null>(null);
  const [coursesError, setCoursesError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/omitech/session', { credentials: 'same-origin', cache: 'no-store' })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as SessionState | null;
        if (cancelled) return;
        if (!body) {
          setSessionError('Your sign-in status could not be checked. Refresh to retry.');
          return;
        }
        setSession({ enabled: body.enabled, authenticated: body.authenticated, user: body.user });
      })
      .catch(() => {
        if (!cancelled) setSessionError('Your sign-in status could not be checked. Refresh to retry.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadCourses = useCallback(async () => {
    setRefreshing(true);
    setCoursesError('');
    try {
      setCourses(await classroomApi<ManagedCourse[]>('classrooms'));
    } catch (cause) {
      setCoursesError(cause instanceof Error ? cause.message : 'Courses could not be loaded.');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (session?.authenticated) void loadCourses();
  }, [session?.authenticated, loadCourses]);

  return (
    <main className="min-h-screen bg-muted/30">
      <header className="bg-[#12345B] text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href="/learning-studio" className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[#D6A84B] text-[#12345B]">
              <GraduationCap className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Learning Studio</p>
              <p className="text-xs text-white/70">Teacher dashboard</p>
            </div>
          </Link>
          <nav className="flex items-center gap-2">
            <Link
              href="/learning-studio"
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/25 px-3 text-xs font-semibold text-white transition hover:bg-white/10"
            >
              <Sparkles className="size-3.5" />
              Learning Studio
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <section className="pt-10" aria-label="My courses">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                <LayoutDashboard className="size-6 text-primary" />
                My courses
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                The classes you teach or review through your Omitech account. Open a course in the
                Learning Studio for lessons, members, assignments and results.
              </p>
            </div>
            {session?.authenticated ? (
              <Button
                type="button"
                variant="outline"
                disabled={refreshing}
                onClick={() => void loadCourses()}
              >
                {refreshing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                Refresh
              </Button>
            ) : null}
          </div>

          {sessionError ? (
            <p role="alert" className="mt-6 text-sm text-red-600">
              {sessionError}
            </p>
          ) : null}

          {!session && !sessionError ? (
            <div className="mt-10 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Checking your sign-in…
            </div>
          ) : null}

          {session && !session.authenticated ? (
            <div className="mt-8 rounded-3xl border border-border/70 bg-background p-8 text-center shadow-sm">
              <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Lock className="size-5" />
              </div>
              <h2 className="mt-4 text-lg font-semibold">Sign in to view your courses</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                {session.enabled
                  ? 'This dashboard is private to your Omitech account. Open Omitech Agent and launch the Learning Studio from there to sign in, then return to this page.'
                  : 'Course accounts are available on the Omitech-connected deployment of this site. Open Omitech Agent and launch the Learning Studio from there to sign in.'}
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                <Button type="button" asChild>
                  <Link href="/learning-studio">
                    <LogIn className="size-4" />
                    Back to the Learning Studio
                  </Link>
                </Button>
              </div>
            </div>
          ) : null}

          {session?.authenticated ? (
            coursesError ? (
              <p role="alert" className="mt-6 text-sm text-red-600">
                {coursesError}
              </p>
            ) : courses === null ? (
              <div className="mt-10 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading your courses…
              </div>
            ) : courses.length === 0 ? (
              <div className="mt-8 rounded-3xl border border-dashed border-border bg-background p-8 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <BookOpen className="size-5" />
                </div>
                <h2 className="mt-4 text-lg font-semibold">No courses yet</h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                  Create your first class or prepare teaching materials in the Learning Studio.
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                  <Button type="button" asChild>
                    <Link href="/learning-studio">
                      <Sparkles className="size-4" />
                      Open the Learning Studio
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {courses.map((course) => (
                  <article
                    key={course.id}
                    className="flex flex-col rounded-2xl border border-border/70 bg-background p-4 shadow-sm transition hover:border-primary/30"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                        {course.code || 'No course code'}
                      </p>
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
                          course.role === 'owner'
                            ? 'bg-[#D6A84B]/15 text-[#8a6414]'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {course.role}
                      </span>
                    </div>
                    <h2 className="mt-1 font-semibold">{course.name}</h2>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {course.subject || course.name} · {course.education_level}
                      {course.term ? ` · ${course.term}` : ''}
                    </p>
                    <div className="mt-4 flex items-center justify-end gap-2 border-t border-border/50 pt-3">
                      <Button type="button" variant="outline" size="sm" asChild>
                        <Link href="/learning-studio">
                          Manage in Learning Studio
                          <ArrowRight className="size-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            )
          ) : null}
        </section>
      </div>
    </main>
  );
}
