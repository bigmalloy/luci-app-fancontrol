# luci-app-fancontrol
<img width="732" height="678" alt="image" src="https://github.com/user-attachments/assets/aa572003-22b1-48b8-a42d-bf340dd1b008" />

An OpenWrt opkg package that provides automatic PWM fan control via the Linux kernel thermal framework, with a LuCI web interface for configuration.

## Features

- Works **with** the kernel thermal framework (not against it) by configuring trip points
- LuCI web interface under **Services → Fan Control**
- Live status: service state, CPU temperature, fan speed, PWM value
- Configurable temperature thresholds
- Start / Stop / Restart service buttons
- Settings persist across reboots

## How It Works

Rather than writing PWM values directly, this package configures the kernel's thermal trip points to match your desired thresholds. The kernel's `step_wise` governor then manages the fan automatically across 5 cooling states (PWM 0, 63, 95, 127, 159, 191, 223, 255).

This approach works correctly with devices that have a `pwm-fan` node in the device tree linked to the thermal framework (e.g. GL-iNet Beryl AX / MT3000).

## Requirements

- OpenWrt 23.05 or later (JavaScript-based LuCI)
- `kmod-hwmon-core`
- `kmod-hwmon-pwmfan`
- `kmod-i2c-core`
- `lm-sensors`
- `rpcd`
- `jsonfilter`

## Installation

```sh
opkg update
opkg install luci-app-fancontrol_2.0.0_all.ipk
```

Or from source:
```sh
# Build the package
./build.sh

# Copy to router
scp luci-app-fancontrol_2.0.0_all.ipk root@192.168.1.1:/tmp/

# Install on router
opkg install /tmp/luci-app-fancontrol_2.0.0_all.ipk
```

## Configuration

Navigate to **Services → Fan Control** in LuCI.

| Setting | Default | Description |
|---|---|---|
| Fan Off Below | 58°C | Fan is fully off below this temperature |
| Half Speed Below | 73°C | Upper boundary for graduated speed range |
| Full Speed Above | 77°C | Fan runs at 100% above this temperature |
| Hysteresis | 2°C | Dead band to prevent rapid toggling |
| Poll Interval | 10s | How often to check temperature |
| Thermal Zone Path | `/sys/class/thermal/thermal_zone0/temp` | sysfs temperature sensor path |
| PWM Device Path | `/sys/class/hwmon/hwmon2/pwm1` | sysfs PWM control path |

The 5 kernel trip points are spread evenly between Fan Off and Full Speed temperatures.

## File Layout

```
etc/
  fancontrol/
    fancontrol.conf         # Runtime configuration
  init.d/
    fancontrol              # Procd init script
usr/
  bin/
    fancontrol_loop         # Main daemon
  libexec/
    rpcd/
      luci.fancontrol       # rpcd call script (privileged operations)
  share/
    luci/menu.d/
      luci-app-fancontrol.json   # LuCI menu entry
    rpcd/acl.d/
      luci-app-fancontrol.json   # rpcd ACL permissions
www/
  luci-static/resources/view/fancontrol/
    fancontrol.js           # LuCI JavaScript view
```

## Tested On

- GL-iNet Beryl AX (MT3000) running OpenWrt 24.10.5

## Building From Source

```sh
./build.sh
```

This produces `luci-app-fancontrol_2.0.0_all.ipk`.

## License

MIT
