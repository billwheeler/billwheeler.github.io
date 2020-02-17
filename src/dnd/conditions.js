'use strict'

var Storage = require('../app/storage.js')

var conditions = function () {
    this.id = 0
    this.parentId = 0
    this.exhaustion = 0
    this.concentrating = false
    this.blinded = false
    this.deafened = false
    this.charmed = false
    this.frightened = false
    this.grappled = false
    this.incapacitated = false
    this.invisible = false
    this.paralyzed = false
    this.petrified = false
    this.poisoned = false
    this.prone = false
    this.restrained = false
    this.stunned = false
    this.unconscious = false
    this.hexed = false
    this.huntersmark = false
    this.isPlayer = false
}

conditions.prototype.parse = function (json) {
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

    if (json.exhaustion && Utils.isNumeric(json.exhaustion)) {
        this.exhaustion = Utils.clamp(json.exhaustion, 0, 6)
    }

    if (json.concentrating) this.concentrating = json.concentrating
    if (json.blinded) this.blinded = json.blinded
    if (json.deafened) this.deafened = json.deafened
    if (json.charmed) this.charmed = json.charmed
    if (json.blinded) this.blinded = json.blinded
    if (json.deafened) this.deafened = json.deafened
    if (json.charmed) this.charmed = json.charmed
    if (json.frightened) this.frightened = json.frightened
    if (json.grappled) this.grappled = json.grappled
    if (json.incapacitated) this.incapacitated = json.incapacitated
    if (json.invisible) this.invisible = json.invisible
    if (json.paralyzed) this.paralyzed = json.paralyzed
    if (json.petrified) this.petrified = json.petrified
    if (json.poisoned) this.poisoned = json.poisoned
    if (json.prone) this.prone = json.prone
    if (json.restrained) this.restrained = json.restrained
    if (json.stunned) this.stunned = json.stunned
    if (json.unconscious) this.unconscious = json.unconscious
    if (json.hexed) this.hexed = json.hexed
    if (json.huntersmark) this.huntersmark = json.huntersmark
}

conditions.prototype.serialize = function () {
    return {
        id: this.id,
        parentId: this.parentId,
        exhaustion: Utils.clamp(this.exhaustion, 0, 6),
        concentrating: this.concentrating,
        blinded: this.blinded,
        deafened: this.deafened,
        charmed: this.charmed,
        frightened: this.frightened,
        grappled: this.grappled,
        incapacitated: this.incapacitated,
        invisible: this.invisible,
        paralyzed: this.paralyzed,
        petrified: this.petrified,
        poisoned: this.poisoned,
        prone: this.prone,
        restrained: this.restrained,
        stunned: this.stunned,
        unconscious: this.unconscious,
        hexed: this.hexed,
        huntersmark: this.huntersmark
    }
}

conditions.prototype.clone = function (parentId) {
    var c = new conditions()

    c.parse({
        parentId: parentId,
        concentrating: false,
        exhaustion: 0,
        blinded: false,
        deafened: false,
        charmed: false,
        frightened: false,
        grappled: false,
        incapacitated: false,
        invisible: false,
        paralyzed: false,
        petrified: false,
        poisoned: false,
        prone: false,
        restrained: false,
        stunned: false,
        unconscious: false,
        hexed: false,
        huntersmark: false
    })

    return c
}

conditions.prototype.setValue = function (key, value) {
    switch (key) {
        case CharacterCondition.Concentrating:
            this.concentrating = value ? true : false
            break
        case CharacterCondition.Exhaustion:
            this.exhaustion = Utils.isNumeric(value) ? Utils.clamp(value, 0, 6) : 0
            break
        case CharacterCondition.Blinded:
            this.blinded = value ? true : false
            break
        case CharacterCondition.Deafened:
            this.deafened = value ? true : false
            break
        case CharacterCondition.Charmed:
            this.charmed = value ? true : false
            break
        case CharacterCondition.Frightened:
            this.frightened = value ? true : false
            break
        case CharacterCondition.Grappled:
            this.grappled = value ? true : false
            break
        case CharacterCondition.Incapacitated:
            this.incapacitated = value ? true : false
            break
        case CharacterCondition.Invisible:
            this.invisible = value ? true : false
            break
        case CharacterCondition.Paralyzed:
            this.paralyzed = value ? true : false
            break
        case CharacterCondition.Petrified:
            this.petrified = value ? true : false
            break
        case CharacterCondition.Poisoned:
            this.poisoned = value ? true : false
            break
        case CharacterCondition.Prone:
            this.prone = value ? true : false
            break
        case CharacterCondition.Restrained:
            this.restrained = value ? true : false
            break
        case CharacterCondition.Stunned:
            this.stunned = value ? true : false
            break
        case CharacterCondition.Unconscious:
            this.unconscious = value ? true : false
            break
        case CharacterCondition.Hexed:
            this.hexed = value ? true : false
            break
        case CharacterCondition.HuntersMark:
            this.huntersmark = value ? true : false
            break
    }
}

conditions.prototype.render = function () {
    var out = ''

    if (this.isPlayer)
        out += '<select class="player_condition_add" data-id="' + this.parentId + '">'
    else
        out += '<select class="npc_condition_add" data-id="' + this.parentId + '">'

    out += '<option value="0"> -- Select -- </option>'
    out += '<option value="' + CharacterCondition.Blinded + '">Blinded</option>'
    out += '<option value="' + CharacterCondition.Charmed + '">Charmed</option>'
    out += '<option value="' + CharacterCondition.Concentrating + '">Concentrating</option>'    
    out += '<option value="' + CharacterCondition.Deafened + '">Deafened</option>'
    out += '<option value="' + CharacterCondition.Frightened + '">Frightened</option>'
    out += '<option value="' + CharacterCondition.Grappled + '">Grappled</option>'
    out += '<option value="' + CharacterCondition.Hexed + '">Hexed</option>'
    out += '<option value="' + CharacterCondition.HuntersMark + '">Hunter\'s Mark</option>'
    out += '<option value="' + CharacterCondition.Incapacitated + '">Incapacitated</option>'
    out += '<option value="' + CharacterCondition.Invisible + '">Invisible</option>'
    out += '<option value="' + CharacterCondition.Paralyzed + '">Paralyzed</option>'
    out += '<option value="' + CharacterCondition.Petrified + '">Petrified</option>'
    out += '<option value="' + CharacterCondition.Poisoned + '">Poisoned</option>'
    out += '<option value="' + CharacterCondition.Prone + '">Prone</option>'
    out += '<option value="' + CharacterCondition.Restrained + '">Restrained</option>'
    out += '<option value="' + CharacterCondition.Stunned + '">Stunned</option>'
    out += '<option value="' + CharacterCondition.Unconscious + '">Unconscious</option>'
    out += '</select>'

    if (this.isPlayer) {
        out += '<label class="exhaustion_label">Exhausion: '
        out += '<select class="player_exhaustion" data-id="' + this.parentId + '">'
        out += this.exhaustion === 0 ? '<option selected="selected" value="0">0</option>' : '<option value="0">0</option>'
        out += this.exhaustion === 1 ? '<option selected="selected" value="1">1</option>' : '<option value="1">1</option>'
        out += this.exhaustion === 2 ? '<option selected="selected" value="2">2</option>' : '<option value="2">2</option>'
        out += this.exhaustion === 3 ? '<option selected="selected" value="3">3</option>' : '<option value="3">3</option>'
        out += this.exhaustion === 4 ? '<option selected="selected" value="4">4</option>' : '<option value="4">4</option>'
        out += this.exhaustion === 5 ? '<option selected="selected" value="5">5</option>' : '<option value="5">5</option>'
        out += '</select>'
        out += '</label>'
    }

    if (this.isPlayer)
        out += '<div class="player_conditions">'
    else 
        out += '<div class="npc_conditions">'

    var removeClass = this.isPlayer ? 'player_condition_remove' : 'npc_condition_remove'

    if (this.blinded)
        out += '<div class="' + removeClass + '" data-id="' + this.parentId + '" data-condition="' + CharacterCondition.Blinded + '">Blinded</div>'

    if (this.charmed)
        out += '<div class="' + removeClass + '" data-id="' + this.parentId + '" data-condition="' + CharacterCondition.Charmed + '">Charmed</div>'

    if (this.concentrating)
        out += '<div class="' + removeClass + '" data-id="' + this.parentId + '" data-condition="' + CharacterCondition.Concentrating + '">Concentrating</div>'

    if (this.deafened)
        out += '<div class="' + removeClass + '" data-id="' + this.parentId + '" data-condition="' + CharacterCondition.Deafened + '">Deafened</div>'

    if (this.frightened)
        out += '<div class="' + removeClass + '" data-id="' + this.parentId + '" data-condition="' + CharacterCondition.Frightened + '">Frightened</div>'

    if (this.grappled)
        out += '<div class="' + removeClass + '" data-id="' + this.parentId + '" data-condition="' + CharacterCondition.Grappled + '">Grappled</div>'

    if (this.hexed)
        out += '<div class="' + removeClass + '" data-id="' + this.parentId + '" data-condition="' + CharacterCondition.Hexed + '">Hexed</div>'

    if (this.huntersmark)
        out += '<div class="' + removeClass + '" data-id="' + this.parentId + '" data-condition="' + CharacterCondition.HuntersMark + '">Hunter\'s Mark</div>'

    if (this.incapacitated)
        out += '<div class="' + removeClass + '" data-id="' + this.parentId + '" data-condition="' + CharacterCondition.Incapacitated + '">Incapacitated</div>'

    if (this.invisible)
        out += '<div class="' + removeClass + '" data-id="' + this.parentId + '" data-condition="' + CharacterCondition.Invisible + '">Invisible</div>'

    if (this.paralyzed)
        out += '<div class="' + removeClass + '" data-id="' + this.parentId + '" data-condition="' + CharacterCondition.Paralyzed + '">Paralyzed</div>'

    if (this.petrified)
        out += '<div class="' + removeClass + '" data-id="' + this.parentId + '" data-condition="' + CharacterCondition.Petrified + '">Petrified</div>'

    if (this.poisoned)
        out += '<div class="' + removeClass + '" data-id="' + this.parentId + '" data-condition="' + CharacterCondition.Poisoned + '">Poisoned</div>'

    if (this.prone)
        out += '<div class="' + removeClass + '" data-id="' + this.parentId + '" data-condition="' + CharacterCondition.Prone + '">Prone</div>'

    if (this.restrained)
        out += '<div class="' + removeClass + '" data-id="' + this.parentId + '" data-condition="' + CharacterCondition.Restrained + '">Restrained</div>'

    if (this.stunned)
        out += '<div class="' + removeClass + '" data-id="' + this.parentId + '" data-condition="' + CharacterCondition.Stunned + '">Stunned</div>'

    if (this.unconscious)
        out += '<div class="' + removeClass + '" data-id="' + this.parentId + '" data-condition="' + CharacterCondition.Unconscious + '">Unconscious</div>'

    out += '<div class="clear"></div></div>'

    return out
}

module.exports = conditions