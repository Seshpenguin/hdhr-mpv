export interface Device {
  id: string;
  friendlyName: string;
  model: string;
  firmware: string;
  ip: string;
  baseUrl: string;
  lineupUrl: string;
  deviceAuth: string;
  tunerCount: number;
}

export interface TunerStatus {
  index: number;
  vchannel: string;
  lock: string;
  frequencyHz: number;
  signalStrength: number;
  signalQuality: number;
  symbolQuality: number;
  bitrate: number;
  streaminfo: string;
  target: string;
  active: boolean;
}

export interface ScanStatus {
  scanInProgress: number;
  progress: number;
  found: number;
  scanPossible: number;
  source: string;
  sourceList: string[];
}

export interface Channel {
  guideNumber: string;
  guideName: string;
  url: string;
  hd: number;
  drm: number;
  videoCodec: string;
  audioCodec: string;
}

export interface Program {
  startTime: number;
  endTime: number;
  title: string;
  episodeTitle: string;
  episodeNumber: string;
  synopsis: string;
  imageUrl: string;
  filter: string[];
}

export interface GuideChannel {
  guideNumber: string;
  guideName: string;
  affiliate: string;
  imageUrl: string;
  guide: Program[];
}

export interface Row {
  channel: Channel;
  logo: string;
  affiliate: string;
  now?: Program;
  next?: Program;
}
