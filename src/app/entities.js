'use strict'

var Storage = require('./storage.js')
var Player = require('../dnd/player.js')
var Npc = require('../dnd/npc.js')

var players = []
var npcs = []

var lastId = 0

var playerById = function (id) {
    var player = null

    if (Utils.isNumeric(id)) {
        for (var i = 0, l = players.length; i < l; i++) {
            if (players[i].id === id) {
                player = players[i]
                break
            }
        }
    }

    return player
};

var npcById = function (id) {
    var npc = null;

    if (Utils.isNumeric(id)) {
        for (var i = 0, l = npcs.length; i < l; i++) {
            if (npcs[i].id === id) {
                npc = npcs[i]
                break
            }
        }
    }

    return npc
};

var addNpc = function (npc) {
    if (typeof npc.id !== 'number' || npc.id === 0) {
        lastId++
        npc.id = lastId
    }

    npcs.push(npc)
}

module.exports.pull = (callback) => {
    if (Utils.isFunction(callback)) {
        Storage.pull(function (data) {
            players.length = 0
            npcs.length = 0

            for (var i = 0, l = data.players.length; i < l; i++) {
                if (typeof data.players[i].id !== 'number') {
                    lastId++
                    data.players[i].id = lastId
                }

                var p = new Player()
                p.parse(data.players[i])
                players.push(p)
            }

            for (var i = 0, l = data.npcs.length; i < l; i++) {
                if (typeof data.npcs[i].id !== 'number') {
                    lastId++
                    data.npcs[i].id = lastId
                }

                var n = new Npc()
                n.parse(data.npcs[i])
                npcs.push(n)
            }

            if (callback.apply(this)) push(callback)
        })
    }
}

module.exports.push = (callback) => {
    if (Utils.isFunction(callback)) {
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

        Storage.push(out, callback)
    }
}

module.exports.reset = (callback) => {
    if (Utils.isFunction(callback)) {
        Storage.reset(callback)
    }
}

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
            break
        case CharacterAction.Leave:
            player.leaveEncounter()
            break
        case CharacterAction.Revive:
            player.revive()
            break
        case CharacterAction.Die:
            player.die()
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
            break
        case CharacterAction.Leave:
            currentNpc.leaveEncounter()
            break
        case CharacterAction.Revive:
            currentNpc.revive()
            break
        case CharacterAction.Die:
            currentNpc.die()
            break
    }
}
