'use strict'

var Weapon = require('./weapon.js')
var Spell = require('./spell.js')
var roll = require('../dnd/dice.js')
var Storage = require('../app/storage.js')

var npc = function () {
    this.id = 0
    this.name = ''
    this.health = 5
    this.maxHealth = 5
    this.armor = 10
    this.speed = 15
    this.race = 'Human'
    this.initiative = 0
    this.weapons = []
    this.spells = []
    this.companions = []
    this.companionTo = null
    this.state = CharacterState.Idle
    this.link = ''
    this.initMod = 0
    this.template = false
    this.instance = 0
    this.concentrating = false
}

npc.prototype.parse = function (json) {
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

    if (json.companions && Utils.isArray(json.companions)) {
        for (var i = 0, l = json.companions.length; i < l; i++) {
            this.companions.push(json.companions[i])
        }
    }

    if (json.link) {
        this.link = json.link
    }

    if (json.template) {
        this.template = json.template
    }

    if (!this.template && json.companionTo) {
        this.companionTo = json.companionTo
    }

    if (json.initMod && Utils.isNumeric(json.initMod)) {
        this.initMod = json.initMod
    }

    if (json.concentrating) {
        this.concentrating = json.concentrating
    }
}

npc.prototype.serialize = function () {
    var weapons = []
    for (var i = 0, l = this.weapons.length; i < l; i++) {
        weapons.push(this.weapons[i].serialize())
    }

    var spells = []
    for (var i = 0, l = this.spells.length; i < l; i++) {
        spells.push(this.spells[i].serialize())
    }

    var companions = []
    for (var i = 0, l = this.companions.length; i < l; i++) {
        companions.push(this.companions[i])
    }

    var out = {
        id: this.id,
        name: this.name,
        health: this.health,
        maxHealth: this.maxHealth,
        armor: this.armor,
        speed: this.speed,
        race: this.race,
        initiative: this.initiative,
        weapons: weapons,
        spells: spells,
        companions: companions,
        companionTo: this.companionTo,
        state: this.state,
        link: this.link,
        initMod: this.initMod,
        template: this.template,
        instance: this.instance,
        concentrating: this.concentrating
    }

    return out
}

npc.prototype.render = function () {
    var classes = 'ent npc';
    if (this.companionTo)
        classes += ' companion'

    var out = '<div class="' + classes + '" data-id="' + this.id + '">';

    out += '<div><span class="bold">' + this.name + '</span>, <span class="italic">' + this.race + '</span>. Speed: ' + this.speed + '</div>'

    var initiative = '';
    if (this.state === CharacterState.Encounter)
        initiative = ' (' + (this.health > 0 ? 'alive' : 'dead') + '), Initiative: <span class="bold">' + this.initiative + '</span>'

    out += '<div>Health: <span class="bold">' + this.health + '</span>, AC: <span class="bold">' + this.armor + '</span>' + initiative + '</div>'

    for (var i = 0, l = this.weapons.length; i < l; i++) {
        out += '<div>' + this.weapons[i].render() + '</div>'
    }

    if (this.spells.length > 0) {
        out += '<table cellpadding="0" cellspacing="0" border="0" class="npc-spell-list">'
        for (var i = 0, l = this.spells.length; i < l; i++) {
            out += this.spells[i].render()
        }
        out += '</table>'
    }

    if (this.state === CharacterState.Encounter) {
        out += '<div><input type="button" class="npc_damage" value="Apply Damage" data-id="' + this.id + '" /><input type="text" id="npc_damage_' + this.id + '" /></div>'
        out += '<div style="margin-top: 4px;">'
        if (!this.companionTo) out += '<input type="button" class="npc_leave" value="Leave Encounter" data-id="' + this.id + '" />&nbsp;'
        out += '<input type="button" class="npc_rest" value="Rest" data-id="' + this.id + '" />&nbsp;'
        out += '<input type="button" class="npc_die" value="Die" data-id="' + this.id + '" />'
        out += '</div>';
    } else if (this.state === CharacterState.Idle) {
        out += '<div>'
        if (!this.companionTo) out += '<input type="button" class="npc_initiative" value="Roll Initiative" data-id="' + this.id + '" />&nbsp;'
        out += '<input type="button" class="npc_rest" value="Rest" data-id="' + this.id + '" />&nbsp;'
        if (!this.template) out += '<input type="button" class="npc_die" value="Die" data-id="' + this.id + '" />'
        out += '</div>';
    } else if (this.state === CharacterState.Dead) {
        out += '<div><input type="button" class="npc_revive" value="Revive NPC" data-id="' + this.id + '" /></div>'
    }

    var con = 'npc_concentrating_' + this.id;
    if (this.concentrating) {
        out += '<div class="concentration"><label for="' + con + '">Concentrating</label><input class="npc_concentrate" id="' + con + '" data-id="' + this.id + '" type="checkbox" checked="checked" /></div>';
    } else {
        out += '<div class="concentration"><label for="' + con + '">Concentrating</label><input class="npc_concentrate" id="' + con + '" data-id="' + this.id + '" type="checkbox" /></div>';
    }

    if (this.link) out += '<div><a href="' + this.link + '" target="_blank">D&D Beyond</a></div>'

    out += '</div>'
    return out;
}

npc.prototype.rollInitiative = function () {
    this.state = CharacterState.Encounter
    this.initiative = roll.d20() + this.initMod
}

npc.prototype.applyInitiative = function (initiative) {
    this.initiative = initiative
    if (this.state !== CharacterState.Dead) {
        this.state = CharacterState.Encounter
    }
}

npc.prototype.applyDamage = function (damage) {
    this.health -= damage
    if (this.health <= 0) {
        this.state = CharacterState.Dead
    }

    this.health = Utils.clamp(this.health, 0, this.maxHealth)
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

    n.parse({
        name: this.name + ' #' + this.instance,
        health: this.health,
        maxHealth: this.maxHealth,
        armor: this.armor,
        speed: this.speed,
        race: this.race,
        link: this.link,
        initMod: this.initMod
    })

    var weapons = []
    for (var i = 0, l = this.weapons.length; i < l; i++) {
        weapons.push(this.weapons[i].clone(n.id))
    }
    n.weapons = weapons;

    var spells = []
    for (var i = 0, l = this.spells.length; i < l; i++) {
        spells.push(this.spells[i].clone(n.id))
    }
    n.spells = spells

    return n
}

npc.prototype.useSpell = function (slotId, use) {
    for (var i = 0, l = this.spells.length; i < l; i++) {
        if (this.spells[i].id === slotId) {
            if (use)
                this.spells[i].used++
            else
                this.spells[i].used--
            this.spells[i].used = Utils.clamp(this.spells[i].used, 0, this.spells.slots)
            return true
        }
    }

    return false
}

npc.prototype.applyRest = function () {
    this.health = this.maxHealth
    for (var i = 0, l = this.spells.length; i < l; i++) {
        this.spells[i].used = 0
    }
}

npc.prototype.concentrate = function () {
    this.concentrating = !this.concentrating
}

module.exports = npc