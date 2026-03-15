# luci-app-fancontrol

An OpenWrt opkg package that provides automatic PWM fan control via the Linux kernel thermal framework, with a LuCI web interface for configuration.

![Fan Control UI](https://raw.githubusercontent.com/bigmalloy/luci-app-fancontrol/main/docs/screenshot.png)

## Features

- Works **with** the kernel thermal framework by configuring trip points — no driver conflicts
- LuCI web interface under **Services → Fan Control**
- Live status: service state, CPU temperature, fan speed, PWM value (auto-refreshes every 10s)
- Configurable temperature thresholds with graduated 5-step fan curve
- Collapsible Advanced settings for sysfs paths and poll interval
- Settings persist across reboots

## How It Works

Rather than writing PWM values directly (which conflicts with the kernel's `pwm-fan` driver), this package configures the kernel's thermal trip points to match your desired thresholds. The kernel's `step_wise` governor then manages the fan automatically across up to 5 cooling states.

Settings are stored in UCI format at `/etc/config/fancontrol` and read by the daemon at runtime. On startup the daemon auto-detects the correct thermal zone (by finding whichever zone has the `pwm-fan` cooling device linked) and the first writable PWM sysfs node — so it works out of the box on most devices with no manual path configuration needed. You can override both paths in the Advanced settings if required.

**Temperature → Fan speed mapping (example with defaults):**

| Temp | Cooling State | Fan Speed |
|------|--------------|-----------|
| < 60°C | 0 | Off |
| 60°C | 1 | Low |
| 64°C | 2 | 37% |
| 68°C | 3 | 50% |
| 72°C | 4 | 75% |
| ≥ 75°C | 5+ | Full |

## Requirements

- OpenWrt 23.05 or later (JavaScript-based LuCI)
- `kmod-hwmon-core`
- `rpcd`
- `jsonfilter`

## Installation

### OpenWrt 25+ (APK)

Packages are signed with a trusted key. You need to install the public key on your router **once**, then you can install and update through LuCI's software manager without any extra flags.

#### Step 1 — Install the public key (one-time)

**Via LuCI (System → Administration → Repo Public Keys):**

1. Download [`luci-fancontrol-signing.pub`](keys/luci-fancontrol-signing.pub) from this repo
2. In LuCI go to **System → Administration**
3. Click the **Repo Public Keys** tab
4. Drag the downloaded `.pub` file into the box — it is added automatically

**Or via CLI:**
```sh
wget -O /etc/apk/keys/luci-fancontrol-signing.pub \
  https://raw.githubusercontent.com/bigmalloy/luci-app-fancontrol/main/keys/luci-fancontrol-signing.pub
```

#### Step 2 — Install the package

**Via LuCI (System → Software):**

1. Download the latest `.apk` from [Releases](../../releases)
2. In LuCI go to **System → Software**
3. Click **Upload Package...**
4. Select the downloaded `.apk` file and click **Upload**

**Or via CLI:**
```sh
scp -O luci-app-fancontrol-3.1.3-r1.apk root@192.168.1.1:/tmp/
ssh root@192.168.1.1 "apk add /tmp/luci-app-fancontrol-3.1.3-r1.apk"
```

---

### OpenWrt 24 (IPK / opkg)

Download the latest `.ipk` from [Releases](../../releases):

```sh
scp -O luci-app-fancontrol_3.1.3_all.ipk root@192.168.1.1:/tmp/
ssh root@192.168.1.1 "opkg install /tmp/luci-app-fancontrol_3.1.3_all.ipk"
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
    fancontrol              # UCI configuration (key=value, managed by uci)
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

## Tested On

- GL-iNet Beryl AX (MT3000) — OpenWrt 24.10.5

## Changelog

### v3.1.3
- APK packages are now signed — install through LuCI software manager without `--allow-untrusted`
- See [Installation](#installation) for one-time public key setup

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

## Buy me a beer

If this project saved you some time, feel free to shout me a beer!

[![PayPal](https://img.shields.io/badge/PayPal-Buy%20me%20a%20beer-blue?logo=paypal)](https://paypal.me/bergfirmware)

---

## License

MIT

## Building From Source

### OpenWrt 25+ APK (via Docker)

Requires Docker. Builds a properly signed APK using the OpenWrt SDK.

```sh
git clone https://github.com/bigmalloy/luci-app-fancontrol.git
cd luci-app-fancontrol
# First time only — generate your own signing key:
chmod +x generate-key.sh && ./generate-key.sh
# Build:
chmod +x build-apk-docker.sh && ./build-apk-docker.sh
# Output: output/luci-app-fancontrol-3.1.3-r1.apk
```

### OpenWrt 24 IPK

```sh
chmod +x build.sh && ./build.sh
# Output: luci-app-fancontrol_3.1.3_all.ipk
```

### Via OpenWrt buildroot

```sh
git clone https://git.openwrt.org/openwrt/openwrt.git
cd openwrt
cp -r /path/to/luci-app-fancontrol/openwrt-feed package/luci-app-fancontrol
./scripts/feeds update -a && ./scripts/feeds install -a
make menuconfig  # LuCI → Applications → luci-app-fancontrol → [M]
make package/luci-app-fancontrol/compile V=s
```
