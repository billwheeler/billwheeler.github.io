'use strict'

global.CharacterState = {
    Dead: 'dead',
    Idle: 'alive',
    Encounter: 'encounter'
}

global.CharacterAction = {
    Damage: 'damage',
    Die: 'die',
    Initiative: 'initiative',
    Leave: 'leave',
    Revive: 'revive',
    Spell: 'spell',
    Rest: 'rest',
    Toggle: 'toggle',
    AddCondition: 'add-condition',
    RemoveCondition: 'remove-condition'
}

global.CharacterCondition = {
    Concentrating: 'concentrating',
    Exhaustion: 'exhaustion',
    Blinded: 'blinded',
    Deafened: 'deafened',
    Charmed: 'charmed',
    Frightened: 'frightened',
    Grappled: 'grappled',
    Incapacitated: 'incapacitated',
    Invisible: 'invisible',
    Paralyzed: 'paralyzed',
    Petrified: 'petrified',
    Poisoned: 'poisoned',
    Prone: 'prone',
    Restrained: 'restrained',
    Stunned: 'stunned',
    Unconscious: 'unconscious',
    Hexed: 'hexed',
    HuntersMark: 'huntersmark',
}

global.DamageType = {
    Acid: 'acid',
    Bludgeoning: 'bludgeoning',
    Cold: 'cold',
    Fire: 'fire',
    Force: 'force',
    Lightning: 'lightning',
    Necrotic: 'necrotic',
    Piercing: 'piercing',
    Poison: 'poison',
    Psychic: 'psychic',
    Radiant: 'radiant',
    Slashing: 'slashing',
    Thunder: 'thunder'
}

module.exports = null