# Ticket Platform Test Plan

## 1. Test Environment

* [x] Configure Vitest to use `.env.test`
* [ ] Verify tests use `ticket_platform_test`
* [ ] Add shared test setup/cleanup helpers

## 2. Basic API Tests

* [x] `GET /health` returns 200
* [x] `GET /api/v1/events` returns published events
* [ ] `GET /api/v1/events/:eventId` returns an event
* [ ] `GET /api/v1/events/:eventId/seats` returns seats
* [ ] Event endpoints reject invalid UUIDs
* [ ] Event endpoints return 404 for missing resources

## 3. Authentication Tests

* [ ] User can sign up
* [ ] User can sign in
* [ ] Unauthenticated request to protected endpoint returns 401
* [ ] Authenticated request can access protected endpoint
* [ ] `GET /api/v1/auth/me` returns the authenticated user

## 4. Reservation Tests

* [ ] Authenticated user can reserve an available seat
* [ ] Reservation changes the seat from AVAILABLE to HELD
* [ ] Reservation creates a HELD reservation in the database
* [ ] Unauthenticated user cannot create a reservation
* [ ] Cannot reserve an already HELD seat
* [ ] Cannot reserve an already SOLD seat
* [ ] Cannot reserve a seat belonging to an unpublished/unavailable event
* [ ] Missing `Idempotency-Key` is rejected
* [ ] Invalid `Idempotency-Key` is rejected
* [ ] Same idempotency key returns the original reservation
* [ ] Same idempotency key cannot be reused for a different request
* [ ] Reservation rate limit is enforced

## 5. Reservation Concurrency Tests

* [ ] Two users simultaneously reserve the same seat
* [ ] Exactly one reservation succeeds
* [ ] Exactly one request receives the conflict response
* [ ] Database contains exactly one active reservation
* [ ] Seat ends in HELD state
* [ ] No duplicate active reservations are created

## 6. Reservation Expiration Tests

* [ ] Expiration worker expires an expired reservation
* [ ] Expired reservation becomes EXPIRED
* [ ] Expired seat becomes AVAILABLE
* [ ] Seat cache is invalidated after expiration
* [ ] Expiration is safe to run more than once

## 7. Reservation Cancellation Tests

* [ ] User can cancel their own HELD reservation
* [ ] Cancelled reservation becomes CANCELLED
* [ ] Cancelled seat becomes AVAILABLE
* [ ] User cannot cancel another user's reservation
* [ ] Cannot cancel an already expired reservation
* [ ] Cannot cancel a confirmed reservation

## 8. Payment Tests

* [ ] User can create a PaymentIntent for their reservation
* [ ] Cannot create payment for another user's reservation
* [ ] Cannot create payment for an expired reservation
* [ ] Cannot create payment for a cancelled reservation
* [ ] PaymentIntent is associated with the reservation
* [ ] Payment endpoint returns the expected payment state

## 9. Stripe Webhook Tests

* [ ] Valid webhook is accepted
* [ ] Invalid webhook signature is rejected
* [ ] Duplicate webhook is handled idempotently
* [ ] Successful payment confirms the reservation
* [ ] Successful payment changes the seat to SOLD
* [ ] Payment failure leaves the reservation in the correct state
* [ ] Webhook processing is safe to retry

## 10. Ticket Tests

* [ ] Authenticated user can retrieve their tickets
* [ ] User only receives their own tickets
* [ ] Ticket is created after successful payment
* [ ] Ticket cannot be accessed by another user
* [ ] Missing ticket returns 404

## 11. Payment Retrieval Tests

* [ ] User can retrieve their own payment
* [ ] User cannot retrieve another user's payment
* [ ] Missing payment returns 404

## 12. Rate Limiting Tests

* [ ] Requests below the reservation limit succeed
* [ ] Requests exceeding the reservation limit are rejected
* [ ] Rate-limit headers are returned
* [ ] Rate limit resets after the configured window

## 13. Realtime Tests

* [ ] Seat HELD event is published
* [ ] Seat AVAILABLE event is published
* [ ] Seat SOLD event is published
* [ ] Subscriber receives valid seat update
* [ ] Socket.IO emits `seat.updated` to the correct event room
* [ ] Invalid Redis message is ignored/rejected safely

## 14. Failure / Edge Cases

* [ ] Database failure is handled by the API
* [ ] Redis failure does not crash the application
* [ ] Invalid request bodies return validation errors
* [ ] Unknown routes return the expected error
* [ ] Unexpected errors reach the error handler
* [ ] Request ID is returned in `X-Request-Id`
* [ ] Request logs contain request ID, method, path, status and duration

## 15. Graceful Shutdown

* [ ] SIGINT closes the HTTP server
* [ ] Redis connections are closed
* [ ] Seat update subscriber is closed
* [ ] PostgreSQL pool is closed

## Implementation Rules

Implement tests **one unchecked item at a time**.

For each item:

1. Inspect the existing implementation before changing anything.
2. Implement only that test and the minimum required test helper/setup.
3. Run the relevant test.
4. Run the full test suite.
5. If it passes, mark that item `[x]`.
6. Stop and wait for my next instruction.
7. Do not implement the next unchecked test automatically.
8. Do not rewrite existing application code just to make a test pass.
9. If the existing implementation appears incorrect, stop and explain the problem instead of silently changing production code.
10. Preserve all existing uncommitted work.
