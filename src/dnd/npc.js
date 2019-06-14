'use strict'

var Weapon = require('./weapon.js')
var roll = require('../dnd/dice.js')

var npc = function () {
    this.id = 0
    this.name = ''
    this.health = 5
    this.armor = 10
    this.speed = 15
    this.race = 'Human'
    this.initiative = 0
    this.weapons = []
    this.state = CharacterState.Idle
    this.link = ''
    this.initMod = 0
    this.template = false
    this.instance = 0
}

npc.prototype.parse = function (json) {
    if (!json) return

    if (json.id && Utils.isNumeric(json.id)) {
        this.id = json.id
    }

    if (json.name) {
        this.name = json.name
    }

    if (json.health && Utils.isNumeric(json.health)) {
        this.health = json.health
    }

    if (json.armor && Utils.isNumeric(json.armor)) {
        this.armor = json.armor
    }

    if (json.speed && Utils.isNumeric(json.speed)) {
        this.speed = json.speed
    }

    if (json.race) {
        this.race = json.race
    }

    if (json.initiative && Utils.isNumeric(json.initiative)) {
        this.initiative = json.initiative
    }

    if (json.state) {
        this.state = json.state
    }

    if (json.weapons && Utils.isArray(json.weapons)) {
        for (var i = 0, l = json.weapons.length; i < l; i++) {
            var w = new Weapon()
            w.parse(json.weapons[i])
            this.weapons.push(w)
        }
    }

    if (json.link) {
        this.link = json.link
    }

    if (json.template) {
        this.template = json.template
    }

    if (json.initMod && Utils.isNumeric(json.initMod)) {
        this.initMod = json.initMod
    }
}

npc.prototype.serialize = function () {
    var weapons = []
    for (var i = 0, l = this.weapons.length; i < l; i++) {
        weapons.push(this.weapons[i].serialize())
    }

    return {
        id: this.id,
        name: this.name,
        health: this.health,
        armor: this.armor,
        speed: this.speed,
        race: this.race,
        initiative: this.initiative,
        weapons: weapons,
        state: this.state,
        link: this.link,
        initMod: this.initMod,
        template: this.template,
        instance: this.instance
    }
}

npc.prototype.render = function () {
    var out = '<div class="ent npc" data-id="' + this.id + '">';

    out += '<div><span class="bold">' + this.name + '</span>, <span class="italic">' + this.race + '</span>. Speed: ' + this.speed + '</div>'

    var initiative = '';
    if (this.state === CharacterState.Encounter)
        initiative = ' (' + (this.health > 0 ? 'alive' : 'dead') + '), Initiative: <span class="bold">' + this.initiative + '</span>'

    out += '<div>Health: <span class="bold">' + this.health + '</span>, AC: <span class="bold">' + this.armor + '</span>' + initiative + '</div>'

    for (var i = 0, l = this.weapons.length; i < l; i++) {
        out += '<div>' + this.weapons[i].render() + '</div>'
    }

    if (this.state === CharacterState.Encounter) {
        out += '<div><input type="button" class="npc_damage" value="Apply Damage" data-id="' + this.id + '" /><input type="text" id="npc_damage_"' + this.id + '" /></div>'
        out += '<div style="margin-top: 4px;">'
        out += '<input type="button" class="npc_leave" value="Leave Encounter" data-id="' + this.id + '" />&nbsp;'
        out += '<input type="button" class="npc_die" value="Die" data-id="' + this.id + '" />'
        out += '</div>';
    } else if (this.state === CharacterState.Idle) {
        out += '<div>';
        out += '<input type="button" class="npc_initiative" value="Roll Initiative" data-id="' + this.id + '" />'
        if (!this.template) out += '&nbsp;<input type="button" class="npc_die" value="Die" data-id="' + this.id + '" />'
        out += '</div>';
    } else if (this.state === CharacterState.Dead) {
        out += '<div><input type="button" class="npc_revive" value="Revive NPC" data-id="' + this.id + '" /></div>'
    }

    if (this.link) out += '<div><a href="' + this.link + '" target="_blank">D&D Beyond</a></div>'

    out += '</div>'
    return out;
}

npc.prototype.rollInitiative = function () {
    this.state = CharacterState.Encounter
    this.initiative = roll.d20() + this.initMod
}

npc.prototype.applyDamage = function (damage) {
    this.health -= damage
    if (this.health <= 0) {
        this.health = 0
        this.state = CharacterState.Dead
    }
}

npc.prototype.revive = function () {
    this.health = 1
    this.state = CharacterState.Encounter
}

npc.prototype.leaveEncounter = function () {
    this.initiative = 0
    this.state = CharacterState.Idle
}

npc.prototype.die = function () {
    this.health = 0
    this.state = CharacterState.Dead
}

npc.prototype.clone = function () {
    var n = new npc()
    this.instance++
    n.name = this.name + ' #' + this.instance
    n.health = this.health
    n.armor = this.armor
    n.speed = this.speed
    n.race = this.race
    n.weapons = Utils.arrayClone(this.weapons)
    n.link = this.link
    n.initMod = this.initMod
    return n
}

module.exports = npc