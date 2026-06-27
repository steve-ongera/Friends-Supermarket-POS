import React, { createContext, useContext, useState, useCallback } from "react";
import api from "../services/api";

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [session, setSession] = useState(null);
  const [showUnlockModal, setShowUnlockModal] = useState(false);

  const refreshSession = useCallback(async () => {
    const res = await api.get("/sessions/current/");
    setSession(res.data);
    if (res.data.status === "LOCKED") {
      setShowUnlockModal(true);
    }
    return res.data;
  }, []);

  return (
    <SessionContext.Provider
      value={{ session, setSession, refreshSession, showUnlockModal, setShowUnlockModal }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export const useSession = () => useContext(SessionContext);