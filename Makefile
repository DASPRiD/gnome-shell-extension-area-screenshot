zip-file:
	rm -rf build
	mkdir build
	mkdir build/schemas
	cp -a area-screenshot@dasprids.de/* build/
	cp org.gnome.shell.extensions.area-screenshot.gschema.xml build/schemas/
	glib-compile-schemas build/schemas
	(cd build; zip -qr ../area-screenshot@dasprids.de.zip .)
	rm -rf build

