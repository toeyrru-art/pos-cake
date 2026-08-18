import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const auth = localStorage.getItem('adminAuth');
      if (auth === 'true') {
        setIsAuthenticated(true);
      }
    } catch (err) {
      console.warn('localStorage access denied', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = (pin) => {
    if (pin === '123456') { // Hardcoded PIN for simplicity
      try {
        localStorage.setItem('adminAuth', 'true');
      } catch (err) {
        console.warn('localStorage access denied', err);
      }
      setIsAuthenticated(true);
      return true;
    }
    return false;
  };

  const logout = () => {
    try {
      localStorage.removeItem('adminAuth');
    } catch (err) {
      console.warn('localStorage access denied', err);
    }
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

