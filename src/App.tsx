import { useCallback, useEffect, useMemo, useState } from "react";
import Connect from "./components/Connect";
import Shell from "./components/Shell";
import { connectDevice, discoverDevices, getGuide, getLineup, playChannel } from "./api";
import { buildRows } from "./lib";
import { mpvArgs, useSettings } from "./settings";
import type { Channel, Device, GuideChannel } from "./types";

type Phase = "scanning" | "connect" | "loading" | "ready";

export default function App() {
  const [phase, setPhase] = useState<Phase>("scanning");
  const [devices, setDevices] = useState<Device[]>([]);
  const [device, setDevice] = useState<Device | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [guide, setGuide] = useState<GuideChannel[]>([]);
  const [error, setError] = useState<string>();
  const [toast, setToast] = useState<string>();
  const [settings, setSettings] = useSettings();

  const rows = useMemo(() => buildRows(channels, guide), [channels, guide]);

  const load = useCallback(async (d: Device) => {
    setDevice(d);
    setPhase("loading");
    setError(undefined);
    try {
      const [lineup, epg] = await Promise.all([
        getLineup(d.lineupUrl),
        getGuide(d.deviceAuth).catch(() => []),
      ]);
      setChannels(lineup);
      setGuide(epg);
      setPhase("ready");
    } catch {
      setError(`Couldn't load the lineup from ${d.friendlyName}.`);
      setPhase("connect");
    }
  }, []);

  const scan = useCallback(async () => {
    setPhase("scanning");
    setError(undefined);
    try {
      const found = await discoverDevices();
      setDevices(found);
      if (found.length === 1) await load(found[0]);
      else setPhase("connect");
    } catch (e) {
      setError(String(e));
      setPhase("connect");
    }
  }, [load]);

  const manual = useCallback(
    async (ip: string) => {
      setPhase("scanning");
      setError(undefined);
      try {
        await load(await connectDevice(ip));
      } catch {
        setError(`No HDHomeRun answered at ${ip}.`);
        setPhase("connect");
      }
    },
    [load],
  );

  useEffect(() => {
    scan();
  }, [scan]);

  const play = useCallback(
    (channel: Channel) =>
      playChannel(
        channel.url,
        `${channel.guideNumber}  ${channel.guideName}`,
        mpvArgs(settings),
      ).catch((e) => setToast(String(e))),
    [settings],
  );

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(undefined), 5000);
    return () => clearTimeout(id);
  }, [toast]);

  return (
    <main className="h-full">
      {phase === "ready" && device ? (
        <Shell
          device={device}
          channels={channels}
          guide={guide}
          rows={rows}
          settings={settings}
          setSettings={setSettings}
          onPlay={play}
          onRefresh={() => load(device)}
          onBack={() => setPhase("connect")}
        />
      ) : phase === "loading" ? (
        <Splash label={`Tuning in to ${device?.friendlyName ?? "your tuner"}…`} />
      ) : (
        <Connect
          devices={devices}
          scanning={phase === "scanning"}
          error={error}
          onScan={scan}
          onPick={load}
          onManual={manual}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl border border-live/40 bg-panel/90 px-6 py-3 text-sm text-white/80 shadow-2xl backdrop-blur">
          {toast}
        </div>
      )}
    </main>
  );
}

function Splash({ label }: { label: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-accent" />
      <p className="text-white/55">{label}</p>
    </div>
  );
}
