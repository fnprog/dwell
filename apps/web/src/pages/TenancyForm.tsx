import { useNavigate, useParams } from '@tanstack/react-router';
import { daysBetween, endDateForPeriods, generateSchedule, todayLocal, type ScheduleEntryDraft } from '@subrent/shared';
import { useState, type FormEvent } from 'react';
import { BackLink, Field, FormError, Loading, PageHeader, QuickPick, useAction } from '../components/ui';
import { fmtDate, money, parseMoneyField, periodLabel, toMoneyField } from '../data/format';
import { useLeases, useTenancies, useTenants, useUnits } from '../data/hooks';
import type { Lease, Tenancy, Unit } from '../data/types';
import { actions } from '../sync';

const NEW_TENANT = '__new__';

function preview(start: string, end: string, period: string, rent: string): ScheduleEntryDraft[] | null {
  try {
    const amount = parseMoneyField(rent);
    const months = Number(period);
    if (!start || !end || !amount || !Number.isInteger(months) || months < 1 || daysBetween(start, end) < 0) return null;
    return generateSchedule({ startDate: start, endDate: end, periodMonths: months, amount });
  } catch {
    return null;
  }
}

function TenancyFormBody(props: { unit: Unit; lease: Lease; tenancy?: Tenancy }) {
  const { unit, lease, tenancy } = props;
  const navigate = useNavigate();
  const tenants = useTenants();
  const { error, busy, run } = useAction();

  const initialStart = tenancy?.startDate ?? todayLocal();
  const initialPeriod = tenancy?.periodMonths ?? 3;
  const [tenantId, setTenantId] = useState(tenancy?.tenantId ?? '');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [rent, setRent] = useState(toMoneyField(tenancy?.rentAmount ?? unit.targetPrice));
  const [period, setPeriod] = useState(String(initialPeriod));
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(tenancy?.endDate ?? endDateForPeriods(initialStart, initialPeriod, 1));
  const [deposit, setDeposit] = useState(toMoneyField(tenancy?.depositHeld));

  if (!tenants) return <Loading />;
  const choosingNew = tenantId === NEW_TENANT || (tenants.length === 0 && !tenancy);
  const sorted = [...tenants].sort((a, b) => a.name.localeCompare(b.name));
  const months = Number(period);
  const validMonths = Number.isInteger(months) && months >= 1;

  /** Set the end date to run for a whole number of rent periods from the start. */
  function setTerm(periods: number) {
    if (validMonths && start) setEnd(endDateForPeriods(start, months, periods));
  }

  function changeStart(value: string) {
    setStart(value);
    // Keep the same number of periods when the start moves, so the term does not shrink or grow.
    if (value && validMonths && start && end) {
      try {
        const periods = Math.max(1, Math.round((daysBetween(start, end) + 1) / (months * 30.4375)));
        setEnd(endDateForPeriods(value, months, periods));
      } catch {
        /* partial date */
      }
    }
  }

  const schedule = preview(start, end, period, rent);
  const pastLease = end && daysBetween(lease.endDate, end) > 0;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const saved = await run(async () => {
      let chosen = tenantId;
      if (choosingNew) chosen = (await actions.saveTenant({ name: newName, phone: newPhone })).id;
      const input = {
        unitId: unit.id,
        tenantId: chosen,
        rentAmount: parseMoneyField(rent) ?? 0,
        periodMonths: months,
        startDate: start,
        endDate: end,
        depositHeld: parseMoneyField(deposit) ?? 0,
      };
      return tenancy ? actions.updateTenancy(tenancy.id, input) : actions.startTenancy(input);
    });
    if (saved) void navigate({ to: '/units/$unitId', params: { unitId: unit.id } });
  }

  return (
    <form className="card form" onSubmit={submit}>
      <Field label="Tenant">
        {tenants.length > 0 && (
          <select value={choosingNew ? NEW_TENANT : tenantId} onChange={(e) => setTenantId(e.target.value)} required>
            <option value="" disabled>
              Choose a tenant…
            </option>
            {sorted.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
            <option value={NEW_TENANT}>+ New tenant</option>
          </select>
        )}
      </Field>
      {choosingNew && (
        <div className="subform">
          <Field label="New tenant's name">
            <input value={newName} onChange={(e) => setNewName(e.target.value)} required />
          </Field>
          <Field label="Phone">
            <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} inputMode="tel" placeholder="Optional" />
          </Field>
        </div>
      )}

      <Field label="Rent each period (GHS)" hint={unit.targetPrice ? `Asking rent for this room is ${money(unit.targetPrice)}.` : undefined}>
        <input value={rent} onChange={(e) => setRent(e.target.value)} inputMode="decimal" placeholder="e.g. 1500" required />
      </Field>

      <Field label="Rent period (months)" hint="How often the tenant pays: 2, 3, 6 months or any length you agree.">
        <input type="number" min={1} max={120} value={period} onChange={(e) => setPeriod(e.target.value)} required />
        <QuickPick options={[1, 2, 3, 6, 12]} value={period} onPick={setPeriod} unit="mo" />
      </Field>

      <div className="two">
        <Field label="Moves in">
          <input type="date" value={start} onChange={(e) => changeStart(e.target.value)} required />
        </Field>
        <Field label="Agreement ends">
          <input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} required />
        </Field>
      </div>
      <div className="quick" role="group" aria-label="Length of stay">
        {[1, 2, 3, 4].map((n) => (
          <button type="button" key={n} className="quick-chip" onClick={() => setTerm(n)} disabled={!validMonths}>
            {n} {n === 1 ? 'period' : 'periods'}
          </button>
        ))}
      </div>

      {pastLease && (
        <p className="warning small">
          This runs past your lease, which ends {fmtDate(lease.endDate)}. You can still save it, but you will need to renew with the landlord.
        </p>
      )}

      <Field label="Deposit held (GHS)">
        <input value={deposit} onChange={(e) => setDeposit(e.target.value)} inputMode="decimal" placeholder="0" />
      </Field>

      {schedule && schedule.length > 0 && (
        <div className="preview">
          <div className="small">
            <strong>{schedule.length === 1 ? '1 payment' : `${schedule.length} payments`} expected</strong> ({periodLabel(months)} each):
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
        {tenancy ? 'Save tenancy' : 'Start tenancy'}
      </button>
    </form>
  );
}

function useUnitContext(unitId: string | undefined) {
  const units = useUnits();
  const leases = useLeases();
  if (!units || !leases) return undefined;
  const unit = units.find((u) => u.id === unitId);
  const lease = unit && leases.find((l) => l.id === unit.leaseId);
  return { unit, lease };
}

export function NewTenancy() {
  const { unitId } = useParams({ strict: false }) as { unitId: string };
  const ctx = useUnitContext(unitId);
  if (!ctx) return <Loading />;
  return (
    <>
      <PageHeader back={<BackLink to="/units/$unitId" params={{ unitId }}>{ctx.unit?.name ?? 'Room'}</BackLink>} title="Start a tenancy" subtitle={ctx.unit?.name} />
      {ctx.unit && ctx.lease ? <TenancyFormBody unit={ctx.unit} lease={ctx.lease} /> : <p className="muted">This room no longer exists.</p>}
    </>
  );
}

export function EditTenancy() {
  const { tenancyId } = useParams({ strict: false }) as { tenancyId: string };
  const tenancies = useTenancies();
  const tenancy = tenancies?.find((t) => t.id === tenancyId);
  const ctx = useUnitContext(tenancy?.unitId);
  if (!tenancies || !ctx) return <Loading />;
  return (
    <>
      <PageHeader
        back={tenancy ? <BackLink to="/units/$unitId" params={{ unitId: tenancy.unitId }}>{ctx.unit?.name ?? 'Room'}</BackLink> : undefined}
        title="Edit tenancy"
        subtitle={ctx.unit?.name}
      />
      {tenancy && ctx.unit && ctx.lease ? <TenancyFormBody unit={ctx.unit} lease={ctx.lease} tenancy={tenancy} /> : <p className="muted">This tenancy no longer exists.</p>}
    </>
  );
}
