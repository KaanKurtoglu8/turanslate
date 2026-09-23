import { useAuth } from '../auth/AuthContext';
import { format } from '../i18n/dictionaries';
import { useI18n } from '../i18n/I18nContext';
import { LangToggle } from './LangToggle';

export type View = 'translator' | 'admin';

interface TopBarProps {
  view: View;
  onViewChange: (view: View) => void;
}

export function TopBar({ view, onViewChange }: TopBarProps) {
  const { state, signOut } = useAuth();
  const { t } = useI18n();
  const user = state.status === 'signedIn' ? state.user : null;

  return (
    <header className="topbar">
      <div className="topbar__inner">
        {user ? (
          <button
            type="button"
            className="wordmark wordmark--button"
            onClick={() => onViewChange('translator')}
          >
            Turan<span>slate</span>
          </button>
        ) : (
          <span className="wordmark" aria-hidden="true">
            Turan<span>slate</span>
          </span>
        )}
        <div className="topbar__actions">
          {user && (
            <nav className="account" aria-label={t.mainNav}>
              <span
                className="account__user"
                title={format(t.signedInAs, { username: user.username })}
              >
                <span className="visually-hidden">{format(t.signedInAs, { username: '' })}</span>
                {user.username}
              </span>
              {user.role === 'admin' && (
                <button
                  type="button"
                  className="chip"
                  aria-pressed={view === 'admin'}
                  onClick={() => onViewChange(view === 'admin' ? 'translator' : 'admin')}
                >
                  {t.admin}
                </button>
              )}
              <button type="button" className="link-button" onClick={() => void signOut()}>
                {t.signOut}
              </button>
            </nav>
          )}
          <LangToggle />
        </div>
      </div>
    </header>
  );
}
