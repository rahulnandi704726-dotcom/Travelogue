import React, { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { X, Lock, Mail, User } from 'lucide-react';
import { auth, googleAuthProvider } from '../lib/firebase';
import { AuthUser } from '../types';

interface AuthModalProps {
  brandName: string;
  onClose: () => void;
  onAuthSuccess: (user: AuthUser, token: string) => void;
  onNotify: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  brandName,
  onClose,
  onAuthSuccess,
  onNotify,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);

    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body =
        mode === 'login' ? { email: email.trim(), password } : { name: name.trim(), email: email.trim(), password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Authentication failed.');
        setSubmitting(false);
        return;
      }

      onAuthSuccess(data.user, data.token);
      onNotify(
        mode === 'login'
          ? `Signed in as ${data.user.email}`
          : `Account created for ${data.user.email}`,
        'success'
      );
      onClose();
    } catch {
      setErrorMsg('Unable to reach authentication server. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    setSubmitting(true);
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const idToken = await cred.user.getIdToken();

      const res = await fetch('/api/auth/firebase', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Google Sign-In verification failed.');
        setSubmitting(false);
        return;
      }

      onAuthSuccess(data.user, idToken);
      onNotify(`Signed in with Google as ${data.user.email}`, 'success');
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Google Sign-In was cancelled or failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="authModalHeading"
    >
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="authModalHeading" className="text-lg font-extrabold text-slate-900">
              {mode === 'login' ? `Sign In to ${brandName}` : `Create ${brandName} Account`}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Access flight bookings, e-tickets, and admin controls.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sign in dialog"
            className="text-slate-400 hover:text-slate-700 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setErrorMsg('');
            }}
            className={`py-2 text-xs font-semibold rounded-md transition ${
              mode === 'login'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setErrorMsg('');
            }}
            className={`py-2 text-xs font-semibold rounded-md transition ${
              mode === 'register'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full border border-slate-200 rounded-lg pl-9 pr-3.5 py-2.5 text-sm outline-none focus:border-[#0D5BE1]"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="rahulnandi7047@gmail.com"
                autoComplete="email"
                className="w-full border border-slate-200 rounded-lg pl-9 pr-3.5 py-2.5 text-sm outline-none focus:border-[#0D5BE1]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                className="w-full border border-slate-200 rounded-lg pl-9 pr-3.5 py-2.5 text-sm outline-none focus:border-[#0D5BE1]"
              />
            </div>
          </div>

          {errorMsg && (
            <div className="text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#0D5BE1] hover:bg-[#0842A8] disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg text-sm transition"
          >
            {submitting
              ? 'Verifying...'
              : mode === 'login'
              ? 'Sign In with Email'
              : 'Create Account'}
          </button>
        </form>

        <div className="relative flex items-center py-1">
          <div className="flex-grow border-t border-slate-200" />
          <span className="shrink mx-3 text-[11px] font-medium text-slate-400">or</span>
          <div className="flex-grow border-t border-slate-200" />
        </div>

        <button
          type="button"
          disabled={submitting}
          onClick={handleGoogleSignIn}
          className="w-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 font-semibold py-2.5 rounded-lg text-xs transition flex items-center justify-center gap-2"
        >
          Continue with Google
        </button>
      </div>
    </div>
  );
};
