const St       = imports.gi.St; 
const Clutter  = imports.gi.Clutter;
const Lang     = imports.lang;
const Shell    = imports.gi.Shell;
const Mainloop = imports.mainloop;
const Gdk      = imports.gi.Gdk;
const Main     = imports.ui.main;

// Not the most elegant solution, will be fixed with Mutter 3.3.2.
const SCREENSHOT_KEY_BINDING = 'run_command_10';
const MOUSE_POLL_FREQUENCY   = 50;

let areaScreenshot;

function AreaScreenshot() {
    this._init();
}

AreaScreenshot.prototype = {
    _init: function() {
        this._enabled = false;
    },

    enable: function() {
        let shellwm = global.window_manager;
        shellwm.takeover_keybinding(SCREENSHOT_KEY_BINDING);
        shellwm.connect('keybinding::' + SCREENSHOT_KEY_BINDING, Lang.bind(this, this._onGlobalKeyBinding));

        this._enabled = true;
    },

    disable: function() {
        // We cannot release keybindings right now.
        this._enabled = false;
    },

    _onGlobalKeyBinding: function() {
        if (!this._enabled || this._mouseTrackingId) {
            return;
        }

        this._xStart    = -1;
        this._yStart    = -1;
        this._selecting = false;

        this._selectionBox = new Shell.GenericContainer({
            name:        'area-selection',
            style_class: 'area-selection',
            visible:     true,
            reactive:    true
        });

        Main.uiGroup.add_actor(this._selectionBox);

        if (!Main.pushModal(this._selectionBox)) {
            return;
        }

        this._mouseTrackingId = Mainloop.timeout_add(
            MOUSE_POLL_FREQUENCY,
            Lang.bind(this, this._handleMousePosition)
        );
    },

    _handleMousePosition: function() {
        let [xMouse, yMouse, mask] = global.get_pointer();

        if (this._selecting) {
            if (xMouse != this._xStart || yMouse != this._yStart) {
                let x      = Math.min(xMouse, this._xStart);
                let y      = Math.min(yMouse, this._yStart);
                let width  = Math.abs(xMouse - this._xStart);
                let height = Math.abs(yMouse - this._yStart);

                this._selectionBox.set_position(x, y);
                this._selectionBox.set_size(width, height);
            }

            if (!(mask & Gdk.ModifierType.BUTTON1_MASK)) {
                this._makeScreenshot(this._xStart, this._yStart, xMouse, yMouse);

                Mainloop.source_remove(this._mouseTrackingId);
                this._mouseTrackingId = null;

                Main.popModal(this._selectionBox);
                this._selectionBox.destroy();
                return false;
            }
        } else {
            if (mask & Gdk.ModifierType.BUTTON1_MASK) {
                this._selecting = true;
                this._xStart    = xMouse;
                this._yStart    = yMouse;

                this._selectionBox.set_position(xMouse, yMouse);
            }
        }

        return true;
    },

    _makeScreenshot: function(x1, y1, x2, y2) {
        let x      = Math.min(x1, x2);
        let y      = Math.min(y1, y2);
        let width  = Math.abs(x1 - x2);
        let height = Math.abs(y1 - y2);

        global.screenshot_area(x, y, width, height, '/home/dasprid/Desktop/screenshot.png', function (obj, result) { });
    }
}

function init() {
    areaScreenshot = new AreaScreenshot();
}

function enable() {
    areaScreenshot.enable();
}

function disable() {
    areaScreenshot.disable();
}
