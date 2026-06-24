import { useEffect, useState } from "react";

export interface MpvSettings {
  deinterlace: boolean;
  deband: boolean;
  upscale: boolean;
  displayResample: boolean;
  fullscreen: boolean;
  hwdec: "auto-copy" | "auto" | "no";
}

export const DEFAULT_SETTINGS: MpvSettings = {
  deinterlace: true,
  deband: true,
  upscale: true,
  displayResample: true,
  fullscreen: true,
  hwdec: "auto-copy",
};

/// Assemble the mpv command line from the user's toggles. Defaults reproduce the
/// curated reference pipeline; each switch maps to one stage.
export const mpvArgs = (s: MpvSettings): string[] => {
  const args: string[] = [];
  if (s.deinterlace) args.push("--vf=bwdif=mode=send_field:parity=tff");
  if (s.deband) args.push("--deband=yes", "--deband-iterations=2", "--deband-grain=24");
  if (s.upscale)
    args.push(
      "--scale=ewa_lanczossharp",
      "--cscale=ewa_lanczossharp",
      "--dscale=mitchell",
      "--sigmoid-upscaling=yes",
    );
  if (s.displayResample) args.push("--video-sync=display-resample");
  args.push(`--hwdec=${s.hwdec}`);
  if (s.fullscreen) args.push("--fullscreen");
  args.push("--force-window=immediate");
  return args;
};

const KEY = "hdhr-mpv.settings";

export const useSettings = (): [MpvSettings, (s: MpvSettings) => void] => {
  const [settings, setSettings] = useState<MpvSettings>(() => {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
    } catch {
      return DEFAULT_SETTINGS;
    }
  });
  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(settings));
  }, [settings]);
  return [settings, setSettings];
};
