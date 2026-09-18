import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Omitech Learning Studio',
    short_name: 'Learning Studio',
    description: 'Semester learning materials, assessments and student progress.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#12345b',
    icons: [
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  };
}
