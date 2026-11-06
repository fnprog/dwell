import {
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { Shell } from './components/Shell';
import { CalendarPage } from './pages/Calendar';
import { ContractPage } from './pages/Contract';
import { Dashboard } from './pages/Dashboard';
import { InboxPage } from './pages/Inbox';
import { InventoryPage } from './pages/Inventory';
import { IssuesPage } from './pages/Issues';
import { LandlordsPage } from './pages/Landlords';
import { LeaseDetail } from './pages/LeaseDetail';
import { EditLease, NewLease } from './pages/LeaseForm';
import { MapPage } from './pages/MapPage';
import { MoneyPage } from './pages/Money';
import { RemindersPage } from './pages/Reminders';
import { SettingsPage } from './pages/Settings';
import { SiteDetail } from './pages/SiteDetail';
import { SitesPage } from './pages/Sites';
import { SyncPage } from './pages/Sync';
import { EditTenancy, NewTenancy } from './pages/TenancyForm';
import { TenantDetail, TenantsPage } from './pages/Tenants';
import { UnitDetail } from './pages/UnitDetail';

const rootRoute = createRootRoute({ component: Shell });
// `P` keeps each path as a literal type, so links and params are checked against the real route table.
const route = <P extends string>(path: P, component: () => React.JSX.Element) =>
  createRoute({ getParentRoute: () => rootRoute, path, component });

const routeTree = rootRoute.addChildren([
  route('/', Dashboard),
  route('/sites', SitesPage),
  route('/sites/$siteId', SiteDetail),
  route('/sites/$siteId/leases/new', NewLease),
  route('/leases/$leaseId', LeaseDetail),
  route('/leases/$leaseId/edit', EditLease),
  route('/units/$unitId', UnitDetail),
  route('/units/$unitId/tenancies/new', NewTenancy),
  route('/tenancies/$tenancyId/edit', EditTenancy),
  route('/tenants', TenantsPage),
  route('/tenants/$tenantId', TenantDetail),
  route('/landlords', LandlordsPage),
  route('/map', MapPage),
  route('/calendar', CalendarPage),
  route('/inbox', InboxPage),
  route('/money', MoneyPage),
  route('/issues', IssuesPage),
  route('/reminders', RemindersPage),
  route('/settings', SettingsPage),
  route('/more', SettingsPage),
  route('/inventory', InventoryPage),
  route('/contract', ContractPage),
  route('/sync', SyncPage),
]);

const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export function App() {
  return <RouterProvider router={router} />;
}
