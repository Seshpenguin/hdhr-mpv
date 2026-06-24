//! Live smoke test: drive SiliconDust's libhdhomerun discovery directly.
//! Run with: cargo run -p hdhomerun-sys --example discover

use hdhomerun_sys as sys;
use std::ffi::{CStr, CString};
use std::ptr;

fn main() {
    let mut list = vec![sys::hdhomerun_discover_device_t::default(); 64];
    let n = unsafe {
        sys::hdhomerun_discover_find_devices_custom_v2(
            0,
            sys::HDHOMERUN_DEVICE_TYPE_TUNER,
            sys::HDHOMERUN_DEVICE_ID_WILDCARD,
            list.as_mut_ptr(),
            list.len() as i32,
        )
    };

    println!("libhdhomerun discovered {n} device(s):");
    for d in list.iter().take(n.max(0) as usize) {
        let ip = d.ip_addr;
        let base = unsafe { CStr::from_ptr(d.base_url.as_ptr()) }.to_string_lossy();
        println!(
            "  id={:08X}  ip={}.{}.{}.{}  tuners={}  base_url={}",
            d.device_id,
            ip >> 24 & 0xff,
            ip >> 16 & 0xff,
            ip >> 8 & 0xff,
            ip & 0xff,
            d.tuner_count,
            base,
        );

        let ip_str = CString::new(format!("{}.{}.{}.{}", ip >> 24 & 0xff, ip >> 16 & 0xff, ip >> 8 & 0xff, ip & 0xff)).unwrap();
        let hd = unsafe { sys::hdhomerun_device_create_from_str(ip_str.as_ptr(), ptr::null_mut()) };
        for t in 0..d.tuner_count as u32 {
            unsafe { sys::hdhomerun_device_set_tuner(hd, t) };
            let mut st = sys::hdhomerun_tuner_status_t::default();
            unsafe { sys::hdhomerun_device_get_tuner_status(hd, ptr::null_mut(), &mut st) };
            let ch = unsafe { CStr::from_ptr(st.channel.as_ptr()) }.to_string_lossy();
            let lock = unsafe { CStr::from_ptr(st.lock_str.as_ptr()) }.to_string_lossy();
            println!(
                "    tuner{t}: channel={ch} lock={lock} ss={} snq={} seq={} bps={}",
                st.signal_strength, st.signal_to_noise_quality, st.symbol_error_quality, st.raw_bits_per_second,
            );
        }
        unsafe { sys::hdhomerun_device_destroy(hd) };
    }
}
