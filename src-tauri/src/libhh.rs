//! Safe wrapper over `hdhomerun-sys` — discovery and tuner control are driven by
//! SiliconDust's libhdhomerun rather than a hand-rolled protocol implementation.

use hdhomerun_sys as sys;
use serde::Serialize;
use std::ffi::{c_char, CStr, CString};
use std::ptr;

pub struct Discovered {
    pub ip: String,
    pub device_id: String,
    pub tuner_count: u32,
    pub device_auth: String,
    pub base_url: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TunerStatus {
    pub index: u32,
    pub vchannel: String,
    pub lock: String,
    pub frequency_hz: u64,
    pub signal_strength: i32,
    pub signal_quality: i32,
    pub symbol_quality: i32,
    pub bitrate: u64,
    pub streaminfo: String,
    pub target: String,
    pub active: bool,
}

/// Broadcast for tuners via `hdhomerun_discover_find_devices_custom_v2`.
pub fn discover() -> Vec<Discovered> {
    const MAX: usize = 64;
    let mut list = vec![sys::hdhomerun_discover_device_t::default(); MAX];
    let found = unsafe {
        sys::hdhomerun_discover_find_devices_custom_v2(
            0,
            sys::HDHOMERUN_DEVICE_TYPE_TUNER,
            sys::HDHOMERUN_DEVICE_ID_WILDCARD,
            list.as_mut_ptr(),
            MAX as i32,
        )
    };
    if found <= 0 {
        return Vec::new();
    }
    list.into_iter()
        .take(found as usize)
        .map(|d| {
            let ip = d.ip_addr;
            Discovered {
                ip: format!("{}.{}.{}.{}", ip >> 24 & 0xff, ip >> 16 & 0xff, ip >> 8 & 0xff, ip & 0xff),
                device_id: format!("{:08X}", d.device_id),
                tuner_count: d.tuner_count as u32,
                device_auth: c_field(&d.device_auth),
                base_url: c_field(&d.base_url),
            }
        })
        .collect()
}

/// Per-tuner signal/lock status via `hdhomerun_device_get_tuner_status` plus the
/// `vchannel` / `streaminfo` / `target` control variables.
pub fn tuner_status(ip: &str, count: u32) -> Result<Vec<TunerStatus>, String> {
    let target = CString::new(ip).map_err(|_| "invalid address")?;
    let hd = unsafe { sys::hdhomerun_device_create_from_str(target.as_ptr(), ptr::null_mut()) };
    if hd.is_null() {
        return Err(format!("could not open device at {ip}"));
    }

    let mut tuners = Vec::with_capacity(count as usize);
    for index in 0..count {
        unsafe { sys::hdhomerun_device_set_tuner(hd, index) };

        let mut status = sys::hdhomerun_tuner_status_t::default();
        let ok = unsafe { sys::hdhomerun_device_get_tuner_status(hd, ptr::null_mut(), &mut status) };

        let (ch_mod, frequency_hz) = parse_channel(&c_field(&status.channel));
        let lock_str = c_field(&status.lock_str);
        let lock = if lock_str.is_empty() { ch_mod } else { lock_str };

        tuners.push(TunerStatus {
            index,
            vchannel: get_var(hd, &format!("/tuner{index}/vchannel")),
            active: ok > 0 && status.signal_present && lock != "none" && !lock.is_empty(),
            lock,
            frequency_hz,
            signal_strength: status.signal_strength as i32,
            signal_quality: status.signal_to_noise_quality as i32,
            symbol_quality: status.symbol_error_quality as i32,
            bitrate: status.raw_bits_per_second as u64,
            streaminfo: get_var(hd, &format!("/tuner{index}/streaminfo")),
            target: get_var(hd, &format!("/tuner{index}/target")),
        });
    }

    unsafe { sys::hdhomerun_device_destroy(hd) };
    Ok(tuners)
}

fn get_var(hd: *mut sys::hdhomerun_device_t, name: &str) -> String {
    let Ok(name) = CString::new(name) else {
        return String::new();
    };
    let mut value: *mut c_char = ptr::null_mut();
    let mut error: *mut c_char = ptr::null_mut();
    let ret = unsafe { sys::hdhomerun_device_get_var(hd, name.as_ptr(), &mut value, &mut error) };
    if ret > 0 && error.is_null() && !value.is_null() {
        unsafe { CStr::from_ptr(value) }.to_string_lossy().trim().to_string()
    } else {
        String::new()
    }
}

/// `8vsb:539000000` -> ("8vsb", 539000000).
fn parse_channel(channel: &str) -> (String, u64) {
    match channel.split_once(':') {
        Some((modulation, freq)) => (modulation.to_string(), freq.parse().unwrap_or(0)),
        None => (channel.to_string(), 0),
    }
}

fn c_field(buf: &[c_char]) -> String {
    let len = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
    String::from_utf8_lossy(&buf[..len].iter().map(|&c| c as u8).collect::<Vec<_>>()).into_owned()
}
