import React, { useState } from 'react';
import { useAuthStore } from '../store/auth';
import { ShieldCheck, AtSign } from 'lucide-react';

export function ProfileSetup() {
  const { user, token, setDbUser } = useAuthStore();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !displayName.trim()) {
      setError('Username and Display Name are required');
      return;
    }

    // Basic Discord-like username validation (alphanumeric, underscores, lowercase)
    const usernameRegex = /^[a-z0-9_]{3,24}$/;
    if (!usernameRegex.test(username)) {
      setError('Username must be 3-24 characters, lowercase letters, numbers, and underscores only.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ username, displayName })
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save profile');
      }

      setDbUser(data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen w-full bg-[#0A0A0A] text-[#E0E0E0] font-sans">
      <div className="flex flex-col items-center space-y-6 max-w-md w-full p-8 bg-[#141414] border border-[#1A1A1A] rounded-2xl shadow-2xl shadow-black/50">
        <div className="w-16 h-16 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <AtSign className="w-8 h-8 text-white" />
        </div>
        
        <div className="text-center space-y-2 w-full">
          <h1 className="text-2xl font-bold tracking-tight text-white">Claim your username</h1>
          <p className="text-sm text-[#888]">Choose a unique username to connect with friends.</p>
        </div>

        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#888] uppercase tracking-wide">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-[#0A0A0A] border border-[#222] rounded-lg py-2.5 px-3 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder-[#444]"
              placeholder="How others see you"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-[#888] uppercase tracking-wide">Username</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-[#555] font-bold">@</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                className="w-full bg-[#0A0A0A] border border-[#222] rounded-lg py-2.5 pl-8 pr-3 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder-[#444]"
                placeholder="unique_name"
              />
            </div>
            <p className="text-[10px] text-[#555] pt-1">You can change your display name later, but your username is unique.</p>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-xs text-red-400 text-center">{error}</p>
            </div>
          )}

          <button 
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 px-4 rounded-xl transition-all shadow-lg shadow-indigo-600/10 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-[#141414] mt-2"
          >
            <span>{saving ? 'Saving...' : 'Continue'}</span>
          </button>
        </form>
        
        <div className="mt-4 flex items-center justify-center space-x-2 text-[10px] text-[#444] uppercase tracking-[0.15em] font-bold">
          <ShieldCheck className="w-3 h-3" />
          <span>End-to-End Encrypted Platform</span>
        </div>
      </div>
    </div>
  );
}
