use std::path::{Path, PathBuf};
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

/// Force-bind Back/Escape to quit so a remote's back button closes the player.
/// A script with `add_forced_key_binding` is used rather than `--input-conf`
/// because it layers on top of (instead of replacing) the user's own input.conf.
/// Best-effort: if the file can't be written, playback proceeds without it.
fn back_to_quit_script() -> Option<PathBuf> {
    let path = std::env::temp_dir().join("hdhr-mpv-back.lua");
    let lua = "mp.add_forced_key_binding(\"ESC\", \"hdhr_quit_esc\", function() mp.command(\"quit\") end)\n\
               mp.add_forced_key_binding(\"BS\", \"hdhr_quit_bs\", function() mp.command(\"quit\") end)\n";
    std::fs::write(&path, lua).ok().map(|_| path)
}

/// Spawn mpv on the live stream. The video pipeline (BWDIF deinterlace,
/// debanding, sigmoidized EWA Lanczos upscaling, display-resampling) is supplied
/// by the frontend so it can be tuned from Settings.
pub fn launch(url: &str, title: &str, args: &[String]) -> Result<(), String> {
    let mut cmd = Command::new(binary());
    cmd.arg(url).args(args);
    if let Some(script) = back_to_quit_script() {
        cmd.arg(format!("--script={}", script.display()));
    }
    cmd.arg(format!("--force-media-title={title}"))
        .spawn()
        .map(drop)
        .map_err(|e| format!("Could not launch mpv ({e}). Is mpv installed and on PATH?"))
}
