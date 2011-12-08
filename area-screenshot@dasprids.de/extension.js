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

        this._buttonPressEventId = global.stage.connect('button-press-event', Lang.bind(this, this._onButtonPressEvent));
        this._keyPressEventId    = global.stage.connect('key-press-event', Lang.bind(this, this._onKeyPressEvent));
    },

    _onKeyPressEvent: function(actor, event) {
        if (event.get_key_symbol() == Clutter.Escape) {
            this._close();
            return true;
        }

        return false;
    },

    _onButtonPressEvent: function(actor, event) {
        if (event.get_button() != 1) {
            return false;
        }

        let [xMouse, yMouse, mask] = global.get_pointer();

        this._xStart = xMouse;
        this._yStart = yMouse;

        this._selectionBox.set_position(this._xStart, this._yStart);

        if (this._buttonPressEventId) {
            global.stage.disconnect(this._buttonPressEventId);
            this._buttonPressEventId = null;
        }

        this._motionEventId        = global.stage.connect('motion-event', Lang.bind(this, this._onMotionEvent));
        this._buttonReleaseEventId = global.stage.connect('button-release-event', Lang.bind(this, this._onButtonReleaseEvent));

        return true;
    },

    _onMotionEvent: function(actor, event) {
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

        return false;
    },

    _onButtonReleaseEvent: function(actor, event) {
        if (event.get_button() != 1) {
            return false;
        }

        this._close();
        this._makeScreenshot(this._xStart, this._yStart, this._xEnd, this._yEnd);

        return true;
    },

    _close: function() {
        Main.popModal(this._selectionBox);
        this._selectionBox.destroy();

        global.unset_cursor();

        if (this._motionEventId) {
            global.stage.disconnect(this._motionEventId);
            this._motionEventId = null;
        }

        if (this._buttonReleaseEventId) {
            global.stage.disconnect(this._buttonReleaseEventId);
            this._buttonReleaseEventId = null;
        }

        if (this._keyPressEventEventId) {
            global.stage.disconnect(this._keyPressEventEventId);
            this._keyPressEventEventId = null;
        }
    },

    _makeScreenshot: function(x1, y1, x2, y2) {
        let x      = Math.min(x1, x2);
        let y      = Math.min(y1, y2);
        let width  = Math.abs(x1 - x2);
        let height = Math.abs(y1 - y2);

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

