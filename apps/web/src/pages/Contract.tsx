import { Link } from '@tanstack/react-router';
import { cedi, fmtDate, periodLabel } from '../data/format';
import { useDwellData } from '../data/derive';
import { Icon } from '../components/Icon';
import { Loading } from '../components/ui';

export function ContractPage() {
  const data = useDwellData();
  if (!data) return <Loading />;

  const contracts = data.leases.map((lease) => {
    const site = data.sites.find((s) => s.id === lease.siteId);
    const landlord = data.landlords.find((l) => l.id === lease.landlordId);
    const rooms = data.rooms.filter((room) => room.lease.id === lease.id);
    const documents = data.documents.filter((document) => document.leaseId === lease.id);
    return { lease, site, landlord, rooms, documents };
  });

  return (
    <>
      <header className="page-header">
        <div className="page-heading">
          <h1 className="page-title">Contracts</h1>
          <p className="page-subtitle">The paper behind every room.</p>
        </div>
        <div className="page-actions">
          <button className="btn g" onClick={() => window.print()}><Icon name="download" size={17} /> Print all</button>
        </div>
      </header>

      {contracts.length === 0 ? (
        <div className="empty-card">
          <span className="ico lg" style={{ background: 'var(--s2)', color: 'var(--tx)' }}><Icon name="document" size={28} /></span>
          <b className="d" style={{ fontSize: 26, color: 'var(--tx)' }}>No contracts yet</b>
          <span>Add a lease and Dwell will keep its terms here.</span>
          <Link to="/sites" className="btn g">Open portfolio</Link>
        </div>
      ) : (
        <section className="contract-grid">
          {contracts.map(({ lease, site, landlord, rooms, documents }) => {
            const active = lease.startDate <= data.today && lease.endDate >= data.today;
            const paper = documents[0];
            return (
              <article key={lease.id} className="contract-paper">
                <div className="contract-head">
                  <span className="contract-brand"><Icon name="document" size={20} /> Dwell contract</span>
                  <span className={`pill ${active ? 'ok' : 'bad'}`}>{active ? 'In force' : 'Ended'}</span>
                </div>
                <h2 className="d contract-title">{site?.name ?? 'Site'}</h2>
                <p className="contract-sub">Landlord lease · {landlord?.name ?? 'Landlord'}</p>
                <div className="contract-terms">
                  <div><span>Rent</span><b>{cedi(lease.rentAmount)}</b><span>every {periodLabel(lease.periodMonths)}</span></div>
                  <div><span>Started</span><b>{fmtDate(lease.startDate)}</b></div>
                  <div><span>Ends</span><b>{fmtDate(lease.endDate)}</b></div>
                  <div><span>Rooms</span><b>{rooms.length}</b></div>
                  <div><span>Advance</span><b>{cedi(lease.advancePaid)}</b></div>
                  <div><span>Deposit</span><b>{cedi(lease.depositPaid)}</b></div>
                </div>
                <div className="contract-signatures">
                  <span><b>{landlord?.name ?? 'Landlord'}</b><span>Landlord</span></span>
                  <span><b>Dwell Property</b><span>Tenant</span></span>
                </div>
                <div className="row wrap" style={{ marginTop: 'auto' }}>
                  <Link to="/leases/$leaseId" params={{ leaseId: lease.id }} className="btn k">Open lease</Link>
                  <button className="btn o" onClick={() => window.print()}>Print</button>
                  <span className="pill" style={{ marginLeft: 'auto' }}>{paper ? paper.name : 'No file attached'}</span>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </>
  );
}
