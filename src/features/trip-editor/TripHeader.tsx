'use client';

import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  Compass,
  List,
  Map,
  Menu,
  Pencil,
  Plus,
  Settings2,
  WalletCards,
  X,
} from 'lucide-react';
import styles from './TripHeader.module.scss';
import type { TripEditorTrip, TripEditorUser, TripSummary, WorkspaceView } from './types';
import { useClickOutside } from './use-click-outside';

type TripHeaderProps = {
  user?: TripEditorUser;
  trip?: TripEditorTrip | null;
  trips?: TripSummary[];
  isLoading?: boolean;
  onOpenAccount?: () => void;
  onOpenSettings?: () => void;
  workspaceView?: WorkspaceView;
  onWorkspaceViewChange?: (view: WorkspaceView) => void;
};

function formatDateRange(trip: Pick<TripEditorTrip, 'startDate' | 'endDate'> | null) {
  if (!trip) return 'Start planning your next adventure';
  const format = (value: string) =>
    new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
      new Date(`${value}T12:00:00Z`),
    );
  return `${format(trip.startDate)}—${format(trip.endDate)}`;
}

function initials(user: TripEditorUser) {
  return user.name
    .split(/\s+/)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function TripHeader({
  user,
  trip,
  trips,
  isLoading = false,
  onOpenAccount,
  onOpenSettings,
  workspaceView,
  onWorkspaceViewChange,
}: TripHeaderProps) {
  const pathname = usePathname();
  const [tripsOpen, setTripsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileMenuMounted, setMobileMenuMounted] = useState(false);
  const topbarRef = useRef<HTMLElement>(null);
  const mobileMenuBackdropRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const tripHeadingRef = useRef<HTMLDivElement>(null);
  const destination = trip?.name ?? trip?.destinationLabel ?? 'Your next adventure';
  const accountLabel = user ? `${user.name}${user.email ? ` · ${user.email}` : ''}` : 'Account';
  const newTripHref = trip ? `/editor?new=1&trip=${encodeURIComponent(trip.id)}` : '/editor?new=1';
  const editorHref = trip ? `/editor?trip=${encodeURIComponent(trip.id)}` : '/editor';
  const expensesHref = trip ? `/expenses?trip=${encodeURIComponent(trip.id)}` : '/expenses';
  const isExpensesRoute = pathname === '/expenses';

  useClickOutside(topbarRef, closeMobileMenu, mobileMenuOpen);
  useClickOutside(tripHeadingRef, () => setTripsOpen(false), tripsOpen);

  function closeMobileMenu() {
    setMobileMenuOpen(false);
    setTripsOpen(false);
  }

  function toggleMobileMenu() {
    if (mobileMenuOpen) {
      closeMobileMenu();
      return;
    }

    setMobileMenuMounted(true);
    setMobileMenuOpen(true);
  }

  useGSAP(
    () => {
      const menu = mobileMenuRef.current;
      const backdrop = mobileMenuBackdropRef.current;
      if (!menu || !backdrop || !mobileMenuMounted) return;

      const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 0.28;

      if (!mobileMenuOpen) {
        gsap
          .timeline({
            defaults: { duration, ease: 'power2.in' },
            onComplete: () => setMobileMenuMounted(false),
          })
          .to(backdrop, { autoAlpha: 0 }, 0)
          .to(menu, { autoAlpha: 0, y: -12, scale: 0.98 }, 0);
        return;
      }

      const select = gsap.utils.selector(menu);
      gsap
        .timeline({ defaults: { ease: 'power3.out' } })
        .fromTo(backdrop, { autoAlpha: 0 }, { autoAlpha: 1, duration: duration * 0.7 })
        .fromTo(
          menu,
          { autoAlpha: 0, y: -12, scale: 0.98 },
          { autoAlpha: 1, y: 0, scale: 1, duration },
          0,
        )
        .fromTo(
          select('[data-mobile-menu-item]'),
          { autoAlpha: 0, y: -6 },
          { autoAlpha: 1, y: 0, duration: duration * 0.75, stagger: 0.04 },
          duration * 0.25,
        );
    },
    {
      dependencies: [mobileMenuMounted, mobileMenuOpen],
      scope: topbarRef,
      revertOnUpdate: true,
    },
  );

  return (
    <header ref={topbarRef} className={styles.topbar} data-enter>
      <div className={styles.brand}>
        <span className={styles.brandMark}>
          <Compass size={17} strokeWidth={2.5} />
        </span>
        <span>wayfare</span>
      </div>
      {mobileMenuMounted && (
        <button
          ref={mobileMenuBackdropRef}
          type="button"
          className={styles.mobileMenuBackdrop}
          onClick={closeMobileMenu}
          tabIndex={-1}
          aria-label="Close trip menu"
        />
      )}
      <div
        ref={mobileMenuRef}
        id="mobile-header-menu"
        className={`${styles.headerOptions} ${mobileMenuMounted ? styles.headerOptionsOpen : ''}`}
        aria-label="Trip options"
        aria-hidden={mobileMenuMounted && !mobileMenuOpen ? true : undefined}
      >
        <div ref={tripHeadingRef} className={styles.tripHeading} data-mobile-menu-item>
          {isLoading ? (
            <div className={styles.tripLoading} aria-label="Loading trip selection">
              <span className={styles.tripSelectorSkeleton} />
            </div>
          ) : (
            <>
              <button
                type="button"
                className={styles.tripSelector}
                onClick={() => setTripsOpen(open => !open)}
                aria-expanded={tripsOpen}
                aria-haspopup="menu"
              >
                <span className={styles.tripTitle}>
                  {destination} <span className={styles.tripDot}>·</span>{' '}
                  {formatDateRange(trip ?? null)}
                </span>
                <ChevronDown size={15} />
              </button>
              {tripsOpen && (
                <div className={styles.tripsMenu} role="menu" aria-label="Your trips">
                  <div className={styles.tripsMenuHeader}>
                    <span>Your trips</span>
                    <span>{trips?.length ?? 0}</span>
                  </div>
                  <div className={styles.tripsList}>
                    {trips?.length ? (
                      trips.map(item => (
                        <Link
                          key={item.id}
                          className={`${styles.tripOption} ${item.id === trip?.id ? styles.tripOptionActive : ''}`}
                          href={`/editor?trip=${encodeURIComponent(item.id)}`}
                          role="menuitem"
                          onClick={closeMobileMenu}
                        >
                          <span className={styles.tripOptionCopy}>
                            <strong>{item.destinationLabel ?? item.name}</strong>
                            <small>{formatDateRange(item)}</small>
                          </span>
                          {item.id === trip?.id && <Check size={15} />}
                        </Link>
                      ))
                    ) : (
                      <p className={styles.noTrips}>No trips yet.</p>
                    )}
                  </div>
                  <Link className={styles.newTripLink} href={newTripHref} onClick={closeMobileMenu}>
                    <Plus size={15} /> Add another trip
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
        {!isExpensesRoute && workspaceView && onWorkspaceViewChange && (
          <div
            className={styles.workspaceViewToggle}
            role="group"
            aria-label="Workspace view"
            data-mobile-menu-item
          >
            <button
              type="button"
              className={workspaceView === 'map' ? styles.workspaceViewActive : ''}
              onClick={() => {
                onWorkspaceViewChange('map');
                closeMobileMenu();
              }}
              aria-pressed={workspaceView === 'map'}
              title="Map view"
            >
              <Map size={13} /> <span>Map</span>
            </button>
            <button
              type="button"
              className={workspaceView === 'timeline' ? styles.workspaceViewActive : ''}
              onClick={() => {
                onWorkspaceViewChange('timeline');
                closeMobileMenu();
              }}
              aria-pressed={workspaceView === 'timeline'}
              title="Timeline view"
            >
              <List size={13} /> <span>Timeline</span>
            </button>
          </div>
        )}
        <div className={styles.topActions} data-mobile-menu-item>
          <Link className={styles.newTripButton} href={newTripHref} onClick={closeMobileMenu}>
            <Plus size={15} /> <span>New trip</span>
          </Link>
          <Link
            className={`${styles.iconButton} ${styles.mobileMenuExcluded} ${!isExpensesRoute ? styles.iconButtonActive : ''}`}
            href={editorHref}
            onClick={closeMobileMenu}
            aria-label="Trip editor"
            aria-current={!isExpensesRoute ? 'page' : undefined}
            title="Trip editor"
          >
            <Pencil size={17} /> <span className={styles.actionLabel}>Editor</span>
          </Link>
          <Link
            className={`${styles.iconButton} ${styles.mobileMenuExcluded} ${isExpensesRoute ? styles.iconButtonActive : ''}`}
            href={expensesHref}
            onClick={closeMobileMenu}
            aria-label="Trip expenses"
            aria-current={isExpensesRoute ? 'page' : undefined}
            title="Trip expenses"
          >
            <WalletCards size={18} /> <span className={styles.actionLabel}>Expenses</span>
          </Link>
          <button
            type="button"
            className={`${styles.iconButton} ${styles.mobileMenuExcluded}`}
            onClick={() => {
              closeMobileMenu();
              onOpenSettings?.();
            }}
            disabled={isLoading}
            aria-label="Trip settings"
            title="Trip settings"
          >
            <Settings2 size={18} /> <span className={styles.actionLabel}>Settings</span>
          </button>
          {isLoading || !user ? (
            <span className={styles.avatarSkeleton} aria-label="Loading account" />
          ) : (
            <button
              type="button"
              className={styles.avatar}
              onClick={() => {
                closeMobileMenu();
                onOpenAccount?.();
              }}
              aria-label={accountLabel}
              title={accountLabel}
            >
              <span>{initials(user)}</span>
              <span className={styles.actionLabel}>{user.name}</span>
            </button>
          )}
        </div>
      </div>
      <button
        type="button"
        className={styles.mobileMenuButton}
        onClick={toggleMobileMenu}
        aria-expanded={mobileMenuOpen}
        aria-controls="mobile-header-menu"
        aria-label={mobileMenuOpen ? 'Close trip menu' : 'Open trip menu'}
      >
        {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
      </button>
    </header>
  );
}
