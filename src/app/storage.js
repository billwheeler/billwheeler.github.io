'use strict'

const axios = require('axios')
const storageKey = 'OssariaSessionFive'

var save = (data) => localStorage.setItem(storageKey, data)

var fetchJson = () => {
    return new Promise((resolve, reject) => {
        axios.get(global.DataFile)
            .then(function (response) {
                save(JSON.stringify(response.data));
                resolve([response.data, true])
            })
            .catch(function (error) {
                reject(error)
            })
    })
}

var pullInner = (raw) => {
    return new Promise((resolve, reject) => {
        try {
            resolve([JSON.parse(raw), false])
        } catch (err) {
            reject(err)
        }
    })
}

module.exports.pull = () => {
    var fromStorage = localStorage.getItem(storageKey);
    return fromStorage ?
        pullInner(fromStorage) :
        fetchJson()
}

module.exports.push = (data) => {
    return new Promise((resolve, reject) => {
        try {
            save(JSON.stringify(data))
            resolve()
        } catch (err) {
            reject(err)
        }
    })
}

module.exports.reset = () => {
    return new Promise((resolve, reject) => {
        try {
            localStorage.removeItem(storageKey)
            resolve()
        } catch (err) {
            reject(err)
        }
    })
}
