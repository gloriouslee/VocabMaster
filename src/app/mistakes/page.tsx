import { redirect } from 'next/navigation';

// The old Mistake Review bank was replaced by the actionable Weak Words page.
export default function MistakesPage() {
  redirect('/weak-words');
}
