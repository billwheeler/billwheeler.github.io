'use strict'

var Storage = require('../app/storage.js')

var spell = function () {
    this.id = 0
    this.parentId = 0
    this.name = ''
    this.slots = 0
    this.used = 0
}

spell.prototype.parse = function (json) {
    if (!json) return

    if (json.id && Utils.isNumeric(json.id)) {
        this.id = json.id
    }

    if (this.id === 0) {
        this.id = Storage.assignId()
    }

    if (json.parentId && Utils.isNumeric(json.parentId)) {
        this.parentId = json.parentId
    }

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
        id: this.id,
        parentId: this.parentId,
        name: this.name,
        slots: this.slots,
        used: this.used
    }
}

spell.prototype.render = function () {
    var out = '<tr>'

    out += '<td>' + this.name + '</td>';

    for (var i = 0, l = this.slots; i < l; i++) {
        out += '<td>'
        if ((i + 1) <= this.used) {
            out += '<input class="npc_spell_slot" type="checkbox" checked="checked" data-id="' + this.parentId + '" data-level-id="' + this.id + '" />'
        } else {
            out += '<input class="npc_spell_slot" type="checkbox" data-id="' + this.parentId + '" data-level-id="' + this.id + '" />'
        }
        out += '</td>'
    }

    out += '</tr>'

    return out
}

module.exports = spell