import { useState, type FormEvent } from 'react';
import { Field, FormError, useAction } from './ui';
import type { Tenant } from '../data/types';
import { actions } from '../sync';

/** Add a tenant, or edit one. */
export function TenantForm(props: { tenant?: Tenant; onDone?: () => void }) {
  const { tenant } = props;
  const [name, setName] = useState(tenant?.name ?? '');
  const [phone, setPhone] = useState(tenant?.phone ?? '');
  const [idDetails, setIdDetails] = useState(tenant?.idDetails ?? '');
  const [guarantor, setGuarantor] = useState(tenant?.guarantor ?? '');
  const [notes, setNotes] = useState(tenant?.notes ?? '');
  const { error, busy, run } = useAction();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const saved = await run(() => actions.saveTenant({ name, phone, idDetails, guarantor, notes }, tenant?.id));
    if (saved) {
      if (!tenant) {
        setName('');
        setPhone('');
        setIdDetails('');
        setGuarantor('');
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
      <Field label="ID details" hint="Type and number of an ID, if you keep one on file.">
        <input value={idDetails} onChange={(e) => setIdDetails(e.target.value)} placeholder="Optional" />
      </Field>
      <Field label="Guarantor">
        <input value={guarantor} onChange={(e) => setGuarantor(e.target.value)} placeholder="Name and phone (optional)" />
      </Field>
      <Field label="Notes">
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
      </Field>
      <FormError message={error} />
      <button className="primary" disabled={busy}>
        {tenant ? 'Save tenant' : 'Add tenant'}
      </button>
    </form>
  );
}
