/**
 * Browser-side session state. This is convenience only: the Worker checks the
 * session on every protected request, so the login screen is not a security boundary.
 * The token lives in sessionStorage (cleared when the tab closes).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { SessionUser } from '../../shared/api';
import { ApiClientError, api } from '../api/client';
import type { ClientErrorCode } from '../i18n/dictionaries';

const STORAGE_KEY = 'turanslate.session';

interface StoredSession {
  token: string;
  user: SessionUser;
}

export type AuthState =
  | { status: 'checking' }
  | { status: 'signedOut'; notice: ClientErrorCode | null }
  | { status: 'signedIn'; token: string; user: SessionUser };

interface AuthValue {
  state: AuthState;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Runs an authenticated call; a 401 signs the user out with a "session expired" notice. */
  withSession: <T>(call: (token: string) => Promise<T>) => Promise<T>;
}

const AuthContext = createContext<AuthValue | null>(null);

function readStored(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    return typeof parsed.token === 'string' && parsed.user ? (parsed as StoredSession) : null;
  } catch {
    return null;
  }
}

function writeStored(session: StoredSession | null): void {
  try {
    if (session) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Without storage the session simply lasts until reload.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() =>
    readStored() ? { status: 'checking' } : { status: 'signedOut', notice: null },
  );

  // Revalidate a stored token once on load; the server is the source of truth.
  useEffect(() => {
    const stored = readStored();
    if (!stored) return;
    let cancelled = false;
    api
      .me(stored.token)
      .then(({ user }) => {
        if (cancelled) return;
        writeStored({ token: stored.token, user });
        setState({ status: 'signedIn', token: stored.token, user });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const expired = error instanceof ApiClientError && error.status === 401;
        if (expired) writeStored(null);
        setState({
          status: 'signedOut',
          notice: error instanceof ApiClientError ? error.code : 'network_error',
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    const { token, user } = await api.login(username, password);
    writeStored({ token, user });
    setState({ status: 'signedIn', token, user });
  }, []);

  const signOut = useCallback(async () => {
    const stored = readStored();
    writeStored(null);
    setState({ status: 'signedOut', notice: null });
    if (stored) await api.logout(stored.token).catch(() => undefined);
  }, []);

  const withSession = useCallback(async <T,>(call: (token: string) => Promise<T>) => {
    const stored = readStored();
    if (!stored) {
      setState({ status: 'signedOut', notice: 'unauthorized' });
      throw new ApiClientError('unauthorized', 401);
    }
    try {
      return await call(stored.token);
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        writeStored(null);
        setState({ status: 'signedOut', notice: 'unauthorized' });
      }
      throw error;
    }
  }, []);

  const value = useMemo(
    () => ({ state, signIn, signOut, withSession }),
    [state, signIn, signOut, withSession],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}
