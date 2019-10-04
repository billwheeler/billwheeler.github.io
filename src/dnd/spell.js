'use strict'

var spell = function () {
    this.name = ''
    this.slots = 0
    this.used = 0
}

spell.prototype.parse = function (json) {
    if (!json) return

    if (json.name) {
        this.name = json.name
    }

    if (json.slots && Utils.isNumeric(json.slots)) {
        this.slots = Utils.clamp(json.slots, 0, 999)
    }

    if (json.used && Utils.isNumeric(json.used)) {
        this.used = Utils.clamp(json.used, 0, 999)
    }
}

spell.prototype.serialize = function () {
    return {
        name: this.name,
        slots: this.slots,
        used: this.used
    }
}

spell.prototype.render = function () {
    var out = '<div class="npc-spells">'

    out += '<span class="spell-level">' + this.name + '</span>';

    for (var i = 0, l = this.slots; i < l; i++) {
        if ((i + 1) <= this.used) {
            out += '<input class="spell-slot" type="checkbox" checked="checked" />'
        } else {
            out += '<input class="spell-slot" type="checkbox" />'
        }
    }

    out += '</div>'

    return out
}

module.exports = spell