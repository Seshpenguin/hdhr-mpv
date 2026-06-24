import { useEffect, useRef, useState } from "react";
import type { Device, ScanStatus } from "../types";
import { abortScan, getLineup, scanStatus, startScan } from "../api";

interface Props {
  device: Device;
  onClose: () => void;
  onDone: () => void;
}

export default function ScanModal({ device, onClose, onDone }: Props) {
  const [status, setStatus] = useState<ScanStatus>();
  const [detected, setDetected] = useState<string>();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string>();
  const sawActive = useRef(false);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const st = await scanStatus(device.ip);
        if (!alive) return;
        setStatus(st);
        if (st.scanInProgress === 1) sawActive.current = true;
        const lineup = await getLineup(device.lineupUrl).catch(() => []);
        if (alive && lineup.length) setDetected(lineup[lineup.length - 1].guideName);
        if (sawActive.current && st.scanInProgress === 0) {
          setDone(true);
          onDone();
          return;
        }
      } catch (e) {
        if (alive) setError(String(e));
      }
      timer = setTimeout(poll, 1000);
    };

    (async () => {
      try {
        const st = await scanStatus(device.ip);
        await startScan(device.ip, st.sourceList?.[0] || st.source || "Antenna");
      } catch (e) {
        setError(String(e));
        return;
      }
      timer = setTimeout(poll, 900);
    })();

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [device]);

  const stop = () => {
    abortScan(device.ip).finally(onClose);
  };

  const pct = status?.progress ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 backdrop-blur">
      <div className="w-full max-w-lg rounded-3xl border border-edge bg-panel p-8 shadow-2xl">
        <h2 className="text-2xl font-bold">{done ? "Scan complete" : "Scanning for channels"}</h2>
        <p className="mt-1 text-white/50">
          {status?.source ? `Source: ${status.source}` : "Tuning across the band…"}
        </p>

        <div className="mt-6 h-3 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2 transition-all duration-700"
            style={{ width: `${done ? 100 : pct}%` }}
          />
        </div>

        <div className="mt-3 flex justify-between text-sm">
          <span className="text-white/50">{done ? "100%" : `${pct}%`}</span>
          <span className="font-semibold text-accent">{status?.found ?? 0} channels found</span>
        </div>

        <div className="mt-5 h-6 text-sm text-white/60">
          {error ? (
            <span className="text-live">{error}</span>
          ) : detected ? (
            <span>
              <span className="text-white/35">Detected · </span>
              {detected}
            </span>
          ) : (
            <span className="text-white/30">Listening for stations…</span>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          {done || error ? (
            <button
              onClick={onClose}
              className="rounded-2xl bg-accent px-6 py-3 font-semibold text-ink transition hover:brightness-110"
            >
              Done
            </button>
          ) : (
            <button
              onClick={stop}
              className="rounded-2xl border border-edge px-6 py-3 font-semibold text-white/70 transition hover:border-live hover:text-live"
            >
              Stop scan
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
