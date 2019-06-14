'use strict'

var utils = {}

var enumerate = function (obj) {
    for (var property in obj) {
        if (obj.hasOwnProperty(property)) {
            utils[property] = obj[property]
        }
    }
}

enumerate(require('./numbers.js'))
enumerate(require('./tools.js'))

module.exports = utils
