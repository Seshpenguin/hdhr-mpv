use serde::{Deserialize, Serialize};

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

/// Discover tuners with libhdhomerun, enriching each with the friendly
/// name/model/firmware from its `discover.json` (and falling back to the data
/// libhdhomerun already returned if that HTTP call fails). SiliconDust's cloud
/// lookup and `hdhomerun.local` are tried only if the broadcast finds nothing.
pub async fn discover(client: &reqwest::Client) -> Vec<Device> {
    let found = tokio::task::spawn_blocking(crate::libhh::discover)
        .await
        .unwrap_or_default();

    let mut devices: Vec<Device> = Vec::new();
    for d in found {
        let device = fetch_discover(client, &d.ip).await.unwrap_or_else(|_| Device {
            id: d.device_id.clone(),
            friendly_name: "HDHomeRun".into(),
            model: String::new(),
            firmware: String::new(),
            ip: d.ip.clone(),
            base_url: d.base_url.clone(),
            lineup_url: format!("{}/lineup.json", d.base_url),
            device_auth: d.device_auth.clone(),
            tuner_count: d.tuner_count,
        });
        push_unique(&mut devices, device);
    }

    if devices.is_empty() {
        let mut ips = cloud_discover(client).await.unwrap_or_default();
        if ips.is_empty() {
            ips.push("hdhomerun.local".into());
        }
        for ip in ips {
            if let Ok(device) = fetch_discover(client, &ip).await {
                push_unique(&mut devices, device);
            }
        }
    }
    devices
}

fn push_unique(devices: &mut Vec<Device>, device: Device) {
    if !devices.iter().any(|d| d.id == device.id) {
        devices.push(device);
    }
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
