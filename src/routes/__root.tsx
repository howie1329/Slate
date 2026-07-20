import { Link, Outlet, createRootRoute } from "@tanstack/react-router";

export const Route = createRootRoute({
  component: SlateShell,
});

function SlateShell() {
  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Daily commitment planner</p>
          <p className="wordmark">Slate</p>
        </div>
        <span className="status-dot" aria-label="Local-first workspace" />
      </header>

      <nav className="primary-nav" aria-label="Task views">
        <Link
          to="/today"
          className="nav-link"
          activeProps={{ className: "nav-link is-active" }}
        >
          Today
        </Link>
        <Link
          to="/inbox"
          className="nav-link"
          activeProps={{ className: "nav-link is-active" }}
        >
          Inbox
        </Link>
      </nav>

      <Outlet />
    </main>
  );
}
