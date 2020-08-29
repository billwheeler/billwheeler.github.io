'use strict'

var Player = require('../dnd/player.js')
var Npc = require('../dnd/npc.js')
var Vehicle = require('../dnd/vehicle.js')

var players = []
var npcs = []
var vehicles = []

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

var vehicleById = function (id) {
    var vehicle = null;

    if (Utils.isNumeric(id)) {
        vehicle = vehicles.filter((a) => a.id === id)
        if (vehicle.length > 0)
            return vehicle[0]
    }

    return vehicle
}

var addNpc = function (npc) {
    npcs.push(npc)
}

module.exports.pull = (data, fresh) => {
    players.length = 0
    npcs.length = 0
    vehicles.length = 0

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

    for (var i = 0, l = data.vehicles.length; i < l; i++) {
        var v = new Vehicle()
        v.parse(data.vehicles[i])
        vehicles.push(v)
    }

    push()
}

var push = () => {
    var out = {
        npcs: [],
        players: [],
        vehicles: []
    }

    for (var i = 0, l = npcs.length; i < l; i++) {
        out.npcs.push(npcs[i].serialize())
    }

    for (var i = 0, l = players.length; i < l; i++) {
        out.players.push(players[i].serialize())
    }

    for (var i = 0, l = vehicles.length; i < l; i++) {
        out.vehicles.push(vehicles[i].serialize())
    }

    return out
}

module.exports.push = push

module.exports.reset = () => { }

module.exports.charsByState = (curState, callback) => {
    if (Utils.isFunction(callback)) {
        var output = []

        if (curState === CharacterState.Idle) {
            for (var i = 0, l = vehicles.length; i < l; i++) {
                output.push(vehicles[i])
            }
        }

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
        case CharacterAction.Spell:
            player.useSpell(params[0], params[1])
            break
        case CharacterAction.Rest:
            player.applyRest()
            break
        case CharacterAction.Toggle:
            player.toggle()
            break
        case CharacterAction.ApplyCondition:
            player.condition(params[0], params[1])
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
        case CharacterAction.Spell:
            currentNpc.useSpell(params[0], params[1])
            break
        case CharacterAction.Rest:
            currentNpc.applyRest()
            break
        case CharacterAction.Toggle:
            currentNpc.toggle()
            break
        case CharacterAction.ApplyCondition:
            currentNpc.condition(params[0], params[1])
            break
        case CharacterAction.UsePoison:
            currentNpc.usePoison()
            break
    }
}

module.exports.updateVehicle = (id, action, params) => {
    var vehicle = vehicleById(id)
    if (!vehicle) return

    switch (action) {
        case CharacterAction.Damage:
            vehicle.applyDamage(params[0], params[1])
            break
        case CharacterAction.Toggle:
            vehicle.toggle()
            break
    }
}