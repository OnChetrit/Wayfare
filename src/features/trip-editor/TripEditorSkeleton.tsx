import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ListPlus,
  MapPin,
  Plus,
  Search,
  Settings2,
} from 'lucide-react';
import styles from './TripEditorSkeleton.module.scss';

type TripEditorSkeletonProps = {
  mode?: 'editor' | 'expenses';
};

function Line({ className = '' }: { className?: string }) {
  return <span className={`${styles.line} ${className}`} aria-hidden="true" />;
}

export function TripEditorSkeleton({ mode = 'editor' }: TripEditorSkeletonProps) {
  const isExpenses = mode === 'expenses';

  return (
    <main className={styles.app} aria-busy="true">
      {!isExpenses && <DateBarSkeleton />}
      {isExpenses ? <ExpensesSkeleton /> : <EditorSkeleton />}
      <p className={styles.status} role="status">
        Loading {isExpenses ? 'expenses' : 'your trip'}…
      </p>
    </main>
  );
}

function DateBarSkeleton() {
  return (
    <section className={styles.dateBar} aria-label="Loading trip dates">
      <button type="button" className={styles.dateNavButton} aria-label="Previous dates" disabled>
        <ChevronLeft size={17} />
      </button>
      <div className={styles.dateViews} aria-hidden="true">
        <div className={styles.locationRow}>
          {Array.from({ length: 3 }, (_, index) => (
            <button type="button" className={styles.locationCard} disabled key={index}>
              <Line className={styles.locationText} />
            </button>
          ))}
        </div>
        <div className={styles.dateTabs}>
          {Array.from({ length: 5 }, (_, index) => (
            <button type="button" className={styles.dateTab} disabled key={index}>
              <Line className={styles.dateWeekday} />
              <Line className={styles.dateNumber} />
            </button>
          ))}
        </div>
      </div>
      <button type="button" className={styles.expandButton} disabled>
        <CalendarDays size={15} /> <span>Timeline</span> <ChevronDown size={14} />
      </button>
      <button type="button" className={styles.dateNavButton} aria-label="Next dates" disabled>
        <ChevronRight size={17} />
      </button>
    </section>
  );
}

function EditorSkeleton() {
  return (
    <div className={styles.editorWorkspace}>
      <aside className={styles.sidePanel} aria-label="Loading day plan">
        <div className={styles.sidePanelHeader}>
          <h2>Your day</h2>
          <button type="button" className={styles.roundButton} disabled aria-label="Add activity">
            <Plus size={17} />
          </button>
        </div>
        <div className={styles.rowList} aria-hidden="true">
          {Array.from({ length: 5 }, (_, index) => (
            <ListRow key={index} />
          ))}
        </div>
      </aside>
      <section className={styles.mapPanel} aria-label="Map">
        <div className={styles.mapLabel}>
          <MapPin size={15} /> Map
        </div>
        <div className={styles.mapControls}>
          <button type="button" disabled aria-label="Zoom in">
            +
          </button>
          <button type="button" disabled aria-label="Zoom out">
            −
          </button>
        </div>
      </section>
      <aside
        className={`${styles.sidePanel} ${styles.savedPlacesPanel}`}
        aria-label="Loading saved places"
      >
        <div className={styles.sidePanelHeader}>
          <h2>Saved places</h2>
          <button type="button" className={styles.roundButton} disabled aria-label="Import places">
            <ListPlus size={17} />
          </button>
        </div>
        <div className={styles.placesControls}>
          <div className={styles.placesSearch}>
            <Search size={15} aria-hidden="true" />
            <input
              type="search"
              placeholder="Search places"
              aria-label="Search saved places"
              disabled
            />
          </div>
          <button
            type="button"
            className={styles.placesFilterButton}
            aria-label="Place settings"
            disabled
          >
            <Settings2 size={16} />
          </button>
        </div>
        <div className={styles.rowList} aria-hidden="true">
          {Array.from({ length: 5 }, (_, index) => (
            <ListRow key={index} />
          ))}
        </div>
      </aside>
    </div>
  );
}

function ListRow() {
  return (
    <div className={styles.listRow}>
      <span className={styles.rowIcon} />
      <div>
        <Line className={styles.rowTitle} />
        <Line className={styles.rowDetail} />
      </div>
    </div>
  );
}

function ExpensesSkeleton() {
  return (
    <section className={styles.expensesWorkspace}>
      <div className={styles.expensesHero}>
        <div className={styles.expensesIntro}>
          <h1>What will this trip cost?</h1>
          <p>Keep hotels, flights, and every memorable stop in one place.</p>
        </div>
        <button type="button" className={styles.action} disabled>
          <Plus size={15} /> Add expense
        </button>
      </div>
      <div className={styles.summaryGrid} aria-label="Loading expense totals">
        <article className={`${styles.summaryCard} ${styles.summaryCardTotal}`}>
          <div className={styles.totalHeading}>
            <span>Total trip cost</span>
            <Line className={styles.totalCount} />
          </div>
          <Line className={styles.totalValue} />
          <Line className={styles.totalSubValue} />
          <small>Totals are grouped by currency</small>
        </article>
        <SummaryCard label="Flights" detail="Flights and transfers" />
        <SummaryCard label="Stays" detail="Hotels and accommodation" />
        <SummaryCard label="Activities" detail="Food, tickets, shopping & more" />
      </div>
      <div className={styles.contentGrid}>
        <section className={styles.expenseListCard} aria-label="Loading expense list">
          <div className={styles.listHeader}>
            <div>
              <h2>All expenses</h2>
            </div>
            <button type="button" className={styles.filterButton} disabled>
              All categories
            </button>
          </div>
          <div className={styles.expenseRows} aria-hidden="true">
            {Array.from({ length: 5 }, (_, index) => (
              <div className={styles.expenseRow} key={index}>
                <span className={styles.rowIcon} />
                <div className={styles.expenseCopy}>
                  <Line className={styles.rowTitle} />
                  <Line className={styles.rowDetail} />
                </div>
                <Line className={styles.amount} />
              </div>
            ))}
          </div>
        </section>
        <aside className={styles.categoryCard} aria-label="Loading expense categories">
          <h2>Expense categories</h2>
          <div className={styles.categoryRows}>
            {['Flights', 'Stays', 'Activities', 'Other'].map(label => (
              <div className={styles.categoryRow} key={label}>
                <span>{label}</span>
                <Line className={styles.categoryValue} />
              </div>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}

function SummaryCard({ label, detail }: { label: string; detail: string }) {
  return (
    <article className={styles.summaryCard}>
      <span>{label}</span>
      <Line className={styles.summaryValue} />
      <small>{detail}</small>
    </article>
  );
}
