import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api, ApiError, generateUUID } from "../services/api";
import { joinEventRoom, subscribeToSeatUpdates } from "../services/socket";
import { useAuth } from "../context/AuthContext";
import type { EventSummary, SeatSummary, Reservation } from "../types";
import { CountdownTimer } from "../components/CountdownTimer";
import {
  Calendar,
  MapPin,
  Clock,
  Radio,
  Check,
  Lock,
  ArrowRight,
  AlertCircle,
  X,
  ShieldAlert,
  CreditCard,
} from "lucide-react";

export const EventDetailPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { user, refreshReservations } = useAuth();

  const [event, setEvent] = useState<EventSummary | null>(null);
  const [seats, setSeats] = useState<SeatSummary[]>([]);
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReserving, setIsReserving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [socketStatus, setSocketStatus] = useState<"connecting" | "synced" | "error">("connecting");
  const [activeReservation, setActiveReservation] = useState<Reservation | null>(null);

  // Load event and seats
  useEffect(() => {
    if (!eventId) return;

    let isMounted = true;

    const loadData = async () => {
      try {
        setIsLoading(true);
        const [eventData, seatsData] = await Promise.all([
          api.events.getById(eventId),
          api.events.getSeats(eventId),
        ]);
        if (isMounted) {
          setEvent(eventData);
          setSeats(seatsData);
        }
      } catch (err: any) {
        if (isMounted) {
          setActionError(err.message || "Failed to load event data");
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadData();

    // Join Socket.IO room for real-time seat invalidations
    joinEventRoom(eventId, (ack) => {
      if (ack?.success) {
        setSocketStatus("synced");
      } else {
        setSocketStatus("error");
      }
    });

    // Listen for live seat updates
    const unsubscribe = subscribeToSeatUpdates((payload) => {
      if (payload.eventId === eventId) {
        setSeats((prevSeats) =>
          prevSeats.map((s) => {
            if (s.id === payload.seatId) {
              return {
                ...s,
                status: payload.status,
                heldUntil: payload.heldUntil,
              };
            }
            return s;
          }),
        );
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [eventId]);

  // Check if current user has an active hold for this event
  const checkUserReservations = async () => {
    if (!user || !eventId) return;
    try {
      const res = await api.reservations.list();
      const now = new Date();
      const currentHold = res.find(
        (r) =>
          r.status === "HELD" &&
          new Date(r.expires_at) > now &&
          r.event?.id === eventId,
      );
      setActiveReservation(currentHold || null);
    } catch {
      setActiveReservation(null);
    }
  };

  useEffect(() => {
    checkUserReservations();
  }, [user, eventId]);

  // Group seats by Section, then by Row
  const groupedSeats = useMemo(() => {
    const sections: Record<string, Record<string, SeatSummary[]>> = {};

    for (const seat of seats) {
      if (!sections[seat.section]) {
        sections[seat.section] = {};
      }
      if (!sections[seat.section][seat.rowLabel]) {
        sections[seat.section][seat.rowLabel] = [];
      }
      sections[seat.section][seat.rowLabel].push(seat);
    }

    // Sort seats by seatNumber within row
    for (const sec in sections) {
      for (const row in sections[sec]) {
        sections[sec][row].sort((a, b) => {
          const numA = parseInt(a.seatNumber, 10);
          const numB = parseInt(b.seatNumber, 10);
          return isNaN(numA) || isNaN(numB)
            ? a.seatNumber.localeCompare(b.seatNumber)
            : numA - numB;
        });
      }
    }

    return sections;
  }, [seats]);

  const selectedSeat = useMemo(
    () => seats.find((s) => s.id === selectedSeatId) || null,
    [seats, selectedSeatId],
  );

  const handleSeatClick = (seat: SeatSummary) => {
    setActionError(null);
    if (seat.status !== "AVAILABLE") return;

    if (selectedSeatId === seat.id) {
      setSelectedSeatId(null);
    } else {
      setSelectedSeatId(seat.id);
    }
  };

  const handleReserve = async () => {
    if (!user) {
      navigate(`/login?redirect=/events/${eventId}`);
      return;
    }

    if (!selectedSeatId) return;

    try {
      setIsReserving(true);
      setActionError(null);
      const idempotencyKey = generateUUID();

      const result = await api.reservations.create(selectedSeatId, idempotencyKey);

      await refreshReservations();
      await checkUserReservations();

      // Navigate straight to checkout for this reservation
      navigate(`/checkout/${result.reservation.id}`);
    } catch (err: any) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setActionError(
            err.message || "This seat was just claimed by another user. Please choose another seat.",
          );
        } else if (err.status === 429) {
          setActionError(
            "Rate limit exceeded: You have attempted too many reservations. Please wait 60 seconds.",
          );
        } else {
          setActionError(err.message || "Failed to create reservation.");
        }
      } else {
        setActionError("An unexpected error occurred while reserving seat.");
      }
    } finally {
      setIsReserving(false);
    }
  };

  const handleCancelActiveHold = async (reservationId: string) => {
    try {
      await api.reservations.cancel(reservationId);
      setActiveReservation(null);
      await refreshReservations();
      // Reload seats
      if (eventId) {
        const freshSeats = await api.events.getSeats(eventId);
        setSeats(freshSeats);
      }
    } catch (err: any) {
      setActionError(err.message || "Failed to cancel hold.");
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <div className="inline-block animate-spin w-8 h-8 border-2 border-neutral-900 border-t-transparent rounded-full mb-4" />
        <p className="text-xs font-mono text-neutral-500 uppercase tracking-widest">
          Loading Event & Live Seating Plan...
        </p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-10 h-10 text-neutral-400 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-neutral-900">Event Not Found</h2>
        <p className="text-xs text-neutral-500 mt-1 mb-6">
          The requested event could not be found or has not been published yet.
        </p>
        <Link
          to="/"
          className="px-4 py-2 text-xs font-mono font-semibold bg-neutral-900 text-white rounded hover:bg-neutral-800"
        >
          Return to Events
        </Link>
      </div>
    );
  }

  const eventDate = new Date(event.startsAt);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Active Hold Banner if user holds a seat */}
      {activeReservation && (
        <div className="rounded-lg border-2 border-neutral-900 bg-neutral-950 text-white p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-md">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span className="text-xs font-mono uppercase tracking-wider text-neutral-300">
                Active Hold Pending Checkout
              </span>
            </div>
            <p className="text-sm font-medium">
              You have locked Section {activeReservation.seat.section}, Row{" "}
              {activeReservation.seat.row_label}, Seat {activeReservation.seat.seat_number} ($
              {(activeReservation.price_cents / 100).toFixed(2)})
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <CountdownTimer
              expiresAt={activeReservation.expires_at}
              onExpire={() => checkUserReservations()}
              className="border-neutral-700 bg-neutral-800 text-white"
            />
            <button
              onClick={() => handleCancelActiveHold(activeReservation.id)}
              className="px-3 py-1.5 text-xs font-mono text-neutral-400 hover:text-white hover:underline transition-colors"
            >
              Release Hold
            </button>
            <button
              onClick={() => navigate(`/checkout/${activeReservation.id}`)}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider bg-white text-neutral-950 hover:bg-neutral-200 rounded transition-colors"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Checkout</span>
            </button>
          </div>
        </div>
      )}

      {/* Event Details Header */}
      <div className="border border-neutral-200 rounded-lg p-6 sm:p-8 bg-white">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-6 border-b border-neutral-100">
          <div className="space-y-2 max-w-3xl">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-mono font-semibold border border-neutral-300 bg-neutral-100 text-neutral-900">
                {event.status}
              </span>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-mono border border-neutral-200 bg-neutral-50 text-neutral-600">
                <Radio
                  className={`w-3 h-3 ${
                    socketStatus === "synced"
                      ? "text-neutral-900 animate-pulse"
                      : "text-neutral-400"
                  }`}
                />
                <span>
                  {socketStatus === "synced"
                    ? "LIVE SYNC ACTIVE"
                    : socketStatus === "connecting"
                    ? "CONNECTING..."
                    : "OFFLINE"}
                </span>
              </div>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 tracking-tight">
              {event.title}
            </h1>

            <div className="flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-neutral-600 font-mono pt-1">
              <span className="flex items-center gap-1.5 font-medium">
                <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                {event.venueName}
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                {eventDate.toLocaleDateString(undefined, {
                  weekday: "short",
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <Clock className="w-3.5 h-3.5 text-neutral-400" />
                {eventDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </div>

          <div className="text-left md:text-right border-t md:border-t-0 pt-4 md:pt-0 border-neutral-100">
            <span className="text-[11px] font-mono text-neutral-500 uppercase tracking-widest block mb-1">
              Seat Inventory
            </span>
            <div className="text-2xl font-bold font-mono text-neutral-900">
              {seats.filter((s) => s.status === "AVAILABLE").length}{" "}
              <span className="text-xs font-normal text-neutral-500">/ {seats.length} open</span>
            </div>
          </div>
        </div>

        {event.description && (
          <p className="mt-4 text-xs sm:text-sm text-neutral-600 leading-relaxed max-w-3xl">
            {event.description}
          </p>
        )}
      </div>

      {/* Error Alert if any */}
      {actionError && (
        <div className="rounded-md border border-neutral-900 bg-neutral-50 p-4 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-neutral-900 shrink-0 mt-0.5" />
          <div className="text-xs text-neutral-900 flex-1">
            <p className="font-semibold mb-0.5">Notice</p>
            <p>{actionError}</p>
          </div>
          <button
            onClick={() => setActionError(null)}
            className="text-neutral-500 hover:text-neutral-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Seating Map Section */}
      <div className="border border-neutral-200 rounded-lg bg-neutral-50/50 p-6 sm:p-8">
        {/* Stage Indicator */}
        <div className="max-w-md mx-auto mb-10 text-center">
          <div className="w-full h-2 bg-neutral-900 rounded-full mb-2" />
          <span className="text-[11px] font-mono font-semibold tracking-widest text-neutral-500 uppercase">
            STAGE // FRONT OF VENUE
          </span>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-6 mb-8 text-xs font-mono">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded border border-neutral-400 bg-white" />
            <span className="text-neutral-700">Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded border border-neutral-900 bg-neutral-900 text-white flex items-center justify-center text-[10px]">
              <Check className="w-3 h-3" />
            </div>
            <span className="text-neutral-900 font-medium">Selected</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded border border-neutral-300 bg-neutral-200 text-neutral-500 flex items-center justify-center">
              <Lock className="w-2.5 h-2.5" />
            </div>
            <span className="text-neutral-500">Held (Pending)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded border border-neutral-400 bg-neutral-400 text-white flex items-center justify-center text-[10px]">
              ✕
            </div>
            <span className="text-neutral-500">Sold Out</span>
          </div>
        </div>

        {/* Seats Grid Grouped by Section and Row */}
        <div className="space-y-8">
          {Object.keys(groupedSeats).map((sectionName) => (
            <div
              key={sectionName}
              className="bg-white border border-neutral-200 rounded-lg p-6 max-w-4xl mx-auto"
            >
              <div className="border-b border-neutral-100 pb-3 mb-5 flex items-center justify-between">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-900">
                  Section {sectionName}
                </h3>
                <span className="text-[11px] font-mono text-neutral-500">
                  Standard Reserved Tier
                </span>
              </div>

              <div className="space-y-4">
                {Object.keys(groupedSeats[sectionName]).map((rowLabel) => (
                  <div key={rowLabel} className="flex items-center gap-4">
                    {/* Row Indicator */}
                    <div className="w-12 text-right text-xs font-mono font-semibold text-neutral-400 shrink-0">
                      Row {rowLabel}
                    </div>

                    {/* Row Seats */}
                    <div className="flex flex-wrap items-center gap-2.5">
                      {groupedSeats[sectionName][rowLabel].map((seat) => {
                        const isSelected = selectedSeatId === seat.id;
                        const isAvailable = seat.status === "AVAILABLE";
                        const isHeld = seat.status === "HELD";
                        const isSold = seat.status === "SOLD";

                        return (
                          <button
                            key={seat.id}
                            type="button"
                            disabled={!isAvailable}
                            onClick={() => handleSeatClick(seat)}
                            title={`Section ${seat.section}, Row ${seat.rowLabel}, Seat ${
                              seat.seatNumber
                            } - $${(seat.priceCents / 100).toFixed(2)} (${seat.status})`}
                            className={`relative group min-w-[56px] h-11 px-2.5 rounded text-xs font-mono font-medium transition-all flex flex-col items-center justify-center gap-0.5 border ${
                              isSelected
                                ? "bg-neutral-900 text-white border-neutral-900 ring-2 ring-neutral-900 ring-offset-1 z-10"
                                : isAvailable
                                ? "bg-white text-neutral-900 border-neutral-300 hover:border-neutral-900 hover:shadow-sm active:scale-95 cursor-pointer"
                                : isHeld
                                ? "bg-neutral-100 text-neutral-400 border-neutral-200 cursor-not-allowed"
                                : "bg-neutral-200 text-neutral-400 border-neutral-300 cursor-not-allowed opacity-60"
                            }`}
                          >
                            <div className="flex items-center gap-1">
                              {isHeld && <Lock className="w-2.5 h-2.5" />}
                              <span>{seat.seatNumber}</span>
                            </div>
                            <span className="text-[9px] opacity-75">
                              ${(seat.priceCents / 100).toFixed(0)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Selected Seat Checkout Action Bar */}
      {selectedSeat && (
        <div className="sticky bottom-4 z-30 max-w-2xl mx-auto rounded-lg border-2 border-neutral-900 bg-white p-4 sm:p-5 shadow-xl transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-neutral-500 uppercase">
                <span>Selected Reservation</span>
                <span>•</span>
                <span className="text-neutral-900 font-semibold">10-Minute Hold</span>
              </div>
              <p className="text-base font-bold text-neutral-900 mt-0.5">
                Section {selectedSeat.section}, Row {selectedSeat.rowLabel}, Seat{" "}
                {selectedSeat.seatNumber}
              </p>
              <p className="text-xs font-mono text-neutral-600 mt-0.5">
                Price: ${(selectedSeat.priceCents / 100).toFixed(2)} USD
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedSeatId(null)}
                className="px-3 py-2 text-xs font-mono text-neutral-500 hover:text-neutral-900"
              >
                Clear
              </button>
              <button
                type="button"
                disabled={isReserving}
                onClick={handleReserve}
                className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-semibold uppercase tracking-wider rounded border border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50 transition-colors shadow-sm"
              >
                {isReserving ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Locking Seat...</span>
                  </>
                ) : (
                  <>
                    <span>{user ? "Reserve & Proceed" : "Sign In to Reserve"}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
