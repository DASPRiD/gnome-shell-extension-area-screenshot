gnome-shell-extension-area-screenshot
=====================================

gnome-shell-extension-area-screenshot is a simple extension for creating
screenshots of a specific area on your screen.

Installation
------------

To install the extension, clone this repository and symlink the directory
"area-screenshot@dasprids.de" into "~/.local/share/gnome-shell/extensions/".
Then restart gnome-shell (&lt;Alt&gt; + F2 and enter "r"), open gnome-tweak-tool and
enable the extension.

Configuration
-------------

By default, this extension does nothing; you have to assign a keyboard shortcut
to it. To do this, you can run the following command:

key='/apps/metacity/global_keybindings/run_command_10'<br>
gconftool-2 -s --type string "$key" '&lt;Super&gt;Print'

Usage
-----

When you hit &lt;Super&gt; + Print now, you can select an area on your screen with
your mouse. After releasing your mouse, a new screenshot will be saved in your
local "Pictures" directory with the current timestamp.

Advanced usage
--------------

This extension allows you to process screenshots automatically after taking
them. For this purpose, it checks for an executable in the directory
"~/bin/area-screenshot-post". If this file exists, it will be executed with
the absolute filename of the generated screenshot as argument.

An example for automatically uploading taken screenshots can be found in the
examples directory.
