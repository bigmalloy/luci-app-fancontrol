# luci-app-fancontrol

An OpenWrt package that provides automatic PWM fan control via the Linux kernel thermal framework, with a LuCI web interface for configuration.

![Fan Control UI](https://raw.githubusercontent.com/bigmalloy/luci-app-fancontrol/main/docs/screenshot.png)

## Features

- Works **with** the kernel thermal framework by configuring trip points — no driver conflicts
- LuCI web interface under **Services → Fan Control**
- Live status: service state, CPU temperature, fan speed label, PWM value (auto-refreshes every 10s)
- Configurable temperature thresholds with graduated fan curve
- Auto-detects thermal zone and PWM device — works out of the box on most devices
- Collapsible Advanced settings for sysfs path overrides and poll interval
- Settings persist across reboots

## How It Works

Rather than writing PWM values directly (which conflicts with the kernel's `pwm-fan` driver), this package configures the kernel's thermal trip points to match your desired thresholds. The kernel's `step_wise` governor then manages the fan automatically.

Settings are stored in UCI format at `/etc/config/fancontrol`. On startup the daemon:
1. Auto-detects the thermal zone linked to the `pwm-fan` cooling device
2. Auto-detects the first writable PWM sysfs node
3. Sets `pwm1_enable=2` (auto mode) so the thermal framework can drive the PWM output
4. Sets the thermal zone policy to `step_wise`
5. Writes trip point temperatures spread evenly between your Fan Off and Full Speed thresholds

You can override both sysfs paths in the Advanced settings if required.

**Example fan curve with default thresholds (60 / 65 / 75°C):**

| Temperature | Cooling State | Fan Label |
|-------------|---------------|-----------|
| < 60°C | 0 | Off |
| 60–65°C | 1 | Low |
| 65–70°C | 2 | Medium |
| > 70°C → 75°C | 3+ | High → Full speed |

The number of discrete cooling states depends on the device (`max_state` on the pwm-fan cooling device). The fan label shown in the UI adapts automatically.

## Requirements

- OpenWrt 23.05 or later (JavaScript-based LuCI)
- `kmod-hwmon-core`
- `kmod-hwmon-pwmfan`
- `rpcd`
- `jsonfilter`
- `uci`

## Installation

Download the latest release from [Releases](../../releases).

### OpenWrt 25+ (apk)

```sh
scp -O luci-app-fancontrol-3.0.1-r1.apk root@192.168.1.1:/tmp/
apk add --allow-untrusted /tmp/luci-app-fancontrol-3.0.1-r1.apk
```

### OpenWrt 24 (opkg)

```sh
scp -O luci-app-fancontrol_3.0.1_all.ipk root@192.168.1.1:/tmp/
opkg install /tmp/luci-app-fancontrol_3.0.1_all.ipk
```

The `--allow-untrusted` / unsigned install flag is required for locally built or release packages that aren't signed by the official OpenWrt key.

## Configuration

Navigate to **Services → Fan Control** in LuCI.

| Setting | Default | Description |
|---------|---------|-------------|
| Fan Off Below | 60°C | Fan is fully off below this temperature |
| Half Speed Below | 65°C | Upper boundary for graduated speed range |
| Full Speed Above | 75°C | Fan runs at 100% above this temperature |
| Hysteresis | 2°C | Dead band to prevent rapid toggling |
| Poll Interval | 10s | How often the daemon polls for config changes |
| Thermal Zone Path | auto-detect | sysfs temperature sensor — auto-detects zone linked to pwm-fan |
| PWM Device Path | auto-detect | sysfs PWM control — auto-detects first writable pwm node |

## File Layout

```
etc/
  config/
    fancontrol              # UCI configuration (managed by uci)
  init.d/
    fancontrol              # Procd init script
usr/
  bin/
    fancontrol_loop         # Main daemon — configures kernel trip points
  libexec/rpcd/
    luci.fancontrol         # rpcd call script (privileged operations)
  share/
    luci/menu.d/
      luci-app-fancontrol.json
    rpcd/acl.d/
      luci-app-fancontrol.json
www/
  luci-static/resources/view/fancontrol/
    fancontrol.js           # LuCI JavaScript view
```

## Building From Source

### OpenWrt 24 IPK

```sh
git clone https://github.com/bigmalloy/luci-app-fancontrol.git
cd luci-app-fancontrol
chmod +x build.sh
./build.sh
# Output: luci-app-fancontrol_3.0.1_all.ipk
```

### OpenWrt 25+ APK (via Docker)

Requires Docker. Uses the official OpenWrt SDK image to produce a properly signed APK.

```sh
git clone https://github.com/bigmalloy/luci-app-fancontrol.git
cd luci-app-fancontrol
chmod +x build-apk-docker.sh
./build-apk-docker.sh
# Output: output/luci-app-fancontrol-3.0.1-r1.apk
```

### Via OpenWrt Buildroot

```sh
# 1. Clone the OpenWrt buildroot
git clone https://git.openwrt.org/openwrt/openwrt.git
cd openwrt

# 2. Copy the feed into the package tree
cp -r /path/to/luci-app-fancontrol/openwrt-feed package/luci-app-fancontrol

# 3. Update feeds and select the package
./scripts/feeds update -a && ./scripts/feeds install -a
make menuconfig
# Navigate to: LuCI → Applications → luci-app-fancontrol → [M]

# 4. Build just this package
make package/luci-app-fancontrol/compile V=s
```

## Tested On

- GL-iNet Beryl AX (MT3000) — OpenWrt 25.12.0-rc5
- GL-iNet Beryl AX (MT3000) — OpenWrt 24.10.5

## Changelog

### v3.0.1
- **Fix:** Daemon now sets `pwm1_enable=2` (auto mode) after applying `step_wise` policy — a previous install could leave it at `1` (manual), blocking the thermal framework from driving the PWM output and causing the fan to read as full speed
- **Fix:** Fan speed label (Off / Low / Medium / High / Full speed) now uses the cooling device `cur_state` / `max_state` ratio so it is accurate regardless of how many cooling states the device has
- Raised default fan-off temperature from 50°C to 60°C

### v3.0.0
- Config migrated to UCI format (`/etc/config/fancontrol`)
- Auto-detection of thermal zone and PWM device — no manual path config needed on first install
- Thermal zone and PWM dropdowns in UI populated from live sysfs enumeration
- Zones marked with ★ in dropdown when directly linked to pwm-fan cooling device

### v2.3.1
- UI now uses Bootstrap/LuCI theme classes — compatible with all LuCI themes (bootstrap, argon, etc.)

### v2.3.0
- Advanced settings section collapsed by default
- Replaced LuCI Save & Apply with custom Save button (avoids UCI spinner)
- Removed Start/Stop/Restart buttons (service restarts automatically on save)

### v2.0.0
- Complete rewrite to work with kernel thermal framework via trip points
- No longer conflicts with the kernel pwm-fan driver

### v1.x
- Direct PWM control (deprecated — conflicted with kernel thermal framework)

## License

MIT
