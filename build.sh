#!/bin/sh
set -e

PKG="luci-app-fancontrol"
VER="2.3.0"
OUT="${PKG}_${VER}_all.ipk"

echo "Building $OUT..."

WORK=$(mktemp -d)
mkdir -p "$WORK/data-staging" "$WORK/control-staging"

# Copy package files
cp -r etc usr www "$WORK/data-staging/"

# Set permissions
chmod 755 "$WORK/data-staging/usr/bin/fancontrol_loop"
chmod 755 "$WORK/data-staging/etc/init.d/fancontrol"
chmod 755 "$WORK/data-staging/usr/libexec/rpcd/luci.fancontrol"
chmod 644 "$WORK/data-staging/etc/fancontrol/fancontrol.conf"
chmod 644 "$WORK/data-staging/www/luci-static/resources/view/fancontrol/fancontrol.js"
chmod 644 "$WORK/data-staging/usr/share/luci/menu.d/luci-app-fancontrol.json"
chmod 644 "$WORK/data-staging/usr/share/rpcd/acl.d/luci-app-fancontrol.json"

# Copy control files
cp control postinst prerm "$WORK/control-staging/"
chmod 755 "$WORK/control-staging/postinst" "$WORK/control-staging/prerm"
chmod 644 "$WORK/control-staging/control"

# Build tarballs
tar czf "$WORK/control.tar.gz" --owner=0 --group=0 --numeric-owner \
  -C "$WORK/control-staging" ./control ./postinst ./prerm

tar czf "$WORK/data.tar.gz" --owner=0 --group=0 --numeric-owner \
  -C "$WORK/data-staging" .

echo "2.0" > "$WORK/debian-binary"

# Build ipk (abpkg format - plain tar.gz)
tar czf "$OUT" --owner=0 --group=0 \
  -C "$WORK" ./debian-binary ./control.tar.gz ./data.tar.gz

rm -rf "$WORK"
echo "Built: $OUT ($(du -h $OUT | cut -f1))"
