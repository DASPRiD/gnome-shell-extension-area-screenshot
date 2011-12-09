const Clutter  = imports.gi.Clutter;
const Lang     = imports.lang;
const Shell    = imports.gi.Shell;
const Mainloop = imports.mainloop;
const GLib     = imports.gi.GLib;
const Gdk      = imports.gi.Gdk;
const Main     = imports.ui.main;
const Util     = imports.misc.util;

// Not the most elegant solution, will be fixed with Mutter 3.3.2.
const SCREENSHOT_KEY_BINDING = 'run_command_10';

function AreaScreenshot() { }

AreaScreenshot.prototype = {
    enable: function() {
        let shellwm = global.window_manager;
        shellwm.takeover_keybinding(SCREENSHOT_KEY_BINDING);
        this._keyBindingId = shellwm.connect('keybinding::' + SCREENSHOT_KEY_BINDING, Lang.bind(this, this._onGlobalKeyBinding));
    },

    disable: function() {
        if (this._keyBindingId) {
            let shellwm = global.window_manager;
            shellwm.disconnect(this._keyBindingId);
            this._keyBindingId = null;
        }
    },

    _onGlobalKeyBinding: function() {
        if (this._mouseTrackingId) {
            return;
        }

        this._xStart = -1;
        this._yStart = -1;
        this._xEnd   = -1;
        this._yEnd   = -1;

        this._selectionBox = new Shell.GenericContainer({
            name:        'area-selection',
            style_class: 'area-selection',
            visible:     true,
            reactive:    true,
            x:           -10,
            y:           -10
        });

        Main.uiGroup.add_actor(this._selectionBox);

        if (!Main.pushModal(this._selectionBox)) {
            return;
        }

        global.set_cursor(Shell.Cursor.POINTING_HAND);

        this._mouseDown       = false;
        this._capturedEventId = global.stage.connect('captured-event', Lang.bind(this, this._onCapturedEvent));
    },

    _onCapturedEvent: function(actor, event) {
        let type = event.type();

        if (type == Clutter.EventType.KEY_PRESS) {
            if (event.get_key_symbol() == Clutter.Escape) {
                this._close();
            }
        } else if (type == Clutter.EventType.BUTTON_PRESS) {
            if (event.get_button() != 1) {
                return true;
            }

            let [xMouse, yMouse, mask] = global.get_pointer();

            this._mouseDown = true;
            this._xStart    = xMouse;
            this._yStart    = yMouse;
            this._xEnd      = xMouse;
            this._yEnd      = yMouse;

            this._selectionBox.set_position(this._xStart, this._yStart);
        } else if (this._mouseDown) {
            if (type == Clutter.EventType.MOTION) {
                let [xMouse, yMouse, mask] = global.get_pointer();

                if (xMouse != this._xStart || yMouse != this._yStart) {
                    this._xEnd = xMouse;
                    this._yEnd = yMouse;

                    let x      = Math.min(this._xEnd, this._xStart);
                    let y      = Math.min(this._yEnd, this._yStart);
                    let width  = Math.abs(this._xEnd - this._xStart);
                    let height = Math.abs(this._yEnd - this._yStart);

                    this._selectionBox.set_position(x, y);
                    this._selectionBox.set_size(width, height);
                }
            } else if (type == Clutter.EventType.BUTTON_RELEASE) {
                if (event.get_button() != 1) {
                    return true;
                }

                this._close();

                let x      = Math.min(this._xEnd, this._xStart);
                let y      = Math.min(this._yEnd, this._yStart);
                let width  = Math.abs(this._xEnd - this._xStart);
                let height = Math.abs(this._yEnd - this._yStart);

                if (this._xEnd == -1 || this._yEnd == -1 || (width < 5 && height < 5)) {
                    this._makeWindowScreenshot(this._xStart, this._yStart);
                } else {
                    this._makeAreaScreenshot(x, y, width, height);
                }
            }
        }

        return true;
    },

    _close: function() {
        Main.popModal(this._selectionBox);
        this._selectionBox.destroy();

        global.unset_cursor();

        if (this._capturedEventId) {
            global.stage.disconnect(this._capturedEventId);
            this._capturedEventId = null;
        }
    },

    _makeWindowScreenshot: function(x, y) {
        // @todo This is not complete yet, we need to focus the window which is
        // at the given x,y coordinates.
        //
        // How to focus a window:
        // Main.activateWindow(Main.getWindowActorsForWorkspace()[3].get_meta_window())

        let picturesPath = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_PICTURES);
        let filename     = picturesPath + '/' + this._getNewScreenshotFilename();

        if (global.screenshot_window(true, filename)) {
            let postScript = GLib.get_home_dir() + '/bin/area-screenshot-post';

            if (GLib.file_test(postScript, GLib.FileTest.EXISTS)) {
                Util.spawn([postScript, filename]);
            }
        };
    },

    _makeAreaScreenshot: function(x, y, width, height) {
        let picturesPath = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_PICTURES);
        let filename     = picturesPath + '/' + this._getNewScreenshotFilename();

        global.screenshot_area(x, y, width, height, filename, function (obj, result) {
            let postScript = GLib.get_home_dir() + '/bin/area-screenshot-post';

            if (GLib.file_test(postScript, GLib.FileTest.EXISTS)) {
                Util.spawn([postScript, filename]);
            }
        });
    },

    _getNewScreenshotFilename: function() {
        let date     = new Date();
        let filename = 'screenshot-'
                     + date.getFullYear() + '-'
                     + this._padNum(date.getMonth() + 1) + '-'
                     + this._padNum(date.getDate()) + 'T'
                     + this._padNum(date.getHours()) + ':'
                     + this._padNum(date.getMinutes()) + ':'
                     + this._padNum(date.getSeconds())
                     + '.png';

        return filename;
    },

    _padNum: function(num) {
        return (num < 10 ? '0' + num : num);
    }
}

function init() {
    return new AreaScreenshot();
}

