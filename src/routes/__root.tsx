import { Link, Outlet, createRootRoute } from "@tanstack/react-router";
import { ThemeToggle } from "@/components/theme-toggle";

const navLinkClass =
  "inline-flex border-b-2 border-transparent pb-3 text-sm font-semibold leading-none text-muted-foreground no-underline outline-none hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring";

const activeNavLinkClass =
  "inline-flex border-b-2 border-foreground pb-3 text-sm font-semibold leading-none text-foreground no-underline outline-none hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring";

export const Route = createRootRoute({
  component: SlateShell,
});

function SlateShell() {
  return (
    <main className="min-h-dvh bg-background text-foreground antialiased">
      <div className="mx-auto w-full max-w-xl px-6 pb-9 pt-7 sm:px-7">
        <header className="flex items-start justify-between">
          <div>
            <p className="m-0 text-xs font-semibold leading-tight text-muted-foreground uppercase">
              Daily commitment planner
            </p>
            <p className="mt-1 font-serif text-3xl leading-none font-semibold">Slate</p>
          </div>
          <div className="-mt-1 flex items-center gap-2">
            <ThemeToggle />
            <span
              className="block size-2 rounded-full bg-primary ring-4 ring-background"
              aria-label="Local-first workspace"
            />
          </div>
        </header>

        <nav className="mt-8 flex gap-5 border-b border-border" aria-label="Task views">
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
