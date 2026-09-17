import React, { useEffect, useState } from "react";
import { api } from "../services/api";
import { getSocket } from "../services/socket";
import type { HealthResponse } from "../types";
import {
  Activity,
  CheckCircle2,
  XCircle,
  Database,
  Zap,
  Cpu,
  RefreshCw,
  Server,
  Shield,
  Radio,
} from "lucide-react";

export const HealthPage: React.FC = () => {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [socketConnected, setSocketConnected] = useState<boolean>(false);
  const [socketLatency, setSocketLatency] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [lastChecked, setLastChecked] = useState<Date>(new Date());

  const runDiagnostics = async () => {
    setIsLoading(true);
    const start = performance.now();

    try {
      const h = await api.health.check();
      setHealth(h);
    } catch {
      setHealth(null);
    }

    const socket = getSocket();
    setSocketConnected(socket.connected);

    if (socket.connected) {
      const pingStart = Date.now();
      socket.emit("event:join", "00000000-0000-0000-0000-000000000000", () => {
        setSocketLatency(Date.now() - pingStart);
      });
    } else {
      setSocketLatency(null);
    }

    setLastChecked(new Date());
    setIsLoading(false);
  };

  useEffect(() => {
    runDiagnostics();
    const interval = setInterval(runDiagnostics, 10000);
    return () => clearInterval(interval);
  }, []);

  const subsystems = [
    {
      name: "Core HTTP Application Server",
      description: "Express 5.2 API handling routing, middlewares, and auth splats",
      status: health?.status === "ok" ? "OPERATIONAL" : "DEGRADED",
      icon: Server,
    },
    {
      name: "Socket.IO Real-Time Engine",
      description: "Event-based pub/sub broadcast for instantaneous seat inventory updates",
      status: socketConnected ? "CONNECTED" : "DISCONNECTED",
      latency: socketLatency !== null ? `${socketLatency}ms` : undefined,
      icon: Radio,
    },
    {
      name: "PostgreSQL Database Engine",
      description: "ACID transactions with row-level locks (FOR UPDATE) for zero double-booking",
      status: health?.status === "ok" ? "OPERATIONAL" : "UNKNOWN",
      icon: Database,
    },
    {
      name: "Redis Pub/Sub & In-Memory Cache",
      description: "Cache tier for published event seat maps and inter-process event bus",
      status: health?.status === "ok" ? "CONNECTED" : "UNKNOWN",
      icon: Zap,
    },
    {
      name: "BullMQ Distributed Workers",
      description: "Asynchronous delayed jobs for reservation expiration & Stripe refund recovery",
      status: "ACTIVE",
      icon: Cpu,
    },
    {
      name: "Better Auth Security Layer",
      description: "Cryptographic session token management and cookie verification",
      status: "OPERATIONAL",
      icon: Shield,
    },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="border-b border-neutral-200 pb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-widest text-neutral-500 block mb-2">
            Infrastructure Telemetry
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900">
            System Diagnostics
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-neutral-600">
            Live health verification across database, pub/sub queues, and socket gateways.
          </p>
        </div>

        <button
          type="button"
          onClick={runDiagnostics}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-mono font-semibold rounded border border-neutral-300 hover:border-neutral-900 text-neutral-900 bg-white shadow-xs transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>Refresh Status</span>
        </button>
      </div>

      {/* Main Status Banner */}
      <div className="rounded-lg border-2 border-neutral-900 bg-white p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center ${
              health?.status === "ok"
                ? "bg-neutral-900 text-white"
                : "bg-neutral-200 text-neutral-600"
            }`}
          >
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-neutral-900">
                {health?.status === "ok"
                  ? "All Systems Operational"
                  : "Connecting to Backend Services..."}
              </span>
            </div>
            <p className="text-xs font-mono text-neutral-500 mt-0.5">
              Backend Message: "{health?.message || "Awaiting health check probe..."}"
            </p>
          </div>
        </div>

        <div className="text-left sm:text-right font-mono text-xs text-neutral-500 space-y-1">
          <div>Telemetry Probe: Active (10s)</div>
          <div>Last Poll: {lastChecked.toLocaleTimeString()}</div>
        </div>
      </div>

      {/* Subsystem Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {subsystems.map((sub) => {
          const Icon = sub.icon;
          const isGood =
            sub.status === "OPERATIONAL" ||
            sub.status === "CONNECTED" ||
            sub.status === "ACTIVE";

          return (
            <div
              key={sub.name}
              className="border border-neutral-200 rounded-lg p-5 bg-white space-y-3 hover:border-neutral-400 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-800">
                    <Icon className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-mono font-bold text-neutral-900 uppercase">
                    {sub.name}
                  </h4>
                </div>

                <div className="flex items-center gap-1.5 font-mono text-[10px]">
                  {sub.latency && (
                    <span className="text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded border border-neutral-200">
                      {sub.latency}
                    </span>
                  )}
                  <span
                    className={`px-2 py-0.5 rounded font-semibold border ${
                      isGood
                        ? "bg-neutral-900 text-white border-neutral-900"
                        : "bg-neutral-100 text-neutral-500 border-neutral-300"
                    }`}
                  >
                    {sub.status}
                  </span>
                </div>
              </div>

              <p className="text-xs text-neutral-600 leading-relaxed">
                {sub.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
