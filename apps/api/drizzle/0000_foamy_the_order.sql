CREATE SEQUENCE "public"."sync_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"seq" bigint DEFAULT nextval('sync_seq') NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"owner_type" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"file_key" text NOT NULL,
	"file_name" text,
	"kind" text,
	"uploaded_by" uuid
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY NOT NULL,
	"seq" bigint DEFAULT nextval('sync_seq') NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"unit_id" uuid,
	"site_id" uuid,
	"category" text NOT NULL,
	"amount" bigint NOT NULL,
	"spent_on" date NOT NULL,
	"vendor" text,
	"note" text,
	"receipt_file_key" text,
	"reverses_expense_id" uuid,
	CONSTRAINT "expenses_has_target" CHECK ("expenses"."unit_id" is not null or "expenses"."site_id" is not null),
	CONSTRAINT "expenses_sign" CHECK (("expenses"."reverses_expense_id" is null and "expenses"."amount" > 0) or ("expenses"."reverses_expense_id" is not null and "expenses"."amount" < 0))
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"seq" bigint DEFAULT nextval('sync_seq') NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"unit_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"photo_file_key" text,
	"serial_number" text,
	"purchase_date" date,
	"cost" bigint DEFAULT 0 NOT NULL,
	"useful_life_months" integer,
	"condition" text DEFAULT 'good' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "landlords" (
	"id" uuid PRIMARY KEY NOT NULL,
	"seq" bigint DEFAULT nextval('sync_seq') NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"name" text NOT NULL,
	"phone" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "leases" (
	"id" uuid PRIMARY KEY NOT NULL,
	"seq" bigint DEFAULT nextval('sync_seq') NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"site_id" uuid NOT NULL,
	"landlord_id" uuid NOT NULL,
	"rent_amount" bigint NOT NULL,
	"period_months" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"advance_paid" bigint DEFAULT 0 NOT NULL,
	"deposit_paid" bigint DEFAULT 0 NOT NULL,
	"contract_file_key" text,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	CONSTRAINT "leases_period_positive" CHECK ("leases"."period_months" > 0),
	CONSTRAINT "leases_dates_ordered" CHECK ("leases"."end_date" >= "leases"."start_date")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"seq" bigint DEFAULT nextval('sync_seq') NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"schedule_entry_id" uuid,
	"direction" text NOT NULL,
	"amount" bigint NOT NULL,
	"paid_on" date NOT NULL,
	"method" text DEFAULT 'momo' NOT NULL,
	"reference" text,
	"note" text,
	"reverses_payment_id" uuid,
	CONSTRAINT "payments_sign" CHECK (("payments"."reverses_payment_id" is null and "payments"."amount" > 0) or ("payments"."reverses_payment_id" is not null and "payments"."amount" < 0))
);
--> statement-breakpoint
CREATE TABLE "repairs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"seq" bigint DEFAULT nextval('sync_seq') NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"item_id" uuid NOT NULL,
	"repaired_on" date NOT NULL,
	"cost" bigint DEFAULT 0 NOT NULL,
	"description" text,
	"fixed_by" text,
	"expense_id" uuid
);
--> statement-breakpoint
CREATE TABLE "schedule_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"seq" bigint DEFAULT nextval('sync_seq') NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"kind" text NOT NULL,
	"lease_id" uuid,
	"tenancy_id" uuid,
	"due_date" date NOT NULL,
	"amount_due" bigint NOT NULL,
	CONSTRAINT "schedule_entries_has_parent" CHECK (("schedule_entries"."kind" = 'landlord_rent' and "schedule_entries"."lease_id" is not null) or ("schedule_entries"."kind" = 'tenant_rent' and "schedule_entries"."tenancy_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" uuid PRIMARY KEY NOT NULL,
	"seq" bigint DEFAULT nextval('sync_seq') NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"name" text NOT NULL,
	"address" text,
	"type" text DEFAULT 'house' NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "tenancies" (
	"id" uuid PRIMARY KEY NOT NULL,
	"seq" bigint DEFAULT nextval('sync_seq') NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"unit_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"rent_amount" bigint NOT NULL,
	"period_months" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"deposit_held" bigint DEFAULT 0 NOT NULL,
	"contract_file_key" text,
	"status" text DEFAULT 'active' NOT NULL,
	CONSTRAINT "tenancies_period_positive" CHECK ("tenancies"."period_months" > 0)
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"seq" bigint DEFAULT nextval('sync_seq') NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"name" text NOT NULL,
	"phone" text,
	"id_details" text,
	"guarantor" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "units" (
	"id" uuid PRIMARY KEY NOT NULL,
	"seq" bigint DEFAULT nextval('sync_seq') NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"lease_id" uuid NOT NULL,
	"name" text NOT NULL,
	"target_price" bigint,
	"unfurnished_baseline" bigint,
	"allocation_weight" integer DEFAULT 100 NOT NULL,
	"status" text DEFAULT 'vacant' NOT NULL,
	CONSTRAINT "units_weight_positive" CHECK ("units"."allocation_weight" > 0)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"seq" bigint DEFAULT nextval('sync_seq') NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"name" text NOT NULL,
	"phone" text,
	"email" text NOT NULL,
	"role" text DEFAULT 'owner' NOT NULL,
	"password_hash" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_landlord_id_landlords_id_fk" FOREIGN KEY ("landlord_id") REFERENCES "public"."landlords"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_schedule_entry_id_schedule_entries_id_fk" FOREIGN KEY ("schedule_entry_id") REFERENCES "public"."schedule_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repairs" ADD CONSTRAINT "repairs_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repairs" ADD CONSTRAINT "repairs_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_entries" ADD CONSTRAINT "schedule_entries_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_entries" ADD CONSTRAINT "schedule_entries_tenancy_id_tenancies_id_fk" FOREIGN KEY ("tenancy_id") REFERENCES "public"."tenancies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenancies" ADD CONSTRAINT "tenancies_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenancies" ADD CONSTRAINT "tenancies_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documents_seq_idx" ON "documents" USING btree ("seq");--> statement-breakpoint
CREATE INDEX "documents_owner_idx" ON "documents" USING btree ("owner_type","owner_id");--> statement-breakpoint
CREATE INDEX "expenses_seq_idx" ON "expenses" USING btree ("seq");--> statement-breakpoint
CREATE INDEX "items_seq_idx" ON "items" USING btree ("seq");--> statement-breakpoint
CREATE INDEX "items_unit_idx" ON "items" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "landlords_seq_idx" ON "landlords" USING btree ("seq");--> statement-breakpoint
CREATE INDEX "leases_seq_idx" ON "leases" USING btree ("seq");--> statement-breakpoint
CREATE INDEX "payments_seq_idx" ON "payments" USING btree ("seq");--> statement-breakpoint
CREATE INDEX "payments_schedule_idx" ON "payments" USING btree ("schedule_entry_id");--> statement-breakpoint
CREATE INDEX "repairs_seq_idx" ON "repairs" USING btree ("seq");--> statement-breakpoint
CREATE INDEX "repairs_item_idx" ON "repairs" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "schedule_entries_seq_idx" ON "schedule_entries" USING btree ("seq");--> statement-breakpoint
CREATE INDEX "schedule_entries_due_idx" ON "schedule_entries" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "sites_seq_idx" ON "sites" USING btree ("seq");--> statement-breakpoint
CREATE INDEX "tenancies_seq_idx" ON "tenancies" USING btree ("seq");--> statement-breakpoint
CREATE INDEX "tenancies_unit_idx" ON "tenancies" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "tenants_seq_idx" ON "tenants" USING btree ("seq");--> statement-breakpoint
CREATE INDEX "units_seq_idx" ON "units" USING btree ("seq");--> statement-breakpoint
CREATE INDEX "units_lease_idx" ON "units" USING btree ("lease_id");--> statement-breakpoint
CREATE INDEX "users_seq_idx" ON "users" USING btree ("seq");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");