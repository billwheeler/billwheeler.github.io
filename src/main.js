'use strict'

// global vars/functions
global.Debug = require('./utils/debug.js')
global.Utils = require('./utils/utils.js')

// parse app specific globals
require('./dnd/constants.js');

global.DataFile = '/json/state.json'

var ui = require('./app/ui.js')

module.exports = {
    run: ui.run
}

