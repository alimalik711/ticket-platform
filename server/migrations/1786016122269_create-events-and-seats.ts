import type { MigrationBuilder } from "node-pg-migrate";

export async function up(
  pgm: MigrationBuilder,
): Promise<void> {
  pgm.createExtension("pgcrypto", {
    ifNotExists: true,
  });

  pgm.createType("event_status", [
    "DRAFT",
    "PUBLISHED",
    "CANCELLED",
    "COMPLETED",
  ]);

  pgm.createType("seat_status", [
    "AVAILABLE",
    "HELD",
    "SOLD",
  ]);

  pgm.createTable("events", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },

    title: {
      type: "varchar(200)",
      notNull: true,
    },

    description: {
      type: "text",
    },

    venue_name: {
      type: "varchar(200)",
      notNull: true,
    },

    starts_at: {
      type: "timestamptz",
      notNull: true,
    },

    status: {
      type: "event_status",
      notNull: true,
      default: pgm.func("'DRAFT'::event_status"),
    },

    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },

    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });

  pgm.createTable("seats", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },

    event_id: {
      type: "uuid",
      notNull: true,
      references: "events",
      onDelete: "CASCADE",
    },

    section: {
      type: "varchar(50)",
      notNull: true,
    },

    row_label: {
      type: "varchar(20)",
      notNull: true,
    },

    seat_number: {
      type: "varchar(20)",
      notNull: true,
    },

    price_cents: {
      type: "integer",
      notNull: true,
    },

    status: {
      type: "seat_status",
      notNull: true,
      default: pgm.func("'AVAILABLE'::seat_status"),
    },

    held_until: {
      type: "timestamptz",
    },

    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },

    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("current_timestamp"),
    },
  });

  pgm.addConstraint(
    "seats",
    "seats_price_cannot_be_negative",
    {
      check: "price_cents >= 0",
    },
  );

  pgm.addConstraint(
    "seats",
    "seats_event_position_unique",
    {
      unique: [
        "event_id",
        "section",
        "row_label",
        "seat_number",
      ],
    },
  );

  pgm.addConstraint(
    "seats",
    "seats_held_until_matches_status",
    {
      check: `
        (
          status = 'HELD'
          AND held_until IS NOT NULL
        )
        OR
        (
          status <> 'HELD'
          AND held_until IS NULL
        )
      `,
    },
  );

  pgm.createIndex("events", [
    "status",
    "starts_at",
  ]);

  pgm.createIndex("seats", [
    "event_id",
    "status",
  ]);
}

export async function down(
  pgm: MigrationBuilder,
): Promise<void> {
  pgm.dropTable("seats");
  pgm.dropTable("events");

  pgm.dropType("seat_status");
  pgm.dropType("event_status");

  pgm.dropExtension("pgcrypto");
}