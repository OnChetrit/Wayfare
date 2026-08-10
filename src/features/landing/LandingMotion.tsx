'use client';

import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useRef, type ReactNode } from 'react';

gsap.registerPlugin(useGSAP, ScrollTrigger);

export function LandingMotion({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const select = gsap.utils.selector(root);
      const media = gsap.matchMedia();

      media.add(
        {
          motionAllowed: '(prefers-reduced-motion: no-preference)',
        },
        context => {
          if (!context.conditions?.motionAllowed) return;

          const intro = gsap.timeline({
            defaults: { duration: 0.72, ease: 'power3.out' },
          });

          intro
            .addLabel('arrival', 0)
            .addLabel('story', 'arrival+=0.26')
            .to(
              select('[data-hero-title]'),
              { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.12 },
              'story',
            )
            .to(select('[data-hero-intro]'), { autoAlpha: 1, y: 0, duration: 0.58 }, 'story+=0.34')
            .to(
              select('[data-hero-actions]'),
              { autoAlpha: 1, y: 0, scale: 1, duration: 0.52 },
              'story+=0.48',
            )
            .addLabel('itinerary', 'story+=0.16')
            .to(
              select('[data-trip-preview]'),
              {
                autoAlpha: 1,
                y: 0,
                rotationY: 0,
                rotation: 0,
                scale: 1,
                duration: 1.05,
              },
              'itinerary',
            )
            .to(
              select('[data-preview-glow]'),
              { autoAlpha: 1, scale: 1, duration: 0.9 },
              'itinerary+=0.08',
            )
            .to(
              select('[data-preview-header]'),
              { autoAlpha: 1, y: 0, duration: 0.52 },
              'itinerary+=0.34',
            )
            .to(select('[data-route-line]'), { scaleY: 1, duration: 0.62 }, 'itinerary+=0.48')
            .to(
              select('[data-trip-day]'),
              { autoAlpha: 1, x: 0, duration: 0.54, stagger: 0.11 },
              'itinerary+=0.57',
            )
            .to(
              select('[data-preview-footer]'),
              { autoAlpha: 1, y: 0, duration: 0.42 },
              'itinerary+=0.92',
            )
            .addLabel('settle', 'itinerary+=1.12')
            .add(
              gsap
                .timeline({ repeat: -1, yoyo: true, repeatDelay: 0.2 })
                .to(select('[data-trip-preview]'), { y: -7, duration: 3.2, ease: 'sine.inOut' }),
              'settle+=0.22',
            )
            .add(
              gsap
                .timeline({ repeat: -1, repeatDelay: 1.4 })
                .fromTo(
                  select('[data-preview-orbit]'),
                  { autoAlpha: 0.85, scale: 0.55 },
                  { autoAlpha: 0, scale: 1.75, duration: 1.7, ease: 'power2.out' },
                ),
              'settle+=0.28',
            );

          gsap.to(select('[data-logo-mark]'), {
            rotation: 360,
            duration: 20,
            ease: 'none',
            repeat: -1,
          });

          gsap.to(select('[data-map-blob]'), {
            rotation: -8,
            x: -7,
            y: 12,
            duration: 4.8,
            ease: 'sine.inOut',
            repeat: -1,
            yoyo: true,
          });

          select('[data-reveal]').forEach(element => {
            gsap.to(element, {
              autoAlpha: 1,
              y: 0,
              duration: 0.68,
              ease: 'power3.out',
              scrollTrigger: {
                trigger: element,
                start: 'top 88%',
                once: true,
              },
            });
          });

          gsap.to(select('[data-closing-pin]'), {
            y: -7,
            duration: 1.8,
            ease: 'sine.inOut',
            repeat: -1,
            yoyo: true,
          });
        },
      );

      return () => media.revert();
    },
    { scope: root },
  );

  return <div ref={root}>{children}</div>;
}
