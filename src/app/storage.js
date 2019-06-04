"use strict";

const STORAGE_KEY = "OssariaPartOne";

var fetchJson = function (callback) {
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

var save = function (data) {
    localStorage.setItem(STORAGE_KEY, data);
};

var pull = function (callback) {
    if (!Utils.isFunction(callback))
        return;

    var fromStorage = localStorage.getItem(STORAGE_KEY);

    if (fromStorage) {
        callback.apply(this, [JSON.parse(fromStorage)]);
    } else {
        fetchJson(callback);
    }
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