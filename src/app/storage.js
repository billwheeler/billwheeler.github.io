"use strict";

var axios = require('axios')

const STORAGE_KEY = "OssariaSessionTwo";

var fetchJson = function (callback) {
    axios.get(global.DataFile)
        .then(function (response) {
            save(JSON.stringify(response.data));
            callback.apply(this, [response.data]);
        })
        .catch(function (error) {
            Debug.warn(error)
        })
}

var save = function (data) {
    localStorage.setItem(STORAGE_KEY, data);
};

var pull = function (callback) {
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

var push = function (data, callback) {
    if (!Utils.isFunction(callback))
        return;

    save(JSON.stringify(data));

    callback.apply(this);
};

var reset = function (callback) {
    if (!Utils.isFunction(callback))
        return;

    localStorage.removeItem(STORAGE_KEY);

    callback.apply(this);
};

module.exports = {
    pull: pull,
    push: push,
    reset: reset
};