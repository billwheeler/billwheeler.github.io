'use strict'

module.exports = {
    isArray: (obj) => {
        return Object.prototype.toString.call(obj) === '[object Array]' ? true : false
    },

    arrayClone: (arr) => {
        return arr.slice(0)
    },

    isFunction: (obj) => {
        return typeof obj === 'function' ? true : false
    },

    storageAvailable: (type) => {
        try {
            var storage = window[type], x = '__storage_test__'
            storage.setItem(x, x)
            storage.removeItem(x)
            return true
        } catch (e) {
            return e instanceof DOMException && (e.code === 22 || e.code === 1014 || e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') && storage.length !== 0
        }
    }
};