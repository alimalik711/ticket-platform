import type { MigrationBuilder } from "node-pg-migrate";

export async function up(
  pgm: MigrationBuilder,
): Promise<void> {
  pgm.sql(`
    ALTER TABLE "reservations"
      ADD COLUMN "idempotency_key" uuid;

    CREATE UNIQUE INDEX
      "reservations_user_idempotency_key_unique"
    ON "reservations" (
      "user_id",
      "idempotency_key"
    )
    WHERE "idempotency_key" IS NOT NULL;
  `);
}

export async function down(
  pgm: MigrationBuilder,
): Promise<void> {
  pgm.sql(`
    DROP INDEX IF EXISTS
      "reservations_user_idempotency_key_unique";

    ALTER TABLE "reservations"
      DROP COLUMN IF EXISTS "idempotency_key";
  `);
}