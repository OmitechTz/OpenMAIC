import type { Metadata } from 'next';

import { TeachingHub } from '@/components/education/teaching-hub';

export const metadata: Metadata = {
  title: 'DMI Teaching Hub',
  description:
    'Dar es Salaam Maritime Institute teaching hub: prepare semester lessons, syllabi, assessments, activities and DMI-branded PowerPoint decks.',
};

export default function TeachPage() {
  return <TeachingHub />;
}
