BEGIN;

INSERT INTO events (
  id,
  title,
  description,
  venue_name,
  starts_at,
  status
)
VALUES (
  '11111111-1111-4111-8111-111111111111',
  'Championship Final',
  'A high-demand championship event.',
  'National Stadium',
  '2026-12-20 19:00:00+05',
  'PUBLISHED'
)
ON CONFLICT (id)
DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  venue_name = EXCLUDED.venue_name,
  starts_at = EXCLUDED.starts_at,
  status = EXCLUDED.status,
  updated_at = current_timestamp;

INSERT INTO seats (
  event_id,
  section,
  row_label,
  seat_number,
  price_cents
)
VALUES
  (
    '11111111-1111-4111-8111-111111111111',
    'A',
    '1',
    '1',
    5000
  ),
  (
    '11111111-1111-4111-8111-111111111111',
    'A',
    '1',
    '2',
    5000
  ),
  (
    '11111111-1111-4111-8111-111111111111',
    'A',
    '1',
    '3',
    5000
  ),
  (
    '11111111-1111-4111-8111-111111111111',
    'A',
    '1',
    '4',
    5000
  ),
  (
    '11111111-1111-4111-8111-111111111111',
    'A',
    '1',
    '5',
    5000
  ),
  (
    '11111111-1111-4111-8111-111111111111',
    'A',
    '1',
    '6',
    5000
  )
ON CONFLICT (
  event_id,
  section,
  row_label,
  seat_number
)
DO UPDATE SET
  price_cents = EXCLUDED.price_cents,
  updated_at = current_timestamp;

COMMIT;