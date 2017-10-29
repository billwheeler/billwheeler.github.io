"use strict";

module.exports = {
    assert: console ? console.assert.bind(console) : function () { },
    clear: console ? console.clear.bind(console) : function () { },
    error: console ? console.error.bind(console) : function () { },
    group: console ? console.group.bind(console) : function () { },
    groupCollapsed: console ? console.groupCollapsed.bind(console) : function () { },
    groupEnd: console ? console.groupEnd.bind(console) : function () { },
    info: console ? console.info.bind(console) : function () { },
    log: console ? console.log.bind(console) : function () { },
    trace: console ? console.trace.bind(console) : function () { },
    warn: console ? console.warn.bind(console) : function () { },
};
