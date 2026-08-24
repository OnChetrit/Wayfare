'use client';

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { EditorNavigation } from './EditorNavigation';
import { TripHeader } from './TripHeader';
import styles from './TripHeaderLayout.module.scss';
import type {
  EditorMode,
  TripEditorTrip,
  TripEditorUser,
  TripSummary,
  WorkspaceView,
} from './types';

type HeaderData = {
  user: TripEditorUser;
  trip: TripEditorTrip | null;
  trips: TripSummary[];
};

type HeaderActions = {
  onOpenAccount: () => void;
  onOpenSettings?: () => void;
};

type MobileNavigation = {
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
};

type TripHeaderLayoutContextValue = {
  setHeaderData: (header: HeaderData) => void;
  setHeaderActions: (actions: HeaderActions) => void;
  setMobileNavigation: (navigation: MobileNavigation) => void;
  workspaceView: WorkspaceView;
  setWorkspaceView: (view: WorkspaceView) => void;
};

const TripHeaderLayoutContext = createContext<TripHeaderLayoutContextValue | null>(null);

function sameHeaderData(current: HeaderData | null, next: HeaderData) {
  if (!current) return false;
  if (
    current.user.id !== next.user.id ||
    current.user.name !== next.user.name ||
    current.user.email !== next.user.email ||
    current.trip?.id !== next.trip?.id ||
    current.trip?.name !== next.trip?.name ||
    current.trip?.destinationLabel !== next.trip?.destinationLabel ||
    current.trip?.startDate !== next.trip?.startDate ||
    current.trip?.endDate !== next.trip?.endDate ||
    current.trips.length !== next.trips.length
  ) {
    return false;
  }

  return current.trips.every((trip, index) => {
    const nextTrip = next.trips[index];
    return (
      trip.id === nextTrip?.id &&
      trip.name === nextTrip.name &&
      trip.destinationLabel === nextTrip.destinationLabel &&
      trip.startDate === nextTrip.startDate &&
      trip.endDate === nextTrip.endDate
    );
  });
}

export function TripHeaderLayout({ children }: { children: React.ReactNode }) {
  const actionsRef = useRef<HeaderActions | null>(null);
  const mobileNavigationRef = useRef<MobileNavigation['onModeChange'] | null>(null);
  const [headerData, setHeaderData] = useState<HeaderData | null>(null);
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('map');
  // The workspace layout also wraps the new-trip and loading states, before TripEditor
  // can register its navigation callbacks. Start with the default editor mode so the
  // mobile bar remains part of that shared shell throughout the transition.
  const [mobileNavigationMode, setMobileNavigationMode] = useState<EditorMode>('map');
  const registerHeaderData = useCallback((nextHeader: HeaderData) => {
    setHeaderData(current => (sameHeaderData(current, nextHeader) ? current : nextHeader));
  }, []);
  const registerHeaderActions = useCallback((actions: HeaderActions) => {
    actionsRef.current = actions;
  }, []);
  const registerMobileNavigation = useCallback((navigation: MobileNavigation) => {
    mobileNavigationRef.current = navigation.onModeChange;
    setMobileNavigationMode(current => (current === navigation.mode ? current : navigation.mode));
  }, []);

  const value = useMemo<TripHeaderLayoutContextValue>(
    () => ({
      setHeaderData: registerHeaderData,
      setHeaderActions: registerHeaderActions,
      setMobileNavigation: registerMobileNavigation,
      workspaceView,
      setWorkspaceView,
    }),
    [registerHeaderActions, registerHeaderData, registerMobileNavigation, workspaceView],
  );

  return (
    <TripHeaderLayoutContext.Provider value={value}>
      <div className={styles.workspaceShell}>
        <TripHeader
          user={headerData?.user}
          trip={headerData?.trip}
          trips={headerData?.trips}
          isLoading={!headerData}
          onOpenAccount={() => actionsRef.current?.onOpenAccount()}
          onOpenSettings={() => actionsRef.current?.onOpenSettings?.()}
          workspaceView={workspaceView}
          onWorkspaceViewChange={setWorkspaceView}
        />
        {children}
        <EditorNavigation
          mode={mobileNavigationMode}
          onModeChange={mode => {
            setMobileNavigationMode(mode);
            mobileNavigationRef.current?.(mode);
          }}
          onOpenSettings={() => actionsRef.current?.onOpenSettings?.()}
        />
      </div>
    </TripHeaderLayoutContext.Provider>
  );
}

export function useTripHeaderLayout(header: HeaderData & HeaderActions & MobileNavigation) {
  const context = useContext(TripHeaderLayoutContext);
  if (!context) {
    throw new Error('useTripHeaderLayout must be used inside TripHeaderLayout.');
  }
  const { setHeaderData, setHeaderActions, setMobileNavigation, setWorkspaceView, workspaceView } =
    context;

  useLayoutEffect(() => {
    setHeaderData({ user: header.user, trip: header.trip, trips: header.trips });
  }, [header.trip, header.trips, header.user, setHeaderData]);

  useLayoutEffect(() => {
    setHeaderActions({
      onOpenAccount: header.onOpenAccount,
      onOpenSettings: header.onOpenSettings,
    });
  }, [header.onOpenAccount, header.onOpenSettings, setHeaderActions]);

  useLayoutEffect(() => {
    setMobileNavigation({ mode: header.mode, onModeChange: header.onModeChange });
  }, [header.mode, header.onModeChange, setMobileNavigation]);

  return {
    workspaceView,
    setWorkspaceView,
  };
}
