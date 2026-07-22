import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type RouteMotionTransition = "animate" | "instant";

type RouteMotionContextValue = {
  routeTransition: RouteMotionTransition;
  setRouteTransition: (transition: RouteMotionTransition) => void;
};

const RouteMotionContext = createContext<RouteMotionContextValue | null>(null);

export function RouteMotionProvider({ children }: { children: ReactNode }) {
  const [routeTransition, setRouteTransition] = useState<RouteMotionTransition>("instant");
  const value = useMemo(
    () => ({ routeTransition, setRouteTransition }),
    [routeTransition],
  );

  return <RouteMotionContext.Provider value={value}>{children}</RouteMotionContext.Provider>;
}

export function useRouteMotion() {
  const context = useContext(RouteMotionContext);

  if (!context) {
    throw new Error("useRouteMotion must be used within RouteMotionProvider.");
  }

  return context;
}
