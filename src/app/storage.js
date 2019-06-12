'use strict'

const axios = require('axios')
const storageKey = 'OssariaSessionTwo'

var save = (data) => { localStorage.setItem(storageKey, data) }

var fetchJson = (callback) => {
    axios.get(global.DataFile)
        .then(function (response) {
            save(JSON.stringify(response.data));
            callback.apply(this, [response.data]);
        })
        .catch(function (error) {
            Debug.warn(error)
        })
}

module.exports.pull = (callback) => {
    var fresh = false;

    if (Utils.isFunction(callback)) {
        var fromStorage = localStorage.getItem(storageKey);
        if (fromStorage) {
            callback.apply(this, [JSON.parse(fromStorage)]);
        } else {
            fetchJson(callback);
            fresh = true;
        }
    }

    return fresh;
}

module.exports.push = (data, callback) => {
    if (Utils.isFunction(callback)) {
        save(JSON.stringify(data));
        callback.apply(this);
    }
}

module.exports.reset = (callback) => {
    if (Utils.isFunction(callback)) {
        localStorage.removeItem(storageKey);
        callback.apply(this);
    }
}
