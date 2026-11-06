import { createContext, useCallback, useContext, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { todayLocal } from '@subrent/shared';
import { cedi, parseMoneyField, toMoneyField } from '../data/format';
import { useDwellData } from '../data/derive';
import { actions } from '../sync';
import { Field, FormError, useAction } from './ui';
import { Icon } from './Icon';
import { SiteCoordinates } from './SiteCoordinates';

export type AddKind = 'menu' | 'payment' | 'expense' | 'tenant' | 'site' | 'room' | 'issue' | null;

export interface OverlayApi {
  add: AddKind;
  openAdd: (kind?: AddKind) => void;
  closeAdd: () => void;
  toast: string | null;
  showToast: (message: string) => void;
}

const OverlayContext = createContext<OverlayApi | null>(null);

export function useOverlay(): OverlayApi {
  const value = useContext(OverlayContext);
  if (!value) throw new Error('useOverlay must be used inside OverlayProvider');
  return value;
}

export function OverlayProvider({ children }: { children: ReactNode }) {
  const [add, setAdd] = useState<AddKind>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((current) => (current === message ? null : current)), 4200);
  }, []);

  const api = useMemo<OverlayApi>(
    () => ({
      add,
      openAdd: (kind = 'menu' as AddKind) => setAdd(kind),
      closeAdd: () => setAdd(null),
      toast,
      showToast,
    }),
    [add, toast, showToast],
  );

  return (
    <OverlayContext.Provider value={api}>
      {children}
      <AddLayer />
      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <a href="/money">See it</a>
        </div>
      )}
    </OverlayContext.Provider>
  );
}

function AddLayer() {
  const { add, closeAdd, openAdd, showToast } = useOverlay();
  if (!add) return null;

  const done = (message: string) => {
    showToast(message);
    closeAdd();
  };

  return (
    <>
      <button className="sheet-backdrop" aria-label="Close" onClick={closeAdd} />
      <div className={`sheet ${add === 'menu' ? 'bone' : 'bone'}`} role="dialog" aria-modal="true" aria-label="Add something">
        <div className="sheet-handle" />
        <div className="sheet-head">
          {add !== 'menu' ? (
            <button className="btn o sm" onClick={() => openAdd('menu')} style={{ minHeight: 40 }}>
              <Icon name="chevronLeft" size={16} /> Back
            </button>
          ) : (
            <div>
              <div className="sheet-title">Add something</div>
              <div className="sheet-sub">What changed?</div>
            </div>
          )}
          <button
            className="mxc"
            aria-label="Close"
            onClick={closeAdd}
            style={{ width: 44, padding: 0, borderRadius: '50%' }}
          >
            ✕
          </button>
        </div>

        {add === 'menu' && <AddMenu onPick={openAdd} />}
        {add === 'payment' && <PaymentSheet onDone={done} />}
        {add === 'expense' && <ExpenseSheet onDone={done} />}
        {add === 'tenant' && <TenantSheet onDone={done} />}
        {add === 'site' && <SiteSheet onDone={done} />}
        {add === 'room' && <RoomSheet onDone={done} />}
        {add === 'issue' && <IssueSheet onDone={done} />}
      </div>
    </>
  );
}

function AddMenu({ onPick }: { onPick: (kind: AddKind) => void }) {
  const options: { kind: Exclude<AddKind, null | 'menu'>; label: string; sub: string; icon: Parameters<typeof Icon>[0]['name']; tone: string }[] = [
    { kind: 'payment', label: 'Log a payment', sub: 'Rent in, deposit, or a refund', icon: 'card', tone: 'var(--gold)' },
    { kind: 'expense', label: 'Add an expense', sub: 'Repairs, furniture, utilities', icon: 'document', tone: 'var(--coral)' },
    { kind: 'tenant', label: 'Add a tenant', sub: 'Someone new to put in a room', icon: 'peopleAdd', tone: 'var(--mint)' },
    { kind: 'room', label: 'Add a room', sub: 'A room you sublet', icon: 'room', tone: 'var(--sky)' },
    { kind: 'site', label: 'Add a site', sub: 'A house, hostel, or block', icon: 'building', tone: 'var(--gold)' },
    { kind: 'issue', label: 'Report an issue', sub: 'Something broken or worn', icon: 'wrench', tone: 'var(--coral)' },
  ];
  return (
    <>
      <div className="sheet-list">
        {options.map((option) => (
          <button key={option.kind} className="sheet-option" onClick={() => onPick(option.kind)}>
            <span className="ico" style={{ background: option.tone }}>
              <Icon name={option.icon} size={24} />
            </span>
            <span className="opt-text">
              <b>{option.label}</b>
              <span>{option.sub}</span>
            </span>
            <Icon name="chevronRight" size={18} />
          </button>
        ))}
      </div>
      <div className="sheet-actions">
        <button className="btn o" onClick={() => onPick(null)}>
          Cancel
        </button>
      </div>
    </>
  );
}

function PaymentSheet({ onDone }: { onDone: (message: string) => void }) {
  const data = useDwellData();
  const { error, busy, run } = useAction();
  const occupied = data?.rooms.filter((room) => room.current) ?? [];
  const [roomId, setRoomId] = useState(occupied[0]?.unit.id ?? '');
  const room = occupied.find((r) => r.unit.id === roomId) ?? occupied[0];
  const nextEntry = data?.entries
    .filter((entry) => entry.tenancyId === room?.current?.id && entry.dueDate <= (data?.today ?? todayLocal()))
    .sort((a, b) => b.dueDate.localeCompare(a.dueDate))[0];
  const [amount, setAmount] = useState(toMoneyField(nextEntry?.amountDue ?? room?.current?.rentAmount ?? 0));
  const [method, setMethod] = useState<'momo' | 'cash' | 'bank'>('momo');
  const [paidOn, setPaidOn] = useState(todayLocal());
  const [note, setNote] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    const saved = await run(() =>
      actions.logPayment({
        amount: parseMoneyField(amount) ?? 0,
        paidOn,
        method,
        scheduleEntryId: nextEntry?.id ?? null,
        note,
      }),
    );
    if (saved) onDone(`${cedi(saved.amount)} logged`);
  }

  if (!data) {
    return <p className="sheet-sub">Loading your rooms…</p>;
  }
  if (occupied.length === 0) {
    return (
      <>
        <p className="sheet-sub">No tenant is in a room yet. Add a tenant and start a tenancy first.</p>
        <div className="sheet-actions">
          <button className="btn o" onClick={() => onDone('Nothing logged')}>Close</button>
        </div>
      </>
    );
  }

  return (
    <form className="form" onSubmit={submit}>
      <div className="room-pick" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 20, background: '#E9E3D3' }}>
        <span className="avatar dark">{room?.tenantName.slice(0, 1)}</span>
        <span style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <b>{room?.tenantName}</b>
          <span style={{ fontSize: 13, color: 'var(--bmu)' }}>
            {room?.unit.name} · {room?.site.name}
            {nextEntry ? ` · due ${nextEntry.dueDate}` : ''}
          </span>
        </span>
      </div>
      {occupied.length > 1 && (
        <Field label="Who paid?">
          <select value={roomId} onChange={(event) => {
            const next = occupied.find((r) => r.unit.id === event.target.value);
            setRoomId(event.target.value);
            setAmount(toMoneyField(next?.current?.rentAmount ?? 0));
          }}>
            {occupied.map((r) => (
              <option key={r.unit.id} value={r.unit.id}>
                {r.tenantName} · {r.unit.name} · {r.site.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Amount (GHS)">
        <input className="fb" value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" required />
      </Field>
      <div className="sheet-list" style={{ gap: 8 }}>
        <span style={{ fontWeight: 700 }}>How did it come in?</span>
        <div className="quick">
          {(['momo', 'cash', 'bank'] as const).map((option) => (
            <button
              type="button"
              key={option}
              className={`mxc ${method === option ? 'on' : ''}`}
              onClick={() => setMethod(option)}
            >
              {option === 'momo' ? 'MoMo' : option === 'cash' ? 'Cash' : 'Bank'}
            </button>
          ))}
        </div>
      </div>
      <div className="two">
        <Field label="Date">
          <input type="date" value={paidOn} onChange={(event) => setPaidOn(event.target.value)} required />
        </Field>
        <Field label="Note">
          <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional" />
        </Field>
      </div>
      <FormError message={error} />
      <div className="sheet-actions">
        <button className="btn k" disabled={busy}>
          {busy ? 'Saving…' : 'Log payment'}
        </button>
      </div>
    </form>
  );
}

function ExpenseSheet({ onDone }: { onDone: (message: string) => void }) {
  const data = useDwellData();
  const { error, busy, run } = useAction();
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<'maintenance' | 'repair' | 'cleaning' | 'furnishing' | 'other'>('repair');
  const [siteId, setSiteId] = useState(data?.sites[0]?.id ?? '');
  const [unitId, setUnitId] = useState('');
  const [vendor, setVendor] = useState('');
  const [spentOn, setSpentOn] = useState(todayLocal());
  const [note, setNote] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    const saved = await run(() =>
      actions.addExpense({
        amount: parseMoneyField(amount) ?? 0,
        spentOn,
        category,
        siteId: unitId ? null : siteId || null,
        unitId: unitId || null,
        vendor,
        note,
      }),
    );
    if (saved) onDone(`${cedi(saved.amount)} expense saved`);
  }

  if (!data) return <p className="sheet-sub">Loading…</p>;

  const roomOptions = unitId
    ? []
    : data.rooms.filter((room) => !siteId || room.site.id === siteId);

  return (
    <form className="form" onSubmit={submit}>
      <Field label="Amount (GHS)">
        <input className="fb" value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="0" required />
      </Field>
      <div className="sheet-list" style={{ gap: 8 }}>
        <span style={{ fontWeight: 700 }}>What was it?</span>
        <div className="quick">
          {([
            ['repair', 'Repairs'],
            ['furnishing', 'Furniture'],
            ['other', 'Utilities'],
            ['cleaning', 'Cleaning'],
          ] as const).map(([value, label]) => (
            <button
              type="button"
              key={value}
              className={`mxc ${category === value ? 'on' : ''}`}
              onClick={() => setCategory(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <Field label="Where?">
        <select
          value={unitId ? `room:${unitId}` : siteId ? `site:${siteId}` : ''}
          onChange={(event) => {
            const value = event.target.value;
            if (value.startsWith('room:')) {
              setUnitId(value.slice(5));
            } else {
              setUnitId('');
              setSiteId(value.slice(5));
            }
          }}
        >
          {data.sites.map((site) => (
            <option key={`site-${site.id}`} value={`site:${site.id}`}>
              {site.name} (shared)
            </option>
          ))}
          {roomOptions.map((room) => (
            <option key={`room-${room.unit.id}`} value={`room:${room.unit.id}`}>
              {room.unit.name} only · {room.site.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="two">
        <Field label="Date">
          <input type="date" value={spentOn} onChange={(event) => setSpentOn(event.target.value)} required />
        </Field>
        <Field label="Paid to">
          <input value={vendor} onChange={(event) => setVendor(event.target.value)} placeholder="Optional" />
        </Field>
      </div>
      <Field label="Note">
        <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="What was bought or fixed?" />
      </Field>
      <FormError message={error} />
      <div className="sheet-actions">
        <button className="btn k" disabled={busy}>
          {busy ? 'Saving…' : 'Add expense'}
        </button>
      </div>
    </form>
  );
}

function TenantSheet({ onDone }: { onDone: (message: string) => void }) {
  const { error, busy, run } = useAction();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [idDetails, setIdDetails] = useState('');
  const [guarantor, setGuarantor] = useState('');

  return (
    <form
      className="form"
      onSubmit={async (event) => {
        event.preventDefault();
        const saved = await run(() => actions.saveTenant({ name, phone, idDetails, guarantor }));
        if (saved) onDone(`${saved.name} added`);
      }}
    >
      <Field label="Full name">
        <input className="fb" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Ama Mensah" required />
      </Field>
      <Field label="Phone">
        <input className="fb" value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" placeholder="024 000 0000" />
      </Field>
      <div className="two">
        <Field label="ID details">
          <input value={idDetails} onChange={(event) => setIdDetails(event.target.value)} placeholder="Ghana Card" />
        </Field>
        <Field label="Guarantor">
          <input value={guarantor} onChange={(event) => setGuarantor(event.target.value)} placeholder="Optional" />
        </Field>
      </div>
      <FormError message={error} />
      <div className="sheet-actions">
        <button className="btn k" disabled={busy}>
          {busy ? 'Saving…' : 'Add tenant'}
        </button>
      </div>
    </form>
  );
}

function SiteSheet({ onDone }: { onDone: (message: string) => void }) {
  const { error, busy, run } = useAction();
  const [name, setName] = useState('');
  const [type, setType] = useState<'house' | 'hostel' | 'block'>('house');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');

  return (
    <form
      className="form"
      onSubmit={async (event) => {
        event.preventDefault();
        const saved = await run(() => actions.saveSite({ name, type, address, lat, lng }));
        if (saved) onDone(`${saved.name} added`);
      }}
    >
      <Field label="Name">
        <input className="fb" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Osu hostel" required />
      </Field>
      <Field label="Type">
        <select value={type} onChange={(event) => setType(event.target.value as typeof type)}>
          <option value="house">House</option>
          <option value="hostel">Hostel</option>
          <option value="block">Apartment block</option>
        </select>
      </Field>
      <Field label="Address">
        <input className="fb" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="e.g. 12 Palm Avenue, Osu, Accra" />
      </Field>
      <SiteCoordinates address={address} lat={lat} lng={lng} onLatChange={setLat} onLngChange={setLng} compact />
      <FormError message={error} />
      <div className="sheet-actions">
        <button className="btn k" disabled={busy}>
          {busy ? 'Saving…' : 'Add site'}
        </button>
      </div>
    </form>
  );
}

function RoomSheet({ onDone }: { onDone: (message: string) => void }) {
  const data = useDwellData();
  const { error, busy, run } = useAction();
  const [leaseId, setLeaseId] = useState(data?.leases[0]?.id ?? '');
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [weight, setWeight] = useState('1');

  async function submit(event: FormEvent) {
    event.preventDefault();
    const saved = await run(() =>
      actions.saveUnit(leaseId, {
        name,
        targetPrice: parseMoneyField(price),
        unfurnishedBaseline: null,
        allocationWeight: Number(weight),
      }),
    );
    if (saved) onDone(`${saved.name} added`);
  }

  if (!data) return <p className="sheet-sub">Loading…</p>;
  if (data.leases.length === 0) {
    return (
      <>
        <p className="sheet-sub">Add a site and lease before adding rooms.</p>
        <div className="sheet-actions">
          <button className="btn o" onClick={() => onDone('Nothing added')}>Close</button>
        </div>
      </>
    );
  }

  return (
    <form className="form" onSubmit={submit}>
      <Field label="Under which lease?">
        <select value={leaseId} onChange={(event) => setLeaseId(event.target.value)}>
          {data.leases.map((lease) => {
            const site = data.sites.find((s) => s.id === lease.siteId);
            return (
              <option key={lease.id} value={lease.id}>
                {site?.name ?? 'Site'} · ends {lease.endDate}
              </option>
            );
          })}
        </select>
      </Field>
      <Field label="Room name">
        <input className="fb" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Room 35" required />
      </Field>
      <div className="two">
        <Field label="Asking rent (GHS)">
          <input value={price} onChange={(event) => setPrice(event.target.value)} inputMode="decimal" placeholder="Optional" />
        </Field>
        <Field label="Rent share">
          <input type="number" min={1} value={weight} onChange={(event) => setWeight(event.target.value)} />
        </Field>
      </div>
      <FormError message={error} />
      <div className="sheet-actions">
        <button className="btn k" disabled={busy}>
          {busy ? 'Saving…' : 'Add room'}
        </button>
      </div>
    </form>
  );
}

function IssueSheet({ onDone }: { onDone: (message: string) => void }) {
  const data = useDwellData();
  const { error, busy, run } = useAction();
  const [itemId, setItemId] = useState(data?.items[0]?.id ?? '');
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState('0');
  const [fixedBy, setFixedBy] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    const saved = await run(() =>
      actions.addRepair({
        itemId,
        repairedOn: todayLocal(),
        cost: parseMoneyField(cost) ?? 0,
        description,
        fixedBy,
      }),
    );
    if (saved) onDone('Issue logged');
  }

  if (!data) return <p className="sheet-sub">Loading…</p>;
  if (data.items.length === 0) {
    return (
      <>
        <p className="sheet-sub">
          Issues are logged against a piece of inventory. Add an item to a room first, then report what went wrong.
        </p>
        <div className="sheet-actions">
          <a className="btn k link-button" href="/inventory">Open inventory</a>
          <button className="btn o" type="button" onClick={() => onDone('Nothing logged')}>Close</button>
        </div>
      </>
    );
  }

  return (
    <form className="form" onSubmit={submit}>
      <Field label="What is it?">
        <select value={itemId} onChange={(event) => setItemId(event.target.value)}>
          {data.items.map((item) => {
            const room = data.rooms.find((r) => r.unit.id === item.unitId);
            return (
              <option key={item.id} value={item.id}>
                {item.name} · {room?.unit.name ?? 'Room'}
              </option>
            );
          })}
        </select>
      </Field>
      <Field label="What happened?">
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="e.g. The shower head is leaking" />
      </Field>
      <div className="two">
        <Field label="Cost (GHS)">
          <input value={cost} onChange={(event) => setCost(event.target.value)} inputMode="decimal" />
        </Field>
        <Field label="Fixed by">
          <input value={fixedBy} onChange={(event) => setFixedBy(event.target.value)} placeholder="Optional" />
        </Field>
      </div>
      <FormError message={error} />
      <div className="sheet-actions">
        <button className="btn k" disabled={busy}>
          {busy ? 'Saving…' : 'Log issue'}
        </button>
      </div>
    </form>
  );
}
