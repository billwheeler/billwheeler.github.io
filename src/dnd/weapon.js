"use strict";

var weapon = function () {
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