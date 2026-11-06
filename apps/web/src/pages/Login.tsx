import { useState, type FormEvent } from 'react';
import { signIn } from '../sync';
import { Logo, LogoWatermark } from '../components/Icon';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (caught) {
      const message = (caught as Error).message;
      setError(message === 'offline' ? 'You are offline. Connect to sign in the first time.' : message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-shell">
      <div className="login-left">
        <a href="/" className="brand" style={{ padding: 0 }}>
          <Logo width={34} height={38} />
          <span className="brand-name">Dwell</span>
        </a>

        <div className="stack" style={{ gap: 10, marginTop: 'auto' }}>
          <span className="eyebrow" style={{ color: 'var(--gold)' }}>Subrent Manager · Ghana</span>
          <h1 className="login-title">Welcome<br />back.</h1>
          <p className="mu">Your rooms, your money, and every date that matters — one quiet place.</p>
        </div>

        <form className="login-form" onSubmit={submit}>
          <label className="field">
            <span>Email</span>
            <input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Your password"
            />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn g wide" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <div className="login-links">
            <span className="mu">New to Dwell? Ask your partner to create your account.</span>
            <a href="mailto:hello@dwell.gh">Need a hand? hello@dwell.gh</a>
          </div>
        </form>

        <div className="row wrap" style={{ marginTop: 'auto', color: 'var(--mu)', fontSize: 12 }}>
          <span>Works offline</span>
          <span>·</span>
          <span>GHS</span>
          <span>·</span>
          <span>Made for Ghana</span>
        </div>
      </div>

      <div className="login-right">
        <LogoWatermark className="big-mark" />
        <div className="login-note">
          <span className="b">Rent covered.<br />Rent due.<br />Nothing lost.</span>
          <span style={{ display: 'block', marginTop: 8, fontSize: 13, fontWeight: 600 }}>Every cedi, one calm view.</span>
        </div>
        <p className="login-quote">A quieter way to run the rooms you rent.</p>
      </div>
    </div>
  );
}
