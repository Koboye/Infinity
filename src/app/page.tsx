import { redirect } from 'next/navigation';

// ExamPro is the public entry point. The original game engine remains available
// at /break, exclusively linked from the exam's Take a break picker.
export default function Home() {
  redirect('/games/exam-prep/index.html');
}
