import { useState, type FormEvent } from 'react';
import { BackLink, Empty, Field, FormError, Loading, PageHeader, confirmDelete, useAction } from '../components/ui';
import { plural } from '../data/format';
import { useLandlords, useLeases } from '../data/hooks';
import type { Landlord } from '../data/types';
import { actions } from '../sync';

function LandlordForm(props: { landlord?: Landlord; onDone?: () => void }) {
  const { landlord } = props;
  const [name, setName] = useState(landlord?.name ?? '');
  const [phone, setPhone] = useState(landlord?.phone ?? '');
  const [notes, setNotes] = useState(landlord?.notes ?? '');
  const { error, busy, run } = useAction();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const saved = await run(() => actions.saveLandlord({ name, phone, notes }, landlord?.id));
    if (saved) {
      if (!landlord) {
        setName('');
        setPhone('');
        setNotes('');
      }
      props.onDone?.();
    }
  }

  return (
    <form className="card form" onSubmit={submit}>
      <Field label="Name">
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>
      <Field label="Phone">
        <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="Optional" />
      </Field>
      <Field label="Notes">
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
      </Field>
      <FormError message={error} />
      <button className="primary" disabled={busy}>
        {landlord ? 'Save landlord' : 'Add landlord'}
      </button>
    </form>
  );
}

export function LandlordsPage() {
  const landlords = useLandlords();
  const leases = useLeases();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { error, run } = useAction();

  if (!landlords || !leases) return <Loading />;
  const sorted = [...landlords].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <PageHeader
        back={<BackLink to="/more">More</BackLink>}
        title="Landlords"
        subtitle="The people you lease from."
        action={
          <button className="ghost" onClick={() => setAdding((open) => !open)}>
            {adding ? 'Close' : 'Add landlord'}
          </button>
        }
      />
      {adding && <LandlordForm onDone={() => setAdding(false)} />}
      <FormError message={error} />

      {sorted.length === 0 ? (
        <Empty>No landlords yet. You can also add one while creating a lease.</Empty>
      ) : (
        <ul className="list">
          {sorted.map((landlord) => {
            const count = leases.filter((l) => l.landlordId === landlord.id).length;
            return (
              <li key={landlord.id} className="card">
                {editingId === landlord.id ? (
                  <LandlordForm landlord={landlord} onDone={() => setEditingId(null)} />
                ) : (
                  <>
                    <div className="title">{landlord.name}</div>
                    <div className="muted small">
                      {landlord.phone ?? 'No phone'} · {plural(count, 'lease')}
                    </div>
                    {landlord.notes && <div className="muted small">{landlord.notes}</div>}
                    <div className="two top-gap">
                      <button className="ghost" onClick={() => setEditingId(landlord.id)}>
                        Edit
                      </button>
                      <button
                        className="ghost danger"
                        onClick={() => {
                          if (confirmDelete(landlord.name)) void run(() => actions.removeLandlord(landlord.id));
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
