use serde::{Deserialize, Serialize};
use std::net::{Ipv4Addr, SocketAddr, UdpSocket};
use std::time::{Duration, Instant};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Device {
    pub id: String,
    pub friendly_name: String,
    pub model: String,
    pub firmware: String,
    pub ip: String,
    pub base_url: String,
    pub lineup_url: String,
    pub device_auth: String,
    pub tuner_count: u32,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanStatus {
    #[serde(alias = "ScanInProgress", default)]
    pub scan_in_progress: u8,
    #[serde(alias = "Progress", default)]
    pub progress: u32,
    #[serde(alias = "Found", default)]
    pub found: u32,
    #[serde(alias = "ScanPossible", default)]
    pub scan_possible: u8,
    #[serde(alias = "Source", default)]
    pub source: String,
    #[serde(alias = "SourceList", default)]
    pub source_list: Vec<String>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Channel {
    #[serde(alias = "GuideNumber")]
    pub guide_number: String,
    #[serde(alias = "GuideName", default)]
    pub guide_name: String,
    #[serde(alias = "URL")]
    pub url: String,
    #[serde(alias = "HD", default)]
    pub hd: u8,
    #[serde(alias = "DRM", default)]
    pub drm: u8,
    #[serde(alias = "VideoCodec", default)]
    pub video_codec: String,
    #[serde(alias = "AudioCodec", default)]
    pub audio_codec: String,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GuideChannel {
    #[serde(alias = "GuideNumber")]
    pub guide_number: String,
    #[serde(alias = "GuideName", default)]
    pub guide_name: String,
    #[serde(alias = "Affiliate", default)]
    pub affiliate: String,
    #[serde(alias = "ImageURL", default)]
    pub image_url: String,
    #[serde(alias = "Guide", default)]
    pub guide: Vec<Program>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Program {
    #[serde(alias = "StartTime", default)]
    pub start_time: i64,
    #[serde(alias = "EndTime", default)]
    pub end_time: i64,
    #[serde(alias = "Title", default)]
    pub title: String,
    #[serde(alias = "EpisodeTitle", default)]
    pub episode_title: String,
    #[serde(alias = "EpisodeNumber", default)]
    pub episode_number: String,
    #[serde(alias = "Synopsis", default)]
    pub synopsis: String,
    #[serde(alias = "ImageURL", default)]
    pub image_url: String,
    #[serde(alias = "Filter", default)]
    pub filter: Vec<String>,
}

#[derive(Deserialize)]
struct DiscoverJson {
    #[serde(rename = "FriendlyName")]
    friendly_name: Option<String>,
    #[serde(rename = "ModelNumber")]
    model_number: Option<String>,
    #[serde(rename = "FirmwareVersion")]
    firmware_version: Option<String>,
    #[serde(rename = "DeviceID")]
    device_id: Option<String>,
    #[serde(rename = "DeviceAuth")]
    device_auth: Option<String>,
    #[serde(rename = "BaseURL")]
    base_url: Option<String>,
    #[serde(rename = "LineupURL")]
    lineup_url: Option<String>,
    #[serde(rename = "TunerCount")]
    tuner_count: Option<u32>,
}

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

/// Probe the LAN with the native HDHomeRun discovery protocol, then fold in
/// SiliconDust's cloud lookup and the `hdhomerun.local` mDNS name so a device
/// is found even when UDP broadcast is filtered. Each responding host is then
/// described via its `discover.json`.
pub async fn discover(client: &reqwest::Client) -> Vec<Device> {
    let mut ips = match tokio::task::spawn_blocking(|| {
        broadcast_discover(Duration::from_millis(1200))
    })
    .await
    {
        Ok(Ok(ips)) => ips,
        _ => Vec::new(),
    };

    if let Ok(cloud) = cloud_discover(client).await {
        for ip in cloud {
            if !ips.contains(&ip) {
                ips.push(ip);
            }
        }
    }
    if ips.is_empty() {
        ips.push("hdhomerun.local".into());
    }

    let mut devices: Vec<Device> = Vec::new();
    for ip in ips {
        if let Ok(device) = fetch_discover(client, &ip).await {
            if !devices.iter().any(|d| d.id == device.id) {
                devices.push(device);
            }
        }
    }
    devices
}

pub async fn fetch_discover(client: &reqwest::Client, ip: &str) -> Result<Device, String> {
    let d: DiscoverJson = client
        .get(format!("http://{ip}/discover.json"))
        .send()
        .await
        .map_err(err)?
        .json()
        .await
        .map_err(err)?;

    let base_url = d.base_url.unwrap_or_else(|| format!("http://{ip}"));
    let lineup_url = d.lineup_url.unwrap_or_else(|| format!("{base_url}/lineup.json"));
    Ok(Device {
        id: d.device_id.unwrap_or_default(),
        friendly_name: d.friendly_name.unwrap_or_else(|| "HDHomeRun".into()),
        model: d.model_number.unwrap_or_default(),
        firmware: d.firmware_version.unwrap_or_default(),
        ip: ip.to_string(),
        base_url,
        lineup_url,
        device_auth: d.device_auth.unwrap_or_default(),
        tuner_count: d.tuner_count.unwrap_or(0),
    })
}

pub async fn fetch_lineup(client: &reqwest::Client, lineup_url: &str) -> Result<Vec<Channel>, String> {
    client
        .get(lineup_url)
        .send()
        .await
        .map_err(err)?
        .json()
        .await
        .map_err(err)
}

pub async fn fetch_guide(
    client: &reqwest::Client,
    device_auth: &str,
) -> Result<Vec<GuideChannel>, String> {
    client
        .get("https://api.hdhomerun.com/api/guide.php")
        .query(&[("DeviceAuth", device_auth)])
        .send()
        .await
        .map_err(err)?
        .json()
        .await
        .map_err(err)
}

pub async fn start_scan(client: &reqwest::Client, ip: &str, source: &str) -> Result<(), String> {
    client
        .post(format!("http://{ip}/lineup.post"))
        .query(&[("scan", "start"), ("source", source)])
        .send()
        .await
        .map_err(err)?
        .error_for_status()
        .map_err(err)?;
    Ok(())
}

pub async fn abort_scan(client: &reqwest::Client, ip: &str) -> Result<(), String> {
    client
        .post(format!("http://{ip}/lineup.post"))
        .query(&[("scan", "abort")])
        .send()
        .await
        .map_err(err)?;
    Ok(())
}

pub async fn scan_status(client: &reqwest::Client, ip: &str) -> Result<ScanStatus, String> {
    client
        .get(format!("http://{ip}/lineup_status.json"))
        .send()
        .await
        .map_err(err)?
        .json()
        .await
        .map_err(err)
}

async fn cloud_discover(client: &reqwest::Client) -> Result<Vec<String>, String> {
    #[derive(Deserialize)]
    struct Entry {
        #[serde(rename = "LocalIP")]
        local_ip: Option<String>,
    }
    let entries: Vec<Entry> = client
        .get("https://ipv4-api.hdhomerun.com/discover")
        .send()
        .await
        .map_err(err)?
        .json()
        .await
        .map_err(err)?;
    Ok(entries.into_iter().filter_map(|e| e.local_ip).collect())
}

const DISCOVER_PORT: u16 = 65001;
const TYPE_DISCOVER_REQ: u16 = 0x0002;
const TYPE_DISCOVER_RPY: u16 = 0x0003;
const TAG_DEVICE_TYPE: u8 = 0x01;
const TAG_DEVICE_ID: u8 = 0x02;
const DEVICE_TYPE_TUNER: u32 = 0x0000_0001;
const DEVICE_ID_WILDCARD: u32 = 0xFFFF_FFFF;

fn discover_request() -> Vec<u8> {
    let mut payload = Vec::with_capacity(12);
    payload.push(TAG_DEVICE_TYPE);
    payload.push(4);
    payload.extend_from_slice(&DEVICE_TYPE_TUNER.to_be_bytes());
    payload.push(TAG_DEVICE_ID);
    payload.push(4);
    payload.extend_from_slice(&DEVICE_ID_WILDCARD.to_be_bytes());

    let mut pkt = Vec::with_capacity(payload.len() + 8);
    pkt.extend_from_slice(&TYPE_DISCOVER_REQ.to_be_bytes());
    pkt.extend_from_slice(&(payload.len() as u16).to_be_bytes());
    pkt.extend_from_slice(&payload);
    pkt.extend_from_slice(&crc32fast::hash(&pkt).to_le_bytes());
    pkt
}

fn broadcast_discover(timeout: Duration) -> std::io::Result<Vec<String>> {
    let socket = UdpSocket::bind((Ipv4Addr::UNSPECIFIED, 0))?;
    socket.set_broadcast(true)?;
    socket.set_read_timeout(Some(Duration::from_millis(250)))?;
    socket.send_to(&discover_request(), (Ipv4Addr::BROADCAST, DISCOVER_PORT))?;

    let mut ips = Vec::new();
    let mut buf = [0u8; 1500];
    let deadline = Instant::now() + timeout;
    while Instant::now() < deadline {
        match socket.recv_from(&mut buf) {
            Ok((n, SocketAddr::V4(addr)))
                if n >= 4 && u16::from_be_bytes([buf[0], buf[1]]) == TYPE_DISCOVER_RPY =>
            {
                let ip = addr.ip().to_string();
                if !ips.contains(&ip) {
                    ips.push(ip);
                }
            }
            Ok(_) => {}
            Err(e) if matches!(e.kind(), std::io::ErrorKind::WouldBlock | std::io::ErrorKind::TimedOut) => {}
            Err(e) => return Err(e),
        }
    }
    Ok(ips)
}
