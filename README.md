<p align="center">
  <img src="assets/wordmark.png" alt="HDHR MPV" width="660">
</p>

A lean, cross-platform 10-foot live-TV experience for **HDHomeRun** network
tuners — built with **Tauri 2**, **React**, and **Tailwind**, with playback
handed off to **mpv** for reference-quality video.

Inspired by Windows Media Center and TiVo: browse a live channel guide from the
couch, then watch any channel through a hand-tuned mpv pipeline that turns a
1080i MPEG-2 broadcast into smooth, clean, progressive video.

## Pages

A remote-style tab bar (←/→ or keys 1–4) switches between:

- **Now** — channel rail with now/next, artwork and a hero detail panel.
- **Guide** — a full EPG grid: time across the top, channels down the side,
  programs as horizontal blocks (past, live and upcoming) with a live time line.
- **Signal** — per-tuner diagnostics polled live via libhdhomerun
  (`hdhomerun_device_get_tuner_status`): signal strength / quality / symbol
  quality meters, modulation, frequency, bitrate, transport-stream and codec.
- **Settings** — device info, a channel-scan modal (progress + detected
  stations), and live toggles for every stage of the mpv pipeline.

## The mpv pipeline

Selecting a channel launches mpv with:

```
--vf=bwdif=mode=send_field:parity=tff   # BWDIF field-doubling deinterlace → 60p
--deband=yes --deband-iterations=2 --deband-grain=24
--scale=ewa_lanczossharp --cscale=ewa_lanczossharp --dscale=mitchell
--sigmoid-upscaling=yes
--video-sync=display-resample
--hwdec=auto-copy
```

## How it works

- **Discovery** — SiliconDust's **libhdhomerun** (vendored as a git submodule,
  compiled and linked through the `hdhomerun-sys` FFI crate), with the cloud
  lookup and `hdhomerun.local` as fallbacks, plus manual IP entry.
- **Lineup** — channels read from the device's `lineup.json`.
- **Guide** — now/next program data, artwork and synopses from the SiliconDust
  guide API (`DeviceAuth` from `discover.json`).
- **Playback** — the Rust backend spawns `mpv` with the curated pipeline.

All network and process work lives in Rust (`src-tauri/src/`); the React UI only
calls a handful of typed commands.

## Develop

```bash
npm install
npm run tauri dev      # desktop app with live reload
npm run tauri build    # production bundle
```

### Requirements

- [mpv](https://mpv.io) on `PATH` (or set `MPV_PATH`)
- Rust + Node
- An HDHomeRun tuner on the same network

## Keyboard

| Key | Action |
| --- | --- |
| ← / → (or 1–4) | Switch pages |
| ↑ / ↓ (or j / k) | Browse channels (Now) |
| Enter / Space | Watch in mpv |
| Esc | Back to devices |

## Layout

```
src/
  App.tsx              state machine: scan → connect → ready
  api.ts               typed Tauri command bindings
  lib.ts               time / guide-merge / formatting helpers
  settings.ts          mpv pipeline toggles + arg builder (persisted)
  components/
    Connect.tsx        discovery / device picker / manual IP
    Shell.tsx          tab nav + clock + page routing
    NowView.tsx        channel rail + hero detail
    GuideGrid.tsx      EPG time-grid
    Signal.tsx         live tuner signal meters
    Settings.tsx       device info + scan + mpv toggles
    ScanModal.tsx      channel-scan progress
hdhomerun-sys/         FFI crate: cc-builds libhdhomerun + bindgen bindings
  libhdhomerun/        git submodule (SiliconDust, LGPL-2.1)
src-tauri/src/
  lib.rs               Tauri commands
  hdhomerun.rs         discovery (libhdhomerun) + HTTP lineup, guide, scan
  libhh.rs             safe wrapper over libhdhomerun (discovery, tuner status)
  mpv.rs               mpv launch
```

## Credits & licensing

Device discovery and tuner control are powered by SiliconDust's
[libhdhomerun](https://github.com/Silicondust/libhdhomerun), vendored as a git
submodule under `hdhomerun-sys/libhdhomerun` and licensed under the **LGPL-2.1**.
It is compiled from source and linked via the `hdhomerun-sys` crate; because the
full source is vendored, the result stays relinkable per the LGPL. The channel
lineup and guide use SiliconDust's HTTP/cloud APIs (not part of the library).

To fetch the submodule after cloning:

```bash
git submodule update --init --recursive
```
