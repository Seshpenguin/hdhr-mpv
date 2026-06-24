import type { Channel, GuideChannel, Program, Row } from "./types";

export const fmtTime = (unix: number) =>
  new Date(unix * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export const fmtClock = (d: Date) =>
  d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export const fmtDay = (d: Date) =>
  d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });

export const progress = (start: number, end: number, now = Date.now() / 1000) =>
  end > start ? Math.min(1, Math.max(0, (now - start) / (end - start))) : 0;

export const fmtFreq = (hz: number) => (hz > 0 ? `${(hz / 1e6).toFixed(1)} MHz` : "—");

export const fmtRate = (bps: number) =>
  bps > 0 ? `${(bps / 1e6).toFixed(2)} Mbps` : "—";

export const fmtSlot = (d: Date) =>
  d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

const nowNext = (programs: Program[], now: number): [Program?, Program?] => {
  const sorted = [...programs].sort((a, b) => a.startTime - b.startTime);
  const i = sorted.findIndex((p) => now >= p.startTime && now < p.endTime);
  if (i < 0) {
    const upcoming = sorted.find((p) => p.startTime > now);
    return [undefined, upcoming];
  }
  return [sorted[i], sorted[i + 1]];
};

export const buildRows = (channels: Channel[], guide: GuideChannel[]): Row[] => {
  const byNumber = new Map(guide.map((g) => [g.guideNumber, g]));
  const now = Date.now() / 1000;
  return channels
    .filter((c) => c.drm === 0)
    .map((channel) => {
      const g = byNumber.get(channel.guideNumber);
      const [current, next] = g ? nowNext(g.guide, now) : [undefined, undefined];
      return {
        channel,
        logo: g?.imageUrl ?? "",
        affiliate: g?.affiliate ?? "",
        now: current,
        next,
      };
    });
};
