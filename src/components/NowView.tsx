import { useEffect, useRef, useState } from "react";
import type { Channel, Row } from "../types";
import { fmtTime, progress } from "../lib";

interface Props {
  rows: Row[];
  onPlay: (channel: Channel) => void;
}

export default function NowView({ rows, onPlay }: Props) {
  const [focus, setFocus] = useState(0);
  const [tick, setTick] = useState(new Date());
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => setTick(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const move = (d: number) => setFocus((f) => Math.min(rows.length - 1, Math.max(0, f + d)));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "j") (e.preventDefault(), move(1));
      else if (e.key === "ArrowUp" || e.key === "k") (e.preventDefault(), move(-1));
      else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (rows[focus]) onPlay(rows[focus].channel);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rows, focus, onPlay]);

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-row="${focus}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focus]);

  const current = rows[focus];

  return (
    <div className="grid h-full min-h-0 grid-cols-[1fr_minmax(360px,420px)] gap-8 px-10 py-6">
      <div ref={listRef} className="no-scrollbar -mx-2 overflow-y-auto px-2">
        <div className="space-y-2">
          {rows.map((row, i) => (
            <ChannelRow
              key={row.channel.guideNumber}
              row={row}
              index={i}
              active={i === focus}
              tick={tick}
              onFocus={() => setFocus(i)}
              onPlay={() => onPlay(row.channel)}
            />
          ))}
          {rows.length === 0 && (
            <div className="py-20 text-center text-white/40">No channels in this lineup.</div>
          )}
        </div>
      </div>

      {current && <Hero row={current} tick={tick} onPlay={() => onPlay(current.channel)} />}
    </div>
  );
}

function ChannelRow({
  row,
  index,
  active,
  tick,
  onFocus,
  onPlay,
}: {
  row: Row;
  index: number;
  active: boolean;
  tick: Date;
  onFocus: () => void;
  onPlay: () => void;
}) {
  const { channel, logo, now, next } = row;
  const pct = now ? progress(now.startTime, now.endTime, tick.getTime() / 1000) : 0;

  return (
    <button
      data-row={index}
      onMouseEnter={onFocus}
      onFocus={onFocus}
      onClick={onFocus}
      onDoubleClick={onPlay}
      className={`flex w-full items-center gap-4 rounded-2xl border px-4 py-3 text-left transition ${
        active
          ? "border-accent/70 bg-gradient-to-r from-accent/15 to-accent-2/10 shadow-lg shadow-accent/10"
          : "border-transparent hover:bg-white/5"
      }`}
    >
      <div className="flex w-14 shrink-0 flex-col items-center">
        <span className="text-lg font-bold tabular-nums text-accent">{channel.guideNumber}</span>
        {channel.hd === 1 && (
          <span className="mt-1 rounded bg-white/10 px-1.5 text-[10px] font-semibold tracking-wider text-white/60">
            HD
          </span>
        )}
      </div>

      <div className="flex h-12 w-16 shrink-0 items-center justify-center">
        {logo ? (
          <img src={logo} alt="" className="max-h-12 max-w-16 object-contain" />
        ) : (
          <span className="text-xs text-white/40">{channel.guideName}</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{now?.title ?? channel.guideName}</div>
        <div className="truncate text-sm text-white/45">
          {next ? `Next: ${next.title}` : channel.guideName}
        </div>
        {now && (
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-accent" style={{ width: `${pct * 100}%` }} />
          </div>
        )}
      </div>

      {now && (
        <div className="shrink-0 text-right text-xs text-white/40">
          {fmtTime(now.startTime)}
          <br />
          {fmtTime(now.endTime)}
        </div>
      )}
    </button>
  );
}

function Hero({ row, tick, onPlay }: { row: Row; tick: Date; onPlay: () => void }) {
  const { channel, logo, affiliate, now, next } = row;
  const art = now?.imageUrl || logo;
  const pct = now ? progress(now.startTime, now.endTime, tick.getTime() / 1000) : 0;

  return (
    <aside className="flex min-h-0 flex-col overflow-hidden rounded-3xl border border-edge bg-panel/70 shadow-2xl backdrop-blur-xl">
      <div className="relative aspect-video w-full shrink-0 bg-panel-2">
        {art ? (
          <img src={art} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-white/20">No artwork</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-panel via-panel/20 to-transparent" />
        <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-ink/70 px-3 py-1 text-sm backdrop-blur">
          <span className="font-bold text-accent">{channel.guideNumber}</span>
          <span className="text-white/70">{channel.guideName}</span>
        </div>
        {now && (
          <div className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full bg-live/90 px-3 py-1 text-xs font-bold uppercase tracking-wider">
            <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
            Live
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-6">
        <h2 className="text-2xl font-bold leading-tight">{now?.title ?? channel.guideName}</h2>
        {now?.episodeTitle && <p className="mt-1 text-accent/90">{now.episodeTitle}</p>}

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/50">
          {affiliate && <span>{affiliate}</span>}
          {now && (
            <span>
              {fmtTime(now.startTime)} – {fmtTime(now.endTime)}
            </span>
          )}
          {now?.filter?.[0] && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">{now.filter[0]}</span>
          )}
        </div>

        {now && (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2"
              style={{ width: `${pct * 100}%` }}
            />
          </div>
        )}

        {now?.synopsis && (
          <p className="mt-4 line-clamp-4 text-sm leading-relaxed text-white/65">{now.synopsis}</p>
        )}

        {next && (
          <p className="mt-4 text-sm text-white/45">
            <span className="text-white/35">Up next · {fmtTime(next.startTime)} </span>
            {next.title}
          </p>
        )}

        <button
          onClick={onPlay}
          className="mt-auto flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-accent to-accent-2 px-6 py-4 text-lg font-bold text-ink transition hover:brightness-110"
        >
          ▶ Watch in mpv
        </button>
      </div>
    </aside>
  );
}
