# Maintainer: OpenWrt User
pkgname=luci-app-fancontrol
pkgver=2.3.0
pkgrel=0
pkgdesc="Automatic PWM fan control with LuCI web interface"
url="https://github.com/YOUR_USERNAME/luci-app-fancontrol"
arch="all"
license="MIT"
depends="luci-base rpcd jsonfilter kmod-hwmon-core kmod-hwmon-pwmfan kmod-i2c-core lm-sensors"
makedepends=""
install="$pkgname.post-install $pkgname.pre-deinstall"
source=""
builddir="$srcdir"

# No source tarball - files are taken directly from the repo
build() {
	: # nothing to compile
}

package() {
	# LuCI JavaScript view
	install -Dm644 "$startdir/www/luci-static/resources/view/fancontrol/fancontrol.js" \
		"$pkgdir/www/luci-static/resources/view/fancontrol/fancontrol.js"

	# LuCI menu entry
	install -Dm644 "$startdir/usr/share/luci/menu.d/luci-app-fancontrol.json" \
		"$pkgdir/usr/share/luci/menu.d/luci-app-fancontrol.json"

	# rpcd call script and ACL
	install -Dm755 "$startdir/usr/libexec/rpcd/luci.fancontrol" \
		"$pkgdir/usr/libexec/rpcd/luci.fancontrol"
	install -Dm644 "$startdir/usr/share/rpcd/acl.d/luci-app-fancontrol.json" \
		"$pkgdir/usr/share/rpcd/acl.d/luci-app-fancontrol.json"

	# Fan control daemon
	install -Dm755 "$startdir/usr/bin/fancontrol_loop" \
		"$pkgdir/usr/bin/fancontrol_loop"

	# Init script
	install -Dm755 "$startdir/etc/init.d/fancontrol" \
		"$pkgdir/etc/init.d/fancontrol"

	# Default config (only installed if not already present)
	install -Dm644 "$startdir/etc/fancontrol/fancontrol.conf" \
		"$pkgdir/etc/fancontrol/fancontrol.conf"
}
