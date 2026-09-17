import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import type { Ticket } from "../types";
import {
  Ticket as TicketIcon,
  Calendar,
  MapPin,
  Clock,
  Printer,
  QrCode,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Maximize2,
  X,
} from "lucide-react";

export const TicketsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  useEffect(() => {
    if (!user) {
      navigate("/login?redirect=/tickets");
      return;
    }

    const fetchTickets = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await api.tickets.list();
        setTickets(data);
      } catch (err: any) {
        setError(err.message || "Failed to load tickets");
      } finally {
        setIsLoading(false);
      }
    };

    fetchTickets();
  }, [user, navigate]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="border-b border-neutral-200 pb-8 flex flex-col md:flex-row md:items-end justify-between gap-6 no-print">
        <div>
          <span className="text-xs font-mono uppercase tracking-widest text-neutral-500 block mb-2">
            Verified Admission Passes
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900">
            My Purchased Tickets
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-neutral-600">
            Official cryptographically confirmed ticket passes. Present barcode at entry or print
            for paper admission.
          </p>
        </div>

        {tickets.length > 0 && (
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-mono font-semibold rounded border border-neutral-300 hover:border-neutral-900 text-neutral-900 transition-colors bg-white shadow-sm"
          >
            <Printer className="w-4 h-4" />
            <span>Print All Passes</span>
          </button>
        )}
      </div>

      {error && (
        <div className="rounded border border-neutral-300 bg-neutral-50 p-4 text-xs text-neutral-800 no-print">
          {error}
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="py-16 text-center no-print">
          <div className="inline-block animate-spin w-8 h-8 border-2 border-neutral-900 border-t-transparent rounded-full mb-4" />
          <p className="text-xs font-mono text-neutral-500 uppercase tracking-widest">
            Retrieving Admission Passes...
          </p>
        </div>
      ) : tickets.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 p-12 text-center max-w-md mx-auto no-print">
          <TicketIcon className="w-10 h-10 text-neutral-400 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-neutral-900 mb-1">
            No Confirmed Tickets
          </h3>
          <p className="text-xs text-neutral-500 mb-6">
            You haven't completed any ticket purchases yet.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-mono font-semibold bg-neutral-900 text-white rounded hover:bg-neutral-800"
          >
            <span>Browse Events</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {tickets.map((ticket) => {
            const eventDate = new Date(ticket.event.startsAt);
            const issuedDate = new Date(ticket.issuedAt);

            return (
              <div
                key={ticket.id}
                className="ticket-card relative rounded-lg border-2 border-neutral-900 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                {/* Top Notch & Header */}
                <div className="p-6 border-b border-dashed border-neutral-300 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-neutral-900 text-white flex items-center justify-center">
                        <TicketIcon className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-neutral-900">
                        OFFICIAL ADMISSION PASS
                      </span>
                    </div>

                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-neutral-900 text-white">
                      <ShieldCheck className="w-3 h-3" />
                      CONFIRMED
                    </span>
                  </div>

                  <div>
                    <h3 className="text-xl font-extrabold text-neutral-900 leading-tight">
                      {ticket.event.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono text-neutral-600 mt-2">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                        {ticket.event.venueName}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                        {eventDate.toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-neutral-400" />
                        {eventDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Seat Breakdown Grid */}
                <div className="grid grid-cols-3 bg-neutral-50 border-b border-dashed border-neutral-300 divide-x divide-neutral-200 text-center py-4 font-mono">
                  <div>
                    <span className="text-[10px] uppercase text-neutral-400 block">Section</span>
                    <span className="text-base font-bold text-neutral-900">
                      {ticket.seat.section}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-neutral-400 block">Row</span>
                    <span className="text-base font-bold text-neutral-900">
                      {ticket.seat.rowLabel}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-neutral-400 block">Seat</span>
                    <span className="text-base font-bold text-neutral-900">
                      {ticket.seat.seatNumber}
                    </span>
                  </div>
                </div>

                {/* Barcode & Security Reference */}
                <div className="p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* Simulated Clean SVG Barcode */}
                    <div className="space-y-1">
                      <div className="flex items-center h-10 gap-0.5">
                        {[4, 2, 6, 2, 4, 1, 3, 5, 2, 4, 2, 5, 1, 4, 3, 6, 2, 3, 5, 2, 4, 1, 3].map(
                          (w, i) => (
                            <div
                              key={i}
                              className="bg-neutral-900 h-full"
                              style={{ width: `${w}px` }}
                            />
                          ),
                        )}
                      </div>
                      <div className="text-[9px] font-mono tracking-widest text-neutral-500">
                        AUTH-{ticket.id.slice(0, 16).toUpperCase()}
                      </div>
                    </div>

                    <div className="text-left sm:text-right font-mono text-[11px] text-neutral-500 space-y-0.5">
                      <div>
                        Paid:{" "}
                        <span className="font-bold text-neutral-900">
                          ${(ticket.payment.amountCents / 100).toFixed(2)}{" "}
                          {ticket.payment.currency.toUpperCase()}
                        </span>
                      </div>
                      <div>
                        Issued: {issuedDate.toLocaleDateString()}
                      </div>
                      <div className="text-[10px] text-neutral-400 truncate max-w-[180px]">
                        Ref: {ticket.payment.id}
                      </div>
                    </div>
                  </div>

                  {/* Actions (Hidden on print) */}
                  <div className="pt-2 flex items-center justify-between border-t border-neutral-100 no-print">
                    <button
                      type="button"
                      onClick={() => setSelectedTicket(ticket)}
                      className="inline-flex items-center gap-1.5 text-xs font-mono text-neutral-600 hover:text-neutral-900 transition-colors"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>Full Pass View</span>
                    </button>

                    <button
                      type="button"
                      onClick={handlePrint}
                      className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-neutral-900 hover:underline"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print Pass</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full Pass Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 no-print">
          <div className="bg-white rounded-lg border-2 border-neutral-900 max-w-lg w-full p-6 sm:p-8 space-y-6 relative shadow-2xl">
            <button
              type="button"
              onClick={() => setSelectedTicket(null)}
              className="absolute right-4 top-4 text-neutral-400 hover:text-neutral-900"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-400">
                Official Admission Ticket
              </span>
              <h2 className="text-2xl font-black text-neutral-900">
                {selectedTicket.event.title}
              </h2>
              <p className="text-xs font-mono text-neutral-600">
                {selectedTicket.event.venueName} •{" "}
                {new Date(selectedTicket.event.startsAt).toLocaleString()}
              </p>
            </div>

            <div className="p-4 rounded border border-neutral-900 bg-neutral-50 text-center font-mono space-y-1">
              <div className="text-xs uppercase text-neutral-500 font-semibold">Seat Holder</div>
              <div className="text-lg font-extrabold text-neutral-900">
                Section {selectedTicket.seat.section}, Row {selectedTicket.seat.rowLabel}, Seat{" "}
                {selectedTicket.seat.seatNumber}
              </div>
            </div>

            {/* QR Code Graphic (SVG) */}
            <div className="flex flex-col items-center justify-center py-4 space-y-2">
              <div className="w-40 h-40 border-2 border-neutral-900 p-2 flex items-center justify-center bg-white">
                <QrCode className="w-32 h-32 text-neutral-900" />
              </div>
              <div className="text-[10px] font-mono text-neutral-400">
                UUID: {selectedTicket.id}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setSelectedTicket(null)}
                className="px-4 py-2 text-xs font-mono text-neutral-600 hover:text-neutral-900"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold uppercase tracking-wider bg-neutral-900 text-white rounded hover:bg-neutral-800"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Ticket</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
