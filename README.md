# luci-app-fancontrol

An OpenWrt opkg package that provides automatic PWM fan control via the Linux kernel thermal framework, with a LuCI web interface for configuration.

![Fan Control UI](https://raw.githubusercontent.com/bigmalloy/luci-app-fancontrol/main/screenshot.png)

## Features

- Works **with** the kernel thermal framework by configuring trip points — no driver conflicts
- LuCI web interface under **Services → Fan Control**
- Live status: service state, CPU temperature, fan speed, PWM value (auto-refreshes every 10s)
- Configurable temperature thresholds with graduated 5-step fan curve
- Collapsible Advanced settings for sysfs paths and poll interval
- Settings persist across reboots

## How It Works

Rather than writing PWM values directly (which conflicts with the kernel's `pwm-fan` driver), this package configures the kernel's thermal trip points to match your desired thresholds. The kernel's `step_wise` governor then manages the fan automatically across up to 5 cooling states.

**Temperature → Fan speed mapping (example with defaults):**

| Temp | Cooling State | Fan Speed |
|------|--------------|-----------|
| < 58°C | 0 | Off |
| 58°C | 1 | Low |
| 63°C | 2 | 37% |
| 68°C | 3 | 50% |
| 73°C | 4 | 75% |
| ≥ 77°C | 5+ | Full |

## Requirements

- OpenWrt 23.05 or later (JavaScript-based LuCI)
- `kmod-hwmon-core`
- `kmod-hwmon-pwmfan`
- `kmod-i2c-core`
- `lm-sensors`
- `rpcd`
- `jsonfilter`

## Installation

Download the latest `.ipk` from [Releases](../../releases), copy to your router and install:

```sh
scp luci-app-fancontrol_2.3.0_all.ipk root@192.168.1.1:/tmp/
opkg install /tmp/luci-app-fancontrol_2.3.0_all.ipk
```

## Configuration

Navigate to **Services → Fan Control** in LuCI.

| Setting | Default | Description |
|---------|---------|-------------|
| Fan Off Below | 58°C | Fan is fully off below this temperature |
| Half Speed Below | 73°C | Upper boundary for graduated speed range |
| Full Speed Above | 77°C | Fan runs at 100% above this temperature |
| Hysteresis | 2°C | Dead band to prevent rapid toggling |
| Poll Interval | 10s | How often the kernel checks temperature |
| Thermal Zone Path | `/sys/class/thermal/thermal_zone0/temp` | sysfs temperature sensor |
| PWM Device Path | `/sys/class/hwmon/hwmon2/pwm1` | sysfs PWM control |

## File Layout

```
etc/
  fancontrol/
    fancontrol.conf         # Runtime configuration
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
git clone https://github.com/YOUR_USERNAME/luci-app-fancontrol.git
cd luci-app-fancontrol
chmod +x build.sh
./build.sh
# Output: luci-app-fancontrol_2.3.0_all.ipk
```

## Tested On

- GL-iNet Beryl AX (MT3000) — OpenWrt 24.10.5

## Changelog

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
