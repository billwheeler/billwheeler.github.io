"use strict";

var isNumeric = function (n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
};

var randomInt = function (min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

var randomChance = function (percentTrue) {
    percentTrue = percentTrue || 50;
    return randomInt(1, 100) <= percentTrue ? true : false;
};

var clamp = function (val, min, max) {
    if (val < min)
        return min;
    if (val > max)
        return max;
    return val;
};

module.exports = {
    clamp: clamp,
    isNumeric: isNumeric,
    randomInt: randomInt,
    randomChance: randomChance
};
