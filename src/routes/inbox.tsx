import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/inbox")({
  component: InboxPage,
});

function InboxPage() {
  return (
    <section className="flex h-full min-h-0 flex-col overflow-y-auto px-4 pb-24 pt-5 sm:px-6 sm:pt-6" aria-labelledby="log-heading">
      <div className="mx-auto w-full max-w-xl">
        <h1 id="log-heading" className="m-0 font-serif text-3xl leading-none font-semibold">
          Log
        </h1>
        <p className="mt-3 max-w-sm text-base leading-6 text-muted-foreground">
          Your completed work will appear here.
        </p>
      </div>
    </section>
  );
}
