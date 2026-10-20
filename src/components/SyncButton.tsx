import { formatTime, rich, useT, type MessageKey } from '../i18n'
import { sync, useSync } from '../sync'

const LABEL: Record<'needs-tap' | 'syncing' | 'synced' | 'error', MessageKey> = {
  'needs-tap': 'syncButton',
  syncing: 'syncing',
  synced: 'synced',
  error: 'syncFailed',
}

// In the header once you have signed in: one tap after opening the app brings in your other devices' visits.
export function SyncButton() {
  const state = useSync()
  const t = useT()
  if (state.status === 'unconfigured' || state.status === 'signed-out') return null
  return (
    <button
      className={`sync ${state.status}`}
      onClick={sync.syncNow}
      disabled={state.status === 'syncing'}
      title={state.error ?? (state.email ? t('driveAccount', { email: state.email }) : undefined)}
    >
      {t(LABEL[state.status])}
    </button>
  )
}

export function AccountSection() {
  const state = useSync()
  const t = useT()
  return (
    <section>
      <h2>{t('googleAccount')}</h2>
      {state.status === 'unconfigured' ? (
        <p className="muted">{t('signInNotConfigured')}</p>
      ) : state.status === 'signed-out' ? (
        <>
          <p className="muted">{t('signInHelp')}</p>
          <div className="actions start">
            <button className="primary" onClick={sync.syncNow}>
              {t('signIn')}
            </button>
          </div>
        </>
      ) : (
        <>
          <p>
            {rich(t('signedInAs', { email: state.email ?? '' }))}{' '}
            <span className="muted">
              {state.status === 'syncing'
                ? t('syncing')
                : state.status === 'needs-tap'
                  ? t('tapSync')
                  : state.lastSync
                    ? t('lastSynced', { time: formatTime(state.lastSync) })
                    : ''}
            </span>
          </p>
          <div className="actions start">
            <button onClick={sync.syncNow} disabled={state.status === 'syncing'}>
              {t('syncNow')}
            </button>
            <button onClick={sync.signOut}>{t('signOut')}</button>
          </div>
        </>
      )}
      {state.error && <p role="status">{state.error}</p>}
    </section>
  )
}
