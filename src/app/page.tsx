import { redirect } from 'next/navigation';

// Infinity opens directly into Exam Pro's required sign-in / create-account screen.
// The games remain available as an in-exam break, without a separate games dashboard.
export default function Home() {
  redirect('/games/exam-prep/index.html');
}
