'use strict'

var Component = require('./component.js')
var Storage = require('../app/storage.js')

var vehicle = function () {
    this.id = 0
    this.name = ""
    this.type = ""
    this.components = []
    this.link = ""
}

vehicle.prototype.parse = function (json) {
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

    if (json.type) {
        this.type = json.type
    }

    if (json.components && Utils.isArray(json.components)) {
        for (var i = 0, l = json.components.length; i < l; i++) {
            var c = new Component()
            c.parse(json.components[i])
            if (c.vehicleId === 0) c.vehicleId = this.id
            this.components.push(c)
        }
    }

    if (json.link) {
        this.link = json.link
    }
}

vehicle.prototype.serialize = function () {
    var components = []
    for (var i = 0, l = this.components.length; i < l; i++) {
        components.push(this.components[i])
    }

    return {
        id: this.id,
        name: this.name,
        type: this.type,
        components: components,
        link: this.link
    }
}

vehicle.prototype.render = function () {
    var out = '<div class="ent vehicle" data-id="' + this.id + '">'

    out += '<div><span class="bold">' + this.name + '</span> <span class="italics">' + this.type + '</span></div>'

    if (this.components.length > 0) {
        out += '<div class="components">'
        out += '<table cellpadding="0" cellspacing="2" border="0">'
        for (var i = 0, l = this.components.length; i < l; i++) {
            if (i % 2 === 0) out += '<tr>'

            out += '<td>' + this.components[i].render() + '</td>'

            if (i % 2 !== 0) out += '</tr>'
        }
        if (i % 2 === 0) out += '</tr>'
        out += '</table>'
        out += '</div>'
    }

    if (this.link) out += '<div><a href="' + this.link + '" target="_blank">D&D Beyond</a></div>'

    out += '</div>'

    return out
}

vehicle.prototype.applyDamage = function (componentId, damage) {
    for (var i = 0, l = this.components.length; i < l; i++) {
        if (this.components[i].id === componentId) {
            this.components[i].applyDamage(damage)
            return true
        }
    }

    return false
}


module.exports = vehicle