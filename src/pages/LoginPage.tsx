import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!auth) {
      setError('Firebase Auth não está disponível.');
      return;
    }

    if (!email || !password) {
      setError('Preencha email e senha.');
      return;
    }

    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email.trim(), password);
      navigate('/dashboard');
    } catch (err: any) {
      console.error('Login error:', err);
      setError('Não consegui fazer login. Confira email, senha e se o usuário existe no Firebase Auth.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#FBFBF9] px-5 py-10 text-stone-950">
      <section className="mx-auto max-w-md rounded-[2rem] border border-stone-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-stone-400">Nera Professional</p>
        <h1 className="mt-3 text-4xl font-serif">Entrar</h1>
        <p className="mt-3 text-stone-600">Use o mesmo email e senha da profissional cadastrada no Firebase Auth.</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-stone-700">Email</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              autoComplete="email"
              className="mt-2 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 outline-none focus:border-stone-900 focus:bg-white"
              placeholder="voce@email.com"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-stone-700">Senha</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
              className="mt-2 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 outline-none focus:border-stone-900 focus:bg-white"
              placeholder="Sua senha"
            />
          </label>

          {error ? <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}

          <button
            disabled={loading}
            className="w-full rounded-2xl bg-stone-950 px-5 py-4 font-semibold text-white disabled:opacity-50"
          >
            {loading ? 'Entrando...' : 'Entrar no dashboard'}
          </button>
        </form>
      </section>
    </main>
  );
}
