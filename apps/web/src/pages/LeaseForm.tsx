import { useNavigate, useParams } from '@tanstack/react-router';
import { addDays, addMonths, generateSchedule, type ScheduleEntryDraft } from '@subrent/shared';
import { useState, type FormEvent } from 'react';
import { BackLink, Field, FormError, Loading, PageHeader, QuickPick, useAction } from '../components/ui';
import { fmtDate, money, parseMoneyField, periodLabel, toMoneyField } from '../data/format';
import { useLandlords, useLeases, useSites } from '../data/hooks';
import type { Lease } from '../data/types';
import { actions } from '../sync';

const NEW_LANDLORD = '__new__';

function previewSchedule(startDate: string, endDate: string, periodMonths: string, rent: string): ScheduleEntryDraft[] | null {
  try {
    const amount = parseMoneyField(rent);
    const months = Number(periodMonths);
    if (!amount || !Number.isInteger(months) || months < 1) return null;
    return generateSchedule({ startDate, endDate, periodMonths: months, amount });
  } catch {
    return null;
  }
}

function LeaseFormBody(props: { siteId: string; lease?: Lease }) {
  const { siteId, lease } = props;
  const navigate = useNavigate();
  const landlords = useLandlords();
  const { error, busy, run } = useAction();

  const [landlordId, setLandlordId] = useState(lease?.landlordId ?? '');
  const [newLandlord, setNewLandlord] = useState('');
  const [newLandlordPhone, setNewLandlordPhone] = useState('');
  const [rent, setRent] = useState(toMoneyField(lease?.rentAmount));
  const [period, setPeriod] = useState(String(lease?.periodMonths ?? 12));
  const [startDate, setStartDate] = useState(lease?.startDate ?? '');
  const [endDate, setEndDate] = useState(lease?.endDate ?? '');
  const [endTouched, setEndTouched] = useState(Boolean(lease));
  const [advance, setAdvance] = useState(toMoneyField(lease?.advancePaid));
  const [deposit, setDeposit] = useState(toMoneyField(lease?.depositPaid));
  const [notes, setNotes] = useState(lease?.notes ?? '');

  if (!landlords) return <Loading />;
  const choosingNew = landlordId === NEW_LANDLORD || (landlords.length === 0 && !lease);
  const sortedLandlords = [...landlords].sort((a, b) => a.name.localeCompare(b.name));

  function changeStart(value: string) {
    setStartDate(value);
    // Until the end date is set by hand, assume a one-year lease.
    if (!endTouched && value) {
      try {
        setEndDate(addDays(addMonths(value, 12), -1));
      } catch {
        /* partial date while typing */
      }
    }
  }

  const schedule = startDate && endDate ? previewSchedule(startDate, endDate, period, rent) : null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const saved = await run(async () => {
      let chosenLandlord = landlordId;
      if (choosingNew) {
        const created = await actions.saveLandlord({ name: newLandlord, phone: newLandlordPhone });
        chosenLandlord = created.id;
      }
      const rentAmount = parseMoneyField(rent);
      return actions.saveLease(
        {
          siteId,
          landlordId: chosenLandlord,
          rentAmount: rentAmount ?? 0,
          periodMonths: Number(period),
          startDate,
          endDate,
          advancePaid: parseMoneyField(advance) ?? 0,
          depositPaid: parseMoneyField(deposit) ?? 0,
          notes,
        },
        lease?.id,
      );
    });
    if (saved) void navigate({ to: '/leases/$leaseId', params: { leaseId: saved.id } });
  }

  return (
    <form className="card form" onSubmit={submit}>
      <Field label="Landlord">
        {landlords.length > 0 && (
          <select value={choosingNew ? NEW_LANDLORD : landlordId} onChange={(e) => setLandlordId(e.target.value)} required>
            <option value="" disabled>
              Choose a landlord…
            </option>
            {sortedLandlords.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
            <option value={NEW_LANDLORD}>+ New landlord</option>
          </select>
        )}
      </Field>
      {choosingNew && (
        <div className="subform">
          <Field label="New landlord's name">
            <input value={newLandlord} onChange={(e) => setNewLandlord(e.target.value)} required />
          </Field>
          <Field label="Phone">
            <input value={newLandlordPhone} onChange={(e) => setNewLandlordPhone(e.target.value)} inputMode="tel" placeholder="Optional" />
          </Field>
        </div>
      )}

      <Field label="Rent you pay each period (GHS)" hint="The amount for one rent period, not the whole lease.">
        <input value={rent} onChange={(e) => setRent(e.target.value)} inputMode="decimal" placeholder="e.g. 12000" required />
      </Field>

      <Field label="Rent period (months)">
        <input type="number" min={1} max={120} value={period} onChange={(e) => setPeriod(e.target.value)} required />
        <QuickPick options={[1, 2, 3, 6, 12]} value={period} onPick={setPeriod} unit="mo" />
      </Field>

      <div className="two">
        <Field label="Lease starts">
          <input type="date" value={startDate} onChange={(e) => changeStart(e.target.value)} required />
        </Field>
        <Field label="Lease ends">
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndTouched(true);
              setEndDate(e.target.value);
            }}
            required
          />
        </Field>
      </div>

      <div className="two">
        <Field label="Advance paid (GHS)" hint="Rent paid upfront.">
          <input value={advance} onChange={(e) => setAdvance(e.target.value)} inputMode="decimal" placeholder="0" />
        </Field>
        <Field label="Deposit paid (GHS)">
          <input value={deposit} onChange={(e) => setDeposit(e.target.value)} inputMode="decimal" placeholder="0" />
        </Field>
      </div>

      <Field label="Notes">
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
      </Field>

      {schedule && schedule.length > 0 && (
        <div className="preview">
          <div className="small">
            <strong>
              You will owe {schedule.length === 1 ? '1 payment' : `${schedule.length} payments`}
            </strong>{' '}
            ({periodLabel(Number(period))} each):
          </div>
          <ul className="plain small">
            {schedule.map((entry) => (
              <li key={entry.dueDate}>
                {fmtDate(entry.dueDate)}: {money(entry.amountDue)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <FormError message={error} />
      <button className="primary" disabled={busy}>
        {lease ? 'Save lease' : 'Add lease'}
      </button>
    </form>
  );
}

export function NewLease() {
  const { siteId } = useParams({ strict: false }) as { siteId: string };
  const sites = useSites();
  if (!sites) return <Loading />;
  const site = sites.find((s) => s.id === siteId);
  return (
    <>
      <PageHeader back={<BackLink to="/sites/$siteId" params={{ siteId }}>{site?.name ?? 'Site'}</BackLink>} title="New lease" subtitle={site?.name} />
      {site ? <LeaseFormBody siteId={siteId} /> : <p className="muted">This site no longer exists.</p>}
    </>
  );
}

export function EditLease() {
  const { leaseId } = useParams({ strict: false }) as { leaseId: string };
  const leases = useLeases();
  if (!leases) return <Loading />;
  const lease = leases.find((l) => l.id === leaseId);
  return (
    <>
      <PageHeader back={<BackLink to="/leases/$leaseId" params={{ leaseId }}>Lease</BackLink>} title="Edit lease" />
      {lease ? <LeaseFormBody siteId={lease.siteId} lease={lease} /> : <p className="muted">This lease no longer exists.</p>}
    </>
  );
}
