import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'VocabMaster | IELTS Spaced Repetition & Active Recall',
  description: 'VocabMaster helps IELTS learners acquire, retain, and actively use vocabulary with spaced repetition and active recall.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
