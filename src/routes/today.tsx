import { Link, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/today")({
  component: TodayPage,
});

function TodayPage() {
  return (
    <section className="view" aria-labelledby="today-heading">
      <div className="view-heading">
        <p className="eyebrow">Today</p>
        <h1 id="today-heading">Make room for what matters.</h1>
        <p className="view-copy">
          Your daily capacity and committed tasks will appear here.
        </p>
      </div>

      <div className="capacity-card">
        <div className="capacity-copy">
          <span>Committed</span>
          <strong className="capacity-value">0 / 0 min</strong>
        </div>
        <div className="capacity-track" aria-hidden="true">
          <span className="capacity-fill" />
        </div>
      </div>

      <div className="empty-state">
        <p className="empty-kicker">A clear day</p>
        <p>
          Start from the Inbox, then commit only the work that fits your day.
        </p>
        <Link className="text-action" to="/inbox">
          Open Inbox
        </Link>
      </div>
    </section>
  );
}
