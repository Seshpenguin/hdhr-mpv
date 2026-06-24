import { useEffect, useState } from "react";
import type { Channel, Device, GuideChannel, Row } from "../types";
import type { MpvSettings } from "../settings";
import { fmtClock, fmtDay } from "../lib";
import NowView from "./NowView";
import GuideGrid from "./GuideGrid";
import Signal from "./Signal";
import Settings from "./Settings";

interface Props {
  device: Device;
  channels: Channel[];
  guide: GuideChannel[];
  rows: Row[];
  settings: MpvSettings;
  setSettings: (s: MpvSettings) => void;
  onPlay: (channel: Channel) => void;
  onRefresh: () => void;
  onBack: () => void;
}

const TABS = ["Now", "Guide", "Signal", "Settings"] as const;

const HINTS: Record<(typeof TABS)[number], string> = {
  Now: "↑ ↓ Browse · Enter Watch",
  Guide: "Scroll to explore · Click a show to watch",
  Signal: "Live tuner telemetry, refreshed every 1.5s",
  Settings: "Scan channels · tune the mpv pipeline",
};

export default function Shell(props: Props) {
  const { device, channels, guide, rows, settings, setSettings, onPlay, onRefresh, onBack } = props;
  const [tab, setTab] = useState(0);
  const [clock, setClock] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setTab((t) => (t + 1) % TABS.length);
      else if (e.key === "ArrowLeft") setTab((t) => (t + TABS.length - 1) % TABS.length);
      else if (e.key >= "1" && e.key <= "4") setTab(Number(e.key) - 1);
      else if (e.key === "Escape") onBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBack]);

  const active = TABS[tab];

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between px-10 pb-3 pt-6">
        <span className="text-sm font-semibold uppercase tracking-[0.4em] text-accent">HDHR MPV</span>

        <nav className="flex gap-1 rounded-2xl border border-edge bg-panel/60 p-1 backdrop-blur">
          {TABS.map((label, i) => (
            <button
              key={label}
              onClick={() => setTab(i)}
              className={`rounded-xl px-5 py-2 text-sm font-medium transition ${
                i === tab ? "bg-accent text-ink" : "text-white/55 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="text-right">
          <div className="text-2xl font-semibold tabular-nums">{fmtClock(clock)}</div>
          <div className="text-xs text-white/40">{fmtDay(clock)}</div>
        </div>
      </header>

      <main className="min-h-0 flex-1">
        {active === "Now" && <NowView rows={rows} onPlay={onPlay} />}
        {active === "Guide" && <GuideGrid channels={channels} guide={guide} onPlay={onPlay} />}
        {active === "Signal" && <Signal device={device} channels={channels} />}
        {active === "Settings" && (
          <Settings
            device={device}
            settings={settings}
            setSettings={setSettings}
            onRefresh={onRefresh}
            onBack={onBack}
          />
        )}
      </main>

      <footer className="flex items-center gap-6 border-t border-edge/60 px-10 py-3 text-xs text-white/35">
        <span className="flex items-center gap-2">
          <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5">← →</kbd>
          Switch pages
        </span>
        <span>{HINTS[active]}</span>
        <span className="ml-auto">{device.friendlyName} · mpv · BWDIF · EWA Lanczos</span>
      </footer>
    </div>
  );
}
