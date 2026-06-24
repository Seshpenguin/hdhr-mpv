use std::path::Path;
use std::process::Command;

fn binary() -> String {
    if let Ok(path) = std::env::var("MPV_PATH") {
        if !path.is_empty() {
            return path;
        }
    }
    ["/opt/homebrew/bin/mpv", "/usr/local/bin/mpv", "/usr/bin/mpv", "/snap/bin/mpv"]
        .into_iter()
        .find(|p| Path::new(p).exists())
        .unwrap_or("mpv")
        .to_string()
}

/// Spawn mpv on the live stream. The video pipeline (BWDIF deinterlace,
/// debanding, sigmoidized EWA Lanczos upscaling, display-resampling) is supplied
/// by the frontend so it can be tuned from Settings.
pub fn launch(url: &str, title: &str, args: &[String]) -> Result<(), String> {
    Command::new(binary())
        .arg(url)
        .args(args)
        .arg(format!("--force-media-title={title}"))
        .spawn()
        .map(drop)
        .map_err(|e| format!("Could not launch mpv ({e}). Is mpv installed and on PATH?"))
}
