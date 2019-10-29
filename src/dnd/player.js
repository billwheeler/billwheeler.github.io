'use strict'

var Storage = require('../app/storage.js')

var player = function () {
    this.id = 0
    this.name = ''
    this.player = ''
    this.initiative = 0
    this.state = CharacterState.Idle
    this.exhaustion = 0
    this.link = ''
    this.companions = []
    this.concentrating = false
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

    if (json.exhaustion && Utils.isNumeric(json.exhaustion)) {
        this.exhaustion = Utils.clamp(json.exhaustion, 1, 6)

        if (this.exhaustion == 6)
            this.state = CharacterState.Dead
    }

    if (json.link) {
        this.link = json.link
    }

    if (json.companions && Utils.isArray(json.companions)) {
        for (var i = 0, l = json.companions.length; i < l; i++) {
            this.companions.push(json.companions[i])
        }
    }

    if (json.concentrating) {
        this.concentrating = json.concentrating 
    }
}

player.prototype.serialize = function () {
    var companions = []
    for (var i = 0, l = this.companions.length; i < l; i++) {
        companions.push(this.companions[i])
    }

    return {
        id: this.id,
        name: this.name,
        player: this.player,
        initiative: this.initiative,
        state: this.state,
        exhaustion: this.exhaustion,
        link: this.link,
        companions: companions,
        concentrating: this.concentrating
    }
}

player.prototype.render = function () {
    var out = '<div class="ent player" data-id="' + this.id + '">'

    out += '<div><span class="bold">' + this.name + '</span> <span class="italics">' + this.player + '</span></div>'

    if (this.state === CharacterState.Encounter) {
        out += '<div>Initiative: <span class="bold">' + this.initiative + '</span></div>'
        out += '<div>'
        out += '<input type="button" class="player_leave" value="Leave Encounter" data-id="' + this.id + '" style="margin-right:5px" />'
        out += '<input type="button" class="player_die" value="Die" data-id="' + this.id + '" />'
        out += '</div>'
    } else if (this.state === CharacterState.Idle) {
        out += '<div>'
        out += '<input type="button" class="player_initiative" value="Apply Initiatve" data-id="' + this.id + '" /><input type="text" id="player_initiative_' + this.id + '" />'
        out += '<input type="button" class="player_die" value="Die" data-id="' + this.id + '" />'
        out += '</div>';
    } else if (this.state === CharacterState.Dead) {
        out += '<div><input type="button" class="player_revive" value="Revive Player" data-id="' + this.id + '" /></div>'
    }

    var con = 'player_concentrating_' + this.id;
    if (this.concentrating) {
        out += '<div><label for="' + con + '">Concentrating</label><input class="player_concentrating" id="' + con + '" data-id="' + this.id + '" type="checkbox" checked="checked" /></div>';
    } else {
        out += '<div><label for="' + con + '">Concentrating</label><input class="player_concentrating" id="' + con + '" data-id="' + this.id + '" type="checkbox" /></div>';
    }

    if (this.link) out += '<div><a href="' + this.link + '" target="_blank">D&D Beyond</a></div>'

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

module.exports = player;