import type { Metadata } from 'next';
import './globals.scss';

export const metadata: Metadata = {
  title: 'Wayfare — Plan the good parts',
  description: 'A calm, map-first trip planner for self-organized travel.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          id="wayfare-theme-init"
          dangerouslySetInnerHTML={{
            __html: `
              (() => {
                try {
                  const saved = localStorage.getItem('wayfare-theme');
                  const dark = saved === 'dark' ||
                    (saved !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
                  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
                  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
                } catch {}
              })();
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
