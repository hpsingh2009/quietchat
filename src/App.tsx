/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './lib/firebase';
import { useAuthStore } from './store/auth';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { ProfileSetup } from './components/ProfileSetup';

export default function App() {
  const { user, dbUser, loading, setUser, setDbUser, setToken, setLoading } = useAuthStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          const token = await currentUser.getIdToken();
          setToken(token);
          
          // Fetch database user
          const res = await fetch('/api/me', {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          if (res.ok) {
            const data = await res.json();
            setDbUser(data.user);
          }
        } catch (error) {
          console.error("Failed to fetch user profile", error);
        }
      } else {
        setUser(null);
        setDbUser(null);
        setToken(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [setUser, setDbUser, setToken, setLoading]);

  if (loading) {
    return (
      <div className="h-screen w-full bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  // If user is logged in but hasn't set a username yet, show ProfileSetup
  if (user && dbUser && !dbUser.username) {
    return <ProfileSetup />;
  }

  return <Dashboard />;
}

