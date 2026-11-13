'use client';
import Link from 'next/link';
import { useUser, signOut } from '@/lib/firebase.js';

export default function Header() {
  const { user } = useUser();
  return (
    <header className="top">
      <div className="wrap">
        <Link href="/" className="brand">📚 ExamPrep</Link>
        <nav>
          <Link href="/contribute">Contribute</Link>
          <Link href="/account">{user ? 'My account' : 'Sign in'}</Link>
          {user && <button className="btn sm alt" style={{ color: '#fff', borderColor: '#fff' }} onClick={() => signOut()}>Sign out</button>}
        </nav>
      </div>
    </header>
  );
}
