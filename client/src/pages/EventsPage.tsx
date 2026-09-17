import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import type { EventSummary } from "../types";
import { Calendar, MapPin, Search, ArrowRight, Clock, AlertCircle } from "lucide-react";

export const EventsPage: React.FC = () => {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setIsLoading(true);
        const data = await api.events.list();
        setEvents(data);
        setError(null);
      } catch (err: any) {
        setError(err.message || "Failed to load events");
      } finally {
        setIsLoading(false);
      }
    };
    fetchEvents();
  }, []);

  const filteredEvents = events.filter((e) => {
    const term = searchTerm.toLowerCase();
    return (
      e.title.toLowerCase().includes(term) ||
      e.venueName.toLowerCase().includes(term) ||
      (e.description && e.description.toLowerCase().includes(term))
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Editorial Hero */}
      <div className="border-b border-neutral-200 pb-10 mb-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="max-w-2xl">
            <span className="text-xs font-mono uppercase tracking-widest text-neutral-500 block mb-2">
              Box Office Catalog // 2026
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-900 leading-tight">
              Live Events & Seat Reservations
            </h1>
            <p className="mt-3 text-sm text-neutral-600 leading-relaxed">
              Explore upcoming performances and sporting events. Reserve individual seats with
              instant real-time locking, protected against double-booking via transactional row-level isolation.
            </p>
          </div>

          {/* Search Input */}
          <div className="w-full md:w-80 relative">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search event or venue..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-neutral-50 border border-neutral-300 rounded-md placeholder-neutral-400 focus:bg-white focus:outline-none focus:border-neutral-900 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Content Area */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="border border-neutral-200 rounded-lg p-6 animate-pulse space-y-4 bg-neutral-50/50"
            >
              <div className="h-4 bg-neutral-200 rounded w-1/3" />
              <div className="h-6 bg-neutral-200 rounded w-3/4" />
              <div className="h-16 bg-neutral-200 rounded" />
              <div className="h-8 bg-neutral-200 rounded w-full pt-4" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-neutral-300 bg-neutral-50 p-8 text-center max-w-lg mx-auto">
          <AlertCircle className="w-8 h-8 text-neutral-800 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-neutral-900 mb-1">Unable to Load Events</h3>
          <p className="text-xs text-neutral-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-xs font-mono font-semibold bg-neutral-900 text-white rounded hover:bg-neutral-800 transition-colors"
          >
            Retry Connection
          </button>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 p-12 text-center max-w-md mx-auto">
          <Calendar className="w-10 h-10 text-neutral-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-neutral-900 mb-1">No Events Found</h3>
          <p className="text-xs text-neutral-500">
            {searchTerm ? `No events match "${searchTerm}".` : "No upcoming published events available right now."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map((event) => {
            const eventDate = new Date(event.startsAt);
            return (
              <div
                key={event.id}
                className="group flex flex-col justify-between border border-neutral-200 hover:border-neutral-900 rounded-lg p-6 bg-white transition-all hover:shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium border border-neutral-300 bg-neutral-100 text-neutral-800">
                      {event.status}
                    </span>
                    <span className="text-[11px] font-mono text-neutral-500 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {eventDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-neutral-900 group-hover:text-neutral-900 mb-2 leading-snug">
                    {event.title}
                  </h3>

                  <div className="flex items-center gap-1.5 text-xs text-neutral-600 mb-3 font-medium">
                    <MapPin className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                    <span>{event.venueName}</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-mono text-neutral-700 mb-4 pb-4 border-b border-neutral-100">
                    <Calendar className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                    <span>
                      {eventDate.toLocaleDateString(undefined, {
                        weekday: "short",
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>

                  <p className="text-xs text-neutral-600 line-clamp-3 mb-6 leading-relaxed">
                    {event.description || "Official reserved seating event."}
                  </p>
                </div>

                <Link
                  to={`/events/${event.id}`}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider rounded border border-neutral-900 bg-neutral-900 text-white hover:bg-white hover:text-neutral-900 transition-colors"
                >
                  <span>Select Seats</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
