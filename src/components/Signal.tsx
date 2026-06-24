import { useEffect, useState } from "react";
import type { Channel, Device, TunerStatus } from "../types";
import { tunerStatus } from "../api";
import { fmtFreq, fmtRate } from "../lib";

interface Props {
  device: Device;
  channels: Channel[];
}

export default function Signal({ device, channels }: Props) {
  const [tuners, setTuners] = useState<TunerStatus[]>([]);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let alive = true;
    const poll = () =>
      tunerStatus(device.ip, device.tunerCount || 4)
        .then((t) => alive && (setTuners(t), setError(undefined)))
        .catch((e) => alive && setError(String(e)));
    poll();
    const id = setInterval(poll, 1500);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [device]);

  return (
    <div className="no-scrollbar h-full overflow-y-auto px-10 py-6">
      <div className="mb-5 flex items-baseline justify-between">
        <h2 className="text-xl font-semibold">Signal &amp; Tuners</h2>
        <span className="text-sm text-white/40">
          {device.model} · fw {device.firmware || "?"} · live · 1.5s
        </span>
      </div>

      {error && (
        <div className="mb-4 rounded-2xl border border-live/40 bg-live/10 px-5 py-3 text-sm text-white/70">
          Couldn't read tuner status: {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {tuners.map((t) => (
          <TunerCard key={t.index} t={t} channels={channels} />
        ))}
        {tuners.length === 0 && !error && (
          <div className="py-20 text-center text-white/40">Reading tuners…</div>
        )}
      </div>
    </div>
  );
}

function TunerCard({ t, channels }: { t: TunerStatus; channels: Channel[] }) {
  const ch = channels.find((c) => c.guideNumber === t.vchannel);
  const programs = t.streaminfo
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("tsid"));

  return (
    <section className="rounded-3xl border border-edge bg-panel/60 p-6 backdrop-blur-xl">
      <header className="mb-5 flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <h3 className="text-lg font-semibold">Tuner {t.index}</h3>
          {t.active ? (
            <span className="flex items-center gap-1.5 rounded-full bg-live/90 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> Live
            </span>
          ) : (
            <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-white/50">Idle</span>
          )}
        </div>
        {t.active && (
          <div className="text-right">
            <div className="text-xl font-bold text-accent tabular-nums">{t.vchannel || "—"}</div>
            <div className="text-xs text-white/45">{ch?.guideName ?? ""}</div>
          </div>
        )}
      </header>

      <div className="space-y-3">
        <Meter label="Signal Strength" value={t.signalStrength} />
        <Meter label="Signal Quality" value={t.signalQuality} />
        <Meter label="Symbol Quality" value={t.symbolQuality} />
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <Field k="Modulation" v={t.lock && t.lock !== "none" ? t.lock.toUpperCase() : "—"} />
        <Field k="Frequency" v={fmtFreq(t.frequencyHz)} />
        <Field k="Bitrate" v={fmtRate(t.bitrate)} />
        <Field k="Video" v={ch?.videoCodec || "—"} />
        <Field k="Audio" v={ch?.audioCodec || "—"} />
        <Field k="Streaming to" v={t.target && t.target !== "none" ? t.target : "—"} />
      </dl>

      {programs.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 text-xs uppercase tracking-wider text-white/40">Transport stream</div>
          <div className="flex flex-wrap gap-2">
            {programs.map((p, i) => (
              <span key={i} className="rounded-lg bg-white/5 px-2 py-1 text-xs text-white/60">
                {p}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function Meter({ label, value }: { label: string; value: number }) {
  const v = Math.max(0, Math.min(100, value));
  const color = v >= 80 ? "bg-emerald-400" : v >= 50 ? "bg-amber-400" : "bg-live";
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-white/55">{label}</span>
        <span className="font-semibold tabular-nums">{value}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${v}%` }}
        />
      </div>
    </div>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-edge/30 pb-1">
      <dt className="text-white/45">{k}</dt>
      <dd className="font-medium tabular-nums">{v}</dd>
    </div>
  );
}
