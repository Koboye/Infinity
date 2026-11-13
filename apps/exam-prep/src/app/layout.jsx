import './globals.css';
import Header from '@/components/Header.jsx';

export const metadata = {
  title: 'ExamPrep — university exam & exit-exam practice',
  description: 'Practise past-style questions with full explanations for every university department, and rehearse your exit exam. 15 birr a month, or contribute questions.',
};
export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#3a21b8' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Header />
        <main className="wrap">{children}</main>
        <footer className="wrap hint">Sample questions are provided for practice. Always study your course materials too.</footer>
      </body>
    </html>
  );
}
