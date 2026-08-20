import { useSyncExternalStore } from 'react';

import type { AccountProfile } from '@/shared/api/authApi';

export type SessionStatus = 'booting' | 'guest' | 'authenticated' | 'password_change';

export interface SessionSnapshot {
  status: SessionStatus;
  accessToken: string | null;
  profile: AccountProfile | null;
}

export interface SessionStore {
  getSnapshot(): SessionSnapshot;
  subscribe(listener: () => void): () => void;
  setAccessToken(accessToken: string | null, status?: SessionStatus): void;
  setProfile(profile: AccountProfile | null): void;
  clear(): void;
}

export function createSessionStore(): SessionStore {
  let snapshot: SessionSnapshot = { status: 'booting', accessToken: null, profile: null };
  const listeners = new Set<() => void>();
  const publish = () => listeners.forEach((listener) => listener());

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setAccessToken: (accessToken, status = accessToken ? 'authenticated' : 'guest') => {
      snapshot = { ...snapshot, accessToken, status, profile: status === 'authenticated' ? snapshot.profile : null };
      publish();
    },
    setProfile: (profile) => {
      snapshot = { ...snapshot, profile, status: profile ? 'authenticated' : snapshot.status };
      publish();
    },
    clear: () => {
      snapshot = { status: 'guest', accessToken: null, profile: null };
      publish();
    },
  };
}

export function useSessionSnapshot(store: SessionStore) {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
