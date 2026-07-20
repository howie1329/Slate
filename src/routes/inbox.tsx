import { Link, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/inbox")({
  component: InboxPage,
});

function InboxPage() {
  return (
    <section className="pt-10" aria-labelledby="inbox-heading">
      <div className="max-w-lg">
        <p className="m-0 text-xs font-semibold leading-tight text-stone-500 uppercase">Inbox</p>
        <h1
          id="inbox-heading"
          className="mt-2 mb-3 font-serif text-4xl leading-none font-medium text-balance sm:text-5xl"
        >
          Keep the incoming clear.
        </h1>
        <p className="m-0 text-base leading-6 text-pretty text-stone-600">
          Quick capture and task details arrive in the next implementation step.
        </p>
      </div>

      <div className="mt-8 border-t border-stone-200 pt-6">
        <p className="m-0 text-xs font-semibold leading-tight text-stone-500 uppercase">Nothing waiting</p>
        <p className="mt-2 max-w-sm text-base leading-6 text-pretty text-stone-600">
          New tasks will collect here before you decide whether today can hold them.
        </p>
        <Link
          className="mt-4 inline-block text-sm font-semibold text-emerald-800 underline decoration-1 underline-offset-4 outline-none hover:text-emerald-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-500"
          to="/today"
        >
          Back to Today
        </Link>
      </div>
    </section>
  );
}
