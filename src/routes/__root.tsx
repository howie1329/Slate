import { Link, Outlet, createRootRoute } from "@tanstack/react-router";

const navLinkClass =
  "inline-flex border-b-2 border-transparent pb-3 text-sm font-semibold leading-none text-stone-500 no-underline outline-none hover:text-stone-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-500";

const activeNavLinkClass =
  "inline-flex border-b-2 border-stone-800 pb-3 text-sm font-semibold leading-none text-stone-800 no-underline outline-none hover:text-stone-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-500";

export const Route = createRootRoute({
  component: SlateShell,
});

function SlateShell() {
  return (
    <main className="min-h-dvh bg-stone-50 text-stone-800 antialiased">
      <div className="mx-auto w-full max-w-xl px-6 pb-9 pt-7 sm:px-7">
        <header className="flex items-start justify-between">
        <div>
          <p className="m-0 text-xs font-semibold leading-tight text-stone-500 uppercase">
            Daily commitment planner
          </p>
          <p className="mt-1 font-serif text-3xl leading-none font-semibold">Slate</p>
        </div>
          <span
            className="mt-2 block size-2 rounded-full bg-emerald-500 ring-4 ring-emerald-50"
            aria-label="Local-first workspace"
          />
        </header>

        <nav className="mt-8 flex gap-5 border-b border-stone-200" aria-label="Task views">
          <Link
            to="/today"
            className={navLinkClass}
            activeProps={{ className: activeNavLinkClass }}
          >
            Today
          </Link>
          <Link
            to="/inbox"
            className={navLinkClass}
            activeProps={{ className: activeNavLinkClass }}
          >
            Inbox
          </Link>
        </nav>

        <Outlet />
      </div>
    </main>
  );
}
