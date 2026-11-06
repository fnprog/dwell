import { useState, type FormEvent } from 'react';
import { cedi, fmtDate, plural } from '../data/format';
import { useDwellData } from '../data/derive';
import { parseMoneyField } from '../data/format';
import { actions } from '../sync';
import { Icon } from '../components/Icon';
import { Field, FormError, Loading, useAction } from '../components/ui';
import type { Item } from '../data/types';

const CONDITIONS: { value: Item['condition']; label: string }[] = [
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'needs_repair', label: 'Needs repair' },
  { value: 'broken', label: 'Broken' },
  { value: 'disposed', label: 'Disposed' },
];

export function InventoryPage() {
  const data = useDwellData();
  const [roomId, setRoomId] = useState('');
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);

  if (!data) return <Loading />;
  const needle = query.trim().toLowerCase();
  const items = data.items
    .filter((item) => (!roomId || item.unitId === roomId) && (!needle || item.name.toLowerCase().includes(needle)))
    .sort((a, b) => a.name.localeCompare(b.name));
  const total = data.items.reduce((sum, item) => sum + item.cost, 0);
  const needRepair = data.items.filter((item) => item.condition === 'needs_repair' || item.condition === 'broken').length;

  return (
    <>
      <header className="page-header">
        <div className="page-heading">
          <h1 className="page-title">Inventory</h1>
          <p className="page-subtitle">Everything you have put into the rooms.</p>
        </div>
        <div className="page-actions">
          <button className="btn g" onClick={() => setAdding((open) => !open)}>
            <Icon name="plus" size={18} strokeWidth={2.4} /> {adding ? 'Close' : 'Add an item'}
          </button>
        </div>
      </header>

      <section className="inventory-summary">
        <div className="card issue-stat"><span className="ico lg" style={{ background: 'var(--gold)' }}><Icon name="box" size={24} /></span><span><b className="d n">{data.items.length}</b><span className="mu">Items</span></span></div>
        <div className="card issue-stat"><span className="ico lg" style={{ background: 'var(--mint)' }}><Icon name="money" size={24} /></span><span><b className="d n">{cedi(total)}</b><span className="mu">Replace value</span></span></div>
        <div className="card issue-stat"><span className="ico lg" style={{ background: 'var(--coral)' }}><Icon name="wrench" size={24} /></span><span><b className="d n">{needRepair}</b><span className="mu">Need attention</span></span></div>
      </section>

      {adding && <ItemForm rooms={data.rooms.map((room) => ({ id: room.unit.id, name: `${room.site.name} · ${room.unit.name}` }))} onDone={() => setAdding(false)} />}

      <div className="filter-row">
        <label className="search-field">
          <Icon name="search" size={17} />
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search items" aria-label="Search items" />
        </label>
        <select value={roomId} onChange={(event) => setRoomId(event.target.value)} aria-label="Filter by room" style={{ width: 'auto', minWidth: 220 }}>
          <option value="">All rooms</option>
          {data.rooms.map((room) => (
            <option key={room.unit.id} value={room.unit.id}>{room.unit.name} · {room.site.name}</option>
          ))}
        </select>
      </div>

      {items.length === 0 ? (
        <div className="empty-card">
          <span className="ico lg" style={{ background: 'var(--s2)', color: 'var(--tx)' }}><Icon name="box" size={28} /></span>
          <b className="d" style={{ fontSize: 26, color: 'var(--tx)' }}>{data.items.length === 0 ? 'Nothing logged yet' : 'No items match'}</b>
          <span>Add beds, fridges, fans, and anything else that would cost money to replace.</span>
          <button className="btn g" onClick={() => setAdding(true)}>Add an item</button>
        </div>
      ) : (
        <section className="inventory-grid" aria-label="Inventory">
          {items.map((item) => {
            const room = data.rooms.find((r) => r.unit.id === item.unitId);
            return (
              <article key={item.id} className="card item-card">
                <div className="row-between">
                  <span className={`pill ${item.condition === 'broken' ? 'bad' : item.condition === 'needs_repair' ? 'warn' : item.condition === 'good' ? 'ok' : ''}`}>
                    {CONDITIONS.find((condition) => condition.value === item.condition)?.label ?? item.condition}
                  </span>
                  <span className="mu small">{item.category ?? 'Item'}</span>
                </div>
                <h3 className="d" style={{ fontSize: 26, fontWeight: 800 }}>{item.name}</h3>
                <span className="mu small">{room ? `${room.unit.name} · ${room.site.name}` : 'Room not found'}</span>
                <div className="row-between" style={{ marginTop: 'auto', paddingTop: 14 }}>
                  <span className="mu small">{item.purchaseDate ? `Bought ${fmtDate(item.purchaseDate)}` : 'No purchase date'}</span>
                  <b className="n">{cedi(item.cost)}</b>
                </div>
              </article>
            );
          })}
        </section>
      )}

      <p className="mu small">{plural(data.rooms.length, 'room')} covered. Items are tied to a room so an issue always has an owner.</p>
    </>
  );
}

function ItemForm({ rooms, onDone }: { rooms: { id: string; name: string }[]; onDone: () => void }) {
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? '');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [cost, setCost] = useState('');
  const [condition, setCondition] = useState<Item['condition']>('good');
  const [serial, setSerial] = useState('');
  const { error, busy, run } = useAction();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const saved = await run(() =>
      actions.saveItem({
        unitId: roomId,
        name,
        category,
        cost: parseMoneyField(cost) ?? 0,
        condition,
        serialNumber: serial,
      }),
    );
    if (saved) onDone();
  }

  if (rooms.length === 0) {
    return <div className="card" style={{ padding: 24 }}><p className="mu">Add a site, lease, and room before logging inventory.</p></div>;
  }

  return (
    <form className="card form" onSubmit={submit}>
      <div className="two">
        <Field label="Which room?">
          <select value={roomId} onChange={(event) => setRoomId(event.target.value)}>
            {rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
          </select>
        </Field>
        <Field label="Item name">
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Double bed" required />
        </Field>
      </div>
      <div className="two">
        <Field label="Category">
          <input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Furniture, appliance…" />
        </Field>
        <Field label="Cost (GHS)">
          <input value={cost} onChange={(event) => setCost(event.target.value)} inputMode="decimal" placeholder="0" />
        </Field>
      </div>
      <div className="two">
        <Field label="Condition">
          <select value={condition} onChange={(event) => setCondition(event.target.value as Item['condition'])}>
            {CONDITIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </Field>
        <Field label="Serial number">
          <input value={serial} onChange={(event) => setSerial(event.target.value)} placeholder="Optional" />
        </Field>
      </div>
      <FormError message={error} />
      <button className="btn g" style={{ alignSelf: 'flex-start' }} disabled={busy}>Add item</button>
    </form>
  );
}
