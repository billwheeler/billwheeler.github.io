'use strict'

var Weapon = require('./weapon.js')
var Spell = require('./spell.js')
var Conditions = require('./conditions.js')
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
    this.saves = {
        strength: 0,
        dexterity: 0,
        constitution: 0,
        intelligence: 0,
        wisdom: 0,
        charisma: 0
    }
    this.weapons = []
    this.spells = []
    this.state = CharacterState.Idle
    this.link = ''
    this.image = ''
    this.initMod = 0
    this.template = false
    this.instance = 0
    this.visible = false
    this.conditions = null
    this.poisons = 0
    this.poisonDesc = ''
    this.group = 0
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

    if (json.saves) {
        this.saves = {
            strength: json.saves.strength,
            dexterity: json.saves.dexterity,
            constitution: json.saves.constitution,
            intelligence: json.saves.intelligence,
            wisdom: json.saves.wisdom,
            charisma: json.saves.charisma
        }
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

    if (json.image) {
        this.image = json.image
    }

    if (json.template) {
        this.template = json.template
    }

    if (json.initMod && Utils.isNumeric(json.initMod)) {
        this.initMod = json.initMod
    }

    if (json.visible) {
        this.visible = json.visible
    }

    var c = new Conditions()
    if (c.parentId === 0) c.parentId = this.id
    this.conditions = c

    if (json.conditions) c.parse(json.conditions)

    if (json.poisons) {
        this.poisons = json.poisons
    }

    if (json.poisonDesc) {
        this.poisonDesc = json.poisonDesc
    }

    if (json.group && Utils.isNumeric(json.group)) {
        this.group = json.group
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

    var out = {
        id: this.id,
        name: this.name,
        health: this.health,
        maxHealth: this.maxHealth,
        armor: this.armor,
        speed: this.speed,
        race: this.race,
        initiative: this.initiative,
        saves: {
            strength: this.saves.strength,
            dexterity: this.saves.dexterity,
            constitution: this.saves.constitution,
            intelligence: this.saves.intelligence,
            wisdom: this.saves.wisdom,
            charisma: this.saves.charisma
        },
        weapons: weapons,
        spells: spells,
        state: this.state,
        link: this.link,
        image: this.image,
        initMod: this.initMod,
        template: this.template,
        instance: this.instance,
        visible: this.visible,
        conditions: this.conditions.serialize(),
        poisons: this.poisons,
        poisonDesc: this.poisonDesc,
        group: this.group
    }

    return out
}

npc.prototype.render = function () {
    var classes = 'ent npc';

    var out = '<div class="' + classes + '" data-id="' + this.id + '">';

    var toggleChar = this.visible ? 'close' : 'open'
    out += '<div><span class="bold">' + this.name + '</span>, <span class="italic">' + this.race + '</span>. Speed: ' + this.speed
    out += '<input type="button" class="npc_toggle" data-id="' + this.id + '" value="' + toggleChar + '" /><div class="clear"></div></div>'

    if (this.visible) {
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

        /*if (this.state !== CharacterState.Dead) {
            out += '<table cellpadding="0" cellspacing="0" border="0" class="npc-spell-list">'
            out += '<tr><td>Strength</td><td>' + this.saves.strength + '</td></tr>'
            out += '<tr><td>Dexterity</td><td>' + this.saves.dexterity + '</td></tr>'
            out += '<tr><td>Constitution</td><td>' + this.saves.constitution + '</td></tr>'
            out += '<tr><td>Intelligence</td><td>' + this.saves.intelligence + '</td></tr>'
            out += '<tr><td>Wisdom</td><td>' + this.saves.wisdom + '</td></tr>'
            out += '<tr><td>Charisma</td><td>' + this.saves.charisma + '</td></tr>'
            out += '</table>'
        }*/

        if (this.poisons > 0) {
            out += '<div>Poisons: <span class="bold">' + this.poisons + '</span> - <span>' + this.poisonDesc + '</span>'
            out += '&nbsp;&nbsp;<input type="button" class="npc_poison" value="Use Poison" data-id="' + this.id + '" /></div>'
        }

        if (this.state === CharacterState.Encounter) {
            out += '<div><input type="button" class="npc_damage" value="Apply Damage" data-id="' + this.id + '" /><input type="text" id="npc_damage_' + this.id + '" /></div>'
            out += '<div>'
            out += '<input type="button" class="npc_rest" value="Rest" data-id="' + this.id + '" />'
            out += '<input type="button" class="npc_leave" value="Leave Encounter" data-id="' + this.id + '" />'
            out += '<input type="button" class="npc_die" value="Die" data-id="' + this.id + '" />'
            out += '</div>';
            if (this.conditions) out += this.conditions.render();
        } else if (this.state === CharacterState.Idle) {
            out += '<div>'
            out += '<input type="button" class="npc_initiative" value="Roll Initiative" data-id="' + this.id + '" />&nbsp;'

            // template npc's can't do these things
            if (!this.template) {
                out += '<input type="button" class="npc_rest" value="Rest" data-id="' + this.id + '" />&nbsp;'
                out += '<input type="button" class="npc_die" value="Die" data-id="' + this.id + '" />'
            }
            out += '</div>';
            if (!this.template && this.conditions) out += this.conditions.render();
        } else if (this.state === CharacterState.Dead) {
            out += '<div><input type="button" class="npc_revive" value="Revive NPC" data-id="' + this.id + '" /></div>'
        }

        if (this.link || this.image) {
            out += '<div>'
            if (this.link) out += '<a href="' + this.link + '" target="_blank">D&D Beyond</a>'
            if (this.link && this.image) out += '&nbsp;&amp;&nbsp;'
            if (this.image) out += '<a href="' + this.image + '" target="_blank">Image</a>'
            out += '</div>'
        }
    }

    out += '</div>'
    return out;
}

npc.prototype.rollInitiative = function () {
    this.state = CharacterState.Encounter

    if (this.group === 1) {
        this.initiative = 17
    } else if (this.group === 1) {
        this.initiative = 13
    } else if (this.group === 1) {
        this.initiative = 8
    } else {
        this.initiative = roll.d20() + this.initMod
    }
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
        image: this.image,
        initMod: this.initMod,
        visible: this.visible,
        group: this.group
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

npc.prototype.toggle = function () {
    this.visible = this.visible ? false : true
}

npc.prototype.condition = function (key, value) {
    if (this.conditions) this.conditions.setValue(key, value)
}

npc.prototype.usePoison = function () {
    this.poisons = this.poisons > 0 ? this.poisons - 1 : 0
}

module.exports = npc