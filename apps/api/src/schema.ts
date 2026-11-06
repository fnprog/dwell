import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  date,
  doublePrecision,
  index,
  integer,
  pgSequence,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * One global, ever-increasing counter. Every insert or update stamps the row
 * with the next value, and devices pull "everything with seq greater than my cursor".
 */
export const syncSeq = pgSequence('sync_seq', { startWith: 1 });

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'string' });
/** Money: integer pesewas. Never floating point. */
const money = (name: string) => bigint(name, { mode: 'number' });

/** Columns every synced table carries. */
const syncColumns = {
  id: uuid('id').primaryKey(),
  seq: bigint('seq', { mode: 'number' })
    .notNull()
    .default(sql`nextval('sync_seq')`),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  deletedAt: ts('deleted_at'),
};

export const users = pgTable(
  'users',
  {
    ...syncColumns,
    name: text('name').notNull(),
    phone: text('phone'),
    email: text('email').notNull(),
    role: text('role', { enum: ['owner', 'staff'] }).notNull().default('owner'),
    passwordHash: text('password_hash').notNull(),
  },
  (t) => [index('users_seq_idx').on(t.seq), index('users_email_idx').on(t.email)],
);

export const sites = pgTable(
  'sites',
  {
    ...syncColumns,
    name: text('name').notNull(),
    address: text('address'),
    type: text('type', { enum: ['house', 'hostel', 'block'] }).notNull().default('house'),
    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),
    notes: text('notes'),
  },
  (t) => [index('sites_seq_idx').on(t.seq)],
);

export const landlords = pgTable(
  'landlords',
  {
    ...syncColumns,
    name: text('name').notNull(),
    phone: text('phone'),
    notes: text('notes'),
  },
  (t) => [index('landlords_seq_idx').on(t.seq)],
);

export const leases = pgTable(
  'leases',
  {
    ...syncColumns,
    siteId: uuid('site_id').notNull().references(() => sites.id),
    landlordId: uuid('landlord_id').notNull().references(() => landlords.id),
    rentAmount: money('rent_amount').notNull(),
    /** Length of one rent period in months (2, 3, 6, 12 ...). Set per agreement. */
    periodMonths: integer('period_months').notNull(),
    startDate: date('start_date', { mode: 'string' }).notNull(),
    endDate: date('end_date', { mode: 'string' }).notNull(),
    advancePaid: money('advance_paid').notNull().default(0),
    depositPaid: money('deposit_paid').notNull().default(0),
    contractFileKey: text('contract_file_key'),
    status: text('status', { enum: ['upcoming', 'active', 'ended'] }).notNull().default('active'),
    notes: text('notes'),
  },
  (t) => [
    index('leases_seq_idx').on(t.seq),
    check('leases_period_positive', sql`${t.periodMonths} > 0`),
    check('leases_dates_ordered', sql`${t.endDate} >= ${t.startDate}`),
  ],
);

export const units = pgTable(
  'units',
  {
    ...syncColumns,
    leaseId: uuid('lease_id').notNull().references(() => leases.id),
    name: text('name').notNull(),
    targetPrice: money('target_price'),
    /** What the room would rent for unfurnished. Used for furnishing ROI. */
    unfurnishedBaseline: money('unfurnished_baseline'),
    /** Share of lease rent and shared costs; 100 = normal, equal split by default. */
    allocationWeight: integer('allocation_weight').notNull().default(100),
    status: text('status', { enum: ['vacant', 'occupied', 'off_market'] }).notNull().default('vacant'),
  },
  (t) => [
    index('units_seq_idx').on(t.seq),
    index('units_lease_idx').on(t.leaseId),
    check('units_weight_positive', sql`${t.allocationWeight} > 0`),
  ],
);

export const tenants = pgTable(
  'tenants',
  {
    ...syncColumns,
    name: text('name').notNull(),
    phone: text('phone'),
    idDetails: text('id_details'),
    guarantor: text('guarantor'),
    notes: text('notes'),
  },
  (t) => [index('tenants_seq_idx').on(t.seq)],
);

export const tenancies = pgTable(
  'tenancies',
  {
    ...syncColumns,
    unitId: uuid('unit_id').notNull().references(() => units.id),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
    rentAmount: money('rent_amount').notNull(),
    periodMonths: integer('period_months').notNull(),
    startDate: date('start_date', { mode: 'string' }).notNull(),
    endDate: date('end_date', { mode: 'string' }),
    depositHeld: money('deposit_held').notNull().default(0),
    contractFileKey: text('contract_file_key'),
    status: text('status', { enum: ['upcoming', 'active', 'ended'] }).notNull().default('active'),
  },
  (t) => [
    index('tenancies_seq_idx').on(t.seq),
    index('tenancies_unit_idx').on(t.unitId),
    check('tenancies_period_positive', sql`${t.periodMonths} > 0`),
  ],
);

export const scheduleEntries = pgTable(
  'schedule_entries',
  {
    ...syncColumns,
    kind: text('kind', { enum: ['landlord_rent', 'tenant_rent'] }).notNull(),
    leaseId: uuid('lease_id').references(() => leases.id),
    tenancyId: uuid('tenancy_id').references(() => tenancies.id),
    dueDate: date('due_date', { mode: 'string' }).notNull(),
    amountDue: money('amount_due').notNull(),
  },
  (t) => [
    index('schedule_entries_seq_idx').on(t.seq),
    index('schedule_entries_due_idx').on(t.dueDate),
    check(
      'schedule_entries_has_parent',
      sql`(${t.kind} = 'landlord_rent' and ${t.leaseId} is not null) or (${t.kind} = 'tenant_rent' and ${t.tenancyId} is not null)`,
    ),
  ],
);

/** Append-only. A correction is a new row that points at the one it reverses. */
export const payments = pgTable(
  'payments',
  {
    ...syncColumns,
    scheduleEntryId: uuid('schedule_entry_id').references(() => scheduleEntries.id),
    direction: text('direction', { enum: ['in', 'out'] }).notNull(),
    /** Negative amounts are only valid on reversing entries. */
    amount: money('amount').notNull(),
    paidOn: date('paid_on', { mode: 'string' }).notNull(),
    method: text('method', { enum: ['cash', 'momo', 'bank', 'other'] }).notNull().default('momo'),
    reference: text('reference'),
    note: text('note'),
    reversesPaymentId: uuid('reverses_payment_id'),
  },
  (t) => [
    index('payments_seq_idx').on(t.seq),
    index('payments_schedule_idx').on(t.scheduleEntryId),
    check(
      'payments_sign',
      sql`(${t.reversesPaymentId} is null and ${t.amount} > 0) or (${t.reversesPaymentId} is not null and ${t.amount} < 0)`,
    ),
  ],
);

/** Append-only, like payments. */
export const expenses = pgTable(
  'expenses',
  {
    ...syncColumns,
    unitId: uuid('unit_id').references(() => units.id),
    siteId: uuid('site_id').references(() => sites.id),
    category: text('category', {
      enum: ['maintenance', 'repair', 'cleaning', 'furnishing', 'other'],
    }).notNull(),
    amount: money('amount').notNull(),
    spentOn: date('spent_on', { mode: 'string' }).notNull(),
    vendor: text('vendor'),
    note: text('note'),
    receiptFileKey: text('receipt_file_key'),
    reversesExpenseId: uuid('reverses_expense_id'),
  },
  (t) => [
    index('expenses_seq_idx').on(t.seq),
    check('expenses_has_target', sql`${t.unitId} is not null or ${t.siteId} is not null`),
    check(
      'expenses_sign',
      sql`(${t.reversesExpenseId} is null and ${t.amount} > 0) or (${t.reversesExpenseId} is not null and ${t.amount} < 0)`,
    ),
  ],
);

export const items = pgTable(
  'items',
  {
    ...syncColumns,
    unitId: uuid('unit_id').notNull().references(() => units.id),
    name: text('name').notNull(),
    category: text('category'),
    photoFileKey: text('photo_file_key'),
    serialNumber: text('serial_number'),
    purchaseDate: date('purchase_date', { mode: 'string' }),
    cost: money('cost').notNull().default(0),
    usefulLifeMonths: integer('useful_life_months'),
    condition: text('condition', {
      enum: ['good', 'fair', 'needs_repair', 'broken', 'disposed'],
    }).notNull().default('good'),
  },
  (t) => [index('items_seq_idx').on(t.seq), index('items_unit_idx').on(t.unitId)],
);

export const repairs = pgTable(
  'repairs',
  {
    ...syncColumns,
    itemId: uuid('item_id').notNull().references(() => items.id),
    repairedOn: date('repaired_on', { mode: 'string' }).notNull(),
    cost: money('cost').notNull().default(0),
    description: text('description'),
    fixedBy: text('fixed_by'),
    expenseId: uuid('expense_id').references(() => expenses.id),
  },
  (t) => [index('repairs_seq_idx').on(t.seq), index('repairs_item_idx').on(t.itemId)],
);

export const documents = pgTable(
  'documents',
  {
    ...syncColumns,
    ownerType: text('owner_type', {
      enum: ['lease', 'tenancy', 'item', 'expense', 'site', 'tenant'],
    }).notNull(),
    ownerId: uuid('owner_id').notNull(),
    fileKey: text('file_key').notNull(),
    fileName: text('file_name'),
    kind: text('kind'),
    uploadedBy: uuid('uploaded_by'),
  },
  (t) => [index('documents_seq_idx').on(t.seq), index('documents_owner_idx').on(t.ownerType, t.ownerId)],
);

/** Keys match ENTITY_NAMES in @subrent/shared. */
export const tables = {
  users,
  sites,
  landlords,
  leases,
  units,
  tenants,
  tenancies,
  scheduleEntries,
  payments,
  expenses,
  items,
  repairs,
  documents,
} as const;
