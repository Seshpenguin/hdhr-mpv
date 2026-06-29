use std::path::PathBuf;

fn main() {
    let lib = PathBuf::from("libhdhomerun");
    let os = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();

    // libhdhomerun selects its interface-enumeration backend per OS (see Makefile).
    // Windows is omitted on purpose: hdhomerun_sock_windows.c enumerates
    // interfaces itself, and the posix backends (netdevice/getifaddrs) pull in
    // <sys/ioctl.h>, which MSVC doesn't ship.
    let if_detect = match os.as_str() {
        "linux" | "android" => "netlink",
        _ => "getifaddrs",
    };

    let mut srcs: Vec<String> = [
        "hdhomerun_channels",
        "hdhomerun_channelscan",
        "hdhomerun_control",
        "hdhomerun_debug",
        "hdhomerun_device",
        "hdhomerun_device_selector",
        "hdhomerun_discover",
        "hdhomerun_pkt",
        "hdhomerun_sock",
        "hdhomerun_video",
    ]
    .iter()
    .map(|s| format!("{s}.c"))
    .collect();

    if os == "windows" {
        srcs.push("hdhomerun_os_windows.c".into());
        srcs.push("hdhomerun_sock_windows.c".into());
    } else {
        srcs.push("hdhomerun_os_posix.c".into());
        srcs.push("hdhomerun_sock_posix.c".into());
        srcs.push(format!("hdhomerun_sock_{if_detect}.c"));
    }

    let mut build = cc::Build::new();
    build.include(&lib).warnings(false);
    for s in &srcs {
        build.file(lib.join(s));
    }
    build.compile("hdhomerun");

    match os.as_str() {
        "linux" | "android" => {
            println!("cargo:rustc-link-lib=pthread");
            println!("cargo:rustc-link-lib=rt");
        }
        "windows" => println!("cargo:rustc-link-lib=iphlpapi"),
        _ => {} // macOS/BSD: pthread is provided by libSystem
    }

    let bindings = bindgen::Builder::default()
        .header("wrapper.h")
        .clang_arg(format!("-I{}", lib.display()))
        .allowlist_function("hdhomerun_.*")
        .allowlist_type("hdhomerun_.*")
        .allowlist_var("HDHOMERUN_.*")
        .derive_default(true)
        .layout_tests(false)
        .generate()
        .expect("failed to generate libhdhomerun bindings");

    let out = PathBuf::from(std::env::var("OUT_DIR").unwrap());
    bindings
        .write_to_file(out.join("bindings.rs"))
        .expect("failed to write bindings");

    println!("cargo:rerun-if-changed=wrapper.h");
    println!("cargo:rerun-if-changed=build.rs");
}
