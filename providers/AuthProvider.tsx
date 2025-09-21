import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  AuthTokens,
  confirmForgotPassword as confirmForgotPasswordService,
  confirmSignUp as confirmSignUpService,
  forgotPassword as forgotPasswordService,
  formatAuthenticationResult,
  globalSignOut,
  refreshSession,
  respondToNewPasswordChallenge,
  signIn as signInService,
  signUp as signUpService,
} from '../lib/cognitoAuth';

export type { AuthTokens } from '../lib/cognitoAuth';

export interface AuthUser {
  sub: string;
  email?: string;
  name?: string;
  givenName?: string;
  familyName?: string;
}

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

type SignInSuccess = { kind: 'success' };
type SignInChallenge = {
  kind: 'challenge';
  challenge: 'NEW_PASSWORD_REQUIRED';
  session: string;
  username: string;
};

export type SignInResult = SignInSuccess | SignInChallenge;

interface AuthContextValue {
  user: AuthUser | null;
  tokens: AuthTokens | null;
  status: AuthStatus;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<SignInResult>;
  completeNewPassword: (username: string, newPassword: string, session: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
  signUp: (username: string, password: string, email: string) => Promise<void>;
  confirmSignUp: (username: string, code: string) => Promise<void>;
  forgotPassword: (username: string) => Promise<void>;
  confirmForgotPassword: (username: string, code: string, newPassword: string) => Promise<void>;
  refreshTokens: (currentTokens?: AuthTokens | null) => Promise<void>;
}

const STORAGE_KEY = 'hakuba.auth.session';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const decodeBase64Url = (segment: string) => {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4;
  const padded =
    padding === 2
      ? `${normalized}==`
      : padding === 3
        ? `${normalized}=`
        : normalized;

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  let buffer = 0;
  let bitsCollected = 0;

  for (let i = 0; i < padded.length; i += 1) {
    const char = padded[i];
    if (char === '=') {
      break;
    }

    const value = chars.indexOf(char);

    if (value < 0) {
      throw new Error('Invalid base64 character encountered.');
    }

    buffer = (buffer << 6) | value;
    bitsCollected += 6;

    if (bitsCollected >= 8) {
      bitsCollected -= 8;
      const byte = (buffer >> bitsCollected) & 0xff;
      output += String.fromCharCode(byte);
    }
  }

  return output;
};

const parseJwtPayload = (token?: string | null): Record<string, unknown> | null => {
  if (!token) {
    return null;
  }

  const segments = token.split('.');
  if (segments.length < 2) {
    return null;
  }

  try {
    const decoded = decodeBase64Url(segments[1]);
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch (error) {
    console.warn('[Auth] Failed to decode id token payload', error);
    return null;
  }
};

const deriveUserFromIdToken = (idToken?: string | null): AuthUser | null => {
  const payload = parseJwtPayload(idToken);

  if (!payload) {
    return null;
  }

  const sub = typeof payload.sub === 'string' ? payload.sub : null;

  if (!sub) {
    return null;
  }

  const email = typeof payload.email === 'string' ? payload.email : undefined;
  const name =
    typeof payload.name === 'string'
      ? payload.name
      : typeof payload.preferred_username === 'string'
        ? payload.preferred_username
        : undefined;

  const givenName = typeof payload.given_name === 'string' ? payload.given_name : undefined;
  const familyName = typeof payload.family_name === 'string' ? payload.family_name : undefined;

  return {
    sub,
    email,
    name,
    givenName,
    familyName,
  };
};

const extractStoredRefreshToken = (raw: string | null): string | null => {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (typeof parsed === 'string' && parsed.length > 0) {
      return parsed;
    }

    if (parsed && typeof parsed === 'object') {
      const candidate = parsed as Record<string, unknown>;

      if (typeof candidate.refreshToken === 'string' && candidate.refreshToken.length > 0) {
        return candidate.refreshToken;
      }

      if (candidate.tokens && typeof (candidate.tokens as Record<string, unknown>).refreshToken === 'string') {
        const token = (candidate.tokens as Record<string, unknown>).refreshToken as string;
        return token.length > 0 ? token : null;
      }
    }
  } catch {
    if (raw.length > 0) {
      return raw;
    }
  }

  return null;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  const persistTokens = useCallback(async (nextTokens: AuthTokens) => {
    setTokens(nextTokens);
    setUser(deriveUserFromIdToken(nextTokens.idToken));

    if (nextTokens.refreshToken) {
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ refreshToken: nextTokens.refreshToken })
      );
    } else {
      await AsyncStorage.removeItem(STORAGE_KEY);
    }

    setStatus('authenticated');
  }, []);

  const clearSession = useCallback(async () => {
    clearRefreshTimer();
    setTokens(null);
    setUser(null);
    await AsyncStorage.removeItem(STORAGE_KEY);
    setStatus('unauthenticated');
  }, [clearRefreshTimer]);

  const applyAuthenticationResult = useCallback(
    async (result: AuthTokens | null, fallbackRefreshToken?: string) => {
      if (!result || !result.accessToken || !result.idToken) {
        throw new Error('Cognito authentication result did not include tokens');
      }

      const mergedTokens: AuthTokens = {
        ...result,
        refreshToken: result.refreshToken || fallbackRefreshToken || '',
      };

      if (!mergedTokens.refreshToken) {
        throw new Error('Missing refresh token from Cognito authentication response');
      }

      await persistTokens(mergedTokens);
    },
    [persistTokens],
  );

  const signOut = useCallback(async () => {
    try {
      if (tokens?.accessToken) {
        await globalSignOut(tokens.accessToken);
      }
    } catch (error) {
      console.warn('[Auth] Failed to sign out globally', error);
    } finally {
      await clearSession();
    }
  }, [tokens, clearSession]);

  const refreshTokens = useCallback(
    async (currentTokens?: AuthTokens | null) => {
      const activeTokens = currentTokens ?? tokens;

      if (!activeTokens?.refreshToken) {
        await clearSession();
        return;
      }

      try {
        const response = await refreshSession(activeTokens.refreshToken);
        const formatted = formatAuthenticationResult(response.AuthenticationResult);
        await applyAuthenticationResult(formatted, activeTokens.refreshToken);
      } catch (error) {
        console.warn('[Auth] Failed to refresh session', error);
        await clearSession();
        throw error;
      }
    },
    [tokens, applyAuthenticationResult, clearSession],
  );

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        const refreshToken = extractStoredRefreshToken(stored);

        if (!refreshToken) {
          setStatus('unauthenticated');
          return;
        }

        const response = await refreshSession(refreshToken);
        const formatted = formatAuthenticationResult(response.AuthenticationResult);
        await applyAuthenticationResult(formatted, refreshToken);
      } catch (error) {
        if (error) {
          console.warn('[Auth] Failed to bootstrap session', error);
        }
        await AsyncStorage.removeItem(STORAGE_KEY);
        setStatus('unauthenticated');
      }
    };

    void bootstrap();
  }, [applyAuthenticationResult]);

  useEffect(() => {
    clearRefreshTimer();

    if (!tokens?.expiresAt || !tokens.refreshToken) {
      return;
    }

    const now = Date.now();
    const delay = Math.max(tokens.expiresAt - now - 60_000, 5_000);

    refreshTimerRef.current = setTimeout(() => {
      void refreshTokens(tokens).catch(() => {
        // refreshTokens handles failure internally
      });
    }, delay);

    return clearRefreshTimer;
  }, [tokens, refreshTokens, clearRefreshTimer]);

  const signIn = useCallback(
    async (username: string, password: string): Promise<SignInResult> => {
      const response = await signInService(username, password);

      if (response.ChallengeName === 'NEW_PASSWORD_REQUIRED' && response.Session) {
        return {
          kind: 'challenge',
          challenge: 'NEW_PASSWORD_REQUIRED',
          session: response.Session,
          username,
        };
      }

      const formatted = formatAuthenticationResult(response.AuthenticationResult);
      await applyAuthenticationResult(formatted);
      return { kind: 'success' };
    },
    [applyAuthenticationResult],
  );

  const completeNewPassword = useCallback(
    async (username: string, newPassword: string, session: string): Promise<SignInResult> => {
      const response = await respondToNewPasswordChallenge(username, newPassword, session);
      const formatted = formatAuthenticationResult(response.AuthenticationResult);
      await applyAuthenticationResult(formatted);
      return { kind: 'success' };
    },
    [applyAuthenticationResult],
  );

  const signUp = useCallback(
    async (username: string, password: string, email: string) => {
      await signUpService(username, password, email);
    },
    [],
  );

  const confirmSignUp = useCallback(
    async (username: string, code: string) => {
      await confirmSignUpService(username, code);
    },
    [],
  );

  const forgotPassword = useCallback(
    async (username: string) => {
      await forgotPasswordService(username);
    },
    [],
  );

  const confirmForgotPassword = useCallback(
    async (username: string, code: string, newPassword: string) => {
      await confirmForgotPasswordService(username, code, newPassword);
    },
    [],
  );

  const value = useMemo(
    () => ({
      user,
      tokens,
      status,
      loading: status === 'loading',
      signIn,
      completeNewPassword,
      signOut,
      signUp,
      confirmSignUp,
      forgotPassword,
      confirmForgotPassword,
      refreshTokens,
    }),
    [
      confirmForgotPassword,
      confirmSignUp,
      completeNewPassword,
      forgotPassword,
      refreshTokens,
      signIn,
      signOut,
      signUp,
      status,
      tokens,
      user,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
