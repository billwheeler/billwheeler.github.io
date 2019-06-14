'use strict'

module.exports = {
    d4: function () { return Utils.randomInt(1, 4) },
    d6: function () { return Utils.randomInt(1, 6) },
    d8: function () { return Utils.randomInt(1, 8) },
    d10: function () { return Utils.randomInt(1, 10) },
    d12: function () { return Utils.randomInt(1, 12) },
    d20: function () { return Utils.randomInt(1, 20) },
    d100: function () { return Utils.randomInt(1, 100) }
}
