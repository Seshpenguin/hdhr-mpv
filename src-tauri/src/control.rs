use serde::Serialize;
use std::io::{Read, Write};
use std::net::{TcpStream, ToSocketAddrs};
use std::time::Duration;

const CONTROL_PORT: u16 = 65001;
const TYPE_GETSET_REQ: u16 = 0x0004;
const TAG_GETSET_NAME: u8 = 0x03;
const TAG_GETSET_VALUE: u8 = 0x04;
const TAG_ERROR_MESSAGE: u8 = 0x05;

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

/// A persistent control-protocol connection to a tuner over TCP. The HDHomeRun
/// getset protocol is request/response, so a single socket serves many reads.
struct Control {
    stream: TcpStream,
}

impl Control {
    fn connect(ip: &str) -> Result<Self, String> {
        let addr = (ip, CONTROL_PORT)
            .to_socket_addrs()
            .map_err(err)?
            .next()
            .ok_or("could not resolve device")?;
        let stream = TcpStream::connect_timeout(&addr, Duration::from_millis(800)).map_err(err)?;
        stream.set_read_timeout(Some(Duration::from_millis(800))).ok();
        stream.set_write_timeout(Some(Duration::from_millis(800))).ok();
        Ok(Self { stream })
    }

    fn get(&mut self, name: &str) -> Result<String, String> {
        let mut value = name.as_bytes().to_vec();
        value.push(0);

        let mut payload = vec![TAG_GETSET_NAME];
        put_varlen(&mut payload, value.len());
        payload.extend_from_slice(&value);

        let mut pkt = Vec::with_capacity(payload.len() + 8);
        pkt.extend_from_slice(&TYPE_GETSET_REQ.to_be_bytes());
        pkt.extend_from_slice(&(payload.len() as u16).to_be_bytes());
        pkt.extend_from_slice(&payload);
        pkt.extend_from_slice(&crc32fast::hash(&pkt).to_le_bytes());

        self.stream.write_all(&pkt).map_err(err)?;

        let mut header = [0u8; 4];
        self.stream.read_exact(&mut header).map_err(err)?;
        let len = u16::from_be_bytes([header[2], header[3]]) as usize;
        let mut rest = vec![0u8; len + 4];
        self.stream.read_exact(&mut rest).map_err(err)?;
        parse_reply(&rest[..len])
    }
}

pub fn tuner_status(ip: &str, count: u32) -> Result<Vec<TunerStatus>, String> {
    let mut ctrl = Control::connect(ip)?;
    let mut tuners = Vec::new();
    for index in 0..count {
        let status = ctrl.get(&format!("/tuner{index}/status")).unwrap_or_default();
        let (lock, freq, ss, snq, seq, bps) = parse_status(&status);
        tuners.push(TunerStatus {
            index,
            vchannel: clean(ctrl.get(&format!("/tuner{index}/vchannel"))),
            lock: lock.clone(),
            frequency_hz: freq,
            signal_strength: ss,
            signal_quality: snq,
            symbol_quality: seq,
            bitrate: bps,
            streaminfo: clean(ctrl.get(&format!("/tuner{index}/streaminfo"))),
            target: clean(ctrl.get(&format!("/tuner{index}/target"))),
            active: !lock.is_empty() && lock != "none",
        });
    }
    Ok(tuners)
}

/// Parse `ch=8vsb:539000000 lock=8vsb ss=88 snq=100 seq=100 bps=2895744 pps=0`.
fn parse_status(s: &str) -> (String, u64, i32, i32, i32, u64) {
    let (mut lock, mut freq, mut ss, mut snq, mut seq, mut bps) =
        (String::new(), 0u64, 0, 0, 0, 0u64);
    for (key, val) in s.split_whitespace().filter_map(|t| t.split_once('=')) {
        match key {
            "ch" => freq = val.split_once(':').map_or(0, |(_, f)| f.parse().unwrap_or(0)),
            "lock" => lock = val.to_string(),
            "ss" => ss = val.parse().unwrap_or(0),
            "snq" => snq = val.parse().unwrap_or(0),
            "seq" => seq = val.parse().unwrap_or(0),
            "bps" => bps = val.parse().unwrap_or(0),
            _ => {}
        }
    }
    (lock, freq, ss, snq, seq, bps)
}

fn clean(r: Result<String, String>) -> String {
    r.map(|s| s.trim().to_string()).unwrap_or_default()
}

fn put_varlen(buf: &mut Vec<u8>, len: usize) {
    if len <= 127 {
        buf.push(len as u8);
    } else {
        buf.push((len as u8 & 0x7f) | 0x80);
        buf.push((len >> 7) as u8);
    }
}

fn parse_reply(payload: &[u8]) -> Result<String, String> {
    let mut i = 0;
    let mut value = None;
    while i + 2 <= payload.len() {
        let tag = payload[i];
        i += 1;
        let mut len = (payload[i] & 0x7f) as usize;
        if payload[i] & 0x80 != 0 {
            i += 1;
            len |= (*payload.get(i).ok_or("truncated tlv")? as usize) << 7;
        }
        i += 1;
        let end = i + len;
        if end > payload.len() {
            break;
        }
        let v = String::from_utf8_lossy(&payload[i..end])
            .trim_end_matches('\0')
            .to_string();
        i = end;
        match tag {
            TAG_GETSET_VALUE => value = Some(v),
            TAG_ERROR_MESSAGE => return Err(v),
            _ => {}
        }
    }
    value.ok_or_else(|| "no value in reply".into())
}

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}
