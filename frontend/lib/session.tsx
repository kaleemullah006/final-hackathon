"use client";

import { createContext, useContext } from "react";
import type { SessionUser } from "./api";

const SessionContext = createContext<SessionUser | null>(null);

export const SessionProvider = SessionContext.Provider;

// The logged-in user. Only usable inside the app shell (after the server confirmed the session).
export function useSession(): SessionUser {
  const user = useContext(SessionContext);
  if (!user) {
    throw new Error("useSession must be used inside the app shell");
  }
  return user;
}
