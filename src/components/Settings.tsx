import { useState, type ReactNode } from "react";
import type { Device } from "../types";
import type { MpvSettings } from "../settings";
import ScanModal from "./ScanModal";

interface Props {
  device: Device;
  settings: MpvSettings;
  setSettings: (s: MpvSettings) => void;
  onRefresh: () => void;
  onBack: () => void;
}

export default function Settings({ device, settings, setSettings, onRefresh, onBack }: Props) {
  const [scanning, setScanning] = useState(false);
  const set = <K extends keyof MpvSettings>(key: K, value: MpvSettings[K]) =>
    setSettings({ ...settings, [key]: value });

  return (
    <div className="no-scrollbar h-full overflow-y-auto px-10 py-6">
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-2">
        <Card title="Tuner">
          <Info k="Name" v={device.friendlyName} />
          <Info k="Model" v={device.model} />
          <Info k="Firmware" v={device.firmware || "—"} />
          <Info k="Device ID" v={device.id || "—"} />
          <Info k="Address" v={device.ip} />
          <Info k="Tuners" v={String(device.tunerCount)} />
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => setScanning(true)}
              className="flex-1 rounded-2xl bg-accent px-4 py-3 font-semibold text-ink transition hover:brightness-110"
            >
              Scan for channels
            </button>
            <button
              onClick={onRefresh}
              className="rounded-2xl border border-edge px-4 py-3 font-semibold text-white/70 transition hover:border-accent"
            >
              Refresh guide
            </button>
          </div>
          <button
            onClick={onBack}
            className="mt-3 w-full rounded-2xl border border-edge px-4 py-3 text-white/60 transition hover:border-accent hover:text-white"
          >
            Change device
          </button>
        </Card>

        <Card title="mpv video pipeline">
          <Toggle
            label="Deinterlace (BWDIF)"
            desc="Field-doubling 1080i → 60p"
            on={settings.deinterlace}
            onChange={(v) => set("deinterlace", v)}
          />
          <Toggle
            label="Debanding"
            desc="2 iterations · grain 24"
            on={settings.deband}
            onChange={(v) => set("deband", v)}
          />
          <Toggle
            label="EWA Lanczos upscaling"
            desc="ewa_lanczossharp + sigmoid"
            on={settings.upscale}
            onChange={(v) => set("upscale", v)}
          />
          <Toggle
            label="Display resampling"
            desc="video-sync=display-resample"
            on={settings.displayResample}
            onChange={(v) => set("displayResample", v)}
          />
          <Toggle
            label="Fullscreen"
            desc="Launch mpv fullscreen"
            on={settings.fullscreen}
            onChange={(v) => set("fullscreen", v)}
          />
          <div className="flex items-center justify-between pt-2">
            <div>
              <div className="font-medium">Hardware decoding</div>
              <div className="text-sm text-white/45">hwdec mode</div>
            </div>
            <Segmented
              options={["auto-copy", "auto", "no"]}
              value={settings.hwdec}
              onChange={(v) => set("hwdec", v as MpvSettings["hwdec"])}
            />
          </div>
        </Card>
      </div>

      {scanning && (
        <ScanModal
          device={device}
          onClose={() => setScanning(false)}
          onDone={onRefresh}
        />
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-edge bg-panel/60 p-6 backdrop-blur-xl">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Info({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-edge/30 pb-1 text-sm">
      <span className="text-white/45">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}

function Toggle({
  label,
  desc,
  on,
  onChange,
}: {
  label: string;
  desc: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="font-medium">{label}</div>
        <div className="text-sm text-white/45">{desc}</div>
      </div>
      <button
        onClick={() => onChange(!on)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-accent" : "bg-white/15"}`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${on ? "left-6" : "left-1"}`}
        />
      </button>
    </div>
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex rounded-xl border border-edge p-0.5 text-sm">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`rounded-lg px-3 py-1.5 transition ${
            value === o ? "bg-accent font-semibold text-ink" : "text-white/55 hover:text-white"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
