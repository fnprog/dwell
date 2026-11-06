import { useState, type FormEvent } from 'react';
import { Field, FormError, useAction } from './ui';
import { parseMoneyField, toMoneyField } from '../data/format';
import type { Unit } from '../data/types';
import { actions } from '../sync';

/** Add a room to a lease, or edit one. */
export function UnitForm(props: { leaseId: string; unit?: Unit; onDone?: () => void }) {
  const { leaseId, unit } = props;
  const [name, setName] = useState(unit?.name ?? '');
  const [target, setTarget] = useState(toMoneyField(unit?.targetPrice));
  const [baseline, setBaseline] = useState(toMoneyField(unit?.unfurnishedBaseline));
  const [weight, setWeight] = useState(String(unit?.allocationWeight ?? 100));
  const { error, busy, run } = useAction();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const saved = await run(() =>
      actions.saveUnit(
        leaseId,
        {
          name,
          targetPrice: parseMoneyField(target),
          unfurnishedBaseline: parseMoneyField(baseline),
          allocationWeight: Number(weight),
        },
        unit?.id,
      ),
    );
    if (saved) {
      if (!unit) {
        setName('');
        setTarget('');
        setBaseline('');
        setWeight('100');
      }
      props.onDone?.();
    }
  }

  return (
    <form className="card form" onSubmit={submit}>
      <Field label="Room name">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Room 2, or Whole house" required />
      </Field>
      <div className="two">
        <Field label="Asking rent per period (GHS)" hint="What you want a tenant to pay.">
          <input value={target} onChange={(e) => setTarget(e.target.value)} inputMode="decimal" placeholder="Optional" />
        </Field>
        <Field label="Unfurnished rent (GHS)" hint="What the bare room would fetch. Used later to judge furnishing.">
          <input value={baseline} onChange={(e) => setBaseline(e.target.value)} inputMode="decimal" placeholder="Optional" />
        </Field>
      </div>
      <Field label="Share of the landlord's rent" hint="100 means a normal share, so rooms with the same number split the rent equally. Give a bigger room a bigger number.">
        <input type="number" min={1} step={1} value={weight} onChange={(e) => setWeight(e.target.value)} required />
      </Field>
      <FormError message={error} />
      <button className="primary" disabled={busy}>
        {unit ? 'Save room' : 'Add room'}
      </button>
    </form>
  );
}
