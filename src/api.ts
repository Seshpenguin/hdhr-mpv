import { invoke } from "@tauri-apps/api/core";
import type { Channel, Device, GuideChannel, ScanStatus, TunerStatus } from "./types";

export const discoverDevices = () => invoke<Device[]>("discover_devices");

export const connectDevice = (ip: string) => invoke<Device>("connect_device", { ip });

export const getLineup = (lineupUrl: string) => invoke<Channel[]>("get_lineup", { lineupUrl });

export const getGuide = (deviceAuth: string) =>
  invoke<GuideChannel[]>("get_guide", { deviceAuth });

export const startScan = (ip: string, source: string) =>
  invoke<void>("start_scan", { ip, source });

export const abortScan = (ip: string) => invoke<void>("abort_scan", { ip });

export const scanStatus = (ip: string) => invoke<ScanStatus>("scan_status", { ip });

export const tunerStatus = (ip: string, count: number) =>
  invoke<TunerStatus[]>("tuner_status", { ip, count });

export const playChannel = (url: string, title: string, args: string[]) =>
  invoke<void>("play_channel", { url, title, args });
