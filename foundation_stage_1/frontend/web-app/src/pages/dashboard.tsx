import { useAuth } from '../context/AuthContext';

export function DashboardPage() {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <div className="dashboard">
      <header className="topbar">
        <strong>Foundation Stage 1</strong>
        <button className="link" onClick={logout}>
          Sign out
        </button>
      </header>

      <main className="dashboard-body">
        <h1>You are logged in</h1>

        <dl className="info">
          <dt>ID</dt>
          <dd>{user.id}</dd>

          <dt>Email</dt>
          <dd>{user.email}</dd>

          <dt>Name</dt>
          <dd>
            {user.firstName || '—'} {user.lastName}
          </dd>

          <dt>Role</dt>
          <dd>
            <span className={`badge badge-${user.role}`}>{user.role}</span>
          </dd>

          <dt>Status</dt>
          <dd>{user.isActive ? 'Active' : 'Disabled'}</dd>
        </dl>

        <p className="muted">
          This dashboard only proves the auth flow works. In Stage 2 it will
          be replaced by the product surface.
        </p>
      </main>
    </div>
  );
}
