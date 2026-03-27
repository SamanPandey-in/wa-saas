import { useState } from 'react'
import { Bell, Menu, ShieldCheck } from 'lucide-react'
import { useAppDispatch, useAppSelector } from './app/hooks'
import {
  fetchCurrentUser,
  login,
  logout,
} from './features/auth/authSlice'
import {
  selectAuthError,
  selectAuthStatus,
  selectCurrentUser,
  selectIsAuthenticated,
} from './features/auth/selectors'
import {
  addNotification,
  clearNotifications,
} from './features/notifications/notificationsSlice'
import { toggleSidebar } from './features/ui/uiSlice'
import { useGetBackendHealthQuery } from './services/api/baseApi'

function App() {
  const dispatch = useAppDispatch()
  const user = useAppSelector(selectCurrentUser)
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  const authStatus = useAppSelector(selectAuthStatus)
  const authError = useAppSelector(selectAuthError)
  const sidebarOpen = useAppSelector((state) => state.ui.sidebarOpen)
  const notifications = useAppSelector((state) => state.notifications.items)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const {
    data: backendHealth,
    isFetching: isHealthLoading,
    refetch: refetchHealth,
  } = useGetBackendHealthQuery()

  const handleLogin = async (event) => {
    event.preventDefault()

    const result = await dispatch(login({ email, password }))

    if (login.fulfilled.match(result)) {
      dispatch(
        addNotification({
          type: 'success',
          title: 'Authenticated',
          message: 'Session started successfully.',
        }),
      )
      setPassword('')
      dispatch(fetchCurrentUser())
      return
    }

    dispatch(
      addNotification({
        type: 'error',
        title: 'Login failed',
        message: result.payload || 'Please check your credentials.',
      }),
    )
  }
  
  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto flex w-full max-w-7xl gap-6 px-4 py-6 lg:px-8">
        <aside
          className={`rounded-2xl bg-white p-4 shadow-sm transition-all ${
            sidebarOpen ? 'w-72' : 'w-20'
          }`}
        >
          <button
            type="button"
            onClick={() => dispatch(toggleSidebar())}
            className="mb-5 inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100"
          >
            <Menu size={16} />
            {sidebarOpen ? 'Collapse' : 'Open'}
          </button>
          <div className="space-y-2 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">WA SaaS Console</p>
            <p>Module-driven Redux architecture</p>
            <p>Auth, UI, notifications, and API slices ready</p>
          </div>
        </aside>

        <section className="flex-1 space-y-6">
          <header className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  Production Redux Scaffold
                </h1>
                <p className="text-sm text-slate-600">
                  Backend status:{' '}
                  <span className="font-semibold text-slate-900">
                    {isHealthLoading
                      ? 'Checking...'
                      : backendHealth?.status || 'Unknown'}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => refetchHealth()}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100"
              >
                Refresh health
              </button>
            </div>
          </header>

          <section className="grid gap-6 lg:grid-cols-2">
            <article className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
                <ShieldCheck size={18} />
                Auth module
              </h2>

              {isAuthenticated ? (
                <div className="space-y-3">
                  <p className="text-sm text-slate-700">
                    Signed in as{' '}
                    <span className="font-semibold">{user?.email || 'user'}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => dispatch(logout())}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
                  >
                    Sign out
                  </button>
                </div>
              ) : (
                <form className="space-y-3" onSubmit={handleLogin}>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="email@company.com"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    required
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="password"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    required
                  />
                  <button
                    type="submit"
                    disabled={authStatus === 'loading'}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {authStatus === 'loading' ? 'Signing in...' : 'Sign in'}
                  </button>
                  {authError ? (
                    <p className="text-sm text-rose-600">{authError}</p>
                  ) : null}
                </form>
              )}
            </article>

            <article className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <Bell size={18} />
                  Notifications module
                </h2>
                <button
                  type="button"
                  onClick={() => dispatch(clearNotifications())}
                  className="text-sm text-slate-600 hover:text-slate-900"
                >
                  Clear all
                </button>
              </div>
              <div className="mb-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    dispatch(
                      addNotification({
                        type: 'success',
                        title: 'Queue synced',
                        message: 'Outbound jobs are healthy.',
                      }),
                    )
                  }
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100"
                >
                  Add success
                </button>
                <button
                  type="button"
                  onClick={() =>
                    dispatch(
                      addNotification({
                        type: 'error',
                        title: 'Webhook failed',
                        message: 'Delivery status callback timed out.',
                      }),
                    )
                  }
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100"
                >
                  Add error
                </button>
              </div>
              <ul className="space-y-2">
                {notifications.length === 0 ? (
                  <li className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500">
                    No notifications yet.
                  </li>
                ) : (
                  notifications.slice(0, 5).map((item) => (
                    <li
                      key={item.id}
                      className="rounded-lg border border-slate-200 p-3 text-sm"
                    >
                      <p className="font-semibold text-slate-900">{item.title}</p>
                      <p className="text-slate-600">{item.message}</p>
                    </li>
                  ))
                )}
              </ul>
            </article>
          </section>
        </section>
      </div>
    </main>
  )
}

export default App
