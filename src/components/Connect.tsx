import { useState } from "react";
import type { Device } from "../types";

interface Props {
  devices: Device[];
  scanning: boolean;
  error?: string;
  onScan: () => void;
  onPick: (device: Device) => void;
  onManual: (ip: string) => void;
}

export default function Connect({ devices, scanning, error, onScan, onPick, onManual }: Props) {
  const [ip, setIp] = useState("");

  return (
    <div className="flex h-full items-center justify-center p-10">
      <div className="w-full max-w-xl rounded-3xl border border-edge bg-panel/70 p-10 shadow-2xl backdrop-blur-xl">
        <div className="mb-8 text-center">
          <div className="text-sm font-semibold uppercase tracking-[0.4em] text-accent">
            HDHR MPV
          </div>
          <h1 className="mt-3 text-3xl font-bold">Find your tuner</h1>
          <p className="mt-2 text-white/50">
            Searching the network for HDHomeRun devices.
          </p>
        </div>

        {scanning && (
          <div className="mb-6 flex items-center justify-center gap-3 text-white/60">
            <span className="h-3 w-3 animate-ping rounded-full bg-accent" />
            Scanning…
          </div>
        )}

        {devices.length > 0 && (
          <div className="mb-6 space-y-3">
            {devices.map((d) => (
              <button
                key={d.id || d.ip}
                onClick={() => onPick(d)}
                className="flex w-full items-center justify-between rounded-2xl border border-edge bg-panel-2 px-5 py-4 text-left transition hover:border-accent hover:bg-panel-2/60"
              >
                <div>
                  <div className="text-lg font-semibold">{d.friendlyName}</div>
                  <div className="text-sm text-white/45">
                    {d.model} · {d.ip} · {d.tunerCount} tuners
                  </div>
                </div>
                <span className="text-accent">Connect →</span>
              </button>
            ))}
          </div>
        )}

        {!scanning && devices.length === 0 && (
          <p className="mb-6 text-center text-white/40">
            No devices found automatically. Enter your tuner's IP below.
          </p>
        )}

        <div className="flex gap-3">
          <input
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ip.trim() && onManual(ip.trim())}
            placeholder="192.168.1.50"
            className="flex-1 rounded-2xl border border-edge bg-ink/60 px-5 py-3 text-lg outline-none placeholder:text-white/25 focus:border-accent"
          />
          <button
            onClick={() => ip.trim() && onManual(ip.trim())}
            className="rounded-2xl bg-accent px-6 py-3 font-semibold text-ink transition hover:brightness-110"
          >
            Connect
          </button>
        </div>

        {error && <p className="mt-4 text-center text-live/90">{error}</p>}

        <button
          onClick={onScan}
          disabled={scanning}
          className="mx-auto mt-8 block text-sm text-white/40 transition hover:text-accent disabled:opacity-40"
        >
          ↻ Scan again
        </button>
      </div>
    </div>
  );
}
