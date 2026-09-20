import type { Metadata } from 'next';

import { TeachingHub } from '@/components/education/teaching-hub';

export const metadata: Metadata = {
  title: 'DMI Teaching Hub',
  description:
    'DMI Teaching Hub learning home: prepare semester lessons, syllabi, assessments, activities and DMI-branded PowerPoint decks.',
};

export default function HomePage() {
  return <TeachingHub />;
}
