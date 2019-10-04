(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.App = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
module.exports = require('./lib/axios');
},{"./lib/axios":3}],2:[function(require,module,exports){
'use strict';

var utils = require('./../utils');
var settle = require('./../core/settle');
var buildURL = require('./../helpers/buildURL');
var parseHeaders = require('./../helpers/parseHeaders');
var isURLSameOrigin = require('./../helpers/isURLSameOrigin');
var createError = require('../core/createError');

module.exports = function xhrAdapter(config) {
  return new Promise(function dispatchXhrRequest(resolve, reject) {
    var requestData = config.data;
    var requestHeaders = config.headers;

    if (utils.isFormData(requestData)) {
      delete requestHeaders['Content-Type']; // Let the browser set it
    }

    var request = new XMLHttpRequest();

    // HTTP basic authentication
    if (config.auth) {
      var username = config.auth.username || '';
      var password = config.auth.password || '';
      requestHeaders.Authorization = 'Basic ' + btoa(username + ':' + password);
    }

    request.open(config.method.toUpperCase(), buildURL(config.url, config.params, config.paramsSerializer), true);

    // Set the request timeout in MS
    request.timeout = config.timeout;

    // Listen for ready state
    request.onreadystatechange = function handleLoad() {
      if (!request || request.readyState !== 4) {
        return;
      }

      // The request errored out and we didn't get a response, this will be
      // handled by onerror instead
      // With one exception: request that using file: protocol, most browsers
      // will return status as 0 even though it's a successful request
      if (request.status === 0 && !(request.responseURL && request.responseURL.indexOf('file:') === 0)) {
        return;
      }

      // Prepare the response
      var responseHeaders = 'getAllResponseHeaders' in request ? parseHeaders(request.getAllResponseHeaders()) : null;
      var responseData = !config.responseType || config.responseType === 'text' ? request.responseText : request.response;
      var response = {
        data: responseData,
        status: request.status,
        statusText: request.statusText,
        headers: responseHeaders,
        config: config,
        request: request
      };

      settle(resolve, reject, response);

      // Clean up request
      request = null;
    };

    // Handle browser request cancellation (as opposed to a manual cancellation)
    request.onabort = function handleAbort() {
      if (!request) {
        return;
      }

      reject(createError('Request aborted', config, 'ECONNABORTED', request));

      // Clean up request
      request = null;
    };

    // Handle low level network errors
    request.onerror = function handleError() {
      // Real errors are hidden from us by the browser
      // onerror should only fire if it's a network error
      reject(createError('Network Error', config, null, request));

      // Clean up request
      request = null;
    };

    // Handle timeout
    request.ontimeout = function handleTimeout() {
      reject(createError('timeout of ' + config.timeout + 'ms exceeded', config, 'ECONNABORTED',
        request));

      // Clean up request
      request = null;
    };

    // Add xsrf header
    // This is only done if running in a standard browser environment.
    // Specifically not if we're in a web worker, or react-native.
    if (utils.isStandardBrowserEnv()) {
      var cookies = require('./../helpers/cookies');

      // Add xsrf header
      var xsrfValue = (config.withCredentials || isURLSameOrigin(config.url)) && config.xsrfCookieName ?
        cookies.read(config.xsrfCookieName) :
        undefined;

      if (xsrfValue) {
        requestHeaders[config.xsrfHeaderName] = xsrfValue;
      }
    }

    // Add headers to the request
    if ('setRequestHeader' in request) {
      utils.forEach(requestHeaders, function setRequestHeader(val, key) {
        if (typeof requestData === 'undefined' && key.toLowerCase() === 'content-type') {
          // Remove Content-Type if data is undefined
          delete requestHeaders[key];
        } else {
          // Otherwise add header to the request
          request.setRequestHeader(key, val);
        }
      });
    }

    // Add withCredentials to request if needed
    if (config.withCredentials) {
      request.withCredentials = true;
    }

    // Add responseType to request if needed
    if (config.responseType) {
      try {
        request.responseType = config.responseType;
      } catch (e) {
        // Expected DOMException thrown by browsers not compatible XMLHttpRequest Level 2.
        // But, this can be suppressed for 'json' type as it can be parsed by default 'transformResponse' function.
        if (config.responseType !== 'json') {
          throw e;
        }
      }
    }

    // Handle progress if needed
    if (typeof config.onDownloadProgress === 'function') {
      request.addEventListener('progress', config.onDownloadProgress);
    }

    // Not all browsers support upload events
    if (typeof config.onUploadProgress === 'function' && request.upload) {
      request.upload.addEventListener('progress', config.onUploadProgress);
    }

    if (config.cancelToken) {
      // Handle cancellation
      config.cancelToken.promise.then(function onCanceled(cancel) {
        if (!request) {
          return;
        }

        request.abort();
        reject(cancel);
        // Clean up request
        request = null;
      });
    }

    if (requestData === undefined) {
      requestData = null;
    }

    // Send the request
    request.send(requestData);
  });
};

},{"../core/createError":9,"./../core/settle":13,"./../helpers/buildURL":17,"./../helpers/cookies":19,"./../helpers/isURLSameOrigin":21,"./../helpers/parseHeaders":23,"./../utils":25}],3:[function(require,module,exports){
'use strict';

var utils = require('./utils');
var bind = require('./helpers/bind');
var Axios = require('./core/Axios');
var mergeConfig = require('./core/mergeConfig');
var defaults = require('./defaults');

/**
 * Create an instance of Axios
 *
 * @param {Object} defaultConfig The default config for the instance
 * @return {Axios} A new instance of Axios
 */
function createInstance(defaultConfig) {
  var context = new Axios(defaultConfig);
  var instance = bind(Axios.prototype.request, context);

  // Copy axios.prototype to instance
  utils.extend(instance, Axios.prototype, context);

  // Copy context to instance
  utils.extend(instance, context);

  return instance;
}

// Create the default instance to be exported
var axios = createInstance(defaults);

// Expose Axios class to allow class inheritance
axios.Axios = Axios;

// Factory for creating new instances
axios.create = function create(instanceConfig) {
  return createInstance(mergeConfig(axios.defaults, instanceConfig));
};

// Expose Cancel & CancelToken
axios.Cancel = require('./cancel/Cancel');
axios.CancelToken = require('./cancel/CancelToken');
axios.isCancel = require('./cancel/isCancel');

// Expose all/spread
axios.all = function all(promises) {
  return Promise.all(promises);
};
axios.spread = require('./helpers/spread');

module.exports = axios;

// Allow use of default import syntax in TypeScript
module.exports.default = axios;

},{"./cancel/Cancel":4,"./cancel/CancelToken":5,"./cancel/isCancel":6,"./core/Axios":7,"./core/mergeConfig":12,"./defaults":15,"./helpers/bind":16,"./helpers/spread":24,"./utils":25}],4:[function(require,module,exports){
'use strict';

/**
 * A `Cancel` is an object that is thrown when an operation is canceled.
 *
 * @class
 * @param {string=} message The message.
 */
function Cancel(message) {
  this.message = message;
}

Cancel.prototype.toString = function toString() {
  return 'Cancel' + (this.message ? ': ' + this.message : '');
};

Cancel.prototype.__CANCEL__ = true;

module.exports = Cancel;

},{}],5:[function(require,module,exports){
'use strict';

var Cancel = require('./Cancel');

/**
 * A `CancelToken` is an object that can be used to request cancellation of an operation.
 *
 * @class
 * @param {Function} executor The executor function.
 */
function CancelToken(executor) {
  if (typeof executor !== 'function') {
    throw new TypeError('executor must be a function.');
  }

  var resolvePromise;
  this.promise = new Promise(function promiseExecutor(resolve) {
    resolvePromise = resolve;
  });

  var token = this;
  executor(function cancel(message) {
    if (token.reason) {
      // Cancellation has already been requested
      return;
    }

    token.reason = new Cancel(message);
    resolvePromise(token.reason);
  });
}

/**
 * Throws a `Cancel` if cancellation has been requested.
 */
CancelToken.prototype.throwIfRequested = function throwIfRequested() {
  if (this.reason) {
    throw this.reason;
  }
};

/**
 * Returns an object that contains a new `CancelToken` and a function that, when called,
 * cancels the `CancelToken`.
 */
CancelToken.source = function source() {
  var cancel;
  var token = new CancelToken(function executor(c) {
    cancel = c;
  });
  return {
    token: token,
    cancel: cancel
  };
};

module.exports = CancelToken;

},{"./Cancel":4}],6:[function(require,module,exports){
'use strict';

module.exports = function isCancel(value) {
  return !!(value && value.__CANCEL__);
};

},{}],7:[function(require,module,exports){
'use strict';

var utils = require('./../utils');
var buildURL = require('../helpers/buildURL');
var InterceptorManager = require('./InterceptorManager');
var dispatchRequest = require('./dispatchRequest');
var mergeConfig = require('./mergeConfig');

/**
 * Create a new instance of Axios
 *
 * @param {Object} instanceConfig The default config for the instance
 */
function Axios(instanceConfig) {
  this.defaults = instanceConfig;
  this.interceptors = {
    request: new InterceptorManager(),
    response: new InterceptorManager()
  };
}

/**
 * Dispatch a request
 *
 * @param {Object} config The config specific for this request (merged with this.defaults)
 */
Axios.prototype.request = function request(config) {
  /*eslint no-param-reassign:0*/
  // Allow for axios('example/url'[, config]) a la fetch API
  if (typeof config === 'string') {
    config = arguments[1] || {};
    config.url = arguments[0];
  } else {
    config = config || {};
  }

  config = mergeConfig(this.defaults, config);
  config.method = config.method ? config.method.toLowerCase() : 'get';

  // Hook up interceptors middleware
  var chain = [dispatchRequest, undefined];
  var promise = Promise.resolve(config);

  this.interceptors.request.forEach(function unshiftRequestInterceptors(interceptor) {
    chain.unshift(interceptor.fulfilled, interceptor.rejected);
  });

  this.interceptors.response.forEach(function pushResponseInterceptors(interceptor) {
    chain.push(interceptor.fulfilled, interceptor.rejected);
  });

  while (chain.length) {
    promise = promise.then(chain.shift(), chain.shift());
  }

  return promise;
};

Axios.prototype.getUri = function getUri(config) {
  config = mergeConfig(this.defaults, config);
  return buildURL(config.url, config.params, config.paramsSerializer).replace(/^\?/, '');
};

// Provide aliases for supported request methods
utils.forEach(['delete', 'get', 'head', 'options'], function forEachMethodNoData(method) {
  /*eslint func-names:0*/
  Axios.prototype[method] = function(url, config) {
    return this.request(utils.merge(config || {}, {
      method: method,
      url: url
    }));
  };
});

utils.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
  /*eslint func-names:0*/
  Axios.prototype[method] = function(url, data, config) {
    return this.request(utils.merge(config || {}, {
      method: method,
      url: url,
      data: data
    }));
  };
});

module.exports = Axios;

},{"../helpers/buildURL":17,"./../utils":25,"./InterceptorManager":8,"./dispatchRequest":10,"./mergeConfig":12}],8:[function(require,module,exports){
'use strict';

var utils = require('./../utils');

function InterceptorManager() {
  this.handlers = [];
}

/**
 * Add a new interceptor to the stack
 *
 * @param {Function} fulfilled The function to handle `then` for a `Promise`
 * @param {Function} rejected The function to handle `reject` for a `Promise`
 *
 * @return {Number} An ID used to remove interceptor later
 */
InterceptorManager.prototype.use = function use(fulfilled, rejected) {
  this.handlers.push({
    fulfilled: fulfilled,
    rejected: rejected
  });
  return this.handlers.length - 1;
};

/**
 * Remove an interceptor from the stack
 *
 * @param {Number} id The ID that was returned by `use`
 */
InterceptorManager.prototype.eject = function eject(id) {
  if (this.handlers[id]) {
    this.handlers[id] = null;
  }
};

/**
 * Iterate over all the registered interceptors
 *
 * This method is particularly useful for skipping over any
 * interceptors that may have become `null` calling `eject`.
 *
 * @param {Function} fn The function to call for each interceptor
 */
InterceptorManager.prototype.forEach = function forEach(fn) {
  utils.forEach(this.handlers, function forEachHandler(h) {
    if (h !== null) {
      fn(h);
    }
  });
};

module.exports = InterceptorManager;

},{"./../utils":25}],9:[function(require,module,exports){
'use strict';

var enhanceError = require('./enhanceError');

/**
 * Create an Error with the specified message, config, error code, request and response.
 *
 * @param {string} message The error message.
 * @param {Object} config The config.
 * @param {string} [code] The error code (for example, 'ECONNABORTED').
 * @param {Object} [request] The request.
 * @param {Object} [response] The response.
 * @returns {Error} The created error.
 */
module.exports = function createError(message, config, code, request, response) {
  var error = new Error(message);
  return enhanceError(error, config, code, request, response);
};

},{"./enhanceError":11}],10:[function(require,module,exports){
'use strict';

var utils = require('./../utils');
var transformData = require('./transformData');
var isCancel = require('../cancel/isCancel');
var defaults = require('../defaults');
var isAbsoluteURL = require('./../helpers/isAbsoluteURL');
var combineURLs = require('./../helpers/combineURLs');

/**
 * Throws a `Cancel` if cancellation has been requested.
 */
function throwIfCancellationRequested(config) {
  if (config.cancelToken) {
    config.cancelToken.throwIfRequested();
  }
}

/**
 * Dispatch a request to the server using the configured adapter.
 *
 * @param {object} config The config that is to be used for the request
 * @returns {Promise} The Promise to be fulfilled
 */
module.exports = function dispatchRequest(config) {
  throwIfCancellationRequested(config);

  // Support baseURL config
  if (config.baseURL && !isAbsoluteURL(config.url)) {
    config.url = combineURLs(config.baseURL, config.url);
  }

  // Ensure headers exist
  config.headers = config.headers || {};

  // Transform request data
  config.data = transformData(
    config.data,
    config.headers,
    config.transformRequest
  );

  // Flatten headers
  config.headers = utils.merge(
    config.headers.common || {},
    config.headers[config.method] || {},
    config.headers || {}
  );

  utils.forEach(
    ['delete', 'get', 'head', 'post', 'put', 'patch', 'common'],
    function cleanHeaderConfig(method) {
      delete config.headers[method];
    }
  );

  var adapter = config.adapter || defaults.adapter;

  return adapter(config).then(function onAdapterResolution(response) {
    throwIfCancellationRequested(config);

    // Transform response data
    response.data = transformData(
      response.data,
      response.headers,
      config.transformResponse
    );

    return response;
  }, function onAdapterRejection(reason) {
    if (!isCancel(reason)) {
      throwIfCancellationRequested(config);

      // Transform response data
      if (reason && reason.response) {
        reason.response.data = transformData(
          reason.response.data,
          reason.response.headers,
          config.transformResponse
        );
      }
    }

    return Promise.reject(reason);
  });
};

},{"../cancel/isCancel":6,"../defaults":15,"./../helpers/combineURLs":18,"./../helpers/isAbsoluteURL":20,"./../utils":25,"./transformData":14}],11:[function(require,module,exports){
'use strict';

/**
 * Update an Error with the specified config, error code, and response.
 *
 * @param {Error} error The error to update.
 * @param {Object} config The config.
 * @param {string} [code] The error code (for example, 'ECONNABORTED').
 * @param {Object} [request] The request.
 * @param {Object} [response] The response.
 * @returns {Error} The error.
 */
module.exports = function enhanceError(error, config, code, request, response) {
  error.config = config;
  if (code) {
    error.code = code;
  }

  error.request = request;
  error.response = response;
  error.isAxiosError = true;

  error.toJSON = function() {
    return {
      // Standard
      message: this.message,
      name: this.name,
      // Microsoft
      description: this.description,
      number: this.number,
      // Mozilla
      fileName: this.fileName,
      lineNumber: this.lineNumber,
      columnNumber: this.columnNumber,
      stack: this.stack,
      // Axios
      config: this.config,
      code: this.code
    };
  };
  return error;
};

},{}],12:[function(require,module,exports){
'use strict';

var utils = require('../utils');

/**
 * Config-specific merge-function which creates a new config-object
 * by merging two configuration objects together.
 *
 * @param {Object} config1
 * @param {Object} config2
 * @returns {Object} New object resulting from merging config2 to config1
 */
module.exports = function mergeConfig(config1, config2) {
  // eslint-disable-next-line no-param-reassign
  config2 = config2 || {};
  var config = {};

  utils.forEach(['url', 'method', 'params', 'data'], function valueFromConfig2(prop) {
    if (typeof config2[prop] !== 'undefined') {
      config[prop] = config2[prop];
    }
  });

  utils.forEach(['headers', 'auth', 'proxy'], function mergeDeepProperties(prop) {
    if (utils.isObject(config2[prop])) {
      config[prop] = utils.deepMerge(config1[prop], config2[prop]);
    } else if (typeof config2[prop] !== 'undefined') {
      config[prop] = config2[prop];
    } else if (utils.isObject(config1[prop])) {
      config[prop] = utils.deepMerge(config1[prop]);
    } else if (typeof config1[prop] !== 'undefined') {
      config[prop] = config1[prop];
    }
  });

  utils.forEach([
    'baseURL', 'transformRequest', 'transformResponse', 'paramsSerializer',
    'timeout', 'withCredentials', 'adapter', 'responseType', 'xsrfCookieName',
    'xsrfHeaderName', 'onUploadProgress', 'onDownloadProgress', 'maxContentLength',
    'validateStatus', 'maxRedirects', 'httpAgent', 'httpsAgent', 'cancelToken',
    'socketPath'
  ], function defaultToConfig2(prop) {
    if (typeof config2[prop] !== 'undefined') {
      config[prop] = config2[prop];
    } else if (typeof config1[prop] !== 'undefined') {
      config[prop] = config1[prop];
    }
  });

  return config;
};

},{"../utils":25}],13:[function(require,module,exports){
'use strict';

var createError = require('./createError');

/**
 * Resolve or reject a Promise based on response status.
 *
 * @param {Function} resolve A function that resolves the promise.
 * @param {Function} reject A function that rejects the promise.
 * @param {object} response The response.
 */
module.exports = function settle(resolve, reject, response) {
  var validateStatus = response.config.validateStatus;
  if (!validateStatus || validateStatus(response.status)) {
    resolve(response);
  } else {
    reject(createError(
      'Request failed with status code ' + response.status,
      response.config,
      null,
      response.request,
      response
    ));
  }
};

},{"./createError":9}],14:[function(require,module,exports){
'use strict';

var utils = require('./../utils');

/**
 * Transform the data for a request or a response
 *
 * @param {Object|String} data The data to be transformed
 * @param {Array} headers The headers for the request or response
 * @param {Array|Function} fns A single function or Array of functions
 * @returns {*} The resulting transformed data
 */
module.exports = function transformData(data, headers, fns) {
  /*eslint no-param-reassign:0*/
  utils.forEach(fns, function transform(fn) {
    data = fn(data, headers);
  });

  return data;
};

},{"./../utils":25}],15:[function(require,module,exports){
(function (process){
'use strict';

var utils = require('./utils');
var normalizeHeaderName = require('./helpers/normalizeHeaderName');

var DEFAULT_CONTENT_TYPE = {
  'Content-Type': 'application/x-www-form-urlencoded'
};

function setContentTypeIfUnset(headers, value) {
  if (!utils.isUndefined(headers) && utils.isUndefined(headers['Content-Type'])) {
    headers['Content-Type'] = value;
  }
}

function getDefaultAdapter() {
  var adapter;
  // Only Node.JS has a process variable that is of [[Class]] process
  if (typeof process !== 'undefined' && Object.prototype.toString.call(process) === '[object process]') {
    // For node use HTTP adapter
    adapter = require('./adapters/http');
  } else if (typeof XMLHttpRequest !== 'undefined') {
    // For browsers use XHR adapter
    adapter = require('./adapters/xhr');
  }
  return adapter;
}

var defaults = {
  adapter: getDefaultAdapter(),

  transformRequest: [function transformRequest(data, headers) {
    normalizeHeaderName(headers, 'Accept');
    normalizeHeaderName(headers, 'Content-Type');
    if (utils.isFormData(data) ||
      utils.isArrayBuffer(data) ||
      utils.isBuffer(data) ||
      utils.isStream(data) ||
      utils.isFile(data) ||
      utils.isBlob(data)
    ) {
      return data;
    }
    if (utils.isArrayBufferView(data)) {
      return data.buffer;
    }
    if (utils.isURLSearchParams(data)) {
      setContentTypeIfUnset(headers, 'application/x-www-form-urlencoded;charset=utf-8');
      return data.toString();
    }
    if (utils.isObject(data)) {
      setContentTypeIfUnset(headers, 'application/json;charset=utf-8');
      return JSON.stringify(data);
    }
    return data;
  }],

  transformResponse: [function transformResponse(data) {
    /*eslint no-param-reassign:0*/
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (e) { /* Ignore */ }
    }
    return data;
  }],

  /**
   * A timeout in milliseconds to abort a request. If set to 0 (default) a
   * timeout is not created.
   */
  timeout: 0,

  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',

  maxContentLength: -1,

  validateStatus: function validateStatus(status) {
    return status >= 200 && status < 300;
  }
};

defaults.headers = {
  common: {
    'Accept': 'application/json, text/plain, */*'
  }
};

utils.forEach(['delete', 'get', 'head'], function forEachMethodNoData(method) {
  defaults.headers[method] = {};
});

utils.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
  defaults.headers[method] = utils.merge(DEFAULT_CONTENT_TYPE);
});

module.exports = defaults;

}).call(this,require('_process'))

},{"./adapters/http":2,"./adapters/xhr":2,"./helpers/normalizeHeaderName":22,"./utils":25,"_process":27}],16:[function(require,module,exports){
'use strict';

module.exports = function bind(fn, thisArg) {
  return function wrap() {
    var args = new Array(arguments.length);
    for (var i = 0; i < args.length; i++) {
      args[i] = arguments[i];
    }
    return fn.apply(thisArg, args);
  };
};

},{}],17:[function(require,module,exports){
'use strict';

var utils = require('./../utils');

function encode(val) {
  return encodeURIComponent(val).
    replace(/%40/gi, '@').
    replace(/%3A/gi, ':').
    replace(/%24/g, '$').
    replace(/%2C/gi, ',').
    replace(/%20/g, '+').
    replace(/%5B/gi, '[').
    replace(/%5D/gi, ']');
}

/**
 * Build a URL by appending params to the end
 *
 * @param {string} url The base of the url (e.g., http://www.google.com)
 * @param {object} [params] The params to be appended
 * @returns {string} The formatted url
 */
module.exports = function buildURL(url, params, paramsSerializer) {
  /*eslint no-param-reassign:0*/
  if (!params) {
    return url;
  }

  var serializedParams;
  if (paramsSerializer) {
    serializedParams = paramsSerializer(params);
  } else if (utils.isURLSearchParams(params)) {
    serializedParams = params.toString();
  } else {
    var parts = [];

    utils.forEach(params, function serialize(val, key) {
      if (val === null || typeof val === 'undefined') {
        return;
      }

      if (utils.isArray(val)) {
        key = key + '[]';
      } else {
        val = [val];
      }

      utils.forEach(val, function parseValue(v) {
        if (utils.isDate(v)) {
          v = v.toISOString();
        } else if (utils.isObject(v)) {
          v = JSON.stringify(v);
        }
        parts.push(encode(key) + '=' + encode(v));
      });
    });

    serializedParams = parts.join('&');
  }

  if (serializedParams) {
    var hashmarkIndex = url.indexOf('#');
    if (hashmarkIndex !== -1) {
      url = url.slice(0, hashmarkIndex);
    }

    url += (url.indexOf('?') === -1 ? '?' : '&') + serializedParams;
  }

  return url;
};

},{"./../utils":25}],18:[function(require,module,exports){
'use strict';

/**
 * Creates a new URL by combining the specified URLs
 *
 * @param {string} baseURL The base URL
 * @param {string} relativeURL The relative URL
 * @returns {string} The combined URL
 */
module.exports = function combineURLs(baseURL, relativeURL) {
  return relativeURL
    ? baseURL.replace(/\/+$/, '') + '/' + relativeURL.replace(/^\/+/, '')
    : baseURL;
};

},{}],19:[function(require,module,exports){
'use strict';

var utils = require('./../utils');

module.exports = (
  utils.isStandardBrowserEnv() ?

  // Standard browser envs support document.cookie
    (function standardBrowserEnv() {
      return {
        write: function write(name, value, expires, path, domain, secure) {
          var cookie = [];
          cookie.push(name + '=' + encodeURIComponent(value));

          if (utils.isNumber(expires)) {
            cookie.push('expires=' + new Date(expires).toGMTString());
          }

          if (utils.isString(path)) {
            cookie.push('path=' + path);
          }

          if (utils.isString(domain)) {
            cookie.push('domain=' + domain);
          }

          if (secure === true) {
            cookie.push('secure');
          }

          document.cookie = cookie.join('; ');
        },

        read: function read(name) {
          var match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
          return (match ? decodeURIComponent(match[3]) : null);
        },

        remove: function remove(name) {
          this.write(name, '', Date.now() - 86400000);
        }
      };
    })() :

  // Non standard browser env (web workers, react-native) lack needed support.
    (function nonStandardBrowserEnv() {
      return {
        write: function write() {},
        read: function read() { return null; },
        remove: function remove() {}
      };
    })()
);

},{"./../utils":25}],20:[function(require,module,exports){
'use strict';

/**
 * Determines whether the specified URL is absolute
 *
 * @param {string} url The URL to test
 * @returns {boolean} True if the specified URL is absolute, otherwise false
 */
module.exports = function isAbsoluteURL(url) {
  // A URL is considered absolute if it begins with "<scheme>://" or "//" (protocol-relative URL).
  // RFC 3986 defines scheme name as a sequence of characters beginning with a letter and followed
  // by any combination of letters, digits, plus, period, or hyphen.
  return /^([a-z][a-z\d\+\-\.]*:)?\/\//i.test(url);
};

},{}],21:[function(require,module,exports){
'use strict';

var utils = require('./../utils');

module.exports = (
  utils.isStandardBrowserEnv() ?

  // Standard browser envs have full support of the APIs needed to test
  // whether the request URL is of the same origin as current location.
    (function standardBrowserEnv() {
      var msie = /(msie|trident)/i.test(navigator.userAgent);
      var urlParsingNode = document.createElement('a');
      var originURL;

      /**
    * Parse a URL to discover it's components
    *
    * @param {String} url The URL to be parsed
    * @returns {Object}
    */
      function resolveURL(url) {
        var href = url;

        if (msie) {
        // IE needs attribute set twice to normalize properties
          urlParsingNode.setAttribute('href', href);
          href = urlParsingNode.href;
        }

        urlParsingNode.setAttribute('href', href);

        // urlParsingNode provides the UrlUtils interface - http://url.spec.whatwg.org/#urlutils
        return {
          href: urlParsingNode.href,
          protocol: urlParsingNode.protocol ? urlParsingNode.protocol.replace(/:$/, '') : '',
          host: urlParsingNode.host,
          search: urlParsingNode.search ? urlParsingNode.search.replace(/^\?/, '') : '',
          hash: urlParsingNode.hash ? urlParsingNode.hash.replace(/^#/, '') : '',
          hostname: urlParsingNode.hostname,
          port: urlParsingNode.port,
          pathname: (urlParsingNode.pathname.charAt(0) === '/') ?
            urlParsingNode.pathname :
            '/' + urlParsingNode.pathname
        };
      }

      originURL = resolveURL(window.location.href);

      /**
    * Determine if a URL shares the same origin as the current location
    *
    * @param {String} requestURL The URL to test
    * @returns {boolean} True if URL shares the same origin, otherwise false
    */
      return function isURLSameOrigin(requestURL) {
        var parsed = (utils.isString(requestURL)) ? resolveURL(requestURL) : requestURL;
        return (parsed.protocol === originURL.protocol &&
            parsed.host === originURL.host);
      };
    })() :

  // Non standard browser envs (web workers, react-native) lack needed support.
    (function nonStandardBrowserEnv() {
      return function isURLSameOrigin() {
        return true;
      };
    })()
);

},{"./../utils":25}],22:[function(require,module,exports){
'use strict';

var utils = require('../utils');

module.exports = function normalizeHeaderName(headers, normalizedName) {
  utils.forEach(headers, function processHeader(value, name) {
    if (name !== normalizedName && name.toUpperCase() === normalizedName.toUpperCase()) {
      headers[normalizedName] = value;
      delete headers[name];
    }
  });
};

},{"../utils":25}],23:[function(require,module,exports){
'use strict';

var utils = require('./../utils');

// Headers whose duplicates are ignored by node
// c.f. https://nodejs.org/api/http.html#http_message_headers
var ignoreDuplicateOf = [
  'age', 'authorization', 'content-length', 'content-type', 'etag',
  'expires', 'from', 'host', 'if-modified-since', 'if-unmodified-since',
  'last-modified', 'location', 'max-forwards', 'proxy-authorization',
  'referer', 'retry-after', 'user-agent'
];

/**
 * Parse headers into an object
 *
 * ```
 * Date: Wed, 27 Aug 2014 08:58:49 GMT
 * Content-Type: application/json
 * Connection: keep-alive
 * Transfer-Encoding: chunked
 * ```
 *
 * @param {String} headers Headers needing to be parsed
 * @returns {Object} Headers parsed into an object
 */
module.exports = function parseHeaders(headers) {
  var parsed = {};
  var key;
  var val;
  var i;

  if (!headers) { return parsed; }

  utils.forEach(headers.split('\n'), function parser(line) {
    i = line.indexOf(':');
    key = utils.trim(line.substr(0, i)).toLowerCase();
    val = utils.trim(line.substr(i + 1));

    if (key) {
      if (parsed[key] && ignoreDuplicateOf.indexOf(key) >= 0) {
        return;
      }
      if (key === 'set-cookie') {
        parsed[key] = (parsed[key] ? parsed[key] : []).concat([val]);
      } else {
        parsed[key] = parsed[key] ? parsed[key] + ', ' + val : val;
      }
    }
  });

  return parsed;
};

},{"./../utils":25}],24:[function(require,module,exports){
'use strict';

/**
 * Syntactic sugar for invoking a function and expanding an array for arguments.
 *
 * Common use case would be to use `Function.prototype.apply`.
 *
 *  ```js
 *  function f(x, y, z) {}
 *  var args = [1, 2, 3];
 *  f.apply(null, args);
 *  ```
 *
 * With `spread` this example can be re-written.
 *
 *  ```js
 *  spread(function(x, y, z) {})([1, 2, 3]);
 *  ```
 *
 * @param {Function} callback
 * @returns {Function}
 */
module.exports = function spread(callback) {
  return function wrap(arr) {
    return callback.apply(null, arr);
  };
};

},{}],25:[function(require,module,exports){
'use strict';

var bind = require('./helpers/bind');
var isBuffer = require('is-buffer');

/*global toString:true*/

// utils is a library of generic helper functions non-specific to axios

var toString = Object.prototype.toString;

/**
 * Determine if a value is an Array
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is an Array, otherwise false
 */
function isArray(val) {
  return toString.call(val) === '[object Array]';
}

/**
 * Determine if a value is an ArrayBuffer
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is an ArrayBuffer, otherwise false
 */
function isArrayBuffer(val) {
  return toString.call(val) === '[object ArrayBuffer]';
}

/**
 * Determine if a value is a FormData
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is an FormData, otherwise false
 */
function isFormData(val) {
  return (typeof FormData !== 'undefined') && (val instanceof FormData);
}

/**
 * Determine if a value is a view on an ArrayBuffer
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a view on an ArrayBuffer, otherwise false
 */
function isArrayBufferView(val) {
  var result;
  if ((typeof ArrayBuffer !== 'undefined') && (ArrayBuffer.isView)) {
    result = ArrayBuffer.isView(val);
  } else {
    result = (val) && (val.buffer) && (val.buffer instanceof ArrayBuffer);
  }
  return result;
}

/**
 * Determine if a value is a String
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a String, otherwise false
 */
function isString(val) {
  return typeof val === 'string';
}

/**
 * Determine if a value is a Number
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Number, otherwise false
 */
function isNumber(val) {
  return typeof val === 'number';
}

/**
 * Determine if a value is undefined
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if the value is undefined, otherwise false
 */
function isUndefined(val) {
  return typeof val === 'undefined';
}

/**
 * Determine if a value is an Object
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is an Object, otherwise false
 */
function isObject(val) {
  return val !== null && typeof val === 'object';
}

/**
 * Determine if a value is a Date
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Date, otherwise false
 */
function isDate(val) {
  return toString.call(val) === '[object Date]';
}

/**
 * Determine if a value is a File
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a File, otherwise false
 */
function isFile(val) {
  return toString.call(val) === '[object File]';
}

/**
 * Determine if a value is a Blob
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Blob, otherwise false
 */
function isBlob(val) {
  return toString.call(val) === '[object Blob]';
}

/**
 * Determine if a value is a Function
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Function, otherwise false
 */
function isFunction(val) {
  return toString.call(val) === '[object Function]';
}

/**
 * Determine if a value is a Stream
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Stream, otherwise false
 */
function isStream(val) {
  return isObject(val) && isFunction(val.pipe);
}

/**
 * Determine if a value is a URLSearchParams object
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a URLSearchParams object, otherwise false
 */
function isURLSearchParams(val) {
  return typeof URLSearchParams !== 'undefined' && val instanceof URLSearchParams;
}

/**
 * Trim excess whitespace off the beginning and end of a string
 *
 * @param {String} str The String to trim
 * @returns {String} The String freed of excess whitespace
 */
function trim(str) {
  return str.replace(/^\s*/, '').replace(/\s*$/, '');
}

/**
 * Determine if we're running in a standard browser environment
 *
 * This allows axios to run in a web worker, and react-native.
 * Both environments support XMLHttpRequest, but not fully standard globals.
 *
 * web workers:
 *  typeof window -> undefined
 *  typeof document -> undefined
 *
 * react-native:
 *  navigator.product -> 'ReactNative'
 * nativescript
 *  navigator.product -> 'NativeScript' or 'NS'
 */
function isStandardBrowserEnv() {
  if (typeof navigator !== 'undefined' && (navigator.product === 'ReactNative' ||
                                           navigator.product === 'NativeScript' ||
                                           navigator.product === 'NS')) {
    return false;
  }
  return (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined'
  );
}

/**
 * Iterate over an Array or an Object invoking a function for each item.
 *
 * If `obj` is an Array callback will be called passing
 * the value, index, and complete array for each item.
 *
 * If 'obj' is an Object callback will be called passing
 * the value, key, and complete object for each property.
 *
 * @param {Object|Array} obj The object to iterate
 * @param {Function} fn The callback to invoke for each item
 */
function forEach(obj, fn) {
  // Don't bother if no value provided
  if (obj === null || typeof obj === 'undefined') {
    return;
  }

  // Force an array if not already something iterable
  if (typeof obj !== 'object') {
    /*eslint no-param-reassign:0*/
    obj = [obj];
  }

  if (isArray(obj)) {
    // Iterate over array values
    for (var i = 0, l = obj.length; i < l; i++) {
      fn.call(null, obj[i], i, obj);
    }
  } else {
    // Iterate over object keys
    for (var key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        fn.call(null, obj[key], key, obj);
      }
    }
  }
}

/**
 * Accepts varargs expecting each argument to be an object, then
 * immutably merges the properties of each object and returns result.
 *
 * When multiple objects contain the same key the later object in
 * the arguments list will take precedence.
 *
 * Example:
 *
 * ```js
 * var result = merge({foo: 123}, {foo: 456});
 * console.log(result.foo); // outputs 456
 * ```
 *
 * @param {Object} obj1 Object to merge
 * @returns {Object} Result of all merge properties
 */
function merge(/* obj1, obj2, obj3, ... */) {
  var result = {};
  function assignValue(val, key) {
    if (typeof result[key] === 'object' && typeof val === 'object') {
      result[key] = merge(result[key], val);
    } else {
      result[key] = val;
    }
  }

  for (var i = 0, l = arguments.length; i < l; i++) {
    forEach(arguments[i], assignValue);
  }
  return result;
}

/**
 * Function equal to merge with the difference being that no reference
 * to original objects is kept.
 *
 * @see merge
 * @param {Object} obj1 Object to merge
 * @returns {Object} Result of all merge properties
 */
function deepMerge(/* obj1, obj2, obj3, ... */) {
  var result = {};
  function assignValue(val, key) {
    if (typeof result[key] === 'object' && typeof val === 'object') {
      result[key] = deepMerge(result[key], val);
    } else if (typeof val === 'object') {
      result[key] = deepMerge({}, val);
    } else {
      result[key] = val;
    }
  }

  for (var i = 0, l = arguments.length; i < l; i++) {
    forEach(arguments[i], assignValue);
  }
  return result;
}

/**
 * Extends object a by mutably adding to it the properties of object b.
 *
 * @param {Object} a The object to be extended
 * @param {Object} b The object to copy properties from
 * @param {Object} thisArg The object to bind function to
 * @return {Object} The resulting value of object a
 */
function extend(a, b, thisArg) {
  forEach(b, function assignValue(val, key) {
    if (thisArg && typeof val === 'function') {
      a[key] = bind(val, thisArg);
    } else {
      a[key] = val;
    }
  });
  return a;
}

module.exports = {
  isArray: isArray,
  isArrayBuffer: isArrayBuffer,
  isBuffer: isBuffer,
  isFormData: isFormData,
  isArrayBufferView: isArrayBufferView,
  isString: isString,
  isNumber: isNumber,
  isObject: isObject,
  isUndefined: isUndefined,
  isDate: isDate,
  isFile: isFile,
  isBlob: isBlob,
  isFunction: isFunction,
  isStream: isStream,
  isURLSearchParams: isURLSearchParams,
  isStandardBrowserEnv: isStandardBrowserEnv,
  forEach: forEach,
  merge: merge,
  deepMerge: deepMerge,
  extend: extend,
  trim: trim
};

},{"./helpers/bind":16,"is-buffer":26}],26:[function(require,module,exports){
/*!
 * Determine if an object is a Buffer
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */

module.exports = function isBuffer (obj) {
  return obj != null && obj.constructor != null &&
    typeof obj.constructor.isBuffer === 'function' && obj.constructor.isBuffer(obj)
}

},{}],27:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],28:[function(require,module,exports){
'use strict';

var Player = require('../dnd/player.js');

var Npc = require('../dnd/npc.js');

var players = [];
var npcs = [];
var lastId = 0;

var playerById = function playerById(id) {
  var player = null;

  if (Utils.isNumeric(id)) {
    player = players.filter(function (a) {
      return a.id === id;
    });
    if (player.length > 0) return player[0];
  }

  return player;
};

var npcById = function npcById(id) {
  var npc = null;

  if (Utils.isNumeric(id)) {
    npc = npcs.filter(function (a) {
      return a.id === id;
    });
    if (npc.length > 0) return npc[0];
  }

  return npc;
};

var addNpc = function addNpc(npc) {
  if (typeof npc.id !== 'number' || npc.id === 0) {
    lastId++;
    npc.id = lastId;
  }

  if (npc.companion) npc.companion.id = npc.id;
  npcs.push(npc);
};

module.exports.pull = function (data, fresh) {
  players.length = 0;
  npcs.length = 0;

  for (var i = 0, l = data.players.length; i < l; i++) {
    if (typeof data.players[i].id !== 'number') {
      lastId++;
      data.players[i].id = lastId;
    }

    var p = new Player();
    p.parse(data.players[i]);
    players.push(p);
  }

  for (var i = 0, l = data.npcs.length; i < l; i++) {
    if (typeof data.npcs[i].id !== 'number') {
      lastId++;
      data.npcs[i].id = lastId;
    }

    var n = new Npc();
    n.parse(data.npcs[i]);

    if (typeof data.npcs[i].companion !== "undefined") {
      n.companion.id = data.npcs[i].id;
    }

    npcs.push(n);
  }

  if (fresh) push();
};

var push = function push() {
  var out = {
    npcs: [],
    players: []
  };

  for (var i = 0, l = npcs.length; i < l; i++) {
    out.npcs.push(npcs[i].serialize());
  }

  for (var i = 0, l = players.length; i < l; i++) {
    out.players.push(players[i].serialize());
  }

  return out;
};

module.exports.push = push;

module.exports.reset = function () {};

module.exports.charsByState = function (curState, callback) {
  if (Utils.isFunction(callback)) {
    var output = [];

    for (var i = 0, l = players.length; i < l; i++) {
      if (players[i].state === curState) output.push(players[i]);
    }

    for (var i = 0, l = npcs.length; i < l; i++) {
      if (npcs[i].state === curState) output.push(npcs[i]);
    } // if in an encounter, sort by initiative order


    if (curState === CharacterState.Encounter) {
      output.sort(function (a, b) {
        return b.initiative - a.initiative;
      });
    }

    for (var i = 0, l = output.length; i < l; i++) {
      callback.call(output[i]);
    }
  }
};

module.exports.updatePlayer = function (id, action, params) {
  var player = playerById(id);
  if (!player) return;

  switch (action) {
    case CharacterAction.Initiative:
      player.applyInitiative(params[0]);
      break;

    case CharacterAction.Leave:
      player.leaveEncounter();
      break;

    case CharacterAction.Revive:
      player.revive();
      break;

    case CharacterAction.Die:
      player.die();
      break;
  }
};

module.exports.updateNpc = function (id, action, params) {
  var currentNpc = npcById(id);
  if (!currentNpc) return;

  switch (action) {
    case CharacterAction.Damage:
      currentNpc.applyDamage(params[0]);
      break;

    case CharacterAction.Initiative:
      if (currentNpc.template) {
        var n = currentNpc.clone();
        addNpc(n);
        currentNpc = n;
      }

      currentNpc.rollInitiative();
      break;

    case CharacterAction.Leave:
      currentNpc.leaveEncounter();
      break;

    case CharacterAction.Revive:
      currentNpc.revive();
      break;

    case CharacterAction.Die:
      currentNpc.die();
      break;
  }
};

module.exports.updateCompanion = function (id, action, params) {
  var currentNpc = npcById(id);
  if (!currentNpc) return;

  switch (action) {
    case CharacterAction.Damage:
      currentNpc.companion.applyDamage(params[0]);
      break;

    case CharacterAction.Revive:
      currentNpc.companion.revive();
      break;

    case CharacterAction.Die:
      currentNpc.companion.die();
      break;
  }
};

},{"../dnd/npc.js":34,"../dnd/player.js":35}],29:[function(require,module,exports){
(function (global){
'use strict';

var axios = require('axios');

var storageKey = 'OssariaSessionSeven';

var save = function save(data) {
  return localStorage.setItem(storageKey, data);
};

var fetchJson = function fetchJson() {
  return new Promise(function (resolve, reject) {
    axios.get(global.DataFile).then(function (response) {
      save(JSON.stringify(response.data));
      resolve([response.data, true]);
    })["catch"](function (error) {
      reject(error);
    });
  });
};

var pullInner = function pullInner(raw) {
  return new Promise(function (resolve, reject) {
    try {
      resolve([JSON.parse(raw), false]);
    } catch (err) {
      reject(err);
    }
  });
};

module.exports.pull = function () {
  var fromStorage = localStorage.getItem(storageKey);
  return fromStorage ? pullInner(fromStorage) : fetchJson();
};

module.exports.push = function (data) {
  return new Promise(function (resolve, reject) {
    try {
      save(JSON.stringify(data));
      resolve();
    } catch (err) {
      reject(err);
    }
  });
};

module.exports.reset = function () {
  return new Promise(function (resolve, reject) {
    try {
      localStorage.removeItem(storageKey);
      resolve();
    } catch (err) {
      reject(err);
    }
  });
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"axios":1}],30:[function(require,module,exports){
'use strict';

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance"); }

function _iterableToArrayLimit(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

var Entities = require('./entities.js');

var Storage = require('./storage.js');

var active = document.getElementById('active');
var inactive = document.getElementById('inactive');
var deadguys = document.getElementById('deadguys');

var update = function update() {
  Storage.push(Entities.push()).then(function () {
    render();
  });
};

var render = function render() {
  active.innerHTML = '';
  inactive.innerHTML = '';
  deadguys.innerHTML = '';
  Entities.charsByState(CharacterState.Encounter, function () {
    var row = document.createElement('tr');
    var cell = document.createElement('td');
    cell.innerHTML = this.render();
    row.appendChild(cell);
    active.appendChild(row);
  });
  Entities.charsByState(CharacterState.Idle, function () {
    var row = document.createElement('tr');
    var cell = document.createElement('td');
    cell.innerHTML = this.render();
    row.appendChild(cell);
    inactive.appendChild(row);
  });
  Entities.charsByState(CharacterState.Dead, function () {
    var row = document.createElement('tr');
    var cell = document.createElement('td');
    cell.innerHTML = this.render();
    row.appendChild(cell);
    deadguys.appendChild(row);
  });
};

var addListener = function addListener() {
  document.addEventListener('click', function (e) {
    if (e.target) {
      var doUpdate = true;
      var id = parseInt(e.target.getAttribute('data-id'));

      switch (e.target.className) {
        case 'hard_reset':
          doUpdate = false;

          if (confirm('Are you sure? This cannot be undone.')) {
            var cell = document.getElementById('main-content');
            Storage.reset().then(function () {
              Entities.reset();
              cell.innerHTML = 'resetting up in here';
              setTimeout(function () {
                return window.location.reload();
              }, 600);
            });
          }

          break;

        case 'player_initiative':
          var initiative = parseInt(document.getElementById('player_initiative_' + id).value);
          Entities.updatePlayer(id, CharacterAction.Initiative, [initiative]);
          break;

        case 'player_leave':
          Entities.updatePlayer(id, CharacterAction.Leave);
          break;

        case 'player_revive':
          Entities.updatePlayer(id, CharacterAction.Revive);
          break;

        case 'player_die':
          Entities.updatePlayer(id, CharacterAction.Die);
          break;

        case 'npc_initiative':
          Entities.updateNpc(id, CharacterAction.Initiative);
          break;

        case 'npc_damage':
          var damage = parseInt(document.getElementById('npc_damage_' + id).value);
          Entities.updateNpc(id, CharacterAction.Damage, [damage]);
          break;

        case 'npc_leave':
          Entities.updateNpc(id, CharacterAction.Leave);
          break;

        case 'npc_revive':
          Entities.updateNpc(id, CharacterAction.Revive);
          break;

        case 'npc_die':
          Entities.updateNpc(id, CharacterAction.Die);
          break;

        case 'companion_damage':
          var damage = parseInt(document.getElementById('companion_damage_' + id).value);
          Entities.updateCompanion(id, CharacterAction.Damage, [damage]);
          break;

        case 'companion_revive':
          Entities.updateCompanion(id, CharacterAction.Revive);
          break;

        case 'companion_die':
          Entities.updateCompanion(id, CharacterAction.Die);
          break;

        default:
          doUpdate = false;
          break;
      }

      if (doUpdate) update();
    }
  });
};

var run = function run() {
  addListener();
  Storage.pull().then(function (_ref) {
    var _ref2 = _slicedToArray(_ref, 2),
        data = _ref2[0],
        fresh = _ref2[1];

    Entities.pull(data, fresh);
    render();
  });
};

module.exports = {
  run: run
};

},{"./entities.js":28,"./storage.js":29}],31:[function(require,module,exports){
'use strict';

var Weapon = require('./weapon.js');

var companion = function companion() {
  this.id = 0;
  this.name = '';
  this.health = 5;
  this.armor = 10;
  this.speed = 15;
  this.race = 'Wolf';
  this.weapons = [];
  this.state = CharacterState.Idle;
  this.link = '';
};

companion.prototype.parse = function (json) {
  if (!json) return;

  if (json.name) {
    this.name = json.name;
  }

  if (json.health && Utils.isNumeric(json.health)) {
    this.health = json.health;
  }

  if (json.armor && Utils.isNumeric(json.armor)) {
    this.armor = json.armor;
  }

  if (json.speed && Utils.isNumeric(json.speed)) {
    this.speed = json.speed;
  }

  if (json.race) {
    this.race = json.race;
  }

  if (json.state) {
    this.state = json.state;
  }

  if (json.weapons && Utils.isArray(json.weapons)) {
    for (var i = 0, l = json.weapons.length; i < l; i++) {
      var w = new Weapon();
      w.parse(json.weapons[i]);
      this.weapons.push(w);
    }
  }

  if (json.link) {
    this.link = json.link;
  }
};

companion.prototype.serialize = function () {
  var weapons = [];

  for (var i = 0, l = this.weapons.length; i < l; i++) {
    weapons.push(this.weapons[i].serialize());
  }

  return {
    id: this.id,
    name: this.name,
    health: this.health,
    armor: this.armor,
    speed: this.speed,
    race: this.race,
    weapons: weapons,
    state: this.state,
    link: this.link
  };
};

companion.prototype.render = function () {
  var out = '<div class="companion">';
  out += '<div><span class="bold">' + this.name + '</span>, <span class="italic">' + this.race + '</span>. Speed: ' + this.speed + '</div>';
  out += '<div>Health: <span class="bold">' + this.health + '</span>, AC: <span class="bold">' + this.armor + '</span></div>';

  for (var i = 0, l = this.weapons.length; i < l; i++) {
    out += '<div>' + this.weapons[i].render() + '</div>';
  }

  if (this.state === CharacterState.Encounter) {
    out += '<div><input type="button" class="companion_damage" value="Apply Damage" data-id="' + this.id + '" /><input type="text" id="companion_damage_' + this.id + '" /></div>';
    out += '<div style="margin-top: 4px;">';
    out += '<input type="button" class="companion_die" value="Die" data-id="' + this.id + '" />';
    out += '</div>';
  } else if (this.state === CharacterState.Idle) {
    out += '<div>';
    out += '<input type="button" class="companion_die" value="Die" data-id="' + this.id + '" />';
    out += '</div>';
  } else if (this.state === CharacterState.Dead) {
    out += '<div><input type="button" class="companion_revive" value="Revive NPC" data-id="' + this.id + '" /></div>';
  }

  if (this.link) out += '<div><a href="' + this.link + '" target="_blank">D&D Beyond</a></div>';
  out += '</div>';
  return out;
};

companion.prototype.applyDamage = function (damage) {
  this.health -= damage;

  if (this.health <= 0) {
    this.health = 0;
    this.state = CharacterState.Dead;
  }
};

companion.prototype.revive = function () {
  this.health = 1;
  this.state = CharacterState.Encounter;
};

companion.prototype.die = function () {
  this.health = 0;
  this.state = CharacterState.Dead;
};

companion.prototype.clone = function () {
  var c = new companion();
  c.name = this.name;
  c.health = this.health;
  c.armor = this.armor;
  c.speed = this.speed;
  c.race = this.race;
  c.weapons = Utils.arrayClone(this.weapons);
  c.link = this.link;
  return c;
};

module.exports = companion;

},{"./weapon.js":37}],32:[function(require,module,exports){
(function (global){
'use strict';

global.CharacterState = {
  Dead: 'dead',
  Idle: 'alive',
  Encounter: 'encounter'
};
global.CharacterAction = {
  Damage: 'damage',
  Die: 'die',
  Initiative: 'initiative',
  Leave: 'leave',
  Revive: 'revive'
};
global.DamageType = {
  Acid: 'acid',
  Bludgeoning: 'bludgeoning',
  Cold: 'cold',
  Fire: 'fire',
  Force: 'force',
  Lightning: 'lightning',
  Necrotic: 'necrotic',
  Piercing: 'piercing',
  Poison: 'poison',
  Psychic: 'psychic',
  Radiant: 'radiant',
  Slashing: 'slashing',
  Thunder: 'thunder'
};
module.exports = null;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],33:[function(require,module,exports){
'use strict';

module.exports = {
  d4: function d4() {
    return Utils.randomInt(1, 4);
  },
  d6: function d6() {
    return Utils.randomInt(1, 6);
  },
  d8: function d8() {
    return Utils.randomInt(1, 8);
  },
  d10: function d10() {
    return Utils.randomInt(1, 10);
  },
  d12: function d12() {
    return Utils.randomInt(1, 12);
  },
  d20: function d20() {
    return Utils.randomInt(1, 20);
  },
  d100: function d100() {
    return Utils.randomInt(1, 100);
  }
};

},{}],34:[function(require,module,exports){
'use strict';

var Weapon = require('./weapon.js');

var Spell = require('./spell.js');

var roll = require('../dnd/dice.js');

var Companion = require('./companion.js');

var npc = function npc() {
  this.id = 0;
  this.name = '';
  this.health = 5;
  this.armor = 10;
  this.speed = 15;
  this.race = 'Human';
  this.initiative = 0;
  this.weapons = [];
  this.spells = [];
  this.state = CharacterState.Idle;
  this.link = '';
  this.initMod = 0;
  this.template = false;
  this.instance = 0;
  this.companion = null;
};

npc.prototype.parse = function (json) {
  if (!json) return;

  if (json.id && Utils.isNumeric(json.id)) {
    this.id = json.id;
  }

  if (json.name) {
    this.name = json.name;
  }

  if (json.health && Utils.isNumeric(json.health)) {
    this.health = json.health;
  }

  if (json.armor && Utils.isNumeric(json.armor)) {
    this.armor = json.armor;
  }

  if (json.speed && Utils.isNumeric(json.speed)) {
    this.speed = json.speed;
  }

  if (json.race) {
    this.race = json.race;
  }

  if (json.initiative && Utils.isNumeric(json.initiative)) {
    this.initiative = json.initiative;
  }

  if (json.state) {
    this.state = json.state;
  }

  if (json.weapons && Utils.isArray(json.weapons)) {
    for (var i = 0, l = json.weapons.length; i < l; i++) {
      var w = new Weapon();
      w.parse(json.weapons[i]);
      this.weapons.push(w);
    }
  }

  if (json.spells && Utils.isArray(json.spells)) {
    for (var i = 0, l = json.spells.length; i < l; i++) {
      var s = new Spell();
      s.parse(json.spells[i]);
      this.spells.push(s);
    }
  }

  if (json.link) {
    this.link = json.link;
  }

  if (json.template) {
    this.template = json.template;
  }

  if (json.initMod && Utils.isNumeric(json.initMod)) {
    this.initMod = json.initMod;
  }

  if (json.companion) {
    var c = new Companion();
    c.parse(json.companion);
    this.companion = c;
  }
};

npc.prototype.serialize = function () {
  var weapons = [];

  for (var i = 0, l = this.weapons.length; i < l; i++) {
    weapons.push(this.weapons[i].serialize());
  }

  var spells = [];

  for (var i = 0, l = this.spells.length; i < l; i++) {
    spells.push(this.spells[i].serialize());
  }

  var out = {
    id: this.id,
    name: this.name,
    health: this.health,
    armor: this.armor,
    speed: this.speed,
    race: this.race,
    initiative: this.initiative,
    weapons: weapons,
    spells: spells,
    state: this.state,
    link: this.link,
    initMod: this.initMod,
    template: this.template,
    instance: this.instance
  };
  if (this.companion) out['companion'] = this.companion.serialize();
  return out;
};

npc.prototype.render = function () {
  var out = '<div class="ent npc" data-id="' + this.id + '">';
  out += '<div><span class="bold">' + this.name + '</span>, <span class="italic">' + this.race + '</span>. Speed: ' + this.speed + '</div>';
  var initiative = '';
  if (this.state === CharacterState.Encounter) initiative = ' (' + (this.health > 0 ? 'alive' : 'dead') + '), Initiative: <span class="bold">' + this.initiative + '</span>';
  out += '<div>Health: <span class="bold">' + this.health + '</span>, AC: <span class="bold">' + this.armor + '</span>' + initiative + '</div>';

  for (var i = 0, l = this.weapons.length; i < l; i++) {
    out += '<div>' + this.weapons[i].render() + '</div>';
  }

  for (var i = 0, l = this.spells.length; i < l; i++) {
    out += '<div>' + this.spells[i].render() + '</div>';
  }

  if (this.state === CharacterState.Encounter) {
    out += '<div><input type="button" class="npc_damage" value="Apply Damage" data-id="' + this.id + '" /><input type="text" id="npc_damage_' + this.id + '" /></div>';
    out += '<div style="margin-top: 4px;">';
    out += '<input type="button" class="npc_leave" value="Leave Encounter" data-id="' + this.id + '" />&nbsp;';
    out += '<input type="button" class="npc_die" value="Die" data-id="' + this.id + '" />';
    out += '</div>';
  } else if (this.state === CharacterState.Idle) {
    out += '<div>';
    out += '<input type="button" class="npc_initiative" value="Roll Initiative" data-id="' + this.id + '" />';
    if (!this.template) out += '&nbsp;<input type="button" class="npc_die" value="Die" data-id="' + this.id + '" />';
    out += '</div>';
  } else if (this.state === CharacterState.Dead) {
    out += '<div><input type="button" class="npc_revive" value="Revive NPC" data-id="' + this.id + '" /></div>';
  }

  if (this.link) out += '<div><a href="' + this.link + '" target="_blank">D&D Beyond</a></div>';
  if (this.companion) out += this.companion.render();
  out += '</div>';
  return out;
};

npc.prototype.rollInitiative = function () {
  this.state = CharacterState.Encounter;
  this.initiative = roll.d20() + this.initMod;

  if (this.companion && this.companion.state !== CharacterState.Dead) {
    this.companion.state = CharacterState.Encounter;
  }
};

npc.prototype.applyDamage = function (damage) {
  this.health -= damage;

  if (this.health <= 0) {
    this.health = 0;
    this.state = CharacterState.Dead;
  }
};

npc.prototype.revive = function () {
  this.health = 1;
  this.state = CharacterState.Encounter;
};

npc.prototype.leaveEncounter = function () {
  this.initiative = 0;
  this.state = CharacterState.Idle;

  if (this.companion && this.companion.state !== CharacterState.Dead) {
    this.companion.state = CharacterState.Idle;
  }
};

npc.prototype.die = function () {
  this.health = 0;
  this.state = CharacterState.Dead;
};

npc.prototype.clone = function () {
  var n = new npc();
  this.instance++;
  n.name = this.name + ' #' + this.instance;
  n.health = this.health;
  n.armor = this.armor;
  n.speed = this.speed;
  n.race = this.race;
  n.weapons = Utils.arrayClone(this.weapons);
  n.spells = Utils.arrayClone(this.spells);
  n.link = this.link;
  n.initMod = this.initMod;
  if (this.companion) n.companion = this.companion.clone();
  return n;
};

module.exports = npc;

},{"../dnd/dice.js":33,"./companion.js":31,"./spell.js":36,"./weapon.js":37}],35:[function(require,module,exports){
'use strict';

var player = function player() {
  this.id = 0;
  this.name = '';
  this.player = '';
  this.initiative = 0;
  this.state = CharacterState.Idle;
  this.exhaustion = 0;
  this.link = '';
};

player.prototype.parse = function (json) {
  if (!json) return;

  if (json.id && Utils.isNumeric(json.id)) {
    this.id = json.id;
  }

  if (json.name) {
    this.name = json.name;
  }

  if (json.player) {
    this.player = json.player;
  }

  if (json.initiative && Utils.isNumeric(json.initiative)) {
    this.initiative = json.initiative;
  }

  if (json.state) {
    this.state = json.state;
  }

  if (json.exhaustion && Utils.isNumeric(json.exhaustion)) {
    this.exhaustion = Utils.clamp(json.exhaustion, 1, 6);
    if (this.exhaustion == 6) this.state = CharacterState.Dead;
  }

  if (json.link) {
    this.link = json.link;
  }
};

player.prototype.serialize = function () {
  return {
    id: this.id,
    name: this.name,
    player: this.player,
    initiative: this.initiative,
    state: this.state,
    exhaustion: this.exhaustion,
    link: this.link
  };
};

player.prototype.render = function () {
  var out = '<div class="ent player" data-id="' + this.id + '">';
  out += '<div><span class="bold">' + this.name + '</span> <span class="italics">' + this.player + '</span></div>';

  if (this.state === CharacterState.Encounter) {
    out += '<div>Initiative: <span class="bold">' + this.initiative + '</span></div>';
    out += '<div>';
    out += '<input type="button" class="player_leave" value="Leave Encounter" data-id="' + this.id + '" style="margin-right:5px" />';
    out += '<input type="button" class="player_die" value="Die" data-id="' + this.id + '" />';
    out += '</div>';
  } else if (this.state === CharacterState.Idle) {
    out += '<div>';
    out += '<input type="button" class="player_initiative" value="Apply Initiatve" data-id="' + this.id + '" /><input type="text" id="player_initiative_' + this.id + '" />';
    out += '<input type="button" class="player_die" value="Die" data-id="' + this.id + '" />';
    out += '</div>';
  } else if (this.state === CharacterState.Dead) {
    out += '<div><input type="button" class="player_revive" value="Revive Player" data-id="' + this.id + '" /></div>';
  }

  if (this.link) out += '<div><a href="' + this.link + '" target="_blank">D&D Beyond</a></div>';
  out += '</div>';
  return out;
};

player.prototype.applyInitiative = function (initiative) {
  this.initiative = initiative;
  this.state = CharacterState.Encounter;
};

player.prototype.leaveEncounter = function () {
  this.initiative = 0;
  this.state = CharacterState.Idle;
};

player.prototype.revive = function () {
  this.state = CharacterState.Encounter;
};

player.prototype.die = function () {
  this.state = CharacterState.Dead;
};

module.exports = player;

},{}],36:[function(require,module,exports){
'use strict';

var spell = function spell() {
  this.name = '';
  this.slots = 0;
  this.used = 0;
};

spell.prototype.parse = function (json) {
  if (!json) return;

  if (json.name) {
    this.name = json.name;
  }

  if (json.slots && Utils.isNumeric(json.slots)) {
    this.slots = Utils.clamp(json.slots, 0, 999);
  }

  if (json.used && Utils.isNumeric(json.used)) {
    this.used = Utils.clamp(json.used, 0, 999);
  }
};

spell.prototype.serialize = function () {
  return {
    name: this.name,
    slots: this.slots,
    used: this.used
  };
};

spell.prototype.render = function () {
  var out = '<div class="npc-spells">';
  out += '<span class="spell-level">' + this.name + '</span>';

  for (var i = 0, l = this.slots; i < l; i++) {
    if (i + 1 <= this.used) {
      out += '<input class="spell-slot" type="checkbox" checked="checked" />';
    } else {
      out += '<input class="spell-slot" type="checkbox" />';
    }
  }

  out += '</div>';
  return out;
};

module.exports = spell;

},{}],37:[function(require,module,exports){
'use strict';

var weapon = function weapon() {
  this.name = '';
  this.dice = '1d4';
  this.hitMod = 0;
  this.attackMod = 0;
  this.damageType = DamageType.Bludgeoning;
};

weapon.prototype.parse = function (json) {
  if (!json) return;

  if (json.name) {
    this.name = json.name;
  }

  if (json.dice) {
    this.dice = json.dice;
  }

  if (json.hitMod && Utils.isNumeric(json.hitMod)) {
    this.hitMod = Utils.clamp(json.hitMod, 0, 999);
  }

  if (json.attackMod && Utils.isNumeric(json.attackMod)) {
    this.attackMod = Utils.clamp(json.attackMod, 0, 999);
  }

  if (json.damageType) {
    this.damageType = json.damageType;
  }
};

weapon.prototype.serialize = function () {
  return {
    name: this.name,
    dice: this.dice,
    hitMod: this.hitMod,
    attackMod: this.attackMod,
    damageType: this.damageType
  };
};

weapon.prototype.render = function () {
  var out = '<span class="bold">' + this.name + '</span>: 1d20';
  if (this.hitMod > 0) out += ' + ' + this.hitMod;
  out += ' to hit, ' + this.dice;
  if (this.attackMod > 0) out += ' + ' + this.attackMod;
  out += ', <span class="italic">' + this.damageType + '</span>';
  return out;
};

module.exports = weapon;

},{}],38:[function(require,module,exports){
(function (global){
'use strict'; // global vars/functions

global.Debug = require('./utils/debug.js');
global.Utils = require('./utils/utils.js'); // parse app specific globals

require('./dnd/constants.js');

global.DataFile = '/json/state.json';

var ui = require('./app/ui.js');

module.exports = {
  run: ui.run
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./app/ui.js":30,"./dnd/constants.js":32,"./utils/debug.js":39,"./utils/utils.js":42}],39:[function(require,module,exports){
'use strict';

module.exports = {
  assert: console ? console.assert.bind(console) : function () {},
  clear: console ? console.clear.bind(console) : function () {},
  error: console ? console.error.bind(console) : function () {},
  group: console ? console.group.bind(console) : function () {},
  groupCollapsed: console ? console.groupCollapsed.bind(console) : function () {},
  groupEnd: console ? console.groupEnd.bind(console) : function () {},
  info: console ? console.info.bind(console) : function () {},
  log: console ? console.log.bind(console) : function () {},
  trace: console ? console.trace.bind(console) : function () {},
  warn: console ? console.warn.bind(console) : function () {}
};

},{}],40:[function(require,module,exports){
'use strict';

var randomInt = function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

var randomChance = function randomChance(percentTrue) {
  percentTrue = percentTrue || 50;
  return randomInt(1, 100) <= percentTrue ? true : false;
};

module.exports = {
  clamp: function clamp(val, min, max) {
    if (val < min) return min;
    if (val > max) return max;
    return val;
  },
  isNumeric: function isNumeric(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
  },
  randomInt: randomInt,
  randomChance: randomChance
};

},{}],41:[function(require,module,exports){
'use strict';

module.exports = {
  isArray: function isArray(obj) {
    return Object.prototype.toString.call(obj) === '[object Array]' ? true : false;
  },
  arrayClone: function arrayClone(arr) {
    return arr.slice(0);
  },
  isFunction: function isFunction(obj) {
    return typeof obj === 'function' ? true : false;
  },
  storageAvailable: function storageAvailable(type) {
    try {
      var storage = window[type],
          x = '__storage_test__';
      storage.setItem(x, x);
      storage.removeItem(x);
      return true;
    } catch (e) {
      return e instanceof DOMException && (e.code === 22 || e.code === 1014 || e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') && storage.length !== 0;
    }
  }
};

},{}],42:[function(require,module,exports){
'use strict';

var utils = {};

var enumerate = function enumerate(obj) {
  for (var property in obj) {
    if (obj.hasOwnProperty(property)) {
      utils[property] = obj[property];
    }
  }
};

enumerate(require('./numbers.js'));
enumerate(require('./tools.js'));
module.exports = utils;

},{"./numbers.js":40,"./tools.js":41}]},{},[38])(38)
});

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYXhpb3MvaW5kZXguanMiLCJub2RlX21vZHVsZXMvYXhpb3MvbGliL2FkYXB0ZXJzL3hoci5qcyIsIm5vZGVfbW9kdWxlcy9heGlvcy9saWIvYXhpb3MuanMiLCJub2RlX21vZHVsZXMvYXhpb3MvbGliL2NhbmNlbC9DYW5jZWwuanMiLCJub2RlX21vZHVsZXMvYXhpb3MvbGliL2NhbmNlbC9DYW5jZWxUb2tlbi5qcyIsIm5vZGVfbW9kdWxlcy9heGlvcy9saWIvY2FuY2VsL2lzQ2FuY2VsLmpzIiwibm9kZV9tb2R1bGVzL2F4aW9zL2xpYi9jb3JlL0F4aW9zLmpzIiwibm9kZV9tb2R1bGVzL2F4aW9zL2xpYi9jb3JlL0ludGVyY2VwdG9yTWFuYWdlci5qcyIsIm5vZGVfbW9kdWxlcy9heGlvcy9saWIvY29yZS9jcmVhdGVFcnJvci5qcyIsIm5vZGVfbW9kdWxlcy9heGlvcy9saWIvY29yZS9kaXNwYXRjaFJlcXVlc3QuanMiLCJub2RlX21vZHVsZXMvYXhpb3MvbGliL2NvcmUvZW5oYW5jZUVycm9yLmpzIiwibm9kZV9tb2R1bGVzL2F4aW9zL2xpYi9jb3JlL21lcmdlQ29uZmlnLmpzIiwibm9kZV9tb2R1bGVzL2F4aW9zL2xpYi9jb3JlL3NldHRsZS5qcyIsIm5vZGVfbW9kdWxlcy9heGlvcy9saWIvY29yZS90cmFuc2Zvcm1EYXRhLmpzIiwibm9kZV9tb2R1bGVzL2F4aW9zL2xpYi9kZWZhdWx0cy5qcyIsIm5vZGVfbW9kdWxlcy9heGlvcy9saWIvaGVscGVycy9iaW5kLmpzIiwibm9kZV9tb2R1bGVzL2F4aW9zL2xpYi9oZWxwZXJzL2J1aWxkVVJMLmpzIiwibm9kZV9tb2R1bGVzL2F4aW9zL2xpYi9oZWxwZXJzL2NvbWJpbmVVUkxzLmpzIiwibm9kZV9tb2R1bGVzL2F4aW9zL2xpYi9oZWxwZXJzL2Nvb2tpZXMuanMiLCJub2RlX21vZHVsZXMvYXhpb3MvbGliL2hlbHBlcnMvaXNBYnNvbHV0ZVVSTC5qcyIsIm5vZGVfbW9kdWxlcy9heGlvcy9saWIvaGVscGVycy9pc1VSTFNhbWVPcmlnaW4uanMiLCJub2RlX21vZHVsZXMvYXhpb3MvbGliL2hlbHBlcnMvbm9ybWFsaXplSGVhZGVyTmFtZS5qcyIsIm5vZGVfbW9kdWxlcy9heGlvcy9saWIvaGVscGVycy9wYXJzZUhlYWRlcnMuanMiLCJub2RlX21vZHVsZXMvYXhpb3MvbGliL2hlbHBlcnMvc3ByZWFkLmpzIiwibm9kZV9tb2R1bGVzL2F4aW9zL2xpYi91dGlscy5qcyIsIm5vZGVfbW9kdWxlcy9heGlvcy9ub2RlX21vZHVsZXMvaXMtYnVmZmVyL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qcyIsInNyYy9hcHAvZW50aXRpZXMuanMiLCJzcmMvYXBwL3N0b3JhZ2UuanMiLCJzcmMvYXBwL3VpLmpzIiwic3JjL2RuZC9jb21wYW5pb24uanMiLCJzcmMvZG5kL2NvbnN0YW50cy5qcyIsInNyYy9kbmQvZGljZS5qcyIsInNyYy9kbmQvbnBjLmpzIiwic3JjL2RuZC9wbGF5ZXIuanMiLCJzcmMvZG5kL3NwZWxsLmpzIiwic3JjL2RuZC93ZWFwb24uanMiLCJzcmMvbWFpbi5qcyIsInNyYy91dGlscy9kZWJ1Zy5qcyIsInNyYy91dGlscy9udW1iZXJzLmpzIiwic3JjL3V0aWxzL3Rvb2xzLmpzIiwic3JjL3V0aWxzL3V0aWxzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNwQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDbEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNkQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNkQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOVVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFD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Q0FBQyxHQUFHLGtCQUFoQztBQUNBLE1BQUEsT0FBTyxDQUFDLE9BQVIsQ0FBZ0IsQ0FBaEIsRUFBbUIsQ0FBbkI7QUFDQSxNQUFBLE9BQU8sQ0FBQyxVQUFSLENBQW1CLENBQW5CO0FBQ0EsYUFBTyxJQUFQO0FBQ0gsS0FMRCxDQUtFLE9BQU8sQ0FBUCxFQUFVO0FBQ1IsYUFBTyxDQUFDLFlBQVksWUFBYixLQUE4QixDQUFDLENBQUMsSUFBRixLQUFXLEVBQVgsSUFBaUIsQ0FBQyxDQUFDLElBQUYsS0FBVyxJQUE1QixJQUFvQyxDQUFDLENBQUMsSUFBRixLQUFXLG9CQUEvQyxJQUF1RSxDQUFDLENBQUMsSUFBRixLQUFXLDRCQUFoSCxLQUFpSixPQUFPLENBQUMsTUFBUixLQUFtQixDQUEzSztBQUNIO0FBQ0o7QUF0QlksQ0FBakI7OztBQ0ZDOztBQUVELElBQUksS0FBSyxHQUFHLEVBQVo7O0FBRUEsSUFBSSxTQUFTLEdBQUcsU0FBWixTQUFZLENBQVUsR0FBVixFQUFlO0FBQzNCLE9BQUssSUFBSSxRQUFULElBQXFCLEdBQXJCLEVBQTBCO0FBQ3RCLFFBQUksR0FBRyxDQUFDLGNBQUosQ0FBbUIsUUFBbkIsQ0FBSixFQUFrQztBQUM5QixNQUFBLEtBQUssQ0FBQyxRQUFELENBQUwsR0FBa0IsR0FBRyxDQUFDLFFBQUQsQ0FBckI7QUFDSDtBQUNKO0FBQ0osQ0FORDs7QUFRQSxTQUFTLENBQUMsT0FBTyxDQUFDLGNBQUQsQ0FBUixDQUFUO0FBQ0EsU0FBUyxDQUFDLE9BQU8sQ0FBQyxZQUFELENBQVIsQ0FBVDtBQUVBLE1BQU0sQ0FBQyxPQUFQLEdBQWlCLEtBQWpCIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oKXtmdW5jdGlvbiByKGUsbix0KXtmdW5jdGlvbiBvKGksZil7aWYoIW5baV0pe2lmKCFlW2ldKXt2YXIgYz1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlO2lmKCFmJiZjKXJldHVybiBjKGksITApO2lmKHUpcmV0dXJuIHUoaSwhMCk7dmFyIGE9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitpK1wiJ1wiKTt0aHJvdyBhLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsYX12YXIgcD1uW2ldPXtleHBvcnRzOnt9fTtlW2ldWzBdLmNhbGwocC5leHBvcnRzLGZ1bmN0aW9uKHIpe3ZhciBuPWVbaV1bMV1bcl07cmV0dXJuIG8obnx8cil9LHAscC5leHBvcnRzLHIsZSxuLHQpfXJldHVybiBuW2ldLmV4cG9ydHN9Zm9yKHZhciB1PVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmUsaT0wO2k8dC5sZW5ndGg7aSsrKW8odFtpXSk7cmV0dXJuIG99cmV0dXJuIHJ9KSgpIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL2xpYi9heGlvcycpOyIsIid1c2Ugc3RyaWN0JztcblxudmFyIHV0aWxzID0gcmVxdWlyZSgnLi8uLi91dGlscycpO1xudmFyIHNldHRsZSA9IHJlcXVpcmUoJy4vLi4vY29yZS9zZXR0bGUnKTtcbnZhciBidWlsZFVSTCA9IHJlcXVpcmUoJy4vLi4vaGVscGVycy9idWlsZFVSTCcpO1xudmFyIHBhcnNlSGVhZGVycyA9IHJlcXVpcmUoJy4vLi4vaGVscGVycy9wYXJzZUhlYWRlcnMnKTtcbnZhciBpc1VSTFNhbWVPcmlnaW4gPSByZXF1aXJlKCcuLy4uL2hlbHBlcnMvaXNVUkxTYW1lT3JpZ2luJyk7XG52YXIgY3JlYXRlRXJyb3IgPSByZXF1aXJlKCcuLi9jb3JlL2NyZWF0ZUVycm9yJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24geGhyQWRhcHRlcihjb25maWcpIHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIGRpc3BhdGNoWGhyUmVxdWVzdChyZXNvbHZlLCByZWplY3QpIHtcbiAgICB2YXIgcmVxdWVzdERhdGEgPSBjb25maWcuZGF0YTtcbiAgICB2YXIgcmVxdWVzdEhlYWRlcnMgPSBjb25maWcuaGVhZGVycztcblxuICAgIGlmICh1dGlscy5pc0Zvcm1EYXRhKHJlcXVlc3REYXRhKSkge1xuICAgICAgZGVsZXRlIHJlcXVlc3RIZWFkZXJzWydDb250ZW50LVR5cGUnXTsgLy8gTGV0IHRoZSBicm93c2VyIHNldCBpdFxuICAgIH1cblxuICAgIHZhciByZXF1ZXN0ID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG5cbiAgICAvLyBIVFRQIGJhc2ljIGF1dGhlbnRpY2F0aW9uXG4gICAgaWYgKGNvbmZpZy5hdXRoKSB7XG4gICAgICB2YXIgdXNlcm5hbWUgPSBjb25maWcuYXV0aC51c2VybmFtZSB8fCAnJztcbiAgICAgIHZhciBwYXNzd29yZCA9IGNvbmZpZy5hdXRoLnBhc3N3b3JkIHx8ICcnO1xuICAgICAgcmVxdWVzdEhlYWRlcnMuQXV0aG9yaXphdGlvbiA9ICdCYXNpYyAnICsgYnRvYSh1c2VybmFtZSArICc6JyArIHBhc3N3b3JkKTtcbiAgICB9XG5cbiAgICByZXF1ZXN0Lm9wZW4oY29uZmlnLm1ldGhvZC50b1VwcGVyQ2FzZSgpLCBidWlsZFVSTChjb25maWcudXJsLCBjb25maWcucGFyYW1zLCBjb25maWcucGFyYW1zU2VyaWFsaXplciksIHRydWUpO1xuXG4gICAgLy8gU2V0IHRoZSByZXF1ZXN0IHRpbWVvdXQgaW4gTVNcbiAgICByZXF1ZXN0LnRpbWVvdXQgPSBjb25maWcudGltZW91dDtcblxuICAgIC8vIExpc3RlbiBmb3IgcmVhZHkgc3RhdGVcbiAgICByZXF1ZXN0Lm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uIGhhbmRsZUxvYWQoKSB7XG4gICAgICBpZiAoIXJlcXVlc3QgfHwgcmVxdWVzdC5yZWFkeVN0YXRlICE9PSA0KSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgLy8gVGhlIHJlcXVlc3QgZXJyb3JlZCBvdXQgYW5kIHdlIGRpZG4ndCBnZXQgYSByZXNwb25zZSwgdGhpcyB3aWxsIGJlXG4gICAgICAvLyBoYW5kbGVkIGJ5IG9uZXJyb3IgaW5zdGVhZFxuICAgICAgLy8gV2l0aCBvbmUgZXhjZXB0aW9uOiByZXF1ZXN0IHRoYXQgdXNpbmcgZmlsZTogcHJvdG9jb2wsIG1vc3QgYnJvd3NlcnNcbiAgICAgIC8vIHdpbGwgcmV0dXJuIHN0YXR1cyBhcyAwIGV2ZW4gdGhvdWdoIGl0J3MgYSBzdWNjZXNzZnVsIHJlcXVlc3RcbiAgICAgIGlmIChyZXF1ZXN0LnN0YXR1cyA9PT0gMCAmJiAhKHJlcXVlc3QucmVzcG9uc2VVUkwgJiYgcmVxdWVzdC5yZXNwb25zZVVSTC5pbmRleE9mKCdmaWxlOicpID09PSAwKSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIC8vIFByZXBhcmUgdGhlIHJlc3BvbnNlXG4gICAgICB2YXIgcmVzcG9uc2VIZWFkZXJzID0gJ2dldEFsbFJlc3BvbnNlSGVhZGVycycgaW4gcmVxdWVzdCA/IHBhcnNlSGVhZGVycyhyZXF1ZXN0LmdldEFsbFJlc3BvbnNlSGVhZGVycygpKSA6IG51bGw7XG4gICAgICB2YXIgcmVzcG9uc2VEYXRhID0gIWNvbmZpZy5yZXNwb25zZVR5cGUgfHwgY29uZmlnLnJlc3BvbnNlVHlwZSA9PT0gJ3RleHQnID8gcmVxdWVzdC5yZXNwb25zZVRleHQgOiByZXF1ZXN0LnJlc3BvbnNlO1xuICAgICAgdmFyIHJlc3BvbnNlID0ge1xuICAgICAgICBkYXRhOiByZXNwb25zZURhdGEsXG4gICAgICAgIHN0YXR1czogcmVxdWVzdC5zdGF0dXMsXG4gICAgICAgIHN0YXR1c1RleHQ6IHJlcXVlc3Quc3RhdHVzVGV4dCxcbiAgICAgICAgaGVhZGVyczogcmVzcG9uc2VIZWFkZXJzLFxuICAgICAgICBjb25maWc6IGNvbmZpZyxcbiAgICAgICAgcmVxdWVzdDogcmVxdWVzdFxuICAgICAgfTtcblxuICAgICAgc2V0dGxlKHJlc29sdmUsIHJlamVjdCwgcmVzcG9uc2UpO1xuXG4gICAgICAvLyBDbGVhbiB1cCByZXF1ZXN0XG4gICAgICByZXF1ZXN0ID0gbnVsbDtcbiAgICB9O1xuXG4gICAgLy8gSGFuZGxlIGJyb3dzZXIgcmVxdWVzdCBjYW5jZWxsYXRpb24gKGFzIG9wcG9zZWQgdG8gYSBtYW51YWwgY2FuY2VsbGF0aW9uKVxuICAgIHJlcXVlc3Qub25hYm9ydCA9IGZ1bmN0aW9uIGhhbmRsZUFib3J0KCkge1xuICAgICAgaWYgKCFyZXF1ZXN0KSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgcmVqZWN0KGNyZWF0ZUVycm9yKCdSZXF1ZXN0IGFib3J0ZWQnLCBjb25maWcsICdFQ09OTkFCT1JURUQnLCByZXF1ZXN0KSk7XG5cbiAgICAgIC8vIENsZWFuIHVwIHJlcXVlc3RcbiAgICAgIHJlcXVlc3QgPSBudWxsO1xuICAgIH07XG5cbiAgICAvLyBIYW5kbGUgbG93IGxldmVsIG5ldHdvcmsgZXJyb3JzXG4gICAgcmVxdWVzdC5vbmVycm9yID0gZnVuY3Rpb24gaGFuZGxlRXJyb3IoKSB7XG4gICAgICAvLyBSZWFsIGVycm9ycyBhcmUgaGlkZGVuIGZyb20gdXMgYnkgdGhlIGJyb3dzZXJcbiAgICAgIC8vIG9uZXJyb3Igc2hvdWxkIG9ubHkgZmlyZSBpZiBpdCdzIGEgbmV0d29yayBlcnJvclxuICAgICAgcmVqZWN0KGNyZWF0ZUVycm9yKCdOZXR3b3JrIEVycm9yJywgY29uZmlnLCBudWxsLCByZXF1ZXN0KSk7XG5cbiAgICAgIC8vIENsZWFuIHVwIHJlcXVlc3RcbiAgICAgIHJlcXVlc3QgPSBudWxsO1xuICAgIH07XG5cbiAgICAvLyBIYW5kbGUgdGltZW91dFxuICAgIHJlcXVlc3Qub250aW1lb3V0ID0gZnVuY3Rpb24gaGFuZGxlVGltZW91dCgpIHtcbiAgICAgIHJlamVjdChjcmVhdGVFcnJvcigndGltZW91dCBvZiAnICsgY29uZmlnLnRpbWVvdXQgKyAnbXMgZXhjZWVkZWQnLCBjb25maWcsICdFQ09OTkFCT1JURUQnLFxuICAgICAgICByZXF1ZXN0KSk7XG5cbiAgICAgIC8vIENsZWFuIHVwIHJlcXVlc3RcbiAgICAgIHJlcXVlc3QgPSBudWxsO1xuICAgIH07XG5cbiAgICAvLyBBZGQgeHNyZiBoZWFkZXJcbiAgICAvLyBUaGlzIGlzIG9ubHkgZG9uZSBpZiBydW5uaW5nIGluIGEgc3RhbmRhcmQgYnJvd3NlciBlbnZpcm9ubWVudC5cbiAgICAvLyBTcGVjaWZpY2FsbHkgbm90IGlmIHdlJ3JlIGluIGEgd2ViIHdvcmtlciwgb3IgcmVhY3QtbmF0aXZlLlxuICAgIGlmICh1dGlscy5pc1N0YW5kYXJkQnJvd3NlckVudigpKSB7XG4gICAgICB2YXIgY29va2llcyA9IHJlcXVpcmUoJy4vLi4vaGVscGVycy9jb29raWVzJyk7XG5cbiAgICAgIC8vIEFkZCB4c3JmIGhlYWRlclxuICAgICAgdmFyIHhzcmZWYWx1ZSA9IChjb25maWcud2l0aENyZWRlbnRpYWxzIHx8IGlzVVJMU2FtZU9yaWdpbihjb25maWcudXJsKSkgJiYgY29uZmlnLnhzcmZDb29raWVOYW1lID9cbiAgICAgICAgY29va2llcy5yZWFkKGNvbmZpZy54c3JmQ29va2llTmFtZSkgOlxuICAgICAgICB1bmRlZmluZWQ7XG5cbiAgICAgIGlmICh4c3JmVmFsdWUpIHtcbiAgICAgICAgcmVxdWVzdEhlYWRlcnNbY29uZmlnLnhzcmZIZWFkZXJOYW1lXSA9IHhzcmZWYWx1ZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBBZGQgaGVhZGVycyB0byB0aGUgcmVxdWVzdFxuICAgIGlmICgnc2V0UmVxdWVzdEhlYWRlcicgaW4gcmVxdWVzdCkge1xuICAgICAgdXRpbHMuZm9yRWFjaChyZXF1ZXN0SGVhZGVycywgZnVuY3Rpb24gc2V0UmVxdWVzdEhlYWRlcih2YWwsIGtleSkge1xuICAgICAgICBpZiAodHlwZW9mIHJlcXVlc3REYXRhID09PSAndW5kZWZpbmVkJyAmJiBrZXkudG9Mb3dlckNhc2UoKSA9PT0gJ2NvbnRlbnQtdHlwZScpIHtcbiAgICAgICAgICAvLyBSZW1vdmUgQ29udGVudC1UeXBlIGlmIGRhdGEgaXMgdW5kZWZpbmVkXG4gICAgICAgICAgZGVsZXRlIHJlcXVlc3RIZWFkZXJzW2tleV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gT3RoZXJ3aXNlIGFkZCBoZWFkZXIgdG8gdGhlIHJlcXVlc3RcbiAgICAgICAgICByZXF1ZXN0LnNldFJlcXVlc3RIZWFkZXIoa2V5LCB2YWwpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBBZGQgd2l0aENyZWRlbnRpYWxzIHRvIHJlcXVlc3QgaWYgbmVlZGVkXG4gICAgaWYgKGNvbmZpZy53aXRoQ3JlZGVudGlhbHMpIHtcbiAgICAgIHJlcXVlc3Qud2l0aENyZWRlbnRpYWxzID0gdHJ1ZTtcbiAgICB9XG5cbiAgICAvLyBBZGQgcmVzcG9uc2VUeXBlIHRvIHJlcXVlc3QgaWYgbmVlZGVkXG4gICAgaWYgKGNvbmZpZy5yZXNwb25zZVR5cGUpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHJlcXVlc3QucmVzcG9uc2VUeXBlID0gY29uZmlnLnJlc3BvbnNlVHlwZTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgLy8gRXhwZWN0ZWQgRE9NRXhjZXB0aW9uIHRocm93biBieSBicm93c2VycyBub3QgY29tcGF0aWJsZSBYTUxIdHRwUmVxdWVzdCBMZXZlbCAyLlxuICAgICAgICAvLyBCdXQsIHRoaXMgY2FuIGJlIHN1cHByZXNzZWQgZm9yICdqc29uJyB0eXBlIGFzIGl0IGNhbiBiZSBwYXJzZWQgYnkgZGVmYXVsdCAndHJhbnNmb3JtUmVzcG9uc2UnIGZ1bmN0aW9uLlxuICAgICAgICBpZiAoY29uZmlnLnJlc3BvbnNlVHlwZSAhPT0gJ2pzb24nKSB7XG4gICAgICAgICAgdGhyb3cgZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIEhhbmRsZSBwcm9ncmVzcyBpZiBuZWVkZWRcbiAgICBpZiAodHlwZW9mIGNvbmZpZy5vbkRvd25sb2FkUHJvZ3Jlc3MgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHJlcXVlc3QuYWRkRXZlbnRMaXN0ZW5lcigncHJvZ3Jlc3MnLCBjb25maWcub25Eb3dubG9hZFByb2dyZXNzKTtcbiAgICB9XG5cbiAgICAvLyBOb3QgYWxsIGJyb3dzZXJzIHN1cHBvcnQgdXBsb2FkIGV2ZW50c1xuICAgIGlmICh0eXBlb2YgY29uZmlnLm9uVXBsb2FkUHJvZ3Jlc3MgPT09ICdmdW5jdGlvbicgJiYgcmVxdWVzdC51cGxvYWQpIHtcbiAgICAgIHJlcXVlc3QudXBsb2FkLmFkZEV2ZW50TGlzdGVuZXIoJ3Byb2dyZXNzJywgY29uZmlnLm9uVXBsb2FkUHJvZ3Jlc3MpO1xuICAgIH1cblxuICAgIGlmIChjb25maWcuY2FuY2VsVG9rZW4pIHtcbiAgICAgIC8vIEhhbmRsZSBjYW5jZWxsYXRpb25cbiAgICAgIGNvbmZpZy5jYW5jZWxUb2tlbi5wcm9taXNlLnRoZW4oZnVuY3Rpb24gb25DYW5jZWxlZChjYW5jZWwpIHtcbiAgICAgICAgaWYgKCFyZXF1ZXN0KSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgcmVxdWVzdC5hYm9ydCgpO1xuICAgICAgICByZWplY3QoY2FuY2VsKTtcbiAgICAgICAgLy8gQ2xlYW4gdXAgcmVxdWVzdFxuICAgICAgICByZXF1ZXN0ID0gbnVsbDtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGlmIChyZXF1ZXN0RGF0YSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXF1ZXN0RGF0YSA9IG51bGw7XG4gICAgfVxuXG4gICAgLy8gU2VuZCB0aGUgcmVxdWVzdFxuICAgIHJlcXVlc3Quc2VuZChyZXF1ZXN0RGF0YSk7XG4gIH0pO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHV0aWxzID0gcmVxdWlyZSgnLi91dGlscycpO1xudmFyIGJpbmQgPSByZXF1aXJlKCcuL2hlbHBlcnMvYmluZCcpO1xudmFyIEF4aW9zID0gcmVxdWlyZSgnLi9jb3JlL0F4aW9zJyk7XG52YXIgbWVyZ2VDb25maWcgPSByZXF1aXJlKCcuL2NvcmUvbWVyZ2VDb25maWcnKTtcbnZhciBkZWZhdWx0cyA9IHJlcXVpcmUoJy4vZGVmYXVsdHMnKTtcblxuLyoqXG4gKiBDcmVhdGUgYW4gaW5zdGFuY2Ugb2YgQXhpb3NcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gZGVmYXVsdENvbmZpZyBUaGUgZGVmYXVsdCBjb25maWcgZm9yIHRoZSBpbnN0YW5jZVxuICogQHJldHVybiB7QXhpb3N9IEEgbmV3IGluc3RhbmNlIG9mIEF4aW9zXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZUluc3RhbmNlKGRlZmF1bHRDb25maWcpIHtcbiAgdmFyIGNvbnRleHQgPSBuZXcgQXhpb3MoZGVmYXVsdENvbmZpZyk7XG4gIHZhciBpbnN0YW5jZSA9IGJpbmQoQXhpb3MucHJvdG90eXBlLnJlcXVlc3QsIGNvbnRleHQpO1xuXG4gIC8vIENvcHkgYXhpb3MucHJvdG90eXBlIHRvIGluc3RhbmNlXG4gIHV0aWxzLmV4dGVuZChpbnN0YW5jZSwgQXhpb3MucHJvdG90eXBlLCBjb250ZXh0KTtcblxuICAvLyBDb3B5IGNvbnRleHQgdG8gaW5zdGFuY2VcbiAgdXRpbHMuZXh0ZW5kKGluc3RhbmNlLCBjb250ZXh0KTtcblxuICByZXR1cm4gaW5zdGFuY2U7XG59XG5cbi8vIENyZWF0ZSB0aGUgZGVmYXVsdCBpbnN0YW5jZSB0byBiZSBleHBvcnRlZFxudmFyIGF4aW9zID0gY3JlYXRlSW5zdGFuY2UoZGVmYXVsdHMpO1xuXG4vLyBFeHBvc2UgQXhpb3MgY2xhc3MgdG8gYWxsb3cgY2xhc3MgaW5oZXJpdGFuY2VcbmF4aW9zLkF4aW9zID0gQXhpb3M7XG5cbi8vIEZhY3RvcnkgZm9yIGNyZWF0aW5nIG5ldyBpbnN0YW5jZXNcbmF4aW9zLmNyZWF0ZSA9IGZ1bmN0aW9uIGNyZWF0ZShpbnN0YW5jZUNvbmZpZykge1xuICByZXR1cm4gY3JlYXRlSW5zdGFuY2UobWVyZ2VDb25maWcoYXhpb3MuZGVmYXVsdHMsIGluc3RhbmNlQ29uZmlnKSk7XG59O1xuXG4vLyBFeHBvc2UgQ2FuY2VsICYgQ2FuY2VsVG9rZW5cbmF4aW9zLkNhbmNlbCA9IHJlcXVpcmUoJy4vY2FuY2VsL0NhbmNlbCcpO1xuYXhpb3MuQ2FuY2VsVG9rZW4gPSByZXF1aXJlKCcuL2NhbmNlbC9DYW5jZWxUb2tlbicpO1xuYXhpb3MuaXNDYW5jZWwgPSByZXF1aXJlKCcuL2NhbmNlbC9pc0NhbmNlbCcpO1xuXG4vLyBFeHBvc2UgYWxsL3NwcmVhZFxuYXhpb3MuYWxsID0gZnVuY3Rpb24gYWxsKHByb21pc2VzKSB7XG4gIHJldHVybiBQcm9taXNlLmFsbChwcm9taXNlcyk7XG59O1xuYXhpb3Muc3ByZWFkID0gcmVxdWlyZSgnLi9oZWxwZXJzL3NwcmVhZCcpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGF4aW9zO1xuXG4vLyBBbGxvdyB1c2Ugb2YgZGVmYXVsdCBpbXBvcnQgc3ludGF4IGluIFR5cGVTY3JpcHRcbm1vZHVsZS5leHBvcnRzLmRlZmF1bHQgPSBheGlvcztcbiIsIid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBBIGBDYW5jZWxgIGlzIGFuIG9iamVjdCB0aGF0IGlzIHRocm93biB3aGVuIGFuIG9wZXJhdGlvbiBpcyBjYW5jZWxlZC5cbiAqXG4gKiBAY2xhc3NcbiAqIEBwYXJhbSB7c3RyaW5nPX0gbWVzc2FnZSBUaGUgbWVzc2FnZS5cbiAqL1xuZnVuY3Rpb24gQ2FuY2VsKG1lc3NhZ2UpIHtcbiAgdGhpcy5tZXNzYWdlID0gbWVzc2FnZTtcbn1cblxuQ2FuY2VsLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uIHRvU3RyaW5nKCkge1xuICByZXR1cm4gJ0NhbmNlbCcgKyAodGhpcy5tZXNzYWdlID8gJzogJyArIHRoaXMubWVzc2FnZSA6ICcnKTtcbn07XG5cbkNhbmNlbC5wcm90b3R5cGUuX19DQU5DRUxfXyA9IHRydWU7XG5cbm1vZHVsZS5leHBvcnRzID0gQ2FuY2VsO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgQ2FuY2VsID0gcmVxdWlyZSgnLi9DYW5jZWwnKTtcblxuLyoqXG4gKiBBIGBDYW5jZWxUb2tlbmAgaXMgYW4gb2JqZWN0IHRoYXQgY2FuIGJlIHVzZWQgdG8gcmVxdWVzdCBjYW5jZWxsYXRpb24gb2YgYW4gb3BlcmF0aW9uLlxuICpcbiAqIEBjbGFzc1xuICogQHBhcmFtIHtGdW5jdGlvbn0gZXhlY3V0b3IgVGhlIGV4ZWN1dG9yIGZ1bmN0aW9uLlxuICovXG5mdW5jdGlvbiBDYW5jZWxUb2tlbihleGVjdXRvcikge1xuICBpZiAodHlwZW9mIGV4ZWN1dG9yICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignZXhlY3V0b3IgbXVzdCBiZSBhIGZ1bmN0aW9uLicpO1xuICB9XG5cbiAgdmFyIHJlc29sdmVQcm9taXNlO1xuICB0aGlzLnByb21pc2UgPSBuZXcgUHJvbWlzZShmdW5jdGlvbiBwcm9taXNlRXhlY3V0b3IocmVzb2x2ZSkge1xuICAgIHJlc29sdmVQcm9taXNlID0gcmVzb2x2ZTtcbiAgfSk7XG5cbiAgdmFyIHRva2VuID0gdGhpcztcbiAgZXhlY3V0b3IoZnVuY3Rpb24gY2FuY2VsKG1lc3NhZ2UpIHtcbiAgICBpZiAodG9rZW4ucmVhc29uKSB7XG4gICAgICAvLyBDYW5jZWxsYXRpb24gaGFzIGFscmVhZHkgYmVlbiByZXF1ZXN0ZWRcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0b2tlbi5yZWFzb24gPSBuZXcgQ2FuY2VsKG1lc3NhZ2UpO1xuICAgIHJlc29sdmVQcm9taXNlKHRva2VuLnJlYXNvbik7XG4gIH0pO1xufVxuXG4vKipcbiAqIFRocm93cyBhIGBDYW5jZWxgIGlmIGNhbmNlbGxhdGlvbiBoYXMgYmVlbiByZXF1ZXN0ZWQuXG4gKi9cbkNhbmNlbFRva2VuLnByb3RvdHlwZS50aHJvd0lmUmVxdWVzdGVkID0gZnVuY3Rpb24gdGhyb3dJZlJlcXVlc3RlZCgpIHtcbiAgaWYgKHRoaXMucmVhc29uKSB7XG4gICAgdGhyb3cgdGhpcy5yZWFzb247XG4gIH1cbn07XG5cbi8qKlxuICogUmV0dXJucyBhbiBvYmplY3QgdGhhdCBjb250YWlucyBhIG5ldyBgQ2FuY2VsVG9rZW5gIGFuZCBhIGZ1bmN0aW9uIHRoYXQsIHdoZW4gY2FsbGVkLFxuICogY2FuY2VscyB0aGUgYENhbmNlbFRva2VuYC5cbiAqL1xuQ2FuY2VsVG9rZW4uc291cmNlID0gZnVuY3Rpb24gc291cmNlKCkge1xuICB2YXIgY2FuY2VsO1xuICB2YXIgdG9rZW4gPSBuZXcgQ2FuY2VsVG9rZW4oZnVuY3Rpb24gZXhlY3V0b3IoYykge1xuICAgIGNhbmNlbCA9IGM7XG4gIH0pO1xuICByZXR1cm4ge1xuICAgIHRva2VuOiB0b2tlbixcbiAgICBjYW5jZWw6IGNhbmNlbFxuICB9O1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBDYW5jZWxUb2tlbjtcbiIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBpc0NhbmNlbCh2YWx1ZSkge1xuICByZXR1cm4gISEodmFsdWUgJiYgdmFsdWUuX19DQU5DRUxfXyk7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuLy4uL3V0aWxzJyk7XG52YXIgYnVpbGRVUkwgPSByZXF1aXJlKCcuLi9oZWxwZXJzL2J1aWxkVVJMJyk7XG52YXIgSW50ZXJjZXB0b3JNYW5hZ2VyID0gcmVxdWlyZSgnLi9JbnRlcmNlcHRvck1hbmFnZXInKTtcbnZhciBkaXNwYXRjaFJlcXVlc3QgPSByZXF1aXJlKCcuL2Rpc3BhdGNoUmVxdWVzdCcpO1xudmFyIG1lcmdlQ29uZmlnID0gcmVxdWlyZSgnLi9tZXJnZUNvbmZpZycpO1xuXG4vKipcbiAqIENyZWF0ZSBhIG5ldyBpbnN0YW5jZSBvZiBBeGlvc1xuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBpbnN0YW5jZUNvbmZpZyBUaGUgZGVmYXVsdCBjb25maWcgZm9yIHRoZSBpbnN0YW5jZVxuICovXG5mdW5jdGlvbiBBeGlvcyhpbnN0YW5jZUNvbmZpZykge1xuICB0aGlzLmRlZmF1bHRzID0gaW5zdGFuY2VDb25maWc7XG4gIHRoaXMuaW50ZXJjZXB0b3JzID0ge1xuICAgIHJlcXVlc3Q6IG5ldyBJbnRlcmNlcHRvck1hbmFnZXIoKSxcbiAgICByZXNwb25zZTogbmV3IEludGVyY2VwdG9yTWFuYWdlcigpXG4gIH07XG59XG5cbi8qKlxuICogRGlzcGF0Y2ggYSByZXF1ZXN0XG4gKlxuICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZyBUaGUgY29uZmlnIHNwZWNpZmljIGZvciB0aGlzIHJlcXVlc3QgKG1lcmdlZCB3aXRoIHRoaXMuZGVmYXVsdHMpXG4gKi9cbkF4aW9zLnByb3RvdHlwZS5yZXF1ZXN0ID0gZnVuY3Rpb24gcmVxdWVzdChjb25maWcpIHtcbiAgLyplc2xpbnQgbm8tcGFyYW0tcmVhc3NpZ246MCovXG4gIC8vIEFsbG93IGZvciBheGlvcygnZXhhbXBsZS91cmwnWywgY29uZmlnXSkgYSBsYSBmZXRjaCBBUElcbiAgaWYgKHR5cGVvZiBjb25maWcgPT09ICdzdHJpbmcnKSB7XG4gICAgY29uZmlnID0gYXJndW1lbnRzWzFdIHx8IHt9O1xuICAgIGNvbmZpZy51cmwgPSBhcmd1bWVudHNbMF07XG4gIH0gZWxzZSB7XG4gICAgY29uZmlnID0gY29uZmlnIHx8IHt9O1xuICB9XG5cbiAgY29uZmlnID0gbWVyZ2VDb25maWcodGhpcy5kZWZhdWx0cywgY29uZmlnKTtcbiAgY29uZmlnLm1ldGhvZCA9IGNvbmZpZy5tZXRob2QgPyBjb25maWcubWV0aG9kLnRvTG93ZXJDYXNlKCkgOiAnZ2V0JztcblxuICAvLyBIb29rIHVwIGludGVyY2VwdG9ycyBtaWRkbGV3YXJlXG4gIHZhciBjaGFpbiA9IFtkaXNwYXRjaFJlcXVlc3QsIHVuZGVmaW5lZF07XG4gIHZhciBwcm9taXNlID0gUHJvbWlzZS5yZXNvbHZlKGNvbmZpZyk7XG5cbiAgdGhpcy5pbnRlcmNlcHRvcnMucmVxdWVzdC5mb3JFYWNoKGZ1bmN0aW9uIHVuc2hpZnRSZXF1ZXN0SW50ZXJjZXB0b3JzKGludGVyY2VwdG9yKSB7XG4gICAgY2hhaW4udW5zaGlmdChpbnRlcmNlcHRvci5mdWxmaWxsZWQsIGludGVyY2VwdG9yLnJlamVjdGVkKTtcbiAgfSk7XG5cbiAgdGhpcy5pbnRlcmNlcHRvcnMucmVzcG9uc2UuZm9yRWFjaChmdW5jdGlvbiBwdXNoUmVzcG9uc2VJbnRlcmNlcHRvcnMoaW50ZXJjZXB0b3IpIHtcbiAgICBjaGFpbi5wdXNoKGludGVyY2VwdG9yLmZ1bGZpbGxlZCwgaW50ZXJjZXB0b3IucmVqZWN0ZWQpO1xuICB9KTtcblxuICB3aGlsZSAoY2hhaW4ubGVuZ3RoKSB7XG4gICAgcHJvbWlzZSA9IHByb21pc2UudGhlbihjaGFpbi5zaGlmdCgpLCBjaGFpbi5zaGlmdCgpKTtcbiAgfVxuXG4gIHJldHVybiBwcm9taXNlO1xufTtcblxuQXhpb3MucHJvdG90eXBlLmdldFVyaSA9IGZ1bmN0aW9uIGdldFVyaShjb25maWcpIHtcbiAgY29uZmlnID0gbWVyZ2VDb25maWcodGhpcy5kZWZhdWx0cywgY29uZmlnKTtcbiAgcmV0dXJuIGJ1aWxkVVJMKGNvbmZpZy51cmwsIGNvbmZpZy5wYXJhbXMsIGNvbmZpZy5wYXJhbXNTZXJpYWxpemVyKS5yZXBsYWNlKC9eXFw/LywgJycpO1xufTtcblxuLy8gUHJvdmlkZSBhbGlhc2VzIGZvciBzdXBwb3J0ZWQgcmVxdWVzdCBtZXRob2RzXG51dGlscy5mb3JFYWNoKFsnZGVsZXRlJywgJ2dldCcsICdoZWFkJywgJ29wdGlvbnMnXSwgZnVuY3Rpb24gZm9yRWFjaE1ldGhvZE5vRGF0YShtZXRob2QpIHtcbiAgLyplc2xpbnQgZnVuYy1uYW1lczowKi9cbiAgQXhpb3MucHJvdG90eXBlW21ldGhvZF0gPSBmdW5jdGlvbih1cmwsIGNvbmZpZykge1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3QodXRpbHMubWVyZ2UoY29uZmlnIHx8IHt9LCB7XG4gICAgICBtZXRob2Q6IG1ldGhvZCxcbiAgICAgIHVybDogdXJsXG4gICAgfSkpO1xuICB9O1xufSk7XG5cbnV0aWxzLmZvckVhY2goWydwb3N0JywgJ3B1dCcsICdwYXRjaCddLCBmdW5jdGlvbiBmb3JFYWNoTWV0aG9kV2l0aERhdGEobWV0aG9kKSB7XG4gIC8qZXNsaW50IGZ1bmMtbmFtZXM6MCovXG4gIEF4aW9zLnByb3RvdHlwZVttZXRob2RdID0gZnVuY3Rpb24odXJsLCBkYXRhLCBjb25maWcpIHtcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KHV0aWxzLm1lcmdlKGNvbmZpZyB8fCB7fSwge1xuICAgICAgbWV0aG9kOiBtZXRob2QsXG4gICAgICB1cmw6IHVybCxcbiAgICAgIGRhdGE6IGRhdGFcbiAgICB9KSk7XG4gIH07XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBBeGlvcztcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHV0aWxzID0gcmVxdWlyZSgnLi8uLi91dGlscycpO1xuXG5mdW5jdGlvbiBJbnRlcmNlcHRvck1hbmFnZXIoKSB7XG4gIHRoaXMuaGFuZGxlcnMgPSBbXTtcbn1cblxuLyoqXG4gKiBBZGQgYSBuZXcgaW50ZXJjZXB0b3IgdG8gdGhlIHN0YWNrXG4gKlxuICogQHBhcmFtIHtGdW5jdGlvbn0gZnVsZmlsbGVkIFRoZSBmdW5jdGlvbiB0byBoYW5kbGUgYHRoZW5gIGZvciBhIGBQcm9taXNlYFxuICogQHBhcmFtIHtGdW5jdGlvbn0gcmVqZWN0ZWQgVGhlIGZ1bmN0aW9uIHRvIGhhbmRsZSBgcmVqZWN0YCBmb3IgYSBgUHJvbWlzZWBcbiAqXG4gKiBAcmV0dXJuIHtOdW1iZXJ9IEFuIElEIHVzZWQgdG8gcmVtb3ZlIGludGVyY2VwdG9yIGxhdGVyXG4gKi9cbkludGVyY2VwdG9yTWFuYWdlci5wcm90b3R5cGUudXNlID0gZnVuY3Rpb24gdXNlKGZ1bGZpbGxlZCwgcmVqZWN0ZWQpIHtcbiAgdGhpcy5oYW5kbGVycy5wdXNoKHtcbiAgICBmdWxmaWxsZWQ6IGZ1bGZpbGxlZCxcbiAgICByZWplY3RlZDogcmVqZWN0ZWRcbiAgfSk7XG4gIHJldHVybiB0aGlzLmhhbmRsZXJzLmxlbmd0aCAtIDE7XG59O1xuXG4vKipcbiAqIFJlbW92ZSBhbiBpbnRlcmNlcHRvciBmcm9tIHRoZSBzdGFja1xuICpcbiAqIEBwYXJhbSB7TnVtYmVyfSBpZCBUaGUgSUQgdGhhdCB3YXMgcmV0dXJuZWQgYnkgYHVzZWBcbiAqL1xuSW50ZXJjZXB0b3JNYW5hZ2VyLnByb3RvdHlwZS5lamVjdCA9IGZ1bmN0aW9uIGVqZWN0KGlkKSB7XG4gIGlmICh0aGlzLmhhbmRsZXJzW2lkXSkge1xuICAgIHRoaXMuaGFuZGxlcnNbaWRdID0gbnVsbDtcbiAgfVxufTtcblxuLyoqXG4gKiBJdGVyYXRlIG92ZXIgYWxsIHRoZSByZWdpc3RlcmVkIGludGVyY2VwdG9yc1xuICpcbiAqIFRoaXMgbWV0aG9kIGlzIHBhcnRpY3VsYXJseSB1c2VmdWwgZm9yIHNraXBwaW5nIG92ZXIgYW55XG4gKiBpbnRlcmNlcHRvcnMgdGhhdCBtYXkgaGF2ZSBiZWNvbWUgYG51bGxgIGNhbGxpbmcgYGVqZWN0YC5cbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmbiBUaGUgZnVuY3Rpb24gdG8gY2FsbCBmb3IgZWFjaCBpbnRlcmNlcHRvclxuICovXG5JbnRlcmNlcHRvck1hbmFnZXIucHJvdG90eXBlLmZvckVhY2ggPSBmdW5jdGlvbiBmb3JFYWNoKGZuKSB7XG4gIHV0aWxzLmZvckVhY2godGhpcy5oYW5kbGVycywgZnVuY3Rpb24gZm9yRWFjaEhhbmRsZXIoaCkge1xuICAgIGlmIChoICE9PSBudWxsKSB7XG4gICAgICBmbihoKTtcbiAgICB9XG4gIH0pO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBJbnRlcmNlcHRvck1hbmFnZXI7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBlbmhhbmNlRXJyb3IgPSByZXF1aXJlKCcuL2VuaGFuY2VFcnJvcicpO1xuXG4vKipcbiAqIENyZWF0ZSBhbiBFcnJvciB3aXRoIHRoZSBzcGVjaWZpZWQgbWVzc2FnZSwgY29uZmlnLCBlcnJvciBjb2RlLCByZXF1ZXN0IGFuZCByZXNwb25zZS5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gbWVzc2FnZSBUaGUgZXJyb3IgbWVzc2FnZS5cbiAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWcgVGhlIGNvbmZpZy5cbiAqIEBwYXJhbSB7c3RyaW5nfSBbY29kZV0gVGhlIGVycm9yIGNvZGUgKGZvciBleGFtcGxlLCAnRUNPTk5BQk9SVEVEJykuXG4gKiBAcGFyYW0ge09iamVjdH0gW3JlcXVlc3RdIFRoZSByZXF1ZXN0LlxuICogQHBhcmFtIHtPYmplY3R9IFtyZXNwb25zZV0gVGhlIHJlc3BvbnNlLlxuICogQHJldHVybnMge0Vycm9yfSBUaGUgY3JlYXRlZCBlcnJvci5cbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBjcmVhdGVFcnJvcihtZXNzYWdlLCBjb25maWcsIGNvZGUsIHJlcXVlc3QsIHJlc3BvbnNlKSB7XG4gIHZhciBlcnJvciA9IG5ldyBFcnJvcihtZXNzYWdlKTtcbiAgcmV0dXJuIGVuaGFuY2VFcnJvcihlcnJvciwgY29uZmlnLCBjb2RlLCByZXF1ZXN0LCByZXNwb25zZSk7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuLy4uL3V0aWxzJyk7XG52YXIgdHJhbnNmb3JtRGF0YSA9IHJlcXVpcmUoJy4vdHJhbnNmb3JtRGF0YScpO1xudmFyIGlzQ2FuY2VsID0gcmVxdWlyZSgnLi4vY2FuY2VsL2lzQ2FuY2VsJyk7XG52YXIgZGVmYXVsdHMgPSByZXF1aXJlKCcuLi9kZWZhdWx0cycpO1xudmFyIGlzQWJzb2x1dGVVUkwgPSByZXF1aXJlKCcuLy4uL2hlbHBlcnMvaXNBYnNvbHV0ZVVSTCcpO1xudmFyIGNvbWJpbmVVUkxzID0gcmVxdWlyZSgnLi8uLi9oZWxwZXJzL2NvbWJpbmVVUkxzJyk7XG5cbi8qKlxuICogVGhyb3dzIGEgYENhbmNlbGAgaWYgY2FuY2VsbGF0aW9uIGhhcyBiZWVuIHJlcXVlc3RlZC5cbiAqL1xuZnVuY3Rpb24gdGhyb3dJZkNhbmNlbGxhdGlvblJlcXVlc3RlZChjb25maWcpIHtcbiAgaWYgKGNvbmZpZy5jYW5jZWxUb2tlbikge1xuICAgIGNvbmZpZy5jYW5jZWxUb2tlbi50aHJvd0lmUmVxdWVzdGVkKCk7XG4gIH1cbn1cblxuLyoqXG4gKiBEaXNwYXRjaCBhIHJlcXVlc3QgdG8gdGhlIHNlcnZlciB1c2luZyB0aGUgY29uZmlndXJlZCBhZGFwdGVyLlxuICpcbiAqIEBwYXJhbSB7b2JqZWN0fSBjb25maWcgVGhlIGNvbmZpZyB0aGF0IGlzIHRvIGJlIHVzZWQgZm9yIHRoZSByZXF1ZXN0XG4gKiBAcmV0dXJucyB7UHJvbWlzZX0gVGhlIFByb21pc2UgdG8gYmUgZnVsZmlsbGVkXG4gKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gZGlzcGF0Y2hSZXF1ZXN0KGNvbmZpZykge1xuICB0aHJvd0lmQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKGNvbmZpZyk7XG5cbiAgLy8gU3VwcG9ydCBiYXNlVVJMIGNvbmZpZ1xuICBpZiAoY29uZmlnLmJhc2VVUkwgJiYgIWlzQWJzb2x1dGVVUkwoY29uZmlnLnVybCkpIHtcbiAgICBjb25maWcudXJsID0gY29tYmluZVVSTHMoY29uZmlnLmJhc2VVUkwsIGNvbmZpZy51cmwpO1xuICB9XG5cbiAgLy8gRW5zdXJlIGhlYWRlcnMgZXhpc3RcbiAgY29uZmlnLmhlYWRlcnMgPSBjb25maWcuaGVhZGVycyB8fCB7fTtcblxuICAvLyBUcmFuc2Zvcm0gcmVxdWVzdCBkYXRhXG4gIGNvbmZpZy5kYXRhID0gdHJhbnNmb3JtRGF0YShcbiAgICBjb25maWcuZGF0YSxcbiAgICBjb25maWcuaGVhZGVycyxcbiAgICBjb25maWcudHJhbnNmb3JtUmVxdWVzdFxuICApO1xuXG4gIC8vIEZsYXR0ZW4gaGVhZGVyc1xuICBjb25maWcuaGVhZGVycyA9IHV0aWxzLm1lcmdlKFxuICAgIGNvbmZpZy5oZWFkZXJzLmNvbW1vbiB8fCB7fSxcbiAgICBjb25maWcuaGVhZGVyc1tjb25maWcubWV0aG9kXSB8fCB7fSxcbiAgICBjb25maWcuaGVhZGVycyB8fCB7fVxuICApO1xuXG4gIHV0aWxzLmZvckVhY2goXG4gICAgWydkZWxldGUnLCAnZ2V0JywgJ2hlYWQnLCAncG9zdCcsICdwdXQnLCAncGF0Y2gnLCAnY29tbW9uJ10sXG4gICAgZnVuY3Rpb24gY2xlYW5IZWFkZXJDb25maWcobWV0aG9kKSB7XG4gICAgICBkZWxldGUgY29uZmlnLmhlYWRlcnNbbWV0aG9kXTtcbiAgICB9XG4gICk7XG5cbiAgdmFyIGFkYXB0ZXIgPSBjb25maWcuYWRhcHRlciB8fCBkZWZhdWx0cy5hZGFwdGVyO1xuXG4gIHJldHVybiBhZGFwdGVyKGNvbmZpZykudGhlbihmdW5jdGlvbiBvbkFkYXB0ZXJSZXNvbHV0aW9uKHJlc3BvbnNlKSB7XG4gICAgdGhyb3dJZkNhbmNlbGxhdGlvblJlcXVlc3RlZChjb25maWcpO1xuXG4gICAgLy8gVHJhbnNmb3JtIHJlc3BvbnNlIGRhdGFcbiAgICByZXNwb25zZS5kYXRhID0gdHJhbnNmb3JtRGF0YShcbiAgICAgIHJlc3BvbnNlLmRhdGEsXG4gICAgICByZXNwb25zZS5oZWFkZXJzLFxuICAgICAgY29uZmlnLnRyYW5zZm9ybVJlc3BvbnNlXG4gICAgKTtcblxuICAgIHJldHVybiByZXNwb25zZTtcbiAgfSwgZnVuY3Rpb24gb25BZGFwdGVyUmVqZWN0aW9uKHJlYXNvbikge1xuICAgIGlmICghaXNDYW5jZWwocmVhc29uKSkge1xuICAgICAgdGhyb3dJZkNhbmNlbGxhdGlvblJlcXVlc3RlZChjb25maWcpO1xuXG4gICAgICAvLyBUcmFuc2Zvcm0gcmVzcG9uc2UgZGF0YVxuICAgICAgaWYgKHJlYXNvbiAmJiByZWFzb24ucmVzcG9uc2UpIHtcbiAgICAgICAgcmVhc29uLnJlc3BvbnNlLmRhdGEgPSB0cmFuc2Zvcm1EYXRhKFxuICAgICAgICAgIHJlYXNvbi5yZXNwb25zZS5kYXRhLFxuICAgICAgICAgIHJlYXNvbi5yZXNwb25zZS5oZWFkZXJzLFxuICAgICAgICAgIGNvbmZpZy50cmFuc2Zvcm1SZXNwb25zZVxuICAgICAgICApO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBQcm9taXNlLnJlamVjdChyZWFzb24pO1xuICB9KTtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbi8qKlxuICogVXBkYXRlIGFuIEVycm9yIHdpdGggdGhlIHNwZWNpZmllZCBjb25maWcsIGVycm9yIGNvZGUsIGFuZCByZXNwb25zZS5cbiAqXG4gKiBAcGFyYW0ge0Vycm9yfSBlcnJvciBUaGUgZXJyb3IgdG8gdXBkYXRlLlxuICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZyBUaGUgY29uZmlnLlxuICogQHBhcmFtIHtzdHJpbmd9IFtjb2RlXSBUaGUgZXJyb3IgY29kZSAoZm9yIGV4YW1wbGUsICdFQ09OTkFCT1JURUQnKS5cbiAqIEBwYXJhbSB7T2JqZWN0fSBbcmVxdWVzdF0gVGhlIHJlcXVlc3QuXG4gKiBAcGFyYW0ge09iamVjdH0gW3Jlc3BvbnNlXSBUaGUgcmVzcG9uc2UuXG4gKiBAcmV0dXJucyB7RXJyb3J9IFRoZSBlcnJvci5cbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBlbmhhbmNlRXJyb3IoZXJyb3IsIGNvbmZpZywgY29kZSwgcmVxdWVzdCwgcmVzcG9uc2UpIHtcbiAgZXJyb3IuY29uZmlnID0gY29uZmlnO1xuICBpZiAoY29kZSkge1xuICAgIGVycm9yLmNvZGUgPSBjb2RlO1xuICB9XG5cbiAgZXJyb3IucmVxdWVzdCA9IHJlcXVlc3Q7XG4gIGVycm9yLnJlc3BvbnNlID0gcmVzcG9uc2U7XG4gIGVycm9yLmlzQXhpb3NFcnJvciA9IHRydWU7XG5cbiAgZXJyb3IudG9KU09OID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIC8vIFN0YW5kYXJkXG4gICAgICBtZXNzYWdlOiB0aGlzLm1lc3NhZ2UsXG4gICAgICBuYW1lOiB0aGlzLm5hbWUsXG4gICAgICAvLyBNaWNyb3NvZnRcbiAgICAgIGRlc2NyaXB0aW9uOiB0aGlzLmRlc2NyaXB0aW9uLFxuICAgICAgbnVtYmVyOiB0aGlzLm51bWJlcixcbiAgICAgIC8vIE1vemlsbGFcbiAgICAgIGZpbGVOYW1lOiB0aGlzLmZpbGVOYW1lLFxuICAgICAgbGluZU51bWJlcjogdGhpcy5saW5lTnVtYmVyLFxuICAgICAgY29sdW1uTnVtYmVyOiB0aGlzLmNvbHVtbk51bWJlcixcbiAgICAgIHN0YWNrOiB0aGlzLnN0YWNrLFxuICAgICAgLy8gQXhpb3NcbiAgICAgIGNvbmZpZzogdGhpcy5jb25maWcsXG4gICAgICBjb2RlOiB0aGlzLmNvZGVcbiAgICB9O1xuICB9O1xuICByZXR1cm4gZXJyb3I7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuLi91dGlscycpO1xuXG4vKipcbiAqIENvbmZpZy1zcGVjaWZpYyBtZXJnZS1mdW5jdGlvbiB3aGljaCBjcmVhdGVzIGEgbmV3IGNvbmZpZy1vYmplY3RcbiAqIGJ5IG1lcmdpbmcgdHdvIGNvbmZpZ3VyYXRpb24gb2JqZWN0cyB0b2dldGhlci5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gY29uZmlnMVxuICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZzJcbiAqIEByZXR1cm5zIHtPYmplY3R9IE5ldyBvYmplY3QgcmVzdWx0aW5nIGZyb20gbWVyZ2luZyBjb25maWcyIHRvIGNvbmZpZzFcbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBtZXJnZUNvbmZpZyhjb25maWcxLCBjb25maWcyKSB7XG4gIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby1wYXJhbS1yZWFzc2lnblxuICBjb25maWcyID0gY29uZmlnMiB8fCB7fTtcbiAgdmFyIGNvbmZpZyA9IHt9O1xuXG4gIHV0aWxzLmZvckVhY2goWyd1cmwnLCAnbWV0aG9kJywgJ3BhcmFtcycsICdkYXRhJ10sIGZ1bmN0aW9uIHZhbHVlRnJvbUNvbmZpZzIocHJvcCkge1xuICAgIGlmICh0eXBlb2YgY29uZmlnMltwcm9wXSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIGNvbmZpZ1twcm9wXSA9IGNvbmZpZzJbcHJvcF07XG4gICAgfVxuICB9KTtcblxuICB1dGlscy5mb3JFYWNoKFsnaGVhZGVycycsICdhdXRoJywgJ3Byb3h5J10sIGZ1bmN0aW9uIG1lcmdlRGVlcFByb3BlcnRpZXMocHJvcCkge1xuICAgIGlmICh1dGlscy5pc09iamVjdChjb25maWcyW3Byb3BdKSkge1xuICAgICAgY29uZmlnW3Byb3BdID0gdXRpbHMuZGVlcE1lcmdlKGNvbmZpZzFbcHJvcF0sIGNvbmZpZzJbcHJvcF0pO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIGNvbmZpZzJbcHJvcF0gIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICBjb25maWdbcHJvcF0gPSBjb25maWcyW3Byb3BdO1xuICAgIH0gZWxzZSBpZiAodXRpbHMuaXNPYmplY3QoY29uZmlnMVtwcm9wXSkpIHtcbiAgICAgIGNvbmZpZ1twcm9wXSA9IHV0aWxzLmRlZXBNZXJnZShjb25maWcxW3Byb3BdKTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBjb25maWcxW3Byb3BdICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgY29uZmlnW3Byb3BdID0gY29uZmlnMVtwcm9wXTtcbiAgICB9XG4gIH0pO1xuXG4gIHV0aWxzLmZvckVhY2goW1xuICAgICdiYXNlVVJMJywgJ3RyYW5zZm9ybVJlcXVlc3QnLCAndHJhbnNmb3JtUmVzcG9uc2UnLCAncGFyYW1zU2VyaWFsaXplcicsXG4gICAgJ3RpbWVvdXQnLCAnd2l0aENyZWRlbnRpYWxzJywgJ2FkYXB0ZXInLCAncmVzcG9uc2VUeXBlJywgJ3hzcmZDb29raWVOYW1lJyxcbiAgICAneHNyZkhlYWRlck5hbWUnLCAnb25VcGxvYWRQcm9ncmVzcycsICdvbkRvd25sb2FkUHJvZ3Jlc3MnLCAnbWF4Q29udGVudExlbmd0aCcsXG4gICAgJ3ZhbGlkYXRlU3RhdHVzJywgJ21heFJlZGlyZWN0cycsICdodHRwQWdlbnQnLCAnaHR0cHNBZ2VudCcsICdjYW5jZWxUb2tlbicsXG4gICAgJ3NvY2tldFBhdGgnXG4gIF0sIGZ1bmN0aW9uIGRlZmF1bHRUb0NvbmZpZzIocHJvcCkge1xuICAgIGlmICh0eXBlb2YgY29uZmlnMltwcm9wXSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIGNvbmZpZ1twcm9wXSA9IGNvbmZpZzJbcHJvcF07XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgY29uZmlnMVtwcm9wXSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIGNvbmZpZ1twcm9wXSA9IGNvbmZpZzFbcHJvcF07XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gY29uZmlnO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGNyZWF0ZUVycm9yID0gcmVxdWlyZSgnLi9jcmVhdGVFcnJvcicpO1xuXG4vKipcbiAqIFJlc29sdmUgb3IgcmVqZWN0IGEgUHJvbWlzZSBiYXNlZCBvbiByZXNwb25zZSBzdGF0dXMuXG4gKlxuICogQHBhcmFtIHtGdW5jdGlvbn0gcmVzb2x2ZSBBIGZ1bmN0aW9uIHRoYXQgcmVzb2x2ZXMgdGhlIHByb21pc2UuXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSByZWplY3QgQSBmdW5jdGlvbiB0aGF0IHJlamVjdHMgdGhlIHByb21pc2UuXG4gKiBAcGFyYW0ge29iamVjdH0gcmVzcG9uc2UgVGhlIHJlc3BvbnNlLlxuICovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIHNldHRsZShyZXNvbHZlLCByZWplY3QsIHJlc3BvbnNlKSB7XG4gIHZhciB2YWxpZGF0ZVN0YXR1cyA9IHJlc3BvbnNlLmNvbmZpZy52YWxpZGF0ZVN0YXR1cztcbiAgaWYgKCF2YWxpZGF0ZVN0YXR1cyB8fCB2YWxpZGF0ZVN0YXR1cyhyZXNwb25zZS5zdGF0dXMpKSB7XG4gICAgcmVzb2x2ZShyZXNwb25zZSk7XG4gIH0gZWxzZSB7XG4gICAgcmVqZWN0KGNyZWF0ZUVycm9yKFxuICAgICAgJ1JlcXVlc3QgZmFpbGVkIHdpdGggc3RhdHVzIGNvZGUgJyArIHJlc3BvbnNlLnN0YXR1cyxcbiAgICAgIHJlc3BvbnNlLmNvbmZpZyxcbiAgICAgIG51bGwsXG4gICAgICByZXNwb25zZS5yZXF1ZXN0LFxuICAgICAgcmVzcG9uc2VcbiAgICApKTtcbiAgfVxufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHV0aWxzID0gcmVxdWlyZSgnLi8uLi91dGlscycpO1xuXG4vKipcbiAqIFRyYW5zZm9ybSB0aGUgZGF0YSBmb3IgYSByZXF1ZXN0IG9yIGEgcmVzcG9uc2VcbiAqXG4gKiBAcGFyYW0ge09iamVjdHxTdHJpbmd9IGRhdGEgVGhlIGRhdGEgdG8gYmUgdHJhbnNmb3JtZWRcbiAqIEBwYXJhbSB7QXJyYXl9IGhlYWRlcnMgVGhlIGhlYWRlcnMgZm9yIHRoZSByZXF1ZXN0IG9yIHJlc3BvbnNlXG4gKiBAcGFyYW0ge0FycmF5fEZ1bmN0aW9ufSBmbnMgQSBzaW5nbGUgZnVuY3Rpb24gb3IgQXJyYXkgb2YgZnVuY3Rpb25zXG4gKiBAcmV0dXJucyB7Kn0gVGhlIHJlc3VsdGluZyB0cmFuc2Zvcm1lZCBkYXRhXG4gKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gdHJhbnNmb3JtRGF0YShkYXRhLCBoZWFkZXJzLCBmbnMpIHtcbiAgLyplc2xpbnQgbm8tcGFyYW0tcmVhc3NpZ246MCovXG4gIHV0aWxzLmZvckVhY2goZm5zLCBmdW5jdGlvbiB0cmFuc2Zvcm0oZm4pIHtcbiAgICBkYXRhID0gZm4oZGF0YSwgaGVhZGVycyk7XG4gIH0pO1xuXG4gIHJldHVybiBkYXRhO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHV0aWxzID0gcmVxdWlyZSgnLi91dGlscycpO1xudmFyIG5vcm1hbGl6ZUhlYWRlck5hbWUgPSByZXF1aXJlKCcuL2hlbHBlcnMvbm9ybWFsaXplSGVhZGVyTmFtZScpO1xuXG52YXIgREVGQVVMVF9DT05URU5UX1RZUEUgPSB7XG4gICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkJ1xufTtcblxuZnVuY3Rpb24gc2V0Q29udGVudFR5cGVJZlVuc2V0KGhlYWRlcnMsIHZhbHVlKSB7XG4gIGlmICghdXRpbHMuaXNVbmRlZmluZWQoaGVhZGVycykgJiYgdXRpbHMuaXNVbmRlZmluZWQoaGVhZGVyc1snQ29udGVudC1UeXBlJ10pKSB7XG4gICAgaGVhZGVyc1snQ29udGVudC1UeXBlJ10gPSB2YWx1ZTtcbiAgfVxufVxuXG5mdW5jdGlvbiBnZXREZWZhdWx0QWRhcHRlcigpIHtcbiAgdmFyIGFkYXB0ZXI7XG4gIC8vIE9ubHkgTm9kZS5KUyBoYXMgYSBwcm9jZXNzIHZhcmlhYmxlIHRoYXQgaXMgb2YgW1tDbGFzc11dIHByb2Nlc3NcbiAgaWYgKHR5cGVvZiBwcm9jZXNzICE9PSAndW5kZWZpbmVkJyAmJiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwocHJvY2VzcykgPT09ICdbb2JqZWN0IHByb2Nlc3NdJykge1xuICAgIC8vIEZvciBub2RlIHVzZSBIVFRQIGFkYXB0ZXJcbiAgICBhZGFwdGVyID0gcmVxdWlyZSgnLi9hZGFwdGVycy9odHRwJyk7XG4gIH0gZWxzZSBpZiAodHlwZW9mIFhNTEh0dHBSZXF1ZXN0ICE9PSAndW5kZWZpbmVkJykge1xuICAgIC8vIEZvciBicm93c2VycyB1c2UgWEhSIGFkYXB0ZXJcbiAgICBhZGFwdGVyID0gcmVxdWlyZSgnLi9hZGFwdGVycy94aHInKTtcbiAgfVxuICByZXR1cm4gYWRhcHRlcjtcbn1cblxudmFyIGRlZmF1bHRzID0ge1xuICBhZGFwdGVyOiBnZXREZWZhdWx0QWRhcHRlcigpLFxuXG4gIHRyYW5zZm9ybVJlcXVlc3Q6IFtmdW5jdGlvbiB0cmFuc2Zvcm1SZXF1ZXN0KGRhdGEsIGhlYWRlcnMpIHtcbiAgICBub3JtYWxpemVIZWFkZXJOYW1lKGhlYWRlcnMsICdBY2NlcHQnKTtcbiAgICBub3JtYWxpemVIZWFkZXJOYW1lKGhlYWRlcnMsICdDb250ZW50LVR5cGUnKTtcbiAgICBpZiAodXRpbHMuaXNGb3JtRGF0YShkYXRhKSB8fFxuICAgICAgdXRpbHMuaXNBcnJheUJ1ZmZlcihkYXRhKSB8fFxuICAgICAgdXRpbHMuaXNCdWZmZXIoZGF0YSkgfHxcbiAgICAgIHV0aWxzLmlzU3RyZWFtKGRhdGEpIHx8XG4gICAgICB1dGlscy5pc0ZpbGUoZGF0YSkgfHxcbiAgICAgIHV0aWxzLmlzQmxvYihkYXRhKVxuICAgICkge1xuICAgICAgcmV0dXJuIGRhdGE7XG4gICAgfVxuICAgIGlmICh1dGlscy5pc0FycmF5QnVmZmVyVmlldyhkYXRhKSkge1xuICAgICAgcmV0dXJuIGRhdGEuYnVmZmVyO1xuICAgIH1cbiAgICBpZiAodXRpbHMuaXNVUkxTZWFyY2hQYXJhbXMoZGF0YSkpIHtcbiAgICAgIHNldENvbnRlbnRUeXBlSWZVbnNldChoZWFkZXJzLCAnYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkO2NoYXJzZXQ9dXRmLTgnKTtcbiAgICAgIHJldHVybiBkYXRhLnRvU3RyaW5nKCk7XG4gICAgfVxuICAgIGlmICh1dGlscy5pc09iamVjdChkYXRhKSkge1xuICAgICAgc2V0Q29udGVudFR5cGVJZlVuc2V0KGhlYWRlcnMsICdhcHBsaWNhdGlvbi9qc29uO2NoYXJzZXQ9dXRmLTgnKTtcbiAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShkYXRhKTtcbiAgICB9XG4gICAgcmV0dXJuIGRhdGE7XG4gIH1dLFxuXG4gIHRyYW5zZm9ybVJlc3BvbnNlOiBbZnVuY3Rpb24gdHJhbnNmb3JtUmVzcG9uc2UoZGF0YSkge1xuICAgIC8qZXNsaW50IG5vLXBhcmFtLXJlYXNzaWduOjAqL1xuICAgIGlmICh0eXBlb2YgZGF0YSA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGRhdGEgPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgICAgfSBjYXRjaCAoZSkgeyAvKiBJZ25vcmUgKi8gfVxuICAgIH1cbiAgICByZXR1cm4gZGF0YTtcbiAgfV0sXG5cbiAgLyoqXG4gICAqIEEgdGltZW91dCBpbiBtaWxsaXNlY29uZHMgdG8gYWJvcnQgYSByZXF1ZXN0LiBJZiBzZXQgdG8gMCAoZGVmYXVsdCkgYVxuICAgKiB0aW1lb3V0IGlzIG5vdCBjcmVhdGVkLlxuICAgKi9cbiAgdGltZW91dDogMCxcblxuICB4c3JmQ29va2llTmFtZTogJ1hTUkYtVE9LRU4nLFxuICB4c3JmSGVhZGVyTmFtZTogJ1gtWFNSRi1UT0tFTicsXG5cbiAgbWF4Q29udGVudExlbmd0aDogLTEsXG5cbiAgdmFsaWRhdGVTdGF0dXM6IGZ1bmN0aW9uIHZhbGlkYXRlU3RhdHVzKHN0YXR1cykge1xuICAgIHJldHVybiBzdGF0dXMgPj0gMjAwICYmIHN0YXR1cyA8IDMwMDtcbiAgfVxufTtcblxuZGVmYXVsdHMuaGVhZGVycyA9IHtcbiAgY29tbW9uOiB7XG4gICAgJ0FjY2VwdCc6ICdhcHBsaWNhdGlvbi9qc29uLCB0ZXh0L3BsYWluLCAqLyonXG4gIH1cbn07XG5cbnV0aWxzLmZvckVhY2goWydkZWxldGUnLCAnZ2V0JywgJ2hlYWQnXSwgZnVuY3Rpb24gZm9yRWFjaE1ldGhvZE5vRGF0YShtZXRob2QpIHtcbiAgZGVmYXVsdHMuaGVhZGVyc1ttZXRob2RdID0ge307XG59KTtcblxudXRpbHMuZm9yRWFjaChbJ3Bvc3QnLCAncHV0JywgJ3BhdGNoJ10sIGZ1bmN0aW9uIGZvckVhY2hNZXRob2RXaXRoRGF0YShtZXRob2QpIHtcbiAgZGVmYXVsdHMuaGVhZGVyc1ttZXRob2RdID0gdXRpbHMubWVyZ2UoREVGQVVMVF9DT05URU5UX1RZUEUpO1xufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gZGVmYXVsdHM7XG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gYmluZChmbiwgdGhpc0FyZykge1xuICByZXR1cm4gZnVuY3Rpb24gd3JhcCgpIHtcbiAgICB2YXIgYXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFyZ3MubGVuZ3RoOyBpKyspIHtcbiAgICAgIGFyZ3NbaV0gPSBhcmd1bWVudHNbaV07XG4gICAgfVxuICAgIHJldHVybiBmbi5hcHBseSh0aGlzQXJnLCBhcmdzKTtcbiAgfTtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciB1dGlscyA9IHJlcXVpcmUoJy4vLi4vdXRpbHMnKTtcblxuZnVuY3Rpb24gZW5jb2RlKHZhbCkge1xuICByZXR1cm4gZW5jb2RlVVJJQ29tcG9uZW50KHZhbCkuXG4gICAgcmVwbGFjZSgvJTQwL2dpLCAnQCcpLlxuICAgIHJlcGxhY2UoLyUzQS9naSwgJzonKS5cbiAgICByZXBsYWNlKC8lMjQvZywgJyQnKS5cbiAgICByZXBsYWNlKC8lMkMvZ2ksICcsJykuXG4gICAgcmVwbGFjZSgvJTIwL2csICcrJykuXG4gICAgcmVwbGFjZSgvJTVCL2dpLCAnWycpLlxuICAgIHJlcGxhY2UoLyU1RC9naSwgJ10nKTtcbn1cblxuLyoqXG4gKiBCdWlsZCBhIFVSTCBieSBhcHBlbmRpbmcgcGFyYW1zIHRvIHRoZSBlbmRcbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gdXJsIFRoZSBiYXNlIG9mIHRoZSB1cmwgKGUuZy4sIGh0dHA6Ly93d3cuZ29vZ2xlLmNvbSlcbiAqIEBwYXJhbSB7b2JqZWN0fSBbcGFyYW1zXSBUaGUgcGFyYW1zIHRvIGJlIGFwcGVuZGVkXG4gKiBAcmV0dXJucyB7c3RyaW5nfSBUaGUgZm9ybWF0dGVkIHVybFxuICovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGJ1aWxkVVJMKHVybCwgcGFyYW1zLCBwYXJhbXNTZXJpYWxpemVyKSB7XG4gIC8qZXNsaW50IG5vLXBhcmFtLXJlYXNzaWduOjAqL1xuICBpZiAoIXBhcmFtcykge1xuICAgIHJldHVybiB1cmw7XG4gIH1cblxuICB2YXIgc2VyaWFsaXplZFBhcmFtcztcbiAgaWYgKHBhcmFtc1NlcmlhbGl6ZXIpIHtcbiAgICBzZXJpYWxpemVkUGFyYW1zID0gcGFyYW1zU2VyaWFsaXplcihwYXJhbXMpO1xuICB9IGVsc2UgaWYgKHV0aWxzLmlzVVJMU2VhcmNoUGFyYW1zKHBhcmFtcykpIHtcbiAgICBzZXJpYWxpemVkUGFyYW1zID0gcGFyYW1zLnRvU3RyaW5nKCk7XG4gIH0gZWxzZSB7XG4gICAgdmFyIHBhcnRzID0gW107XG5cbiAgICB1dGlscy5mb3JFYWNoKHBhcmFtcywgZnVuY3Rpb24gc2VyaWFsaXplKHZhbCwga2V5KSB7XG4gICAgICBpZiAodmFsID09PSBudWxsIHx8IHR5cGVvZiB2YWwgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgaWYgKHV0aWxzLmlzQXJyYXkodmFsKSkge1xuICAgICAgICBrZXkgPSBrZXkgKyAnW10nO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFsID0gW3ZhbF07XG4gICAgICB9XG5cbiAgICAgIHV0aWxzLmZvckVhY2godmFsLCBmdW5jdGlvbiBwYXJzZVZhbHVlKHYpIHtcbiAgICAgICAgaWYgKHV0aWxzLmlzRGF0ZSh2KSkge1xuICAgICAgICAgIHYgPSB2LnRvSVNPU3RyaW5nKCk7XG4gICAgICAgIH0gZWxzZSBpZiAodXRpbHMuaXNPYmplY3QodikpIHtcbiAgICAgICAgICB2ID0gSlNPTi5zdHJpbmdpZnkodik7XG4gICAgICAgIH1cbiAgICAgICAgcGFydHMucHVzaChlbmNvZGUoa2V5KSArICc9JyArIGVuY29kZSh2KSk7XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIHNlcmlhbGl6ZWRQYXJhbXMgPSBwYXJ0cy5qb2luKCcmJyk7XG4gIH1cblxuICBpZiAoc2VyaWFsaXplZFBhcmFtcykge1xuICAgIHZhciBoYXNobWFya0luZGV4ID0gdXJsLmluZGV4T2YoJyMnKTtcbiAgICBpZiAoaGFzaG1hcmtJbmRleCAhPT0gLTEpIHtcbiAgICAgIHVybCA9IHVybC5zbGljZSgwLCBoYXNobWFya0luZGV4KTtcbiAgICB9XG5cbiAgICB1cmwgKz0gKHVybC5pbmRleE9mKCc/JykgPT09IC0xID8gJz8nIDogJyYnKSArIHNlcmlhbGl6ZWRQYXJhbXM7XG4gIH1cblxuICByZXR1cm4gdXJsO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBDcmVhdGVzIGEgbmV3IFVSTCBieSBjb21iaW5pbmcgdGhlIHNwZWNpZmllZCBVUkxzXG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IGJhc2VVUkwgVGhlIGJhc2UgVVJMXG4gKiBAcGFyYW0ge3N0cmluZ30gcmVsYXRpdmVVUkwgVGhlIHJlbGF0aXZlIFVSTFxuICogQHJldHVybnMge3N0cmluZ30gVGhlIGNvbWJpbmVkIFVSTFxuICovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGNvbWJpbmVVUkxzKGJhc2VVUkwsIHJlbGF0aXZlVVJMKSB7XG4gIHJldHVybiByZWxhdGl2ZVVSTFxuICAgID8gYmFzZVVSTC5yZXBsYWNlKC9cXC8rJC8sICcnKSArICcvJyArIHJlbGF0aXZlVVJMLnJlcGxhY2UoL15cXC8rLywgJycpXG4gICAgOiBiYXNlVVJMO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHV0aWxzID0gcmVxdWlyZSgnLi8uLi91dGlscycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IChcbiAgdXRpbHMuaXNTdGFuZGFyZEJyb3dzZXJFbnYoKSA/XG5cbiAgLy8gU3RhbmRhcmQgYnJvd3NlciBlbnZzIHN1cHBvcnQgZG9jdW1lbnQuY29va2llXG4gICAgKGZ1bmN0aW9uIHN0YW5kYXJkQnJvd3NlckVudigpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHdyaXRlOiBmdW5jdGlvbiB3cml0ZShuYW1lLCB2YWx1ZSwgZXhwaXJlcywgcGF0aCwgZG9tYWluLCBzZWN1cmUpIHtcbiAgICAgICAgICB2YXIgY29va2llID0gW107XG4gICAgICAgICAgY29va2llLnB1c2gobmFtZSArICc9JyArIGVuY29kZVVSSUNvbXBvbmVudCh2YWx1ZSkpO1xuXG4gICAgICAgICAgaWYgKHV0aWxzLmlzTnVtYmVyKGV4cGlyZXMpKSB7XG4gICAgICAgICAgICBjb29raWUucHVzaCgnZXhwaXJlcz0nICsgbmV3IERhdGUoZXhwaXJlcykudG9HTVRTdHJpbmcoKSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKHV0aWxzLmlzU3RyaW5nKHBhdGgpKSB7XG4gICAgICAgICAgICBjb29raWUucHVzaCgncGF0aD0nICsgcGF0aCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKHV0aWxzLmlzU3RyaW5nKGRvbWFpbikpIHtcbiAgICAgICAgICAgIGNvb2tpZS5wdXNoKCdkb21haW49JyArIGRvbWFpbik7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKHNlY3VyZSA9PT0gdHJ1ZSkge1xuICAgICAgICAgICAgY29va2llLnB1c2goJ3NlY3VyZScpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGRvY3VtZW50LmNvb2tpZSA9IGNvb2tpZS5qb2luKCc7ICcpO1xuICAgICAgICB9LFxuXG4gICAgICAgIHJlYWQ6IGZ1bmN0aW9uIHJlYWQobmFtZSkge1xuICAgICAgICAgIHZhciBtYXRjaCA9IGRvY3VtZW50LmNvb2tpZS5tYXRjaChuZXcgUmVnRXhwKCcoXnw7XFxcXHMqKSgnICsgbmFtZSArICcpPShbXjtdKiknKSk7XG4gICAgICAgICAgcmV0dXJuIChtYXRjaCA/IGRlY29kZVVSSUNvbXBvbmVudChtYXRjaFszXSkgOiBudWxsKTtcbiAgICAgICAgfSxcblxuICAgICAgICByZW1vdmU6IGZ1bmN0aW9uIHJlbW92ZShuYW1lKSB7XG4gICAgICAgICAgdGhpcy53cml0ZShuYW1lLCAnJywgRGF0ZS5ub3coKSAtIDg2NDAwMDAwKTtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9KSgpIDpcblxuICAvLyBOb24gc3RhbmRhcmQgYnJvd3NlciBlbnYgKHdlYiB3b3JrZXJzLCByZWFjdC1uYXRpdmUpIGxhY2sgbmVlZGVkIHN1cHBvcnQuXG4gICAgKGZ1bmN0aW9uIG5vblN0YW5kYXJkQnJvd3NlckVudigpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHdyaXRlOiBmdW5jdGlvbiB3cml0ZSgpIHt9LFxuICAgICAgICByZWFkOiBmdW5jdGlvbiByZWFkKCkgeyByZXR1cm4gbnVsbDsgfSxcbiAgICAgICAgcmVtb3ZlOiBmdW5jdGlvbiByZW1vdmUoKSB7fVxuICAgICAgfTtcbiAgICB9KSgpXG4pO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIERldGVybWluZXMgd2hldGhlciB0aGUgc3BlY2lmaWVkIFVSTCBpcyBhYnNvbHV0ZVxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSB1cmwgVGhlIFVSTCB0byB0ZXN0XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgc3BlY2lmaWVkIFVSTCBpcyBhYnNvbHV0ZSwgb3RoZXJ3aXNlIGZhbHNlXG4gKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gaXNBYnNvbHV0ZVVSTCh1cmwpIHtcbiAgLy8gQSBVUkwgaXMgY29uc2lkZXJlZCBhYnNvbHV0ZSBpZiBpdCBiZWdpbnMgd2l0aCBcIjxzY2hlbWU+Oi8vXCIgb3IgXCIvL1wiIChwcm90b2NvbC1yZWxhdGl2ZSBVUkwpLlxuICAvLyBSRkMgMzk4NiBkZWZpbmVzIHNjaGVtZSBuYW1lIGFzIGEgc2VxdWVuY2Ugb2YgY2hhcmFjdGVycyBiZWdpbm5pbmcgd2l0aCBhIGxldHRlciBhbmQgZm9sbG93ZWRcbiAgLy8gYnkgYW55IGNvbWJpbmF0aW9uIG9mIGxldHRlcnMsIGRpZ2l0cywgcGx1cywgcGVyaW9kLCBvciBoeXBoZW4uXG4gIHJldHVybiAvXihbYS16XVthLXpcXGRcXCtcXC1cXC5dKjopP1xcL1xcLy9pLnRlc3QodXJsKTtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciB1dGlscyA9IHJlcXVpcmUoJy4vLi4vdXRpbHMnKTtcblxubW9kdWxlLmV4cG9ydHMgPSAoXG4gIHV0aWxzLmlzU3RhbmRhcmRCcm93c2VyRW52KCkgP1xuXG4gIC8vIFN0YW5kYXJkIGJyb3dzZXIgZW52cyBoYXZlIGZ1bGwgc3VwcG9ydCBvZiB0aGUgQVBJcyBuZWVkZWQgdG8gdGVzdFxuICAvLyB3aGV0aGVyIHRoZSByZXF1ZXN0IFVSTCBpcyBvZiB0aGUgc2FtZSBvcmlnaW4gYXMgY3VycmVudCBsb2NhdGlvbi5cbiAgICAoZnVuY3Rpb24gc3RhbmRhcmRCcm93c2VyRW52KCkge1xuICAgICAgdmFyIG1zaWUgPSAvKG1zaWV8dHJpZGVudCkvaS50ZXN0KG5hdmlnYXRvci51c2VyQWdlbnQpO1xuICAgICAgdmFyIHVybFBhcnNpbmdOb2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYScpO1xuICAgICAgdmFyIG9yaWdpblVSTDtcblxuICAgICAgLyoqXG4gICAgKiBQYXJzZSBhIFVSTCB0byBkaXNjb3ZlciBpdCdzIGNvbXBvbmVudHNcbiAgICAqXG4gICAgKiBAcGFyYW0ge1N0cmluZ30gdXJsIFRoZSBVUkwgdG8gYmUgcGFyc2VkXG4gICAgKiBAcmV0dXJucyB7T2JqZWN0fVxuICAgICovXG4gICAgICBmdW5jdGlvbiByZXNvbHZlVVJMKHVybCkge1xuICAgICAgICB2YXIgaHJlZiA9IHVybDtcblxuICAgICAgICBpZiAobXNpZSkge1xuICAgICAgICAvLyBJRSBuZWVkcyBhdHRyaWJ1dGUgc2V0IHR3aWNlIHRvIG5vcm1hbGl6ZSBwcm9wZXJ0aWVzXG4gICAgICAgICAgdXJsUGFyc2luZ05vZGUuc2V0QXR0cmlidXRlKCdocmVmJywgaHJlZik7XG4gICAgICAgICAgaHJlZiA9IHVybFBhcnNpbmdOb2RlLmhyZWY7XG4gICAgICAgIH1cblxuICAgICAgICB1cmxQYXJzaW5nTm9kZS5zZXRBdHRyaWJ1dGUoJ2hyZWYnLCBocmVmKTtcblxuICAgICAgICAvLyB1cmxQYXJzaW5nTm9kZSBwcm92aWRlcyB0aGUgVXJsVXRpbHMgaW50ZXJmYWNlIC0gaHR0cDovL3VybC5zcGVjLndoYXR3Zy5vcmcvI3VybHV0aWxzXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgaHJlZjogdXJsUGFyc2luZ05vZGUuaHJlZixcbiAgICAgICAgICBwcm90b2NvbDogdXJsUGFyc2luZ05vZGUucHJvdG9jb2wgPyB1cmxQYXJzaW5nTm9kZS5wcm90b2NvbC5yZXBsYWNlKC86JC8sICcnKSA6ICcnLFxuICAgICAgICAgIGhvc3Q6IHVybFBhcnNpbmdOb2RlLmhvc3QsXG4gICAgICAgICAgc2VhcmNoOiB1cmxQYXJzaW5nTm9kZS5zZWFyY2ggPyB1cmxQYXJzaW5nTm9kZS5zZWFyY2gucmVwbGFjZSgvXlxcPy8sICcnKSA6ICcnLFxuICAgICAgICAgIGhhc2g6IHVybFBhcnNpbmdOb2RlLmhhc2ggPyB1cmxQYXJzaW5nTm9kZS5oYXNoLnJlcGxhY2UoL14jLywgJycpIDogJycsXG4gICAgICAgICAgaG9zdG5hbWU6IHVybFBhcnNpbmdOb2RlLmhvc3RuYW1lLFxuICAgICAgICAgIHBvcnQ6IHVybFBhcnNpbmdOb2RlLnBvcnQsXG4gICAgICAgICAgcGF0aG5hbWU6ICh1cmxQYXJzaW5nTm9kZS5wYXRobmFtZS5jaGFyQXQoMCkgPT09ICcvJykgP1xuICAgICAgICAgICAgdXJsUGFyc2luZ05vZGUucGF0aG5hbWUgOlxuICAgICAgICAgICAgJy8nICsgdXJsUGFyc2luZ05vZGUucGF0aG5hbWVcbiAgICAgICAgfTtcbiAgICAgIH1cblxuICAgICAgb3JpZ2luVVJMID0gcmVzb2x2ZVVSTCh3aW5kb3cubG9jYXRpb24uaHJlZik7XG5cbiAgICAgIC8qKlxuICAgICogRGV0ZXJtaW5lIGlmIGEgVVJMIHNoYXJlcyB0aGUgc2FtZSBvcmlnaW4gYXMgdGhlIGN1cnJlbnQgbG9jYXRpb25cbiAgICAqXG4gICAgKiBAcGFyYW0ge1N0cmluZ30gcmVxdWVzdFVSTCBUaGUgVVJMIHRvIHRlc3RcbiAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIFVSTCBzaGFyZXMgdGhlIHNhbWUgb3JpZ2luLCBvdGhlcndpc2UgZmFsc2VcbiAgICAqL1xuICAgICAgcmV0dXJuIGZ1bmN0aW9uIGlzVVJMU2FtZU9yaWdpbihyZXF1ZXN0VVJMKSB7XG4gICAgICAgIHZhciBwYXJzZWQgPSAodXRpbHMuaXNTdHJpbmcocmVxdWVzdFVSTCkpID8gcmVzb2x2ZVVSTChyZXF1ZXN0VVJMKSA6IHJlcXVlc3RVUkw7XG4gICAgICAgIHJldHVybiAocGFyc2VkLnByb3RvY29sID09PSBvcmlnaW5VUkwucHJvdG9jb2wgJiZcbiAgICAgICAgICAgIHBhcnNlZC5ob3N0ID09PSBvcmlnaW5VUkwuaG9zdCk7XG4gICAgICB9O1xuICAgIH0pKCkgOlxuXG4gIC8vIE5vbiBzdGFuZGFyZCBicm93c2VyIGVudnMgKHdlYiB3b3JrZXJzLCByZWFjdC1uYXRpdmUpIGxhY2sgbmVlZGVkIHN1cHBvcnQuXG4gICAgKGZ1bmN0aW9uIG5vblN0YW5kYXJkQnJvd3NlckVudigpIHtcbiAgICAgIHJldHVybiBmdW5jdGlvbiBpc1VSTFNhbWVPcmlnaW4oKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfTtcbiAgICB9KSgpXG4pO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuLi91dGlscycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIG5vcm1hbGl6ZUhlYWRlck5hbWUoaGVhZGVycywgbm9ybWFsaXplZE5hbWUpIHtcbiAgdXRpbHMuZm9yRWFjaChoZWFkZXJzLCBmdW5jdGlvbiBwcm9jZXNzSGVhZGVyKHZhbHVlLCBuYW1lKSB7XG4gICAgaWYgKG5hbWUgIT09IG5vcm1hbGl6ZWROYW1lICYmIG5hbWUudG9VcHBlckNhc2UoKSA9PT0gbm9ybWFsaXplZE5hbWUudG9VcHBlckNhc2UoKSkge1xuICAgICAgaGVhZGVyc1tub3JtYWxpemVkTmFtZV0gPSB2YWx1ZTtcbiAgICAgIGRlbGV0ZSBoZWFkZXJzW25hbWVdO1xuICAgIH1cbiAgfSk7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuLy4uL3V0aWxzJyk7XG5cbi8vIEhlYWRlcnMgd2hvc2UgZHVwbGljYXRlcyBhcmUgaWdub3JlZCBieSBub2RlXG4vLyBjLmYuIGh0dHBzOi8vbm9kZWpzLm9yZy9hcGkvaHR0cC5odG1sI2h0dHBfbWVzc2FnZV9oZWFkZXJzXG52YXIgaWdub3JlRHVwbGljYXRlT2YgPSBbXG4gICdhZ2UnLCAnYXV0aG9yaXphdGlvbicsICdjb250ZW50LWxlbmd0aCcsICdjb250ZW50LXR5cGUnLCAnZXRhZycsXG4gICdleHBpcmVzJywgJ2Zyb20nLCAnaG9zdCcsICdpZi1tb2RpZmllZC1zaW5jZScsICdpZi11bm1vZGlmaWVkLXNpbmNlJyxcbiAgJ2xhc3QtbW9kaWZpZWQnLCAnbG9jYXRpb24nLCAnbWF4LWZvcndhcmRzJywgJ3Byb3h5LWF1dGhvcml6YXRpb24nLFxuICAncmVmZXJlcicsICdyZXRyeS1hZnRlcicsICd1c2VyLWFnZW50J1xuXTtcblxuLyoqXG4gKiBQYXJzZSBoZWFkZXJzIGludG8gYW4gb2JqZWN0XG4gKlxuICogYGBgXG4gKiBEYXRlOiBXZWQsIDI3IEF1ZyAyMDE0IDA4OjU4OjQ5IEdNVFxuICogQ29udGVudC1UeXBlOiBhcHBsaWNhdGlvbi9qc29uXG4gKiBDb25uZWN0aW9uOiBrZWVwLWFsaXZlXG4gKiBUcmFuc2Zlci1FbmNvZGluZzogY2h1bmtlZFxuICogYGBgXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGhlYWRlcnMgSGVhZGVycyBuZWVkaW5nIHRvIGJlIHBhcnNlZFxuICogQHJldHVybnMge09iamVjdH0gSGVhZGVycyBwYXJzZWQgaW50byBhbiBvYmplY3RcbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBwYXJzZUhlYWRlcnMoaGVhZGVycykge1xuICB2YXIgcGFyc2VkID0ge307XG4gIHZhciBrZXk7XG4gIHZhciB2YWw7XG4gIHZhciBpO1xuXG4gIGlmICghaGVhZGVycykgeyByZXR1cm4gcGFyc2VkOyB9XG5cbiAgdXRpbHMuZm9yRWFjaChoZWFkZXJzLnNwbGl0KCdcXG4nKSwgZnVuY3Rpb24gcGFyc2VyKGxpbmUpIHtcbiAgICBpID0gbGluZS5pbmRleE9mKCc6Jyk7XG4gICAga2V5ID0gdXRpbHMudHJpbShsaW5lLnN1YnN0cigwLCBpKSkudG9Mb3dlckNhc2UoKTtcbiAgICB2YWwgPSB1dGlscy50cmltKGxpbmUuc3Vic3RyKGkgKyAxKSk7XG5cbiAgICBpZiAoa2V5KSB7XG4gICAgICBpZiAocGFyc2VkW2tleV0gJiYgaWdub3JlRHVwbGljYXRlT2YuaW5kZXhPZihrZXkpID49IDApIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKGtleSA9PT0gJ3NldC1jb29raWUnKSB7XG4gICAgICAgIHBhcnNlZFtrZXldID0gKHBhcnNlZFtrZXldID8gcGFyc2VkW2tleV0gOiBbXSkuY29uY2F0KFt2YWxdKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBhcnNlZFtrZXldID0gcGFyc2VkW2tleV0gPyBwYXJzZWRba2V5XSArICcsICcgKyB2YWwgOiB2YWw7XG4gICAgICB9XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gcGFyc2VkO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBTeW50YWN0aWMgc3VnYXIgZm9yIGludm9raW5nIGEgZnVuY3Rpb24gYW5kIGV4cGFuZGluZyBhbiBhcnJheSBmb3IgYXJndW1lbnRzLlxuICpcbiAqIENvbW1vbiB1c2UgY2FzZSB3b3VsZCBiZSB0byB1c2UgYEZ1bmN0aW9uLnByb3RvdHlwZS5hcHBseWAuXG4gKlxuICogIGBgYGpzXG4gKiAgZnVuY3Rpb24gZih4LCB5LCB6KSB7fVxuICogIHZhciBhcmdzID0gWzEsIDIsIDNdO1xuICogIGYuYXBwbHkobnVsbCwgYXJncyk7XG4gKiAgYGBgXG4gKlxuICogV2l0aCBgc3ByZWFkYCB0aGlzIGV4YW1wbGUgY2FuIGJlIHJlLXdyaXR0ZW4uXG4gKlxuICogIGBgYGpzXG4gKiAgc3ByZWFkKGZ1bmN0aW9uKHgsIHksIHopIHt9KShbMSwgMiwgM10pO1xuICogIGBgYFxuICpcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259XG4gKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gc3ByZWFkKGNhbGxiYWNrKSB7XG4gIHJldHVybiBmdW5jdGlvbiB3cmFwKGFycikge1xuICAgIHJldHVybiBjYWxsYmFjay5hcHBseShudWxsLCBhcnIpO1xuICB9O1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGJpbmQgPSByZXF1aXJlKCcuL2hlbHBlcnMvYmluZCcpO1xudmFyIGlzQnVmZmVyID0gcmVxdWlyZSgnaXMtYnVmZmVyJyk7XG5cbi8qZ2xvYmFsIHRvU3RyaW5nOnRydWUqL1xuXG4vLyB1dGlscyBpcyBhIGxpYnJhcnkgb2YgZ2VuZXJpYyBoZWxwZXIgZnVuY3Rpb25zIG5vbi1zcGVjaWZpYyB0byBheGlvc1xuXG52YXIgdG9TdHJpbmcgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nO1xuXG4vKipcbiAqIERldGVybWluZSBpZiBhIHZhbHVlIGlzIGFuIEFycmF5XG4gKlxuICogQHBhcmFtIHtPYmplY3R9IHZhbCBUaGUgdmFsdWUgdG8gdGVzdFxuICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdmFsdWUgaXMgYW4gQXJyYXksIG90aGVyd2lzZSBmYWxzZVxuICovXG5mdW5jdGlvbiBpc0FycmF5KHZhbCkge1xuICByZXR1cm4gdG9TdHJpbmcuY2FsbCh2YWwpID09PSAnW29iamVjdCBBcnJheV0nO1xufVxuXG4vKipcbiAqIERldGVybWluZSBpZiBhIHZhbHVlIGlzIGFuIEFycmF5QnVmZmVyXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IHZhbCBUaGUgdmFsdWUgdG8gdGVzdFxuICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdmFsdWUgaXMgYW4gQXJyYXlCdWZmZXIsIG90aGVyd2lzZSBmYWxzZVxuICovXG5mdW5jdGlvbiBpc0FycmF5QnVmZmVyKHZhbCkge1xuICByZXR1cm4gdG9TdHJpbmcuY2FsbCh2YWwpID09PSAnW29iamVjdCBBcnJheUJ1ZmZlcl0nO1xufVxuXG4vKipcbiAqIERldGVybWluZSBpZiBhIHZhbHVlIGlzIGEgRm9ybURhdGFcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gdmFsIFRoZSB2YWx1ZSB0byB0ZXN0XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB2YWx1ZSBpcyBhbiBGb3JtRGF0YSwgb3RoZXJ3aXNlIGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzRm9ybURhdGEodmFsKSB7XG4gIHJldHVybiAodHlwZW9mIEZvcm1EYXRhICE9PSAndW5kZWZpbmVkJykgJiYgKHZhbCBpbnN0YW5jZW9mIEZvcm1EYXRhKTtcbn1cblxuLyoqXG4gKiBEZXRlcm1pbmUgaWYgYSB2YWx1ZSBpcyBhIHZpZXcgb24gYW4gQXJyYXlCdWZmZXJcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gdmFsIFRoZSB2YWx1ZSB0byB0ZXN0XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB2YWx1ZSBpcyBhIHZpZXcgb24gYW4gQXJyYXlCdWZmZXIsIG90aGVyd2lzZSBmYWxzZVxuICovXG5mdW5jdGlvbiBpc0FycmF5QnVmZmVyVmlldyh2YWwpIHtcbiAgdmFyIHJlc3VsdDtcbiAgaWYgKCh0eXBlb2YgQXJyYXlCdWZmZXIgIT09ICd1bmRlZmluZWQnKSAmJiAoQXJyYXlCdWZmZXIuaXNWaWV3KSkge1xuICAgIHJlc3VsdCA9IEFycmF5QnVmZmVyLmlzVmlldyh2YWwpO1xuICB9IGVsc2Uge1xuICAgIHJlc3VsdCA9ICh2YWwpICYmICh2YWwuYnVmZmVyKSAmJiAodmFsLmJ1ZmZlciBpbnN0YW5jZW9mIEFycmF5QnVmZmVyKTtcbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuXG4vKipcbiAqIERldGVybWluZSBpZiBhIHZhbHVlIGlzIGEgU3RyaW5nXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IHZhbCBUaGUgdmFsdWUgdG8gdGVzdFxuICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdmFsdWUgaXMgYSBTdHJpbmcsIG90aGVyd2lzZSBmYWxzZVxuICovXG5mdW5jdGlvbiBpc1N0cmluZyh2YWwpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWwgPT09ICdzdHJpbmcnO1xufVxuXG4vKipcbiAqIERldGVybWluZSBpZiBhIHZhbHVlIGlzIGEgTnVtYmVyXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IHZhbCBUaGUgdmFsdWUgdG8gdGVzdFxuICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdmFsdWUgaXMgYSBOdW1iZXIsIG90aGVyd2lzZSBmYWxzZVxuICovXG5mdW5jdGlvbiBpc051bWJlcih2YWwpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWwgPT09ICdudW1iZXInO1xufVxuXG4vKipcbiAqIERldGVybWluZSBpZiBhIHZhbHVlIGlzIHVuZGVmaW5lZFxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSB2YWwgVGhlIHZhbHVlIHRvIHRlc3RcbiAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHRoZSB2YWx1ZSBpcyB1bmRlZmluZWQsIG90aGVyd2lzZSBmYWxzZVxuICovXG5mdW5jdGlvbiBpc1VuZGVmaW5lZCh2YWwpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWwgPT09ICd1bmRlZmluZWQnO1xufVxuXG4vKipcbiAqIERldGVybWluZSBpZiBhIHZhbHVlIGlzIGFuIE9iamVjdFxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSB2YWwgVGhlIHZhbHVlIHRvIHRlc3RcbiAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHZhbHVlIGlzIGFuIE9iamVjdCwgb3RoZXJ3aXNlIGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzT2JqZWN0KHZhbCkge1xuICByZXR1cm4gdmFsICE9PSBudWxsICYmIHR5cGVvZiB2YWwgPT09ICdvYmplY3QnO1xufVxuXG4vKipcbiAqIERldGVybWluZSBpZiBhIHZhbHVlIGlzIGEgRGF0ZVxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSB2YWwgVGhlIHZhbHVlIHRvIHRlc3RcbiAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHZhbHVlIGlzIGEgRGF0ZSwgb3RoZXJ3aXNlIGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzRGF0ZSh2YWwpIHtcbiAgcmV0dXJuIHRvU3RyaW5nLmNhbGwodmFsKSA9PT0gJ1tvYmplY3QgRGF0ZV0nO1xufVxuXG4vKipcbiAqIERldGVybWluZSBpZiBhIHZhbHVlIGlzIGEgRmlsZVxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSB2YWwgVGhlIHZhbHVlIHRvIHRlc3RcbiAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHZhbHVlIGlzIGEgRmlsZSwgb3RoZXJ3aXNlIGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzRmlsZSh2YWwpIHtcbiAgcmV0dXJuIHRvU3RyaW5nLmNhbGwodmFsKSA9PT0gJ1tvYmplY3QgRmlsZV0nO1xufVxuXG4vKipcbiAqIERldGVybWluZSBpZiBhIHZhbHVlIGlzIGEgQmxvYlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSB2YWwgVGhlIHZhbHVlIHRvIHRlc3RcbiAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHZhbHVlIGlzIGEgQmxvYiwgb3RoZXJ3aXNlIGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzQmxvYih2YWwpIHtcbiAgcmV0dXJuIHRvU3RyaW5nLmNhbGwodmFsKSA9PT0gJ1tvYmplY3QgQmxvYl0nO1xufVxuXG4vKipcbiAqIERldGVybWluZSBpZiBhIHZhbHVlIGlzIGEgRnVuY3Rpb25cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gdmFsIFRoZSB2YWx1ZSB0byB0ZXN0XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB2YWx1ZSBpcyBhIEZ1bmN0aW9uLCBvdGhlcndpc2UgZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNGdW5jdGlvbih2YWwpIHtcbiAgcmV0dXJuIHRvU3RyaW5nLmNhbGwodmFsKSA9PT0gJ1tvYmplY3QgRnVuY3Rpb25dJztcbn1cblxuLyoqXG4gKiBEZXRlcm1pbmUgaWYgYSB2YWx1ZSBpcyBhIFN0cmVhbVxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSB2YWwgVGhlIHZhbHVlIHRvIHRlc3RcbiAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHZhbHVlIGlzIGEgU3RyZWFtLCBvdGhlcndpc2UgZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNTdHJlYW0odmFsKSB7XG4gIHJldHVybiBpc09iamVjdCh2YWwpICYmIGlzRnVuY3Rpb24odmFsLnBpcGUpO1xufVxuXG4vKipcbiAqIERldGVybWluZSBpZiBhIHZhbHVlIGlzIGEgVVJMU2VhcmNoUGFyYW1zIG9iamVjdFxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSB2YWwgVGhlIHZhbHVlIHRvIHRlc3RcbiAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHZhbHVlIGlzIGEgVVJMU2VhcmNoUGFyYW1zIG9iamVjdCwgb3RoZXJ3aXNlIGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzVVJMU2VhcmNoUGFyYW1zKHZhbCkge1xuICByZXR1cm4gdHlwZW9mIFVSTFNlYXJjaFBhcmFtcyAhPT0gJ3VuZGVmaW5lZCcgJiYgdmFsIGluc3RhbmNlb2YgVVJMU2VhcmNoUGFyYW1zO1xufVxuXG4vKipcbiAqIFRyaW0gZXhjZXNzIHdoaXRlc3BhY2Ugb2ZmIHRoZSBiZWdpbm5pbmcgYW5kIGVuZCBvZiBhIHN0cmluZ1xuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHIgVGhlIFN0cmluZyB0byB0cmltXG4gKiBAcmV0dXJucyB7U3RyaW5nfSBUaGUgU3RyaW5nIGZyZWVkIG9mIGV4Y2VzcyB3aGl0ZXNwYWNlXG4gKi9cbmZ1bmN0aW9uIHRyaW0oc3RyKSB7XG4gIHJldHVybiBzdHIucmVwbGFjZSgvXlxccyovLCAnJykucmVwbGFjZSgvXFxzKiQvLCAnJyk7XG59XG5cbi8qKlxuICogRGV0ZXJtaW5lIGlmIHdlJ3JlIHJ1bm5pbmcgaW4gYSBzdGFuZGFyZCBicm93c2VyIGVudmlyb25tZW50XG4gKlxuICogVGhpcyBhbGxvd3MgYXhpb3MgdG8gcnVuIGluIGEgd2ViIHdvcmtlciwgYW5kIHJlYWN0LW5hdGl2ZS5cbiAqIEJvdGggZW52aXJvbm1lbnRzIHN1cHBvcnQgWE1MSHR0cFJlcXVlc3QsIGJ1dCBub3QgZnVsbHkgc3RhbmRhcmQgZ2xvYmFscy5cbiAqXG4gKiB3ZWIgd29ya2VyczpcbiAqICB0eXBlb2Ygd2luZG93IC0+IHVuZGVmaW5lZFxuICogIHR5cGVvZiBkb2N1bWVudCAtPiB1bmRlZmluZWRcbiAqXG4gKiByZWFjdC1uYXRpdmU6XG4gKiAgbmF2aWdhdG9yLnByb2R1Y3QgLT4gJ1JlYWN0TmF0aXZlJ1xuICogbmF0aXZlc2NyaXB0XG4gKiAgbmF2aWdhdG9yLnByb2R1Y3QgLT4gJ05hdGl2ZVNjcmlwdCcgb3IgJ05TJ1xuICovXG5mdW5jdGlvbiBpc1N0YW5kYXJkQnJvd3NlckVudigpIHtcbiAgaWYgKHR5cGVvZiBuYXZpZ2F0b3IgIT09ICd1bmRlZmluZWQnICYmIChuYXZpZ2F0b3IucHJvZHVjdCA9PT0gJ1JlYWN0TmF0aXZlJyB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5hdmlnYXRvci5wcm9kdWN0ID09PSAnTmF0aXZlU2NyaXB0JyB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5hdmlnYXRvci5wcm9kdWN0ID09PSAnTlMnKSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICByZXR1cm4gKFxuICAgIHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnICYmXG4gICAgdHlwZW9mIGRvY3VtZW50ICE9PSAndW5kZWZpbmVkJ1xuICApO1xufVxuXG4vKipcbiAqIEl0ZXJhdGUgb3ZlciBhbiBBcnJheSBvciBhbiBPYmplY3QgaW52b2tpbmcgYSBmdW5jdGlvbiBmb3IgZWFjaCBpdGVtLlxuICpcbiAqIElmIGBvYmpgIGlzIGFuIEFycmF5IGNhbGxiYWNrIHdpbGwgYmUgY2FsbGVkIHBhc3NpbmdcbiAqIHRoZSB2YWx1ZSwgaW5kZXgsIGFuZCBjb21wbGV0ZSBhcnJheSBmb3IgZWFjaCBpdGVtLlxuICpcbiAqIElmICdvYmonIGlzIGFuIE9iamVjdCBjYWxsYmFjayB3aWxsIGJlIGNhbGxlZCBwYXNzaW5nXG4gKiB0aGUgdmFsdWUsIGtleSwgYW5kIGNvbXBsZXRlIG9iamVjdCBmb3IgZWFjaCBwcm9wZXJ0eS5cbiAqXG4gKiBAcGFyYW0ge09iamVjdHxBcnJheX0gb2JqIFRoZSBvYmplY3QgdG8gaXRlcmF0ZVxuICogQHBhcmFtIHtGdW5jdGlvbn0gZm4gVGhlIGNhbGxiYWNrIHRvIGludm9rZSBmb3IgZWFjaCBpdGVtXG4gKi9cbmZ1bmN0aW9uIGZvckVhY2gob2JqLCBmbikge1xuICAvLyBEb24ndCBib3RoZXIgaWYgbm8gdmFsdWUgcHJvdmlkZWRcbiAgaWYgKG9iaiA9PT0gbnVsbCB8fCB0eXBlb2Ygb2JqID09PSAndW5kZWZpbmVkJykge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIC8vIEZvcmNlIGFuIGFycmF5IGlmIG5vdCBhbHJlYWR5IHNvbWV0aGluZyBpdGVyYWJsZVxuICBpZiAodHlwZW9mIG9iaiAhPT0gJ29iamVjdCcpIHtcbiAgICAvKmVzbGludCBuby1wYXJhbS1yZWFzc2lnbjowKi9cbiAgICBvYmogPSBbb2JqXTtcbiAgfVxuXG4gIGlmIChpc0FycmF5KG9iaikpIHtcbiAgICAvLyBJdGVyYXRlIG92ZXIgYXJyYXkgdmFsdWVzXG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSBvYmoubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICBmbi5jYWxsKG51bGwsIG9ialtpXSwgaSwgb2JqKTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgLy8gSXRlcmF0ZSBvdmVyIG9iamVjdCBrZXlzXG4gICAgZm9yICh2YXIga2V5IGluIG9iaikge1xuICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIGtleSkpIHtcbiAgICAgICAgZm4uY2FsbChudWxsLCBvYmpba2V5XSwga2V5LCBvYmopO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIEFjY2VwdHMgdmFyYXJncyBleHBlY3RpbmcgZWFjaCBhcmd1bWVudCB0byBiZSBhbiBvYmplY3QsIHRoZW5cbiAqIGltbXV0YWJseSBtZXJnZXMgdGhlIHByb3BlcnRpZXMgb2YgZWFjaCBvYmplY3QgYW5kIHJldHVybnMgcmVzdWx0LlxuICpcbiAqIFdoZW4gbXVsdGlwbGUgb2JqZWN0cyBjb250YWluIHRoZSBzYW1lIGtleSB0aGUgbGF0ZXIgb2JqZWN0IGluXG4gKiB0aGUgYXJndW1lbnRzIGxpc3Qgd2lsbCB0YWtlIHByZWNlZGVuY2UuXG4gKlxuICogRXhhbXBsZTpcbiAqXG4gKiBgYGBqc1xuICogdmFyIHJlc3VsdCA9IG1lcmdlKHtmb286IDEyM30sIHtmb286IDQ1Nn0pO1xuICogY29uc29sZS5sb2cocmVzdWx0LmZvbyk7IC8vIG91dHB1dHMgNDU2XG4gKiBgYGBcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqMSBPYmplY3QgdG8gbWVyZ2VcbiAqIEByZXR1cm5zIHtPYmplY3R9IFJlc3VsdCBvZiBhbGwgbWVyZ2UgcHJvcGVydGllc1xuICovXG5mdW5jdGlvbiBtZXJnZSgvKiBvYmoxLCBvYmoyLCBvYmozLCAuLi4gKi8pIHtcbiAgdmFyIHJlc3VsdCA9IHt9O1xuICBmdW5jdGlvbiBhc3NpZ25WYWx1ZSh2YWwsIGtleSkge1xuICAgIGlmICh0eXBlb2YgcmVzdWx0W2tleV0gPT09ICdvYmplY3QnICYmIHR5cGVvZiB2YWwgPT09ICdvYmplY3QnKSB7XG4gICAgICByZXN1bHRba2V5XSA9IG1lcmdlKHJlc3VsdFtrZXldLCB2YWwpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXN1bHRba2V5XSA9IHZhbDtcbiAgICB9XG4gIH1cblxuICBmb3IgKHZhciBpID0gMCwgbCA9IGFyZ3VtZW50cy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICBmb3JFYWNoKGFyZ3VtZW50c1tpXSwgYXNzaWduVmFsdWUpO1xuICB9XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbi8qKlxuICogRnVuY3Rpb24gZXF1YWwgdG8gbWVyZ2Ugd2l0aCB0aGUgZGlmZmVyZW5jZSBiZWluZyB0aGF0IG5vIHJlZmVyZW5jZVxuICogdG8gb3JpZ2luYWwgb2JqZWN0cyBpcyBrZXB0LlxuICpcbiAqIEBzZWUgbWVyZ2VcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmoxIE9iamVjdCB0byBtZXJnZVxuICogQHJldHVybnMge09iamVjdH0gUmVzdWx0IG9mIGFsbCBtZXJnZSBwcm9wZXJ0aWVzXG4gKi9cbmZ1bmN0aW9uIGRlZXBNZXJnZSgvKiBvYmoxLCBvYmoyLCBvYmozLCAuLi4gKi8pIHtcbiAgdmFyIHJlc3VsdCA9IHt9O1xuICBmdW5jdGlvbiBhc3NpZ25WYWx1ZSh2YWwsIGtleSkge1xuICAgIGlmICh0eXBlb2YgcmVzdWx0W2tleV0gPT09ICdvYmplY3QnICYmIHR5cGVvZiB2YWwgPT09ICdvYmplY3QnKSB7XG4gICAgICByZXN1bHRba2V5XSA9IGRlZXBNZXJnZShyZXN1bHRba2V5XSwgdmFsKTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiB2YWwgPT09ICdvYmplY3QnKSB7XG4gICAgICByZXN1bHRba2V5XSA9IGRlZXBNZXJnZSh7fSwgdmFsKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzdWx0W2tleV0gPSB2YWw7XG4gICAgfVxuICB9XG5cbiAgZm9yICh2YXIgaSA9IDAsIGwgPSBhcmd1bWVudHMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgZm9yRWFjaChhcmd1bWVudHNbaV0sIGFzc2lnblZhbHVlKTtcbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuXG4vKipcbiAqIEV4dGVuZHMgb2JqZWN0IGEgYnkgbXV0YWJseSBhZGRpbmcgdG8gaXQgdGhlIHByb3BlcnRpZXMgb2Ygb2JqZWN0IGIuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IGEgVGhlIG9iamVjdCB0byBiZSBleHRlbmRlZFxuICogQHBhcmFtIHtPYmplY3R9IGIgVGhlIG9iamVjdCB0byBjb3B5IHByb3BlcnRpZXMgZnJvbVxuICogQHBhcmFtIHtPYmplY3R9IHRoaXNBcmcgVGhlIG9iamVjdCB0byBiaW5kIGZ1bmN0aW9uIHRvXG4gKiBAcmV0dXJuIHtPYmplY3R9IFRoZSByZXN1bHRpbmcgdmFsdWUgb2Ygb2JqZWN0IGFcbiAqL1xuZnVuY3Rpb24gZXh0ZW5kKGEsIGIsIHRoaXNBcmcpIHtcbiAgZm9yRWFjaChiLCBmdW5jdGlvbiBhc3NpZ25WYWx1ZSh2YWwsIGtleSkge1xuICAgIGlmICh0aGlzQXJnICYmIHR5cGVvZiB2YWwgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGFba2V5XSA9IGJpbmQodmFsLCB0aGlzQXJnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgYVtrZXldID0gdmFsO1xuICAgIH1cbiAgfSk7XG4gIHJldHVybiBhO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgaXNBcnJheTogaXNBcnJheSxcbiAgaXNBcnJheUJ1ZmZlcjogaXNBcnJheUJ1ZmZlcixcbiAgaXNCdWZmZXI6IGlzQnVmZmVyLFxuICBpc0Zvcm1EYXRhOiBpc0Zvcm1EYXRhLFxuICBpc0FycmF5QnVmZmVyVmlldzogaXNBcnJheUJ1ZmZlclZpZXcsXG4gIGlzU3RyaW5nOiBpc1N0cmluZyxcbiAgaXNOdW1iZXI6IGlzTnVtYmVyLFxuICBpc09iamVjdDogaXNPYmplY3QsXG4gIGlzVW5kZWZpbmVkOiBpc1VuZGVmaW5lZCxcbiAgaXNEYXRlOiBpc0RhdGUsXG4gIGlzRmlsZTogaXNGaWxlLFxuICBpc0Jsb2I6IGlzQmxvYixcbiAgaXNGdW5jdGlvbjogaXNGdW5jdGlvbixcbiAgaXNTdHJlYW06IGlzU3RyZWFtLFxuICBpc1VSTFNlYXJjaFBhcmFtczogaXNVUkxTZWFyY2hQYXJhbXMsXG4gIGlzU3RhbmRhcmRCcm93c2VyRW52OiBpc1N0YW5kYXJkQnJvd3NlckVudixcbiAgZm9yRWFjaDogZm9yRWFjaCxcbiAgbWVyZ2U6IG1lcmdlLFxuICBkZWVwTWVyZ2U6IGRlZXBNZXJnZSxcbiAgZXh0ZW5kOiBleHRlbmQsXG4gIHRyaW06IHRyaW1cbn07XG4iLCIvKiFcbiAqIERldGVybWluZSBpZiBhbiBvYmplY3QgaXMgYSBCdWZmZXJcbiAqXG4gKiBAYXV0aG9yICAgRmVyb3NzIEFib3VraGFkaWplaCA8aHR0cHM6Ly9mZXJvc3Mub3JnPlxuICogQGxpY2Vuc2UgIE1JVFxuICovXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gaXNCdWZmZXIgKG9iaikge1xuICByZXR1cm4gb2JqICE9IG51bGwgJiYgb2JqLmNvbnN0cnVjdG9yICE9IG51bGwgJiZcbiAgICB0eXBlb2Ygb2JqLmNvbnN0cnVjdG9yLmlzQnVmZmVyID09PSAnZnVuY3Rpb24nICYmIG9iai5jb25zdHJ1Y3Rvci5pc0J1ZmZlcihvYmopXG59XG4iLCIvLyBzaGltIGZvciB1c2luZyBwcm9jZXNzIGluIGJyb3dzZXJcbnZhciBwcm9jZXNzID0gbW9kdWxlLmV4cG9ydHMgPSB7fTtcblxuLy8gY2FjaGVkIGZyb20gd2hhdGV2ZXIgZ2xvYmFsIGlzIHByZXNlbnQgc28gdGhhdCB0ZXN0IHJ1bm5lcnMgdGhhdCBzdHViIGl0XG4vLyBkb24ndCBicmVhayB0aGluZ3MuICBCdXQgd2UgbmVlZCB0byB3cmFwIGl0IGluIGEgdHJ5IGNhdGNoIGluIGNhc2UgaXQgaXNcbi8vIHdyYXBwZWQgaW4gc3RyaWN0IG1vZGUgY29kZSB3aGljaCBkb2Vzbid0IGRlZmluZSBhbnkgZ2xvYmFscy4gIEl0J3MgaW5zaWRlIGFcbi8vIGZ1bmN0aW9uIGJlY2F1c2UgdHJ5L2NhdGNoZXMgZGVvcHRpbWl6ZSBpbiBjZXJ0YWluIGVuZ2luZXMuXG5cbnZhciBjYWNoZWRTZXRUaW1lb3V0O1xudmFyIGNhY2hlZENsZWFyVGltZW91dDtcblxuZnVuY3Rpb24gZGVmYXVsdFNldFRpbW91dCgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3NldFRpbWVvdXQgaGFzIG5vdCBiZWVuIGRlZmluZWQnKTtcbn1cbmZ1bmN0aW9uIGRlZmF1bHRDbGVhclRpbWVvdXQgKCkge1xuICAgIHRocm93IG5ldyBFcnJvcignY2xlYXJUaW1lb3V0IGhhcyBub3QgYmVlbiBkZWZpbmVkJyk7XG59XG4oZnVuY3Rpb24gKCkge1xuICAgIHRyeSB7XG4gICAgICAgIGlmICh0eXBlb2Ygc2V0VGltZW91dCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IHNldFRpbWVvdXQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gZGVmYXVsdFNldFRpbW91dDtcbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IGRlZmF1bHRTZXRUaW1vdXQ7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAgIGlmICh0eXBlb2YgY2xlYXJUaW1lb3V0ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBjbGVhclRpbWVvdXQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBkZWZhdWx0Q2xlYXJUaW1lb3V0O1xuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBkZWZhdWx0Q2xlYXJUaW1lb3V0O1xuICAgIH1cbn0gKCkpXG5mdW5jdGlvbiBydW5UaW1lb3V0KGZ1bikge1xuICAgIGlmIChjYWNoZWRTZXRUaW1lb3V0ID09PSBzZXRUaW1lb3V0KSB7XG4gICAgICAgIC8vbm9ybWFsIGVudmlyb21lbnRzIGluIHNhbmUgc2l0dWF0aW9uc1xuICAgICAgICByZXR1cm4gc2V0VGltZW91dChmdW4sIDApO1xuICAgIH1cbiAgICAvLyBpZiBzZXRUaW1lb3V0IHdhc24ndCBhdmFpbGFibGUgYnV0IHdhcyBsYXR0ZXIgZGVmaW5lZFxuICAgIGlmICgoY2FjaGVkU2V0VGltZW91dCA9PT0gZGVmYXVsdFNldFRpbW91dCB8fCAhY2FjaGVkU2V0VGltZW91dCkgJiYgc2V0VGltZW91dCkge1xuICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gc2V0VGltZW91dDtcbiAgICAgICAgcmV0dXJuIHNldFRpbWVvdXQoZnVuLCAwKTtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgLy8gd2hlbiB3aGVuIHNvbWVib2R5IGhhcyBzY3Jld2VkIHdpdGggc2V0VGltZW91dCBidXQgbm8gSS5FLiBtYWRkbmVzc1xuICAgICAgICByZXR1cm4gY2FjaGVkU2V0VGltZW91dChmdW4sIDApO1xuICAgIH0gY2F0Y2goZSl7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBXaGVuIHdlIGFyZSBpbiBJLkUuIGJ1dCB0aGUgc2NyaXB0IGhhcyBiZWVuIGV2YWxlZCBzbyBJLkUuIGRvZXNuJ3QgdHJ1c3QgdGhlIGdsb2JhbCBvYmplY3Qgd2hlbiBjYWxsZWQgbm9ybWFsbHlcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRTZXRUaW1lb3V0LmNhbGwobnVsbCwgZnVuLCAwKTtcbiAgICAgICAgfSBjYXRjaChlKXtcbiAgICAgICAgICAgIC8vIHNhbWUgYXMgYWJvdmUgYnV0IHdoZW4gaXQncyBhIHZlcnNpb24gb2YgSS5FLiB0aGF0IG11c3QgaGF2ZSB0aGUgZ2xvYmFsIG9iamVjdCBmb3IgJ3RoaXMnLCBob3BmdWxseSBvdXIgY29udGV4dCBjb3JyZWN0IG90aGVyd2lzZSBpdCB3aWxsIHRocm93IGEgZ2xvYmFsIGVycm9yXG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkU2V0VGltZW91dC5jYWxsKHRoaXMsIGZ1biwgMCk7XG4gICAgICAgIH1cbiAgICB9XG5cblxufVxuZnVuY3Rpb24gcnVuQ2xlYXJUaW1lb3V0KG1hcmtlcikge1xuICAgIGlmIChjYWNoZWRDbGVhclRpbWVvdXQgPT09IGNsZWFyVGltZW91dCkge1xuICAgICAgICAvL25vcm1hbCBlbnZpcm9tZW50cyBpbiBzYW5lIHNpdHVhdGlvbnNcbiAgICAgICAgcmV0dXJuIGNsZWFyVGltZW91dChtYXJrZXIpO1xuICAgIH1cbiAgICAvLyBpZiBjbGVhclRpbWVvdXQgd2Fzbid0IGF2YWlsYWJsZSBidXQgd2FzIGxhdHRlciBkZWZpbmVkXG4gICAgaWYgKChjYWNoZWRDbGVhclRpbWVvdXQgPT09IGRlZmF1bHRDbGVhclRpbWVvdXQgfHwgIWNhY2hlZENsZWFyVGltZW91dCkgJiYgY2xlYXJUaW1lb3V0KSB7XG4gICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGNsZWFyVGltZW91dDtcbiAgICAgICAgcmV0dXJuIGNsZWFyVGltZW91dChtYXJrZXIpO1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgICAvLyB3aGVuIHdoZW4gc29tZWJvZHkgaGFzIHNjcmV3ZWQgd2l0aCBzZXRUaW1lb3V0IGJ1dCBubyBJLkUuIG1hZGRuZXNzXG4gICAgICAgIHJldHVybiBjYWNoZWRDbGVhclRpbWVvdXQobWFya2VyKTtcbiAgICB9IGNhdGNoIChlKXtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIFdoZW4gd2UgYXJlIGluIEkuRS4gYnV0IHRoZSBzY3JpcHQgaGFzIGJlZW4gZXZhbGVkIHNvIEkuRS4gZG9lc24ndCAgdHJ1c3QgdGhlIGdsb2JhbCBvYmplY3Qgd2hlbiBjYWxsZWQgbm9ybWFsbHlcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRDbGVhclRpbWVvdXQuY2FsbChudWxsLCBtYXJrZXIpO1xuICAgICAgICB9IGNhdGNoIChlKXtcbiAgICAgICAgICAgIC8vIHNhbWUgYXMgYWJvdmUgYnV0IHdoZW4gaXQncyBhIHZlcnNpb24gb2YgSS5FLiB0aGF0IG11c3QgaGF2ZSB0aGUgZ2xvYmFsIG9iamVjdCBmb3IgJ3RoaXMnLCBob3BmdWxseSBvdXIgY29udGV4dCBjb3JyZWN0IG90aGVyd2lzZSBpdCB3aWxsIHRocm93IGEgZ2xvYmFsIGVycm9yLlxuICAgICAgICAgICAgLy8gU29tZSB2ZXJzaW9ucyBvZiBJLkUuIGhhdmUgZGlmZmVyZW50IHJ1bGVzIGZvciBjbGVhclRpbWVvdXQgdnMgc2V0VGltZW91dFxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZENsZWFyVGltZW91dC5jYWxsKHRoaXMsIG1hcmtlcik7XG4gICAgICAgIH1cbiAgICB9XG5cblxuXG59XG52YXIgcXVldWUgPSBbXTtcbnZhciBkcmFpbmluZyA9IGZhbHNlO1xudmFyIGN1cnJlbnRRdWV1ZTtcbnZhciBxdWV1ZUluZGV4ID0gLTE7XG5cbmZ1bmN0aW9uIGNsZWFuVXBOZXh0VGljaygpIHtcbiAgICBpZiAoIWRyYWluaW5nIHx8ICFjdXJyZW50UXVldWUpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGlmIChjdXJyZW50UXVldWUubGVuZ3RoKSB7XG4gICAgICAgIHF1ZXVlID0gY3VycmVudFF1ZXVlLmNvbmNhdChxdWV1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgIH1cbiAgICBpZiAocXVldWUubGVuZ3RoKSB7XG4gICAgICAgIGRyYWluUXVldWUoKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRyYWluUXVldWUoKSB7XG4gICAgaWYgKGRyYWluaW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIHRpbWVvdXQgPSBydW5UaW1lb3V0KGNsZWFuVXBOZXh0VGljayk7XG4gICAgZHJhaW5pbmcgPSB0cnVlO1xuXG4gICAgdmFyIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB3aGlsZShsZW4pIHtcbiAgICAgICAgY3VycmVudFF1ZXVlID0gcXVldWU7XG4gICAgICAgIHF1ZXVlID0gW107XG4gICAgICAgIHdoaWxlICgrK3F1ZXVlSW5kZXggPCBsZW4pIHtcbiAgICAgICAgICAgIGlmIChjdXJyZW50UXVldWUpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50UXVldWVbcXVldWVJbmRleF0ucnVuKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgICAgICBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgfVxuICAgIGN1cnJlbnRRdWV1ZSA9IG51bGw7XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBydW5DbGVhclRpbWVvdXQodGltZW91dCk7XG59XG5cbnByb2Nlc3MubmV4dFRpY2sgPSBmdW5jdGlvbiAoZnVuKSB7XG4gICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkoYXJndW1lbnRzLmxlbmd0aCAtIDEpO1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcXVldWUucHVzaChuZXcgSXRlbShmdW4sIGFyZ3MpKTtcbiAgICBpZiAocXVldWUubGVuZ3RoID09PSAxICYmICFkcmFpbmluZykge1xuICAgICAgICBydW5UaW1lb3V0KGRyYWluUXVldWUpO1xuICAgIH1cbn07XG5cbi8vIHY4IGxpa2VzIHByZWRpY3RpYmxlIG9iamVjdHNcbmZ1bmN0aW9uIEl0ZW0oZnVuLCBhcnJheSkge1xuICAgIHRoaXMuZnVuID0gZnVuO1xuICAgIHRoaXMuYXJyYXkgPSBhcnJheTtcbn1cbkl0ZW0ucHJvdG90eXBlLnJ1biA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmZ1bi5hcHBseShudWxsLCB0aGlzLmFycmF5KTtcbn07XG5wcm9jZXNzLnRpdGxlID0gJ2Jyb3dzZXInO1xucHJvY2Vzcy5icm93c2VyID0gdHJ1ZTtcbnByb2Nlc3MuZW52ID0ge307XG5wcm9jZXNzLmFyZ3YgPSBbXTtcbnByb2Nlc3MudmVyc2lvbiA9ICcnOyAvLyBlbXB0eSBzdHJpbmcgdG8gYXZvaWQgcmVnZXhwIGlzc3Vlc1xucHJvY2Vzcy52ZXJzaW9ucyA9IHt9O1xuXG5mdW5jdGlvbiBub29wKCkge31cblxucHJvY2Vzcy5vbiA9IG5vb3A7XG5wcm9jZXNzLmFkZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3Mub25jZSA9IG5vb3A7XG5wcm9jZXNzLm9mZiA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUxpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlQWxsTGlzdGVuZXJzID0gbm9vcDtcbnByb2Nlc3MuZW1pdCA9IG5vb3A7XG5wcm9jZXNzLnByZXBlbmRMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLnByZXBlbmRPbmNlTGlzdGVuZXIgPSBub29wO1xuXG5wcm9jZXNzLmxpc3RlbmVycyA9IGZ1bmN0aW9uIChuYW1lKSB7IHJldHVybiBbXSB9XG5cbnByb2Nlc3MuYmluZGluZyA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmJpbmRpbmcgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcblxucHJvY2Vzcy5jd2QgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnLycgfTtcbnByb2Nlc3MuY2hkaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmNoZGlyIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5wcm9jZXNzLnVtYXNrID0gZnVuY3Rpb24oKSB7IHJldHVybiAwOyB9O1xuIiwi77u/J3VzZSBzdHJpY3QnXHJcblxyXG52YXIgUGxheWVyID0gcmVxdWlyZSgnLi4vZG5kL3BsYXllci5qcycpXHJcbnZhciBOcGMgPSByZXF1aXJlKCcuLi9kbmQvbnBjLmpzJylcclxuXHJcbnZhciBwbGF5ZXJzID0gW11cclxudmFyIG5wY3MgPSBbXVxyXG5cclxudmFyIGxhc3RJZCA9IDBcclxuXHJcbnZhciBwbGF5ZXJCeUlkID0gZnVuY3Rpb24gKGlkKSB7XHJcbiAgICB2YXIgcGxheWVyID0gbnVsbFxyXG5cclxuICAgIGlmIChVdGlscy5pc051bWVyaWMoaWQpKSB7XHJcbiAgICAgICAgcGxheWVyID0gcGxheWVycy5maWx0ZXIoKGEpID0+IGEuaWQgPT09IGlkKVxyXG4gICAgICAgIGlmIChwbGF5ZXIubGVuZ3RoID4gMClcclxuICAgICAgICAgICAgcmV0dXJuIHBsYXllclswXVxyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBwbGF5ZXJcclxufVxyXG5cclxudmFyIG5wY0J5SWQgPSBmdW5jdGlvbiAoaWQpIHtcclxuICAgIHZhciBucGMgPSBudWxsO1xyXG5cclxuICAgIGlmIChVdGlscy5pc051bWVyaWMoaWQpKSB7XHJcbiAgICAgICAgbnBjID0gbnBjcy5maWx0ZXIoKGEpID0+IGEuaWQgPT09IGlkKVxyXG4gICAgICAgIGlmIChucGMubGVuZ3RoID4gMClcclxuICAgICAgICAgICAgcmV0dXJuIG5wY1swXVxyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBucGNcclxufVxyXG5cclxudmFyIGFkZE5wYyA9IGZ1bmN0aW9uIChucGMpIHtcclxuICAgIGlmICh0eXBlb2YgbnBjLmlkICE9PSAnbnVtYmVyJyB8fCBucGMuaWQgPT09IDApIHtcclxuICAgICAgICBsYXN0SWQrK1xyXG4gICAgICAgIG5wYy5pZCA9IGxhc3RJZFxyXG4gICAgfVxyXG5cclxuICAgIGlmIChucGMuY29tcGFuaW9uKSBucGMuY29tcGFuaW9uLmlkID0gbnBjLmlkXHJcbiAgICBucGNzLnB1c2gobnBjKVxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cy5wdWxsID0gKGRhdGEsIGZyZXNoKSA9PiB7XHJcbiAgICBwbGF5ZXJzLmxlbmd0aCA9IDBcclxuICAgIG5wY3MubGVuZ3RoID0gMFxyXG5cclxuICAgIGZvciAodmFyIGkgPSAwLCBsID0gZGF0YS5wbGF5ZXJzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xyXG4gICAgICAgIGlmICh0eXBlb2YgZGF0YS5wbGF5ZXJzW2ldLmlkICE9PSAnbnVtYmVyJykge1xyXG4gICAgICAgICAgICBsYXN0SWQrK1xyXG4gICAgICAgICAgICBkYXRhLnBsYXllcnNbaV0uaWQgPSBsYXN0SWRcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHZhciBwID0gbmV3IFBsYXllcigpXHJcbiAgICAgICAgcC5wYXJzZShkYXRhLnBsYXllcnNbaV0pXHJcbiAgICAgICAgcGxheWVycy5wdXNoKHApXHJcbiAgICB9XHJcblxyXG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSBkYXRhLm5wY3MubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XHJcbiAgICAgICAgaWYgKHR5cGVvZiBkYXRhLm5wY3NbaV0uaWQgIT09ICdudW1iZXInKSB7XHJcbiAgICAgICAgICAgIGxhc3RJZCsrXHJcbiAgICAgICAgICAgIGRhdGEubnBjc1tpXS5pZCA9IGxhc3RJZFxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdmFyIG4gPSBuZXcgTnBjKClcclxuICAgICAgICBuLnBhcnNlKGRhdGEubnBjc1tpXSlcclxuXHJcbiAgICAgICAgaWYgKHR5cGVvZiBkYXRhLm5wY3NbaV0uY29tcGFuaW9uICE9PSBcInVuZGVmaW5lZFwiKSB7XHJcbiAgICAgICAgICAgIG4uY29tcGFuaW9uLmlkID0gZGF0YS5ucGNzW2ldLmlkXHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBucGNzLnB1c2gobilcclxuICAgIH1cclxuXHJcbiAgICBpZiAoZnJlc2gpIHB1c2goKVxyXG59XHJcblxyXG52YXIgcHVzaCA9ICgpID0+IHtcclxuICAgIHZhciBvdXQgPSB7XHJcbiAgICAgICAgbnBjczogW10sXHJcbiAgICAgICAgcGxheWVyczogW11cclxuICAgIH1cclxuXHJcbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IG5wY3MubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XHJcbiAgICAgICAgb3V0Lm5wY3MucHVzaChucGNzW2ldLnNlcmlhbGl6ZSgpKVxyXG4gICAgfVxyXG5cclxuICAgIGZvciAodmFyIGkgPSAwLCBsID0gcGxheWVycy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICBvdXQucGxheWVycy5wdXNoKHBsYXllcnNbaV0uc2VyaWFsaXplKCkpXHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIG91dFxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cy5wdXNoID0gcHVzaFxyXG5cclxubW9kdWxlLmV4cG9ydHMucmVzZXQgPSAoKSA9PiB7IH1cclxuXHJcbm1vZHVsZS5leHBvcnRzLmNoYXJzQnlTdGF0ZSA9IChjdXJTdGF0ZSwgY2FsbGJhY2spID0+IHtcclxuICAgIGlmIChVdGlscy5pc0Z1bmN0aW9uKGNhbGxiYWNrKSkge1xyXG4gICAgICAgIHZhciBvdXRwdXQgPSBbXVxyXG5cclxuICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IHBsYXllcnMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XHJcbiAgICAgICAgICAgIGlmIChwbGF5ZXJzW2ldLnN0YXRlID09PSBjdXJTdGF0ZSlcclxuICAgICAgICAgICAgICAgIG91dHB1dC5wdXNoKHBsYXllcnNbaV0pXHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IG5wY3MubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XHJcbiAgICAgICAgICAgIGlmIChucGNzW2ldLnN0YXRlID09PSBjdXJTdGF0ZSlcclxuICAgICAgICAgICAgICAgIG91dHB1dC5wdXNoKG5wY3NbaV0pXHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBpZiBpbiBhbiBlbmNvdW50ZXIsIHNvcnQgYnkgaW5pdGlhdGl2ZSBvcmRlclxyXG4gICAgICAgIGlmIChjdXJTdGF0ZSA9PT0gQ2hhcmFjdGVyU3RhdGUuRW5jb3VudGVyKSB7XHJcbiAgICAgICAgICAgIG91dHB1dC5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYi5pbml0aWF0aXZlIC0gYS5pbml0aWF0aXZlO1xyXG4gICAgICAgICAgICB9KVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBvdXRwdXQubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XHJcbiAgICAgICAgICAgIGNhbGxiYWNrLmNhbGwob3V0cHV0W2ldKVxyXG4gICAgICAgIH1cclxuICAgIH1cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMudXBkYXRlUGxheWVyID0gKGlkLCBhY3Rpb24sIHBhcmFtcykgPT4ge1xyXG4gICAgdmFyIHBsYXllciA9IHBsYXllckJ5SWQoaWQpXHJcbiAgICBpZiAoIXBsYXllcikgcmV0dXJuXHJcblxyXG4gICAgc3dpdGNoIChhY3Rpb24pIHtcclxuICAgICAgICBjYXNlIENoYXJhY3RlckFjdGlvbi5Jbml0aWF0aXZlOlxyXG4gICAgICAgICAgICBwbGF5ZXIuYXBwbHlJbml0aWF0aXZlKHBhcmFtc1swXSlcclxuICAgICAgICAgICAgYnJlYWtcclxuICAgICAgICBjYXNlIENoYXJhY3RlckFjdGlvbi5MZWF2ZTpcclxuICAgICAgICAgICAgcGxheWVyLmxlYXZlRW5jb3VudGVyKClcclxuICAgICAgICAgICAgYnJlYWtcclxuICAgICAgICBjYXNlIENoYXJhY3RlckFjdGlvbi5SZXZpdmU6XHJcbiAgICAgICAgICAgIHBsYXllci5yZXZpdmUoKVxyXG4gICAgICAgICAgICBicmVha1xyXG4gICAgICAgIGNhc2UgQ2hhcmFjdGVyQWN0aW9uLkRpZTpcclxuICAgICAgICAgICAgcGxheWVyLmRpZSgpXHJcbiAgICAgICAgICAgIGJyZWFrXHJcbiAgICB9XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzLnVwZGF0ZU5wYyA9IChpZCwgYWN0aW9uLCBwYXJhbXMpID0+IHtcclxuICAgIHZhciBjdXJyZW50TnBjID0gbnBjQnlJZChpZClcclxuICAgIGlmICghY3VycmVudE5wYykgcmV0dXJuXHJcblxyXG4gICAgc3dpdGNoIChhY3Rpb24pIHtcclxuICAgICAgICBjYXNlIENoYXJhY3RlckFjdGlvbi5EYW1hZ2U6XHJcbiAgICAgICAgICAgIGN1cnJlbnROcGMuYXBwbHlEYW1hZ2UocGFyYW1zWzBdKVxyXG4gICAgICAgICAgICBicmVha1xyXG4gICAgICAgIGNhc2UgQ2hhcmFjdGVyQWN0aW9uLkluaXRpYXRpdmU6XHJcbiAgICAgICAgICAgIGlmIChjdXJyZW50TnBjLnRlbXBsYXRlKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgbiA9IGN1cnJlbnROcGMuY2xvbmUoKVxyXG4gICAgICAgICAgICAgICAgYWRkTnBjKG4pXHJcbiAgICAgICAgICAgICAgICBjdXJyZW50TnBjID0gblxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGN1cnJlbnROcGMucm9sbEluaXRpYXRpdmUoKVxyXG4gICAgICAgICAgICBicmVha1xyXG4gICAgICAgIGNhc2UgQ2hhcmFjdGVyQWN0aW9uLkxlYXZlOlxyXG4gICAgICAgICAgICBjdXJyZW50TnBjLmxlYXZlRW5jb3VudGVyKClcclxuICAgICAgICAgICAgYnJlYWtcclxuICAgICAgICBjYXNlIENoYXJhY3RlckFjdGlvbi5SZXZpdmU6XHJcbiAgICAgICAgICAgIGN1cnJlbnROcGMucmV2aXZlKClcclxuICAgICAgICAgICAgYnJlYWtcclxuICAgICAgICBjYXNlIENoYXJhY3RlckFjdGlvbi5EaWU6XHJcbiAgICAgICAgICAgIGN1cnJlbnROcGMuZGllKClcclxuICAgICAgICAgICAgYnJlYWtcclxuICAgIH1cclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMudXBkYXRlQ29tcGFuaW9uID0gKGlkLCBhY3Rpb24sIHBhcmFtcykgPT4ge1xyXG4gICAgdmFyIGN1cnJlbnROcGMgPSBucGNCeUlkKGlkKVxyXG4gICAgaWYgKCFjdXJyZW50TnBjKSByZXR1cm5cclxuXHJcbiAgICBzd2l0Y2ggKGFjdGlvbikge1xyXG4gICAgICAgIGNhc2UgQ2hhcmFjdGVyQWN0aW9uLkRhbWFnZTpcclxuICAgICAgICAgICAgY3VycmVudE5wYy5jb21wYW5pb24uYXBwbHlEYW1hZ2UocGFyYW1zWzBdKVxyXG4gICAgICAgICAgICBicmVha1xyXG4gICAgICAgIGNhc2UgQ2hhcmFjdGVyQWN0aW9uLlJldml2ZTpcclxuICAgICAgICAgICAgY3VycmVudE5wYy5jb21wYW5pb24ucmV2aXZlKClcclxuICAgICAgICAgICAgYnJlYWtcclxuICAgICAgICBjYXNlIENoYXJhY3RlckFjdGlvbi5EaWU6XHJcbiAgICAgICAgICAgIGN1cnJlbnROcGMuY29tcGFuaW9uLmRpZSgpXHJcbiAgICAgICAgICAgIGJyZWFrXHJcbiAgICB9XHJcbn1cclxuIiwi77u/J3VzZSBzdHJpY3QnXHJcblxyXG5jb25zdCBheGlvcyA9IHJlcXVpcmUoJ2F4aW9zJylcclxuY29uc3Qgc3RvcmFnZUtleSA9ICdPc3NhcmlhU2Vzc2lvblNldmVuJ1xyXG5cclxudmFyIHNhdmUgPSAoZGF0YSkgPT4gbG9jYWxTdG9yYWdlLnNldEl0ZW0oc3RvcmFnZUtleSwgZGF0YSlcclxuXHJcbnZhciBmZXRjaEpzb24gPSAoKSA9PiB7XHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgICAgIGF4aW9zLmdldChnbG9iYWwuRGF0YUZpbGUpXHJcbiAgICAgICAgICAgIC50aGVuKGZ1bmN0aW9uIChyZXNwb25zZSkge1xyXG4gICAgICAgICAgICAgICAgc2F2ZShKU09OLnN0cmluZ2lmeShyZXNwb25zZS5kYXRhKSk7XHJcbiAgICAgICAgICAgICAgICByZXNvbHZlKFtyZXNwb25zZS5kYXRhLCB0cnVlXSlcclxuICAgICAgICAgICAgfSlcclxuICAgICAgICAgICAgLmNhdGNoKGZ1bmN0aW9uIChlcnJvcikge1xyXG4gICAgICAgICAgICAgICAgcmVqZWN0KGVycm9yKVxyXG4gICAgICAgICAgICB9KVxyXG4gICAgfSlcclxufVxyXG5cclxudmFyIHB1bGxJbm5lciA9IChyYXcpID0+IHtcclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgcmVzb2x2ZShbSlNPTi5wYXJzZShyYXcpLCBmYWxzZV0pXHJcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgICAgICAgIHJlamVjdChlcnIpXHJcbiAgICAgICAgfVxyXG4gICAgfSlcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMucHVsbCA9ICgpID0+IHtcclxuICAgIHZhciBmcm9tU3RvcmFnZSA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKHN0b3JhZ2VLZXkpO1xyXG4gICAgcmV0dXJuIGZyb21TdG9yYWdlID9cclxuICAgICAgICBwdWxsSW5uZXIoZnJvbVN0b3JhZ2UpIDpcclxuICAgICAgICBmZXRjaEpzb24oKVxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cy5wdXNoID0gKGRhdGEpID0+IHtcclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgc2F2ZShKU09OLnN0cmluZ2lmeShkYXRhKSlcclxuICAgICAgICAgICAgcmVzb2x2ZSgpXHJcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgICAgICAgIHJlamVjdChlcnIpXHJcbiAgICAgICAgfVxyXG4gICAgfSlcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMucmVzZXQgPSAoKSA9PiB7XHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKHN0b3JhZ2VLZXkpXHJcbiAgICAgICAgICAgIHJlc29sdmUoKVxyXG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xyXG4gICAgICAgICAgICByZWplY3QoZXJyKVxyXG4gICAgICAgIH1cclxuICAgIH0pXHJcbn1cclxuIiwi77u/J3VzZSBzdHJpY3QnXHJcblxyXG52YXIgRW50aXRpZXMgPSByZXF1aXJlKCcuL2VudGl0aWVzLmpzJylcclxudmFyIFN0b3JhZ2UgPSByZXF1aXJlKCcuL3N0b3JhZ2UuanMnKVxyXG5cclxudmFyIGFjdGl2ZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhY3RpdmUnKVxyXG52YXIgaW5hY3RpdmUgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaW5hY3RpdmUnKVxyXG52YXIgZGVhZGd1eXMgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZGVhZGd1eXMnKVxyXG5cclxudmFyIHVwZGF0ZSA9IGZ1bmN0aW9uICgpIHtcclxuICAgIFN0b3JhZ2UucHVzaChFbnRpdGllcy5wdXNoKCkpLnRoZW4oKCkgPT4ge1xyXG4gICAgICAgIHJlbmRlcigpXHJcbiAgICB9KVxyXG59XHJcblxyXG52YXIgcmVuZGVyID0gZnVuY3Rpb24gKCkge1xyXG4gICAgYWN0aXZlLmlubmVySFRNTCA9ICcnXHJcbiAgICBpbmFjdGl2ZS5pbm5lckhUTUwgPSAnJ1xyXG4gICAgZGVhZGd1eXMuaW5uZXJIVE1MID0gJydcclxuXHJcbiAgICBFbnRpdGllcy5jaGFyc0J5U3RhdGUoQ2hhcmFjdGVyU3RhdGUuRW5jb3VudGVyLCBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdmFyIHJvdyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3RyJylcclxuICAgICAgICB2YXIgY2VsbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3RkJylcclxuXHJcbiAgICAgICAgY2VsbC5pbm5lckhUTUwgPSB0aGlzLnJlbmRlcigpXHJcblxyXG4gICAgICAgIHJvdy5hcHBlbmRDaGlsZChjZWxsKVxyXG4gICAgICAgIGFjdGl2ZS5hcHBlbmRDaGlsZChyb3cpXHJcbiAgICB9KVxyXG5cclxuICAgIEVudGl0aWVzLmNoYXJzQnlTdGF0ZShDaGFyYWN0ZXJTdGF0ZS5JZGxlLCBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdmFyIHJvdyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3RyJylcclxuICAgICAgICB2YXIgY2VsbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3RkJylcclxuXHJcbiAgICAgICAgY2VsbC5pbm5lckhUTUwgPSB0aGlzLnJlbmRlcigpXHJcblxyXG4gICAgICAgIHJvdy5hcHBlbmRDaGlsZChjZWxsKVxyXG4gICAgICAgIGluYWN0aXZlLmFwcGVuZENoaWxkKHJvdylcclxuICAgIH0pXHJcblxyXG4gICAgRW50aXRpZXMuY2hhcnNCeVN0YXRlKENoYXJhY3RlclN0YXRlLkRlYWQsIGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB2YXIgcm93ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgndHInKVxyXG4gICAgICAgIHZhciBjZWxsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgndGQnKVxyXG5cclxuICAgICAgICBjZWxsLmlubmVySFRNTCA9IHRoaXMucmVuZGVyKClcclxuXHJcbiAgICAgICAgcm93LmFwcGVuZENoaWxkKGNlbGwpXHJcbiAgICAgICAgZGVhZGd1eXMuYXBwZW5kQ2hpbGQocm93KVxyXG4gICAgfSlcclxufVxyXG5cclxudmFyIGFkZExpc3RlbmVyID0gZnVuY3Rpb24gKCkge1xyXG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBmdW5jdGlvbiAoZSkge1xyXG4gICAgICAgIGlmIChlLnRhcmdldCkge1xyXG4gICAgICAgICAgICB2YXIgZG9VcGRhdGUgPSB0cnVlO1xyXG4gICAgICAgICAgICB2YXIgaWQgPSBwYXJzZUludChlLnRhcmdldC5nZXRBdHRyaWJ1dGUoJ2RhdGEtaWQnKSlcclxuXHJcbiAgICAgICAgICAgIHN3aXRjaCAoZS50YXJnZXQuY2xhc3NOYW1lKSB7XHJcbiAgICAgICAgICAgICAgICBjYXNlICdoYXJkX3Jlc2V0JzpcclxuICAgICAgICAgICAgICAgICAgICBkb1VwZGF0ZSA9IGZhbHNlXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNvbmZpcm0oJ0FyZSB5b3Ugc3VyZT8gVGhpcyBjYW5ub3QgYmUgdW5kb25lLicpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBjZWxsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ21haW4tY29udGVudCcpXHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICBTdG9yYWdlLnJlc2V0KCkudGhlbigoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBFbnRpdGllcy5yZXNldCgpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjZWxsLmlubmVySFRNTCA9ICdyZXNldHRpbmcgdXAgaW4gaGVyZSdcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4gd2luZG93LmxvY2F0aW9uLnJlbG9hZCgpLCA2MDApXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgY2FzZSAncGxheWVyX2luaXRpYXRpdmUnOlxyXG4gICAgICAgICAgICAgICAgICAgIHZhciBpbml0aWF0aXZlID0gcGFyc2VJbnQoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BsYXllcl9pbml0aWF0aXZlXycgKyBpZCkudmFsdWUpXHJcbiAgICAgICAgICAgICAgICAgICAgRW50aXRpZXMudXBkYXRlUGxheWVyKGlkLCBDaGFyYWN0ZXJBY3Rpb24uSW5pdGlhdGl2ZSwgW2luaXRpYXRpdmVdKVxyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgY2FzZSAncGxheWVyX2xlYXZlJzpcclxuICAgICAgICAgICAgICAgICAgICBFbnRpdGllcy51cGRhdGVQbGF5ZXIoaWQsIENoYXJhY3RlckFjdGlvbi5MZWF2ZSlcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIGNhc2UgJ3BsYXllcl9yZXZpdmUnOlxyXG4gICAgICAgICAgICAgICAgICAgIEVudGl0aWVzLnVwZGF0ZVBsYXllcihpZCwgQ2hhcmFjdGVyQWN0aW9uLlJldml2ZSlcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIGNhc2UgJ3BsYXllcl9kaWUnOlxyXG4gICAgICAgICAgICAgICAgICAgIEVudGl0aWVzLnVwZGF0ZVBsYXllcihpZCwgQ2hhcmFjdGVyQWN0aW9uLkRpZSlcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIGNhc2UgJ25wY19pbml0aWF0aXZlJzpcclxuICAgICAgICAgICAgICAgICAgICBFbnRpdGllcy51cGRhdGVOcGMoaWQsIENoYXJhY3RlckFjdGlvbi5Jbml0aWF0aXZlKVxyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgY2FzZSAnbnBjX2RhbWFnZSc6XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGRhbWFnZSA9IHBhcnNlSW50KGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCducGNfZGFtYWdlXycgKyBpZCkudmFsdWUpXHJcbiAgICAgICAgICAgICAgICAgICAgRW50aXRpZXMudXBkYXRlTnBjKGlkLCBDaGFyYWN0ZXJBY3Rpb24uRGFtYWdlLCBbZGFtYWdlXSlcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIGNhc2UgJ25wY19sZWF2ZSc6XHJcbiAgICAgICAgICAgICAgICAgICAgRW50aXRpZXMudXBkYXRlTnBjKGlkLCBDaGFyYWN0ZXJBY3Rpb24uTGVhdmUpXHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICBjYXNlICducGNfcmV2aXZlJzpcclxuICAgICAgICAgICAgICAgICAgICBFbnRpdGllcy51cGRhdGVOcGMoaWQsIENoYXJhY3RlckFjdGlvbi5SZXZpdmUpXHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICBjYXNlICducGNfZGllJzpcclxuICAgICAgICAgICAgICAgICAgICBFbnRpdGllcy51cGRhdGVOcGMoaWQsIENoYXJhY3RlckFjdGlvbi5EaWUpXHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICBjYXNlICdjb21wYW5pb25fZGFtYWdlJzpcclxuICAgICAgICAgICAgICAgICAgICB2YXIgZGFtYWdlID0gcGFyc2VJbnQoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NvbXBhbmlvbl9kYW1hZ2VfJyArIGlkKS52YWx1ZSlcclxuICAgICAgICAgICAgICAgICAgICBFbnRpdGllcy51cGRhdGVDb21wYW5pb24oaWQsIENoYXJhY3RlckFjdGlvbi5EYW1hZ2UsIFtkYW1hZ2VdKVxyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgY2FzZSAnY29tcGFuaW9uX3Jldml2ZSc6XHJcbiAgICAgICAgICAgICAgICAgICAgRW50aXRpZXMudXBkYXRlQ29tcGFuaW9uKGlkLCBDaGFyYWN0ZXJBY3Rpb24uUmV2aXZlKVxyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgY2FzZSAnY29tcGFuaW9uX2RpZSc6XHJcbiAgICAgICAgICAgICAgICAgICAgRW50aXRpZXMudXBkYXRlQ29tcGFuaW9uKGlkLCBDaGFyYWN0ZXJBY3Rpb24uRGllKVxyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgICAgICBkb1VwZGF0ZSA9IGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBpZiAoZG9VcGRhdGUpIHVwZGF0ZSgpXHJcbiAgICAgICAgfVxyXG4gICAgfSlcclxufVxyXG5cclxudmFyIHJ1biA9IGZ1bmN0aW9uICgpIHtcclxuICAgIGFkZExpc3RlbmVyKClcclxuXHJcbiAgICBTdG9yYWdlLnB1bGwoKS50aGVuKChbZGF0YSwgZnJlc2hdKSA9PiB7XHJcbiAgICAgICAgRW50aXRpZXMucHVsbChkYXRhLCBmcmVzaClcclxuICAgICAgICByZW5kZXIoKVxyXG4gICAgfSlcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSB7XHJcbiAgICBydW46IHJ1blxyXG59Iiwi77u/J3VzZSBzdHJpY3QnXHJcblxyXG52YXIgV2VhcG9uID0gcmVxdWlyZSgnLi93ZWFwb24uanMnKVxyXG5cclxudmFyIGNvbXBhbmlvbiA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHRoaXMuaWQgPSAwXHJcbiAgICB0aGlzLm5hbWUgPSAnJ1xyXG4gICAgdGhpcy5oZWFsdGggPSA1XHJcbiAgICB0aGlzLmFybW9yID0gMTBcclxuICAgIHRoaXMuc3BlZWQgPSAxNVxyXG4gICAgdGhpcy5yYWNlID0gJ1dvbGYnXHJcbiAgICB0aGlzLndlYXBvbnMgPSBbXVxyXG4gICAgdGhpcy5zdGF0ZSA9IENoYXJhY3RlclN0YXRlLklkbGVcclxuICAgIHRoaXMubGluayA9ICcnXHJcbn1cclxuXHJcbmNvbXBhbmlvbi5wcm90b3R5cGUucGFyc2UgPSBmdW5jdGlvbiAoanNvbikge1xyXG4gICAgaWYgKCFqc29uKSByZXR1cm5cclxuXHJcbiAgICBpZiAoanNvbi5uYW1lKSB7XHJcbiAgICAgICAgdGhpcy5uYW1lID0ganNvbi5uYW1lXHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGpzb24uaGVhbHRoICYmIFV0aWxzLmlzTnVtZXJpYyhqc29uLmhlYWx0aCkpIHtcclxuICAgICAgICB0aGlzLmhlYWx0aCA9IGpzb24uaGVhbHRoXHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGpzb24uYXJtb3IgJiYgVXRpbHMuaXNOdW1lcmljKGpzb24uYXJtb3IpKSB7XHJcbiAgICAgICAgdGhpcy5hcm1vciA9IGpzb24uYXJtb3JcclxuICAgIH1cclxuXHJcbiAgICBpZiAoanNvbi5zcGVlZCAmJiBVdGlscy5pc051bWVyaWMoanNvbi5zcGVlZCkpIHtcclxuICAgICAgICB0aGlzLnNwZWVkID0ganNvbi5zcGVlZFxyXG4gICAgfVxyXG5cclxuICAgIGlmIChqc29uLnJhY2UpIHtcclxuICAgICAgICB0aGlzLnJhY2UgPSBqc29uLnJhY2VcclxuICAgIH1cclxuXHJcbiAgICBpZiAoanNvbi5zdGF0ZSkge1xyXG4gICAgICAgIHRoaXMuc3RhdGUgPSBqc29uLnN0YXRlXHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGpzb24ud2VhcG9ucyAmJiBVdGlscy5pc0FycmF5KGpzb24ud2VhcG9ucykpIHtcclxuICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IGpzb24ud2VhcG9ucy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICAgICAgdmFyIHcgPSBuZXcgV2VhcG9uKClcclxuICAgICAgICAgICAgdy5wYXJzZShqc29uLndlYXBvbnNbaV0pXHJcbiAgICAgICAgICAgIHRoaXMud2VhcG9ucy5wdXNoKHcpXHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGlmIChqc29uLmxpbmspIHtcclxuICAgICAgICB0aGlzLmxpbmsgPSBqc29uLmxpbmtcclxuICAgIH1cclxufVxyXG5cclxuY29tcGFuaW9uLnByb3RvdHlwZS5zZXJpYWxpemUgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICB2YXIgd2VhcG9ucyA9IFtdXHJcbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IHRoaXMud2VhcG9ucy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICB3ZWFwb25zLnB1c2godGhpcy53ZWFwb25zW2ldLnNlcmlhbGl6ZSgpKVxyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgaWQ6IHRoaXMuaWQsXHJcbiAgICAgICAgbmFtZTogdGhpcy5uYW1lLFxyXG4gICAgICAgIGhlYWx0aDogdGhpcy5oZWFsdGgsXHJcbiAgICAgICAgYXJtb3I6IHRoaXMuYXJtb3IsXHJcbiAgICAgICAgc3BlZWQ6IHRoaXMuc3BlZWQsXHJcbiAgICAgICAgcmFjZTogdGhpcy5yYWNlLFxyXG4gICAgICAgIHdlYXBvbnM6IHdlYXBvbnMsXHJcbiAgICAgICAgc3RhdGU6IHRoaXMuc3RhdGUsXHJcbiAgICAgICAgbGluazogdGhpcy5saW5rXHJcbiAgICB9XHJcbn1cclxuXHJcbmNvbXBhbmlvbi5wcm90b3R5cGUucmVuZGVyID0gZnVuY3Rpb24gKCkge1xyXG4gICAgdmFyIG91dCA9ICc8ZGl2IGNsYXNzPVwiY29tcGFuaW9uXCI+J1xyXG5cclxuICAgIG91dCArPSAnPGRpdj48c3BhbiBjbGFzcz1cImJvbGRcIj4nICsgdGhpcy5uYW1lICsgJzwvc3Bhbj4sIDxzcGFuIGNsYXNzPVwiaXRhbGljXCI+JyArIHRoaXMucmFjZSArICc8L3NwYW4+LiBTcGVlZDogJyArIHRoaXMuc3BlZWQgKyAnPC9kaXY+J1xyXG4gICAgb3V0ICs9ICc8ZGl2PkhlYWx0aDogPHNwYW4gY2xhc3M9XCJib2xkXCI+JyArIHRoaXMuaGVhbHRoICsgJzwvc3Bhbj4sIEFDOiA8c3BhbiBjbGFzcz1cImJvbGRcIj4nICsgdGhpcy5hcm1vciArICc8L3NwYW4+PC9kaXY+J1xyXG5cclxuICAgIGZvciAodmFyIGkgPSAwLCBsID0gdGhpcy53ZWFwb25zLmxlbmd0aDsgaSA8IGw7IGkrKykge1xyXG4gICAgICAgIG91dCArPSAnPGRpdj4nICsgdGhpcy53ZWFwb25zW2ldLnJlbmRlcigpICsgJzwvZGl2PidcclxuICAgIH1cclxuXHJcbiAgICBpZiAodGhpcy5zdGF0ZSA9PT0gQ2hhcmFjdGVyU3RhdGUuRW5jb3VudGVyKSB7XHJcbiAgICAgICAgb3V0ICs9ICc8ZGl2PjxpbnB1dCB0eXBlPVwiYnV0dG9uXCIgY2xhc3M9XCJjb21wYW5pb25fZGFtYWdlXCIgdmFsdWU9XCJBcHBseSBEYW1hZ2VcIiBkYXRhLWlkPVwiJyArIHRoaXMuaWQgKyAnXCIgLz48aW5wdXQgdHlwZT1cInRleHRcIiBpZD1cImNvbXBhbmlvbl9kYW1hZ2VfJyArIHRoaXMuaWQgKyAnXCIgLz48L2Rpdj4nXHJcbiAgICAgICAgb3V0ICs9ICc8ZGl2IHN0eWxlPVwibWFyZ2luLXRvcDogNHB4O1wiPidcclxuICAgICAgICBvdXQgKz0gJzxpbnB1dCB0eXBlPVwiYnV0dG9uXCIgY2xhc3M9XCJjb21wYW5pb25fZGllXCIgdmFsdWU9XCJEaWVcIiBkYXRhLWlkPVwiJyArIHRoaXMuaWQgKyAnXCIgLz4nXHJcbiAgICAgICAgb3V0ICs9ICc8L2Rpdj4nO1xyXG4gICAgfSBlbHNlIGlmICh0aGlzLnN0YXRlID09PSBDaGFyYWN0ZXJTdGF0ZS5JZGxlKSB7XHJcbiAgICAgICAgb3V0ICs9ICc8ZGl2Pic7XHJcbiAgICAgICAgb3V0ICs9ICc8aW5wdXQgdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwiY29tcGFuaW9uX2RpZVwiIHZhbHVlPVwiRGllXCIgZGF0YS1pZD1cIicgKyB0aGlzLmlkICsgJ1wiIC8+J1xyXG4gICAgICAgIG91dCArPSAnPC9kaXY+JztcclxuICAgIH0gZWxzZSBpZiAodGhpcy5zdGF0ZSA9PT0gQ2hhcmFjdGVyU3RhdGUuRGVhZCkge1xyXG4gICAgICAgIG91dCArPSAnPGRpdj48aW5wdXQgdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwiY29tcGFuaW9uX3Jldml2ZVwiIHZhbHVlPVwiUmV2aXZlIE5QQ1wiIGRhdGEtaWQ9XCInICsgdGhpcy5pZCArICdcIiAvPjwvZGl2PidcclxuICAgIH1cclxuXHJcbiAgICBpZiAodGhpcy5saW5rKSBvdXQgKz0gJzxkaXY+PGEgaHJlZj1cIicgKyB0aGlzLmxpbmsgKyAnXCIgdGFyZ2V0PVwiX2JsYW5rXCI+RCZEIEJleW9uZDwvYT48L2Rpdj4nXHJcblxyXG4gICAgb3V0ICs9ICc8L2Rpdj4nXHJcbiAgICByZXR1cm4gb3V0XHJcbn1cclxuXHJcbmNvbXBhbmlvbi5wcm90b3R5cGUuYXBwbHlEYW1hZ2UgPSBmdW5jdGlvbiAoZGFtYWdlKSB7XHJcbiAgICB0aGlzLmhlYWx0aCAtPSBkYW1hZ2VcclxuICAgIGlmICh0aGlzLmhlYWx0aCA8PSAwKSB7XHJcbiAgICAgICAgdGhpcy5oZWFsdGggPSAwXHJcbiAgICAgICAgdGhpcy5zdGF0ZSA9IENoYXJhY3RlclN0YXRlLkRlYWRcclxuICAgIH1cclxufVxyXG5cclxuY29tcGFuaW9uLnByb3RvdHlwZS5yZXZpdmUgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICB0aGlzLmhlYWx0aCA9IDFcclxuICAgIHRoaXMuc3RhdGUgPSBDaGFyYWN0ZXJTdGF0ZS5FbmNvdW50ZXJcclxufVxyXG5cclxuY29tcGFuaW9uLnByb3RvdHlwZS5kaWUgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICB0aGlzLmhlYWx0aCA9IDBcclxuICAgIHRoaXMuc3RhdGUgPSBDaGFyYWN0ZXJTdGF0ZS5EZWFkXHJcbn1cclxuXHJcbmNvbXBhbmlvbi5wcm90b3R5cGUuY2xvbmUgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICB2YXIgYyA9IG5ldyBjb21wYW5pb24oKVxyXG4gICAgYy5uYW1lID0gdGhpcy5uYW1lXHJcbiAgICBjLmhlYWx0aCA9IHRoaXMuaGVhbHRoXHJcbiAgICBjLmFybW9yID0gdGhpcy5hcm1vclxyXG4gICAgYy5zcGVlZCA9IHRoaXMuc3BlZWRcclxuICAgIGMucmFjZSA9IHRoaXMucmFjZVxyXG4gICAgYy53ZWFwb25zID0gVXRpbHMuYXJyYXlDbG9uZSh0aGlzLndlYXBvbnMpXHJcbiAgICBjLmxpbmsgPSB0aGlzLmxpbmtcclxuICAgIHJldHVybiBjXHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gY29tcGFuaW9uIiwi77u/J3VzZSBzdHJpY3QnXHJcblxyXG5nbG9iYWwuQ2hhcmFjdGVyU3RhdGUgPSB7XHJcbiAgICBEZWFkOiAnZGVhZCcsXHJcbiAgICBJZGxlOiAnYWxpdmUnLFxyXG4gICAgRW5jb3VudGVyOiAnZW5jb3VudGVyJ1xyXG59XHJcblxyXG5nbG9iYWwuQ2hhcmFjdGVyQWN0aW9uID0ge1xyXG4gICAgRGFtYWdlOiAnZGFtYWdlJyxcclxuICAgIERpZTogJ2RpZScsXHJcbiAgICBJbml0aWF0aXZlOiAnaW5pdGlhdGl2ZScsXHJcbiAgICBMZWF2ZTogJ2xlYXZlJyxcclxuICAgIFJldml2ZTogJ3Jldml2ZSdcclxufVxyXG5cclxuZ2xvYmFsLkRhbWFnZVR5cGUgPSB7XHJcbiAgICBBY2lkOiAnYWNpZCcsXHJcbiAgICBCbHVkZ2VvbmluZzogJ2JsdWRnZW9uaW5nJyxcclxuICAgIENvbGQ6ICdjb2xkJyxcclxuICAgIEZpcmU6ICdmaXJlJyxcclxuICAgIEZvcmNlOiAnZm9yY2UnLFxyXG4gICAgTGlnaHRuaW5nOiAnbGlnaHRuaW5nJyxcclxuICAgIE5lY3JvdGljOiAnbmVjcm90aWMnLFxyXG4gICAgUGllcmNpbmc6ICdwaWVyY2luZycsXHJcbiAgICBQb2lzb246ICdwb2lzb24nLFxyXG4gICAgUHN5Y2hpYzogJ3BzeWNoaWMnLFxyXG4gICAgUmFkaWFudDogJ3JhZGlhbnQnLFxyXG4gICAgU2xhc2hpbmc6ICdzbGFzaGluZycsXHJcbiAgICBUaHVuZGVyOiAndGh1bmRlcidcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBudWxsIiwi77u/J3VzZSBzdHJpY3QnXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHtcclxuICAgIGQ0OiBmdW5jdGlvbiAoKSB7IHJldHVybiBVdGlscy5yYW5kb21JbnQoMSwgNCkgfSxcclxuICAgIGQ2OiBmdW5jdGlvbiAoKSB7IHJldHVybiBVdGlscy5yYW5kb21JbnQoMSwgNikgfSxcclxuICAgIGQ4OiBmdW5jdGlvbiAoKSB7IHJldHVybiBVdGlscy5yYW5kb21JbnQoMSwgOCkgfSxcclxuICAgIGQxMDogZnVuY3Rpb24gKCkgeyByZXR1cm4gVXRpbHMucmFuZG9tSW50KDEsIDEwKSB9LFxyXG4gICAgZDEyOiBmdW5jdGlvbiAoKSB7IHJldHVybiBVdGlscy5yYW5kb21JbnQoMSwgMTIpIH0sXHJcbiAgICBkMjA6IGZ1bmN0aW9uICgpIHsgcmV0dXJuIFV0aWxzLnJhbmRvbUludCgxLCAyMCkgfSxcclxuICAgIGQxMDA6IGZ1bmN0aW9uICgpIHsgcmV0dXJuIFV0aWxzLnJhbmRvbUludCgxLCAxMDApIH1cclxufVxyXG4iLCLvu78ndXNlIHN0cmljdCdcclxuXHJcbnZhciBXZWFwb24gPSByZXF1aXJlKCcuL3dlYXBvbi5qcycpXHJcbnZhciBTcGVsbCA9IHJlcXVpcmUoJy4vc3BlbGwuanMnKVxyXG52YXIgcm9sbCA9IHJlcXVpcmUoJy4uL2RuZC9kaWNlLmpzJylcclxudmFyIENvbXBhbmlvbiA9IHJlcXVpcmUoJy4vY29tcGFuaW9uLmpzJylcclxuXHJcbnZhciBucGMgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICB0aGlzLmlkID0gMFxyXG4gICAgdGhpcy5uYW1lID0gJydcclxuICAgIHRoaXMuaGVhbHRoID0gNVxyXG4gICAgdGhpcy5hcm1vciA9IDEwXHJcbiAgICB0aGlzLnNwZWVkID0gMTVcclxuICAgIHRoaXMucmFjZSA9ICdIdW1hbidcclxuICAgIHRoaXMuaW5pdGlhdGl2ZSA9IDBcclxuICAgIHRoaXMud2VhcG9ucyA9IFtdXHJcbiAgICB0aGlzLnNwZWxscyA9IFtdXHJcbiAgICB0aGlzLnN0YXRlID0gQ2hhcmFjdGVyU3RhdGUuSWRsZVxyXG4gICAgdGhpcy5saW5rID0gJydcclxuICAgIHRoaXMuaW5pdE1vZCA9IDBcclxuICAgIHRoaXMudGVtcGxhdGUgPSBmYWxzZVxyXG4gICAgdGhpcy5pbnN0YW5jZSA9IDBcclxuICAgIHRoaXMuY29tcGFuaW9uID0gbnVsbFxyXG59XHJcblxyXG5ucGMucHJvdG90eXBlLnBhcnNlID0gZnVuY3Rpb24gKGpzb24pIHtcclxuICAgIGlmICghanNvbikgcmV0dXJuXHJcblxyXG4gICAgaWYgKGpzb24uaWQgJiYgVXRpbHMuaXNOdW1lcmljKGpzb24uaWQpKSB7XHJcbiAgICAgICAgdGhpcy5pZCA9IGpzb24uaWRcclxuICAgIH1cclxuXHJcbiAgICBpZiAoanNvbi5uYW1lKSB7XHJcbiAgICAgICAgdGhpcy5uYW1lID0ganNvbi5uYW1lXHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGpzb24uaGVhbHRoICYmIFV0aWxzLmlzTnVtZXJpYyhqc29uLmhlYWx0aCkpIHtcclxuICAgICAgICB0aGlzLmhlYWx0aCA9IGpzb24uaGVhbHRoXHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGpzb24uYXJtb3IgJiYgVXRpbHMuaXNOdW1lcmljKGpzb24uYXJtb3IpKSB7XHJcbiAgICAgICAgdGhpcy5hcm1vciA9IGpzb24uYXJtb3JcclxuICAgIH1cclxuXHJcbiAgICBpZiAoanNvbi5zcGVlZCAmJiBVdGlscy5pc051bWVyaWMoanNvbi5zcGVlZCkpIHtcclxuICAgICAgICB0aGlzLnNwZWVkID0ganNvbi5zcGVlZFxyXG4gICAgfVxyXG5cclxuICAgIGlmIChqc29uLnJhY2UpIHtcclxuICAgICAgICB0aGlzLnJhY2UgPSBqc29uLnJhY2VcclxuICAgIH1cclxuXHJcbiAgICBpZiAoanNvbi5pbml0aWF0aXZlICYmIFV0aWxzLmlzTnVtZXJpYyhqc29uLmluaXRpYXRpdmUpKSB7XHJcbiAgICAgICAgdGhpcy5pbml0aWF0aXZlID0ganNvbi5pbml0aWF0aXZlXHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGpzb24uc3RhdGUpIHtcclxuICAgICAgICB0aGlzLnN0YXRlID0ganNvbi5zdGF0ZVxyXG4gICAgfVxyXG5cclxuICAgIGlmIChqc29uLndlYXBvbnMgJiYgVXRpbHMuaXNBcnJheShqc29uLndlYXBvbnMpKSB7XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBqc29uLndlYXBvbnMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XHJcbiAgICAgICAgICAgIHZhciB3ID0gbmV3IFdlYXBvbigpXHJcbiAgICAgICAgICAgIHcucGFyc2UoanNvbi53ZWFwb25zW2ldKVxyXG4gICAgICAgICAgICB0aGlzLndlYXBvbnMucHVzaCh3KVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBpZiAoanNvbi5zcGVsbHMgJiYgVXRpbHMuaXNBcnJheShqc29uLnNwZWxscykpIHtcclxuICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IGpzb24uc3BlbGxzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xyXG4gICAgICAgICAgICB2YXIgcyA9IG5ldyBTcGVsbCgpXHJcbiAgICAgICAgICAgIHMucGFyc2UoanNvbi5zcGVsbHNbaV0pXHJcbiAgICAgICAgICAgIHRoaXMuc3BlbGxzLnB1c2gocylcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGpzb24ubGluaykge1xyXG4gICAgICAgIHRoaXMubGluayA9IGpzb24ubGlua1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChqc29uLnRlbXBsYXRlKSB7XHJcbiAgICAgICAgdGhpcy50ZW1wbGF0ZSA9IGpzb24udGVtcGxhdGVcclxuICAgIH1cclxuXHJcbiAgICBpZiAoanNvbi5pbml0TW9kICYmIFV0aWxzLmlzTnVtZXJpYyhqc29uLmluaXRNb2QpKSB7XHJcbiAgICAgICAgdGhpcy5pbml0TW9kID0ganNvbi5pbml0TW9kXHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGpzb24uY29tcGFuaW9uKSB7XHJcbiAgICAgICAgdmFyIGMgPSBuZXcgQ29tcGFuaW9uKClcclxuICAgICAgICBjLnBhcnNlKGpzb24uY29tcGFuaW9uKVxyXG4gICAgICAgIHRoaXMuY29tcGFuaW9uID0gY1xyXG4gICAgfVxyXG59XHJcblxyXG5ucGMucHJvdG90eXBlLnNlcmlhbGl6ZSA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHZhciB3ZWFwb25zID0gW11cclxuICAgIGZvciAodmFyIGkgPSAwLCBsID0gdGhpcy53ZWFwb25zLmxlbmd0aDsgaSA8IGw7IGkrKykge1xyXG4gICAgICAgIHdlYXBvbnMucHVzaCh0aGlzLndlYXBvbnNbaV0uc2VyaWFsaXplKCkpXHJcbiAgICB9XHJcblxyXG4gICAgdmFyIHNwZWxscyA9IFtdXHJcbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IHRoaXMuc3BlbGxzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xyXG4gICAgICAgIHNwZWxscy5wdXNoKHRoaXMuc3BlbGxzW2ldLnNlcmlhbGl6ZSgpKVxyXG4gICAgfVxyXG5cclxuICAgIHZhciBvdXQgPSB7XHJcbiAgICAgICAgaWQ6IHRoaXMuaWQsXHJcbiAgICAgICAgbmFtZTogdGhpcy5uYW1lLFxyXG4gICAgICAgIGhlYWx0aDogdGhpcy5oZWFsdGgsXHJcbiAgICAgICAgYXJtb3I6IHRoaXMuYXJtb3IsXHJcbiAgICAgICAgc3BlZWQ6IHRoaXMuc3BlZWQsXHJcbiAgICAgICAgcmFjZTogdGhpcy5yYWNlLFxyXG4gICAgICAgIGluaXRpYXRpdmU6IHRoaXMuaW5pdGlhdGl2ZSxcclxuICAgICAgICB3ZWFwb25zOiB3ZWFwb25zLFxyXG4gICAgICAgIHNwZWxsczogc3BlbGxzLFxyXG4gICAgICAgIHN0YXRlOiB0aGlzLnN0YXRlLFxyXG4gICAgICAgIGxpbms6IHRoaXMubGluayxcclxuICAgICAgICBpbml0TW9kOiB0aGlzLmluaXRNb2QsXHJcbiAgICAgICAgdGVtcGxhdGU6IHRoaXMudGVtcGxhdGUsXHJcbiAgICAgICAgaW5zdGFuY2U6IHRoaXMuaW5zdGFuY2VcclxuICAgIH1cclxuXHJcbiAgICBpZiAodGhpcy5jb21wYW5pb24pIG91dFsnY29tcGFuaW9uJ10gPSB0aGlzLmNvbXBhbmlvbi5zZXJpYWxpemUoKVxyXG4gICAgcmV0dXJuIG91dFxyXG59XHJcblxyXG5ucGMucHJvdG90eXBlLnJlbmRlciA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHZhciBvdXQgPSAnPGRpdiBjbGFzcz1cImVudCBucGNcIiBkYXRhLWlkPVwiJyArIHRoaXMuaWQgKyAnXCI+JztcclxuXHJcbiAgICBvdXQgKz0gJzxkaXY+PHNwYW4gY2xhc3M9XCJib2xkXCI+JyArIHRoaXMubmFtZSArICc8L3NwYW4+LCA8c3BhbiBjbGFzcz1cIml0YWxpY1wiPicgKyB0aGlzLnJhY2UgKyAnPC9zcGFuPi4gU3BlZWQ6ICcgKyB0aGlzLnNwZWVkICsgJzwvZGl2PidcclxuXHJcbiAgICB2YXIgaW5pdGlhdGl2ZSA9ICcnO1xyXG4gICAgaWYgKHRoaXMuc3RhdGUgPT09IENoYXJhY3RlclN0YXRlLkVuY291bnRlcilcclxuICAgICAgICBpbml0aWF0aXZlID0gJyAoJyArICh0aGlzLmhlYWx0aCA+IDAgPyAnYWxpdmUnIDogJ2RlYWQnKSArICcpLCBJbml0aWF0aXZlOiA8c3BhbiBjbGFzcz1cImJvbGRcIj4nICsgdGhpcy5pbml0aWF0aXZlICsgJzwvc3Bhbj4nXHJcblxyXG4gICAgb3V0ICs9ICc8ZGl2PkhlYWx0aDogPHNwYW4gY2xhc3M9XCJib2xkXCI+JyArIHRoaXMuaGVhbHRoICsgJzwvc3Bhbj4sIEFDOiA8c3BhbiBjbGFzcz1cImJvbGRcIj4nICsgdGhpcy5hcm1vciArICc8L3NwYW4+JyArIGluaXRpYXRpdmUgKyAnPC9kaXY+J1xyXG5cclxuICAgIGZvciAodmFyIGkgPSAwLCBsID0gdGhpcy53ZWFwb25zLmxlbmd0aDsgaSA8IGw7IGkrKykge1xyXG4gICAgICAgIG91dCArPSAnPGRpdj4nICsgdGhpcy53ZWFwb25zW2ldLnJlbmRlcigpICsgJzwvZGl2PidcclxuICAgIH1cclxuXHJcbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IHRoaXMuc3BlbGxzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xyXG4gICAgICAgIG91dCArPSAnPGRpdj4nICsgdGhpcy5zcGVsbHNbaV0ucmVuZGVyKCkgKyAnPC9kaXY+J1xyXG4gICAgfVxyXG5cclxuICAgIGlmICh0aGlzLnN0YXRlID09PSBDaGFyYWN0ZXJTdGF0ZS5FbmNvdW50ZXIpIHtcclxuICAgICAgICBvdXQgKz0gJzxkaXY+PGlucHV0IHR5cGU9XCJidXR0b25cIiBjbGFzcz1cIm5wY19kYW1hZ2VcIiB2YWx1ZT1cIkFwcGx5IERhbWFnZVwiIGRhdGEtaWQ9XCInICsgdGhpcy5pZCArICdcIiAvPjxpbnB1dCB0eXBlPVwidGV4dFwiIGlkPVwibnBjX2RhbWFnZV8nICsgdGhpcy5pZCArICdcIiAvPjwvZGl2PidcclxuICAgICAgICBvdXQgKz0gJzxkaXYgc3R5bGU9XCJtYXJnaW4tdG9wOiA0cHg7XCI+J1xyXG4gICAgICAgIG91dCArPSAnPGlucHV0IHR5cGU9XCJidXR0b25cIiBjbGFzcz1cIm5wY19sZWF2ZVwiIHZhbHVlPVwiTGVhdmUgRW5jb3VudGVyXCIgZGF0YS1pZD1cIicgKyB0aGlzLmlkICsgJ1wiIC8+Jm5ic3A7J1xyXG4gICAgICAgIG91dCArPSAnPGlucHV0IHR5cGU9XCJidXR0b25cIiBjbGFzcz1cIm5wY19kaWVcIiB2YWx1ZT1cIkRpZVwiIGRhdGEtaWQ9XCInICsgdGhpcy5pZCArICdcIiAvPidcclxuICAgICAgICBvdXQgKz0gJzwvZGl2Pic7XHJcbiAgICB9IGVsc2UgaWYgKHRoaXMuc3RhdGUgPT09IENoYXJhY3RlclN0YXRlLklkbGUpIHtcclxuICAgICAgICBvdXQgKz0gJzxkaXY+JztcclxuICAgICAgICBvdXQgKz0gJzxpbnB1dCB0eXBlPVwiYnV0dG9uXCIgY2xhc3M9XCJucGNfaW5pdGlhdGl2ZVwiIHZhbHVlPVwiUm9sbCBJbml0aWF0aXZlXCIgZGF0YS1pZD1cIicgKyB0aGlzLmlkICsgJ1wiIC8+J1xyXG4gICAgICAgIGlmICghdGhpcy50ZW1wbGF0ZSkgb3V0ICs9ICcmbmJzcDs8aW5wdXQgdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwibnBjX2RpZVwiIHZhbHVlPVwiRGllXCIgZGF0YS1pZD1cIicgKyB0aGlzLmlkICsgJ1wiIC8+J1xyXG4gICAgICAgIG91dCArPSAnPC9kaXY+JztcclxuICAgIH0gZWxzZSBpZiAodGhpcy5zdGF0ZSA9PT0gQ2hhcmFjdGVyU3RhdGUuRGVhZCkge1xyXG4gICAgICAgIG91dCArPSAnPGRpdj48aW5wdXQgdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwibnBjX3Jldml2ZVwiIHZhbHVlPVwiUmV2aXZlIE5QQ1wiIGRhdGEtaWQ9XCInICsgdGhpcy5pZCArICdcIiAvPjwvZGl2PidcclxuICAgIH1cclxuXHJcbiAgICBpZiAodGhpcy5saW5rKSBvdXQgKz0gJzxkaXY+PGEgaHJlZj1cIicgKyB0aGlzLmxpbmsgKyAnXCIgdGFyZ2V0PVwiX2JsYW5rXCI+RCZEIEJleW9uZDwvYT48L2Rpdj4nXHJcbiAgICBpZiAodGhpcy5jb21wYW5pb24pIG91dCArPSB0aGlzLmNvbXBhbmlvbi5yZW5kZXIoKVxyXG5cclxuICAgIG91dCArPSAnPC9kaXY+J1xyXG4gICAgcmV0dXJuIG91dDtcclxufVxyXG5cclxubnBjLnByb3RvdHlwZS5yb2xsSW5pdGlhdGl2ZSA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHRoaXMuc3RhdGUgPSBDaGFyYWN0ZXJTdGF0ZS5FbmNvdW50ZXJcclxuICAgIHRoaXMuaW5pdGlhdGl2ZSA9IHJvbGwuZDIwKCkgKyB0aGlzLmluaXRNb2RcclxuXHJcbiAgICBpZiAodGhpcy5jb21wYW5pb24gJiYgdGhpcy5jb21wYW5pb24uc3RhdGUgIT09IENoYXJhY3RlclN0YXRlLkRlYWQpIHtcclxuICAgICAgICB0aGlzLmNvbXBhbmlvbi5zdGF0ZSA9IENoYXJhY3RlclN0YXRlLkVuY291bnRlclxyXG4gICAgfVxyXG59XHJcblxyXG5ucGMucHJvdG90eXBlLmFwcGx5RGFtYWdlID0gZnVuY3Rpb24gKGRhbWFnZSkge1xyXG4gICAgdGhpcy5oZWFsdGggLT0gZGFtYWdlXHJcbiAgICBpZiAodGhpcy5oZWFsdGggPD0gMCkge1xyXG4gICAgICAgIHRoaXMuaGVhbHRoID0gMFxyXG4gICAgICAgIHRoaXMuc3RhdGUgPSBDaGFyYWN0ZXJTdGF0ZS5EZWFkXHJcbiAgICB9XHJcbn1cclxuXHJcbm5wYy5wcm90b3R5cGUucmV2aXZlID0gZnVuY3Rpb24gKCkge1xyXG4gICAgdGhpcy5oZWFsdGggPSAxXHJcbiAgICB0aGlzLnN0YXRlID0gQ2hhcmFjdGVyU3RhdGUuRW5jb3VudGVyXHJcbn1cclxuXHJcbm5wYy5wcm90b3R5cGUubGVhdmVFbmNvdW50ZXIgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICB0aGlzLmluaXRpYXRpdmUgPSAwXHJcbiAgICB0aGlzLnN0YXRlID0gQ2hhcmFjdGVyU3RhdGUuSWRsZVxyXG5cclxuICAgIGlmICh0aGlzLmNvbXBhbmlvbiAmJiB0aGlzLmNvbXBhbmlvbi5zdGF0ZSAhPT0gQ2hhcmFjdGVyU3RhdGUuRGVhZCkge1xyXG4gICAgICAgIHRoaXMuY29tcGFuaW9uLnN0YXRlID0gQ2hhcmFjdGVyU3RhdGUuSWRsZVxyXG4gICAgfVxyXG59XHJcblxyXG5ucGMucHJvdG90eXBlLmRpZSA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHRoaXMuaGVhbHRoID0gMFxyXG4gICAgdGhpcy5zdGF0ZSA9IENoYXJhY3RlclN0YXRlLkRlYWRcclxufVxyXG5cclxubnBjLnByb3RvdHlwZS5jbG9uZSA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHZhciBuID0gbmV3IG5wYygpXHJcbiAgICB0aGlzLmluc3RhbmNlKytcclxuICAgIG4ubmFtZSA9IHRoaXMubmFtZSArICcgIycgKyB0aGlzLmluc3RhbmNlXHJcbiAgICBuLmhlYWx0aCA9IHRoaXMuaGVhbHRoXHJcbiAgICBuLmFybW9yID0gdGhpcy5hcm1vclxyXG4gICAgbi5zcGVlZCA9IHRoaXMuc3BlZWRcclxuICAgIG4ucmFjZSA9IHRoaXMucmFjZVxyXG4gICAgbi53ZWFwb25zID0gVXRpbHMuYXJyYXlDbG9uZSh0aGlzLndlYXBvbnMpXHJcbiAgICBuLnNwZWxscyA9IFV0aWxzLmFycmF5Q2xvbmUodGhpcy5zcGVsbHMpXHJcbiAgICBuLmxpbmsgPSB0aGlzLmxpbmtcclxuICAgIG4uaW5pdE1vZCA9IHRoaXMuaW5pdE1vZFxyXG5cclxuICAgIGlmICh0aGlzLmNvbXBhbmlvbikgbi5jb21wYW5pb24gPSB0aGlzLmNvbXBhbmlvbi5jbG9uZSgpXHJcbiAgICByZXR1cm4gblxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IG5wYyIsIu+7vyd1c2Ugc3RyaWN0J1xyXG5cclxudmFyIHBsYXllciA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHRoaXMuaWQgPSAwXHJcbiAgICB0aGlzLm5hbWUgPSAnJ1xyXG4gICAgdGhpcy5wbGF5ZXIgPSAnJ1xyXG4gICAgdGhpcy5pbml0aWF0aXZlID0gMFxyXG4gICAgdGhpcy5zdGF0ZSA9IENoYXJhY3RlclN0YXRlLklkbGVcclxuICAgIHRoaXMuZXhoYXVzdGlvbiA9IDBcclxuICAgIHRoaXMubGluayA9ICcnXHJcbn07XHJcblxyXG5wbGF5ZXIucHJvdG90eXBlLnBhcnNlID0gZnVuY3Rpb24gKGpzb24pIHtcclxuICAgIGlmICghanNvbikgcmV0dXJuXHJcblxyXG4gICAgaWYgKGpzb24uaWQgJiYgVXRpbHMuaXNOdW1lcmljKGpzb24uaWQpKSB7XHJcbiAgICAgICAgdGhpcy5pZCA9IGpzb24uaWRcclxuICAgIH1cclxuXHJcbiAgICBpZiAoanNvbi5uYW1lKSB7XHJcbiAgICAgICAgdGhpcy5uYW1lID0ganNvbi5uYW1lXHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGpzb24ucGxheWVyKSB7XHJcbiAgICAgICAgdGhpcy5wbGF5ZXIgPSBqc29uLnBsYXllclxyXG4gICAgfVxyXG5cclxuICAgIGlmIChqc29uLmluaXRpYXRpdmUgJiYgVXRpbHMuaXNOdW1lcmljKGpzb24uaW5pdGlhdGl2ZSkpIHtcclxuICAgICAgICB0aGlzLmluaXRpYXRpdmUgPSBqc29uLmluaXRpYXRpdmVcclxuICAgIH1cclxuXHJcbiAgICBpZiAoanNvbi5zdGF0ZSkge1xyXG4gICAgICAgIHRoaXMuc3RhdGUgPSBqc29uLnN0YXRlXHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGpzb24uZXhoYXVzdGlvbiAmJiBVdGlscy5pc051bWVyaWMoanNvbi5leGhhdXN0aW9uKSkge1xyXG4gICAgICAgIHRoaXMuZXhoYXVzdGlvbiA9IFV0aWxzLmNsYW1wKGpzb24uZXhoYXVzdGlvbiwgMSwgNilcclxuXHJcbiAgICAgICAgaWYgKHRoaXMuZXhoYXVzdGlvbiA9PSA2KVxyXG4gICAgICAgICAgICB0aGlzLnN0YXRlID0gQ2hhcmFjdGVyU3RhdGUuRGVhZFxyXG4gICAgfVxyXG5cclxuICAgIGlmIChqc29uLmxpbmspIHtcclxuICAgICAgICB0aGlzLmxpbmsgPSBqc29uLmxpbmtcclxuICAgIH1cclxufVxyXG5cclxucGxheWVyLnByb3RvdHlwZS5zZXJpYWxpemUgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIGlkOiB0aGlzLmlkLFxyXG4gICAgICAgIG5hbWU6IHRoaXMubmFtZSxcclxuICAgICAgICBwbGF5ZXI6IHRoaXMucGxheWVyLFxyXG4gICAgICAgIGluaXRpYXRpdmU6IHRoaXMuaW5pdGlhdGl2ZSxcclxuICAgICAgICBzdGF0ZTogdGhpcy5zdGF0ZSxcclxuICAgICAgICBleGhhdXN0aW9uOiB0aGlzLmV4aGF1c3Rpb24sXHJcbiAgICAgICAgbGluazogdGhpcy5saW5rXHJcbiAgICB9XHJcbn1cclxuXHJcbnBsYXllci5wcm90b3R5cGUucmVuZGVyID0gZnVuY3Rpb24gKCkge1xyXG4gICAgdmFyIG91dCA9ICc8ZGl2IGNsYXNzPVwiZW50IHBsYXllclwiIGRhdGEtaWQ9XCInICsgdGhpcy5pZCArICdcIj4nXHJcblxyXG4gICAgb3V0ICs9ICc8ZGl2PjxzcGFuIGNsYXNzPVwiYm9sZFwiPicgKyB0aGlzLm5hbWUgKyAnPC9zcGFuPiA8c3BhbiBjbGFzcz1cIml0YWxpY3NcIj4nICsgdGhpcy5wbGF5ZXIgKyAnPC9zcGFuPjwvZGl2PidcclxuXHJcbiAgICBpZiAodGhpcy5zdGF0ZSA9PT0gQ2hhcmFjdGVyU3RhdGUuRW5jb3VudGVyKSB7XHJcbiAgICAgICAgb3V0ICs9ICc8ZGl2PkluaXRpYXRpdmU6IDxzcGFuIGNsYXNzPVwiYm9sZFwiPicgKyB0aGlzLmluaXRpYXRpdmUgKyAnPC9zcGFuPjwvZGl2PidcclxuICAgICAgICBvdXQgKz0gJzxkaXY+J1xyXG4gICAgICAgIG91dCArPSAnPGlucHV0IHR5cGU9XCJidXR0b25cIiBjbGFzcz1cInBsYXllcl9sZWF2ZVwiIHZhbHVlPVwiTGVhdmUgRW5jb3VudGVyXCIgZGF0YS1pZD1cIicgKyB0aGlzLmlkICsgJ1wiIHN0eWxlPVwibWFyZ2luLXJpZ2h0OjVweFwiIC8+J1xyXG4gICAgICAgIG91dCArPSAnPGlucHV0IHR5cGU9XCJidXR0b25cIiBjbGFzcz1cInBsYXllcl9kaWVcIiB2YWx1ZT1cIkRpZVwiIGRhdGEtaWQ9XCInICsgdGhpcy5pZCArICdcIiAvPidcclxuICAgICAgICBvdXQgKz0gJzwvZGl2PidcclxuICAgIH0gZWxzZSBpZiAodGhpcy5zdGF0ZSA9PT0gQ2hhcmFjdGVyU3RhdGUuSWRsZSkge1xyXG4gICAgICAgIG91dCArPSAnPGRpdj4nXHJcbiAgICAgICAgb3V0ICs9ICc8aW5wdXQgdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwicGxheWVyX2luaXRpYXRpdmVcIiB2YWx1ZT1cIkFwcGx5IEluaXRpYXR2ZVwiIGRhdGEtaWQ9XCInICsgdGhpcy5pZCArICdcIiAvPjxpbnB1dCB0eXBlPVwidGV4dFwiIGlkPVwicGxheWVyX2luaXRpYXRpdmVfJyArIHRoaXMuaWQgKyAnXCIgLz4nXHJcbiAgICAgICAgb3V0ICs9ICc8aW5wdXQgdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwicGxheWVyX2RpZVwiIHZhbHVlPVwiRGllXCIgZGF0YS1pZD1cIicgKyB0aGlzLmlkICsgJ1wiIC8+J1xyXG4gICAgICAgIG91dCArPSAnPC9kaXY+JztcclxuICAgIH0gZWxzZSBpZiAodGhpcy5zdGF0ZSA9PT0gQ2hhcmFjdGVyU3RhdGUuRGVhZCkge1xyXG4gICAgICAgIG91dCArPSAnPGRpdj48aW5wdXQgdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwicGxheWVyX3Jldml2ZVwiIHZhbHVlPVwiUmV2aXZlIFBsYXllclwiIGRhdGEtaWQ9XCInICsgdGhpcy5pZCArICdcIiAvPjwvZGl2PidcclxuICAgIH1cclxuXHJcbiAgICBpZiAodGhpcy5saW5rKSBvdXQgKz0gJzxkaXY+PGEgaHJlZj1cIicgKyB0aGlzLmxpbmsgKyAnXCIgdGFyZ2V0PVwiX2JsYW5rXCI+RCZEIEJleW9uZDwvYT48L2Rpdj4nXHJcblxyXG4gICAgb3V0ICs9ICc8L2Rpdj4nXHJcblxyXG4gICAgcmV0dXJuIG91dFxyXG59XHJcblxyXG5wbGF5ZXIucHJvdG90eXBlLmFwcGx5SW5pdGlhdGl2ZSA9IGZ1bmN0aW9uIChpbml0aWF0aXZlKSB7XHJcbiAgICB0aGlzLmluaXRpYXRpdmUgPSBpbml0aWF0aXZlXHJcbiAgICB0aGlzLnN0YXRlID0gQ2hhcmFjdGVyU3RhdGUuRW5jb3VudGVyXHJcbn1cclxuXHJcbnBsYXllci5wcm90b3R5cGUubGVhdmVFbmNvdW50ZXIgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICB0aGlzLmluaXRpYXRpdmUgPSAwXHJcbiAgICB0aGlzLnN0YXRlID0gQ2hhcmFjdGVyU3RhdGUuSWRsZVxyXG59XHJcblxyXG5wbGF5ZXIucHJvdG90eXBlLnJldml2ZSA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHRoaXMuc3RhdGUgPSBDaGFyYWN0ZXJTdGF0ZS5FbmNvdW50ZXJcclxufVxyXG5cclxucGxheWVyLnByb3RvdHlwZS5kaWUgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICB0aGlzLnN0YXRlID0gQ2hhcmFjdGVyU3RhdGUuRGVhZFxyXG59XHJcblxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBwbGF5ZXI7Iiwi77u/J3VzZSBzdHJpY3QnXHJcblxyXG52YXIgc3BlbGwgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICB0aGlzLm5hbWUgPSAnJ1xyXG4gICAgdGhpcy5zbG90cyA9IDBcclxuICAgIHRoaXMudXNlZCA9IDBcclxufVxyXG5cclxuc3BlbGwucHJvdG90eXBlLnBhcnNlID0gZnVuY3Rpb24gKGpzb24pIHtcclxuICAgIGlmICghanNvbikgcmV0dXJuXHJcblxyXG4gICAgaWYgKGpzb24ubmFtZSkge1xyXG4gICAgICAgIHRoaXMubmFtZSA9IGpzb24ubmFtZVxyXG4gICAgfVxyXG5cclxuICAgIGlmIChqc29uLnNsb3RzICYmIFV0aWxzLmlzTnVtZXJpYyhqc29uLnNsb3RzKSkge1xyXG4gICAgICAgIHRoaXMuc2xvdHMgPSBVdGlscy5jbGFtcChqc29uLnNsb3RzLCAwLCA5OTkpXHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGpzb24udXNlZCAmJiBVdGlscy5pc051bWVyaWMoanNvbi51c2VkKSkge1xyXG4gICAgICAgIHRoaXMudXNlZCA9IFV0aWxzLmNsYW1wKGpzb24udXNlZCwgMCwgOTk5KVxyXG4gICAgfVxyXG59XHJcblxyXG5zcGVsbC5wcm90b3R5cGUuc2VyaWFsaXplID0gZnVuY3Rpb24gKCkge1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBuYW1lOiB0aGlzLm5hbWUsXHJcbiAgICAgICAgc2xvdHM6IHRoaXMuc2xvdHMsXHJcbiAgICAgICAgdXNlZDogdGhpcy51c2VkXHJcbiAgICB9XHJcbn1cclxuXHJcbnNwZWxsLnByb3RvdHlwZS5yZW5kZXIgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICB2YXIgb3V0ID0gJzxkaXYgY2xhc3M9XCJucGMtc3BlbGxzXCI+J1xyXG5cclxuICAgIG91dCArPSAnPHNwYW4gY2xhc3M9XCJzcGVsbC1sZXZlbFwiPicgKyB0aGlzLm5hbWUgKyAnPC9zcGFuPic7XHJcblxyXG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSB0aGlzLnNsb3RzOyBpIDwgbDsgaSsrKSB7XHJcbiAgICAgICAgaWYgKChpICsgMSkgPD0gdGhpcy51c2VkKSB7XHJcbiAgICAgICAgICAgIG91dCArPSAnPGlucHV0IGNsYXNzPVwic3BlbGwtc2xvdFwiIHR5cGU9XCJjaGVja2JveFwiIGNoZWNrZWQ9XCJjaGVja2VkXCIgLz4nXHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgb3V0ICs9ICc8aW5wdXQgY2xhc3M9XCJzcGVsbC1zbG90XCIgdHlwZT1cImNoZWNrYm94XCIgLz4nXHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIG91dCArPSAnPC9kaXY+J1xyXG5cclxuICAgIHJldHVybiBvdXRcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBzcGVsbCIsIu+7vyd1c2Ugc3RyaWN0J1xyXG5cclxudmFyIHdlYXBvbiA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHRoaXMubmFtZSA9ICcnXHJcbiAgICB0aGlzLmRpY2UgPSAnMWQ0J1xyXG4gICAgdGhpcy5oaXRNb2QgPSAwXHJcbiAgICB0aGlzLmF0dGFja01vZCA9IDBcclxuICAgIHRoaXMuZGFtYWdlVHlwZSA9IERhbWFnZVR5cGUuQmx1ZGdlb25pbmdcclxufVxyXG5cclxud2VhcG9uLnByb3RvdHlwZS5wYXJzZSA9IGZ1bmN0aW9uIChqc29uKSB7XHJcbiAgICBpZiAoIWpzb24pIHJldHVyblxyXG5cclxuICAgIGlmIChqc29uLm5hbWUpIHtcclxuICAgICAgICB0aGlzLm5hbWUgPSBqc29uLm5hbWVcclxuICAgIH1cclxuXHJcbiAgICBpZiAoanNvbi5kaWNlKSB7XHJcbiAgICAgICAgdGhpcy5kaWNlID0ganNvbi5kaWNlXHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGpzb24uaGl0TW9kICYmIFV0aWxzLmlzTnVtZXJpYyhqc29uLmhpdE1vZCkpIHtcclxuICAgICAgICB0aGlzLmhpdE1vZCA9IFV0aWxzLmNsYW1wKGpzb24uaGl0TW9kLCAwLCA5OTkpXHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGpzb24uYXR0YWNrTW9kICYmIFV0aWxzLmlzTnVtZXJpYyhqc29uLmF0dGFja01vZCkpIHtcclxuICAgICAgICB0aGlzLmF0dGFja01vZCA9IFV0aWxzLmNsYW1wKGpzb24uYXR0YWNrTW9kLCAwLCA5OTkpXHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGpzb24uZGFtYWdlVHlwZSkge1xyXG4gICAgICAgIHRoaXMuZGFtYWdlVHlwZSA9IGpzb24uZGFtYWdlVHlwZVxyXG4gICAgfVxyXG59XHJcblxyXG53ZWFwb24ucHJvdG90eXBlLnNlcmlhbGl6ZSA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgbmFtZTogdGhpcy5uYW1lLFxyXG4gICAgICAgIGRpY2U6IHRoaXMuZGljZSxcclxuICAgICAgICBoaXRNb2Q6IHRoaXMuaGl0TW9kLFxyXG4gICAgICAgIGF0dGFja01vZDogdGhpcy5hdHRhY2tNb2QsXHJcbiAgICAgICAgZGFtYWdlVHlwZTogdGhpcy5kYW1hZ2VUeXBlXHJcbiAgICB9XHJcbn1cclxuXHJcbndlYXBvbi5wcm90b3R5cGUucmVuZGVyID0gZnVuY3Rpb24gKCkge1xyXG4gICAgdmFyIG91dCA9ICc8c3BhbiBjbGFzcz1cImJvbGRcIj4nICsgdGhpcy5uYW1lICsgJzwvc3Bhbj46IDFkMjAnXHJcbiAgICBpZiAodGhpcy5oaXRNb2QgPiAwKSBvdXQgKz0gJyArICcgKyB0aGlzLmhpdE1vZFxyXG4gICAgb3V0ICs9ICcgdG8gaGl0LCAnICsgdGhpcy5kaWNlXHJcbiAgICBpZiAodGhpcy5hdHRhY2tNb2QgPiAwKSBvdXQgKz0gJyArICcgKyB0aGlzLmF0dGFja01vZFxyXG4gICAgb3V0ICs9ICcsIDxzcGFuIGNsYXNzPVwiaXRhbGljXCI+JyArIHRoaXMuZGFtYWdlVHlwZSArICc8L3NwYW4+J1xyXG5cclxuICAgIHJldHVybiBvdXRcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSB3ZWFwb24iLCLvu78ndXNlIHN0cmljdCdcclxuXHJcbi8vIGdsb2JhbCB2YXJzL2Z1bmN0aW9uc1xyXG5nbG9iYWwuRGVidWcgPSByZXF1aXJlKCcuL3V0aWxzL2RlYnVnLmpzJylcclxuZ2xvYmFsLlV0aWxzID0gcmVxdWlyZSgnLi91dGlscy91dGlscy5qcycpXHJcblxyXG4vLyBwYXJzZSBhcHAgc3BlY2lmaWMgZ2xvYmFsc1xyXG5yZXF1aXJlKCcuL2RuZC9jb25zdGFudHMuanMnKTtcclxuXHJcbmdsb2JhbC5EYXRhRmlsZSA9ICcvanNvbi9zdGF0ZS5qc29uJ1xyXG5cclxudmFyIHVpID0gcmVxdWlyZSgnLi9hcHAvdWkuanMnKVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSB7XHJcbiAgICBydW46IHVpLnJ1blxyXG59XHJcblxyXG4iLCLvu78ndXNlIHN0cmljdCdcclxuXHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgYXNzZXJ0OiBjb25zb2xlID8gY29uc29sZS5hc3NlcnQuYmluZChjb25zb2xlKSA6IGZ1bmN0aW9uICgpIHsgfSxcclxuICAgIGNsZWFyOiBjb25zb2xlID8gY29uc29sZS5jbGVhci5iaW5kKGNvbnNvbGUpIDogZnVuY3Rpb24gKCkgeyB9LFxyXG4gICAgZXJyb3I6IGNvbnNvbGUgPyBjb25zb2xlLmVycm9yLmJpbmQoY29uc29sZSkgOiBmdW5jdGlvbiAoKSB7IH0sXHJcbiAgICBncm91cDogY29uc29sZSA/IGNvbnNvbGUuZ3JvdXAuYmluZChjb25zb2xlKSA6IGZ1bmN0aW9uICgpIHsgfSxcclxuICAgIGdyb3VwQ29sbGFwc2VkOiBjb25zb2xlID8gY29uc29sZS5ncm91cENvbGxhcHNlZC5iaW5kKGNvbnNvbGUpIDogZnVuY3Rpb24gKCkgeyB9LFxyXG4gICAgZ3JvdXBFbmQ6IGNvbnNvbGUgPyBjb25zb2xlLmdyb3VwRW5kLmJpbmQoY29uc29sZSkgOiBmdW5jdGlvbiAoKSB7IH0sXHJcbiAgICBpbmZvOiBjb25zb2xlID8gY29uc29sZS5pbmZvLmJpbmQoY29uc29sZSkgOiBmdW5jdGlvbiAoKSB7IH0sXHJcbiAgICBsb2c6IGNvbnNvbGUgPyBjb25zb2xlLmxvZy5iaW5kKGNvbnNvbGUpIDogZnVuY3Rpb24gKCkgeyB9LFxyXG4gICAgdHJhY2U6IGNvbnNvbGUgPyBjb25zb2xlLnRyYWNlLmJpbmQoY29uc29sZSkgOiBmdW5jdGlvbiAoKSB7IH0sXHJcbiAgICB3YXJuOiBjb25zb2xlID8gY29uc29sZS53YXJuLmJpbmQoY29uc29sZSkgOiBmdW5jdGlvbiAoKSB7IH0sXHJcbn1cclxuIiwi77u/J3VzZSBzdHJpY3QnXHJcblxyXG52YXIgcmFuZG9tSW50ID0gZnVuY3Rpb24gKG1pbiwgbWF4KSB7XHJcbiAgICByZXR1cm4gTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogKG1heCAtIG1pbiArIDEpKSArIG1pblxyXG59XHJcblxyXG52YXIgcmFuZG9tQ2hhbmNlID0gZnVuY3Rpb24gKHBlcmNlbnRUcnVlKSB7XHJcbiAgICBwZXJjZW50VHJ1ZSA9IHBlcmNlbnRUcnVlIHx8IDUwO1xyXG4gICAgcmV0dXJuIHJhbmRvbUludCgxLCAxMDApIDw9IHBlcmNlbnRUcnVlID8gdHJ1ZSA6IGZhbHNlXHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgY2xhbXA6ICh2YWwsIG1pbiwgbWF4KSA9PiB7XHJcbiAgICAgICAgaWYgKHZhbCA8IG1pbilcclxuICAgICAgICAgICAgcmV0dXJuIG1pblxyXG4gICAgICAgIGlmICh2YWwgPiBtYXgpXHJcbiAgICAgICAgICAgIHJldHVybiBtYXhcclxuICAgICAgICByZXR1cm4gdmFsXHJcbiAgICB9LFxyXG5cclxuICAgIGlzTnVtZXJpYzogKG4pID0+IHtcclxuICAgICAgICByZXR1cm4gIWlzTmFOKHBhcnNlRmxvYXQobikpICYmIGlzRmluaXRlKG4pXHJcbiAgICB9LFxyXG5cclxuICAgIHJhbmRvbUludDogcmFuZG9tSW50LFxyXG5cclxuICAgIHJhbmRvbUNoYW5jZTogcmFuZG9tQ2hhbmNlXHJcbn1cclxuIiwi77u/J3VzZSBzdHJpY3QnXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHtcclxuICAgIGlzQXJyYXk6IChvYmopID0+IHtcclxuICAgICAgICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG9iaikgPT09ICdbb2JqZWN0IEFycmF5XScgPyB0cnVlIDogZmFsc2VcclxuICAgIH0sXHJcblxyXG4gICAgYXJyYXlDbG9uZTogKGFycikgPT4ge1xyXG4gICAgICAgIHJldHVybiBhcnIuc2xpY2UoMClcclxuICAgIH0sXHJcblxyXG4gICAgaXNGdW5jdGlvbjogKG9iaikgPT4ge1xyXG4gICAgICAgIHJldHVybiB0eXBlb2Ygb2JqID09PSAnZnVuY3Rpb24nID8gdHJ1ZSA6IGZhbHNlXHJcbiAgICB9LFxyXG5cclxuICAgIHN0b3JhZ2VBdmFpbGFibGU6ICh0eXBlKSA9PiB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgdmFyIHN0b3JhZ2UgPSB3aW5kb3dbdHlwZV0sIHggPSAnX19zdG9yYWdlX3Rlc3RfXydcclxuICAgICAgICAgICAgc3RvcmFnZS5zZXRJdGVtKHgsIHgpXHJcbiAgICAgICAgICAgIHN0b3JhZ2UucmVtb3ZlSXRlbSh4KVxyXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZVxyXG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBET01FeGNlcHRpb24gJiYgKGUuY29kZSA9PT0gMjIgfHwgZS5jb2RlID09PSAxMDE0IHx8IGUubmFtZSA9PT0gJ1F1b3RhRXhjZWVkZWRFcnJvcicgfHwgZS5uYW1lID09PSAnTlNfRVJST1JfRE9NX1FVT1RBX1JFQUNIRUQnKSAmJiBzdG9yYWdlLmxlbmd0aCAhPT0gMFxyXG4gICAgICAgIH1cclxuICAgIH1cclxufTsiLCLvu78ndXNlIHN0cmljdCdcclxuXHJcbnZhciB1dGlscyA9IHt9XHJcblxyXG52YXIgZW51bWVyYXRlID0gZnVuY3Rpb24gKG9iaikge1xyXG4gICAgZm9yICh2YXIgcHJvcGVydHkgaW4gb2JqKSB7XHJcbiAgICAgICAgaWYgKG9iai5oYXNPd25Qcm9wZXJ0eShwcm9wZXJ0eSkpIHtcclxuICAgICAgICAgICAgdXRpbHNbcHJvcGVydHldID0gb2JqW3Byb3BlcnR5XVxyXG4gICAgICAgIH1cclxuICAgIH1cclxufVxyXG5cclxuZW51bWVyYXRlKHJlcXVpcmUoJy4vbnVtYmVycy5qcycpKVxyXG5lbnVtZXJhdGUocmVxdWlyZSgnLi90b29scy5qcycpKVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSB1dGlsc1xyXG4iXX0=
