'use strict'

var Storage = require('../app/storage.js')

var component = function () {
    this.id = 0
    this.vehicleId = 0
    this.name = ""
    this.health = 0
    this.maxHealth = 0
    this.armor = 0
    this.speed = 0
    this.decrement = 0
    this.stages = 0
    this.threshold = 0
    this.attackToHit = 0
    this.attackRoll = "1d6"
    this.attackRange = "120/320"
    this.attackDamage = "piercing"
}

component.prototype.parse = function (json) {
    if (!json) return

    if (json.id && Utils.isNumeric(json.id)) {
        this.id = json.id
    }

    if (this.id === 0) {
        this.id = Storage.assignId()
    }

    if (json.vehicleId && Utils.isNumeric(json.vehicleId)) {
        this.vehicleId = json.vehicleId
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

    if (json.decrement && Utils.isNumeric(json.decrement)) {
        this.decrement = json.decrement
    }

    if (json.stages && Utils.isNumeric(json.stages)) {
        this.stages = json.stages
    }

    if (json.threshold && Utils.isNumeric(json.threshold)) {
        this.threshold = json.threshold
    }

    if (json.attackToHit && Utils.isNumeric(json.attackToHit)) {
        this.attackToHit = json.attackToHit
    }

    if (json.attackRoll) {
        this.attackRoll = json.attackRoll
    }

    if (json.attackRange) {
        this.attackRoll = json.attackRoll
    }

    if (json.attackDamage) {
        this.attackDamage = json.attackDamage
    }
}

component.prototype.serialize = function () {
    return {
        id: this.id,
        vehicleId: this.vehicleId,
        name: this.name,
        health: this.health,
        maxHealth: this.maxHealth,
        armor: this.armor,
        speed: this.speed,
        decrement: this.decrement,
        stages: this.stages,
        threshold: this.threshold,
        attackToHit: this.attackToHit,
        attackRoll: this.attackRoll,
        attackRange: this.attackRange,
        attackDamage: this.attackDamage
    }
}

component.prototype.render = function () {
    var out = '<div class="component" data-id="' + this.id + '">'
    out += '<div class="bold">' + this.name + '</div>'

    if (this.speed > 0) {
        out += '<div><span class="bold">Speed:</span> ' + this.calculateSpeed() + '</div>'
    }

    out += '<div>Health: <span class="bold">' + this.health + '</span>, AC: <span class="bold">' + this.armor + '</span></div>'
    out += '<div><input type="button" class="component_damage" value="Apply Damage" data-id="' + this.id + '" data-vehicle-id="' + this.vehicleId + '" /><input type="text" id="component_damage_' + this.id + '" /></div>'

    if (this.attackToHit > 0) {
        out += '<div class="component-attack"><div class="bold">Ranged Weapon Attack</div>'
        out += '<div>1d20 + ' + this.attackToHit + ' to hit, ' + this.attackRoll + '</div>'
        out += '<div class="italic">' + this.attackDamage + '</div></div>'
    }

    out += '</div>'
    return out
}

component.prototype.calculateSpeed = function () {
    var slowdown = 0

    if (this.stages > 0 && this.health < this.maxHealth) {
        if (this.health > 0) {
            var portion = Math.floor(this.maxHealth / this.stages)
            for (var i = this.stages; i > 0; i--) {
                if (portion * i >= this.health) slowdown += this.decrement
            }
        } else {
            slowdown = this.speed
        }
    }

    return Utils.clamp(this.speed - slowdown, 0, this.speed)
}

component.prototype.applyDamage = function (damage) {
    if (this.threshold > 0) {
        if (Math.abs(damage) >= this.threshold) this.health -= damage
    } else {
        this.health -= damage
    }

    this.health = Utils.clamp(this.health, 0, this.maxHealth)
}

module.exports = component