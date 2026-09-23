'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from '@/lib/supabase/useSession';
import { supabaseBrowser } from '@/lib/supabase/browser';

const NAV = [
  { href: '/admin', label: 'Shops' },
  { href: '/admin/billing', label: 'Billing' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === '/admin/login') return <>{children}</>;

  if (session === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-base text-text-secondary text-sm">
        Loading…
      </div>
    );
  }
  if (session === null) {
    if (typeof window !== 'undefined') router.replace('/admin/login');
    return null;
  }

  const signOut = async () => {
    await supabaseBrowser().auth.signOut();
    router.replace('/admin/login');
  };

  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      <header className="border-b border-border bg-bg-elev1">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <span className="font-semibold text-accent">Altimate — Company Console</span>
            <nav className="flex gap-5 text-sm">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className={
                    pathname === n.href
                      ? 'text-accent font-medium'
                      : 'text-text-secondary hover:text-text-primary'
                  }
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <button onClick={signOut} className="text-sm text-text-secondary hover:text-text-primary">
            Sign out
          </button>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
