'use strict'

var Storage = require('../app/storage.js')
var Conditions = require('./conditions.js')

var player = function () {
    this.id = 0
    this.name = ''
    this.player = ''
    this.initiative = 0
    this.state = CharacterState.Idle
    this.link = ''
    this.visible = false
};

player.prototype.parse = function (json) {
    if (!json) return

    if (json.id && Utils.isNumeric(json.id)) {
        this.id = json.id
    }

    if (this.id === 0) {
        this.id = Storage.assignId()
    }

    if (json.name) {
        this.name = json.name
    }

    if (json.player) {
        this.player = json.player
    }

    if (json.initiative && Utils.isNumeric(json.initiative)) {
        this.initiative = json.initiative
    }

    if (json.state) {
        this.state = json.state
    }

    if (json.link) {
        this.link = json.link
    }

    if (json.visible) {
        this.visible = json.visible
    }

    var c = new Conditions()
    if (c.parentId === 0) c.parentId = this.id
    c.isPlayer = true
    this.conditions = c

    if (json.conditions) c.parse(json.conditions)
}

player.prototype.serialize = function () {
    return {
        id: this.id,
        name: this.name,
        player: this.player,
        initiative: this.initiative,
        state: this.state,
        link: this.link,
        visible: this.visible,
        conditions: this.conditions.serialize()
    }
}

player.prototype.render = function () {
    var out = '<div class="ent player" data-id="' + this.id + '">'

    var toggleChar = this.visible ? 'close' : 'open'
    out += '<div><span class="bold">' + this.name + '</span> <span class="italics">' + this.player + '</span>'
    out += '<input type="button" class="player_toggle" data-id="' + this.id + '" value="' + toggleChar + '" /><div class="clear"></div></div>'

    if (this.visible) {
        if (this.state === CharacterState.Encounter) {
            out += '<div>Initiative: <span class="bold">' + this.initiative + '</span></div>'
            out += '<div>'
            out += '<input type="button" class="player_leave" value="Leave Encounter" data-id="' + this.id + '" style="margin-right:5px" />'
            out += '<input type="button" class="player_die" value="Die" data-id="' + this.id + '" />'
            out += '</div>'
            if (this.conditions) out += this.conditions.render();
        } else if (this.state === CharacterState.Idle) {
            out += '<div>'
            out += '<input type="button" class="player_initiative" value="Apply Initiatve" data-id="' + this.id + '" /><input type="text" id="player_initiative_' + this.id + '" />'
            out += '<input type="button" class="player_die" value="Die" data-id="' + this.id + '" />'
            out += '</div>';
            if (this.conditions) out += this.conditions.render();
        } else if (this.state === CharacterState.Dead) {
            out += '<div><input type="button" class="player_revive" value="Revive Player" data-id="' + this.id + '" /></div>'
        }

        if (this.link) out += '<div><a href="' + this.link + '" target="_blank">D&D Beyond</a></div>'
    }

    out += '</div>'

    return out
}

player.prototype.applyInitiative = function (initiative) {
    this.initiative = initiative
    this.state = CharacterState.Encounter
}

player.prototype.leaveEncounter = function () {
    this.initiative = 0
    this.state = CharacterState.Idle
}

player.prototype.revive = function () {
    this.state = CharacterState.Encounter
}

player.prototype.die = function () {
    this.state = CharacterState.Dead
}

player.prototype.useSpell = function (slotId, use) {
    return false
}

player.prototype.applyRest = function () {

}

player.prototype.toggle = function () {
    this.visible = this.visible ? false : true
}

player.prototype.condition = function (key, value) {
    if (this.conditions) this.conditions.setValue(key, value)
};

module.exports = player;