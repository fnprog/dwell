import { Link } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';
import { UserError } from '../data/actions';

export function PageHeader(props: {
  title: string;
  subtitle?: ReactNode;
  back?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="page-heading">
        {props.back && <div className="back">{props.back}</div>}
        <h1 className="page-title">{props.title}</h1>
        {props.subtitle && <div className="page-subtitle">{props.subtitle}</div>}
      </div>
      {props.action && <div className="page-actions">{props.action}</div>}
    </header>
  );
}

export function Field(props: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="field">
      <span>{props.label}</span>
      {props.children}
      {props.hint && <span className="hint">{props.hint}</span>}
    </label>
  );
}

export function Section(props: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="section">
      <div className="section-head">
        <h2>{props.title}</h2>
        {props.action}
      </div>
      {props.children}
    </section>
  );
}

export function Chip(props: { tone?: 'ok' | 'warn' | 'bad' | 'plain'; children: ReactNode }) {
  return <span className={`chip ${props.tone ?? 'plain'}`}>{props.children}</span>;
}

export function Empty(props: { children: ReactNode }) {
  return <p className="muted empty">{props.children}</p>;
}

export function Loading() {
  return <p className="muted empty">Loading…</p>;
}

/** Chips that set a number input, e.g. rent periods of 2, 3, 6 or 12 months. */
export function QuickPick(props: { options: number[]; value: string; onPick: (value: string) => void; unit: string }) {
  return (
    <div className="quick" role="group" aria-label="Common values">
      {props.options.map((option) => (
        <button
          type="button"
          key={option}
          className={`quick-chip${props.value === String(option) ? ' on' : ''}`}
          onClick={() => props.onPick(String(option))}
        >
          {option} {props.unit}
        </button>
      ))}
    </div>
  );
}

/**
 * Run an async action with busy and error state. Messages from `UserError`
 * are shown as written; anything else gets a generic line (and is logged).
 */
export function useAction() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (caught) {
      if (caught instanceof UserError || (caught instanceof Error && caught.message.includes('is not a valid amount'))) {
        setError(caught.message);
      } else {
        console.error(caught);
        setError('Something went wrong saving that. Nothing was lost; please try again.');
      }
      return undefined;
    } finally {
      setBusy(false);
    }
  }
  return { error, busy, run, clear: () => setError(null) };
}

export function FormError(props: { message: string | null }) {
  return props.message ? (
    <p className="error" role="alert">
      {props.message}
    </p>
  ) : null;
}

export function BackLink(props: { to: string; params?: Record<string, string>; children: ReactNode }) {
  // The route table is typed; callers pass known paths.
  return (
    <Link to={props.to as never} params={props.params as never} className="back-link">
      ← {props.children}
    </Link>
  );
}

export function confirmDelete(what: string): boolean {
  return window.confirm(`Delete ${what}? This cannot be undone.`);
}
