/**
 * Omitech Learning Studio education state.
 *
 * Course metadata and preferences are account-scoped so the signed-in Omitech
 * user sees the same teaching setup on every supported device. Resource bytes
 * remain local by design; only their metadata and local storage reference are
 * stored here.
 */

import { nanoid } from 'nanoid';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { createKVPersistStorage, purgeLegacyPersistKey } from '@/lib/store/kv-persist';

export type StudioMode = 'teacher' | 'student';
export type EducationLevel =
  | 'primary'
  | 'secondary'
  | 'undergraduate'
  | 'postgraduate'
  | 'professional';

export type TeachingRoleId =
  | 'course-designer'
  | 'subject-expert'
  | 'assessment-coach'
  | 'research-assistant'
  | 'presentation-designer'
  | 'student-tutor';

export type EducationIntegrationId =
  | 'omitech-agent'
  | 'google-classroom'
  | 'moodle'
  | 'canvas'
  | 'microsoft-teams'
  | 'google-drive'
  | 'onedrive'
  | 'zotero';

export interface EducationCourse {
  id: string;
  name: string;
  code: string;
  subject: string;
  level: EducationLevel;
  term: string;
  institution: string;
  audience: string;
  createdAt: number;
  updatedAt: number;
}

export interface CourseResource {
  id: string;
  courseId: string;
  name: string;
  size: number;
  mimeType: string;
  storageKey: string;
  addedAt: number;
}

export interface StudentGuardrails {
  socraticGuidance: boolean;
  hintsBeforeAnswers: boolean;
  explainReasoning: boolean;
  sourceCitations: boolean;
  teacherReview: boolean;
}

export interface InstitutionBranding {
  name: string;
  shortName: string;
  primaryColor: string;
}

export interface EducationIntegration {
  id: EducationIntegrationId;
  status: 'connected' | 'configured' | 'not_configured';
  endpoint: string;
  workspace: string;
  updatedAt?: number;
}

interface CreateCourseInput {
  name: string;
  code?: string;
  subject?: string;
  level: EducationLevel;
  term?: string;
  institution?: string;
  audience?: string;
}

interface EducationStudioState {
  mode: StudioMode;
  courses: EducationCourse[];
  selectedCourseId: string | null;
  resources: CourseResource[];
  teachingRoleIds: TeachingRoleId[];
  guardrails: StudentGuardrails;
  institution: InstitutionBranding;
  integrations: Record<EducationIntegrationId, EducationIntegration>;
  setMode: (mode: StudioMode) => void;
  createCourse: (input: CreateCourseInput) => string;
  updateCourse: (id: string, changes: Partial<Omit<EducationCourse, 'id' | 'createdAt'>>) => void;
  removeCourse: (id: string) => void;
  selectCourse: (id: string | null) => void;
  addResource: (resource: Omit<CourseResource, 'id' | 'addedAt'>) => string;
  removeResource: (id: string) => void;
  toggleTeachingRole: (id: TeachingRoleId) => void;
  updateGuardrails: (changes: Partial<StudentGuardrails>) => void;
  updateInstitution: (changes: Partial<InstitutionBranding>) => void;
  configureIntegration: (
    id: EducationIntegrationId,
    changes: Pick<EducationIntegration, 'endpoint' | 'workspace'>,
  ) => void;
  disconnectIntegration: (id: EducationIntegrationId) => void;
}

const defaultGuardrails: StudentGuardrails = {
  socraticGuidance: true,
  hintsBeforeAnswers: true,
  explainReasoning: true,
  sourceCitations: true,
  teacherReview: false,
};

const defaultIntegrations: Record<EducationIntegrationId, EducationIntegration> = {
  'omitech-agent': {
    id: 'omitech-agent',
    status: 'connected',
    endpoint: '',
    workspace: 'Documents · Presentations · Calendar · Tasks',
  },
  'google-classroom': {
    id: 'google-classroom',
    status: 'not_configured',
    endpoint: '',
    workspace: '',
  },
  moodle: { id: 'moodle', status: 'not_configured', endpoint: '', workspace: '' },
  canvas: { id: 'canvas', status: 'not_configured', endpoint: '', workspace: '' },
  'microsoft-teams': {
    id: 'microsoft-teams',
    status: 'not_configured',
    endpoint: '',
    workspace: '',
  },
  'google-drive': {
    id: 'google-drive',
    status: 'not_configured',
    endpoint: '',
    workspace: '',
  },
  onedrive: { id: 'onedrive', status: 'not_configured', endpoint: '', workspace: '' },
  zotero: { id: 'zotero', status: 'not_configured', endpoint: '', workspace: '' },
};

const recovery: { rehydrate?: () => void | Promise<void> } = {};

export const useEducationStudioStore = create<EducationStudioState>()(
  persist(
    (set) => ({
      mode: 'teacher',
      courses: [],
      selectedCourseId: null,
      resources: [],
      teachingRoleIds: ['course-designer', 'subject-expert', 'assessment-coach'],
      guardrails: defaultGuardrails,
      institution: { name: '', shortName: '', primaryColor: '#d6336c' },
      integrations: defaultIntegrations,
      setMode: (mode) => set({ mode }),
      createCourse: (input) => {
        const id = nanoid(10);
        const now = Date.now();
        const course: EducationCourse = {
          id,
          name: input.name.trim(),
          code: input.code?.trim() ?? '',
          subject: input.subject?.trim() ?? '',
          level: input.level,
          term: input.term?.trim() ?? '',
          institution: input.institution?.trim() ?? '',
          audience: input.audience?.trim() ?? '',
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({ courses: [course, ...state.courses], selectedCourseId: id }));
        return id;
      },
      updateCourse: (id, changes) =>
        set((state) => ({
          courses: state.courses.map((course) =>
            course.id === id ? { ...course, ...changes, updatedAt: Date.now() } : course,
          ),
        })),
      removeCourse: (id) =>
        set((state) => ({
          courses: state.courses.filter((course) => course.id !== id),
          resources: state.resources.filter((resource) => resource.courseId !== id),
          selectedCourseId:
            state.selectedCourseId === id
              ? (state.courses.find((course) => course.id !== id)?.id ?? null)
              : state.selectedCourseId,
        })),
      selectCourse: (id) => set({ selectedCourseId: id }),
      addResource: (resource) => {
        const id = nanoid(10);
        set((state) => ({
          resources: [{ ...resource, id, addedAt: Date.now() }, ...state.resources],
        }));
        return id;
      },
      removeResource: (id) =>
        set((state) => ({ resources: state.resources.filter((resource) => resource.id !== id) })),
      toggleTeachingRole: (id) =>
        set((state) => ({
          teachingRoleIds: state.teachingRoleIds.includes(id)
            ? state.teachingRoleIds.filter((roleId) => roleId !== id)
            : [...state.teachingRoleIds, id],
        })),
      updateGuardrails: (changes) =>
        set((state) => ({ guardrails: { ...state.guardrails, ...changes } })),
      updateInstitution: (changes) =>
        set((state) => ({ institution: { ...state.institution, ...changes } })),
      configureIntegration: (id, changes) =>
        set((state) => ({
          integrations: {
            ...state.integrations,
            [id]: {
              ...state.integrations[id],
              ...changes,
              status: id === 'omitech-agent' ? 'connected' : 'configured',
              updatedAt: Date.now(),
            },
          },
        })),
      disconnectIntegration: (id) => {
        if (id === 'omitech-agent') return;
        set((state) => ({
          integrations: {
            ...state.integrations,
            [id]: {
              ...state.integrations[id],
              status: 'not_configured',
              endpoint: '',
              workspace: '',
            },
          },
        }));
      },
    }),
    {
      name: 'omitech-education-studio',
      version: 1,
      storage: createKVPersistStorage<EducationStudioState>('account', {
        onWriteRefused: () => recovery.rehydrate?.(),
      }),
    },
  ),
);

recovery.rehydrate = () => useEducationStudioStore.persist.rehydrate();
purgeLegacyPersistKey('omitech-education-studio');
