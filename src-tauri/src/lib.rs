mod control;
mod hdhomerun;
mod mpv;

use control::TunerStatus;
use hdhomerun::{Channel, Device, GuideChannel, ScanStatus};
use reqwest::Client;
use tauri::State;

struct Http(Client);

#[tauri::command]
async fn discover_devices(http: State<'_, Http>) -> Result<Vec<Device>, String> {
    Ok(hdhomerun::discover(&http.0).await)
}

#[tauri::command]
async fn connect_device(ip: String, http: State<'_, Http>) -> Result<Device, String> {
    hdhomerun::fetch_discover(&http.0, &ip).await
}

#[tauri::command]
async fn get_lineup(lineup_url: String, http: State<'_, Http>) -> Result<Vec<Channel>, String> {
    hdhomerun::fetch_lineup(&http.0, &lineup_url).await
}

#[tauri::command]
async fn get_guide(device_auth: String, http: State<'_, Http>) -> Result<Vec<GuideChannel>, String> {
    hdhomerun::fetch_guide(&http.0, &device_auth).await
}

#[tauri::command]
async fn start_scan(ip: String, source: String, http: State<'_, Http>) -> Result<(), String> {
    hdhomerun::start_scan(&http.0, &ip, &source).await
}

#[tauri::command]
async fn abort_scan(ip: String, http: State<'_, Http>) -> Result<(), String> {
    hdhomerun::abort_scan(&http.0, &ip).await
}

#[tauri::command]
async fn scan_status(ip: String, http: State<'_, Http>) -> Result<ScanStatus, String> {
    hdhomerun::scan_status(&http.0, &ip).await
}

#[tauri::command]
async fn tuner_status(ip: String, count: u32) -> Result<Vec<TunerStatus>, String> {
    tokio::task::spawn_blocking(move || control::tuner_status(&ip, count))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
fn play_channel(url: String, title: String, args: Vec<String>) -> Result<(), String> {
    mpv::launch(&url, &title, &args)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let http = Client::builder()
        .user_agent("HDHRMPV/0.1")
        .build()
        .expect("failed to build http client");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(Http(http))
        .invoke_handler(tauri::generate_handler![
            discover_devices,
            connect_device,
            get_lineup,
            get_guide,
            start_scan,
            abort_scan,
            scan_status,
            tuner_status,
            play_channel
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
