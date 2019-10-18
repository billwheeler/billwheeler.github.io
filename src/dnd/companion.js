'use strict'

var Storage = require('../app/storage.js')

var companion = function () {
    this.id = 0
    this.parentId = 0
    this.name = ''
    this.health = 5
    this.maxHealth = 5
    this.armor = 10
    this.speed = 15
    this.race = 'Badger'
    this.initiative = 0
    this.weapons = []
    this.spells = []
    this.state = CharacterState.Idle
    this.link = ''
    this.initMod = 0
}

companion.prototype.parse = function (json) {
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

    if (json.health && Utils.isNumeric(json.health)) {
        this.health = json.health
    }

    if (json.maxHealth && Utils.isNumeric(json.maxHealth)) {
        this.maxHealth = json.maxHealth
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

    if (json.spells && Utils.isArray(json.spells)) {
        for (var i = 0, l = json.spells.length; i < l; i++) {
            var s = new Spell()
            s.parse(json.spells[i])
            if (s.parentId === 0) s.parentId = this.id
            this.spells.push(s)
        }
    }

    if (json.link) {
        this.link = json.link
    }

    if (json.initMod && Utils.isNumeric(json.initMod)) {
        this.initMod = json.initMod
    }
}

companion.prototype.serialize = function () {
    var weapons = []
    for (var i = 0, l = this.weapons.length; i < l; i++) {
        weapons.push(this.weapons[i].serialize())
    }

    var spells = []
    for (var i = 0, l = this.spells.length; i < l; i++) {
        spells.push(this.spells[i].serialize())
    }

    var out = {
        id: this.id,
        parentId: this.parentId,
        name: this.name,
        health: this.health,
        maxHealth: this.maxHealth,
        armor: this.armor,
        speed: this.speed,
        race: this.race,
        initiative: this.initiative,
        weapons: weapons,
        spells: spells,
        state: this.state,
        link: this.link,
        initMod: this.initMod
    }

    return out
}

companion.prototype.render = function () {
    var out = '<div class="companion">'

    out += '<div><span class="bold">' + this.name + '</span>, <span class="italic">' + this.race + '</span>. Speed: ' + this.speed + '</div>'
    out += '<div>Health: <span class="bold">' + this.health + '</span>, AC: <span class="bold">' + this.armor + '</span></div>'

    for (var i = 0, l = this.weapons.length; i < l; i++) {
        out += '<div>' + this.weapons[i].render() + '</div>'
    }

    if (this.state === CharacterState.Encounter) {
        out += '<div><input type="button" class="companion_damage" value="Apply Damage" data-id="' + this.id + '" /><input type="text" id="companion_damage_' + this.id + '" /></div>'
        out += '<div style="margin-top: 4px;">'
        out += '<input type="button" class="companion_die" value="Die" data-id="' + this.id + '" />'
        out += '</div>';
    } else if (this.state === CharacterState.Idle) {
        out += '<div>';
        out += '<input type="button" class="companion_die" value="Die" data-id="' + this.id + '" />'
        out += '</div>';
    } else if (this.state === CharacterState.Dead) {
        out += '<div><input type="button" class="companion_revive" value="Revive Companion" data-id="' + this.id + '" /></div>'
    }

    if (this.link) out += '<div><a href="' + this.link + '" target="_blank">D&D Beyond</a></div>'

    out += '</div>'
    return out
}

module.exports = companion