import { Link, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/inbox")({
  component: InboxPage,
});

function InboxPage() {
  return (
    <section className="view" aria-labelledby="inbox-heading">
      <div className="view-heading">
        <p className="eyebrow">Inbox</p>
        <h1 id="inbox-heading">Keep the incoming clear.</h1>
        <p className="view-copy">
          Quick capture and task details arrive in the next implementation step.
        </p>
      </div>

      <div className="empty-state empty-state--inbox">
        <p className="empty-kicker">Nothing waiting</p>
        <p>New tasks will collect here before you decide whether today can hold them.</p>
        <Link className="text-action" to="/today">
          Back to Today
        </Link>
      </div>
    </section>
  );
}
