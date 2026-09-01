import React, { createContext, useContext, useEffect, useState } from 'react';
import { getMeta, setMeta } from '../db.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null); // { token, farm, user }
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const saved = await getMeta('session');
      if (saved) setSession(saved);
      setLoading(false);
    })();
  }, []);

  const login = async (session) => {
    setSession(session);
    await setMeta('session', session);
  };

  const logout = async () => {
    setSession(null);
    await setMeta('session', null);
  };

  return (
    <AuthContext.Provider value={{ session, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
