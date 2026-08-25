import { auth, googleAuthProvider } from '../lib/firebase';
import { signInWithPopup } from 'firebase/auth';
import { ShieldCheck } from 'lucide-react';

export function Login() {
  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen w-full bg-[#0A0A0A] text-[#E0E0E0] font-sans">
      <div className="flex flex-col items-center space-y-6 max-w-sm w-full p-8 bg-[#141414] border border-[#1A1A1A] rounded-2xl shadow-2xl shadow-black/50">
        <div className="w-16 h-16 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <ShieldCheck className="w-8 h-8 text-white" />
        </div>
        
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-white">Welcome back</h1>
          <p className="text-sm text-[#888]">Sign in to access your secure, private conversations.</p>
        </div>

        <button 
          onClick={handleLogin} 
          className="w-full flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 px-4 rounded-xl transition-all shadow-lg shadow-indigo-600/10 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-[#141414]"
        >
          <span>Sign in with Google</span>
        </button>
        
        <div className="mt-6 flex items-center justify-center space-x-2 text-[10px] text-[#444] uppercase tracking-[0.15em] font-bold">
          <ShieldCheck className="w-3 h-3" />
          <span>End-to-End Encrypted</span>
        </div>
      </div>
    </div>
  );
}
