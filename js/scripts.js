(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.App = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";

var Storage = require("./storage.js");

var Player = require("../dnd/player.js");

var Npc = require("../dnd/npc.js");

var players = [];
var npcs = [];
var lastId = 0;

var playerById = function playerById(id) {
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

var npcById = function npcById(id) {
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

var addNpc = function addNpc(npc) {
  if (typeof npc.id !== "number" || npc.id === 0) {
    lastId++;
    npc.id = lastId;
  }

  npcs.push(npc);
};

var pull = function pull(callback) {
  if (!Utils.isFunction(callback)) return;
  Storage.pull(function (data) {
    players.length = 0;
    npcs.length = 0;

    for (var i = 0, l = data.players.length; i < l; i++) {
      if (typeof data.players[i].id !== "number") {
        lastId++;
        data.players[i].id = lastId;
      }

      var p = new Player();
      p.parse(data.players[i]);
      players.push(p);
    }

    for (var i = 0, l = data.npcs.length; i < l; i++) {
      if (typeof data.npcs[i].id !== "number") {
        lastId++;
        data.npcs[i].id = lastId;
      }

      var n = new Npc();
      n.parse(data.npcs[i]);
      npcs.push(n);
    }

    if (callback.apply(this)) push(callback);
  });
};

var push = function push(callback) {
  if (!Utils.isFunction(callback)) return;
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

var reset = function reset(callback) {
  if (!Utils.isFunction(callback)) return;
  Storage.reset(callback);
};

var charsByState = function charsByState(curState, callback) {
  if (!Utils.isFunction(callback)) return;
  var output = [];

  for (var i = 0, l = players.length; i < l; i++) {
    if (players[i].state === curState) output.push(players[i]);
  }

  for (var i = 0, l = npcs.length; i < l; i++) {
    if (npcs[i].state === curState) output.push(npcs[i]);
  } // if in an encounter, sort by initiative order


  if (curState === CharacterState.Encounter) {
    output.sort(function (a, b) {
      return b.initiative - a.initiative;
    });
  }

  for (var i = 0, l = output.length; i < l; i++) {
    callback.call(output[i]);
  }
};

var updatePlayer = function updatePlayer(id, action, params) {
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

var updateNpc = function updateNpc(id, action, params) {
  var currentNpc = npcById(id);
  if (!currentNpc) return;

  switch (action) {
    case CharacterAction.Damage:
      currentNpc.applyDamage(params[0]);
      break;

    case CharacterAction.Initiative:
      if (currentNpc.template) {
        var n = currentNpc.clone();
        addNpc(n);
        currentNpc = n;
      }

      currentNpc.rollInitiative();
      break;

    case CharacterAction.Leave:
      currentNpc.leaveEncounter();
      break;

    case CharacterAction.Revive:
      currentNpc.revive();
      break;

    case CharacterAction.Die:
      currentNpc.die();
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

},{"../dnd/npc.js":6,"../dnd/player.js":7,"./storage.js":2}],2:[function(require,module,exports){
(function (global){
"use strict";

var STORAGE_KEY = "OssariaSessionTwo";

var fetchJson = function fetchJson(callback) {
  var request = new XMLHttpRequest();
  request.open("GET", global.DataFile, true);

  request.onreadystatechange = function () {
    if (this.readyState === 4) {
      if (this.status >= 200 && this.status < 400) {
        save(this.responseText);
        var data = JSON.parse(this.responseText);
        callback.apply(this, [data]);
      } else {
        Debug.warn("error fetching state.json: " + this.status + ", " + this.statusText);
      }
    }
  };

  request.send();
  request = null;
};

var save = function save(data) {
  localStorage.setItem(STORAGE_KEY, data);
};

var pull = function pull(callback) {
  var fresh = false;

  if (Utils.isFunction(callback)) {
    var fromStorage = localStorage.getItem(STORAGE_KEY);

    if (fromStorage) {
      callback.apply(this, [JSON.parse(fromStorage)]);
    } else {
      fetchJson(callback);
      fresh = true;
    }
  }

  return fresh;
};

var push = function push(data, callback) {
  if (!Utils.isFunction(callback)) return;
  save(JSON.stringify(data));
  callback.apply(this);
};

var reset = function reset(callback) {
  if (!Utils.isFunction(callback)) return;
  localStorage.removeItem(STORAGE_KEY);
  callback.apply(this);
};

module.exports = {
  pull: pull,
  push: push,
  reset: reset
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],3:[function(require,module,exports){
"use strict";

var Entities = require("./entities.js");

var active = document.getElementById("active");
var inactive = document.getElementById("inactive");
var deadguys = document.getElementById("deadguys");

var update = function update() {
  Entities.push(function () {
    render();
  });
};

var render = function render() {
  active.innerHTML = "";
  inactive.innerHTML = "";
  deadguys.innerHTML = "";
  Entities.charsByState(CharacterState.Encounter, function () {
    var row = document.createElement("tr");
    var cell = document.createElement("td");
    cell.innerHTML = this.render();
    row.appendChild(cell);
    active.appendChild(row);
  });
  Entities.charsByState(CharacterState.Idle, function () {
    var row = document.createElement("tr");
    var cell = document.createElement("td");
    cell.innerHTML = this.render();
    row.appendChild(cell);
    inactive.appendChild(row);
  });
  Entities.charsByState(CharacterState.Dead, function () {
    var row = document.createElement("tr");
    var cell = document.createElement("td");
    cell.innerHTML = this.render();
    row.appendChild(cell);
    deadguys.appendChild(row);
  });
};

var addListener = function addListener() {
  document.addEventListener('click', function (e) {
    if (e.target) {
      var doUpdate = true;
      var id = parseInt(e.target.getAttribute("data-id"));

      switch (e.target.className) {
        case "hard_reset":
          doUpdate = false;

          if (confirm("Are you sure? This cannot be undone.")) {
            var cell = document.getElementById("main-content");
            Entities.reset(function () {
              cell.innerHTML = "resetting up in here";
              setTimeout(function () {
                window.location.reload();
              }, 600);
            });
          }

          break;

        case "player_initiative":
          var initiative = parseInt(document.getElementById("player_initiative_" + id).value);
          Entities.updatePlayer(id, CharacterAction.Initiative, [initiative]);
          break;

        case "player_leave":
          Entities.updatePlayer(id, CharacterAction.Leave);
          break;

        case "player_revive":
          Entities.updatePlayer(id, CharacterAction.Revive);
          break;

        case "player_die":
          Entities.updatePlayer(id, CharacterAction.Die);
          break;

        case "npc_initiative":
          Entities.updateNpc(id, CharacterAction.Initiative);
          break;

        case "npc_damage":
          var damage = parseInt(document.getElementById("npc_damage_" + id).value);
          Entities.updateNpc(id, CharacterAction.Damage, [damage]);
          break;

        case "npc_leave":
          Entities.updateNpc(id, CharacterAction.Leave);
          break;

        case "npc_revive":
          Entities.updateNpc(id, CharacterAction.Revive);
          break;

        case "npc_die":
          Entities.updateNpc(id, CharacterAction.Die);
          break;

        default:
          doUpdate = false;
          break;
      }

      if (doUpdate) update();
    }
  });
};

var run = function run() {
  addListener();
  Entities.pull(function () {
    render();
  });
};

module.exports = {
  run: run
};

},{"./entities.js":1}],4:[function(require,module,exports){
(function (global){
"use strict";

global.CharacterState = {
  Dead: "dead",
  Idle: "alive",
  Encounter: "encounter"
};
global.CharacterAction = {
  Damage: "damage",
  Die: "die",
  Initiative: "initiative",
  Leave: "leave",
  Revive: "revive"
};
global.DamageType = {
  Acid: "acid",
  Bludgeoning: "bludgeoning",
  Cold: "cold",
  Fire: "fire",
  Force: "force",
  Lightning: "lightning",
  Necrotic: "necrotic",
  Piercing: "piercing",
  Poison: "poison",
  Psychic: "psychic",
  Radiant: "radiant",
  Slashing: "slashing",
  Thunder: "thunder"
};
module.exports = null;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],5:[function(require,module,exports){
"use strict";

module.exports = {
  d4: function d4() {
    return Utils.randomInt(1, 4);
  },
  d6: function d6() {
    return Utils.randomInt(1, 6);
  },
  d8: function d8() {
    return Utils.randomInt(1, 8);
  },
  d10: function d10() {
    return Utils.randomInt(1, 10);
  },
  d12: function d12() {
    return Utils.randomInt(1, 12);
  },
  d20: function d20() {
    return Utils.randomInt(1, 20);
  },
  d100: function d100() {
    return Utils.randomInt(1, 100);
  }
};

},{}],6:[function(require,module,exports){
"use strict";

var Weapon = require("./weapon.js");

var roll = require("../dnd/dice.js");

var npc = function npc() {
  this.id = 0;
  this.name = "";
  this.health = 5;
  this.armor = 10;
  this.speed = 15;
  this.race = "Human";
  this.initiative = 0;
  this.weapons = [];
  this.state = CharacterState.Idle;
  this.link = "";
  this.initMod = 0;
  this.template = false;
  this.instance = 0;
};

npc.prototype.parse = function (json) {
  if (!json) return;

  if (json.id && Utils.isNumeric(json.id)) {
    this.id = json.id;
  }

  if (json.name) {
    this.name = json.name;
  }

  if (json.health && Utils.isNumeric(json.health)) {
    this.health = json.health;
  }

  if (json.armor && Utils.isNumeric(json.armor)) {
    this.armor = json.armor;
  }

  if (json.speed && Utils.isNumeric(json.speed)) {
    this.speed = json.speed;
  }

  if (json.race) {
    this.race = json.race;
  }

  if (json.initiative && Utils.isNumeric(json.initiative)) {
    this.initiative = json.initiative;
  }

  if (json.state) {
    this.state = json.state;
  }

  if (json.weapons && Utils.isArray(json.weapons)) {
    for (var i = 0, l = json.weapons.length; i < l; i++) {
      var w = new Weapon();
      w.parse(json.weapons[i]);
      this.weapons.push(w);
    }
  }

  if (json.link) {
    this.link = json.link;
  }

  if (json.template) {
    this.template = json.template;
  }

  if (json.initMod && Utils.isNumeric(json.initMod)) {
    this.initMod = json.initMod;
  }
};

npc.prototype.serialize = function () {
  var weapons = [];

  for (var i = 0, l = this.weapons.length; i < l; i++) {
    weapons.push(this.weapons[i].serialize());
  }

  return {
    id: this.id,
    name: this.name,
    health: this.health,
    armor: this.armor,
    speed: this.speed,
    race: this.race,
    initiative: this.initiative,
    weapons: weapons,
    state: this.state,
    link: this.link,
    initMod: this.initMod,
    template: this.template,
    instance: this.instance
  };
};

npc.prototype.render = function () {
  var out = "<div class='ent npc' data-id='" + this.id + "'>";
  out += "<div><span class='bold'>" + this.name + "</span>, <span class='italic'>" + this.race + "</span>. Speed: " + this.speed + "</div>";
  var initiative = "";
  if (this.state === CharacterState.Encounter) initiative = " (" + (this.health > 0 ? "alive" : "dead") + "), Initiative: <span class='bold'>" + this.initiative + "</span>";
  out += "<div>Health: <span class='bold'>" + this.health + "</span>, AC: <span class='bold'>" + this.armor + "</span>" + initiative + "</div>";

  for (var i = 0, l = this.weapons.length; i < l; i++) {
    out += "<div>" + this.weapons[i].render() + "</div>";
  }

  if (this.state === CharacterState.Encounter) {
    out += "<div><input type='button' class='npc_damage' value='Apply Damage' data-id='" + this.id + "' /><input type='text' id='npc_damage_" + this.id + "' /></div>";
    out += "<div style='margin-top: 4px;'>";
    out += "<input type='button' class='npc_leave' value='Leave Encounter' data-id='" + this.id + "' />&nbsp;";
    out += "<input type='button' class='npc_die' value='Die' data-id='" + this.id + "' />";
    out += "</div>";
  } else if (this.state === CharacterState.Idle) {
    out += "<div>";
    out += "<input type='button' class='npc_initiative' value='Roll Initiative' data-id='" + this.id + "' />";
    if (!this.template) out += "&nbsp;<input type='button' class='npc_die' value='Die' data-id='" + this.id + "' />";
    out += "</div>";
  } else if (this.state === CharacterState.Dead) {
    out += "<div><input type='button' class='npc_revive' value='Revive NPC' data-id='" + this.id + "' /></div>";
  }

  if (this.link) out += "<div><a href='" + this.link + "' target='_blank'>D&D Beyond</a></div>";
  out += "</div>";
  return out;
};

npc.prototype.rollInitiative = function () {
  this.state = CharacterState.Encounter;
  this.initiative = roll.d20() + this.initMod;
};

npc.prototype.applyDamage = function (damage) {
  this.health -= damage;

  if (this.health <= 0) {
    this.health = 0;
    this.state = CharacterState.Dead;
  }
};

npc.prototype.revive = function () {
  this.health = 1;
  this.state = CharacterState.Encounter;
};

npc.prototype.leaveEncounter = function () {
  this.initiative = 0;
  this.state = CharacterState.Idle;
};

npc.prototype.die = function () {
  this.health = 0;
  this.state = CharacterState.Dead;
};

npc.prototype.clone = function () {
  var n = new npc();
  this.instance++;
  n.name = this.name + " #" + this.instance;
  n.health = this.health;
  n.armor = this.armor;
  n.speed = this.speed;
  n.race = this.race;
  n.weapons = Utils.arrayClone(this.weapons);
  n.link = this.link;
  n.initMod = this.initMod;
  return n;
};

module.exports = npc;

},{"../dnd/dice.js":5,"./weapon.js":8}],7:[function(require,module,exports){
"use strict";

var player = function player() {
  this.id = 0;
  this.name = "";
  this.player = "";
  this.initiative = 0;
  this.state = CharacterState.Idle;
  this.exhaustion = 0;
  this.link = "";
};

player.prototype.parse = function (json) {
  if (!json) return;

  if (json.id && Utils.isNumeric(json.id)) {
    this.id = json.id;
  }

  if (json.name) {
    this.name = json.name;
  }

  if (json.player) {
    this.player = json.player;
  }

  if (json.initiative && Utils.isNumeric(json.initiative)) {
    this.initiative = json.initiative;
  }

  if (json.state) {
    this.state = json.state;
  }

  if (json.exhaustion && Utils.isNumeric(json.exhaustion)) {
    this.exhaustion = Utils.clamp(json.exhaustion, 1, 6);
    if (this.exhaustion == 6) this.state = CharacterState.Dead;
  }

  if (json.link) {
    this.link = json.link;
  }
};

player.prototype.serialize = function () {
  return {
    id: this.id,
    name: this.name,
    initiative: this.initiative,
    state: this.state,
    exhaustion: this.exhaustion,
    link: this.link
  };
};

player.prototype.render = function () {
  var out = "<div class='ent player' data-id='" + this.id + "'>";
  out += "<div><span class='bold'>" + this.name + "</span> <span class='italics'>" + this.player + "</span></div>";

  if (this.state === CharacterState.Encounter) {
    out += "<div>Initiative: <span class='bold'>" + this.initiative + "</span></div>";
    out += "<div>";
    out += "<input type='button' class='player_leave' value='Leave Encounter' data-id='" + this.id + "' style='margin-right:5px' />";
    out += "<input type='button' class='player_die' value='Die' data-id='" + this.id + "' />";
    out += "</div>";
  } else if (this.state === CharacterState.Idle) {
    out += "<div>";
    out += "<input type='button' class='player_initiative' value='Apply Initiatve' data-id='" + this.id + "' /><input type='text' id='player_initiative_" + this.id + "' />";
    out += "<input type='button' class='player_die' value='Die' data-id='" + this.id + "' />";
    out += "</div>";
  } else if (this.state === CharacterState.Dead) {
    out += "<div><input type='button' class='player_revive' value='Revive Player' data-id='" + this.id + "' /></div>";
  }

  if (this.link) out += "<div><a href='" + this.link + "' target='_blank'>D&D Beyond</a></div>";
  out += "</div>";
  return out;
};

player.prototype.applyInitiative = function (initiative) {
  this.initiative = initiative;
  this.state = CharacterState.Encounter;
};

player.prototype.leaveEncounter = function () {
  this.initiative = 0;
  this.state = CharacterState.Idle;
};

player.prototype.revive = function () {
  this.state = CharacterState.Encounter;
};

player.prototype.die = function () {
  this.state = CharacterState.Dead;
};

module.exports = player;

},{}],8:[function(require,module,exports){
"use strict";

var weapon = function weapon() {
  this.name = "";
  this.dice = "1d4";
  this.hitMod = 0;
  this.attackMod = 0;
  this.damageType = DamageType.Bludgeoning;
};

weapon.prototype.parse = function (json) {
  if (!json) return;

  if (json.name) {
    this.name = json.name;
  }

  if (json.dice) {
    this.dice = json.dice;
  }

  if (json.hitMod && Utils.isNumeric(json.hitMod)) {
    this.hitMod = Utils.clamp(json.hitMod, 0, 999);
  }

  if (json.attackMod && Utils.isNumeric(json.attackMod)) {
    this.attackMod = Utils.clamp(json.attackMod, 0, 999);
  }

  if (json.damageType) {
    this.damageType = json.damageType;
  }
};

weapon.prototype.serialize = function () {
  return {
    name: this.name,
    dice: this.dice,
    hitMod: this.hitMod,
    attackMod: this.attackMod,
    damageType: this.damageType
  };
};

weapon.prototype.render = function () {
  var out = "<span class='bold'>" + this.name + "</span>: 1d20";
  if (this.hitMod > 0) out += " + " + this.hitMod;
  out += " to hit, " + this.dice;
  if (this.attackMod > 0) out += " + " + this.attackMod;
  out += ", <span class='italic'>" + this.damageType + "</span>";
  return out;
};

module.exports = weapon;

},{}],9:[function(require,module,exports){
(function (global){
"use strict"; // global vars/functions

global.Debug = require("./utils/debug.js");
global.Utils = require("./utils/utils.js"); // parse app specific globals

require("./dnd/constants.js");

global.DataFile = "/json/state.json";

var ui = require("./app/ui.js");

module.exports = {
  run: ui.run
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./app/ui.js":3,"./dnd/constants.js":4,"./utils/debug.js":10,"./utils/utils.js":13}],10:[function(require,module,exports){
"use strict";

module.exports = {
  assert: console ? console.assert.bind(console) : function () {},
  clear: console ? console.clear.bind(console) : function () {},
  error: console ? console.error.bind(console) : function () {},
  group: console ? console.group.bind(console) : function () {},
  groupCollapsed: console ? console.groupCollapsed.bind(console) : function () {},
  groupEnd: console ? console.groupEnd.bind(console) : function () {},
  info: console ? console.info.bind(console) : function () {},
  log: console ? console.log.bind(console) : function () {},
  trace: console ? console.trace.bind(console) : function () {},
  warn: console ? console.warn.bind(console) : function () {}
};

},{}],11:[function(require,module,exports){
"use strict";

var isNumeric = function isNumeric(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
};

var randomInt = function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

var randomChance = function randomChance(percentTrue) {
  percentTrue = percentTrue || 50;
  return randomInt(1, 100) <= percentTrue ? true : false;
};

var clamp = function clamp(val, min, max) {
  if (val < min) return min;
  if (val > max) return max;
  return val;
};

module.exports = {
  clamp: clamp,
  isNumeric: isNumeric,
  randomInt: randomInt,
  randomChance: randomChance
};

},{}],12:[function(require,module,exports){
"use strict";

var isArray = function isArray(obj) {
  return Object.prototype.toString.call(obj) === "[object Array]" ? true : false;
};

var arrayClone = function arrayClone(arr) {
  return arr.slice(0);
};

var isFunction = function isFunction(obj) {
  return typeof obj === "function" ? true : false;
};

var storageAvailable = function storageAvailable(type) {
  try {
    var storage = window[type],
        x = "__storage_test__";
    storage.setItem(x, x);
    storage.removeItem(x);
    return true;
  } catch (e) {
    return e instanceof DOMException && (e.code === 22 || e.code === 1014 || e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED") && storage.length !== 0;
  }
};

module.exports = {
  isArray: isArray,
  arrayClone: arrayClone,
  isFunction: isFunction,
  storageAvailable: storageAvailable
};

},{}],13:[function(require,module,exports){
"use strict";

var utils = {};

var enumerate = function enumerate(obj) {
  for (var property in obj) {
    if (obj.hasOwnProperty(property)) {
      utils[property] = obj[property];
    }
  }
};

enumerate(require("./numbers.js"));
enumerate(require("./tools.js"));
module.exports = utils;

},{"./numbers.js":11,"./tools.js":12}]},{},[9])(9)
});

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvYXBwL2VudGl0aWVzLmpzIiwic3JjL2FwcC9zdG9yYWdlLmpzIiwic3JjL2FwcC91aS5qcyIsInNyYy9kbmQvY29uc3RhbnRzLmpzIiwic3JjL2RuZC9kaWNlLmpzIiwic3JjL2RuZC9ucGMuanMiLCJzcmMvZG5kL3BsYXllci5qcyIsInNyYy9kbmQvd2VhcG9uLmpzIiwic3JjL21haW4uanMiLCJzcmMvdXRpbHMvZGVidWcuanMiLCJzcmMvdXRpbHMvbnVtYmVycy5qcyIsInNyYy91dGlscy90b29scy5qcyIsInNyYy91dGlscy91dGlscy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FDOztBQUVELElBQUksT0FBTyxHQUFHLE9BQU8sQ0FBQyxjQUFELENBQXJCOztBQUNBLElBQUksTUFBTSxHQUFHLE9BQU8sQ0FBQyxrQkFBRCxDQUFwQjs7QUFDQSxJQUFJLEdBQUcsR0FBRyxPQUFPLENBQUMsZUFBRCxDQUFqQjs7QUFFQSxJQUFJLE9BQU8sR0FBRyxFQUFkO0FBQ0EsSUFBSSxJQUFJLEdBQUcsRUFBWDtBQUVBLElBQUksTUFBTSxHQUFHLENBQWI7O0FBRUEsSUFBSSxVQUFVLEdBQUcsU0FBYixVQUFhLENBQVUsRUFBVixFQUFjO0FBQzNCLE1BQUksTUFBTSxHQUFHLElBQWI7O0FBRUEsTUFBSSxLQUFLLENBQUMsU0FBTixDQUFnQixFQUFoQixDQUFKLEVBQXlCO0FBQ3JCLFNBQUssSUFBSSxDQUFDLEdBQUcsQ0FBUixFQUFXLENBQUMsR0FBRyxPQUFPLENBQUMsTUFBNUIsRUFBb0MsQ0FBQyxHQUFHLENBQXhDLEVBQTJDLENBQUMsRUFBNUMsRUFBZ0Q7QUFDNUMsVUFBSSxPQUFPLENBQUMsQ0FBRCxDQUFQLENBQVcsRUFBWCxLQUFrQixFQUF0QixFQUEwQjtBQUN0QixRQUFBLE1BQU0sR0FBRyxPQUFPLENBQUMsQ0FBRCxDQUFoQjtBQUNBO0FBQ0g7QUFD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LEdBQXJCLEVBQTBCO0FBQ3RCLFFBQUksR0FBRyxDQUFDLGNBQUosQ0FBbUIsUUFBbkIsQ0FBSixFQUFrQztBQUM5QixNQUFBLEtBQUssQ0FBQyxRQUFELENBQUwsR0FBa0IsR0FBRyxDQUFDLFFBQUQsQ0FBckI7QUFDSDtBQUNKO0FBQ0osQ0FORDs7QUFRQSxTQUFTLENBQUMsT0FBTyxDQUFDLGNBQUQsQ0FBUixDQUFUO0FBQ0EsU0FBUyxDQUFDLE9BQU8sQ0FBQyxZQUFELENBQVIsQ0FBVDtBQUVBLE1BQU0sQ0FBQyxPQUFQLEdBQWlCLEtBQWpCIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oKXtmdW5jdGlvbiByKGUsbix0KXtmdW5jdGlvbiBvKGksZil7aWYoIW5baV0pe2lmKCFlW2ldKXt2YXIgYz1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlO2lmKCFmJiZjKXJldHVybiBjKGksITApO2lmKHUpcmV0dXJuIHUoaSwhMCk7dmFyIGE9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitpK1wiJ1wiKTt0aHJvdyBhLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsYX12YXIgcD1uW2ldPXtleHBvcnRzOnt9fTtlW2ldWzBdLmNhbGwocC5leHBvcnRzLGZ1bmN0aW9uKHIpe3ZhciBuPWVbaV1bMV1bcl07cmV0dXJuIG8obnx8cil9LHAscC5leHBvcnRzLHIsZSxuLHQpfXJldHVybiBuW2ldLmV4cG9ydHN9Zm9yKHZhciB1PVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmUsaT0wO2k8dC5sZW5ndGg7aSsrKW8odFtpXSk7cmV0dXJuIG99cmV0dXJuIHJ9KSgpIiwi77u/XCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG52YXIgU3RvcmFnZSA9IHJlcXVpcmUoXCIuL3N0b3JhZ2UuanNcIik7XHJcbnZhciBQbGF5ZXIgPSByZXF1aXJlKFwiLi4vZG5kL3BsYXllci5qc1wiKTtcclxudmFyIE5wYyA9IHJlcXVpcmUoXCIuLi9kbmQvbnBjLmpzXCIpO1xyXG5cclxudmFyIHBsYXllcnMgPSBbXTtcclxudmFyIG5wY3MgPSBbXTtcclxuXHJcbnZhciBsYXN0SWQgPSAwO1xyXG5cclxudmFyIHBsYXllckJ5SWQgPSBmdW5jdGlvbiAoaWQpIHtcclxuICAgIHZhciBwbGF5ZXIgPSBudWxsO1xyXG5cclxuICAgIGlmIChVdGlscy5pc051bWVyaWMoaWQpKSB7XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBwbGF5ZXJzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xyXG4gICAgICAgICAgICBpZiAocGxheWVyc1tpXS5pZCA9PT0gaWQpIHtcclxuICAgICAgICAgICAgICAgIHBsYXllciA9IHBsYXllcnNbaV07XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gcGxheWVyO1xyXG59O1xyXG5cclxudmFyIG5wY0J5SWQgPSBmdW5jdGlvbiAoaWQpIHtcclxuICAgIHZhciBucGMgPSBudWxsO1xyXG5cclxuICAgIGlmIChVdGlscy5pc051bWVyaWMoaWQpKSB7XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBucGNzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xyXG4gICAgICAgICAgICBpZiAobnBjc1tpXS5pZCA9PT0gaWQpIHtcclxuICAgICAgICAgICAgICAgIG5wYyA9IG5wY3NbaV07XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gbnBjO1xyXG59O1xyXG5cclxudmFyIGFkZE5wYyA9IGZ1bmN0aW9uIChucGMpIHtcclxuICAgIGlmICh0eXBlb2YgbnBjLmlkICE9PSBcIm51bWJlclwiIHx8IG5wYy5pZCA9PT0gMCkge1xyXG4gICAgICAgIGxhc3RJZCsrO1xyXG4gICAgICAgIG5wYy5pZCA9IGxhc3RJZDtcclxuICAgIH1cclxuXHJcbiAgICBucGNzLnB1c2gobnBjKTtcclxufTtcclxuXHJcbnZhciBwdWxsID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XHJcbiAgICBpZiAoIVV0aWxzLmlzRnVuY3Rpb24oY2FsbGJhY2spKVxyXG4gICAgICAgIHJldHVybjtcclxuXHJcbiAgICBTdG9yYWdlLnB1bGwoZnVuY3Rpb24gKGRhdGEpIHtcclxuICAgICAgICBwbGF5ZXJzLmxlbmd0aCA9IDA7XHJcbiAgICAgICAgbnBjcy5sZW5ndGggPSAwO1xyXG5cclxuICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IGRhdGEucGxheWVycy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICAgICAgaWYgKHR5cGVvZiBkYXRhLnBsYXllcnNbaV0uaWQgIT09IFwibnVtYmVyXCIpIHtcclxuICAgICAgICAgICAgICAgIGxhc3RJZCsrO1xyXG4gICAgICAgICAgICAgICAgZGF0YS5wbGF5ZXJzW2ldLmlkID0gbGFzdElkO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB2YXIgcCA9IG5ldyBQbGF5ZXIoKTtcclxuICAgICAgICAgICAgcC5wYXJzZShkYXRhLnBsYXllcnNbaV0pO1xyXG4gICAgICAgICAgICBwbGF5ZXJzLnB1c2gocCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IGRhdGEubnBjcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICAgICAgaWYgKHR5cGVvZiBkYXRhLm5wY3NbaV0uaWQgIT09IFwibnVtYmVyXCIpIHtcclxuICAgICAgICAgICAgICAgIGxhc3RJZCsrO1xyXG4gICAgICAgICAgICAgICAgZGF0YS5ucGNzW2ldLmlkID0gbGFzdElkO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB2YXIgbiA9IG5ldyBOcGMoKTtcclxuICAgICAgICAgICAgbi5wYXJzZShkYXRhLm5wY3NbaV0pO1xyXG4gICAgICAgICAgICBucGNzLnB1c2gobik7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoY2FsbGJhY2suYXBwbHkodGhpcykpIHB1c2goY2FsbGJhY2spO1xyXG4gICAgfSk7XHJcbn07XHJcblxyXG52YXIgcHVzaCA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xyXG4gICAgaWYgKCFVdGlscy5pc0Z1bmN0aW9uKGNhbGxiYWNrKSlcclxuICAgICAgICByZXR1cm47XHJcblxyXG4gICAgdmFyIG91dCA9IHtcclxuICAgICAgICBucGNzOiBbXSxcclxuICAgICAgICBwbGF5ZXJzOiBbXVxyXG4gICAgfTtcclxuXHJcbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IG5wY3MubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XHJcbiAgICAgICAgb3V0Lm5wY3MucHVzaChucGNzW2ldLnNlcmlhbGl6ZSgpKTtcclxuICAgIH1cclxuXHJcbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IHBsYXllcnMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XHJcbiAgICAgICAgb3V0LnBsYXllcnMucHVzaChwbGF5ZXJzW2ldLnNlcmlhbGl6ZSgpKTtcclxuICAgIH1cclxuXHJcbiAgICBTdG9yYWdlLnB1c2gob3V0LCBjYWxsYmFjayk7XHJcbn07XHJcblxyXG52YXIgcmVzZXQgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcclxuICAgIGlmICghVXRpbHMuaXNGdW5jdGlvbihjYWxsYmFjaykpXHJcbiAgICAgICAgcmV0dXJuO1xyXG5cclxuICAgIFN0b3JhZ2UucmVzZXQoY2FsbGJhY2spO1xyXG59O1xyXG5cclxudmFyIGNoYXJzQnlTdGF0ZSA9IGZ1bmN0aW9uIChjdXJTdGF0ZSwgY2FsbGJhY2spIHtcclxuICAgIGlmICghVXRpbHMuaXNGdW5jdGlvbihjYWxsYmFjaykpXHJcbiAgICAgICAgcmV0dXJuO1xyXG5cclxuICAgIHZhciBvdXRwdXQgPSBbXTtcclxuXHJcbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IHBsYXllcnMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XHJcbiAgICAgICAgaWYgKHBsYXllcnNbaV0uc3RhdGUgPT09IGN1clN0YXRlKVxyXG4gICAgICAgICAgICBvdXRwdXQucHVzaChwbGF5ZXJzW2ldKTtcclxuICAgIH1cclxuXHJcbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IG5wY3MubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XHJcbiAgICAgICAgaWYgKG5wY3NbaV0uc3RhdGUgPT09IGN1clN0YXRlKVxyXG4gICAgICAgICAgICBvdXRwdXQucHVzaChucGNzW2ldKTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBpZiBpbiBhbiBlbmNvdW50ZXIsIHNvcnQgYnkgaW5pdGlhdGl2ZSBvcmRlclxyXG4gICAgaWYgKGN1clN0YXRlID09PSBDaGFyYWN0ZXJTdGF0ZS5FbmNvdW50ZXIpIHtcclxuICAgICAgICBvdXRwdXQuc29ydChmdW5jdGlvbiAoYSwgYikge1xyXG4gICAgICAgICAgICByZXR1cm4gYi5pbml0aWF0aXZlIC0gYS5pbml0aWF0aXZlO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIGZvciAodmFyIGkgPSAwLCBsID0gb3V0cHV0Lmxlbmd0aDsgaSA8IGw7IGkrKykge1xyXG4gICAgICAgIGNhbGxiYWNrLmNhbGwob3V0cHV0W2ldKTtcclxuICAgIH1cclxufTtcclxuXHJcbnZhciB1cGRhdGVQbGF5ZXIgPSBmdW5jdGlvbiAoaWQsIGFjdGlvbiwgcGFyYW1zKSB7XHJcbiAgICB2YXIgcGxheWVyID0gcGxheWVyQnlJZChpZCk7XHJcbiAgICBpZiAoIXBsYXllcikgcmV0dXJuO1xyXG5cclxuICAgIHN3aXRjaCAoYWN0aW9uKSB7XHJcbiAgICAgICAgY2FzZSBDaGFyYWN0ZXJBY3Rpb24uSW5pdGlhdGl2ZTpcclxuICAgICAgICAgICAgcGxheWVyLmFwcGx5SW5pdGlhdGl2ZShwYXJhbXNbMF0pO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICBjYXNlIENoYXJhY3RlckFjdGlvbi5MZWF2ZTpcclxuICAgICAgICAgICAgcGxheWVyLmxlYXZlRW5jb3VudGVyKCk7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgQ2hhcmFjdGVyQWN0aW9uLlJldml2ZTpcclxuICAgICAgICAgICAgcGxheWVyLnJldml2ZSgpO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICBjYXNlIENoYXJhY3RlckFjdGlvbi5EaWU6XHJcbiAgICAgICAgICAgIHBsYXllci5kaWUoKTtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICB9XHJcbn07XHJcblxyXG52YXIgdXBkYXRlTnBjID0gZnVuY3Rpb24gKGlkLCBhY3Rpb24sIHBhcmFtcykge1xyXG4gICAgdmFyIGN1cnJlbnROcGMgPSBucGNCeUlkKGlkKTtcclxuICAgIGlmICghY3VycmVudE5wYykgcmV0dXJuO1xyXG5cclxuICAgIHN3aXRjaCAoYWN0aW9uKSB7XHJcbiAgICAgICAgY2FzZSBDaGFyYWN0ZXJBY3Rpb24uRGFtYWdlOlxyXG4gICAgICAgICAgICBjdXJyZW50TnBjLmFwcGx5RGFtYWdlKHBhcmFtc1swXSk7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgQ2hhcmFjdGVyQWN0aW9uLkluaXRpYXRpdmU6XHJcbiAgICAgICAgICAgIGlmIChjdXJyZW50TnBjLnRlbXBsYXRlKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgbiA9IGN1cnJlbnROcGMuY2xvbmUoKTtcclxuICAgICAgICAgICAgICAgIGFkZE5wYyhuKTtcclxuICAgICAgICAgICAgICAgIGN1cnJlbnROcGMgPSBuO1xyXG4gICAgICAgICAgICB9IFxyXG4gICAgICAgICAgICBjdXJyZW50TnBjLnJvbGxJbml0aWF0aXZlKCk7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgQ2hhcmFjdGVyQWN0aW9uLkxlYXZlOlxyXG4gICAgICAgICAgICBjdXJyZW50TnBjLmxlYXZlRW5jb3VudGVyKCk7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIGNhc2UgQ2hhcmFjdGVyQWN0aW9uLlJldml2ZTpcclxuICAgICAgICAgICAgY3VycmVudE5wYy5yZXZpdmUoKTtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgY2FzZSBDaGFyYWN0ZXJBY3Rpb24uRGllOlxyXG4gICAgICAgICAgICBjdXJyZW50TnBjLmRpZSgpO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgIH1cclxufTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgcHVsbDogcHVsbCxcclxuICAgIHB1c2g6IHB1c2gsXHJcbiAgICByZXNldDogcmVzZXQsXHJcbiAgICBjaGFyc0J5U3RhdGU6IGNoYXJzQnlTdGF0ZSxcclxuICAgIHVwZGF0ZVBsYXllcjogdXBkYXRlUGxheWVyLFxyXG4gICAgdXBkYXRlTnBjOiB1cGRhdGVOcGNcclxufTsiLCLvu79cInVzZSBzdHJpY3RcIjtcclxuXHJcbmNvbnN0IFNUT1JBR0VfS0VZID0gXCJPc3NhcmlhU2Vzc2lvblR3b1wiO1xyXG5cclxudmFyIGZldGNoSnNvbiA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xyXG4gICAgdmFyIHJlcXVlc3QgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcclxuICAgIHJlcXVlc3Qub3BlbihcIkdFVFwiLCBnbG9iYWwuRGF0YUZpbGUsIHRydWUpO1xyXG5cclxuICAgIHJlcXVlc3Qub25yZWFkeXN0YXRlY2hhbmdlID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIGlmICh0aGlzLnJlYWR5U3RhdGUgPT09IDQpIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuc3RhdHVzID49IDIwMCAmJiB0aGlzLnN0YXR1cyA8IDQwMCkge1xyXG4gICAgICAgICAgICAgICAgc2F2ZSh0aGlzLnJlc3BvbnNlVGV4dCk7XHJcbiAgICAgICAgICAgICAgICB2YXIgZGF0YSA9IEpTT04ucGFyc2UodGhpcy5yZXNwb25zZVRleHQpO1xyXG4gICAgICAgICAgICAgICAgY2FsbGJhY2suYXBwbHkodGhpcywgW2RhdGFdKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIERlYnVnLndhcm4oXCJlcnJvciBmZXRjaGluZyBzdGF0ZS5qc29uOiBcIiArIHRoaXMuc3RhdHVzICsgXCIsIFwiICsgdGhpcy5zdGF0dXNUZXh0KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgcmVxdWVzdC5zZW5kKCk7XHJcbiAgICByZXF1ZXN0ID0gbnVsbDtcclxufTtcclxuXHJcbnZhciBzYXZlID0gZnVuY3Rpb24gKGRhdGEpIHtcclxuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKFNUT1JBR0VfS0VZLCBkYXRhKTtcclxufTtcclxuXHJcbnZhciBwdWxsID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XHJcbiAgICB2YXIgZnJlc2ggPSBmYWxzZTtcclxuXHJcbiAgICBpZiAoVXRpbHMuaXNGdW5jdGlvbihjYWxsYmFjaykpIHtcclxuICAgICAgICB2YXIgZnJvbVN0b3JhZ2UgPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbShTVE9SQUdFX0tFWSk7XHJcbiAgICAgICAgaWYgKGZyb21TdG9yYWdlKSB7XHJcbiAgICAgICAgICAgIGNhbGxiYWNrLmFwcGx5KHRoaXMsIFtKU09OLnBhcnNlKGZyb21TdG9yYWdlKV0pO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGZldGNoSnNvbihjYWxsYmFjayk7XHJcbiAgICAgICAgICAgIGZyZXNoID0gdHJ1ZTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGZyZXNoO1xyXG59O1xyXG5cclxudmFyIHB1c2ggPSBmdW5jdGlvbiAoZGF0YSwgY2FsbGJhY2spIHtcclxuICAgIGlmICghVXRpbHMuaXNGdW5jdGlvbihjYWxsYmFjaykpXHJcbiAgICAgICAgcmV0dXJuO1xyXG5cclxuICAgIHNhdmUoSlNPTi5zdHJpbmdpZnkoZGF0YSkpO1xyXG5cclxuICAgIGNhbGxiYWNrLmFwcGx5KHRoaXMpO1xyXG59O1xyXG5cclxudmFyIHJlc2V0ID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XHJcbiAgICBpZiAoIVV0aWxzLmlzRnVuY3Rpb24oY2FsbGJhY2spKVxyXG4gICAgICAgIHJldHVybjtcclxuXHJcbiAgICBsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbShTVE9SQUdFX0tFWSk7XHJcblxyXG4gICAgY2FsbGJhY2suYXBwbHkodGhpcyk7XHJcbn07XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHtcclxuICAgIHB1bGw6IHB1bGwsXHJcbiAgICBwdXNoOiBwdXNoLFxyXG4gICAgcmVzZXQ6IHJlc2V0XHJcbn07Iiwi77u/XCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG52YXIgRW50aXRpZXMgPSByZXF1aXJlKFwiLi9lbnRpdGllcy5qc1wiKTtcclxuXHJcbnZhciBhY3RpdmUgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImFjdGl2ZVwiKTtcclxudmFyIGluYWN0aXZlID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJpbmFjdGl2ZVwiKTtcclxudmFyIGRlYWRndXlzID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJkZWFkZ3V5c1wiKTtcclxuXHJcbnZhciB1cGRhdGUgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICBFbnRpdGllcy5wdXNoKGZ1bmN0aW9uICgpIHtcclxuICAgICAgICByZW5kZXIoKTtcclxuICAgIH0pO1xyXG59O1xyXG5cclxudmFyIHJlbmRlciA9IGZ1bmN0aW9uICgpIHtcclxuICAgIGFjdGl2ZS5pbm5lckhUTUwgPSBcIlwiO1xyXG4gICAgaW5hY3RpdmUuaW5uZXJIVE1MID0gXCJcIjtcclxuICAgIGRlYWRndXlzLmlubmVySFRNTCA9IFwiXCI7XHJcblxyXG4gICAgRW50aXRpZXMuY2hhcnNCeVN0YXRlKENoYXJhY3RlclN0YXRlLkVuY291bnRlciwgZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHZhciByb3cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwidHJcIik7XHJcbiAgICAgICAgdmFyIGNlbGwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwidGRcIik7XHJcblxyXG4gICAgICAgIGNlbGwuaW5uZXJIVE1MID0gdGhpcy5yZW5kZXIoKTtcclxuXHJcbiAgICAgICAgcm93LmFwcGVuZENoaWxkKGNlbGwpO1xyXG4gICAgICAgIGFjdGl2ZS5hcHBlbmRDaGlsZChyb3cpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgRW50aXRpZXMuY2hhcnNCeVN0YXRlKENoYXJhY3RlclN0YXRlLklkbGUsIGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB2YXIgcm93ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInRyXCIpO1xyXG4gICAgICAgIHZhciBjZWxsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInRkXCIpO1xyXG5cclxuICAgICAgICBjZWxsLmlubmVySFRNTCA9IHRoaXMucmVuZGVyKCk7XHJcblxyXG4gICAgICAgIHJvdy5hcHBlbmRDaGlsZChjZWxsKTtcclxuICAgICAgICBpbmFjdGl2ZS5hcHBlbmRDaGlsZChyb3cpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgRW50aXRpZXMuY2hhcnNCeVN0YXRlKENoYXJhY3RlclN0YXRlLkRlYWQsIGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB2YXIgcm93ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInRyXCIpO1xyXG4gICAgICAgIHZhciBjZWxsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInRkXCIpO1xyXG5cclxuICAgICAgICBjZWxsLmlubmVySFRNTCA9IHRoaXMucmVuZGVyKCk7XHJcblxyXG4gICAgICAgIHJvdy5hcHBlbmRDaGlsZChjZWxsKTtcclxuICAgICAgICBkZWFkZ3V5cy5hcHBlbmRDaGlsZChyb3cpO1xyXG4gICAgfSk7XHJcbn07XHJcblxyXG52YXIgYWRkTGlzdGVuZXIgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGZ1bmN0aW9uIChlKSB7XHJcbiAgICAgICAgaWYgKGUudGFyZ2V0KSB7XHJcbiAgICAgICAgICAgIHZhciBkb1VwZGF0ZSA9IHRydWU7XHJcbiAgICAgICAgICAgIHZhciBpZCA9IHBhcnNlSW50KGUudGFyZ2V0LmdldEF0dHJpYnV0ZShcImRhdGEtaWRcIikpO1xyXG5cclxuICAgICAgICAgICAgc3dpdGNoIChlLnRhcmdldC5jbGFzc05hbWUpIHtcclxuICAgICAgICAgICAgICAgIGNhc2UgXCJoYXJkX3Jlc2V0XCI6XHJcbiAgICAgICAgICAgICAgICAgICAgZG9VcGRhdGUgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoY29uZmlybShcIkFyZSB5b3Ugc3VyZT8gVGhpcyBjYW5ub3QgYmUgdW5kb25lLlwiKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgY2VsbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwibWFpbi1jb250ZW50XCIpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBFbnRpdGllcy5yZXNldChmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjZWxsLmlubmVySFRNTCA9IFwicmVzZXR0aW5nIHVwIGluIGhlcmVcIjtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdpbmRvdy5sb2NhdGlvbi5yZWxvYWQoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0sIDYwMCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIGNhc2UgXCJwbGF5ZXJfaW5pdGlhdGl2ZVwiOlxyXG4gICAgICAgICAgICAgICAgICAgIHZhciBpbml0aWF0aXZlID0gcGFyc2VJbnQoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJwbGF5ZXJfaW5pdGlhdGl2ZV9cIiArIGlkKS52YWx1ZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgRW50aXRpZXMudXBkYXRlUGxheWVyKGlkLCBDaGFyYWN0ZXJBY3Rpb24uSW5pdGlhdGl2ZSwgW2luaXRpYXRpdmVdKTtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIGNhc2UgXCJwbGF5ZXJfbGVhdmVcIjpcclxuICAgICAgICAgICAgICAgICAgICBFbnRpdGllcy51cGRhdGVQbGF5ZXIoaWQsIENoYXJhY3RlckFjdGlvbi5MZWF2ZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICBjYXNlIFwicGxheWVyX3Jldml2ZVwiOlxyXG4gICAgICAgICAgICAgICAgICAgIEVudGl0aWVzLnVwZGF0ZVBsYXllcihpZCwgQ2hhcmFjdGVyQWN0aW9uLlJldml2ZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICBjYXNlIFwicGxheWVyX2RpZVwiOlxyXG4gICAgICAgICAgICAgICAgICAgIEVudGl0aWVzLnVwZGF0ZVBsYXllcihpZCwgQ2hhcmFjdGVyQWN0aW9uLkRpZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICBjYXNlIFwibnBjX2luaXRpYXRpdmVcIjpcclxuICAgICAgICAgICAgICAgICAgICBFbnRpdGllcy51cGRhdGVOcGMoaWQsIENoYXJhY3RlckFjdGlvbi5Jbml0aWF0aXZlKTtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIGNhc2UgXCJucGNfZGFtYWdlXCI6XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGRhbWFnZSA9IHBhcnNlSW50KGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwibnBjX2RhbWFnZV9cIiArIGlkKS52YWx1ZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgRW50aXRpZXMudXBkYXRlTnBjKGlkLCBDaGFyYWN0ZXJBY3Rpb24uRGFtYWdlLCBbZGFtYWdlXSk7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICBjYXNlIFwibnBjX2xlYXZlXCI6XHJcbiAgICAgICAgICAgICAgICAgICAgRW50aXRpZXMudXBkYXRlTnBjKGlkLCBDaGFyYWN0ZXJBY3Rpb24uTGVhdmUpO1xyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgY2FzZSBcIm5wY19yZXZpdmVcIjpcclxuICAgICAgICAgICAgICAgICAgICBFbnRpdGllcy51cGRhdGVOcGMoaWQsIENoYXJhY3RlckFjdGlvbi5SZXZpdmUpO1xyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgY2FzZSBcIm5wY19kaWVcIjpcclxuICAgICAgICAgICAgICAgICAgICBFbnRpdGllcy51cGRhdGVOcGMoaWQsIENoYXJhY3RlckFjdGlvbi5EaWUpO1xyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgICAgICBkb1VwZGF0ZSA9IGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBpZiAoZG9VcGRhdGUpIHVwZGF0ZSgpO1xyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG59O1xyXG5cclxudmFyIHJ1biA9IGZ1bmN0aW9uICgpIHtcclxuICAgIGFkZExpc3RlbmVyKCk7XHJcblxyXG4gICAgRW50aXRpZXMucHVsbChmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgcmVuZGVyKCk7XHJcbiAgICB9KTtcclxufTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgcnVuOiBydW5cclxufTsiLCLvu79cInVzZSBzdHJpY3RcIjtcclxuXHJcbmdsb2JhbC5DaGFyYWN0ZXJTdGF0ZSA9IHtcclxuICAgIERlYWQ6IFwiZGVhZFwiLFxyXG4gICAgSWRsZTogXCJhbGl2ZVwiLFxyXG4gICAgRW5jb3VudGVyOiBcImVuY291bnRlclwiXHJcbn07XHJcblxyXG5nbG9iYWwuQ2hhcmFjdGVyQWN0aW9uID0ge1xyXG4gICAgRGFtYWdlOiBcImRhbWFnZVwiLFxyXG4gICAgRGllOiBcImRpZVwiLFxyXG4gICAgSW5pdGlhdGl2ZTogXCJpbml0aWF0aXZlXCIsXHJcbiAgICBMZWF2ZTogXCJsZWF2ZVwiLFxyXG4gICAgUmV2aXZlOiBcInJldml2ZVwiXHJcbn07XHJcblxyXG5nbG9iYWwuRGFtYWdlVHlwZSA9IHtcclxuICAgIEFjaWQ6IFwiYWNpZFwiLFxyXG4gICAgQmx1ZGdlb25pbmc6IFwiYmx1ZGdlb25pbmdcIixcclxuICAgIENvbGQ6IFwiY29sZFwiLFxyXG4gICAgRmlyZTogXCJmaXJlXCIsXHJcbiAgICBGb3JjZTogXCJmb3JjZVwiLFxyXG4gICAgTGlnaHRuaW5nOiBcImxpZ2h0bmluZ1wiLFxyXG4gICAgTmVjcm90aWM6IFwibmVjcm90aWNcIixcclxuICAgIFBpZXJjaW5nOiBcInBpZXJjaW5nXCIsXHJcbiAgICBQb2lzb246IFwicG9pc29uXCIsXHJcbiAgICBQc3ljaGljOiBcInBzeWNoaWNcIixcclxuICAgIFJhZGlhbnQ6IFwicmFkaWFudFwiLFxyXG4gICAgU2xhc2hpbmc6IFwic2xhc2hpbmdcIixcclxuICAgIFRodW5kZXI6IFwidGh1bmRlclwiXHJcbn07XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IG51bGw7Iiwi77u/XCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHtcclxuICAgIGQ0OiBmdW5jdGlvbiAoKSB7IHJldHVybiBVdGlscy5yYW5kb21JbnQoMSwgNCk7IH0sXHJcbiAgICBkNjogZnVuY3Rpb24gKCkgeyByZXR1cm4gVXRpbHMucmFuZG9tSW50KDEsIDYpOyB9LFxyXG4gICAgZDg6IGZ1bmN0aW9uICgpIHsgcmV0dXJuIFV0aWxzLnJhbmRvbUludCgxLCA4KTsgfSxcclxuICAgIGQxMDogZnVuY3Rpb24gKCkgeyByZXR1cm4gVXRpbHMucmFuZG9tSW50KDEsIDEwKTsgfSxcclxuICAgIGQxMjogZnVuY3Rpb24gKCkgeyByZXR1cm4gVXRpbHMucmFuZG9tSW50KDEsIDEyKTsgfSxcclxuICAgIGQyMDogZnVuY3Rpb24gKCkgeyByZXR1cm4gVXRpbHMucmFuZG9tSW50KDEsIDIwKTsgfSxcclxuICAgIGQxMDA6IGZ1bmN0aW9uICgpIHsgcmV0dXJuIFV0aWxzLnJhbmRvbUludCgxLCAxMDApOyB9XHJcbn07XHJcbiIsIu+7v1widXNlIHN0cmljdFwiO1xyXG5cclxudmFyIFdlYXBvbiA9IHJlcXVpcmUoXCIuL3dlYXBvbi5qc1wiKTtcclxudmFyIHJvbGwgPSByZXF1aXJlKFwiLi4vZG5kL2RpY2UuanNcIik7XHJcblxyXG52YXIgbnBjID0gZnVuY3Rpb24gKCkge1xyXG4gICAgdGhpcy5pZCA9IDA7XHJcbiAgICB0aGlzLm5hbWUgPSBcIlwiO1xyXG4gICAgdGhpcy5oZWFsdGggPSA1O1xyXG4gICAgdGhpcy5hcm1vciA9IDEwO1xyXG4gICAgdGhpcy5zcGVlZCA9IDE1O1xyXG4gICAgdGhpcy5yYWNlID0gXCJIdW1hblwiO1xyXG4gICAgdGhpcy5pbml0aWF0aXZlID0gMDtcclxuICAgIHRoaXMud2VhcG9ucyA9IFtdO1xyXG4gICAgdGhpcy5zdGF0ZSA9IENoYXJhY3RlclN0YXRlLklkbGU7XHJcbiAgICB0aGlzLmxpbmsgPSBcIlwiO1xyXG4gICAgdGhpcy5pbml0TW9kID0gMDtcclxuICAgIHRoaXMudGVtcGxhdGUgPSBmYWxzZTtcclxuICAgIHRoaXMuaW5zdGFuY2UgPSAwO1xyXG59O1xyXG5cclxubnBjLnByb3RvdHlwZS5wYXJzZSA9IGZ1bmN0aW9uIChqc29uKSB7XHJcbiAgICBpZiAoIWpzb24pIHJldHVybjtcclxuXHJcbiAgICBpZiAoanNvbi5pZCAmJiBVdGlscy5pc051bWVyaWMoanNvbi5pZCkpIHtcclxuICAgICAgICB0aGlzLmlkID0ganNvbi5pZDtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoanNvbi5uYW1lKSB7XHJcbiAgICAgICAgdGhpcy5uYW1lID0ganNvbi5uYW1lO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChqc29uLmhlYWx0aCAmJiBVdGlscy5pc051bWVyaWMoanNvbi5oZWFsdGgpKSB7XHJcbiAgICAgICAgdGhpcy5oZWFsdGggPSBqc29uLmhlYWx0aDtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoanNvbi5hcm1vciAmJiBVdGlscy5pc051bWVyaWMoanNvbi5hcm1vcikpIHtcclxuICAgICAgICB0aGlzLmFybW9yID0ganNvbi5hcm1vcjtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoanNvbi5zcGVlZCAmJiBVdGlscy5pc051bWVyaWMoanNvbi5zcGVlZCkpIHtcclxuICAgICAgICB0aGlzLnNwZWVkID0ganNvbi5zcGVlZDtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoanNvbi5yYWNlKSB7XHJcbiAgICAgICAgdGhpcy5yYWNlID0ganNvbi5yYWNlO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChqc29uLmluaXRpYXRpdmUgJiYgVXRpbHMuaXNOdW1lcmljKGpzb24uaW5pdGlhdGl2ZSkpIHtcclxuICAgICAgICB0aGlzLmluaXRpYXRpdmUgPSBqc29uLmluaXRpYXRpdmU7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGpzb24uc3RhdGUpIHtcclxuICAgICAgICB0aGlzLnN0YXRlID0ganNvbi5zdGF0ZTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoanNvbi53ZWFwb25zICYmIFV0aWxzLmlzQXJyYXkoanNvbi53ZWFwb25zKSkge1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0ganNvbi53ZWFwb25zLmxlbmd0aDsgaSA8IGw7IGkrKykge1xyXG4gICAgICAgICAgICB2YXIgdyA9IG5ldyBXZWFwb24oKTtcclxuICAgICAgICAgICAgdy5wYXJzZShqc29uLndlYXBvbnNbaV0pO1xyXG4gICAgICAgICAgICB0aGlzLndlYXBvbnMucHVzaCh3KTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGpzb24ubGluaykge1xyXG4gICAgICAgIHRoaXMubGluayA9IGpzb24ubGluaztcclxuICAgIH1cclxuXHJcbiAgICBpZiAoanNvbi50ZW1wbGF0ZSkge1xyXG4gICAgICAgIHRoaXMudGVtcGxhdGUgPSBqc29uLnRlbXBsYXRlO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChqc29uLmluaXRNb2QgJiYgVXRpbHMuaXNOdW1lcmljKGpzb24uaW5pdE1vZCkpIHtcclxuICAgICAgICB0aGlzLmluaXRNb2QgPSBqc29uLmluaXRNb2Q7XHJcbiAgICB9XHJcbn07XHJcblxyXG5ucGMucHJvdG90eXBlLnNlcmlhbGl6ZSA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHZhciB3ZWFwb25zID0gW107XHJcbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IHRoaXMud2VhcG9ucy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICB3ZWFwb25zLnB1c2godGhpcy53ZWFwb25zW2ldLnNlcmlhbGl6ZSgpKTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIGlkOiB0aGlzLmlkLFxyXG4gICAgICAgIG5hbWU6IHRoaXMubmFtZSxcclxuICAgICAgICBoZWFsdGg6IHRoaXMuaGVhbHRoLFxyXG4gICAgICAgIGFybW9yOiB0aGlzLmFybW9yLFxyXG4gICAgICAgIHNwZWVkOiB0aGlzLnNwZWVkLFxyXG4gICAgICAgIHJhY2U6IHRoaXMucmFjZSxcclxuICAgICAgICBpbml0aWF0aXZlOiB0aGlzLmluaXRpYXRpdmUsXHJcbiAgICAgICAgd2VhcG9uczogd2VhcG9ucyxcclxuICAgICAgICBzdGF0ZTogdGhpcy5zdGF0ZSxcclxuICAgICAgICBsaW5rOiB0aGlzLmxpbmssXHJcbiAgICAgICAgaW5pdE1vZDogdGhpcy5pbml0TW9kLFxyXG4gICAgICAgIHRlbXBsYXRlOiB0aGlzLnRlbXBsYXRlLFxyXG4gICAgICAgIGluc3RhbmNlOiB0aGlzLmluc3RhbmNlXHJcbiAgICB9O1xyXG59O1xyXG5cclxubnBjLnByb3RvdHlwZS5yZW5kZXIgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICB2YXIgb3V0ID0gXCI8ZGl2IGNsYXNzPSdlbnQgbnBjJyBkYXRhLWlkPSdcIiArIHRoaXMuaWQgKyBcIic+XCI7XHJcblxyXG4gICAgb3V0ICs9IFwiPGRpdj48c3BhbiBjbGFzcz0nYm9sZCc+XCIgKyB0aGlzLm5hbWUgKyBcIjwvc3Bhbj4sIDxzcGFuIGNsYXNzPSdpdGFsaWMnPlwiICsgdGhpcy5yYWNlICsgXCI8L3NwYW4+LiBTcGVlZDogXCIgKyB0aGlzLnNwZWVkICsgXCI8L2Rpdj5cIjtcclxuXHJcbiAgICB2YXIgaW5pdGlhdGl2ZSA9IFwiXCI7XHJcbiAgICBpZiAodGhpcy5zdGF0ZSA9PT0gQ2hhcmFjdGVyU3RhdGUuRW5jb3VudGVyKVxyXG4gICAgICAgIGluaXRpYXRpdmUgPSBcIiAoXCIgKyAodGhpcy5oZWFsdGggPiAwID8gXCJhbGl2ZVwiIDogXCJkZWFkXCIpICsgXCIpLCBJbml0aWF0aXZlOiA8c3BhbiBjbGFzcz0nYm9sZCc+XCIgKyB0aGlzLmluaXRpYXRpdmUgKyBcIjwvc3Bhbj5cIjtcclxuXHJcbiAgICBvdXQgKz0gXCI8ZGl2PkhlYWx0aDogPHNwYW4gY2xhc3M9J2JvbGQnPlwiICsgdGhpcy5oZWFsdGggKyBcIjwvc3Bhbj4sIEFDOiA8c3BhbiBjbGFzcz0nYm9sZCc+XCIgKyB0aGlzLmFybW9yICsgXCI8L3NwYW4+XCIgKyBpbml0aWF0aXZlICsgXCI8L2Rpdj5cIjtcclxuXHJcbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IHRoaXMud2VhcG9ucy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICBvdXQgKz0gXCI8ZGl2PlwiICsgdGhpcy53ZWFwb25zW2ldLnJlbmRlcigpICsgXCI8L2Rpdj5cIjtcclxuICAgIH1cclxuXHJcbiAgICBpZiAodGhpcy5zdGF0ZSA9PT0gQ2hhcmFjdGVyU3RhdGUuRW5jb3VudGVyKSB7XHJcbiAgICAgICAgb3V0ICs9IFwiPGRpdj48aW5wdXQgdHlwZT0nYnV0dG9uJyBjbGFzcz0nbnBjX2RhbWFnZScgdmFsdWU9J0FwcGx5IERhbWFnZScgZGF0YS1pZD0nXCIgKyB0aGlzLmlkICsgXCInIC8+PGlucHV0IHR5cGU9J3RleHQnIGlkPSducGNfZGFtYWdlX1wiICsgdGhpcy5pZCArIFwiJyAvPjwvZGl2PlwiO1xyXG4gICAgICAgIG91dCArPSBcIjxkaXYgc3R5bGU9J21hcmdpbi10b3A6IDRweDsnPlwiO1xyXG4gICAgICAgIG91dCArPSBcIjxpbnB1dCB0eXBlPSdidXR0b24nIGNsYXNzPSducGNfbGVhdmUnIHZhbHVlPSdMZWF2ZSBFbmNvdW50ZXInIGRhdGEtaWQ9J1wiICsgdGhpcy5pZCArIFwiJyAvPiZuYnNwO1wiO1xyXG4gICAgICAgIG91dCArPSBcIjxpbnB1dCB0eXBlPSdidXR0b24nIGNsYXNzPSducGNfZGllJyB2YWx1ZT0nRGllJyBkYXRhLWlkPSdcIiArIHRoaXMuaWQgKyBcIicgLz5cIjtcclxuICAgICAgICBvdXQgKz0gXCI8L2Rpdj5cIjtcclxuICAgIH0gZWxzZSBpZiAodGhpcy5zdGF0ZSA9PT0gQ2hhcmFjdGVyU3RhdGUuSWRsZSkge1xyXG4gICAgICAgIG91dCArPSBcIjxkaXY+XCI7XHJcbiAgICAgICAgb3V0ICs9IFwiPGlucHV0IHR5cGU9J2J1dHRvbicgY2xhc3M9J25wY19pbml0aWF0aXZlJyB2YWx1ZT0nUm9sbCBJbml0aWF0aXZlJyBkYXRhLWlkPSdcIiArIHRoaXMuaWQgKyBcIicgLz5cIjtcclxuICAgICAgICBpZiAoIXRoaXMudGVtcGxhdGUpIG91dCArPSBcIiZuYnNwOzxpbnB1dCB0eXBlPSdidXR0b24nIGNsYXNzPSducGNfZGllJyB2YWx1ZT0nRGllJyBkYXRhLWlkPSdcIiArIHRoaXMuaWQgKyBcIicgLz5cIjtcclxuICAgICAgICBvdXQgKz0gXCI8L2Rpdj5cIjtcclxuICAgIH0gZWxzZSBpZiAodGhpcy5zdGF0ZSA9PT0gQ2hhcmFjdGVyU3RhdGUuRGVhZCkge1xyXG4gICAgICAgIG91dCArPSBcIjxkaXY+PGlucHV0IHR5cGU9J2J1dHRvbicgY2xhc3M9J25wY19yZXZpdmUnIHZhbHVlPSdSZXZpdmUgTlBDJyBkYXRhLWlkPSdcIiArIHRoaXMuaWQgKyBcIicgLz48L2Rpdj5cIjtcclxuICAgIH1cclxuXHJcbiAgICBpZiAodGhpcy5saW5rKSBvdXQgKz0gXCI8ZGl2PjxhIGhyZWY9J1wiICsgdGhpcy5saW5rICsgXCInIHRhcmdldD0nX2JsYW5rJz5EJkQgQmV5b25kPC9hPjwvZGl2PlwiO1xyXG5cclxuICAgIG91dCArPSBcIjwvZGl2PlwiO1xyXG4gICAgcmV0dXJuIG91dDtcclxufTtcclxuXHJcbm5wYy5wcm90b3R5cGUucm9sbEluaXRpYXRpdmUgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICB0aGlzLnN0YXRlID0gQ2hhcmFjdGVyU3RhdGUuRW5jb3VudGVyO1xyXG4gICAgdGhpcy5pbml0aWF0aXZlID0gcm9sbC5kMjAoKSArIHRoaXMuaW5pdE1vZDtcclxufTtcclxuXHJcbm5wYy5wcm90b3R5cGUuYXBwbHlEYW1hZ2UgPSBmdW5jdGlvbiAoZGFtYWdlKSB7XHJcbiAgICB0aGlzLmhlYWx0aCAtPSBkYW1hZ2U7XHJcbiAgICBpZiAodGhpcy5oZWFsdGggPD0gMCkge1xyXG4gICAgICAgIHRoaXMuaGVhbHRoID0gMDtcclxuICAgICAgICB0aGlzLnN0YXRlID0gQ2hhcmFjdGVyU3RhdGUuRGVhZDtcclxuICAgIH1cclxufTtcclxuXHJcbm5wYy5wcm90b3R5cGUucmV2aXZlID0gZnVuY3Rpb24gKCkge1xyXG4gICAgdGhpcy5oZWFsdGggPSAxO1xyXG4gICAgdGhpcy5zdGF0ZSA9IENoYXJhY3RlclN0YXRlLkVuY291bnRlcjtcclxufTtcclxuXHJcbm5wYy5wcm90b3R5cGUubGVhdmVFbmNvdW50ZXIgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICB0aGlzLmluaXRpYXRpdmUgPSAwO1xyXG4gICAgdGhpcy5zdGF0ZSA9IENoYXJhY3RlclN0YXRlLklkbGU7XHJcbn07XHJcblxyXG5ucGMucHJvdG90eXBlLmRpZSA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHRoaXMuaGVhbHRoID0gMDtcclxuICAgIHRoaXMuc3RhdGUgPSBDaGFyYWN0ZXJTdGF0ZS5EZWFkO1xyXG59O1xyXG5cclxubnBjLnByb3RvdHlwZS5jbG9uZSA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHZhciBuID0gbmV3IG5wYygpO1xyXG4gICAgdGhpcy5pbnN0YW5jZSsrO1xyXG4gICAgbi5uYW1lID0gdGhpcy5uYW1lICsgXCIgI1wiICsgdGhpcy5pbnN0YW5jZTtcclxuICAgIG4uaGVhbHRoID0gdGhpcy5oZWFsdGg7XHJcbiAgICBuLmFybW9yID0gdGhpcy5hcm1vcjtcclxuICAgIG4uc3BlZWQgPSB0aGlzLnNwZWVkO1xyXG4gICAgbi5yYWNlID0gdGhpcy5yYWNlO1xyXG4gICAgbi53ZWFwb25zID0gVXRpbHMuYXJyYXlDbG9uZSh0aGlzLndlYXBvbnMpO1xyXG4gICAgbi5saW5rID0gdGhpcy5saW5rO1xyXG4gICAgbi5pbml0TW9kID0gdGhpcy5pbml0TW9kO1xyXG4gICAgcmV0dXJuIG47XHJcbn07XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IG5wYzsiLCLvu79cInVzZSBzdHJpY3RcIjtcclxuXHJcbnZhciBwbGF5ZXIgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICB0aGlzLmlkID0gMDtcclxuICAgIHRoaXMubmFtZSA9IFwiXCI7XHJcbiAgICB0aGlzLnBsYXllciA9IFwiXCI7XHJcbiAgICB0aGlzLmluaXRpYXRpdmUgPSAwO1xyXG4gICAgdGhpcy5zdGF0ZSA9IENoYXJhY3RlclN0YXRlLklkbGU7XHJcbiAgICB0aGlzLmV4aGF1c3Rpb24gPSAwO1xyXG4gICAgdGhpcy5saW5rID0gXCJcIjtcclxufTtcclxuXHJcbnBsYXllci5wcm90b3R5cGUucGFyc2UgPSBmdW5jdGlvbiAoanNvbikge1xyXG4gICAgaWYgKCFqc29uKSByZXR1cm47XHJcblxyXG4gICAgaWYgKGpzb24uaWQgJiYgVXRpbHMuaXNOdW1lcmljKGpzb24uaWQpKSB7XHJcbiAgICAgICAgdGhpcy5pZCA9IGpzb24uaWQ7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGpzb24ubmFtZSkge1xyXG4gICAgICAgIHRoaXMubmFtZSA9IGpzb24ubmFtZTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoanNvbi5wbGF5ZXIpIHtcclxuICAgICAgICB0aGlzLnBsYXllciA9IGpzb24ucGxheWVyO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChqc29uLmluaXRpYXRpdmUgJiYgVXRpbHMuaXNOdW1lcmljKGpzb24uaW5pdGlhdGl2ZSkpIHtcclxuICAgICAgICB0aGlzLmluaXRpYXRpdmUgPSBqc29uLmluaXRpYXRpdmU7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGpzb24uc3RhdGUpIHtcclxuICAgICAgICB0aGlzLnN0YXRlID0ganNvbi5zdGF0ZTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoanNvbi5leGhhdXN0aW9uICYmIFV0aWxzLmlzTnVtZXJpYyhqc29uLmV4aGF1c3Rpb24pKSB7XHJcbiAgICAgICAgdGhpcy5leGhhdXN0aW9uID0gVXRpbHMuY2xhbXAoanNvbi5leGhhdXN0aW9uLCAxLCA2KTtcclxuXHJcbiAgICAgICAgaWYgKHRoaXMuZXhoYXVzdGlvbiA9PSA2KVxyXG4gICAgICAgICAgICB0aGlzLnN0YXRlID0gQ2hhcmFjdGVyU3RhdGUuRGVhZDtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoanNvbi5saW5rKSB7XHJcbiAgICAgICAgdGhpcy5saW5rID0ganNvbi5saW5rO1xyXG4gICAgfVxyXG59O1xyXG5cclxucGxheWVyLnByb3RvdHlwZS5zZXJpYWxpemUgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIGlkOiB0aGlzLmlkLFxyXG4gICAgICAgIG5hbWU6IHRoaXMubmFtZSxcclxuICAgICAgICBpbml0aWF0aXZlOiB0aGlzLmluaXRpYXRpdmUsXHJcbiAgICAgICAgc3RhdGU6IHRoaXMuc3RhdGUsXHJcbiAgICAgICAgZXhoYXVzdGlvbjogdGhpcy5leGhhdXN0aW9uLFxyXG4gICAgICAgIGxpbms6IHRoaXMubGlua1xyXG4gICAgfTtcclxufTtcclxuXHJcbnBsYXllci5wcm90b3R5cGUucmVuZGVyID0gZnVuY3Rpb24gKCkge1xyXG4gICAgdmFyIG91dCA9IFwiPGRpdiBjbGFzcz0nZW50IHBsYXllcicgZGF0YS1pZD0nXCIgKyB0aGlzLmlkICsgXCInPlwiO1xyXG5cclxuICAgIG91dCArPSBcIjxkaXY+PHNwYW4gY2xhc3M9J2JvbGQnPlwiICsgdGhpcy5uYW1lICsgXCI8L3NwYW4+IDxzcGFuIGNsYXNzPSdpdGFsaWNzJz5cIiArIHRoaXMucGxheWVyICsgXCI8L3NwYW4+PC9kaXY+XCI7XHJcblxyXG4gICAgaWYgKHRoaXMuc3RhdGUgPT09IENoYXJhY3RlclN0YXRlLkVuY291bnRlcikge1xyXG4gICAgICAgIG91dCArPSBcIjxkaXY+SW5pdGlhdGl2ZTogPHNwYW4gY2xhc3M9J2JvbGQnPlwiICsgdGhpcy5pbml0aWF0aXZlICsgXCI8L3NwYW4+PC9kaXY+XCI7XHJcbiAgICAgICAgb3V0ICs9IFwiPGRpdj5cIjtcclxuICAgICAgICBvdXQgKz0gXCI8aW5wdXQgdHlwZT0nYnV0dG9uJyBjbGFzcz0ncGxheWVyX2xlYXZlJyB2YWx1ZT0nTGVhdmUgRW5jb3VudGVyJyBkYXRhLWlkPSdcIiArIHRoaXMuaWQgKyBcIicgc3R5bGU9J21hcmdpbi1yaWdodDo1cHgnIC8+XCI7XHJcbiAgICAgICAgb3V0ICs9IFwiPGlucHV0IHR5cGU9J2J1dHRvbicgY2xhc3M9J3BsYXllcl9kaWUnIHZhbHVlPSdEaWUnIGRhdGEtaWQ9J1wiICsgdGhpcy5pZCArIFwiJyAvPlwiO1xyXG4gICAgICAgIG91dCArPSBcIjwvZGl2PlwiO1xyXG4gICAgfSBlbHNlIGlmICh0aGlzLnN0YXRlID09PSBDaGFyYWN0ZXJTdGF0ZS5JZGxlKSB7XHJcbiAgICAgICAgb3V0ICs9IFwiPGRpdj5cIjtcclxuICAgICAgICBvdXQgKz0gXCI8aW5wdXQgdHlwZT0nYnV0dG9uJyBjbGFzcz0ncGxheWVyX2luaXRpYXRpdmUnIHZhbHVlPSdBcHBseSBJbml0aWF0dmUnIGRhdGEtaWQ9J1wiICsgdGhpcy5pZCArIFwiJyAvPjxpbnB1dCB0eXBlPSd0ZXh0JyBpZD0ncGxheWVyX2luaXRpYXRpdmVfXCIgKyB0aGlzLmlkICsgXCInIC8+XCI7XHJcbiAgICAgICAgb3V0ICs9IFwiPGlucHV0IHR5cGU9J2J1dHRvbicgY2xhc3M9J3BsYXllcl9kaWUnIHZhbHVlPSdEaWUnIGRhdGEtaWQ9J1wiICsgdGhpcy5pZCArIFwiJyAvPlwiO1xyXG4gICAgICAgIG91dCArPSBcIjwvZGl2PlwiO1xyXG4gICAgfSBlbHNlIGlmICh0aGlzLnN0YXRlID09PSBDaGFyYWN0ZXJTdGF0ZS5EZWFkKSB7XHJcbiAgICAgICAgb3V0ICs9IFwiPGRpdj48aW5wdXQgdHlwZT0nYnV0dG9uJyBjbGFzcz0ncGxheWVyX3Jldml2ZScgdmFsdWU9J1Jldml2ZSBQbGF5ZXInIGRhdGEtaWQ9J1wiICsgdGhpcy5pZCArIFwiJyAvPjwvZGl2PlwiO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICh0aGlzLmxpbmspIG91dCArPSBcIjxkaXY+PGEgaHJlZj0nXCIgKyB0aGlzLmxpbmsgKyBcIicgdGFyZ2V0PSdfYmxhbmsnPkQmRCBCZXlvbmQ8L2E+PC9kaXY+XCI7XHJcblxyXG4gICAgb3V0ICs9IFwiPC9kaXY+XCI7XHJcblxyXG4gICAgcmV0dXJuIG91dDtcclxufTtcclxuXHJcbnBsYXllci5wcm90b3R5cGUuYXBwbHlJbml0aWF0aXZlID0gZnVuY3Rpb24gKGluaXRpYXRpdmUpIHtcclxuICAgIHRoaXMuaW5pdGlhdGl2ZSA9IGluaXRpYXRpdmU7XHJcbiAgICB0aGlzLnN0YXRlID0gQ2hhcmFjdGVyU3RhdGUuRW5jb3VudGVyO1xyXG59O1xyXG5cclxucGxheWVyLnByb3RvdHlwZS5sZWF2ZUVuY291bnRlciA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHRoaXMuaW5pdGlhdGl2ZSA9IDA7XHJcbiAgICB0aGlzLnN0YXRlID0gQ2hhcmFjdGVyU3RhdGUuSWRsZTtcclxufTtcclxuXHJcbnBsYXllci5wcm90b3R5cGUucmV2aXZlID0gZnVuY3Rpb24gKCkge1xyXG4gICAgdGhpcy5zdGF0ZSA9IENoYXJhY3RlclN0YXRlLkVuY291bnRlcjtcclxufTtcclxuXHJcbnBsYXllci5wcm90b3R5cGUuZGllID0gZnVuY3Rpb24gKCkge1xyXG4gICAgdGhpcy5zdGF0ZSA9IENoYXJhY3RlclN0YXRlLkRlYWQ7XHJcbn07XHJcblxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBwbGF5ZXI7Iiwi77u/XCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG52YXIgd2VhcG9uID0gZnVuY3Rpb24gKCkge1xyXG4gICAgdGhpcy5uYW1lID0gXCJcIjtcclxuICAgIHRoaXMuZGljZSA9IFwiMWQ0XCI7XHJcbiAgICB0aGlzLmhpdE1vZCA9IDA7XHJcbiAgICB0aGlzLmF0dGFja01vZCA9IDA7XHJcbiAgICB0aGlzLmRhbWFnZVR5cGUgPSBEYW1hZ2VUeXBlLkJsdWRnZW9uaW5nO1xyXG59O1xyXG5cclxud2VhcG9uLnByb3RvdHlwZS5wYXJzZSA9IGZ1bmN0aW9uIChqc29uKSB7XHJcbiAgICBpZiAoIWpzb24pIHJldHVybjtcclxuXHJcbiAgICBpZiAoanNvbi5uYW1lKSB7XHJcbiAgICAgICAgdGhpcy5uYW1lID0ganNvbi5uYW1lO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChqc29uLmRpY2UpIHtcclxuICAgICAgICB0aGlzLmRpY2UgPSBqc29uLmRpY2U7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGpzb24uaGl0TW9kICYmIFV0aWxzLmlzTnVtZXJpYyhqc29uLmhpdE1vZCkpIHtcclxuICAgICAgICB0aGlzLmhpdE1vZCA9IFV0aWxzLmNsYW1wKGpzb24uaGl0TW9kLCAwLCA5OTkpO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChqc29uLmF0dGFja01vZCAmJiBVdGlscy5pc051bWVyaWMoanNvbi5hdHRhY2tNb2QpKSB7XHJcbiAgICAgICAgdGhpcy5hdHRhY2tNb2QgPSBVdGlscy5jbGFtcChqc29uLmF0dGFja01vZCwgMCwgOTk5KTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoanNvbi5kYW1hZ2VUeXBlKSB7XHJcbiAgICAgICAgdGhpcy5kYW1hZ2VUeXBlID0ganNvbi5kYW1hZ2VUeXBlO1xyXG4gICAgfVxyXG59O1xyXG5cclxud2VhcG9uLnByb3RvdHlwZS5zZXJpYWxpemUgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIG5hbWU6IHRoaXMubmFtZSxcclxuICAgICAgICBkaWNlOiB0aGlzLmRpY2UsXHJcbiAgICAgICAgaGl0TW9kOiB0aGlzLmhpdE1vZCxcclxuICAgICAgICBhdHRhY2tNb2Q6IHRoaXMuYXR0YWNrTW9kLFxyXG4gICAgICAgIGRhbWFnZVR5cGU6IHRoaXMuZGFtYWdlVHlwZVxyXG4gICAgfTtcclxufTtcclxuXHJcbndlYXBvbi5wcm90b3R5cGUucmVuZGVyID0gZnVuY3Rpb24gKCkge1xyXG4gICAgdmFyIG91dCA9IFwiPHNwYW4gY2xhc3M9J2JvbGQnPlwiICsgdGhpcy5uYW1lICsgXCI8L3NwYW4+OiAxZDIwXCI7XHJcbiAgICBpZiAodGhpcy5oaXRNb2QgPiAwKSBvdXQgKz0gXCIgKyBcIiArIHRoaXMuaGl0TW9kO1xyXG4gICAgb3V0ICs9IFwiIHRvIGhpdCwgXCIgKyB0aGlzLmRpY2U7XHJcbiAgICBpZiAodGhpcy5hdHRhY2tNb2QgPiAwKSBvdXQgKz0gXCIgKyBcIiArIHRoaXMuYXR0YWNrTW9kO1xyXG4gICAgb3V0ICs9IFwiLCA8c3BhbiBjbGFzcz0naXRhbGljJz5cIiArIHRoaXMuZGFtYWdlVHlwZSArIFwiPC9zcGFuPlwiO1xyXG5cclxuICAgIHJldHVybiBvdXQ7XHJcbn07XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHdlYXBvbjsiLCLvu79cInVzZSBzdHJpY3RcIjtcclxuXHJcbi8vIGdsb2JhbCB2YXJzL2Z1bmN0aW9uc1xyXG5nbG9iYWwuRGVidWcgPSByZXF1aXJlKFwiLi91dGlscy9kZWJ1Zy5qc1wiKTtcclxuZ2xvYmFsLlV0aWxzID0gcmVxdWlyZShcIi4vdXRpbHMvdXRpbHMuanNcIik7XHJcblxyXG4vLyBwYXJzZSBhcHAgc3BlY2lmaWMgZ2xvYmFsc1xyXG5yZXF1aXJlKFwiLi9kbmQvY29uc3RhbnRzLmpzXCIpO1xyXG5cclxuZ2xvYmFsLkRhdGFGaWxlID0gXCIvanNvbi9zdGF0ZS5qc29uXCI7XHJcblxyXG52YXIgdWkgPSByZXF1aXJlKFwiLi9hcHAvdWkuanNcIik7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHtcclxuICAgIHJ1bjogdWkucnVuXHJcbn07XHJcblxyXG4iLCLvu79cInVzZSBzdHJpY3RcIjtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgYXNzZXJ0OiBjb25zb2xlID8gY29uc29sZS5hc3NlcnQuYmluZChjb25zb2xlKSA6IGZ1bmN0aW9uICgpIHsgfSxcclxuICAgIGNsZWFyOiBjb25zb2xlID8gY29uc29sZS5jbGVhci5iaW5kKGNvbnNvbGUpIDogZnVuY3Rpb24gKCkgeyB9LFxyXG4gICAgZXJyb3I6IGNvbnNvbGUgPyBjb25zb2xlLmVycm9yLmJpbmQoY29uc29sZSkgOiBmdW5jdGlvbiAoKSB7IH0sXHJcbiAgICBncm91cDogY29uc29sZSA/IGNvbnNvbGUuZ3JvdXAuYmluZChjb25zb2xlKSA6IGZ1bmN0aW9uICgpIHsgfSxcclxuICAgIGdyb3VwQ29sbGFwc2VkOiBjb25zb2xlID8gY29uc29sZS5ncm91cENvbGxhcHNlZC5iaW5kKGNvbnNvbGUpIDogZnVuY3Rpb24gKCkgeyB9LFxyXG4gICAgZ3JvdXBFbmQ6IGNvbnNvbGUgPyBjb25zb2xlLmdyb3VwRW5kLmJpbmQoY29uc29sZSkgOiBmdW5jdGlvbiAoKSB7IH0sXHJcbiAgICBpbmZvOiBjb25zb2xlID8gY29uc29sZS5pbmZvLmJpbmQoY29uc29sZSkgOiBmdW5jdGlvbiAoKSB7IH0sXHJcbiAgICBsb2c6IGNvbnNvbGUgPyBjb25zb2xlLmxvZy5iaW5kKGNvbnNvbGUpIDogZnVuY3Rpb24gKCkgeyB9LFxyXG4gICAgdHJhY2U6IGNvbnNvbGUgPyBjb25zb2xlLnRyYWNlLmJpbmQoY29uc29sZSkgOiBmdW5jdGlvbiAoKSB7IH0sXHJcbiAgICB3YXJuOiBjb25zb2xlID8gY29uc29sZS53YXJuLmJpbmQoY29uc29sZSkgOiBmdW5jdGlvbiAoKSB7IH0sXHJcbn07XHJcbiIsIu+7v1widXNlIHN0cmljdFwiO1xyXG5cclxudmFyIGlzTnVtZXJpYyA9IGZ1bmN0aW9uIChuKSB7XHJcbiAgICByZXR1cm4gIWlzTmFOKHBhcnNlRmxvYXQobikpICYmIGlzRmluaXRlKG4pO1xyXG59O1xyXG5cclxudmFyIHJhbmRvbUludCA9IGZ1bmN0aW9uIChtaW4sIG1heCkge1xyXG4gICAgcmV0dXJuIE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIChtYXggLSBtaW4gKyAxKSkgKyBtaW47XHJcbn07XHJcblxyXG52YXIgcmFuZG9tQ2hhbmNlID0gZnVuY3Rpb24gKHBlcmNlbnRUcnVlKSB7XHJcbiAgICBwZXJjZW50VHJ1ZSA9IHBlcmNlbnRUcnVlIHx8IDUwO1xyXG4gICAgcmV0dXJuIHJhbmRvbUludCgxLCAxMDApIDw9IHBlcmNlbnRUcnVlID8gdHJ1ZSA6IGZhbHNlO1xyXG59O1xyXG5cclxudmFyIGNsYW1wID0gZnVuY3Rpb24gKHZhbCwgbWluLCBtYXgpIHtcclxuICAgIGlmICh2YWwgPCBtaW4pXHJcbiAgICAgICAgcmV0dXJuIG1pbjtcclxuICAgIGlmICh2YWwgPiBtYXgpXHJcbiAgICAgICAgcmV0dXJuIG1heDtcclxuICAgIHJldHVybiB2YWw7XHJcbn07XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHtcclxuICAgIGNsYW1wOiBjbGFtcCxcclxuICAgIGlzTnVtZXJpYzogaXNOdW1lcmljLFxyXG4gICAgcmFuZG9tSW50OiByYW5kb21JbnQsXHJcbiAgICByYW5kb21DaGFuY2U6IHJhbmRvbUNoYW5jZVxyXG59O1xyXG4iLCLvu79cInVzZSBzdHJpY3RcIjtcclxuXHJcbnZhciBpc0FycmF5ID0gZnVuY3Rpb24gKG9iaikge1xyXG4gICAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvYmopID09PSBcIltvYmplY3QgQXJyYXldXCIgPyB0cnVlIDogZmFsc2U7XHJcbn07XHJcblxyXG52YXIgYXJyYXlDbG9uZSA9IGZ1bmN0aW9uIChhcnIpIHtcclxuICAgIHJldHVybiBhcnIuc2xpY2UoMCk7XHJcbn1cclxuXHJcbnZhciBpc0Z1bmN0aW9uID0gZnVuY3Rpb24gKG9iaikge1xyXG4gICAgcmV0dXJuIHR5cGVvZiBvYmogPT09IFwiZnVuY3Rpb25cIiA/IHRydWUgOiBmYWxzZTtcclxufTtcclxuXHJcbnZhciBzdG9yYWdlQXZhaWxhYmxlID0gZnVuY3Rpb24gKHR5cGUpIHtcclxuICAgIHRyeSB7XHJcbiAgICAgICAgdmFyIHN0b3JhZ2UgPSB3aW5kb3dbdHlwZV0sIHggPSBcIl9fc3RvcmFnZV90ZXN0X19cIjtcclxuICAgICAgICBzdG9yYWdlLnNldEl0ZW0oeCwgeCk7XHJcbiAgICAgICAgc3RvcmFnZS5yZW1vdmVJdGVtKHgpO1xyXG4gICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICAgIHJldHVybiBlIGluc3RhbmNlb2YgRE9NRXhjZXB0aW9uICYmIChlLmNvZGUgPT09IDIyIHx8IGUuY29kZSA9PT0gMTAxNCB8fCBlLm5hbWUgPT09IFwiUXVvdGFFeGNlZWRlZEVycm9yXCIgfHwgZS5uYW1lID09PSBcIk5TX0VSUk9SX0RPTV9RVU9UQV9SRUFDSEVEXCIpICYmIHN0b3JhZ2UubGVuZ3RoICE9PSAwO1xyXG4gICAgfVxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHtcclxuICAgIGlzQXJyYXk6IGlzQXJyYXksXHJcbiAgICBhcnJheUNsb25lOiBhcnJheUNsb25lLFxyXG4gICAgaXNGdW5jdGlvbjogaXNGdW5jdGlvbixcclxuICAgIHN0b3JhZ2VBdmFpbGFibGU6IHN0b3JhZ2VBdmFpbGFibGVcclxufTsiLCLvu79cInVzZSBzdHJpY3RcIjtcclxuXHJcbnZhciB1dGlscyA9IHt9O1xyXG5cclxudmFyIGVudW1lcmF0ZSA9IGZ1bmN0aW9uIChvYmopIHtcclxuICAgIGZvciAodmFyIHByb3BlcnR5IGluIG9iaikge1xyXG4gICAgICAgIGlmIChvYmouaGFzT3duUHJvcGVydHkocHJvcGVydHkpKSB7XHJcbiAgICAgICAgICAgIHV0aWxzW3Byb3BlcnR5XSA9IG9ialtwcm9wZXJ0eV07XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59O1xyXG5cclxuZW51bWVyYXRlKHJlcXVpcmUoXCIuL251bWJlcnMuanNcIikpO1xyXG5lbnVtZXJhdGUocmVxdWlyZShcIi4vdG9vbHMuanNcIikpO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSB1dGlscztcclxuIl19
