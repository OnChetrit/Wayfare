import Link from 'next/link';
import {
  ArrowRight,
  CalendarDays,
  Check,
  CircleDollarSign,
  Clock3,
  Compass,
  Heart,
  MapPin,
  Route,
} from 'lucide-react';

import { LandingMotion } from './LandingMotion';
import styles from './LandingPage.module.scss';

const tripDays = [
  { day: '08', place: 'Le Marais', detail: 'Morning walk', active: true },
  { day: '09', place: 'Montmartre', detail: 'Gallery afternoon' },
  { day: '10', place: 'Canal Saint-Martin', detail: 'Dinner with friends' },
];

const benefits = [
  {
    icon: MapPin,
    title: 'A map that remembers for you',
    description:
      'Collect cafés, museums, neighborhoods, and every “we should go here” without losing the context that made you save them.',
  },
  {
    icon: Route,
    title: 'Plans that work with your day',
    description:
      'Move places into an easy visual itinerary and see how each day is coming together before you leave home.',
  },
  {
    icon: CircleDollarSign,
    title: 'The practical details, too',
    description:
      'Keep stays, flights, and shared expenses beside your plan, so the important information is always where you need it.',
  },
];

export function LandingPage() {
  return (
    <LandingMotion>
      <main className={styles.page}>
        <section className={styles.hero}>
          <div className={styles.copy}>
            <h1>
              <span data-hero-title>Make room for</span>
              <span data-hero-title>the good parts</span>
              <span data-hero-title>of your trip.</span>
            </h1>
            <p className={styles.intro} data-hero-intro>
              Wayfare brings your places, days, and little details together, so planning feels as
              good as getting there.
            </p>
            <div className={styles.actions} data-hero-actions>
              <Link href="/login" className={styles.primaryAction}>
                Start planning <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <p>No spreadsheets. No pressure.</p>
            </div>
          </div>

          <div
            className={styles.tripPreview}
            aria-label="A preview of a Paris trip itinerary"
            data-trip-preview
          >
            <div className={styles.previewGlow} data-preview-glow aria-hidden="true" />
            <div className={styles.mapBlob} data-map-blob />
            <div className={styles.previewHeader} data-preview-header>
              <div>
                <p>YOUR NEXT TRIP</p>
                <h2>Paris, France</h2>
              </div>
              <span className={styles.dateChip}>
                <CalendarDays size={15} aria-hidden="true" /> Sep 8–12
              </span>
            </div>

            <div className={styles.route}>
              <span className={styles.routeLine} data-route-line />
              {tripDays.map(item => (
                <div className={styles.day} key={item.day} data-trip-day>
                  <span className={`${styles.dayNumber} ${item.active ? styles.dayActive : ''}`}>
                    {item.day}
                  </span>
                  <div>
                    <strong>{item.place}</strong>
                    <span>{item.detail}</span>
                  </div>
                  {item.active && <MapPin className={styles.pin} size={19} aria-hidden="true" />}
                  {item.active && <span className={styles.previewOrbit} data-preview-orbit />}
                </div>
              ))}
            </div>

            <div className={styles.previewFooter} data-preview-footer>
              <span>3 places saved</span>
              <span>·</span>
              <span>2 days planned</span>
            </div>
          </div>
        </section>

        <section className={styles.promises} aria-label="What Wayfare helps you do">
          <article data-reveal>
            <span className={styles.promiseIcon}>
              <MapPin size={19} aria-hidden="true" />
            </span>
            <h2>Keep every place close</h2>
            <p>Save the spots that catch your eye and give each one a home on your map.</p>
          </article>
          <article data-reveal>
            <span className={styles.promiseIcon}>
              <CalendarDays size={19} aria-hidden="true" />
            </span>
            <h2>Let days take shape</h2>
            <p>Arrange plans around your own pace, with room for spontaneous detours.</p>
          </article>
          <article data-reveal>
            <span className={styles.promiseIcon}>
              <Compass size={19} aria-hidden="true" />
            </span>
            <h2>Travel with clarity</h2>
            <p>See the whole picture at a glance, from the first saved pin to the last meal.</p>
          </article>
        </section>

        <section className={styles.details}>
          <div className={styles.detailsIntro} data-reveal>
            <h2>A trip planner that leaves room for the trip itself.</h2>
            <p>
              Most travel plans begin in a tangle of tabs, saved posts, and group-chat messages.
              Wayfare gives those ideas a shared home—then helps you turn them into days that feel
              natural, not overbooked.
            </p>
          </div>

          <div className={styles.benefitList}>
            {benefits.map(({ icon: Icon, title, description }) => (
              <article key={title} data-reveal>
                <span className={styles.benefitIcon}>
                  <Icon size={21} aria-hidden="true" />
                </span>
                <div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.closing} data-reveal>
          <div className={styles.closingGlow} aria-hidden="true" />
          <div className={styles.closingCopy}>
            <h2>Spend less time organizing, and more time looking forward.</h2>
            <p>
              Start with one place you’re excited about. Wayfare will help you build the rest from
              there.
            </p>
            <Link href="/login" className={styles.secondaryAction}>
              Start your trip <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
          <div className={styles.closingReasons}>
            <span>
              <Check size={17} aria-hidden="true" /> Keep your favorite places in one view
            </span>
            <span>
              <Clock3 size={17} aria-hidden="true" /> Shape the plan as your trip takes shape
            </span>
            <span>
              <Heart size={17} aria-hidden="true" /> Make space for spontaneous moments
            </span>
          </div>
          <div className={styles.closingVisual} aria-hidden="true">
            <span className={styles.closingRoute} />
            <span className={styles.closingStop}>08</span>
            <span className={styles.closingPin} data-closing-pin>
              <MapPin size={22} strokeWidth={2.4} />
            </span>
            <strong>Paris</strong>
            <small>One good plan at a time</small>
          </div>
        </section>

        <footer className={styles.footer} data-reveal>
          <div className={styles.footerBrand}>
            <Link href="/" className={styles.footerLogo}>
              <Compass size={17} strokeWidth={2.5} aria-hidden="true" /> wayfare
            </Link>
            <p>Thoughtful tools for independently minded travelers.</p>
          </div>
          <div className={styles.footerAction}>
            <span>Ready when your next idea arrives.</span>
            <Link href="/login">
              Sign in <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
          <div className={styles.footerBase}>
            <span>© 2026 Wayfare</span>
            <span>Made for the good parts.</span>
          </div>
        </footer>
      </main>
    </LandingMotion>
  );
}
