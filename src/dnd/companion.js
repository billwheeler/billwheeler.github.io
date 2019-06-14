'use strict'

var Weapon = require('./weapon.js')

var companion = function () {
    this.id = 0
    this.name = ''
    this.health = 5
    this.armor = 10
    this.speed = 15
    this.race = 'Wolf'
    this.weapons = []
    this.state = CharacterState.Idle
    this.link = ''
}

companion.prototype.parse = function (json) {
    if (!json) return

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
}

companion.prototype.serialize = function () {
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
        weapons: weapons,
        state: this.state,
        link: this.link
    }
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
        out += '<div><input type="button" class="companion_revive" value="Revive NPC" data-id="' + this.id + '" /></div>'
    }

    if (this.link) out += '<div><a href="' + this.link + '" target="_blank">D&D Beyond</a></div>'

    out += '</div>'
    return out
}

companion.prototype.applyDamage = function (damage) {
    this.health -= damage
    if (this.health <= 0) {
        this.health = 0
        this.state = CharacterState.Dead
    }
}

companion.prototype.revive = function () {
    this.health = 1
    this.state = CharacterState.Encounter
}

companion.prototype.die = function () {
    this.health = 0
    this.state = CharacterState.Dead
}

companion.prototype.clone = function () {
    var c = new companion()
    c.name = this.name
    c.health = this.health
    c.armor = this.armor
    c.speed = this.speed
    c.race = this.race
    c.weapons = Utils.arrayClone(this.weapons)
    c.link = this.link
    return c
}

module.exports = companion