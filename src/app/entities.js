"use strict";

var Storage = require("./storage.js");
var Player = require("../dnd/player.js");
var Npc = require("../dnd/npc.js");

var players = [];
var npcs = [];

var playerById = function (id) {
    var player = null;

    if (Utils.isNumeric(id)) {
        for (var i = 0, l = players.length; i < l; i++) {
            if (players[i].id === id) {
                player = players[i];
                break;
            }
        }
    }

    return player;
};

var npcById = function (id) {
    var npc = null;

    if (Utils.isNumeric(id)) {
        for (var i = 0, l = npcs.length; i < l; i++) {
            if (npcs[i].id === id) {
                npc = npcs[i];
                break;
            }
        }
    }

    return npc;
};

var pull = function (callback) {
    if (!Utils.isFunction(callback))
        return;

    Storage.pull(function (data) {
        players.length = 0;
        npcs.length = 0;

        for (var i = 0, l = data.players.length; i < l; i++) {
            var p = new Player();
            p.parse(data.players[i]);
            players.push(p);
        }

        for (var i = 0, l = data.npcs.length; i < l; i++) {
            var n = new Npc();
            n.parse(data.npcs[i]);
            npcs.push(n);
        }

        callback.apply(this);
    });
};

var push = function (callback) {
    if (!Utils.isFunction(callback))
        return;

    var self = this;

    var out = {
        npcs: [],
        players: []
    };

    for (var i = 0, l = npcs.length; i < l; i++) {
        out.npcs.push(npcs[i].serialize());
    }

    for (var i = 0, l = players.length; i < l; i++) {
        out.players.push(players[i].serialize());
    }

    Storage.push(out, callback);
};

var reset = function (callback) {
    if (!Utils.isFunction(callback))
        return;

    Storage.reset(callback);
};

var charsByState = function (curState, callback) {
    if (!Utils.isFunction(callback))
        return;

    var output = [];

    for (var i = 0, l = players.length; i < l; i++) {
        if (players[i].state === curState)
            output.push(players[i]);
    }

    for (var i = 0, l = npcs.length; i < l; i++) {
        if (npcs[i].state === curState)
            output.push(npcs[i]);
    }

    // if in an encounter, sort by initiative order
    if (curState === CharacterState.Encounter) {
        output.sort(function (a, b) {
            return b.initiative - a.initiative;
        });
    }

    for (var i = 0, l = output.length; i < l; i++) {
        callback.call(output[i]);
    }
};

var updatePlayer = function (id, action, params) {
    var player = playerById(id);
    if (!player) return;

    switch (action) {
        case CharacterAction.Initiative:
            player.applyInitiative(params[0]);
            break;
        case CharacterAction.Leave:
            player.leaveEncounter();
            break;
        case CharacterAction.Revive:
            player.revive();
            break;
        case CharacterAction.Die:
            player.die();
            break;
    }
};

var updateNpc = function (id, action, params) {
    var npc = npcById(id);
    if (!npc) return;

    switch (action) {
        case CharacterAction.Damage:
            npc.applyDamage(params[0]);
            break;
        case CharacterAction.Initiative:
            npc.rollInitiative();
            break;
        case CharacterAction.Leave:
            npc.leaveEncounter();
            break;
        case CharacterAction.Revive:
            npc.revive();
            break;
        case CharacterAction.Die:
            npc.die();
            break;
    }
};

module.exports = {
    pull: pull,
    push: push,
    reset: reset,
    charsByState: charsByState,
    updatePlayer: updatePlayer,
    updateNpc: updateNpc
};