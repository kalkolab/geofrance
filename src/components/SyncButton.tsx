import { sync, useSync } from '../sync'

const LABEL = {
  'needs-tap': 'Sync',
  syncing: 'Syncing…',
  synced: 'Synced',
  error: 'Sync failed',
} as const

// In the header once you have signed in: one tap after opening the app brings in your other devices' visits.
export function SyncButton() {
  const state = useSync()
  if (state.status === 'unconfigured' || state.status === 'signed-out') return null
  return (
    <button
      className={`sync ${state.status}`}
      onClick={sync.syncNow}
      disabled={state.status === 'syncing'}
      title={state.error ?? (state.email ? `Google Drive: ${state.email}` : undefined)}
    >
      {LABEL[state.status]}
    </button>
  )
}

export function AccountSection() {
  const state = useSync()
  return (
    <section>
      <h2>Google account</h2>
      {state.status === 'unconfigured' ? (
        <p className="muted">Google sign-in is not set up for this copy of the app.</p>
      ) : state.status === 'signed-out' ? (
        <>
          <p className="muted">
            Sign in to keep your visits in your own Google Drive and see the same data on your phone and computer. The
            app can only see its own file there, not the rest of your Drive.
          </p>
          <div className="actions start">
            <button className="primary" onClick={sync.syncNow}>
              Sign in with Google
            </button>
          </div>
        </>
      ) : (
        <>
          <p>
            Signed in as <strong>{state.email}</strong>.{' '}
            <span className="muted">
              {state.status === 'syncing'
                ? 'Syncing…'
                : state.status === 'needs-tap'
                  ? 'Tap Sync to bring in changes from your other devices.'
                  : state.lastSync
                    ? `Last synced at ${new Date(state.lastSync).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}.`
                    : ''}
            </span>
          </p>
          <div className="actions start">
            <button onClick={sync.syncNow} disabled={state.status === 'syncing'}>
              Sync now
            </button>
            <button onClick={sync.signOut}>Sign out</button>
          </div>
        </>
      )}
      {state.error && <p role="status">{state.error}</p>}
    </section>
  )
}
