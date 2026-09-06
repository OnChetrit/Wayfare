'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowUpRight } from 'lucide-react';

import { WayfareLogoIcon } from '@/components/wayfare-logo-icon';

import styles from './PublicLayout.module.scss';

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === '/login';
  const isSignup = pathname === '/signup';
  const prompt = isLogin
    ? { text: 'New to Wayfare?', href: '/signup', action: 'Create an account' }
    : isSignup
      ? { text: 'Already planning with us?', href: '/login', action: 'Sign in' }
      : { text: 'Ready to plan?', href: '/login', action: 'Sign in' };

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="Wayfare home">
          <span className={styles.brandMark}>
            <WayfareLogoIcon strokeWidth={2.6} />
          </span>
          <span>wayfare</span>
        </Link>
        <p className={styles.prompt}>
          <span>{prompt.text}</span>
          <Link href={prompt.href}>
            {prompt.action} <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        </p>
      </header>
      {children}
    </div>
  );
}
