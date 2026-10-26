import type { Metadata } from 'next';
import AdminAds from '@/components/AdminAds';

export const metadata: Metadata = { title: 'Ads · admin', robots: { index: false, follow: false } };
export default function Page() { return <AdminAds />; }
