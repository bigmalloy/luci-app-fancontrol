# OpenWrt package Makefile for luci-app-fancontrol
# Builds both .ipk (OpenWrt 24 and earlier) and .apk (OpenWrt 25+)
#
# Usage:
#   1. Clone OpenWrt buildroot
#   2. Copy this directory to package/feeds/luci-app-fancontrol/
#   3. Run: make package/luci-app-fancontrol/compile V=s
#   4. Find package in bin/packages/<arch>/base/

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-fancontrol
PKG_VERSION:=3.1.3
PKG_RELEASE:=1

PKG_MAINTAINER:=Your Name <you@example.com>
PKG_LICENSE:=MIT

include $(INCLUDE_DIR)/package.mk

define Package/luci-app-fancontrol
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=LuCI Fan Control
  DEPENDS:=+luci-base +rpcd +jsonfilter +uci +kmod-hwmon-core +kmod-hwmon-pwmfan
  PKGARCH:=all
endef

define Package/luci-app-fancontrol/description
  Automatic PWM fan control via the Linux kernel thermal framework,
  with a LuCI web interface for configuration. Supports graduated
  fan speed control using configurable temperature thresholds.
  Devices are auto-detected from the kernel's thermal and hwmon sysfs.
endef

# No build step needed - all files are shell scripts and JavaScript
define Build/Compile
endef

define Package/luci-app-fancontrol/install
	# LuCI JavaScript view
	$(INSTALL_DIR) $(1)/www/luci-static/resources/view/fancontrol
	$(INSTALL_DATA) ./files/fancontrol.js \
		$(1)/www/luci-static/resources/view/fancontrol/fancontrol.js

	# LuCI menu entry
	$(INSTALL_DIR) $(1)/usr/share/luci/menu.d
	$(INSTALL_DATA) ./files/luci-app-fancontrol.json \
		$(1)/usr/share/luci/menu.d/luci-app-fancontrol.json

	# rpcd call script
	$(INSTALL_DIR) $(1)/usr/libexec/rpcd
	$(INSTALL_BIN) ./files/luci.fancontrol \
		$(1)/usr/libexec/rpcd/luci.fancontrol

	# rpcd ACL
	$(INSTALL_DIR) $(1)/usr/share/rpcd/acl.d
	$(INSTALL_DATA) ./files/luci-app-fancontrol-acl.json \
		$(1)/usr/share/rpcd/acl.d/luci-app-fancontrol.json

	# Fan control daemon
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) ./files/fancontrol_loop \
		$(1)/usr/bin/fancontrol_loop

	# Init script
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/fancontrol.init \
		$(1)/etc/init.d/fancontrol

	# UCI config (installed only if not already present)
	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) ./files/fancontrol.conf \
		$(1)/etc/config/fancontrol
endef

define Package/luci-app-fancontrol/postinst
#!/bin/sh
# Migrate old shell key=value config to UCI format if present
if [ -f /etc/fancontrol/fancontrol.conf ]; then
  THERMAL="/sys/class/thermal/thermal_zone0/temp"
  PWM="/sys/class/hwmon/hwmon2/pwm1"
  TEMP_OFF=60; TEMP_HALF=65; TEMP_FULL=75; HYST=2; POLL=10
  . /etc/fancontrol/fancontrol.conf 2>/dev/null || true
  uci -q set fancontrol.settings=fancontrol
  uci -q set "fancontrol.settings.thermal=${THERMAL}"
  uci -q set "fancontrol.settings.pwm=${PWM}"
  uci -q set "fancontrol.settings.temp_off=${TEMP_OFF}"
  uci -q set "fancontrol.settings.temp_half=${TEMP_HALF}"
  uci -q set "fancontrol.settings.temp_full=${TEMP_FULL}"
  uci -q set "fancontrol.settings.hyst=${HYST}"
  uci -q set "fancontrol.settings.poll=${POLL}"
  uci -q commit fancontrol
  rm -f /etc/fancontrol/fancontrol.conf
  rmdir /etc/fancontrol 2>/dev/null || true
fi
[ -f /etc/init.d/fancontrol ] && /etc/init.d/fancontrol enable
[ -f /etc/init.d/fancontrol ] && /etc/init.d/fancontrol start
[ -f /etc/init.d/rpcd ] && /etc/init.d/rpcd restart
exit 0
endef

define Package/luci-app-fancontrol/prerm
#!/bin/sh
[ -f /etc/init.d/fancontrol ] && /etc/init.d/fancontrol stop
[ -f /etc/init.d/fancontrol ] && /etc/init.d/fancontrol disable
exit 0
endef

$(eval $(call BuildPackage,luci-app-fancontrol))
