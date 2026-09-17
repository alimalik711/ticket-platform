import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import { Ticket, Activity, ShieldCheck, Database, Zap, Cpu } from "lucide-react";

export const Footer: React.FC = () => {
  const [apiOk, setApiOk] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        const res = await api.health.check();
        if (mounted) setApiOk(res.status === "ok");
      } catch {
        if (mounted) setApiOk(false);
      }
    };
    check();
    const interval = setInterval(check, 15000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <footer className="w-full border-t border-neutral-200 bg-neutral-50/50 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-neutral-200">
          {/* Col 1: Brand */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-neutral-900 flex items-center justify-center text-white">
                <Ticket className="w-3.5 h-3.5" />
              </div>
              <span className="font-bold tracking-wider text-sm text-neutral-900">
                PASSAGE // TICKETING ENGINE
              </span>
            </div>
            <p className="text-xs text-neutral-600 leading-relaxed max-w-md">
              High-concurrency ticket reservation engine. Employs PostgreSQL row-level locks,
              Redis Pub/Sub real-time seat invalidation, BullMQ delayed reservation expirations,
              and idempotent checkout pipelines.
            </p>
            <div className="flex items-center gap-4 text-xs font-mono text-neutral-500">
              <span className="flex items-center gap-1">
                <Database className="w-3.5 h-3.5" /> Postgres 18
              </span>
              <span className="flex items-center gap-1">
                <Zap className="w-3.5 h-3.5" /> Redis Realtime
              </span>
              <span className="flex items-center gap-1">
                <Cpu className="w-3.5 h-3.5" /> BullMQ Workers
              </span>
            </div>
          </div>

          {/* Col 2: Navigation */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-900 mb-3 font-mono">
              Navigation
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/" className="text-neutral-600 hover:text-neutral-900 transition-colors">
                  Browse Events
                </Link>
              </li>
              <li>
                <Link to="/reservations" className="text-neutral-600 hover:text-neutral-900 transition-colors">
                  My Reservations
                </Link>
              </li>
              <li>
                <Link to="/tickets" className="text-neutral-600 hover:text-neutral-900 transition-colors">
                  My Ticket Passes
                </Link>
              </li>
              <li>
                <Link to="/health" className="text-neutral-600 hover:text-neutral-900 transition-colors">
                  System Diagnostics
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: System Status */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-900 mb-3 font-mono">
              System Telemetry
            </h4>
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-neutral-200 bg-white text-xs">
                <span
                  className={`w-2 h-2 rounded-full ${
                    apiOk === true
                      ? "bg-neutral-900"
                      : apiOk === false
                      ? "bg-neutral-400"
                      : "bg-neutral-300 animate-pulse"
                  }`}
                />
                <span className="font-mono text-neutral-700">
                  {apiOk === true
                    ? "API: OPERATIONAL"
                    : apiOk === false
                    ? "API: DISCONNECTED"
                    : "CHECKING..."}
                </span>
              </div>
              <p className="text-[11px] text-neutral-500">
                Express 5.2 • Socket.IO 4.8 • Better Auth
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] font-mono text-neutral-500">
          <div>
            © {new Date().getFullYear()} PASSAGE TICKET PLATFORM. ALL RIGHTS RESERVED.
          </div>
          <div className="flex items-center gap-3">
            <span>CONCURRENCY-SAFE</span>
            <span>•</span>
            <span>IDEMPOTENT</span>
            <span>•</span>
            <span>REAL-TIME</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
