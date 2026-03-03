# luci-app-fancontrol

An OpenWrt opkg package that provides automatic PWM fan control via the Linux kernel thermal framework, with a LuCI web interface for configuration.

![Fan Control UI](https://raw.githubusercontent.com/bigmalloy/luci-app-fancontrol/main/docs/screenshot.png)

## Features

- Works **with** the kernel thermal framework by configuring trip points — no driver conflicts
- LuCI web interface under **Services → Fan Control**
- Live status: service state, CPU temperature, fan speed, PWM value (auto-refreshes every 10s)
- Configurable temperature thresholds with graduated 5-step fan curve
- Auto-detects thermal zone and PWM device — works out of the box on most devices
- Collapsible Advanced settings for sysfs path overrides and poll interval
- Settings persist across reboots

## How It Works

Rather than writing PWM values directly (which conflicts with the kernel's `pwm-fan` driver), this package configures the kernel's thermal trip points to match your desired thresholds. The kernel's `step_wise` governor then manages the fan automatically across up to 5 cooling states.

Settings are stored in UCI format at `/etc/config/fancontrol` and read by the daemon at runtime. On startup the daemon auto-detects the correct thermal zone (by finding whichever zone has the `pwm-fan` cooling device linked) and the first writable PWM sysfs node — so it works out of the box on most devices with no manual path configuration needed. You can override both paths in the Advanced settings if required.

**Temperature → Fan speed mapping (example with defaults):**

| Temp | Cooling State | Fan Speed |
|------|--------------|----------|
| < 60°C | 0 | Off |
| 60°C | 1 | Low |
| 64°C | 2 | 37% |
| 68°C | 3 | 50% |
| 72°C | 4 | 75% |
| ≥ 75°C | 5+ | Full |

## Requirements

- OpenWrt 23.05 or later (JavaScript-based LuCI)
- `kmod-hwmon-core`
- `kmod-hwmon-pwmfan`
- `kmod-i2c-core`
- `lm-sensors`
- `rpcd`
- `jsonfilter`

## Installation

Download the latest release from [Releases](../../releases), copy to your router and install:

### OpenWrt 24 (opkg)
```sh
scp -O luci-app-fancontrol_3.0.1_all.ipk root@192.168.1.1:/tmp/
opkg install /tmp/luci-app-fancontrol_3.0.1_all.ipk
```

### OpenWrt 25+ (apk)
```sh
scp -O luci-app-fancontrol-3.0.1-r1.apk root@192.168.1.1:/tmp/
apk add --allow-untrusted /tmp/luci-app-fancontrol-3.0.1-r1.apk
```

## Configuration

Navigate to **Services → Fan Control** in LuCI.

| Setting | Default | Description |
|---------|---------|-------------|
| Fan Off Below | 60°C | Fan is fully off below this temperature |
| Half Speed Below | 65°C | Upper boundary for graduated speed range |
| Full Speed Above | 75°C | Fan runs at 100% above this temperature |
| Hysteresis | 2°C | Dead band to prevent rapid toggling |
| Poll Interval | 10s | How often the kernel checks temperature |
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
    fancontrol_loop         # Main daemon - configures kernel trip points
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

```sh
git clone https://github.com/bigmalloy/luci-app-fancontrol.git
cd luci-app-fancontrol
chmod +x build.sh
./build.sh
# Output: luci-app-fancontrol_3.0.1_all.ipk
```

## Tested On

- GL-iNet Beryl AX (MT3000) — OpenWrt 24.10.5 and 25.12.0-rc5

## Changelog

### v3.0.1
- Raised default fan-off temperature from 50°C to 60°C

### v3.0.0
- Config migrated to UCI format (`/etc/config/fancontrol`)
- Auto-detection of thermal zone and PWM device — no manual path config needed
- Thermal zone and PWM dropdowns in UI populated from live sysfs enumeration
- Zones marked with ★ in dropdown when directly linked to pwm-fan cooling device

### v2.3.1
- UI now uses Bootstrap/LuCI theme classes — compatible with all LuCI themes (bootstrap, argon, etc.)

### v2.3.0
- Advanced settings section now collapsed by default
- Replaced LuCI Save & Apply with our own Save button (avoids UCI popup/spinner)
- Removed Start/Stop/Restart buttons (service restarts automatically on save)

### v2.0.0
- Complete rewrite to work with kernel thermal framework via trip points
- No longer fights the kernel pwm-fan driver

### v1.x
- Direct PWM control (deprecated — conflicted with kernel thermal framework)

## License

MIT

## Building APK for OpenWrt 25+ (via Docker)

```sh
git clone https://github.com/bigmalloy/luci-app-fancontrol.git
cd luci-app-fancontrol
chmod +x build-apk-docker.sh
./build-apk-docker.sh
# Output: output/luci-app-fancontrol-3.0.1-r1.apk
```

Install on the router:
```sh
scp -O luci-app-fancontrol-3.0.1-r1.apk root@192.168.1.1:/tmp/
apk add --allow-untrusted /tmp/luci-app-fancontrol-3.0.1-r1.apk
```

The `--allow-untrusted` flag is required for locally built packages since they lack an official signing key.

## Building APK via OpenWrt buildroot

The OpenWrt 25+ APK format uses a binary database format (`apk mkpkg`) that cannot be built with a simple shell script — it requires the OpenWrt build system's host tools. Use the included `openwrt-feed/` directory:

```sh
# 1. Clone the OpenWrt buildroot
git clone https://git.openwrt.org/openwrt/openwrt.git
cd openwrt

# 2. Copy the feed into the package tree
cp -r /path/to/luci-app-fancontrol/openwrt-feed package/luci-app-fancontrol

# 3. Update feeds and select the package
./scripts/feeds update -a
./scripts/feeds install -a
make menuconfig
# Navigate to: LuCI → Applications → luci-app-fancontrol → [M]

# 4. Build just this package
make package/luci-app-fancontrol/compile V=s

# 5. Find the output
# OpenWrt 24 (ipk): bin/packages/<arch>/base/luci-app-fancontrol_3.0.1-1_all.ipk
# OpenWrt 25 (apk): bin/packages/<arch>/base/luci-app-fancontrol-3.0.1-r1.apk
```
