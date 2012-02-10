const Clutter   = imports.gi.Clutter;
const Lang      = imports.lang;
const Shell     = imports.gi.Shell;
const Mainloop  = imports.mainloop;
const GLib      = imports.gi.GLib;
const Gdk       = imports.gi.Gdk;
const St        = imports.gi.St;
const Main      = imports.ui.main;
const Util      = imports.misc.util;
const Tweener   = imports.ui.tweener;
const Flashspot = imports.ui.flashspot;

const EXT_SCHEMA  = 'org.gnome.shell.extensions.area-screenshot';
const EXT_KEYNAME = 'keybinding';
const SHUTTER_NOTIFY_ID = 1;

function AreaScreenshot() { }

AreaScreenshot.prototype = {
    enable: function() {
        let shellwm = global.window_manager;
        this._metaDisplay = global.screen.get_display();
        this._metaDisplay.add_keybinding (EXT_KEYNAME, EXT_SCHEMA, 0,
                                          Lang.bind(this,
                                                    this._onGlobalKeyBinding));
    },

    disable: function() {
        this._metaDisplay.remove_keybinding(EXT_KEYNAME);
    },

    _onGlobalKeyBinding: function() {
        if (this._mouseTrackingId) {
            return;
        }

        this._modal     = true;
        this._mouseDown = false;
        this._timeout   = 0;
        this._xStart    = -1;
        this._yStart    = -1;
        this._xEnd      = -1;
        this._yEnd      = -1;

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

        this._capturedEventId = global.stage.connect('captured-event', Lang.bind(this, this._onCapturedEvent));
    },

    _onCapturedEvent: function(actor, event) {
        let type = event.type();

        if (type == Clutter.EventType.KEY_PRESS) {
            if (event.get_key_symbol() == Clutter.Escape) {
                this._close();
            } else {
                let num = (event.get_key_symbol() - Clutter.KEY_0);

                if (num >= 0 && num <= 9) {
                    this._setTimer(num);
                }
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

                let x      = Math.min(this._xEnd, this._xStart);
                let y      = Math.min(this._yEnd, this._yStart);
                let width  = Math.abs(this._xEnd - this._xStart);
                let height = Math.abs(this._yEnd - this._yStart);

                if (this._xEnd == -1 || this._yEnd == -1 || (width < 5 && height < 5)) {
                    this._prepareWindowScreenshot(this._xStart, this._yStart);
                } else {
                    this._makeAreaScreenshot(x, y, width, height);
                }
            }
        }

        return true;
    },

    _setTimer: function(timeout) {
        if (timeout === 0) {
            if (this._timer) {
                Main.uiGroup.remove_actor(this._timer);
                this._timer.destroy();
                this._timer = null;
            }
        } else {
            if (!this._timer) {
                this._timer = new St.Label({
                    style_class: 'timer'
                });

                Main.uiGroup.add_actor(this._timer);

                let monitor       = global.screen.get_primary_monitor();
                let monitorHeight = global.screen.get_monitor_geometry(monitor).height;

                this._timer.set_position(
                    20 + (this._timer.width / 2),
                    (monitorHeight - (this._timer.height / 2) - 20)
                );
                this._timer.set_anchor_point_from_gravity(Clutter.Gravity.CENTER);
            }

            this._timer.set_text('' + timeout);
        }

        this._timeout = timeout;
    },

    _fadeOutTimer: function() {
        this._timer.opacity = 255;
        this._timer.scale_x = 1.0;
        this._timer.scale_y = 1.0;

        Tweener.addTween(this._timer, {
            opacity:    0,
            scale_x:    1.5,
            scale_y:    1.5,
            delay:      0.200,
            time:       0.700,
            transition: 'linear'
        });
    },

    _close: function() {
        this._returnToDesktop();
        this._finish();
    },

    _returnToDesktop: function() {
        if (this._modal) {
            Main.popModal(this._selectionBox);
            global.unset_cursor();

            this._modal = false;

            if (this._capturedEventId) {
                global.stage.disconnect(this._capturedEventId);
                this._capturedEventId = null;
            }
        }
    },

    _finish: function() {
        Main.uiGroup.remove_actor(this._selectionBox);
        this._selectionBox.destroy();

        if (this._timer) {
            Main.uiGroup.remove_actor(this._timer);
            this._timer.destroy();
            this._timer = null;
        }
    },

    _prepareWindowScreenshot: function(x, y) {
        this._close();

        let windows = Main.getWindowActorsForWorkspace(global.screen.get_active_workspace_index()); 
        let window  = null;

        for (let i = (windows.length - 1); i >= 0; i--) {
            let [winX, winY]    = windows[i].get_position();
            let [width, height] = windows[i].get_size();

            if (x >= winX && y >= winY && x <= (winX + width) && y <= (winY + height)) {
                window = windows[i].get_meta_window();
                break;
            }
        }

        if (!window) {
            // Can this really happen? At least the root window should match.
            return;
        }

        if (window.has_focus()) {
            this._makeWindowScreenshot();
        } else {
            let tracker      = Shell.WindowTracker.get_default();
            let focusEventId = tracker.connect('notify::focus-app', Lang.bind(this, function() {
                // Without this timeout, we will get a memory access violation.
                let timeoutId = Mainloop.timeout_add(1, Lang.bind(this, function() {
                    this._makeWindowScreenshot();
                    Mainloop.source_remove(timeoutId);
                    return false;
                }));

                tracker.disconnect(focusEventId);
            }));

            Main.activateWindow(window)
        }
    },

    _makeWindowScreenshot: function () {
        let filename = this._getNewScreenshotFilename();

        global.screenshot_window(true, filename,
            Lang.bind(this, this._onScreenshotComplete, filename))
    },

    _makeAreaScreenshot: function(x, y, width, height) {
        let filename = this._getNewScreenshotFilename();

        if (this._timeout > 0) {
            this._returnToDesktop();
            this._fadeOutTimer();

            let timeoutId = Mainloop.timeout_add(1000, Lang.bind(this, function() {
                this._timeout--;

                if (this._timeout > 0) {
                    this._timer.set_text('' + this._timeout);
                    this._fadeOutTimer();
                } else {
                    this._makeAreaScreenshot(x, y, width, height);
                    Mainloop.source_remove(timeoutId);
                    return false;
                }

                return true;
            }));
        } else {
            this._close();

            global.screenshot_area(x, y, width, height, filename,
                Lang.bind(this, this._onScreenshotComplete, filename));
        }
    },

    _onScreenshotComplete: function(obj, result, area, filename) {
        global.cancel_theme_sound(SHUTTER_NOTIFY_ID);
        global.play_theme_sound(SHUTTER_NOTIFY_ID, 'camera-shutter');

        let flashspot = new Flashspot.Flashspot(area);
        flashspot.fire();

        this._runPostScript(filename);
    },

    _runPostScript: function(filename)
    {
        let postScript = GLib.get_home_dir() + '/.local/bin/area-screenshot-post';

        if (GLib.file_test(postScript, GLib.FileTest.EXISTS)) {
            Util.spawn([postScript, filename]);
        }
    },

    _getNewScreenshotFilename: function() {
        let date     = new Date();
        let filename = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DESKTOP) + '/'
                     + 'area-'
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

