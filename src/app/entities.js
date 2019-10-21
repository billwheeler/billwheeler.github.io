'use strict'

var Player = require('../dnd/player.js')
var Npc = require('../dnd/npc.js')

var players = []
var npcs = []

var playerById = function (id) {
    var player = null

    if (Utils.isNumeric(id)) {
        player = players.filter((a) => a.id === id)
        if (player.length > 0)
            return player[0]
    }

    return player
}

var npcById = function (id) {
    var npc = null;

    if (Utils.isNumeric(id)) {
        npc = npcs.filter((a) => a.id === id)
        if (npc.length > 0)
            return npc[0]
    }

    return npc
}

var addNpc = function (npc) {
    npcs.push(npc)
}

module.exports.pull = (data, fresh) => {
    players.length = 0
    npcs.length = 0

    for (var i = 0, l = data.players.length; i < l; i++) {
        var p = new Player()
        p.parse(data.players[i])
        players.push(p)
    }

    for (var i = 0, l = data.npcs.length; i < l; i++) {
        var n = new Npc()
        n.parse(data.npcs[i])
        npcs.push(n)
    }

    if (fresh) {
        for (var i = 0, l = npcs.length; i < l; i++) {
            if (npcs[i].companionTo) {
                addCompanionTo(npcs[i].id, npcs[i].companionTo)
            }
        }
    }

    if (fresh) push()
}

var addCompanionTo = function (companionId, npcName) {
    for (var i = 0, l = players.length; i < l; i++) {
        if (players[i].name === npcName) {
            players[i].companions.push(companionId)
            return true
        }
    }

    for (var i = 0, l = npcs.length; i < l; i++) {
        if (npcs[i].name === npcName) {
            npcs[i].companions.push(companionId)
            return true
        }
    }

    return false
}

var push = () => {
    var out = {
        npcs: [],
        players: []
    }

    for (var i = 0, l = npcs.length; i < l; i++) {
        out.npcs.push(npcs[i].serialize())
    }

    for (var i = 0, l = players.length; i < l; i++) {
        out.players.push(players[i].serialize())
    }

    return out
}

module.exports.push = push

module.exports.reset = () => { }

module.exports.charsByState = (curState, callback) => {
    if (Utils.isFunction(callback)) {
        var output = []

        for (var i = 0, l = players.length; i < l; i++) {
            if (players[i].state === curState)
                output.push(players[i])
        }

        for (var i = 0, l = npcs.length; i < l; i++) {
            if (npcs[i].state === curState)
                output.push(npcs[i])
        }

        // if in an encounter, sort by initiative order
        if (curState === CharacterState.Encounter) {
            output.sort(function (a, b) {
                return b.initiative - a.initiative;
            })
        }

        for (var i = 0, l = output.length; i < l; i++) {
            callback.call(output[i])
        }
    }
}

module.exports.updatePlayer = (id, action, params) => {
    var player = playerById(id)
    if (!player) return

    switch (action) {
        case CharacterAction.Initiative:
            player.applyInitiative(params[0])
            if (player.companions.length > 0) {
                for (var i = 0, l = player.companions.length; i < l; i++) {
                    var c = npcById(player.companions[i])
                    if (c) c.applyInitiative(player.initiative)
                }
            }
            break
        case CharacterAction.Leave:
            player.leaveEncounter()
            if (player.companions.length > 0) {
                for (var i = 0, l = player.companions.length; i < l; i++) {
                    var c = npcById(player.companions[i])
                    if (c) c.leaveEncounter()
                }
            }
            break
        case CharacterAction.Revive:
            player.revive()
            break
        case CharacterAction.Die:
            player.die()
            break
        case CharacterAction.Spell:
            player.useSpell(params[0], params[1])
            break
        case CharacterAction.Rest:
            player.applyRest()
            break
    }
}

module.exports.updateNpc = (id, action, params) => {
    var currentNpc = npcById(id)
    if (!currentNpc) return

    switch (action) {
        case CharacterAction.Damage:
            currentNpc.applyDamage(params[0])
            break
        case CharacterAction.Initiative:
            if (currentNpc.template) {
                var n = currentNpc.clone()
                addNpc(n)
                currentNpc = n
            }
            currentNpc.rollInitiative()
            if (currentNpc.companions.length > 0) {
                for (var i = 0, l = currentNpc.companions.length; i < l; i++) {
                    var c = npcById(currentNpc.companions[i])
                    if (c) c.applyInitiative(currentNpc.initiative)
                }
            }
            break
        case CharacterAction.Leave:
            currentNpc.leaveEncounter()
            if (currentNpc.companions.length > 0) {
                for (var i = 0, l = currentNpc.companions.length; i < l; i++) {
                    var c = npcById(currentNpc.companions[i])
                    if (c) c.leaveEncounter()
                }
            }
            break
        case CharacterAction.Revive:
            currentNpc.revive()
            break
        case CharacterAction.Die:
            currentNpc.die()
            break
        case CharacterAction.Spell:
            currentNpc.useSpell(params[0], params[1])
            break
        case CharacterAction.Rest:
            currentNpc.applyRest()
            break
    }
}
