import { useState, type FormEvent } from 'react';
import { ApiClientError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { LANGUAGES } from '../config/languages';
import type { ClientErrorCode } from '../i18n/dictionaries';
import { useI18n } from '../i18n/I18nContext';
import { Flag } from './Flag';

export function LoginScreen({ notice }: { notice: ClientErrorCode | null }) {
  const { signIn } = useAuth();
  const { t } = useI18n();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ClientErrorCode | null>(null);

  const message = error ?? notice;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(username, password);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.code : 'internal_error');
      setPassword('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login" id="main">
      <div className="login__card">
        <div className="login__brand">
          <h1 className="login__title">
            Turan<span>slate</span>
          </h1>
          <p className="login__tagline">{t.tagline}</p>
          <div className="login__flags" aria-hidden="true">
            {LANGUAGES.map((language) => (
              <Flag key={language.id} src={language.flagPath} code={language.id} size="sm" />
            ))}
          </div>
        </div>

        <form
          className="login__form"
          onSubmit={handleSubmit}
          aria-labelledby="login-heading"
          noValidate
        >
          <h2 id="login-heading" className="login__heading">
            {t.loginTitle}
          </h2>
          {message && (
            <p className="alert" role="alert">
              {t.errors[message]}
            </p>
          )}
          <div className="field">
            <label htmlFor="login-username">{t.username}</label>
            <input
              id="login-username"
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="login-password">{t.password}</label>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <button
            type="submit"
            className="btn btn--primary btn--block"
            disabled={busy || !username.trim() || !password}
          >
            {busy ? t.signingIn : t.signIn}
          </button>
        </form>
        <p className="login__hint">{t.loginHint}</p>
      </div>
    </main>
  );
}
