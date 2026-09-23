import { useState } from 'react';
import { useAuth } from './auth/AuthContext';
import { AdminView } from './components/admin/AdminView';
import { LoginScreen } from './components/LoginScreen';
import { TopBar, type View } from './components/TopBar';
import { TranslatorView } from './components/TranslatorView';
import { useI18n } from './i18n/I18nContext';

export function App() {
  const { state } = useAuth();
  const { t } = useI18n();
  const [view, setView] = useState<View>('translator');

  if (state.status === 'checking') {
    return (
      <>
        <TopBar view={view} onViewChange={setView} />
        <main className="container" id="main">
          <p className="muted center" role="status">
            {t.loading}
          </p>
        </main>
      </>
    );
  }

  if (state.status === 'signedOut') {
    return (
      <>
        <TopBar view={view} onViewChange={setView} />
        <LoginScreen notice={state.notice} />
      </>
    );
  }

  const showAdmin = view === 'admin' && state.user.role === 'admin';
  return (
    <>
      <TopBar view={view} onViewChange={setView} />
      {/* The translator stays mounted so its input and result survive a visit to Admin. */}
      <TranslatorView hidden={showAdmin} />
      {showAdmin && <AdminView onBack={() => setView('translator')} />}
    </>
  );
}
