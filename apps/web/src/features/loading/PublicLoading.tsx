import styles from './PublicLoading.module.scss';

type PublicLoadingProps = {
  variant: 'landing' | 'auth';
};

function Block({ className }: { className: string }) {
  return <span className={`${styles.block} ${className}`} aria-hidden="true" />;
}

export function PublicLoading({ variant }: PublicLoadingProps) {
  if (variant === 'auth') {
    return (
      <main className={styles.authPage} aria-busy="true">
        <section className={styles.authStory} aria-hidden="true">
          <Block className={styles.badge} />
          <Block className={styles.authTitle} />
          <Block className={styles.authTitleShort} />
          <Block className={styles.authCopy} />
          <Block className={styles.authCopyShort} />
        </section>
        <section className={styles.authCard} aria-hidden="true">
          <Block className={styles.cardTitle} />
          <Block className={styles.cardCopy} />
          <Block className={styles.button} />
          <Block className={styles.divider} />
          <Block className={styles.field} />
          <Block className={styles.field} />
          <Block className={styles.button} />
        </section>
        <p className={styles.status} role="status">
          Loading account access…
        </p>
      </main>
    );
  }

  return (
    <main className={styles.landingPage} aria-busy="true">
      <section className={styles.landingHero} aria-hidden="true">
        <div>
          <Block className={styles.badge} />
          <Block className={styles.landingTitle} />
          <Block className={styles.landingTitleShort} />
          <Block className={styles.landingCopy} />
          <Block className={styles.landingCopyShort} />
          <Block className={styles.landingButton} />
        </div>
        <div className={styles.tripPreview}>
          <Block className={styles.previewHeader} />
          <Block className={styles.previewRow} />
          <Block className={styles.previewRow} />
          <Block className={styles.previewRowShort} />
        </div>
      </section>
      <p className={styles.status} role="status">
        Loading Wayfare…
      </p>
    </main>
  );
}
