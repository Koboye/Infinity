'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser, signOut } from '@/lib/firebase.js';
const items=[['/','⌂','Home'],['/levels','▦','Subjects'],['/progress','▥','Progress'],['/plan','☑','Plan'],['/profile','◉','Profile']];
export default function Header(){const {user}=useUser();const pathname=usePathname();return <><header className="top ep-top"><div className="wrap"><Link href="/" className="brand">🎓 Exam<span>Pro</span></Link><nav><Link href="/levels">Subjects</Link><Link href="/plan">Study plan</Link><Link href="/account">{user?'My account':'Sign in'}</Link>{user&&<button className="btn sm alt" style={{color:'#fff',borderColor:'#fff'}} onClick={()=>signOut()}>Sign out</button>}</nav></div></header><nav className="ep-bottom-nav" aria-label="Main navigation">{items.map(([href,icon,label])=><Link key={href} href={href} aria-current={pathname===href?'page':undefined}><span aria-hidden="true">{icon}</span><small>{label}</small></Link>)}</nav></>}
