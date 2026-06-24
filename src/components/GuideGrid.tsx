import { useEffect, useMemo, useState } from "react";
import type { Channel, GuideChannel } from "../types";
import { fmtSlot } from "../lib";

interface Props {
  channels: Channel[];
  guide: GuideChannel[];
  onPlay: (channel: Channel) => void;
}

const LABEL_W = 200;
const ROW_H = 64;
const PX_PER_MIN = 7;
const SPAN_MIN = 6 * 60;

export default function GuideGrid({ channels, guide, onPlay }: Props) {
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() / 1000), 30_000);
    return () => clearInterval(id);
  }, []);

  const byNumber = useMemo(() => new Map(guide.map((g) => [g.guideNumber, g])), [guide]);
  const winStart = Math.floor(now / 1800) * 1800 - 1800;
  const totalW = SPAN_MIN * PX_PER_MIN;
  const x = (t: number) => ((t - winStart) / 60) * PX_PER_MIN;

  const slots = Array.from({ length: SPAN_MIN / 30 + 1 }, (_, i) => winStart + i * 1800);
  const rows = channels.filter((c) => c.drm === 0);

  return (
    <div className="no-scrollbar h-full overflow-auto px-10 py-6">
      <div className="relative" style={{ width: LABEL_W + totalW }}>
        <div className="sticky top-0 z-30 flex h-9 bg-ink/95 backdrop-blur">
          <div className="sticky left-0 z-40 shrink-0 bg-ink/95" style={{ width: LABEL_W }} />
          <div className="relative" style={{ width: totalW }}>
            {slots.map((t) => (
              <div
                key={t}
                className="absolute top-0 border-l border-edge/60 pl-2 text-xs text-white/45"
                style={{ left: x(t) }}
              >
                {fmtSlot(new Date(t * 1000))}
              </div>
            ))}
          </div>
        </div>

        <div
          className="pointer-events-none absolute bottom-0 top-9 z-20 w-0.5 bg-live"
          style={{ left: LABEL_W + x(now) }}
        />

        {rows.map((channel) => {
          const g = byNumber.get(channel.guideNumber);
          return (
            <div key={channel.guideNumber} className="flex" style={{ height: ROW_H }}>
              <button
                onClick={() => onPlay(channel)}
                className="sticky left-0 z-10 flex shrink-0 items-center gap-3 border-b border-r border-edge/40 bg-panel/90 px-3 text-left backdrop-blur transition hover:bg-panel-2"
                style={{ width: LABEL_W }}
              >
                <span className="w-10 shrink-0 text-right font-bold tabular-nums text-accent">
                  {channel.guideNumber}
                </span>
                {g?.imageUrl ? (
                  <img src={g.imageUrl} alt="" className="max-h-8 max-w-12 object-contain" />
                ) : (
                  <span className="truncate text-sm text-white/70">{channel.guideName}</span>
                )}
              </button>

              <div className="relative border-b border-edge/30" style={{ width: totalW }}>
                {(g?.guide ?? []).map((p) => {
                  const left = Math.max(0, x(p.startTime));
                  const right = Math.min(totalW, x(p.endTime));
                  if (right - left < 2) return null;
                  const live = now >= p.startTime && now < p.endTime;
                  const past = p.endTime <= now;
                  return (
                    <button
                      key={p.startTime}
                      onClick={() => onPlay(channel)}
                      title={p.title}
                      className={`absolute top-1 bottom-1 overflow-hidden rounded-lg border px-2 text-left transition ${
                        live
                          ? "border-accent/70 bg-gradient-to-r from-accent/25 to-accent-2/15"
                          : past
                            ? "border-edge/40 bg-white/[0.02] text-white/40"
                            : "border-edge/60 bg-panel-2/70 hover:border-accent/50"
                      }`}
                      style={{ left, width: right - left }}
                    >
                      <div className="truncate pt-1 text-sm font-medium">{p.title}</div>
                      <div className="truncate text-xs text-white/40">{fmtSlot(new Date(p.startTime * 1000))}</div>
                    </button>
                  );
                })}
                {(!g || g.guide.length === 0) && (
                  <div className="flex h-full items-center px-3 text-sm text-white/25">
                    No guide data
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
