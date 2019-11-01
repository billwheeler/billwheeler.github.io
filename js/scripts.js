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

var Vehicle = require('../dnd/vehicle.js');

var players = [];
var npcs = [];
var vehicles = [];

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

var vehicleById = function vehicleById(id) {
  var vehicle = null;

  if (Utils.isNumeric(id)) {
    vehicle = vehicles.filter(function (a) {
      return a.id === id;
    });
    if (vehicle.length > 0) return vehicle[0];
  }

  return vehicle;
};

var addNpc = function addNpc(npc) {
  npcs.push(npc);
};

module.exports.pull = function (data, fresh) {
  players.length = 0;
  npcs.length = 0;
  vehicles.length = 0;

  for (var i = 0, l = data.players.length; i < l; i++) {
    var p = new Player();
    p.parse(data.players[i]);
    players.push(p);
  }

  for (var i = 0, l = data.npcs.length; i < l; i++) {
    var n = new Npc();
    n.parse(data.npcs[i]);
    npcs.push(n);
  }

  for (var i = 0, l = data.vehicles.length; i < l; i++) {
    var v = new Vehicle();
    v.parse(data.vehicles[i]);
    vehicles.push(v);
  }

  if (fresh) {
    for (var i = 0, l = npcs.length; i < l; i++) {
      if (npcs[i].companionTo) {
        addCompanionTo(npcs[i].id, npcs[i].companionTo);
      }
    }
  }

  if (fresh) push();
};

var addCompanionTo = function addCompanionTo(companionId, npcName) {
  for (var i = 0, l = players.length; i < l; i++) {
    if (players[i].name === npcName) {
      players[i].companions.push(companionId);
      return true;
    }
  }

  for (var i = 0, l = npcs.length; i < l; i++) {
    if (npcs[i].name === npcName) {
      npcs[i].companions.push(companionId);
      return true;
    }
  }

  return false;
};

var push = function push() {
  var out = {
    npcs: [],
    players: [],
    vehicles: []
  };

  for (var i = 0, l = npcs.length; i < l; i++) {
    out.npcs.push(npcs[i].serialize());
  }

  for (var i = 0, l = players.length; i < l; i++) {
    out.players.push(players[i].serialize());
  }

  for (var i = 0, l = vehicles.length; i < l; i++) {
    out.vehicles.push(vehicles[i].serialize());
  }

  return out;
};

module.exports.push = push;

module.exports.reset = function () {};

module.exports.charsByState = function (curState, callback) {
  if (Utils.isFunction(callback)) {
    var output = [];

    if (curState === CharacterState.Idle) {
      for (var i = 0, l = vehicles.length; i < l; i++) {
        output.push(vehicles[i]);
      }
    }

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

      if (player.companions.length > 0) {
        for (var i = 0, l = player.companions.length; i < l; i++) {
          var c = npcById(player.companions[i]);
          if (c) c.applyInitiative(player.initiative);
        }
      }

      break;

    case CharacterAction.Leave:
      player.leaveEncounter();

      if (player.companions.length > 0) {
        for (var i = 0, l = player.companions.length; i < l; i++) {
          var c = npcById(player.companions[i]);
          if (c) c.leaveEncounter();
        }
      }

      break;

    case CharacterAction.Revive:
      player.revive();
      break;

    case CharacterAction.Die:
      player.die();
      break;

    case CharacterAction.Spell:
      player.useSpell(params[0], params[1]);
      break;

    case CharacterAction.Rest:
      player.applyRest();
      break;

    case CharacterAction.Concentrate:
      player.concentrate();
      break;

    case CharacterAction.Toggle:
      player.toggle();
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

      if (currentNpc.companions.length > 0) {
        for (var i = 0, l = currentNpc.companions.length; i < l; i++) {
          var c = npcById(currentNpc.companions[i]);
          if (c) c.applyInitiative(currentNpc.initiative);
        }
      }

      break;

    case CharacterAction.Leave:
      currentNpc.leaveEncounter();

      if (currentNpc.companions.length > 0) {
        for (var i = 0, l = currentNpc.companions.length; i < l; i++) {
          var c = npcById(currentNpc.companions[i]);
          if (c) c.leaveEncounter();
        }
      }

      break;

    case CharacterAction.Revive:
      currentNpc.revive();
      break;

    case CharacterAction.Die:
      currentNpc.die();
      break;

    case CharacterAction.Spell:
      currentNpc.useSpell(params[0], params[1]);
      break;

    case CharacterAction.Rest:
      currentNpc.applyRest();
      break;

    case CharacterAction.Concentrate:
      currentNpc.concentrate();
      break;

    case CharacterAction.Toggle:
      currentNpc.toggle();
      break;
  }
};

module.exports.updateVehicle = function (id, action, params) {
  var vehicle = vehicleById(id);
  if (!vehicle) return;

  switch (action) {
    case CharacterAction.Damage:
      vehicle.applyDamage(params[0], params[1]);
      break;

    case CharacterAction.Toggle:
      vehicle.toggle();
      break;
  }
};

},{"../dnd/npc.js":34,"../dnd/player.js":35,"../dnd/vehicle.js":37}],29:[function(require,module,exports){
(function (global){
'use strict';

var axios = require('axios');

var storageKey = 'OssariaSessionNine';

var save = function save(data) {
  return localStorage.setItem(storageKey, data);
};

var lastUsedId = 0;

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

module.exports.assignId = function () {
  lastUsedId++;
  return lastUsedId;
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
          if (Utils.isInteger(initiative)) Entities.updatePlayer(id, CharacterAction.Initiative, [initiative]);
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

        case 'player_concentrate':
          Entities.updatePlayer(id, CharacterAction.Concentrate);
          break;

        case 'player_toggle':
          Entities.updatePlayer(id, CharacterAction.Toggle);
          break;

        case 'npc_initiative':
          Entities.updateNpc(id, CharacterAction.Initiative);
          break;

        case 'npc_damage':
          var damage = parseInt(document.getElementById('npc_damage_' + id).value);
          if (Utils.isInteger(damage)) Entities.updateNpc(id, CharacterAction.Damage, [damage]);
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

        case 'npc_rest':
          Entities.updateNpc(id, CharacterAction.Rest);
          break;

        case 'npc_spell_slot':
          var spellSlotId = parseInt(e.target.getAttribute('data-level-id'));
          var checked = e.target.checked;
          if (Utils.isInteger(spellSlotId)) Entities.updateNpc(id, CharacterAction.Spell, [spellSlotId, checked]);
          break;

        case 'npc_concentrate':
          Entities.updateNpc(id, CharacterAction.Concentrate);
          break;

        case 'npc_toggle':
          Entities.updateNpc(id, CharacterAction.Toggle);
          break;

        case 'vehicle_toggle':
          Entities.updateVehicle(id, CharacterAction.Toggle);
          break;

        case 'component_damage':
          var vehicleId = parseInt(e.target.getAttribute('data-vehicle-id'));
          var damage = parseInt(document.getElementById('component_damage_' + id).value);
          if (Utils.isInteger(damage)) Entities.updateVehicle(vehicleId, CharacterAction.Damage, [id, damage]);
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

var Storage = require('../app/storage.js');

var component = function component() {
  this.id = 0;
  this.vehicleId = 0;
  this.name = "";
  this.health = 0;
  this.maxHealth = 0;
  this.armor = 0;
  this.speed = 0;
  this.decrement = 0;
  this.stages = 0;
  this.threshold = 0;
  this.attackToHit = 0;
  this.attackRoll = "1d6";
  this.attackRange = "120/320";
  this.attackDamage = "piercing";
  this.visible = true;
};

component.prototype.parse = function (json) {
  if (!json) return;

  if (json.id && Utils.isNumeric(json.id)) {
    this.id = json.id;
  }

  if (this.id === 0) {
    this.id = Storage.assignId();
  }

  if (json.vehicleId && Utils.isNumeric(json.vehicleId)) {
    this.vehicleId = json.vehicleId;
  }

  if (json.name) {
    this.name = json.name;
  }

  if (json.health && Utils.isNumeric(json.health)) {
    this.health = json.health;
  }

  if (json.maxHealth && Utils.isNumeric(json.maxHealth)) {
    this.maxHealth = json.maxHealth;
  }

  if (json.armor && Utils.isNumeric(json.armor)) {
    this.armor = json.armor;
  }

  if (json.speed && Utils.isNumeric(json.speed)) {
    this.speed = json.speed;
  }

  if (json.decrement && Utils.isNumeric(json.decrement)) {
    this.decrement = json.decrement;
  }

  if (json.stages && Utils.isNumeric(json.stages)) {
    this.stages = json.stages;
  }

  if (json.threshold && Utils.isNumeric(json.threshold)) {
    this.threshold = json.threshold;
  }

  if (json.attackToHit && Utils.isNumeric(json.attackToHit)) {
    this.attackToHit = json.attackToHit;
  }

  if (json.attackRoll) {
    this.attackRoll = json.attackRoll;
  }

  if (json.attackRange) {
    this.attackRoll = json.attackRoll;
  }

  if (json.attackDamage) {
    this.attackDamage = json.attackDamage;
  }

  if (json.visible) {
    this.visible = json.visible;
  }
};

component.prototype.serialize = function () {
  return {
    id: this.id,
    vehicleId: this.vehicleId,
    name: this.name,
    health: this.health,
    maxHealth: this.maxHealth,
    armor: this.armor,
    speed: this.speed,
    decrement: this.decrement,
    stages: this.stages,
    threshold: this.threshold,
    attackToHit: this.attackToHit,
    attackRoll: this.attackRoll,
    attackRange: this.attackRange,
    attackDamage: this.attackDamage,
    visible: this.visible
  };
};

component.prototype.render = function () {
  var out = '<div class="component" data-id="' + this.id + '">';
  out += '<div class="bold">' + this.name + '</div>';

  if (this.speed > 0) {
    out += '<div><span class="bold">Speed:</span> ' + this.calculateSpeed() + '</div>';
  }

  out += '<div>Health: <span class="bold">' + this.health + '</span>, AC: <span class="bold">' + this.armor + '</span></div>';
  out += '<div><input type="button" class="component_damage" value="Apply Damage" data-id="' + this.id + '" data-vehicle-id="' + this.vehicleId + '" /><input type="text" id="component_damage_' + this.id + '" /></div>';

  if (this.attackToHit > 0) {
    out += '<div class="component-attack"><div class="bold">Ranged Weapon Attack</div>';
    out += '<div>1d20 + ' + this.attackToHit + ' to hit, ' + this.attackRoll + '</div>';
    out += '<div class="italic">' + this.attackDamage + '</div></div>';
  }

  out += '</div>';
  return out;
};

component.prototype.calculateSpeed = function () {
  var slowdown = 0;

  if (this.stages > 0 && this.health < this.maxHealth) {
    if (this.health > 0) {
      var portion = Math.floor(this.maxHealth / this.stages);

      for (var i = this.stages; i > 0; i--) {
        if (portion * i >= this.health) slowdown += this.decrement;
      }
    } else {
      slowdown = this.speed;
    }
  }

  return Utils.clamp(this.speed - slowdown, 0, this.speed);
};

component.prototype.applyDamage = function (damage) {
  if (this.threshold > 0) {
    if (Math.abs(damage) >= this.threshold) this.health -= damage;
  } else {
    this.health -= damage;
  }

  this.health = Utils.clamp(this.health, 0, this.maxHealth);
};

module.exports = component;

},{"../app/storage.js":29}],32:[function(require,module,exports){
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
  Revive: 'revive',
  Spell: 'spell',
  Rest: 'rest',
  Concentrate: 'concentrate',
  Toggle: 'toggle'
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

var Storage = require('../app/storage.js');

var npc = function npc() {
  this.id = 0;
  this.name = '';
  this.health = 5;
  this.maxHealth = 5;
  this.armor = 10;
  this.speed = 15;
  this.race = 'Human';
  this.initiative = 0;
  this.weapons = [];
  this.spells = [];
  this.companions = [];
  this.companionTo = null;
  this.state = CharacterState.Idle;
  this.link = '';
  this.initMod = 0;
  this.template = false;
  this.instance = 0;
  this.concentrating = false;
  this.visible = false;
};

npc.prototype.parse = function (json) {
  if (!json) return;

  if (json.id && Utils.isNumeric(json.id)) {
    this.id = json.id;
  }

  if (this.id === 0) {
    this.id = Storage.assignId();
  }

  if (json.name) {
    this.name = json.name;
  }

  if (json.health && Utils.isNumeric(json.health)) {
    this.health = json.health;
  }

  if (json.maxHealth && Utils.isNumeric(json.maxHealth)) {
    this.maxHealth = json.maxHealth;
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
      if (s.parentId === 0) s.parentId = this.id;
      this.spells.push(s);
    }
  }

  if (json.companions && Utils.isArray(json.companions)) {
    for (var i = 0, l = json.companions.length; i < l; i++) {
      this.companions.push(json.companions[i]);
    }
  }

  if (json.link) {
    this.link = json.link;
  }

  if (json.template) {
    this.template = json.template;
  }

  if (!this.template && json.companionTo) {
    this.companionTo = json.companionTo;
  }

  if (json.initMod && Utils.isNumeric(json.initMod)) {
    this.initMod = json.initMod;
  }

  if (json.concentrating) {
    this.concentrating = json.concentrating;
  }

  if (json.visible) {
    this.visible = json.visible;
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

  var companions = [];

  for (var i = 0, l = this.companions.length; i < l; i++) {
    companions.push(this.companions[i]);
  }

  var out = {
    id: this.id,
    name: this.name,
    health: this.health,
    maxHealth: this.maxHealth,
    armor: this.armor,
    speed: this.speed,
    race: this.race,
    initiative: this.initiative,
    weapons: weapons,
    spells: spells,
    companions: companions,
    companionTo: this.companionTo,
    state: this.state,
    link: this.link,
    initMod: this.initMod,
    template: this.template,
    instance: this.instance,
    concentrating: this.concentrating,
    visible: this.visible
  };
  return out;
};

npc.prototype.render = function () {
  var classes = 'ent npc';
  if (this.companionTo) classes += ' companion';
  var out = '<div class="' + classes + '" data-id="' + this.id + '">';
  var toggleChar = this.visible ? 'close' : 'open';
  out += '<div><span class="bold">' + this.name + '</span>, <span class="italic">' + this.race + '</span>. Speed: ' + this.speed;
  out += '<input type="button" class="npc_toggle" data-id="' + this.id + '" value="' + toggleChar + '" /><div class="clear"></div></div>';

  if (this.visible) {
    var initiative = '';
    if (this.state === CharacterState.Encounter) initiative = ' (' + (this.health > 0 ? 'alive' : 'dead') + '), Initiative: <span class="bold">' + this.initiative + '</span>';
    out += '<div>Health: <span class="bold">' + this.health + '</span>, AC: <span class="bold">' + this.armor + '</span>' + initiative + '</div>';

    for (var i = 0, l = this.weapons.length; i < l; i++) {
      out += '<div>' + this.weapons[i].render() + '</div>';
    }

    if (this.spells.length > 0) {
      out += '<table cellpadding="0" cellspacing="0" border="0" class="npc-spell-list">';

      for (var i = 0, l = this.spells.length; i < l; i++) {
        out += this.spells[i].render();
      }

      out += '</table>';
    }

    if (this.state === CharacterState.Encounter) {
      out += '<div><input type="button" class="npc_damage" value="Apply Damage" data-id="' + this.id + '" /><input type="text" id="npc_damage_' + this.id + '" /></div>';
      out += '<div style="margin-top: 4px;">';
      if (!this.companionTo) out += '<input type="button" class="npc_leave" value="Leave Encounter" data-id="' + this.id + '" />&nbsp;';
      out += '<input type="button" class="npc_rest" value="Rest" data-id="' + this.id + '" />&nbsp;';
      out += '<input type="button" class="npc_die" value="Die" data-id="' + this.id + '" />';
      out += '</div>';
    } else if (this.state === CharacterState.Idle) {
      out += '<div>';
      if (!this.companionTo) out += '<input type="button" class="npc_initiative" value="Roll Initiative" data-id="' + this.id + '" />&nbsp;';
      out += '<input type="button" class="npc_rest" value="Rest" data-id="' + this.id + '" />&nbsp;';
      if (!this.template) out += '<input type="button" class="npc_die" value="Die" data-id="' + this.id + '" />';
      out += '</div>';
    } else if (this.state === CharacterState.Dead) {
      out += '<div><input type="button" class="npc_revive" value="Revive NPC" data-id="' + this.id + '" /></div>';
    }

    var con = 'npc_concentrating_' + this.id;

    if (this.concentrating) {
      out += '<div class="concentration"><label for="' + con + '">Concentrating</label><input class="npc_concentrate" id="' + con + '" data-id="' + this.id + '" type="checkbox" checked="checked" /></div>';
    } else {
      out += '<div class="concentration"><label for="' + con + '">Concentrating</label><input class="npc_concentrate" id="' + con + '" data-id="' + this.id + '" type="checkbox" /></div>';
    }

    if (this.link) out += '<div><a href="' + this.link + '" target="_blank">D&D Beyond</a></div>';
  }

  out += '</div>';
  return out;
};

npc.prototype.rollInitiative = function () {
  this.state = CharacterState.Encounter;
  this.initiative = roll.d20() + this.initMod;
};

npc.prototype.applyInitiative = function (initiative) {
  this.initiative = initiative;

  if (this.state !== CharacterState.Dead) {
    this.state = CharacterState.Encounter;
  }
};

npc.prototype.applyDamage = function (damage) {
  this.health -= damage;

  if (this.health <= 0) {
    this.state = CharacterState.Dead;
  }

  this.health = Utils.clamp(this.health, 0, this.maxHealth);
};

npc.prototype.revive = function () {
  this.health = 1;
  this.state = CharacterState.Encounter;
};

npc.prototype.leaveEncounter = function () {
  this.initiative = 0;
  this.state = CharacterState.Idle;
};

npc.prototype.die = function () {
  this.health = 0;
  this.state = CharacterState.Dead;
};

npc.prototype.clone = function () {
  var n = new npc();
  this.instance++;
  n.parse({
    name: this.name + ' #' + this.instance,
    health: this.health,
    maxHealth: this.maxHealth,
    armor: this.armor,
    speed: this.speed,
    race: this.race,
    link: this.link,
    initMod: this.initMod,
    visible: this.visible
  });
  var weapons = [];

  for (var i = 0, l = this.weapons.length; i < l; i++) {
    weapons.push(this.weapons[i].clone(n.id));
  }

  n.weapons = weapons;
  var spells = [];

  for (var i = 0, l = this.spells.length; i < l; i++) {
    spells.push(this.spells[i].clone(n.id));
  }

  n.spells = spells;
  return n;
};

npc.prototype.useSpell = function (slotId, use) {
  for (var i = 0, l = this.spells.length; i < l; i++) {
    if (this.spells[i].id === slotId) {
      if (use) this.spells[i].used++;else this.spells[i].used--;
      this.spells[i].used = Utils.clamp(this.spells[i].used, 0, this.spells.slots);
      return true;
    }
  }

  return false;
};

npc.prototype.applyRest = function () {
  this.health = this.maxHealth;

  for (var i = 0, l = this.spells.length; i < l; i++) {
    this.spells[i].used = 0;
  }
};

npc.prototype.concentrate = function () {
  this.concentrating = !this.concentrating;
};

npc.prototype.toggle = function () {
  this.visible = this.visible ? false : true;
};

module.exports = npc;

},{"../app/storage.js":29,"../dnd/dice.js":33,"./spell.js":36,"./weapon.js":38}],35:[function(require,module,exports){
'use strict';

var Storage = require('../app/storage.js');

var player = function player() {
  this.id = 0;
  this.name = '';
  this.player = '';
  this.initiative = 0;
  this.state = CharacterState.Idle;
  this.exhaustion = 0;
  this.link = '';
  this.companions = [];
  this.concentrating = false;
  this.visible = false;
};

player.prototype.parse = function (json) {
  if (!json) return;

  if (json.id && Utils.isNumeric(json.id)) {
    this.id = json.id;
  }

  if (this.id === 0) {
    this.id = Storage.assignId();
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

  if (json.companions && Utils.isArray(json.companions)) {
    for (var i = 0, l = json.companions.length; i < l; i++) {
      this.companions.push(json.companions[i]);
    }
  }

  if (json.concentrating) {
    this.concentrating = json.concentrating;
  }

  if (json.visible) {
    this.visible = json.visible;
  }
};

player.prototype.serialize = function () {
  var companions = [];

  for (var i = 0, l = this.companions.length; i < l; i++) {
    companions.push(this.companions[i]);
  }

  return {
    id: this.id,
    name: this.name,
    player: this.player,
    initiative: this.initiative,
    state: this.state,
    exhaustion: this.exhaustion,
    link: this.link,
    companions: companions,
    concentrating: this.concentrating,
    visible: this.visible
  };
};

player.prototype.render = function () {
  var out = '<div class="ent player" data-id="' + this.id + '">';
  var toggleChar = this.visible ? 'close' : 'open';
  out += '<div><span class="bold">' + this.name + '</span> <span class="italics">' + this.player + '</span>';
  out += '<input type="button" class="player_toggle" data-id="' + this.id + '" value="' + toggleChar + '" /><div class="clear"></div></div>';

  if (this.visible) {
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

    if (this.concentrating) {
      out += '<label class="concentration">Concentrating<input class="player_concentrate" data-id="' + this.id + '" type="checkbox" checked="checked" /></label>';
    } else {
      out += '<label class="concentration">Concentrating<input class="player_concentrate" data-id="' + this.id + '" type="checkbox" /></label>';
    }

    if (this.link) out += '<div><a href="' + this.link + '" target="_blank">D&D Beyond</a></div>';
  }

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

player.prototype.useSpell = function (slotId, use) {
  return false;
};

player.prototype.applyRest = function () {};

player.prototype.concentrate = function () {
  this.concentrating = !this.concentrating;
};

player.prototype.toggle = function () {
  this.visible = this.visible ? false : true;
};

module.exports = player;

},{"../app/storage.js":29}],36:[function(require,module,exports){
'use strict';

var Storage = require('../app/storage.js');

var spell = function spell() {
  this.id = 0;
  this.parentId = 0;
  this.name = '';
  this.slots = 0;
  this.used = 0;
};

spell.prototype.parse = function (json) {
  if (!json) return;

  if (json.id && Utils.isNumeric(json.id)) {
    this.id = json.id;
  }

  if (this.id === 0) {
    this.id = Storage.assignId();
  }

  if (json.parentId && Utils.isNumeric(json.parentId)) {
    this.parentId = json.parentId;
  }

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
    id: this.id,
    parentId: this.parentId,
    name: this.name,
    slots: this.slots,
    used: this.used
  };
};

spell.prototype.serialize = function () {
  return {
    id: this.id,
    parentId: this.parentId,
    name: this.name,
    slots: this.slots,
    used: this.used
  };
};

spell.prototype.clone = function (parentId) {
  var s = new spell();
  s.parse({
    name: this.name,
    parentId: parentId,
    slots: this.slots,
    used: this.used
  });
  return s;
};

spell.prototype.render = function () {
  var out = '<tr>';
  out += '<td>' + this.name + '</td>';

  for (var i = 0, l = this.slots; i < l; i++) {
    out += '<td>';

    if (i + 1 <= this.used) {
      out += '<input class="npc_spell_slot" type="checkbox" checked="checked" data-id="' + this.parentId + '" data-level-id="' + this.id + '" />';
    } else {
      out += '<input class="npc_spell_slot" type="checkbox" data-id="' + this.parentId + '" data-level-id="' + this.id + '" />';
    }

    out += '</td>';
  }

  out += '</tr>';
  return out;
};

module.exports = spell;

},{"../app/storage.js":29}],37:[function(require,module,exports){
'use strict';

var Component = require('./component.js');

var Storage = require('../app/storage.js');

var vehicle = function vehicle() {
  this.id = 0;
  this.name = "";
  this.type = "";
  this.components = [];
  this.link = "";
  this.visible = false;
};

vehicle.prototype.parse = function (json) {
  if (!json) return;

  if (json.id && Utils.isNumeric(json.id)) {
    this.id = json.id;
  }

  if (this.id === 0) {
    this.id = Storage.assignId();
  }

  if (json.name) {
    this.name = json.name;
  }

  if (json.type) {
    this.type = json.type;
  }

  if (json.components && Utils.isArray(json.components)) {
    for (var i = 0, l = json.components.length; i < l; i++) {
      var c = new Component();
      c.parse(json.components[i]);
      if (c.vehicleId === 0) c.vehicleId = this.id;
      this.components.push(c);
    }
  }

  if (json.link) {
    this.link = json.link;
  }

  if (json.visible) {
    this.visible = json.visible;
  }
};

vehicle.prototype.serialize = function () {
  var components = [];

  for (var i = 0, l = this.components.length; i < l; i++) {
    components.push(this.components[i]);
  }

  return {
    id: this.id,
    name: this.name,
    type: this.type,
    components: components,
    link: this.link,
    visible: this.visible
  };
};

vehicle.prototype.render = function () {
  var out = '<div class="ent vehicle" data-id="' + this.id + '">';
  var toggleChar = this.visible ? 'close' : 'open';
  out += '<div><span class="bold">' + this.name + '</span> <span class="italics">' + this.type + '</span> ';
  out += '<input type="button" class="vehicle_toggle" data-id="' + this.id + '" value="' + toggleChar + '" /><div class="clear"></div></div>';

  if (this.visible) {
    if (this.components.length > 0) {
      out += '<div class="components">';
      out += '<table cellpadding="0" cellspacing="2" border="0">';

      for (var i = 0, l = this.components.length; i < l; i++) {
        if (i % 2 === 0) out += '<tr>';
        out += '<td>' + this.components[i].render() + '</td>';
        if (i % 2 !== 0) out += '</tr>';
      }

      if (i % 2 === 0) out += '</tr>';
      out += '</table>';
      out += '</div>';
    }

    if (this.link) out += '<div><a href="' + this.link + '" target="_blank">D&D Beyond</a></div>';
  }

  out += '</div>';
  return out;
};

vehicle.prototype.applyDamage = function (componentId, damage) {
  for (var i = 0, l = this.components.length; i < l; i++) {
    if (this.components[i].id === componentId) {
      this.components[i].applyDamage(damage);
      return true;
    }
  }

  return false;
};

vehicle.prototype.toggle = function () {
  this.visible = this.visible ? false : true;
};

module.exports = vehicle;

},{"../app/storage.js":29,"./component.js":31}],38:[function(require,module,exports){
'use strict';

var Storage = require('../app/storage.js');

var weapon = function weapon() {
  this.id = 0;
  this.parentId = 0;
  this.name = '';
  this.dice = '1d4';
  this.hitMod = 0;
  this.attackMod = 0;
  this.damageType = DamageType.Bludgeoning;
};

weapon.prototype.parse = function (json) {
  if (!json) return;

  if (json.id && Utils.isNumeric(json.id)) {
    this.id = json.id;
  }

  if (this.id === 0) {
    this.id = Storage.assignId();
  }

  if (json.parentId && Utils.isNumeric(json.parentId)) {
    this.parentId = json.parentId;
  }

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
    id: this.id,
    name: this.name,
    dice: this.dice,
    hitMod: this.hitMod,
    attackMod: this.attackMod,
    damageType: this.damageType
  };
};

weapon.prototype.clone = function (parentId) {
  var w = new weapon();
  w.parse({
    name: this.name,
    parentId: parentId,
    dice: this.dice,
    hitMod: this.hitMod,
    attackMod: this.attackMod,
    damageType: this.damageType
  });
  return w;
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

},{"../app/storage.js":29}],39:[function(require,module,exports){
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

},{"./app/ui.js":30,"./dnd/constants.js":32,"./utils/debug.js":40,"./utils/utils.js":43}],40:[function(require,module,exports){
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

},{}],41:[function(require,module,exports){
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

},{}],42:[function(require,module,exports){
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
  isInteger: function isInteger(value) {
    return typeof value === 'number' && isFinite(value) && Math.floor(value) === value;
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

},{}],43:[function(require,module,exports){
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

},{"./numbers.js":41,"./tools.js":42}]},{},[39])(39)
});

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYXhpb3MvaW5kZXguanMiLCJub2RlX21vZHVsZXMvYXhpb3MvbGliL2FkYXB0ZXJzL3hoci5qcyIsIm5vZGVfbW9kdWxlcy9heGlvcy9saWIvYXhpb3MuanMiLCJub2RlX21vZHVsZXMvYXhpb3MvbGliL2NhbmNlbC9DYW5jZWwuanMiLCJub2RlX21vZHVsZXMvYXhpb3MvbGliL2NhbmNlbC9DYW5jZWxUb2tlbi5qcyIsIm5vZGVfbW9kdWxlcy9heGlvcy9saWIvY2FuY2VsL2lzQ2FuY2VsLmpzIiwibm9kZV9tb2R1bGVzL2F4aW9zL2xpYi9jb3JlL0F4aW9zLmpzIiwibm9kZV9tb2R1bGVzL2F4aW9zL2xpYi9jb3JlL0ludGVyY2VwdG9yTWFuYWdlci5qcyIsIm5vZGVfbW9kdWxlcy9heGlvcy9saWIvY29yZS9jcmVhdGVFcnJvci5qcyIsIm5vZGVfbW9kdWxlcy9heGlvcy9saWIvY29yZS9kaXNwYXRjaFJlcXVlc3QuanMiLCJub2RlX21vZHVsZXMvYXhpb3MvbGliL2NvcmUvZW5oYW5jZUVycm9yLmpzIiwibm9kZV9tb2R1bGVzL2F4aW9zL2xpYi9jb3JlL21lcmdlQ29uZmlnLmpzIiwibm9kZV9tb2R1bGVzL2F4aW9zL2xpYi9jb3JlL3NldHRsZS5qcyIsIm5vZGVfbW9kdWxlcy9heGlvcy9saWIvY29yZS90cmFuc2Zvcm1EYXRhLmpzIiwibm9kZV9tb2R1bGVzL2F4aW9zL2xpYi9kZWZhdWx0cy5qcyIsIm5vZGVfbW9kdWxlcy9heGlvcy9saWIvaGVscGVycy9iaW5kLmpzIiwibm9kZV9tb2R1bGVzL2F4aW9zL2xpYi9oZWxwZXJzL2J1aWxkVVJMLmpzIiwibm9kZV9tb2R1bGVzL2F4aW9zL2xpYi9oZWxwZXJzL2NvbWJpbmVVUkxzLmpzIiwibm9kZV9tb2R1bGVzL2F4aW9zL2xpYi9oZWxwZXJzL2Nvb2tpZXMuanMiLCJub2RlX21vZHVsZXMvYXhpb3MvbGliL2hlbHBlcnMvaXNBYnNvbHV0ZVVSTC5qcyIsIm5vZGVfbW9kdWxlcy9heGlvcy9saWIvaGVscGVycy9pc1VSTFNhbWVPcmlnaW4uanMiLCJub2RlX21vZHVsZXMvYXhpb3MvbGliL2hlbHBlcnMvbm9ybWFsaXplSGVhZGVyTmFtZS5qcyIsIm5vZGVfbW9kdWxlcy9heGlvcy9saWIvaGVscGVycy9wYXJzZUhlYWRlcnMuanMiLCJub2RlX21vZHVsZXMvYXhpb3MvbGliL2hlbHBlcnMvc3ByZWFkLmpzIiwibm9kZV9tb2R1bGVzL2F4aW9zL2xpYi91dGlscy5qcyIsIm5vZGVfbW9kdWxlcy9heGlvcy9ub2RlX21vZHVsZXMvaXMtYnVmZmVyL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qcyIsInNyYy9hcHAvZW50aXRpZXMuanMiLCJzcmMvYXBwL3N0b3JhZ2UuanMiLCJzcmMvYXBwL3VpLmpzIiwic3JjL2RuZC9jb21wb25lbnQuanMiLCJzcmMvZG5kL2NvbnN0YW50cy5qcyIsInNyYy9kbmQvZGljZS5qcyIsInNyYy9kbmQvbnBjLmpzIiwic3JjL2RuZC9wbGF5ZXIuanMiLCJzcmMvZG5kL3NwZWxsLmpzIiwic3JjL2RuZC92ZWhpY2xlLmpzIiwic3JjL2RuZC93ZWFwb24uanMiLCJzcmMvbWFpbi5qcyIsInNyYy91dGlscy9kZWJ1Zy5qcyIsInNyYy91dGlscy9udW1iZXJzLmpzIiwic3JjL3V0aWxzL3Rvb2xzLmpzIiwic3JjL3V0aWxzL3V0aWxzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNwQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDbEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNkQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNkQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOVVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FB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QSxNQUFBLE9BQU8sQ0FBQyxPQUFSLENBQWdCLENBQWhCLEVBQW1CLENBQW5CO0FBQ0EsTUFBQSxPQUFPLENBQUMsVUFBUixDQUFtQixDQUFuQjtBQUNBLGFBQU8sSUFBUDtBQUNILEtBTEQsQ0FLRSxPQUFPLENBQVAsRUFBVTtBQUNSLGFBQU8sQ0FBQyxZQUFZLFlBQWIsS0FBOEIsQ0FBQyxDQUFDLElBQUYsS0FBVyxFQUFYLElBQWlCLENBQUMsQ0FBQyxJQUFGLEtBQVcsSUFBNUIsSUFBb0MsQ0FBQyxDQUFDLElBQUYsS0FBVyxvQkFBL0MsSUFBdUUsQ0FBQyxDQUFDLElBQUYsS0FBVyw0QkFBaEgsS0FBaUosT0FBTyxDQUFDLE1BQVIsS0FBbUIsQ0FBM0s7QUFDSDtBQUNKO0FBNUJZLENBQWpCOzs7QUNGQzs7QUFFRCxJQUFJLEtBQUssR0FBRyxFQUFaOztBQUVBLElBQUksU0FBUyxHQUFHLFNBQVosU0FBWSxDQUFVLEdBQVYsRUFBZTtBQUMzQixPQUFLLElBQUksUUFBVCxJQUFxQixHQUFyQixFQUEwQjtBQUN0QixRQUFJLEdBQUcsQ0FBQyxjQUFKLENBQW1CLFFBQW5CLENBQUosRUFBa0M7QUFDOUIsTUFBQSxLQUFLLENBQUMsUUFBRCxDQUFMLEdBQWtCLEdBQUcsQ0FBQyxRQUFELENBQXJCO0FBQ0g7QUFDSjtBQUNKLENBTkQ7O0FBUUEsU0FBUyxDQUFDLE9BQU8sQ0FBQyxjQUFELENBQVIsQ0FBVDtBQUNBLFNBQVMsQ0FBQyxPQUFPLENBQUMsWUFBRCxDQUFSLENBQVQ7QUFFQSxNQUFNLENBQUMsT0FBUCxHQUFpQixLQUFqQiIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7ZnVuY3Rpb24gcihlLG4sdCl7ZnVuY3Rpb24gbyhpLGYpe2lmKCFuW2ldKXtpZighZVtpXSl7dmFyIGM9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighZiYmYylyZXR1cm4gYyhpLCEwKTtpZih1KXJldHVybiB1KGksITApO3ZhciBhPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIraStcIidcIik7dGhyb3cgYS5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGF9dmFyIHA9bltpXT17ZXhwb3J0czp7fX07ZVtpXVswXS5jYWxsKHAuZXhwb3J0cyxmdW5jdGlvbihyKXt2YXIgbj1lW2ldWzFdW3JdO3JldHVybiBvKG58fHIpfSxwLHAuZXhwb3J0cyxyLGUsbix0KX1yZXR1cm4gbltpXS5leHBvcnRzfWZvcih2YXIgdT1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGk9MDtpPHQubGVuZ3RoO2krKylvKHRbaV0pO3JldHVybiBvfXJldHVybiByfSkoKSIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9saWIvYXhpb3MnKTsiLCIndXNlIHN0cmljdCc7XG5cbnZhciB1dGlscyA9IHJlcXVpcmUoJy4vLi4vdXRpbHMnKTtcbnZhciBzZXR0bGUgPSByZXF1aXJlKCcuLy4uL2NvcmUvc2V0dGxlJyk7XG52YXIgYnVpbGRVUkwgPSByZXF1aXJlKCcuLy4uL2hlbHBlcnMvYnVpbGRVUkwnKTtcbnZhciBwYXJzZUhlYWRlcnMgPSByZXF1aXJlKCcuLy4uL2hlbHBlcnMvcGFyc2VIZWFkZXJzJyk7XG52YXIgaXNVUkxTYW1lT3JpZ2luID0gcmVxdWlyZSgnLi8uLi9oZWxwZXJzL2lzVVJMU2FtZU9yaWdpbicpO1xudmFyIGNyZWF0ZUVycm9yID0gcmVxdWlyZSgnLi4vY29yZS9jcmVhdGVFcnJvcicpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIHhockFkYXB0ZXIoY29uZmlnKSB7XG4gIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiBkaXNwYXRjaFhoclJlcXVlc3QocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgdmFyIHJlcXVlc3REYXRhID0gY29uZmlnLmRhdGE7XG4gICAgdmFyIHJlcXVlc3RIZWFkZXJzID0gY29uZmlnLmhlYWRlcnM7XG5cbiAgICBpZiAodXRpbHMuaXNGb3JtRGF0YShyZXF1ZXN0RGF0YSkpIHtcbiAgICAgIGRlbGV0ZSByZXF1ZXN0SGVhZGVyc1snQ29udGVudC1UeXBlJ107IC8vIExldCB0aGUgYnJvd3NlciBzZXQgaXRcbiAgICB9XG5cbiAgICB2YXIgcmVxdWVzdCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuXG4gICAgLy8gSFRUUCBiYXNpYyBhdXRoZW50aWNhdGlvblxuICAgIGlmIChjb25maWcuYXV0aCkge1xuICAgICAgdmFyIHVzZXJuYW1lID0gY29uZmlnLmF1dGgudXNlcm5hbWUgfHwgJyc7XG4gICAgICB2YXIgcGFzc3dvcmQgPSBjb25maWcuYXV0aC5wYXNzd29yZCB8fCAnJztcbiAgICAgIHJlcXVlc3RIZWFkZXJzLkF1dGhvcml6YXRpb24gPSAnQmFzaWMgJyArIGJ0b2EodXNlcm5hbWUgKyAnOicgKyBwYXNzd29yZCk7XG4gICAgfVxuXG4gICAgcmVxdWVzdC5vcGVuKGNvbmZpZy5tZXRob2QudG9VcHBlckNhc2UoKSwgYnVpbGRVUkwoY29uZmlnLnVybCwgY29uZmlnLnBhcmFtcywgY29uZmlnLnBhcmFtc1NlcmlhbGl6ZXIpLCB0cnVlKTtcblxuICAgIC8vIFNldCB0aGUgcmVxdWVzdCB0aW1lb3V0IGluIE1TXG4gICAgcmVxdWVzdC50aW1lb3V0ID0gY29uZmlnLnRpbWVvdXQ7XG5cbiAgICAvLyBMaXN0ZW4gZm9yIHJlYWR5IHN0YXRlXG4gICAgcmVxdWVzdC5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBmdW5jdGlvbiBoYW5kbGVMb2FkKCkge1xuICAgICAgaWYgKCFyZXF1ZXN0IHx8IHJlcXVlc3QucmVhZHlTdGF0ZSAhPT0gNCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIC8vIFRoZSByZXF1ZXN0IGVycm9yZWQgb3V0IGFuZCB3ZSBkaWRuJ3QgZ2V0IGEgcmVzcG9uc2UsIHRoaXMgd2lsbCBiZVxuICAgICAgLy8gaGFuZGxlZCBieSBvbmVycm9yIGluc3RlYWRcbiAgICAgIC8vIFdpdGggb25lIGV4Y2VwdGlvbjogcmVxdWVzdCB0aGF0IHVzaW5nIGZpbGU6IHByb3RvY29sLCBtb3N0IGJyb3dzZXJzXG4gICAgICAvLyB3aWxsIHJldHVybiBzdGF0dXMgYXMgMCBldmVuIHRob3VnaCBpdCdzIGEgc3VjY2Vzc2Z1bCByZXF1ZXN0XG4gICAgICBpZiAocmVxdWVzdC5zdGF0dXMgPT09IDAgJiYgIShyZXF1ZXN0LnJlc3BvbnNlVVJMICYmIHJlcXVlc3QucmVzcG9uc2VVUkwuaW5kZXhPZignZmlsZTonKSA9PT0gMCkpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICAvLyBQcmVwYXJlIHRoZSByZXNwb25zZVxuICAgICAgdmFyIHJlc3BvbnNlSGVhZGVycyA9ICdnZXRBbGxSZXNwb25zZUhlYWRlcnMnIGluIHJlcXVlc3QgPyBwYXJzZUhlYWRlcnMocmVxdWVzdC5nZXRBbGxSZXNwb25zZUhlYWRlcnMoKSkgOiBudWxsO1xuICAgICAgdmFyIHJlc3BvbnNlRGF0YSA9ICFjb25maWcucmVzcG9uc2VUeXBlIHx8IGNvbmZpZy5yZXNwb25zZVR5cGUgPT09ICd0ZXh0JyA/IHJlcXVlc3QucmVzcG9uc2VUZXh0IDogcmVxdWVzdC5yZXNwb25zZTtcbiAgICAgIHZhciByZXNwb25zZSA9IHtcbiAgICAgICAgZGF0YTogcmVzcG9uc2VEYXRhLFxuICAgICAgICBzdGF0dXM6IHJlcXVlc3Quc3RhdHVzLFxuICAgICAgICBzdGF0dXNUZXh0OiByZXF1ZXN0LnN0YXR1c1RleHQsXG4gICAgICAgIGhlYWRlcnM6IHJlc3BvbnNlSGVhZGVycyxcbiAgICAgICAgY29uZmlnOiBjb25maWcsXG4gICAgICAgIHJlcXVlc3Q6IHJlcXVlc3RcbiAgICAgIH07XG5cbiAgICAgIHNldHRsZShyZXNvbHZlLCByZWplY3QsIHJlc3BvbnNlKTtcblxuICAgICAgLy8gQ2xlYW4gdXAgcmVxdWVzdFxuICAgICAgcmVxdWVzdCA9IG51bGw7XG4gICAgfTtcblxuICAgIC8vIEhhbmRsZSBicm93c2VyIHJlcXVlc3QgY2FuY2VsbGF0aW9uIChhcyBvcHBvc2VkIHRvIGEgbWFudWFsIGNhbmNlbGxhdGlvbilcbiAgICByZXF1ZXN0Lm9uYWJvcnQgPSBmdW5jdGlvbiBoYW5kbGVBYm9ydCgpIHtcbiAgICAgIGlmICghcmVxdWVzdCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIHJlamVjdChjcmVhdGVFcnJvcignUmVxdWVzdCBhYm9ydGVkJywgY29uZmlnLCAnRUNPTk5BQk9SVEVEJywgcmVxdWVzdCkpO1xuXG4gICAgICAvLyBDbGVhbiB1cCByZXF1ZXN0XG4gICAgICByZXF1ZXN0ID0gbnVsbDtcbiAgICB9O1xuXG4gICAgLy8gSGFuZGxlIGxvdyBsZXZlbCBuZXR3b3JrIGVycm9yc1xuICAgIHJlcXVlc3Qub25lcnJvciA9IGZ1bmN0aW9uIGhhbmRsZUVycm9yKCkge1xuICAgICAgLy8gUmVhbCBlcnJvcnMgYXJlIGhpZGRlbiBmcm9tIHVzIGJ5IHRoZSBicm93c2VyXG4gICAgICAvLyBvbmVycm9yIHNob3VsZCBvbmx5IGZpcmUgaWYgaXQncyBhIG5ldHdvcmsgZXJyb3JcbiAgICAgIHJlamVjdChjcmVhdGVFcnJvcignTmV0d29yayBFcnJvcicsIGNvbmZpZywgbnVsbCwgcmVxdWVzdCkpO1xuXG4gICAgICAvLyBDbGVhbiB1cCByZXF1ZXN0XG4gICAgICByZXF1ZXN0ID0gbnVsbDtcbiAgICB9O1xuXG4gICAgLy8gSGFuZGxlIHRpbWVvdXRcbiAgICByZXF1ZXN0Lm9udGltZW91dCA9IGZ1bmN0aW9uIGhhbmRsZVRpbWVvdXQoKSB7XG4gICAgICByZWplY3QoY3JlYXRlRXJyb3IoJ3RpbWVvdXQgb2YgJyArIGNvbmZpZy50aW1lb3V0ICsgJ21zIGV4Y2VlZGVkJywgY29uZmlnLCAnRUNPTk5BQk9SVEVEJyxcbiAgICAgICAgcmVxdWVzdCkpO1xuXG4gICAgICAvLyBDbGVhbiB1cCByZXF1ZXN0XG4gICAgICByZXF1ZXN0ID0gbnVsbDtcbiAgICB9O1xuXG4gICAgLy8gQWRkIHhzcmYgaGVhZGVyXG4gICAgLy8gVGhpcyBpcyBvbmx5IGRvbmUgaWYgcnVubmluZyBpbiBhIHN0YW5kYXJkIGJyb3dzZXIgZW52aXJvbm1lbnQuXG4gICAgLy8gU3BlY2lmaWNhbGx5IG5vdCBpZiB3ZSdyZSBpbiBhIHdlYiB3b3JrZXIsIG9yIHJlYWN0LW5hdGl2ZS5cbiAgICBpZiAodXRpbHMuaXNTdGFuZGFyZEJyb3dzZXJFbnYoKSkge1xuICAgICAgdmFyIGNvb2tpZXMgPSByZXF1aXJlKCcuLy4uL2hlbHBlcnMvY29va2llcycpO1xuXG4gICAgICAvLyBBZGQgeHNyZiBoZWFkZXJcbiAgICAgIHZhciB4c3JmVmFsdWUgPSAoY29uZmlnLndpdGhDcmVkZW50aWFscyB8fCBpc1VSTFNhbWVPcmlnaW4oY29uZmlnLnVybCkpICYmIGNvbmZpZy54c3JmQ29va2llTmFtZSA/XG4gICAgICAgIGNvb2tpZXMucmVhZChjb25maWcueHNyZkNvb2tpZU5hbWUpIDpcbiAgICAgICAgdW5kZWZpbmVkO1xuXG4gICAgICBpZiAoeHNyZlZhbHVlKSB7XG4gICAgICAgIHJlcXVlc3RIZWFkZXJzW2NvbmZpZy54c3JmSGVhZGVyTmFtZV0gPSB4c3JmVmFsdWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gQWRkIGhlYWRlcnMgdG8gdGhlIHJlcXVlc3RcbiAgICBpZiAoJ3NldFJlcXVlc3RIZWFkZXInIGluIHJlcXVlc3QpIHtcbiAgICAgIHV0aWxzLmZvckVhY2gocmVxdWVzdEhlYWRlcnMsIGZ1bmN0aW9uIHNldFJlcXVlc3RIZWFkZXIodmFsLCBrZXkpIHtcbiAgICAgICAgaWYgKHR5cGVvZiByZXF1ZXN0RGF0YSA9PT0gJ3VuZGVmaW5lZCcgJiYga2V5LnRvTG93ZXJDYXNlKCkgPT09ICdjb250ZW50LXR5cGUnKSB7XG4gICAgICAgICAgLy8gUmVtb3ZlIENvbnRlbnQtVHlwZSBpZiBkYXRhIGlzIHVuZGVmaW5lZFxuICAgICAgICAgIGRlbGV0ZSByZXF1ZXN0SGVhZGVyc1trZXldO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIE90aGVyd2lzZSBhZGQgaGVhZGVyIHRvIHRoZSByZXF1ZXN0XG4gICAgICAgICAgcmVxdWVzdC5zZXRSZXF1ZXN0SGVhZGVyKGtleSwgdmFsKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gQWRkIHdpdGhDcmVkZW50aWFscyB0byByZXF1ZXN0IGlmIG5lZWRlZFxuICAgIGlmIChjb25maWcud2l0aENyZWRlbnRpYWxzKSB7XG4gICAgICByZXF1ZXN0LndpdGhDcmVkZW50aWFscyA9IHRydWU7XG4gICAgfVxuXG4gICAgLy8gQWRkIHJlc3BvbnNlVHlwZSB0byByZXF1ZXN0IGlmIG5lZWRlZFxuICAgIGlmIChjb25maWcucmVzcG9uc2VUeXBlKSB7XG4gICAgICB0cnkge1xuICAgICAgICByZXF1ZXN0LnJlc3BvbnNlVHlwZSA9IGNvbmZpZy5yZXNwb25zZVR5cGU7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIC8vIEV4cGVjdGVkIERPTUV4Y2VwdGlvbiB0aHJvd24gYnkgYnJvd3NlcnMgbm90IGNvbXBhdGlibGUgWE1MSHR0cFJlcXVlc3QgTGV2ZWwgMi5cbiAgICAgICAgLy8gQnV0LCB0aGlzIGNhbiBiZSBzdXBwcmVzc2VkIGZvciAnanNvbicgdHlwZSBhcyBpdCBjYW4gYmUgcGFyc2VkIGJ5IGRlZmF1bHQgJ3RyYW5zZm9ybVJlc3BvbnNlJyBmdW5jdGlvbi5cbiAgICAgICAgaWYgKGNvbmZpZy5yZXNwb25zZVR5cGUgIT09ICdqc29uJykge1xuICAgICAgICAgIHRocm93IGU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBIYW5kbGUgcHJvZ3Jlc3MgaWYgbmVlZGVkXG4gICAgaWYgKHR5cGVvZiBjb25maWcub25Eb3dubG9hZFByb2dyZXNzID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICByZXF1ZXN0LmFkZEV2ZW50TGlzdGVuZXIoJ3Byb2dyZXNzJywgY29uZmlnLm9uRG93bmxvYWRQcm9ncmVzcyk7XG4gICAgfVxuXG4gICAgLy8gTm90IGFsbCBicm93c2VycyBzdXBwb3J0IHVwbG9hZCBldmVudHNcbiAgICBpZiAodHlwZW9mIGNvbmZpZy5vblVwbG9hZFByb2dyZXNzID09PSAnZnVuY3Rpb24nICYmIHJlcXVlc3QudXBsb2FkKSB7XG4gICAgICByZXF1ZXN0LnVwbG9hZC5hZGRFdmVudExpc3RlbmVyKCdwcm9ncmVzcycsIGNvbmZpZy5vblVwbG9hZFByb2dyZXNzKTtcbiAgICB9XG5cbiAgICBpZiAoY29uZmlnLmNhbmNlbFRva2VuKSB7XG4gICAgICAvLyBIYW5kbGUgY2FuY2VsbGF0aW9uXG4gICAgICBjb25maWcuY2FuY2VsVG9rZW4ucHJvbWlzZS50aGVuKGZ1bmN0aW9uIG9uQ2FuY2VsZWQoY2FuY2VsKSB7XG4gICAgICAgIGlmICghcmVxdWVzdCkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHJlcXVlc3QuYWJvcnQoKTtcbiAgICAgICAgcmVqZWN0KGNhbmNlbCk7XG4gICAgICAgIC8vIENsZWFuIHVwIHJlcXVlc3RcbiAgICAgICAgcmVxdWVzdCA9IG51bGw7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBpZiAocmVxdWVzdERhdGEgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmVxdWVzdERhdGEgPSBudWxsO1xuICAgIH1cblxuICAgIC8vIFNlbmQgdGhlIHJlcXVlc3RcbiAgICByZXF1ZXN0LnNlbmQocmVxdWVzdERhdGEpO1xuICB9KTtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciB1dGlscyA9IHJlcXVpcmUoJy4vdXRpbHMnKTtcbnZhciBiaW5kID0gcmVxdWlyZSgnLi9oZWxwZXJzL2JpbmQnKTtcbnZhciBBeGlvcyA9IHJlcXVpcmUoJy4vY29yZS9BeGlvcycpO1xudmFyIG1lcmdlQ29uZmlnID0gcmVxdWlyZSgnLi9jb3JlL21lcmdlQ29uZmlnJyk7XG52YXIgZGVmYXVsdHMgPSByZXF1aXJlKCcuL2RlZmF1bHRzJyk7XG5cbi8qKlxuICogQ3JlYXRlIGFuIGluc3RhbmNlIG9mIEF4aW9zXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IGRlZmF1bHRDb25maWcgVGhlIGRlZmF1bHQgY29uZmlnIGZvciB0aGUgaW5zdGFuY2VcbiAqIEByZXR1cm4ge0F4aW9zfSBBIG5ldyBpbnN0YW5jZSBvZiBBeGlvc1xuICovXG5mdW5jdGlvbiBjcmVhdGVJbnN0YW5jZShkZWZhdWx0Q29uZmlnKSB7XG4gIHZhciBjb250ZXh0ID0gbmV3IEF4aW9zKGRlZmF1bHRDb25maWcpO1xuICB2YXIgaW5zdGFuY2UgPSBiaW5kKEF4aW9zLnByb3RvdHlwZS5yZXF1ZXN0LCBjb250ZXh0KTtcblxuICAvLyBDb3B5IGF4aW9zLnByb3RvdHlwZSB0byBpbnN0YW5jZVxuICB1dGlscy5leHRlbmQoaW5zdGFuY2UsIEF4aW9zLnByb3RvdHlwZSwgY29udGV4dCk7XG5cbiAgLy8gQ29weSBjb250ZXh0IHRvIGluc3RhbmNlXG4gIHV0aWxzLmV4dGVuZChpbnN0YW5jZSwgY29udGV4dCk7XG5cbiAgcmV0dXJuIGluc3RhbmNlO1xufVxuXG4vLyBDcmVhdGUgdGhlIGRlZmF1bHQgaW5zdGFuY2UgdG8gYmUgZXhwb3J0ZWRcbnZhciBheGlvcyA9IGNyZWF0ZUluc3RhbmNlKGRlZmF1bHRzKTtcblxuLy8gRXhwb3NlIEF4aW9zIGNsYXNzIHRvIGFsbG93IGNsYXNzIGluaGVyaXRhbmNlXG5heGlvcy5BeGlvcyA9IEF4aW9zO1xuXG4vLyBGYWN0b3J5IGZvciBjcmVhdGluZyBuZXcgaW5zdGFuY2VzXG5heGlvcy5jcmVhdGUgPSBmdW5jdGlvbiBjcmVhdGUoaW5zdGFuY2VDb25maWcpIHtcbiAgcmV0dXJuIGNyZWF0ZUluc3RhbmNlKG1lcmdlQ29uZmlnKGF4aW9zLmRlZmF1bHRzLCBpbnN0YW5jZUNvbmZpZykpO1xufTtcblxuLy8gRXhwb3NlIENhbmNlbCAmIENhbmNlbFRva2VuXG5heGlvcy5DYW5jZWwgPSByZXF1aXJlKCcuL2NhbmNlbC9DYW5jZWwnKTtcbmF4aW9zLkNhbmNlbFRva2VuID0gcmVxdWlyZSgnLi9jYW5jZWwvQ2FuY2VsVG9rZW4nKTtcbmF4aW9zLmlzQ2FuY2VsID0gcmVxdWlyZSgnLi9jYW5jZWwvaXNDYW5jZWwnKTtcblxuLy8gRXhwb3NlIGFsbC9zcHJlYWRcbmF4aW9zLmFsbCA9IGZ1bmN0aW9uIGFsbChwcm9taXNlcykge1xuICByZXR1cm4gUHJvbWlzZS5hbGwocHJvbWlzZXMpO1xufTtcbmF4aW9zLnNwcmVhZCA9IHJlcXVpcmUoJy4vaGVscGVycy9zcHJlYWQnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBheGlvcztcblxuLy8gQWxsb3cgdXNlIG9mIGRlZmF1bHQgaW1wb3J0IHN5bnRheCBpbiBUeXBlU2NyaXB0XG5tb2R1bGUuZXhwb3J0cy5kZWZhdWx0ID0gYXhpb3M7XG4iLCIndXNlIHN0cmljdCc7XG5cbi8qKlxuICogQSBgQ2FuY2VsYCBpcyBhbiBvYmplY3QgdGhhdCBpcyB0aHJvd24gd2hlbiBhbiBvcGVyYXRpb24gaXMgY2FuY2VsZWQuXG4gKlxuICogQGNsYXNzXG4gKiBAcGFyYW0ge3N0cmluZz19IG1lc3NhZ2UgVGhlIG1lc3NhZ2UuXG4gKi9cbmZ1bmN0aW9uIENhbmNlbChtZXNzYWdlKSB7XG4gIHRoaXMubWVzc2FnZSA9IG1lc3NhZ2U7XG59XG5cbkNhbmNlbC5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbiB0b1N0cmluZygpIHtcbiAgcmV0dXJuICdDYW5jZWwnICsgKHRoaXMubWVzc2FnZSA/ICc6ICcgKyB0aGlzLm1lc3NhZ2UgOiAnJyk7XG59O1xuXG5DYW5jZWwucHJvdG90eXBlLl9fQ0FOQ0VMX18gPSB0cnVlO1xuXG5tb2R1bGUuZXhwb3J0cyA9IENhbmNlbDtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIENhbmNlbCA9IHJlcXVpcmUoJy4vQ2FuY2VsJyk7XG5cbi8qKlxuICogQSBgQ2FuY2VsVG9rZW5gIGlzIGFuIG9iamVjdCB0aGF0IGNhbiBiZSB1c2VkIHRvIHJlcXVlc3QgY2FuY2VsbGF0aW9uIG9mIGFuIG9wZXJhdGlvbi5cbiAqXG4gKiBAY2xhc3NcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGV4ZWN1dG9yIFRoZSBleGVjdXRvciBmdW5jdGlvbi5cbiAqL1xuZnVuY3Rpb24gQ2FuY2VsVG9rZW4oZXhlY3V0b3IpIHtcbiAgaWYgKHR5cGVvZiBleGVjdXRvciAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ2V4ZWN1dG9yIG11c3QgYmUgYSBmdW5jdGlvbi4nKTtcbiAgfVxuXG4gIHZhciByZXNvbHZlUHJvbWlzZTtcbiAgdGhpcy5wcm9taXNlID0gbmV3IFByb21pc2UoZnVuY3Rpb24gcHJvbWlzZUV4ZWN1dG9yKHJlc29sdmUpIHtcbiAgICByZXNvbHZlUHJvbWlzZSA9IHJlc29sdmU7XG4gIH0pO1xuXG4gIHZhciB0b2tlbiA9IHRoaXM7XG4gIGV4ZWN1dG9yKGZ1bmN0aW9uIGNhbmNlbChtZXNzYWdlKSB7XG4gICAgaWYgKHRva2VuLnJlYXNvbikge1xuICAgICAgLy8gQ2FuY2VsbGF0aW9uIGhhcyBhbHJlYWR5IGJlZW4gcmVxdWVzdGVkXG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdG9rZW4ucmVhc29uID0gbmV3IENhbmNlbChtZXNzYWdlKTtcbiAgICByZXNvbHZlUHJvbWlzZSh0b2tlbi5yZWFzb24pO1xuICB9KTtcbn1cblxuLyoqXG4gKiBUaHJvd3MgYSBgQ2FuY2VsYCBpZiBjYW5jZWxsYXRpb24gaGFzIGJlZW4gcmVxdWVzdGVkLlxuICovXG5DYW5jZWxUb2tlbi5wcm90b3R5cGUudGhyb3dJZlJlcXVlc3RlZCA9IGZ1bmN0aW9uIHRocm93SWZSZXF1ZXN0ZWQoKSB7XG4gIGlmICh0aGlzLnJlYXNvbikge1xuICAgIHRocm93IHRoaXMucmVhc29uO1xuICB9XG59O1xuXG4vKipcbiAqIFJldHVybnMgYW4gb2JqZWN0IHRoYXQgY29udGFpbnMgYSBuZXcgYENhbmNlbFRva2VuYCBhbmQgYSBmdW5jdGlvbiB0aGF0LCB3aGVuIGNhbGxlZCxcbiAqIGNhbmNlbHMgdGhlIGBDYW5jZWxUb2tlbmAuXG4gKi9cbkNhbmNlbFRva2VuLnNvdXJjZSA9IGZ1bmN0aW9uIHNvdXJjZSgpIHtcbiAgdmFyIGNhbmNlbDtcbiAgdmFyIHRva2VuID0gbmV3IENhbmNlbFRva2VuKGZ1bmN0aW9uIGV4ZWN1dG9yKGMpIHtcbiAgICBjYW5jZWwgPSBjO1xuICB9KTtcbiAgcmV0dXJuIHtcbiAgICB0b2tlbjogdG9rZW4sXG4gICAgY2FuY2VsOiBjYW5jZWxcbiAgfTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQ2FuY2VsVG9rZW47XG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gaXNDYW5jZWwodmFsdWUpIHtcbiAgcmV0dXJuICEhKHZhbHVlICYmIHZhbHVlLl9fQ0FOQ0VMX18pO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHV0aWxzID0gcmVxdWlyZSgnLi8uLi91dGlscycpO1xudmFyIGJ1aWxkVVJMID0gcmVxdWlyZSgnLi4vaGVscGVycy9idWlsZFVSTCcpO1xudmFyIEludGVyY2VwdG9yTWFuYWdlciA9IHJlcXVpcmUoJy4vSW50ZXJjZXB0b3JNYW5hZ2VyJyk7XG52YXIgZGlzcGF0Y2hSZXF1ZXN0ID0gcmVxdWlyZSgnLi9kaXNwYXRjaFJlcXVlc3QnKTtcbnZhciBtZXJnZUNvbmZpZyA9IHJlcXVpcmUoJy4vbWVyZ2VDb25maWcnKTtcblxuLyoqXG4gKiBDcmVhdGUgYSBuZXcgaW5zdGFuY2Ugb2YgQXhpb3NcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gaW5zdGFuY2VDb25maWcgVGhlIGRlZmF1bHQgY29uZmlnIGZvciB0aGUgaW5zdGFuY2VcbiAqL1xuZnVuY3Rpb24gQXhpb3MoaW5zdGFuY2VDb25maWcpIHtcbiAgdGhpcy5kZWZhdWx0cyA9IGluc3RhbmNlQ29uZmlnO1xuICB0aGlzLmludGVyY2VwdG9ycyA9IHtcbiAgICByZXF1ZXN0OiBuZXcgSW50ZXJjZXB0b3JNYW5hZ2VyKCksXG4gICAgcmVzcG9uc2U6IG5ldyBJbnRlcmNlcHRvck1hbmFnZXIoKVxuICB9O1xufVxuXG4vKipcbiAqIERpc3BhdGNoIGEgcmVxdWVzdFxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWcgVGhlIGNvbmZpZyBzcGVjaWZpYyBmb3IgdGhpcyByZXF1ZXN0IChtZXJnZWQgd2l0aCB0aGlzLmRlZmF1bHRzKVxuICovXG5BeGlvcy5wcm90b3R5cGUucmVxdWVzdCA9IGZ1bmN0aW9uIHJlcXVlc3QoY29uZmlnKSB7XG4gIC8qZXNsaW50IG5vLXBhcmFtLXJlYXNzaWduOjAqL1xuICAvLyBBbGxvdyBmb3IgYXhpb3MoJ2V4YW1wbGUvdXJsJ1ssIGNvbmZpZ10pIGEgbGEgZmV0Y2ggQVBJXG4gIGlmICh0eXBlb2YgY29uZmlnID09PSAnc3RyaW5nJykge1xuICAgIGNvbmZpZyA9IGFyZ3VtZW50c1sxXSB8fCB7fTtcbiAgICBjb25maWcudXJsID0gYXJndW1lbnRzWzBdO1xuICB9IGVsc2Uge1xuICAgIGNvbmZpZyA9IGNvbmZpZyB8fCB7fTtcbiAgfVxuXG4gIGNvbmZpZyA9IG1lcmdlQ29uZmlnKHRoaXMuZGVmYXVsdHMsIGNvbmZpZyk7XG4gIGNvbmZpZy5tZXRob2QgPSBjb25maWcubWV0aG9kID8gY29uZmlnLm1ldGhvZC50b0xvd2VyQ2FzZSgpIDogJ2dldCc7XG5cbiAgLy8gSG9vayB1cCBpbnRlcmNlcHRvcnMgbWlkZGxld2FyZVxuICB2YXIgY2hhaW4gPSBbZGlzcGF0Y2hSZXF1ZXN0LCB1bmRlZmluZWRdO1xuICB2YXIgcHJvbWlzZSA9IFByb21pc2UucmVzb2x2ZShjb25maWcpO1xuXG4gIHRoaXMuaW50ZXJjZXB0b3JzLnJlcXVlc3QuZm9yRWFjaChmdW5jdGlvbiB1bnNoaWZ0UmVxdWVzdEludGVyY2VwdG9ycyhpbnRlcmNlcHRvcikge1xuICAgIGNoYWluLnVuc2hpZnQoaW50ZXJjZXB0b3IuZnVsZmlsbGVkLCBpbnRlcmNlcHRvci5yZWplY3RlZCk7XG4gIH0pO1xuXG4gIHRoaXMuaW50ZXJjZXB0b3JzLnJlc3BvbnNlLmZvckVhY2goZnVuY3Rpb24gcHVzaFJlc3BvbnNlSW50ZXJjZXB0b3JzKGludGVyY2VwdG9yKSB7XG4gICAgY2hhaW4ucHVzaChpbnRlcmNlcHRvci5mdWxmaWxsZWQsIGludGVyY2VwdG9yLnJlamVjdGVkKTtcbiAgfSk7XG5cbiAgd2hpbGUgKGNoYWluLmxlbmd0aCkge1xuICAgIHByb21pc2UgPSBwcm9taXNlLnRoZW4oY2hhaW4uc2hpZnQoKSwgY2hhaW4uc2hpZnQoKSk7XG4gIH1cblxuICByZXR1cm4gcHJvbWlzZTtcbn07XG5cbkF4aW9zLnByb3RvdHlwZS5nZXRVcmkgPSBmdW5jdGlvbiBnZXRVcmkoY29uZmlnKSB7XG4gIGNvbmZpZyA9IG1lcmdlQ29uZmlnKHRoaXMuZGVmYXVsdHMsIGNvbmZpZyk7XG4gIHJldHVybiBidWlsZFVSTChjb25maWcudXJsLCBjb25maWcucGFyYW1zLCBjb25maWcucGFyYW1zU2VyaWFsaXplcikucmVwbGFjZSgvXlxcPy8sICcnKTtcbn07XG5cbi8vIFByb3ZpZGUgYWxpYXNlcyBmb3Igc3VwcG9ydGVkIHJlcXVlc3QgbWV0aG9kc1xudXRpbHMuZm9yRWFjaChbJ2RlbGV0ZScsICdnZXQnLCAnaGVhZCcsICdvcHRpb25zJ10sIGZ1bmN0aW9uIGZvckVhY2hNZXRob2ROb0RhdGEobWV0aG9kKSB7XG4gIC8qZXNsaW50IGZ1bmMtbmFtZXM6MCovXG4gIEF4aW9zLnByb3RvdHlwZVttZXRob2RdID0gZnVuY3Rpb24odXJsLCBjb25maWcpIHtcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KHV0aWxzLm1lcmdlKGNvbmZpZyB8fCB7fSwge1xuICAgICAgbWV0aG9kOiBtZXRob2QsXG4gICAgICB1cmw6IHVybFxuICAgIH0pKTtcbiAgfTtcbn0pO1xuXG51dGlscy5mb3JFYWNoKFsncG9zdCcsICdwdXQnLCAncGF0Y2gnXSwgZnVuY3Rpb24gZm9yRWFjaE1ldGhvZFdpdGhEYXRhKG1ldGhvZCkge1xuICAvKmVzbGludCBmdW5jLW5hbWVzOjAqL1xuICBBeGlvcy5wcm90b3R5cGVbbWV0aG9kXSA9IGZ1bmN0aW9uKHVybCwgZGF0YSwgY29uZmlnKSB7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdCh1dGlscy5tZXJnZShjb25maWcgfHwge30sIHtcbiAgICAgIG1ldGhvZDogbWV0aG9kLFxuICAgICAgdXJsOiB1cmwsXG4gICAgICBkYXRhOiBkYXRhXG4gICAgfSkpO1xuICB9O1xufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gQXhpb3M7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciB1dGlscyA9IHJlcXVpcmUoJy4vLi4vdXRpbHMnKTtcblxuZnVuY3Rpb24gSW50ZXJjZXB0b3JNYW5hZ2VyKCkge1xuICB0aGlzLmhhbmRsZXJzID0gW107XG59XG5cbi8qKlxuICogQWRkIGEgbmV3IGludGVyY2VwdG9yIHRvIHRoZSBzdGFja1xuICpcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bGZpbGxlZCBUaGUgZnVuY3Rpb24gdG8gaGFuZGxlIGB0aGVuYCBmb3IgYSBgUHJvbWlzZWBcbiAqIEBwYXJhbSB7RnVuY3Rpb259IHJlamVjdGVkIFRoZSBmdW5jdGlvbiB0byBoYW5kbGUgYHJlamVjdGAgZm9yIGEgYFByb21pc2VgXG4gKlxuICogQHJldHVybiB7TnVtYmVyfSBBbiBJRCB1c2VkIHRvIHJlbW92ZSBpbnRlcmNlcHRvciBsYXRlclxuICovXG5JbnRlcmNlcHRvck1hbmFnZXIucHJvdG90eXBlLnVzZSA9IGZ1bmN0aW9uIHVzZShmdWxmaWxsZWQsIHJlamVjdGVkKSB7XG4gIHRoaXMuaGFuZGxlcnMucHVzaCh7XG4gICAgZnVsZmlsbGVkOiBmdWxmaWxsZWQsXG4gICAgcmVqZWN0ZWQ6IHJlamVjdGVkXG4gIH0pO1xuICByZXR1cm4gdGhpcy5oYW5kbGVycy5sZW5ndGggLSAxO1xufTtcblxuLyoqXG4gKiBSZW1vdmUgYW4gaW50ZXJjZXB0b3IgZnJvbSB0aGUgc3RhY2tcbiAqXG4gKiBAcGFyYW0ge051bWJlcn0gaWQgVGhlIElEIHRoYXQgd2FzIHJldHVybmVkIGJ5IGB1c2VgXG4gKi9cbkludGVyY2VwdG9yTWFuYWdlci5wcm90b3R5cGUuZWplY3QgPSBmdW5jdGlvbiBlamVjdChpZCkge1xuICBpZiAodGhpcy5oYW5kbGVyc1tpZF0pIHtcbiAgICB0aGlzLmhhbmRsZXJzW2lkXSA9IG51bGw7XG4gIH1cbn07XG5cbi8qKlxuICogSXRlcmF0ZSBvdmVyIGFsbCB0aGUgcmVnaXN0ZXJlZCBpbnRlcmNlcHRvcnNcbiAqXG4gKiBUaGlzIG1ldGhvZCBpcyBwYXJ0aWN1bGFybHkgdXNlZnVsIGZvciBza2lwcGluZyBvdmVyIGFueVxuICogaW50ZXJjZXB0b3JzIHRoYXQgbWF5IGhhdmUgYmVjb21lIGBudWxsYCBjYWxsaW5nIGBlamVjdGAuXG4gKlxuICogQHBhcmFtIHtGdW5jdGlvbn0gZm4gVGhlIGZ1bmN0aW9uIHRvIGNhbGwgZm9yIGVhY2ggaW50ZXJjZXB0b3JcbiAqL1xuSW50ZXJjZXB0b3JNYW5hZ2VyLnByb3RvdHlwZS5mb3JFYWNoID0gZnVuY3Rpb24gZm9yRWFjaChmbikge1xuICB1dGlscy5mb3JFYWNoKHRoaXMuaGFuZGxlcnMsIGZ1bmN0aW9uIGZvckVhY2hIYW5kbGVyKGgpIHtcbiAgICBpZiAoaCAhPT0gbnVsbCkge1xuICAgICAgZm4oaCk7XG4gICAgfVxuICB9KTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gSW50ZXJjZXB0b3JNYW5hZ2VyO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgZW5oYW5jZUVycm9yID0gcmVxdWlyZSgnLi9lbmhhbmNlRXJyb3InKTtcblxuLyoqXG4gKiBDcmVhdGUgYW4gRXJyb3Igd2l0aCB0aGUgc3BlY2lmaWVkIG1lc3NhZ2UsIGNvbmZpZywgZXJyb3IgY29kZSwgcmVxdWVzdCBhbmQgcmVzcG9uc2UuXG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IG1lc3NhZ2UgVGhlIGVycm9yIG1lc3NhZ2UuXG4gKiBAcGFyYW0ge09iamVjdH0gY29uZmlnIFRoZSBjb25maWcuXG4gKiBAcGFyYW0ge3N0cmluZ30gW2NvZGVdIFRoZSBlcnJvciBjb2RlIChmb3IgZXhhbXBsZSwgJ0VDT05OQUJPUlRFRCcpLlxuICogQHBhcmFtIHtPYmplY3R9IFtyZXF1ZXN0XSBUaGUgcmVxdWVzdC5cbiAqIEBwYXJhbSB7T2JqZWN0fSBbcmVzcG9uc2VdIFRoZSByZXNwb25zZS5cbiAqIEByZXR1cm5zIHtFcnJvcn0gVGhlIGNyZWF0ZWQgZXJyb3IuXG4gKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gY3JlYXRlRXJyb3IobWVzc2FnZSwgY29uZmlnLCBjb2RlLCByZXF1ZXN0LCByZXNwb25zZSkge1xuICB2YXIgZXJyb3IgPSBuZXcgRXJyb3IobWVzc2FnZSk7XG4gIHJldHVybiBlbmhhbmNlRXJyb3IoZXJyb3IsIGNvbmZpZywgY29kZSwgcmVxdWVzdCwgcmVzcG9uc2UpO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHV0aWxzID0gcmVxdWlyZSgnLi8uLi91dGlscycpO1xudmFyIHRyYW5zZm9ybURhdGEgPSByZXF1aXJlKCcuL3RyYW5zZm9ybURhdGEnKTtcbnZhciBpc0NhbmNlbCA9IHJlcXVpcmUoJy4uL2NhbmNlbC9pc0NhbmNlbCcpO1xudmFyIGRlZmF1bHRzID0gcmVxdWlyZSgnLi4vZGVmYXVsdHMnKTtcbnZhciBpc0Fic29sdXRlVVJMID0gcmVxdWlyZSgnLi8uLi9oZWxwZXJzL2lzQWJzb2x1dGVVUkwnKTtcbnZhciBjb21iaW5lVVJMcyA9IHJlcXVpcmUoJy4vLi4vaGVscGVycy9jb21iaW5lVVJMcycpO1xuXG4vKipcbiAqIFRocm93cyBhIGBDYW5jZWxgIGlmIGNhbmNlbGxhdGlvbiBoYXMgYmVlbiByZXF1ZXN0ZWQuXG4gKi9cbmZ1bmN0aW9uIHRocm93SWZDYW5jZWxsYXRpb25SZXF1ZXN0ZWQoY29uZmlnKSB7XG4gIGlmIChjb25maWcuY2FuY2VsVG9rZW4pIHtcbiAgICBjb25maWcuY2FuY2VsVG9rZW4udGhyb3dJZlJlcXVlc3RlZCgpO1xuICB9XG59XG5cbi8qKlxuICogRGlzcGF0Y2ggYSByZXF1ZXN0IHRvIHRoZSBzZXJ2ZXIgdXNpbmcgdGhlIGNvbmZpZ3VyZWQgYWRhcHRlci5cbiAqXG4gKiBAcGFyYW0ge29iamVjdH0gY29uZmlnIFRoZSBjb25maWcgdGhhdCBpcyB0byBiZSB1c2VkIGZvciB0aGUgcmVxdWVzdFxuICogQHJldHVybnMge1Byb21pc2V9IFRoZSBQcm9taXNlIHRvIGJlIGZ1bGZpbGxlZFxuICovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGRpc3BhdGNoUmVxdWVzdChjb25maWcpIHtcbiAgdGhyb3dJZkNhbmNlbGxhdGlvblJlcXVlc3RlZChjb25maWcpO1xuXG4gIC8vIFN1cHBvcnQgYmFzZVVSTCBjb25maWdcbiAgaWYgKGNvbmZpZy5iYXNlVVJMICYmICFpc0Fic29sdXRlVVJMKGNvbmZpZy51cmwpKSB7XG4gICAgY29uZmlnLnVybCA9IGNvbWJpbmVVUkxzKGNvbmZpZy5iYXNlVVJMLCBjb25maWcudXJsKTtcbiAgfVxuXG4gIC8vIEVuc3VyZSBoZWFkZXJzIGV4aXN0XG4gIGNvbmZpZy5oZWFkZXJzID0gY29uZmlnLmhlYWRlcnMgfHwge307XG5cbiAgLy8gVHJhbnNmb3JtIHJlcXVlc3QgZGF0YVxuICBjb25maWcuZGF0YSA9IHRyYW5zZm9ybURhdGEoXG4gICAgY29uZmlnLmRhdGEsXG4gICAgY29uZmlnLmhlYWRlcnMsXG4gICAgY29uZmlnLnRyYW5zZm9ybVJlcXVlc3RcbiAgKTtcblxuICAvLyBGbGF0dGVuIGhlYWRlcnNcbiAgY29uZmlnLmhlYWRlcnMgPSB1dGlscy5tZXJnZShcbiAgICBjb25maWcuaGVhZGVycy5jb21tb24gfHwge30sXG4gICAgY29uZmlnLmhlYWRlcnNbY29uZmlnLm1ldGhvZF0gfHwge30sXG4gICAgY29uZmlnLmhlYWRlcnMgfHwge31cbiAgKTtcblxuICB1dGlscy5mb3JFYWNoKFxuICAgIFsnZGVsZXRlJywgJ2dldCcsICdoZWFkJywgJ3Bvc3QnLCAncHV0JywgJ3BhdGNoJywgJ2NvbW1vbiddLFxuICAgIGZ1bmN0aW9uIGNsZWFuSGVhZGVyQ29uZmlnKG1ldGhvZCkge1xuICAgICAgZGVsZXRlIGNvbmZpZy5oZWFkZXJzW21ldGhvZF07XG4gICAgfVxuICApO1xuXG4gIHZhciBhZGFwdGVyID0gY29uZmlnLmFkYXB0ZXIgfHwgZGVmYXVsdHMuYWRhcHRlcjtcblxuICByZXR1cm4gYWRhcHRlcihjb25maWcpLnRoZW4oZnVuY3Rpb24gb25BZGFwdGVyUmVzb2x1dGlvbihyZXNwb25zZSkge1xuICAgIHRocm93SWZDYW5jZWxsYXRpb25SZXF1ZXN0ZWQoY29uZmlnKTtcblxuICAgIC8vIFRyYW5zZm9ybSByZXNwb25zZSBkYXRhXG4gICAgcmVzcG9uc2UuZGF0YSA9IHRyYW5zZm9ybURhdGEoXG4gICAgICByZXNwb25zZS5kYXRhLFxuICAgICAgcmVzcG9uc2UuaGVhZGVycyxcbiAgICAgIGNvbmZpZy50cmFuc2Zvcm1SZXNwb25zZVxuICAgICk7XG5cbiAgICByZXR1cm4gcmVzcG9uc2U7XG4gIH0sIGZ1bmN0aW9uIG9uQWRhcHRlclJlamVjdGlvbihyZWFzb24pIHtcbiAgICBpZiAoIWlzQ2FuY2VsKHJlYXNvbikpIHtcbiAgICAgIHRocm93SWZDYW5jZWxsYXRpb25SZXF1ZXN0ZWQoY29uZmlnKTtcblxuICAgICAgLy8gVHJhbnNmb3JtIHJlc3BvbnNlIGRhdGFcbiAgICAgIGlmIChyZWFzb24gJiYgcmVhc29uLnJlc3BvbnNlKSB7XG4gICAgICAgIHJlYXNvbi5yZXNwb25zZS5kYXRhID0gdHJhbnNmb3JtRGF0YShcbiAgICAgICAgICByZWFzb24ucmVzcG9uc2UuZGF0YSxcbiAgICAgICAgICByZWFzb24ucmVzcG9uc2UuaGVhZGVycyxcbiAgICAgICAgICBjb25maWcudHJhbnNmb3JtUmVzcG9uc2VcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QocmVhc29uKTtcbiAgfSk7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIFVwZGF0ZSBhbiBFcnJvciB3aXRoIHRoZSBzcGVjaWZpZWQgY29uZmlnLCBlcnJvciBjb2RlLCBhbmQgcmVzcG9uc2UuXG4gKlxuICogQHBhcmFtIHtFcnJvcn0gZXJyb3IgVGhlIGVycm9yIHRvIHVwZGF0ZS5cbiAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWcgVGhlIGNvbmZpZy5cbiAqIEBwYXJhbSB7c3RyaW5nfSBbY29kZV0gVGhlIGVycm9yIGNvZGUgKGZvciBleGFtcGxlLCAnRUNPTk5BQk9SVEVEJykuXG4gKiBAcGFyYW0ge09iamVjdH0gW3JlcXVlc3RdIFRoZSByZXF1ZXN0LlxuICogQHBhcmFtIHtPYmplY3R9IFtyZXNwb25zZV0gVGhlIHJlc3BvbnNlLlxuICogQHJldHVybnMge0Vycm9yfSBUaGUgZXJyb3IuXG4gKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gZW5oYW5jZUVycm9yKGVycm9yLCBjb25maWcsIGNvZGUsIHJlcXVlc3QsIHJlc3BvbnNlKSB7XG4gIGVycm9yLmNvbmZpZyA9IGNvbmZpZztcbiAgaWYgKGNvZGUpIHtcbiAgICBlcnJvci5jb2RlID0gY29kZTtcbiAgfVxuXG4gIGVycm9yLnJlcXVlc3QgPSByZXF1ZXN0O1xuICBlcnJvci5yZXNwb25zZSA9IHJlc3BvbnNlO1xuICBlcnJvci5pc0F4aW9zRXJyb3IgPSB0cnVlO1xuXG4gIGVycm9yLnRvSlNPTiA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB7XG4gICAgICAvLyBTdGFuZGFyZFxuICAgICAgbWVzc2FnZTogdGhpcy5tZXNzYWdlLFxuICAgICAgbmFtZTogdGhpcy5uYW1lLFxuICAgICAgLy8gTWljcm9zb2Z0XG4gICAgICBkZXNjcmlwdGlvbjogdGhpcy5kZXNjcmlwdGlvbixcbiAgICAgIG51bWJlcjogdGhpcy5udW1iZXIsXG4gICAgICAvLyBNb3ppbGxhXG4gICAgICBmaWxlTmFtZTogdGhpcy5maWxlTmFtZSxcbiAgICAgIGxpbmVOdW1iZXI6IHRoaXMubGluZU51bWJlcixcbiAgICAgIGNvbHVtbk51bWJlcjogdGhpcy5jb2x1bW5OdW1iZXIsXG4gICAgICBzdGFjazogdGhpcy5zdGFjayxcbiAgICAgIC8vIEF4aW9zXG4gICAgICBjb25maWc6IHRoaXMuY29uZmlnLFxuICAgICAgY29kZTogdGhpcy5jb2RlXG4gICAgfTtcbiAgfTtcbiAgcmV0dXJuIGVycm9yO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHV0aWxzID0gcmVxdWlyZSgnLi4vdXRpbHMnKTtcblxuLyoqXG4gKiBDb25maWctc3BlY2lmaWMgbWVyZ2UtZnVuY3Rpb24gd2hpY2ggY3JlYXRlcyBhIG5ldyBjb25maWctb2JqZWN0XG4gKiBieSBtZXJnaW5nIHR3byBjb25maWd1cmF0aW9uIG9iamVjdHMgdG9nZXRoZXIuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZzFcbiAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWcyXG4gKiBAcmV0dXJucyB7T2JqZWN0fSBOZXcgb2JqZWN0IHJlc3VsdGluZyBmcm9tIG1lcmdpbmcgY29uZmlnMiB0byBjb25maWcxXG4gKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gbWVyZ2VDb25maWcoY29uZmlnMSwgY29uZmlnMikge1xuICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tcGFyYW0tcmVhc3NpZ25cbiAgY29uZmlnMiA9IGNvbmZpZzIgfHwge307XG4gIHZhciBjb25maWcgPSB7fTtcblxuICB1dGlscy5mb3JFYWNoKFsndXJsJywgJ21ldGhvZCcsICdwYXJhbXMnLCAnZGF0YSddLCBmdW5jdGlvbiB2YWx1ZUZyb21Db25maWcyKHByb3ApIHtcbiAgICBpZiAodHlwZW9mIGNvbmZpZzJbcHJvcF0gIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICBjb25maWdbcHJvcF0gPSBjb25maWcyW3Byb3BdO1xuICAgIH1cbiAgfSk7XG5cbiAgdXRpbHMuZm9yRWFjaChbJ2hlYWRlcnMnLCAnYXV0aCcsICdwcm94eSddLCBmdW5jdGlvbiBtZXJnZURlZXBQcm9wZXJ0aWVzKHByb3ApIHtcbiAgICBpZiAodXRpbHMuaXNPYmplY3QoY29uZmlnMltwcm9wXSkpIHtcbiAgICAgIGNvbmZpZ1twcm9wXSA9IHV0aWxzLmRlZXBNZXJnZShjb25maWcxW3Byb3BdLCBjb25maWcyW3Byb3BdKTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBjb25maWcyW3Byb3BdICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgY29uZmlnW3Byb3BdID0gY29uZmlnMltwcm9wXTtcbiAgICB9IGVsc2UgaWYgKHV0aWxzLmlzT2JqZWN0KGNvbmZpZzFbcHJvcF0pKSB7XG4gICAgICBjb25maWdbcHJvcF0gPSB1dGlscy5kZWVwTWVyZ2UoY29uZmlnMVtwcm9wXSk7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgY29uZmlnMVtwcm9wXSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIGNvbmZpZ1twcm9wXSA9IGNvbmZpZzFbcHJvcF07XG4gICAgfVxuICB9KTtcblxuICB1dGlscy5mb3JFYWNoKFtcbiAgICAnYmFzZVVSTCcsICd0cmFuc2Zvcm1SZXF1ZXN0JywgJ3RyYW5zZm9ybVJlc3BvbnNlJywgJ3BhcmFtc1NlcmlhbGl6ZXInLFxuICAgICd0aW1lb3V0JywgJ3dpdGhDcmVkZW50aWFscycsICdhZGFwdGVyJywgJ3Jlc3BvbnNlVHlwZScsICd4c3JmQ29va2llTmFtZScsXG4gICAgJ3hzcmZIZWFkZXJOYW1lJywgJ29uVXBsb2FkUHJvZ3Jlc3MnLCAnb25Eb3dubG9hZFByb2dyZXNzJywgJ21heENvbnRlbnRMZW5ndGgnLFxuICAgICd2YWxpZGF0ZVN0YXR1cycsICdtYXhSZWRpcmVjdHMnLCAnaHR0cEFnZW50JywgJ2h0dHBzQWdlbnQnLCAnY2FuY2VsVG9rZW4nLFxuICAgICdzb2NrZXRQYXRoJ1xuICBdLCBmdW5jdGlvbiBkZWZhdWx0VG9Db25maWcyKHByb3ApIHtcbiAgICBpZiAodHlwZW9mIGNvbmZpZzJbcHJvcF0gIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICBjb25maWdbcHJvcF0gPSBjb25maWcyW3Byb3BdO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIGNvbmZpZzFbcHJvcF0gIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICBjb25maWdbcHJvcF0gPSBjb25maWcxW3Byb3BdO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIGNvbmZpZztcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBjcmVhdGVFcnJvciA9IHJlcXVpcmUoJy4vY3JlYXRlRXJyb3InKTtcblxuLyoqXG4gKiBSZXNvbHZlIG9yIHJlamVjdCBhIFByb21pc2UgYmFzZWQgb24gcmVzcG9uc2Ugc3RhdHVzLlxuICpcbiAqIEBwYXJhbSB7RnVuY3Rpb259IHJlc29sdmUgQSBmdW5jdGlvbiB0aGF0IHJlc29sdmVzIHRoZSBwcm9taXNlLlxuICogQHBhcmFtIHtGdW5jdGlvbn0gcmVqZWN0IEEgZnVuY3Rpb24gdGhhdCByZWplY3RzIHRoZSBwcm9taXNlLlxuICogQHBhcmFtIHtvYmplY3R9IHJlc3BvbnNlIFRoZSByZXNwb25zZS5cbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBzZXR0bGUocmVzb2x2ZSwgcmVqZWN0LCByZXNwb25zZSkge1xuICB2YXIgdmFsaWRhdGVTdGF0dXMgPSByZXNwb25zZS5jb25maWcudmFsaWRhdGVTdGF0dXM7XG4gIGlmICghdmFsaWRhdGVTdGF0dXMgfHwgdmFsaWRhdGVTdGF0dXMocmVzcG9uc2Uuc3RhdHVzKSkge1xuICAgIHJlc29sdmUocmVzcG9uc2UpO1xuICB9IGVsc2Uge1xuICAgIHJlamVjdChjcmVhdGVFcnJvcihcbiAgICAgICdSZXF1ZXN0IGZhaWxlZCB3aXRoIHN0YXR1cyBjb2RlICcgKyByZXNwb25zZS5zdGF0dXMsXG4gICAgICByZXNwb25zZS5jb25maWcsXG4gICAgICBudWxsLFxuICAgICAgcmVzcG9uc2UucmVxdWVzdCxcbiAgICAgIHJlc3BvbnNlXG4gICAgKSk7XG4gIH1cbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciB1dGlscyA9IHJlcXVpcmUoJy4vLi4vdXRpbHMnKTtcblxuLyoqXG4gKiBUcmFuc2Zvcm0gdGhlIGRhdGEgZm9yIGEgcmVxdWVzdCBvciBhIHJlc3BvbnNlXG4gKlxuICogQHBhcmFtIHtPYmplY3R8U3RyaW5nfSBkYXRhIFRoZSBkYXRhIHRvIGJlIHRyYW5zZm9ybWVkXG4gKiBAcGFyYW0ge0FycmF5fSBoZWFkZXJzIFRoZSBoZWFkZXJzIGZvciB0aGUgcmVxdWVzdCBvciByZXNwb25zZVxuICogQHBhcmFtIHtBcnJheXxGdW5jdGlvbn0gZm5zIEEgc2luZ2xlIGZ1bmN0aW9uIG9yIEFycmF5IG9mIGZ1bmN0aW9uc1xuICogQHJldHVybnMgeyp9IFRoZSByZXN1bHRpbmcgdHJhbnNmb3JtZWQgZGF0YVxuICovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIHRyYW5zZm9ybURhdGEoZGF0YSwgaGVhZGVycywgZm5zKSB7XG4gIC8qZXNsaW50IG5vLXBhcmFtLXJlYXNzaWduOjAqL1xuICB1dGlscy5mb3JFYWNoKGZucywgZnVuY3Rpb24gdHJhbnNmb3JtKGZuKSB7XG4gICAgZGF0YSA9IGZuKGRhdGEsIGhlYWRlcnMpO1xuICB9KTtcblxuICByZXR1cm4gZGF0YTtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciB1dGlscyA9IHJlcXVpcmUoJy4vdXRpbHMnKTtcbnZhciBub3JtYWxpemVIZWFkZXJOYW1lID0gcmVxdWlyZSgnLi9oZWxwZXJzL25vcm1hbGl6ZUhlYWRlck5hbWUnKTtcblxudmFyIERFRkFVTFRfQ09OVEVOVF9UWVBFID0ge1xuICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZCdcbn07XG5cbmZ1bmN0aW9uIHNldENvbnRlbnRUeXBlSWZVbnNldChoZWFkZXJzLCB2YWx1ZSkge1xuICBpZiAoIXV0aWxzLmlzVW5kZWZpbmVkKGhlYWRlcnMpICYmIHV0aWxzLmlzVW5kZWZpbmVkKGhlYWRlcnNbJ0NvbnRlbnQtVHlwZSddKSkge1xuICAgIGhlYWRlcnNbJ0NvbnRlbnQtVHlwZSddID0gdmFsdWU7XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0RGVmYXVsdEFkYXB0ZXIoKSB7XG4gIHZhciBhZGFwdGVyO1xuICAvLyBPbmx5IE5vZGUuSlMgaGFzIGEgcHJvY2VzcyB2YXJpYWJsZSB0aGF0IGlzIG9mIFtbQ2xhc3NdXSBwcm9jZXNzXG4gIGlmICh0eXBlb2YgcHJvY2VzcyAhPT0gJ3VuZGVmaW5lZCcgJiYgT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHByb2Nlc3MpID09PSAnW29iamVjdCBwcm9jZXNzXScpIHtcbiAgICAvLyBGb3Igbm9kZSB1c2UgSFRUUCBhZGFwdGVyXG4gICAgYWRhcHRlciA9IHJlcXVpcmUoJy4vYWRhcHRlcnMvaHR0cCcpO1xuICB9IGVsc2UgaWYgKHR5cGVvZiBYTUxIdHRwUmVxdWVzdCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAvLyBGb3IgYnJvd3NlcnMgdXNlIFhIUiBhZGFwdGVyXG4gICAgYWRhcHRlciA9IHJlcXVpcmUoJy4vYWRhcHRlcnMveGhyJyk7XG4gIH1cbiAgcmV0dXJuIGFkYXB0ZXI7XG59XG5cbnZhciBkZWZhdWx0cyA9IHtcbiAgYWRhcHRlcjogZ2V0RGVmYXVsdEFkYXB0ZXIoKSxcblxuICB0cmFuc2Zvcm1SZXF1ZXN0OiBbZnVuY3Rpb24gdHJhbnNmb3JtUmVxdWVzdChkYXRhLCBoZWFkZXJzKSB7XG4gICAgbm9ybWFsaXplSGVhZGVyTmFtZShoZWFkZXJzLCAnQWNjZXB0Jyk7XG4gICAgbm9ybWFsaXplSGVhZGVyTmFtZShoZWFkZXJzLCAnQ29udGVudC1UeXBlJyk7XG4gICAgaWYgKHV0aWxzLmlzRm9ybURhdGEoZGF0YSkgfHxcbiAgICAgIHV0aWxzLmlzQXJyYXlCdWZmZXIoZGF0YSkgfHxcbiAgICAgIHV0aWxzLmlzQnVmZmVyKGRhdGEpIHx8XG4gICAgICB1dGlscy5pc1N0cmVhbShkYXRhKSB8fFxuICAgICAgdXRpbHMuaXNGaWxlKGRhdGEpIHx8XG4gICAgICB1dGlscy5pc0Jsb2IoZGF0YSlcbiAgICApIHtcbiAgICAgIHJldHVybiBkYXRhO1xuICAgIH1cbiAgICBpZiAodXRpbHMuaXNBcnJheUJ1ZmZlclZpZXcoZGF0YSkpIHtcbiAgICAgIHJldHVybiBkYXRhLmJ1ZmZlcjtcbiAgICB9XG4gICAgaWYgKHV0aWxzLmlzVVJMU2VhcmNoUGFyYW1zKGRhdGEpKSB7XG4gICAgICBzZXRDb250ZW50VHlwZUlmVW5zZXQoaGVhZGVycywgJ2FwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZDtjaGFyc2V0PXV0Zi04Jyk7XG4gICAgICByZXR1cm4gZGF0YS50b1N0cmluZygpO1xuICAgIH1cbiAgICBpZiAodXRpbHMuaXNPYmplY3QoZGF0YSkpIHtcbiAgICAgIHNldENvbnRlbnRUeXBlSWZVbnNldChoZWFkZXJzLCAnYXBwbGljYXRpb24vanNvbjtjaGFyc2V0PXV0Zi04Jyk7XG4gICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoZGF0YSk7XG4gICAgfVxuICAgIHJldHVybiBkYXRhO1xuICB9XSxcblxuICB0cmFuc2Zvcm1SZXNwb25zZTogW2Z1bmN0aW9uIHRyYW5zZm9ybVJlc3BvbnNlKGRhdGEpIHtcbiAgICAvKmVzbGludCBuby1wYXJhbS1yZWFzc2lnbjowKi9cbiAgICBpZiAodHlwZW9mIGRhdGEgPT09ICdzdHJpbmcnKSB7XG4gICAgICB0cnkge1xuICAgICAgICBkYXRhID0gSlNPTi5wYXJzZShkYXRhKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHsgLyogSWdub3JlICovIH1cbiAgICB9XG4gICAgcmV0dXJuIGRhdGE7XG4gIH1dLFxuXG4gIC8qKlxuICAgKiBBIHRpbWVvdXQgaW4gbWlsbGlzZWNvbmRzIHRvIGFib3J0IGEgcmVxdWVzdC4gSWYgc2V0IHRvIDAgKGRlZmF1bHQpIGFcbiAgICogdGltZW91dCBpcyBub3QgY3JlYXRlZC5cbiAgICovXG4gIHRpbWVvdXQ6IDAsXG5cbiAgeHNyZkNvb2tpZU5hbWU6ICdYU1JGLVRPS0VOJyxcbiAgeHNyZkhlYWRlck5hbWU6ICdYLVhTUkYtVE9LRU4nLFxuXG4gIG1heENvbnRlbnRMZW5ndGg6IC0xLFxuXG4gIHZhbGlkYXRlU3RhdHVzOiBmdW5jdGlvbiB2YWxpZGF0ZVN0YXR1cyhzdGF0dXMpIHtcbiAgICByZXR1cm4gc3RhdHVzID49IDIwMCAmJiBzdGF0dXMgPCAzMDA7XG4gIH1cbn07XG5cbmRlZmF1bHRzLmhlYWRlcnMgPSB7XG4gIGNvbW1vbjoge1xuICAgICdBY2NlcHQnOiAnYXBwbGljYXRpb24vanNvbiwgdGV4dC9wbGFpbiwgKi8qJ1xuICB9XG59O1xuXG51dGlscy5mb3JFYWNoKFsnZGVsZXRlJywgJ2dldCcsICdoZWFkJ10sIGZ1bmN0aW9uIGZvckVhY2hNZXRob2ROb0RhdGEobWV0aG9kKSB7XG4gIGRlZmF1bHRzLmhlYWRlcnNbbWV0aG9kXSA9IHt9O1xufSk7XG5cbnV0aWxzLmZvckVhY2goWydwb3N0JywgJ3B1dCcsICdwYXRjaCddLCBmdW5jdGlvbiBmb3JFYWNoTWV0aG9kV2l0aERhdGEobWV0aG9kKSB7XG4gIGRlZmF1bHRzLmhlYWRlcnNbbWV0aG9kXSA9IHV0aWxzLm1lcmdlKERFRkFVTFRfQ09OVEVOVF9UWVBFKTtcbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGRlZmF1bHRzO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGJpbmQoZm4sIHRoaXNBcmcpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIHdyYXAoKSB7XG4gICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkoYXJndW1lbnRzLmxlbmd0aCk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcmdzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBhcmdzW2ldID0gYXJndW1lbnRzW2ldO1xuICAgIH1cbiAgICByZXR1cm4gZm4uYXBwbHkodGhpc0FyZywgYXJncyk7XG4gIH07XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuLy4uL3V0aWxzJyk7XG5cbmZ1bmN0aW9uIGVuY29kZSh2YWwpIHtcbiAgcmV0dXJuIGVuY29kZVVSSUNvbXBvbmVudCh2YWwpLlxuICAgIHJlcGxhY2UoLyU0MC9naSwgJ0AnKS5cbiAgICByZXBsYWNlKC8lM0EvZ2ksICc6JykuXG4gICAgcmVwbGFjZSgvJTI0L2csICckJykuXG4gICAgcmVwbGFjZSgvJTJDL2dpLCAnLCcpLlxuICAgIHJlcGxhY2UoLyUyMC9nLCAnKycpLlxuICAgIHJlcGxhY2UoLyU1Qi9naSwgJ1snKS5cbiAgICByZXBsYWNlKC8lNUQvZ2ksICddJyk7XG59XG5cbi8qKlxuICogQnVpbGQgYSBVUkwgYnkgYXBwZW5kaW5nIHBhcmFtcyB0byB0aGUgZW5kXG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IHVybCBUaGUgYmFzZSBvZiB0aGUgdXJsIChlLmcuLCBodHRwOi8vd3d3Lmdvb2dsZS5jb20pXG4gKiBAcGFyYW0ge29iamVjdH0gW3BhcmFtc10gVGhlIHBhcmFtcyB0byBiZSBhcHBlbmRlZFxuICogQHJldHVybnMge3N0cmluZ30gVGhlIGZvcm1hdHRlZCB1cmxcbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBidWlsZFVSTCh1cmwsIHBhcmFtcywgcGFyYW1zU2VyaWFsaXplcikge1xuICAvKmVzbGludCBuby1wYXJhbS1yZWFzc2lnbjowKi9cbiAgaWYgKCFwYXJhbXMpIHtcbiAgICByZXR1cm4gdXJsO1xuICB9XG5cbiAgdmFyIHNlcmlhbGl6ZWRQYXJhbXM7XG4gIGlmIChwYXJhbXNTZXJpYWxpemVyKSB7XG4gICAgc2VyaWFsaXplZFBhcmFtcyA9IHBhcmFtc1NlcmlhbGl6ZXIocGFyYW1zKTtcbiAgfSBlbHNlIGlmICh1dGlscy5pc1VSTFNlYXJjaFBhcmFtcyhwYXJhbXMpKSB7XG4gICAgc2VyaWFsaXplZFBhcmFtcyA9IHBhcmFtcy50b1N0cmluZygpO1xuICB9IGVsc2Uge1xuICAgIHZhciBwYXJ0cyA9IFtdO1xuXG4gICAgdXRpbHMuZm9yRWFjaChwYXJhbXMsIGZ1bmN0aW9uIHNlcmlhbGl6ZSh2YWwsIGtleSkge1xuICAgICAgaWYgKHZhbCA9PT0gbnVsbCB8fCB0eXBlb2YgdmFsID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGlmICh1dGlscy5pc0FycmF5KHZhbCkpIHtcbiAgICAgICAga2V5ID0ga2V5ICsgJ1tdJztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhbCA9IFt2YWxdO1xuICAgICAgfVxuXG4gICAgICB1dGlscy5mb3JFYWNoKHZhbCwgZnVuY3Rpb24gcGFyc2VWYWx1ZSh2KSB7XG4gICAgICAgIGlmICh1dGlscy5pc0RhdGUodikpIHtcbiAgICAgICAgICB2ID0gdi50b0lTT1N0cmluZygpO1xuICAgICAgICB9IGVsc2UgaWYgKHV0aWxzLmlzT2JqZWN0KHYpKSB7XG4gICAgICAgICAgdiA9IEpTT04uc3RyaW5naWZ5KHYpO1xuICAgICAgICB9XG4gICAgICAgIHBhcnRzLnB1c2goZW5jb2RlKGtleSkgKyAnPScgKyBlbmNvZGUodikpO1xuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBzZXJpYWxpemVkUGFyYW1zID0gcGFydHMuam9pbignJicpO1xuICB9XG5cbiAgaWYgKHNlcmlhbGl6ZWRQYXJhbXMpIHtcbiAgICB2YXIgaGFzaG1hcmtJbmRleCA9IHVybC5pbmRleE9mKCcjJyk7XG4gICAgaWYgKGhhc2htYXJrSW5kZXggIT09IC0xKSB7XG4gICAgICB1cmwgPSB1cmwuc2xpY2UoMCwgaGFzaG1hcmtJbmRleCk7XG4gICAgfVxuXG4gICAgdXJsICs9ICh1cmwuaW5kZXhPZignPycpID09PSAtMSA/ICc/JyA6ICcmJykgKyBzZXJpYWxpemVkUGFyYW1zO1xuICB9XG5cbiAgcmV0dXJuIHVybDtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbi8qKlxuICogQ3JlYXRlcyBhIG5ldyBVUkwgYnkgY29tYmluaW5nIHRoZSBzcGVjaWZpZWQgVVJMc1xuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSBiYXNlVVJMIFRoZSBiYXNlIFVSTFxuICogQHBhcmFtIHtzdHJpbmd9IHJlbGF0aXZlVVJMIFRoZSByZWxhdGl2ZSBVUkxcbiAqIEByZXR1cm5zIHtzdHJpbmd9IFRoZSBjb21iaW5lZCBVUkxcbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBjb21iaW5lVVJMcyhiYXNlVVJMLCByZWxhdGl2ZVVSTCkge1xuICByZXR1cm4gcmVsYXRpdmVVUkxcbiAgICA/IGJhc2VVUkwucmVwbGFjZSgvXFwvKyQvLCAnJykgKyAnLycgKyByZWxhdGl2ZVVSTC5yZXBsYWNlKC9eXFwvKy8sICcnKVxuICAgIDogYmFzZVVSTDtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciB1dGlscyA9IHJlcXVpcmUoJy4vLi4vdXRpbHMnKTtcblxubW9kdWxlLmV4cG9ydHMgPSAoXG4gIHV0aWxzLmlzU3RhbmRhcmRCcm93c2VyRW52KCkgP1xuXG4gIC8vIFN0YW5kYXJkIGJyb3dzZXIgZW52cyBzdXBwb3J0IGRvY3VtZW50LmNvb2tpZVxuICAgIChmdW5jdGlvbiBzdGFuZGFyZEJyb3dzZXJFbnYoKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICB3cml0ZTogZnVuY3Rpb24gd3JpdGUobmFtZSwgdmFsdWUsIGV4cGlyZXMsIHBhdGgsIGRvbWFpbiwgc2VjdXJlKSB7XG4gICAgICAgICAgdmFyIGNvb2tpZSA9IFtdO1xuICAgICAgICAgIGNvb2tpZS5wdXNoKG5hbWUgKyAnPScgKyBlbmNvZGVVUklDb21wb25lbnQodmFsdWUpKTtcblxuICAgICAgICAgIGlmICh1dGlscy5pc051bWJlcihleHBpcmVzKSkge1xuICAgICAgICAgICAgY29va2llLnB1c2goJ2V4cGlyZXM9JyArIG5ldyBEYXRlKGV4cGlyZXMpLnRvR01UU3RyaW5nKCkpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmICh1dGlscy5pc1N0cmluZyhwYXRoKSkge1xuICAgICAgICAgICAgY29va2llLnB1c2goJ3BhdGg9JyArIHBhdGgpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmICh1dGlscy5pc1N0cmluZyhkb21haW4pKSB7XG4gICAgICAgICAgICBjb29raWUucHVzaCgnZG9tYWluPScgKyBkb21haW4pO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChzZWN1cmUgPT09IHRydWUpIHtcbiAgICAgICAgICAgIGNvb2tpZS5wdXNoKCdzZWN1cmUnKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBkb2N1bWVudC5jb29raWUgPSBjb29raWUuam9pbignOyAnKTtcbiAgICAgICAgfSxcblxuICAgICAgICByZWFkOiBmdW5jdGlvbiByZWFkKG5hbWUpIHtcbiAgICAgICAgICB2YXIgbWF0Y2ggPSBkb2N1bWVudC5jb29raWUubWF0Y2gobmV3IFJlZ0V4cCgnKF58O1xcXFxzKikoJyArIG5hbWUgKyAnKT0oW147XSopJykpO1xuICAgICAgICAgIHJldHVybiAobWF0Y2ggPyBkZWNvZGVVUklDb21wb25lbnQobWF0Y2hbM10pIDogbnVsbCk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgcmVtb3ZlOiBmdW5jdGlvbiByZW1vdmUobmFtZSkge1xuICAgICAgICAgIHRoaXMud3JpdGUobmFtZSwgJycsIERhdGUubm93KCkgLSA4NjQwMDAwMCk7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfSkoKSA6XG5cbiAgLy8gTm9uIHN0YW5kYXJkIGJyb3dzZXIgZW52ICh3ZWIgd29ya2VycywgcmVhY3QtbmF0aXZlKSBsYWNrIG5lZWRlZCBzdXBwb3J0LlxuICAgIChmdW5jdGlvbiBub25TdGFuZGFyZEJyb3dzZXJFbnYoKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICB3cml0ZTogZnVuY3Rpb24gd3JpdGUoKSB7fSxcbiAgICAgICAgcmVhZDogZnVuY3Rpb24gcmVhZCgpIHsgcmV0dXJuIG51bGw7IH0sXG4gICAgICAgIHJlbW92ZTogZnVuY3Rpb24gcmVtb3ZlKCkge31cbiAgICAgIH07XG4gICAgfSkoKVxuKTtcbiIsIid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBEZXRlcm1pbmVzIHdoZXRoZXIgdGhlIHNwZWNpZmllZCBVUkwgaXMgYWJzb2x1dGVcbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gdXJsIFRoZSBVUkwgdG8gdGVzdFxuICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIHNwZWNpZmllZCBVUkwgaXMgYWJzb2x1dGUsIG90aGVyd2lzZSBmYWxzZVxuICovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGlzQWJzb2x1dGVVUkwodXJsKSB7XG4gIC8vIEEgVVJMIGlzIGNvbnNpZGVyZWQgYWJzb2x1dGUgaWYgaXQgYmVnaW5zIHdpdGggXCI8c2NoZW1lPjovL1wiIG9yIFwiLy9cIiAocHJvdG9jb2wtcmVsYXRpdmUgVVJMKS5cbiAgLy8gUkZDIDM5ODYgZGVmaW5lcyBzY2hlbWUgbmFtZSBhcyBhIHNlcXVlbmNlIG9mIGNoYXJhY3RlcnMgYmVnaW5uaW5nIHdpdGggYSBsZXR0ZXIgYW5kIGZvbGxvd2VkXG4gIC8vIGJ5IGFueSBjb21iaW5hdGlvbiBvZiBsZXR0ZXJzLCBkaWdpdHMsIHBsdXMsIHBlcmlvZCwgb3IgaHlwaGVuLlxuICByZXR1cm4gL14oW2Etel1bYS16XFxkXFwrXFwtXFwuXSo6KT9cXC9cXC8vaS50ZXN0KHVybCk7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuLy4uL3V0aWxzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gKFxuICB1dGlscy5pc1N0YW5kYXJkQnJvd3NlckVudigpID9cblxuICAvLyBTdGFuZGFyZCBicm93c2VyIGVudnMgaGF2ZSBmdWxsIHN1cHBvcnQgb2YgdGhlIEFQSXMgbmVlZGVkIHRvIHRlc3RcbiAgLy8gd2hldGhlciB0aGUgcmVxdWVzdCBVUkwgaXMgb2YgdGhlIHNhbWUgb3JpZ2luIGFzIGN1cnJlbnQgbG9jYXRpb24uXG4gICAgKGZ1bmN0aW9uIHN0YW5kYXJkQnJvd3NlckVudigpIHtcbiAgICAgIHZhciBtc2llID0gLyhtc2llfHRyaWRlbnQpL2kudGVzdChuYXZpZ2F0b3IudXNlckFnZW50KTtcbiAgICAgIHZhciB1cmxQYXJzaW5nTm9kZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2EnKTtcbiAgICAgIHZhciBvcmlnaW5VUkw7XG5cbiAgICAgIC8qKlxuICAgICogUGFyc2UgYSBVUkwgdG8gZGlzY292ZXIgaXQncyBjb21wb25lbnRzXG4gICAgKlxuICAgICogQHBhcmFtIHtTdHJpbmd9IHVybCBUaGUgVVJMIHRvIGJlIHBhcnNlZFxuICAgICogQHJldHVybnMge09iamVjdH1cbiAgICAqL1xuICAgICAgZnVuY3Rpb24gcmVzb2x2ZVVSTCh1cmwpIHtcbiAgICAgICAgdmFyIGhyZWYgPSB1cmw7XG5cbiAgICAgICAgaWYgKG1zaWUpIHtcbiAgICAgICAgLy8gSUUgbmVlZHMgYXR0cmlidXRlIHNldCB0d2ljZSB0byBub3JtYWxpemUgcHJvcGVydGllc1xuICAgICAgICAgIHVybFBhcnNpbmdOb2RlLnNldEF0dHJpYnV0ZSgnaHJlZicsIGhyZWYpO1xuICAgICAgICAgIGhyZWYgPSB1cmxQYXJzaW5nTm9kZS5ocmVmO1xuICAgICAgICB9XG5cbiAgICAgICAgdXJsUGFyc2luZ05vZGUuc2V0QXR0cmlidXRlKCdocmVmJywgaHJlZik7XG5cbiAgICAgICAgLy8gdXJsUGFyc2luZ05vZGUgcHJvdmlkZXMgdGhlIFVybFV0aWxzIGludGVyZmFjZSAtIGh0dHA6Ly91cmwuc3BlYy53aGF0d2cub3JnLyN1cmx1dGlsc1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGhyZWY6IHVybFBhcnNpbmdOb2RlLmhyZWYsXG4gICAgICAgICAgcHJvdG9jb2w6IHVybFBhcnNpbmdOb2RlLnByb3RvY29sID8gdXJsUGFyc2luZ05vZGUucHJvdG9jb2wucmVwbGFjZSgvOiQvLCAnJykgOiAnJyxcbiAgICAgICAgICBob3N0OiB1cmxQYXJzaW5nTm9kZS5ob3N0LFxuICAgICAgICAgIHNlYXJjaDogdXJsUGFyc2luZ05vZGUuc2VhcmNoID8gdXJsUGFyc2luZ05vZGUuc2VhcmNoLnJlcGxhY2UoL15cXD8vLCAnJykgOiAnJyxcbiAgICAgICAgICBoYXNoOiB1cmxQYXJzaW5nTm9kZS5oYXNoID8gdXJsUGFyc2luZ05vZGUuaGFzaC5yZXBsYWNlKC9eIy8sICcnKSA6ICcnLFxuICAgICAgICAgIGhvc3RuYW1lOiB1cmxQYXJzaW5nTm9kZS5ob3N0bmFtZSxcbiAgICAgICAgICBwb3J0OiB1cmxQYXJzaW5nTm9kZS5wb3J0LFxuICAgICAgICAgIHBhdGhuYW1lOiAodXJsUGFyc2luZ05vZGUucGF0aG5hbWUuY2hhckF0KDApID09PSAnLycpID9cbiAgICAgICAgICAgIHVybFBhcnNpbmdOb2RlLnBhdGhuYW1lIDpcbiAgICAgICAgICAgICcvJyArIHVybFBhcnNpbmdOb2RlLnBhdGhuYW1lXG4gICAgICAgIH07XG4gICAgICB9XG5cbiAgICAgIG9yaWdpblVSTCA9IHJlc29sdmVVUkwod2luZG93LmxvY2F0aW9uLmhyZWYpO1xuXG4gICAgICAvKipcbiAgICAqIERldGVybWluZSBpZiBhIFVSTCBzaGFyZXMgdGhlIHNhbWUgb3JpZ2luIGFzIHRoZSBjdXJyZW50IGxvY2F0aW9uXG4gICAgKlxuICAgICogQHBhcmFtIHtTdHJpbmd9IHJlcXVlc3RVUkwgVGhlIFVSTCB0byB0ZXN0XG4gICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiBVUkwgc2hhcmVzIHRoZSBzYW1lIG9yaWdpbiwgb3RoZXJ3aXNlIGZhbHNlXG4gICAgKi9cbiAgICAgIHJldHVybiBmdW5jdGlvbiBpc1VSTFNhbWVPcmlnaW4ocmVxdWVzdFVSTCkge1xuICAgICAgICB2YXIgcGFyc2VkID0gKHV0aWxzLmlzU3RyaW5nKHJlcXVlc3RVUkwpKSA/IHJlc29sdmVVUkwocmVxdWVzdFVSTCkgOiByZXF1ZXN0VVJMO1xuICAgICAgICByZXR1cm4gKHBhcnNlZC5wcm90b2NvbCA9PT0gb3JpZ2luVVJMLnByb3RvY29sICYmXG4gICAgICAgICAgICBwYXJzZWQuaG9zdCA9PT0gb3JpZ2luVVJMLmhvc3QpO1xuICAgICAgfTtcbiAgICB9KSgpIDpcblxuICAvLyBOb24gc3RhbmRhcmQgYnJvd3NlciBlbnZzICh3ZWIgd29ya2VycywgcmVhY3QtbmF0aXZlKSBsYWNrIG5lZWRlZCBzdXBwb3J0LlxuICAgIChmdW5jdGlvbiBub25TdGFuZGFyZEJyb3dzZXJFbnYoKSB7XG4gICAgICByZXR1cm4gZnVuY3Rpb24gaXNVUkxTYW1lT3JpZ2luKCkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH07XG4gICAgfSkoKVxuKTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHV0aWxzID0gcmVxdWlyZSgnLi4vdXRpbHMnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBub3JtYWxpemVIZWFkZXJOYW1lKGhlYWRlcnMsIG5vcm1hbGl6ZWROYW1lKSB7XG4gIHV0aWxzLmZvckVhY2goaGVhZGVycywgZnVuY3Rpb24gcHJvY2Vzc0hlYWRlcih2YWx1ZSwgbmFtZSkge1xuICAgIGlmIChuYW1lICE9PSBub3JtYWxpemVkTmFtZSAmJiBuYW1lLnRvVXBwZXJDYXNlKCkgPT09IG5vcm1hbGl6ZWROYW1lLnRvVXBwZXJDYXNlKCkpIHtcbiAgICAgIGhlYWRlcnNbbm9ybWFsaXplZE5hbWVdID0gdmFsdWU7XG4gICAgICBkZWxldGUgaGVhZGVyc1tuYW1lXTtcbiAgICB9XG4gIH0pO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHV0aWxzID0gcmVxdWlyZSgnLi8uLi91dGlscycpO1xuXG4vLyBIZWFkZXJzIHdob3NlIGR1cGxpY2F0ZXMgYXJlIGlnbm9yZWQgYnkgbm9kZVxuLy8gYy5mLiBodHRwczovL25vZGVqcy5vcmcvYXBpL2h0dHAuaHRtbCNodHRwX21lc3NhZ2VfaGVhZGVyc1xudmFyIGlnbm9yZUR1cGxpY2F0ZU9mID0gW1xuICAnYWdlJywgJ2F1dGhvcml6YXRpb24nLCAnY29udGVudC1sZW5ndGgnLCAnY29udGVudC10eXBlJywgJ2V0YWcnLFxuICAnZXhwaXJlcycsICdmcm9tJywgJ2hvc3QnLCAnaWYtbW9kaWZpZWQtc2luY2UnLCAnaWYtdW5tb2RpZmllZC1zaW5jZScsXG4gICdsYXN0LW1vZGlmaWVkJywgJ2xvY2F0aW9uJywgJ21heC1mb3J3YXJkcycsICdwcm94eS1hdXRob3JpemF0aW9uJyxcbiAgJ3JlZmVyZXInLCAncmV0cnktYWZ0ZXInLCAndXNlci1hZ2VudCdcbl07XG5cbi8qKlxuICogUGFyc2UgaGVhZGVycyBpbnRvIGFuIG9iamVjdFxuICpcbiAqIGBgYFxuICogRGF0ZTogV2VkLCAyNyBBdWcgMjAxNCAwODo1ODo0OSBHTVRcbiAqIENvbnRlbnQtVHlwZTogYXBwbGljYXRpb24vanNvblxuICogQ29ubmVjdGlvbjoga2VlcC1hbGl2ZVxuICogVHJhbnNmZXItRW5jb2Rpbmc6IGNodW5rZWRcbiAqIGBgYFxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBoZWFkZXJzIEhlYWRlcnMgbmVlZGluZyB0byBiZSBwYXJzZWRcbiAqIEByZXR1cm5zIHtPYmplY3R9IEhlYWRlcnMgcGFyc2VkIGludG8gYW4gb2JqZWN0XG4gKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gcGFyc2VIZWFkZXJzKGhlYWRlcnMpIHtcbiAgdmFyIHBhcnNlZCA9IHt9O1xuICB2YXIga2V5O1xuICB2YXIgdmFsO1xuICB2YXIgaTtcblxuICBpZiAoIWhlYWRlcnMpIHsgcmV0dXJuIHBhcnNlZDsgfVxuXG4gIHV0aWxzLmZvckVhY2goaGVhZGVycy5zcGxpdCgnXFxuJyksIGZ1bmN0aW9uIHBhcnNlcihsaW5lKSB7XG4gICAgaSA9IGxpbmUuaW5kZXhPZignOicpO1xuICAgIGtleSA9IHV0aWxzLnRyaW0obGluZS5zdWJzdHIoMCwgaSkpLnRvTG93ZXJDYXNlKCk7XG4gICAgdmFsID0gdXRpbHMudHJpbShsaW5lLnN1YnN0cihpICsgMSkpO1xuXG4gICAgaWYgKGtleSkge1xuICAgICAgaWYgKHBhcnNlZFtrZXldICYmIGlnbm9yZUR1cGxpY2F0ZU9mLmluZGV4T2Yoa2V5KSA+PSAwKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGlmIChrZXkgPT09ICdzZXQtY29va2llJykge1xuICAgICAgICBwYXJzZWRba2V5XSA9IChwYXJzZWRba2V5XSA/IHBhcnNlZFtrZXldIDogW10pLmNvbmNhdChbdmFsXSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwYXJzZWRba2V5XSA9IHBhcnNlZFtrZXldID8gcGFyc2VkW2tleV0gKyAnLCAnICsgdmFsIDogdmFsO1xuICAgICAgfVxuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIHBhcnNlZDtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbi8qKlxuICogU3ludGFjdGljIHN1Z2FyIGZvciBpbnZva2luZyBhIGZ1bmN0aW9uIGFuZCBleHBhbmRpbmcgYW4gYXJyYXkgZm9yIGFyZ3VtZW50cy5cbiAqXG4gKiBDb21tb24gdXNlIGNhc2Ugd291bGQgYmUgdG8gdXNlIGBGdW5jdGlvbi5wcm90b3R5cGUuYXBwbHlgLlxuICpcbiAqICBgYGBqc1xuICogIGZ1bmN0aW9uIGYoeCwgeSwgeikge31cbiAqICB2YXIgYXJncyA9IFsxLCAyLCAzXTtcbiAqICBmLmFwcGx5KG51bGwsIGFyZ3MpO1xuICogIGBgYFxuICpcbiAqIFdpdGggYHNwcmVhZGAgdGhpcyBleGFtcGxlIGNhbiBiZSByZS13cml0dGVuLlxuICpcbiAqICBgYGBqc1xuICogIHNwcmVhZChmdW5jdGlvbih4LCB5LCB6KSB7fSkoWzEsIDIsIDNdKTtcbiAqICBgYGBcbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFja1xuICogQHJldHVybnMge0Z1bmN0aW9ufVxuICovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIHNwcmVhZChjYWxsYmFjaykge1xuICByZXR1cm4gZnVuY3Rpb24gd3JhcChhcnIpIHtcbiAgICByZXR1cm4gY2FsbGJhY2suYXBwbHkobnVsbCwgYXJyKTtcbiAgfTtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBiaW5kID0gcmVxdWlyZSgnLi9oZWxwZXJzL2JpbmQnKTtcbnZhciBpc0J1ZmZlciA9IHJlcXVpcmUoJ2lzLWJ1ZmZlcicpO1xuXG4vKmdsb2JhbCB0b1N0cmluZzp0cnVlKi9cblxuLy8gdXRpbHMgaXMgYSBsaWJyYXJ5IG9mIGdlbmVyaWMgaGVscGVyIGZ1bmN0aW9ucyBub24tc3BlY2lmaWMgdG8gYXhpb3NcblxudmFyIHRvU3RyaW5nID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZztcblxuLyoqXG4gKiBEZXRlcm1pbmUgaWYgYSB2YWx1ZSBpcyBhbiBBcnJheVxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSB2YWwgVGhlIHZhbHVlIHRvIHRlc3RcbiAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHZhbHVlIGlzIGFuIEFycmF5LCBvdGhlcndpc2UgZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNBcnJheSh2YWwpIHtcbiAgcmV0dXJuIHRvU3RyaW5nLmNhbGwodmFsKSA9PT0gJ1tvYmplY3QgQXJyYXldJztcbn1cblxuLyoqXG4gKiBEZXRlcm1pbmUgaWYgYSB2YWx1ZSBpcyBhbiBBcnJheUJ1ZmZlclxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSB2YWwgVGhlIHZhbHVlIHRvIHRlc3RcbiAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHZhbHVlIGlzIGFuIEFycmF5QnVmZmVyLCBvdGhlcndpc2UgZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNBcnJheUJ1ZmZlcih2YWwpIHtcbiAgcmV0dXJuIHRvU3RyaW5nLmNhbGwodmFsKSA9PT0gJ1tvYmplY3QgQXJyYXlCdWZmZXJdJztcbn1cblxuLyoqXG4gKiBEZXRlcm1pbmUgaWYgYSB2YWx1ZSBpcyBhIEZvcm1EYXRhXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IHZhbCBUaGUgdmFsdWUgdG8gdGVzdFxuICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdmFsdWUgaXMgYW4gRm9ybURhdGEsIG90aGVyd2lzZSBmYWxzZVxuICovXG5mdW5jdGlvbiBpc0Zvcm1EYXRhKHZhbCkge1xuICByZXR1cm4gKHR5cGVvZiBGb3JtRGF0YSAhPT0gJ3VuZGVmaW5lZCcpICYmICh2YWwgaW5zdGFuY2VvZiBGb3JtRGF0YSk7XG59XG5cbi8qKlxuICogRGV0ZXJtaW5lIGlmIGEgdmFsdWUgaXMgYSB2aWV3IG9uIGFuIEFycmF5QnVmZmVyXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IHZhbCBUaGUgdmFsdWUgdG8gdGVzdFxuICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdmFsdWUgaXMgYSB2aWV3IG9uIGFuIEFycmF5QnVmZmVyLCBvdGhlcndpc2UgZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNBcnJheUJ1ZmZlclZpZXcodmFsKSB7XG4gIHZhciByZXN1bHQ7XG4gIGlmICgodHlwZW9mIEFycmF5QnVmZmVyICE9PSAndW5kZWZpbmVkJykgJiYgKEFycmF5QnVmZmVyLmlzVmlldykpIHtcbiAgICByZXN1bHQgPSBBcnJheUJ1ZmZlci5pc1ZpZXcodmFsKTtcbiAgfSBlbHNlIHtcbiAgICByZXN1bHQgPSAodmFsKSAmJiAodmFsLmJ1ZmZlcikgJiYgKHZhbC5idWZmZXIgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcik7XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuLyoqXG4gKiBEZXRlcm1pbmUgaWYgYSB2YWx1ZSBpcyBhIFN0cmluZ1xuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSB2YWwgVGhlIHZhbHVlIHRvIHRlc3RcbiAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHZhbHVlIGlzIGEgU3RyaW5nLCBvdGhlcndpc2UgZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNTdHJpbmcodmFsKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsID09PSAnc3RyaW5nJztcbn1cblxuLyoqXG4gKiBEZXRlcm1pbmUgaWYgYSB2YWx1ZSBpcyBhIE51bWJlclxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSB2YWwgVGhlIHZhbHVlIHRvIHRlc3RcbiAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHZhbHVlIGlzIGEgTnVtYmVyLCBvdGhlcndpc2UgZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNOdW1iZXIodmFsKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsID09PSAnbnVtYmVyJztcbn1cblxuLyoqXG4gKiBEZXRlcm1pbmUgaWYgYSB2YWx1ZSBpcyB1bmRlZmluZWRcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gdmFsIFRoZSB2YWx1ZSB0byB0ZXN0XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgdmFsdWUgaXMgdW5kZWZpbmVkLCBvdGhlcndpc2UgZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNVbmRlZmluZWQodmFsKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsID09PSAndW5kZWZpbmVkJztcbn1cblxuLyoqXG4gKiBEZXRlcm1pbmUgaWYgYSB2YWx1ZSBpcyBhbiBPYmplY3RcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gdmFsIFRoZSB2YWx1ZSB0byB0ZXN0XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB2YWx1ZSBpcyBhbiBPYmplY3QsIG90aGVyd2lzZSBmYWxzZVxuICovXG5mdW5jdGlvbiBpc09iamVjdCh2YWwpIHtcbiAgcmV0dXJuIHZhbCAhPT0gbnVsbCAmJiB0eXBlb2YgdmFsID09PSAnb2JqZWN0Jztcbn1cblxuLyoqXG4gKiBEZXRlcm1pbmUgaWYgYSB2YWx1ZSBpcyBhIERhdGVcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gdmFsIFRoZSB2YWx1ZSB0byB0ZXN0XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB2YWx1ZSBpcyBhIERhdGUsIG90aGVyd2lzZSBmYWxzZVxuICovXG5mdW5jdGlvbiBpc0RhdGUodmFsKSB7XG4gIHJldHVybiB0b1N0cmluZy5jYWxsKHZhbCkgPT09ICdbb2JqZWN0IERhdGVdJztcbn1cblxuLyoqXG4gKiBEZXRlcm1pbmUgaWYgYSB2YWx1ZSBpcyBhIEZpbGVcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gdmFsIFRoZSB2YWx1ZSB0byB0ZXN0XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB2YWx1ZSBpcyBhIEZpbGUsIG90aGVyd2lzZSBmYWxzZVxuICovXG5mdW5jdGlvbiBpc0ZpbGUodmFsKSB7XG4gIHJldHVybiB0b1N0cmluZy5jYWxsKHZhbCkgPT09ICdbb2JqZWN0IEZpbGVdJztcbn1cblxuLyoqXG4gKiBEZXRlcm1pbmUgaWYgYSB2YWx1ZSBpcyBhIEJsb2JcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gdmFsIFRoZSB2YWx1ZSB0byB0ZXN0XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB2YWx1ZSBpcyBhIEJsb2IsIG90aGVyd2lzZSBmYWxzZVxuICovXG5mdW5jdGlvbiBpc0Jsb2IodmFsKSB7XG4gIHJldHVybiB0b1N0cmluZy5jYWxsKHZhbCkgPT09ICdbb2JqZWN0IEJsb2JdJztcbn1cblxuLyoqXG4gKiBEZXRlcm1pbmUgaWYgYSB2YWx1ZSBpcyBhIEZ1bmN0aW9uXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IHZhbCBUaGUgdmFsdWUgdG8gdGVzdFxuICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdmFsdWUgaXMgYSBGdW5jdGlvbiwgb3RoZXJ3aXNlIGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzRnVuY3Rpb24odmFsKSB7XG4gIHJldHVybiB0b1N0cmluZy5jYWxsKHZhbCkgPT09ICdbb2JqZWN0IEZ1bmN0aW9uXSc7XG59XG5cbi8qKlxuICogRGV0ZXJtaW5lIGlmIGEgdmFsdWUgaXMgYSBTdHJlYW1cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gdmFsIFRoZSB2YWx1ZSB0byB0ZXN0XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB2YWx1ZSBpcyBhIFN0cmVhbSwgb3RoZXJ3aXNlIGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzU3RyZWFtKHZhbCkge1xuICByZXR1cm4gaXNPYmplY3QodmFsKSAmJiBpc0Z1bmN0aW9uKHZhbC5waXBlKTtcbn1cblxuLyoqXG4gKiBEZXRlcm1pbmUgaWYgYSB2YWx1ZSBpcyBhIFVSTFNlYXJjaFBhcmFtcyBvYmplY3RcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gdmFsIFRoZSB2YWx1ZSB0byB0ZXN0XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB2YWx1ZSBpcyBhIFVSTFNlYXJjaFBhcmFtcyBvYmplY3QsIG90aGVyd2lzZSBmYWxzZVxuICovXG5mdW5jdGlvbiBpc1VSTFNlYXJjaFBhcmFtcyh2YWwpIHtcbiAgcmV0dXJuIHR5cGVvZiBVUkxTZWFyY2hQYXJhbXMgIT09ICd1bmRlZmluZWQnICYmIHZhbCBpbnN0YW5jZW9mIFVSTFNlYXJjaFBhcmFtcztcbn1cblxuLyoqXG4gKiBUcmltIGV4Y2VzcyB3aGl0ZXNwYWNlIG9mZiB0aGUgYmVnaW5uaW5nIGFuZCBlbmQgb2YgYSBzdHJpbmdcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyIFRoZSBTdHJpbmcgdG8gdHJpbVxuICogQHJldHVybnMge1N0cmluZ30gVGhlIFN0cmluZyBmcmVlZCBvZiBleGNlc3Mgd2hpdGVzcGFjZVxuICovXG5mdW5jdGlvbiB0cmltKHN0cikge1xuICByZXR1cm4gc3RyLnJlcGxhY2UoL15cXHMqLywgJycpLnJlcGxhY2UoL1xccyokLywgJycpO1xufVxuXG4vKipcbiAqIERldGVybWluZSBpZiB3ZSdyZSBydW5uaW5nIGluIGEgc3RhbmRhcmQgYnJvd3NlciBlbnZpcm9ubWVudFxuICpcbiAqIFRoaXMgYWxsb3dzIGF4aW9zIHRvIHJ1biBpbiBhIHdlYiB3b3JrZXIsIGFuZCByZWFjdC1uYXRpdmUuXG4gKiBCb3RoIGVudmlyb25tZW50cyBzdXBwb3J0IFhNTEh0dHBSZXF1ZXN0LCBidXQgbm90IGZ1bGx5IHN0YW5kYXJkIGdsb2JhbHMuXG4gKlxuICogd2ViIHdvcmtlcnM6XG4gKiAgdHlwZW9mIHdpbmRvdyAtPiB1bmRlZmluZWRcbiAqICB0eXBlb2YgZG9jdW1lbnQgLT4gdW5kZWZpbmVkXG4gKlxuICogcmVhY3QtbmF0aXZlOlxuICogIG5hdmlnYXRvci5wcm9kdWN0IC0+ICdSZWFjdE5hdGl2ZSdcbiAqIG5hdGl2ZXNjcmlwdFxuICogIG5hdmlnYXRvci5wcm9kdWN0IC0+ICdOYXRpdmVTY3JpcHQnIG9yICdOUydcbiAqL1xuZnVuY3Rpb24gaXNTdGFuZGFyZEJyb3dzZXJFbnYoKSB7XG4gIGlmICh0eXBlb2YgbmF2aWdhdG9yICE9PSAndW5kZWZpbmVkJyAmJiAobmF2aWdhdG9yLnByb2R1Y3QgPT09ICdSZWFjdE5hdGl2ZScgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuYXZpZ2F0b3IucHJvZHVjdCA9PT0gJ05hdGl2ZVNjcmlwdCcgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuYXZpZ2F0b3IucHJvZHVjdCA9PT0gJ05TJykpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgcmV0dXJuIChcbiAgICB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJlxuICAgIHR5cGVvZiBkb2N1bWVudCAhPT0gJ3VuZGVmaW5lZCdcbiAgKTtcbn1cblxuLyoqXG4gKiBJdGVyYXRlIG92ZXIgYW4gQXJyYXkgb3IgYW4gT2JqZWN0IGludm9raW5nIGEgZnVuY3Rpb24gZm9yIGVhY2ggaXRlbS5cbiAqXG4gKiBJZiBgb2JqYCBpcyBhbiBBcnJheSBjYWxsYmFjayB3aWxsIGJlIGNhbGxlZCBwYXNzaW5nXG4gKiB0aGUgdmFsdWUsIGluZGV4LCBhbmQgY29tcGxldGUgYXJyYXkgZm9yIGVhY2ggaXRlbS5cbiAqXG4gKiBJZiAnb2JqJyBpcyBhbiBPYmplY3QgY2FsbGJhY2sgd2lsbCBiZSBjYWxsZWQgcGFzc2luZ1xuICogdGhlIHZhbHVlLCBrZXksIGFuZCBjb21wbGV0ZSBvYmplY3QgZm9yIGVhY2ggcHJvcGVydHkuXG4gKlxuICogQHBhcmFtIHtPYmplY3R8QXJyYXl9IG9iaiBUaGUgb2JqZWN0IHRvIGl0ZXJhdGVcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZuIFRoZSBjYWxsYmFjayB0byBpbnZva2UgZm9yIGVhY2ggaXRlbVxuICovXG5mdW5jdGlvbiBmb3JFYWNoKG9iaiwgZm4pIHtcbiAgLy8gRG9uJ3QgYm90aGVyIGlmIG5vIHZhbHVlIHByb3ZpZGVkXG4gIGlmIChvYmogPT09IG51bGwgfHwgdHlwZW9mIG9iaiA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICAvLyBGb3JjZSBhbiBhcnJheSBpZiBub3QgYWxyZWFkeSBzb21ldGhpbmcgaXRlcmFibGVcbiAgaWYgKHR5cGVvZiBvYmogIT09ICdvYmplY3QnKSB7XG4gICAgLyplc2xpbnQgbm8tcGFyYW0tcmVhc3NpZ246MCovXG4gICAgb2JqID0gW29ial07XG4gIH1cblxuICBpZiAoaXNBcnJheShvYmopKSB7XG4gICAgLy8gSXRlcmF0ZSBvdmVyIGFycmF5IHZhbHVlc1xuICAgIGZvciAodmFyIGkgPSAwLCBsID0gb2JqLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgZm4uY2FsbChudWxsLCBvYmpbaV0sIGksIG9iaik7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIC8vIEl0ZXJhdGUgb3ZlciBvYmplY3Qga2V5c1xuICAgIGZvciAodmFyIGtleSBpbiBvYmopIHtcbiAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqLCBrZXkpKSB7XG4gICAgICAgIGZuLmNhbGwobnVsbCwgb2JqW2tleV0sIGtleSwgb2JqKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBBY2NlcHRzIHZhcmFyZ3MgZXhwZWN0aW5nIGVhY2ggYXJndW1lbnQgdG8gYmUgYW4gb2JqZWN0LCB0aGVuXG4gKiBpbW11dGFibHkgbWVyZ2VzIHRoZSBwcm9wZXJ0aWVzIG9mIGVhY2ggb2JqZWN0IGFuZCByZXR1cm5zIHJlc3VsdC5cbiAqXG4gKiBXaGVuIG11bHRpcGxlIG9iamVjdHMgY29udGFpbiB0aGUgc2FtZSBrZXkgdGhlIGxhdGVyIG9iamVjdCBpblxuICogdGhlIGFyZ3VtZW50cyBsaXN0IHdpbGwgdGFrZSBwcmVjZWRlbmNlLlxuICpcbiAqIEV4YW1wbGU6XG4gKlxuICogYGBganNcbiAqIHZhciByZXN1bHQgPSBtZXJnZSh7Zm9vOiAxMjN9LCB7Zm9vOiA0NTZ9KTtcbiAqIGNvbnNvbGUubG9nKHJlc3VsdC5mb28pOyAvLyBvdXRwdXRzIDQ1NlxuICogYGBgXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IG9iajEgT2JqZWN0IHRvIG1lcmdlXG4gKiBAcmV0dXJucyB7T2JqZWN0fSBSZXN1bHQgb2YgYWxsIG1lcmdlIHByb3BlcnRpZXNcbiAqL1xuZnVuY3Rpb24gbWVyZ2UoLyogb2JqMSwgb2JqMiwgb2JqMywgLi4uICovKSB7XG4gIHZhciByZXN1bHQgPSB7fTtcbiAgZnVuY3Rpb24gYXNzaWduVmFsdWUodmFsLCBrZXkpIHtcbiAgICBpZiAodHlwZW9mIHJlc3VsdFtrZXldID09PSAnb2JqZWN0JyAmJiB0eXBlb2YgdmFsID09PSAnb2JqZWN0Jykge1xuICAgICAgcmVzdWx0W2tleV0gPSBtZXJnZShyZXN1bHRba2V5XSwgdmFsKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzdWx0W2tleV0gPSB2YWw7XG4gICAgfVxuICB9XG5cbiAgZm9yICh2YXIgaSA9IDAsIGwgPSBhcmd1bWVudHMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgZm9yRWFjaChhcmd1bWVudHNbaV0sIGFzc2lnblZhbHVlKTtcbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuXG4vKipcbiAqIEZ1bmN0aW9uIGVxdWFsIHRvIG1lcmdlIHdpdGggdGhlIGRpZmZlcmVuY2UgYmVpbmcgdGhhdCBubyByZWZlcmVuY2VcbiAqIHRvIG9yaWdpbmFsIG9iamVjdHMgaXMga2VwdC5cbiAqXG4gKiBAc2VlIG1lcmdlXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqMSBPYmplY3QgdG8gbWVyZ2VcbiAqIEByZXR1cm5zIHtPYmplY3R9IFJlc3VsdCBvZiBhbGwgbWVyZ2UgcHJvcGVydGllc1xuICovXG5mdW5jdGlvbiBkZWVwTWVyZ2UoLyogb2JqMSwgb2JqMiwgb2JqMywgLi4uICovKSB7XG4gIHZhciByZXN1bHQgPSB7fTtcbiAgZnVuY3Rpb24gYXNzaWduVmFsdWUodmFsLCBrZXkpIHtcbiAgICBpZiAodHlwZW9mIHJlc3VsdFtrZXldID09PSAnb2JqZWN0JyAmJiB0eXBlb2YgdmFsID09PSAnb2JqZWN0Jykge1xuICAgICAgcmVzdWx0W2tleV0gPSBkZWVwTWVyZ2UocmVzdWx0W2tleV0sIHZhbCk7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgdmFsID09PSAnb2JqZWN0Jykge1xuICAgICAgcmVzdWx0W2tleV0gPSBkZWVwTWVyZ2Uoe30sIHZhbCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlc3VsdFtrZXldID0gdmFsO1xuICAgIH1cbiAgfVxuXG4gIGZvciAodmFyIGkgPSAwLCBsID0gYXJndW1lbnRzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgIGZvckVhY2goYXJndW1lbnRzW2ldLCBhc3NpZ25WYWx1ZSk7XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuLyoqXG4gKiBFeHRlbmRzIG9iamVjdCBhIGJ5IG11dGFibHkgYWRkaW5nIHRvIGl0IHRoZSBwcm9wZXJ0aWVzIG9mIG9iamVjdCBiLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBhIFRoZSBvYmplY3QgdG8gYmUgZXh0ZW5kZWRcbiAqIEBwYXJhbSB7T2JqZWN0fSBiIFRoZSBvYmplY3QgdG8gY29weSBwcm9wZXJ0aWVzIGZyb21cbiAqIEBwYXJhbSB7T2JqZWN0fSB0aGlzQXJnIFRoZSBvYmplY3QgdG8gYmluZCBmdW5jdGlvbiB0b1xuICogQHJldHVybiB7T2JqZWN0fSBUaGUgcmVzdWx0aW5nIHZhbHVlIG9mIG9iamVjdCBhXG4gKi9cbmZ1bmN0aW9uIGV4dGVuZChhLCBiLCB0aGlzQXJnKSB7XG4gIGZvckVhY2goYiwgZnVuY3Rpb24gYXNzaWduVmFsdWUodmFsLCBrZXkpIHtcbiAgICBpZiAodGhpc0FyZyAmJiB0eXBlb2YgdmFsID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBhW2tleV0gPSBiaW5kKHZhbCwgdGhpc0FyZyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGFba2V5XSA9IHZhbDtcbiAgICB9XG4gIH0pO1xuICByZXR1cm4gYTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIGlzQXJyYXk6IGlzQXJyYXksXG4gIGlzQXJyYXlCdWZmZXI6IGlzQXJyYXlCdWZmZXIsXG4gIGlzQnVmZmVyOiBpc0J1ZmZlcixcbiAgaXNGb3JtRGF0YTogaXNGb3JtRGF0YSxcbiAgaXNBcnJheUJ1ZmZlclZpZXc6IGlzQXJyYXlCdWZmZXJWaWV3LFxuICBpc1N0cmluZzogaXNTdHJpbmcsXG4gIGlzTnVtYmVyOiBpc051bWJlcixcbiAgaXNPYmplY3Q6IGlzT2JqZWN0LFxuICBpc1VuZGVmaW5lZDogaXNVbmRlZmluZWQsXG4gIGlzRGF0ZTogaXNEYXRlLFxuICBpc0ZpbGU6IGlzRmlsZSxcbiAgaXNCbG9iOiBpc0Jsb2IsXG4gIGlzRnVuY3Rpb246IGlzRnVuY3Rpb24sXG4gIGlzU3RyZWFtOiBpc1N0cmVhbSxcbiAgaXNVUkxTZWFyY2hQYXJhbXM6IGlzVVJMU2VhcmNoUGFyYW1zLFxuICBpc1N0YW5kYXJkQnJvd3NlckVudjogaXNTdGFuZGFyZEJyb3dzZXJFbnYsXG4gIGZvckVhY2g6IGZvckVhY2gsXG4gIG1lcmdlOiBtZXJnZSxcbiAgZGVlcE1lcmdlOiBkZWVwTWVyZ2UsXG4gIGV4dGVuZDogZXh0ZW5kLFxuICB0cmltOiB0cmltXG59O1xuIiwiLyohXG4gKiBEZXRlcm1pbmUgaWYgYW4gb2JqZWN0IGlzIGEgQnVmZmVyXG4gKlxuICogQGF1dGhvciAgIEZlcm9zcyBBYm91a2hhZGlqZWggPGh0dHBzOi8vZmVyb3NzLm9yZz5cbiAqIEBsaWNlbnNlICBNSVRcbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGlzQnVmZmVyIChvYmopIHtcbiAgcmV0dXJuIG9iaiAhPSBudWxsICYmIG9iai5jb25zdHJ1Y3RvciAhPSBudWxsICYmXG4gICAgdHlwZW9mIG9iai5jb25zdHJ1Y3Rvci5pc0J1ZmZlciA9PT0gJ2Z1bmN0aW9uJyAmJiBvYmouY29uc3RydWN0b3IuaXNCdWZmZXIob2JqKVxufVxuIiwiLy8gc2hpbSBmb3IgdXNpbmcgcHJvY2VzcyBpbiBicm93c2VyXG52YXIgcHJvY2VzcyA9IG1vZHVsZS5leHBvcnRzID0ge307XG5cbi8vIGNhY2hlZCBmcm9tIHdoYXRldmVyIGdsb2JhbCBpcyBwcmVzZW50IHNvIHRoYXQgdGVzdCBydW5uZXJzIHRoYXQgc3R1YiBpdFxuLy8gZG9uJ3QgYnJlYWsgdGhpbmdzLiAgQnV0IHdlIG5lZWQgdG8gd3JhcCBpdCBpbiBhIHRyeSBjYXRjaCBpbiBjYXNlIGl0IGlzXG4vLyB3cmFwcGVkIGluIHN0cmljdCBtb2RlIGNvZGUgd2hpY2ggZG9lc24ndCBkZWZpbmUgYW55IGdsb2JhbHMuICBJdCdzIGluc2lkZSBhXG4vLyBmdW5jdGlvbiBiZWNhdXNlIHRyeS9jYXRjaGVzIGRlb3B0aW1pemUgaW4gY2VydGFpbiBlbmdpbmVzLlxuXG52YXIgY2FjaGVkU2V0VGltZW91dDtcbnZhciBjYWNoZWRDbGVhclRpbWVvdXQ7XG5cbmZ1bmN0aW9uIGRlZmF1bHRTZXRUaW1vdXQoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdzZXRUaW1lb3V0IGhhcyBub3QgYmVlbiBkZWZpbmVkJyk7XG59XG5mdW5jdGlvbiBkZWZhdWx0Q2xlYXJUaW1lb3V0ICgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2NsZWFyVGltZW91dCBoYXMgbm90IGJlZW4gZGVmaW5lZCcpO1xufVxuKGZ1bmN0aW9uICgpIHtcbiAgICB0cnkge1xuICAgICAgICBpZiAodHlwZW9mIHNldFRpbWVvdXQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBzZXRUaW1lb3V0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IGRlZmF1bHRTZXRUaW1vdXQ7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBkZWZhdWx0U2V0VGltb3V0O1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgICBpZiAodHlwZW9mIGNsZWFyVGltZW91dCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gY2xlYXJUaW1lb3V0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gZGVmYXVsdENsZWFyVGltZW91dDtcbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gZGVmYXVsdENsZWFyVGltZW91dDtcbiAgICB9XG59ICgpKVxuZnVuY3Rpb24gcnVuVGltZW91dChmdW4pIHtcbiAgICBpZiAoY2FjaGVkU2V0VGltZW91dCA9PT0gc2V0VGltZW91dCkge1xuICAgICAgICAvL25vcm1hbCBlbnZpcm9tZW50cyBpbiBzYW5lIHNpdHVhdGlvbnNcbiAgICAgICAgcmV0dXJuIHNldFRpbWVvdXQoZnVuLCAwKTtcbiAgICB9XG4gICAgLy8gaWYgc2V0VGltZW91dCB3YXNuJ3QgYXZhaWxhYmxlIGJ1dCB3YXMgbGF0dGVyIGRlZmluZWRcbiAgICBpZiAoKGNhY2hlZFNldFRpbWVvdXQgPT09IGRlZmF1bHRTZXRUaW1vdXQgfHwgIWNhY2hlZFNldFRpbWVvdXQpICYmIHNldFRpbWVvdXQpIHtcbiAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IHNldFRpbWVvdXQ7XG4gICAgICAgIHJldHVybiBzZXRUaW1lb3V0KGZ1biwgMCk7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAgIC8vIHdoZW4gd2hlbiBzb21lYm9keSBoYXMgc2NyZXdlZCB3aXRoIHNldFRpbWVvdXQgYnV0IG5vIEkuRS4gbWFkZG5lc3NcbiAgICAgICAgcmV0dXJuIGNhY2hlZFNldFRpbWVvdXQoZnVuLCAwKTtcbiAgICB9IGNhdGNoKGUpe1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gV2hlbiB3ZSBhcmUgaW4gSS5FLiBidXQgdGhlIHNjcmlwdCBoYXMgYmVlbiBldmFsZWQgc28gSS5FLiBkb2Vzbid0IHRydXN0IHRoZSBnbG9iYWwgb2JqZWN0IHdoZW4gY2FsbGVkIG5vcm1hbGx5XG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkU2V0VGltZW91dC5jYWxsKG51bGwsIGZ1biwgMCk7XG4gICAgICAgIH0gY2F0Y2goZSl7XG4gICAgICAgICAgICAvLyBzYW1lIGFzIGFib3ZlIGJ1dCB3aGVuIGl0J3MgYSB2ZXJzaW9uIG9mIEkuRS4gdGhhdCBtdXN0IGhhdmUgdGhlIGdsb2JhbCBvYmplY3QgZm9yICd0aGlzJywgaG9wZnVsbHkgb3VyIGNvbnRleHQgY29ycmVjdCBvdGhlcndpc2UgaXQgd2lsbCB0aHJvdyBhIGdsb2JhbCBlcnJvclxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZFNldFRpbWVvdXQuY2FsbCh0aGlzLCBmdW4sIDApO1xuICAgICAgICB9XG4gICAgfVxuXG5cbn1cbmZ1bmN0aW9uIHJ1bkNsZWFyVGltZW91dChtYXJrZXIpIHtcbiAgICBpZiAoY2FjaGVkQ2xlYXJUaW1lb3V0ID09PSBjbGVhclRpbWVvdXQpIHtcbiAgICAgICAgLy9ub3JtYWwgZW52aXJvbWVudHMgaW4gc2FuZSBzaXR1YXRpb25zXG4gICAgICAgIHJldHVybiBjbGVhclRpbWVvdXQobWFya2VyKTtcbiAgICB9XG4gICAgLy8gaWYgY2xlYXJUaW1lb3V0IHdhc24ndCBhdmFpbGFibGUgYnV0IHdhcyBsYXR0ZXIgZGVmaW5lZFxuICAgIGlmICgoY2FjaGVkQ2xlYXJUaW1lb3V0ID09PSBkZWZhdWx0Q2xlYXJUaW1lb3V0IHx8ICFjYWNoZWRDbGVhclRpbWVvdXQpICYmIGNsZWFyVGltZW91dCkge1xuICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBjbGVhclRpbWVvdXQ7XG4gICAgICAgIHJldHVybiBjbGVhclRpbWVvdXQobWFya2VyKTtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgLy8gd2hlbiB3aGVuIHNvbWVib2R5IGhhcyBzY3Jld2VkIHdpdGggc2V0VGltZW91dCBidXQgbm8gSS5FLiBtYWRkbmVzc1xuICAgICAgICByZXR1cm4gY2FjaGVkQ2xlYXJUaW1lb3V0KG1hcmtlcik7XG4gICAgfSBjYXRjaCAoZSl7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBXaGVuIHdlIGFyZSBpbiBJLkUuIGJ1dCB0aGUgc2NyaXB0IGhhcyBiZWVuIGV2YWxlZCBzbyBJLkUuIGRvZXNuJ3QgIHRydXN0IHRoZSBnbG9iYWwgb2JqZWN0IHdoZW4gY2FsbGVkIG5vcm1hbGx5XG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkQ2xlYXJUaW1lb3V0LmNhbGwobnVsbCwgbWFya2VyKTtcbiAgICAgICAgfSBjYXRjaCAoZSl7XG4gICAgICAgICAgICAvLyBzYW1lIGFzIGFib3ZlIGJ1dCB3aGVuIGl0J3MgYSB2ZXJzaW9uIG9mIEkuRS4gdGhhdCBtdXN0IGhhdmUgdGhlIGdsb2JhbCBvYmplY3QgZm9yICd0aGlzJywgaG9wZnVsbHkgb3VyIGNvbnRleHQgY29ycmVjdCBvdGhlcndpc2UgaXQgd2lsbCB0aHJvdyBhIGdsb2JhbCBlcnJvci5cbiAgICAgICAgICAgIC8vIFNvbWUgdmVyc2lvbnMgb2YgSS5FLiBoYXZlIGRpZmZlcmVudCBydWxlcyBmb3IgY2xlYXJUaW1lb3V0IHZzIHNldFRpbWVvdXRcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRDbGVhclRpbWVvdXQuY2FsbCh0aGlzLCBtYXJrZXIpO1xuICAgICAgICB9XG4gICAgfVxuXG5cblxufVxudmFyIHF1ZXVlID0gW107XG52YXIgZHJhaW5pbmcgPSBmYWxzZTtcbnZhciBjdXJyZW50UXVldWU7XG52YXIgcXVldWVJbmRleCA9IC0xO1xuXG5mdW5jdGlvbiBjbGVhblVwTmV4dFRpY2soKSB7XG4gICAgaWYgKCFkcmFpbmluZyB8fCAhY3VycmVudFF1ZXVlKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBpZiAoY3VycmVudFF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBxdWV1ZSA9IGN1cnJlbnRRdWV1ZS5jb25jYXQocXVldWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICB9XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBkcmFpblF1ZXVlKCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBkcmFpblF1ZXVlKCkge1xuICAgIGlmIChkcmFpbmluZykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciB0aW1lb3V0ID0gcnVuVGltZW91dChjbGVhblVwTmV4dFRpY2spO1xuICAgIGRyYWluaW5nID0gdHJ1ZTtcblxuICAgIHZhciBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgd2hpbGUobGVuKSB7XG4gICAgICAgIGN1cnJlbnRRdWV1ZSA9IHF1ZXVlO1xuICAgICAgICBxdWV1ZSA9IFtdO1xuICAgICAgICB3aGlsZSAoKytxdWV1ZUluZGV4IDwgbGVuKSB7XG4gICAgICAgICAgICBpZiAoY3VycmVudFF1ZXVlKSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFF1ZXVlW3F1ZXVlSW5kZXhdLnJ1bigpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICAgICAgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIH1cbiAgICBjdXJyZW50UXVldWUgPSBudWxsO1xuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgcnVuQ2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xufVxuXG5wcm9jZXNzLm5leHRUaWNrID0gZnVuY3Rpb24gKGZ1bikge1xuICAgIHZhciBhcmdzID0gbmV3IEFycmF5KGFyZ3VtZW50cy5sZW5ndGggLSAxKTtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICB9XG4gICAgfVxuICAgIHF1ZXVlLnB1c2gobmV3IEl0ZW0oZnVuLCBhcmdzKSk7XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCA9PT0gMSAmJiAhZHJhaW5pbmcpIHtcbiAgICAgICAgcnVuVGltZW91dChkcmFpblF1ZXVlKTtcbiAgICB9XG59O1xuXG4vLyB2OCBsaWtlcyBwcmVkaWN0aWJsZSBvYmplY3RzXG5mdW5jdGlvbiBJdGVtKGZ1biwgYXJyYXkpIHtcbiAgICB0aGlzLmZ1biA9IGZ1bjtcbiAgICB0aGlzLmFycmF5ID0gYXJyYXk7XG59XG5JdGVtLnByb3RvdHlwZS5ydW4gPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5mdW4uYXBwbHkobnVsbCwgdGhpcy5hcnJheSk7XG59O1xucHJvY2Vzcy50aXRsZSA9ICdicm93c2VyJztcbnByb2Nlc3MuYnJvd3NlciA9IHRydWU7XG5wcm9jZXNzLmVudiA9IHt9O1xucHJvY2Vzcy5hcmd2ID0gW107XG5wcm9jZXNzLnZlcnNpb24gPSAnJzsgLy8gZW1wdHkgc3RyaW5nIHRvIGF2b2lkIHJlZ2V4cCBpc3N1ZXNcbnByb2Nlc3MudmVyc2lvbnMgPSB7fTtcblxuZnVuY3Rpb24gbm9vcCgpIHt9XG5cbnByb2Nlc3Mub24gPSBub29wO1xucHJvY2Vzcy5hZGRMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLm9uY2UgPSBub29wO1xucHJvY2Vzcy5vZmYgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUFsbExpc3RlbmVycyA9IG5vb3A7XG5wcm9jZXNzLmVtaXQgPSBub29wO1xucHJvY2Vzcy5wcmVwZW5kTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5wcmVwZW5kT25jZUxpc3RlbmVyID0gbm9vcDtcblxucHJvY2Vzcy5saXN0ZW5lcnMgPSBmdW5jdGlvbiAobmFtZSkgeyByZXR1cm4gW10gfVxuXG5wcm9jZXNzLmJpbmRpbmcgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5iaW5kaW5nIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5cbnByb2Nlc3MuY3dkID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gJy8nIH07XG5wcm9jZXNzLmNoZGlyID0gZnVuY3Rpb24gKGRpcikge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5jaGRpciBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xucHJvY2Vzcy51bWFzayA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gMDsgfTtcbiIsIu+7vyd1c2Ugc3RyaWN0J1xyXG5cclxudmFyIFBsYXllciA9IHJlcXVpcmUoJy4uL2RuZC9wbGF5ZXIuanMnKVxyXG52YXIgTnBjID0gcmVxdWlyZSgnLi4vZG5kL25wYy5qcycpXHJcbnZhciBWZWhpY2xlID0gcmVxdWlyZSgnLi4vZG5kL3ZlaGljbGUuanMnKVxyXG5cclxudmFyIHBsYXllcnMgPSBbXVxyXG52YXIgbnBjcyA9IFtdXHJcbnZhciB2ZWhpY2xlcyA9IFtdXHJcblxyXG52YXIgcGxheWVyQnlJZCA9IGZ1bmN0aW9uIChpZCkge1xyXG4gICAgdmFyIHBsYXllciA9IG51bGxcclxuXHJcbiAgICBpZiAoVXRpbHMuaXNOdW1lcmljKGlkKSkge1xyXG4gICAgICAgIHBsYXllciA9IHBsYXllcnMuZmlsdGVyKChhKSA9PiBhLmlkID09PSBpZClcclxuICAgICAgICBpZiAocGxheWVyLmxlbmd0aCA+IDApXHJcbiAgICAgICAgICAgIHJldHVybiBwbGF5ZXJbMF1cclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gcGxheWVyXHJcbn1cclxuXHJcbnZhciBucGNCeUlkID0gZnVuY3Rpb24gKGlkKSB7XHJcbiAgICB2YXIgbnBjID0gbnVsbDtcclxuXHJcbiAgICBpZiAoVXRpbHMuaXNOdW1lcmljKGlkKSkge1xyXG4gICAgICAgIG5wYyA9IG5wY3MuZmlsdGVyKChhKSA9PiBhLmlkID09PSBpZClcclxuICAgICAgICBpZiAobnBjLmxlbmd0aCA+IDApXHJcbiAgICAgICAgICAgIHJldHVybiBucGNbMF1cclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gbnBjXHJcbn1cclxuXHJcbnZhciB2ZWhpY2xlQnlJZCA9IGZ1bmN0aW9uIChpZCkge1xyXG4gICAgdmFyIHZlaGljbGUgPSBudWxsO1xyXG5cclxuICAgIGlmIChVdGlscy5pc051bWVyaWMoaWQpKSB7XHJcbiAgICAgICAgdmVoaWNsZSA9IHZlaGljbGVzLmZpbHRlcigoYSkgPT4gYS5pZCA9PT0gaWQpXHJcbiAgICAgICAgaWYgKHZlaGljbGUubGVuZ3RoID4gMClcclxuICAgICAgICAgICAgcmV0dXJuIHZlaGljbGVbMF1cclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gdmVoaWNsZVxyXG59XHJcblxyXG52YXIgYWRkTnBjID0gZnVuY3Rpb24gKG5wYykge1xyXG4gICAgbnBjcy5wdXNoKG5wYylcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMucHVsbCA9IChkYXRhLCBmcmVzaCkgPT4ge1xyXG4gICAgcGxheWVycy5sZW5ndGggPSAwXHJcbiAgICBucGNzLmxlbmd0aCA9IDBcclxuICAgIHZlaGljbGVzLmxlbmd0aCA9IDBcclxuXHJcbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IGRhdGEucGxheWVycy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICB2YXIgcCA9IG5ldyBQbGF5ZXIoKVxyXG4gICAgICAgIHAucGFyc2UoZGF0YS5wbGF5ZXJzW2ldKVxyXG4gICAgICAgIHBsYXllcnMucHVzaChwKVxyXG4gICAgfVxyXG5cclxuICAgIGZvciAodmFyIGkgPSAwLCBsID0gZGF0YS5ucGNzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xyXG4gICAgICAgIHZhciBuID0gbmV3IE5wYygpXHJcbiAgICAgICAgbi5wYXJzZShkYXRhLm5wY3NbaV0pXHJcbiAgICAgICAgbnBjcy5wdXNoKG4pXHJcbiAgICB9XHJcblxyXG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSBkYXRhLnZlaGljbGVzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xyXG4gICAgICAgIHZhciB2ID0gbmV3IFZlaGljbGUoKVxyXG4gICAgICAgIHYucGFyc2UoZGF0YS52ZWhpY2xlc1tpXSlcclxuICAgICAgICB2ZWhpY2xlcy5wdXNoKHYpXHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGZyZXNoKSB7XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBucGNzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xyXG4gICAgICAgICAgICBpZiAobnBjc1tpXS5jb21wYW5pb25Ubykge1xyXG4gICAgICAgICAgICAgICAgYWRkQ29tcGFuaW9uVG8obnBjc1tpXS5pZCwgbnBjc1tpXS5jb21wYW5pb25UbylcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBpZiAoZnJlc2gpIHB1c2goKVxyXG59XHJcblxyXG52YXIgYWRkQ29tcGFuaW9uVG8gPSBmdW5jdGlvbiAoY29tcGFuaW9uSWQsIG5wY05hbWUpIHtcclxuICAgIGZvciAodmFyIGkgPSAwLCBsID0gcGxheWVycy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICBpZiAocGxheWVyc1tpXS5uYW1lID09PSBucGNOYW1lKSB7XHJcbiAgICAgICAgICAgIHBsYXllcnNbaV0uY29tcGFuaW9ucy5wdXNoKGNvbXBhbmlvbklkKVxyXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IG5wY3MubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XHJcbiAgICAgICAgaWYgKG5wY3NbaV0ubmFtZSA9PT0gbnBjTmFtZSkge1xyXG4gICAgICAgICAgICBucGNzW2ldLmNvbXBhbmlvbnMucHVzaChjb21wYW5pb25JZClcclxuICAgICAgICAgICAgcmV0dXJuIHRydWVcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGZhbHNlXHJcbn1cclxuXHJcbnZhciBwdXNoID0gKCkgPT4ge1xyXG4gICAgdmFyIG91dCA9IHtcclxuICAgICAgICBucGNzOiBbXSxcclxuICAgICAgICBwbGF5ZXJzOiBbXSxcclxuICAgICAgICB2ZWhpY2xlczogW11cclxuICAgIH1cclxuXHJcbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IG5wY3MubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XHJcbiAgICAgICAgb3V0Lm5wY3MucHVzaChucGNzW2ldLnNlcmlhbGl6ZSgpKVxyXG4gICAgfVxyXG5cclxuICAgIGZvciAodmFyIGkgPSAwLCBsID0gcGxheWVycy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICBvdXQucGxheWVycy5wdXNoKHBsYXllcnNbaV0uc2VyaWFsaXplKCkpXHJcbiAgICB9XHJcblxyXG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSB2ZWhpY2xlcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICBvdXQudmVoaWNsZXMucHVzaCh2ZWhpY2xlc1tpXS5zZXJpYWxpemUoKSlcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gb3V0XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzLnB1c2ggPSBwdXNoXHJcblxyXG5tb2R1bGUuZXhwb3J0cy5yZXNldCA9ICgpID0+IHsgfVxyXG5cclxubW9kdWxlLmV4cG9ydHMuY2hhcnNCeVN0YXRlID0gKGN1clN0YXRlLCBjYWxsYmFjaykgPT4ge1xyXG4gICAgaWYgKFV0aWxzLmlzRnVuY3Rpb24oY2FsbGJhY2spKSB7XHJcbiAgICAgICAgdmFyIG91dHB1dCA9IFtdXHJcblxyXG4gICAgICAgIGlmIChjdXJTdGF0ZSA9PT0gQ2hhcmFjdGVyU3RhdGUuSWRsZSkge1xyXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IHZlaGljbGVzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xyXG4gICAgICAgICAgICAgICAgb3V0cHV0LnB1c2godmVoaWNsZXNbaV0pXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gcGxheWVycy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICAgICAgaWYgKHBsYXllcnNbaV0uc3RhdGUgPT09IGN1clN0YXRlKVxyXG4gICAgICAgICAgICAgICAgb3V0cHV0LnB1c2gocGxheWVyc1tpXSlcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gbnBjcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICAgICAgaWYgKG5wY3NbaV0uc3RhdGUgPT09IGN1clN0YXRlKVxyXG4gICAgICAgICAgICAgICAgb3V0cHV0LnB1c2gobnBjc1tpXSlcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIGlmIGluIGFuIGVuY291bnRlciwgc29ydCBieSBpbml0aWF0aXZlIG9yZGVyXHJcbiAgICAgICAgaWYgKGN1clN0YXRlID09PSBDaGFyYWN0ZXJTdGF0ZS5FbmNvdW50ZXIpIHtcclxuICAgICAgICAgICAgb3V0cHV0LnNvcnQoZnVuY3Rpb24gKGEsIGIpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBiLmluaXRpYXRpdmUgLSBhLmluaXRpYXRpdmU7XHJcbiAgICAgICAgICAgIH0pXHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IG91dHB1dC5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICAgICAgY2FsbGJhY2suY2FsbChvdXRwdXRbaV0pXHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cy51cGRhdGVQbGF5ZXIgPSAoaWQsIGFjdGlvbiwgcGFyYW1zKSA9PiB7XHJcbiAgICB2YXIgcGxheWVyID0gcGxheWVyQnlJZChpZClcclxuICAgIGlmICghcGxheWVyKSByZXR1cm5cclxuXHJcbiAgICBzd2l0Y2ggKGFjdGlvbikge1xyXG4gICAgICAgIGNhc2UgQ2hhcmFjdGVyQWN0aW9uLkluaXRpYXRpdmU6XHJcbiAgICAgICAgICAgIHBsYXllci5hcHBseUluaXRpYXRpdmUocGFyYW1zWzBdKVxyXG4gICAgICAgICAgICBpZiAocGxheWVyLmNvbXBhbmlvbnMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBwbGF5ZXIuY29tcGFuaW9ucy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgYyA9IG5wY0J5SWQocGxheWVyLmNvbXBhbmlvbnNbaV0pXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGMpIGMuYXBwbHlJbml0aWF0aXZlKHBsYXllci5pbml0aWF0aXZlKVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGJyZWFrXHJcbiAgICAgICAgY2FzZSBDaGFyYWN0ZXJBY3Rpb24uTGVhdmU6XHJcbiAgICAgICAgICAgIHBsYXllci5sZWF2ZUVuY291bnRlcigpXHJcbiAgICAgICAgICAgIGlmIChwbGF5ZXIuY29tcGFuaW9ucy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IHBsYXllci5jb21wYW5pb25zLmxlbmd0aDsgaSA8IGw7IGkrKykge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBjID0gbnBjQnlJZChwbGF5ZXIuY29tcGFuaW9uc1tpXSlcclxuICAgICAgICAgICAgICAgICAgICBpZiAoYykgYy5sZWF2ZUVuY291bnRlcigpXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgYnJlYWtcclxuICAgICAgICBjYXNlIENoYXJhY3RlckFjdGlvbi5SZXZpdmU6XHJcbiAgICAgICAgICAgIHBsYXllci5yZXZpdmUoKVxyXG4gICAgICAgICAgICBicmVha1xyXG4gICAgICAgIGNhc2UgQ2hhcmFjdGVyQWN0aW9uLkRpZTpcclxuICAgICAgICAgICAgcGxheWVyLmRpZSgpXHJcbiAgICAgICAgICAgIGJyZWFrXHJcbiAgICAgICAgY2FzZSBDaGFyYWN0ZXJBY3Rpb24uU3BlbGw6XHJcbiAgICAgICAgICAgIHBsYXllci51c2VTcGVsbChwYXJhbXNbMF0sIHBhcmFtc1sxXSlcclxuICAgICAgICAgICAgYnJlYWtcclxuICAgICAgICBjYXNlIENoYXJhY3RlckFjdGlvbi5SZXN0OlxyXG4gICAgICAgICAgICBwbGF5ZXIuYXBwbHlSZXN0KClcclxuICAgICAgICAgICAgYnJlYWtcclxuICAgICAgICBjYXNlIENoYXJhY3RlckFjdGlvbi5Db25jZW50cmF0ZTpcclxuICAgICAgICAgICAgcGxheWVyLmNvbmNlbnRyYXRlKClcclxuICAgICAgICAgICAgYnJlYWtcclxuICAgICAgICBjYXNlIENoYXJhY3RlckFjdGlvbi5Ub2dnbGU6XHJcbiAgICAgICAgICAgIHBsYXllci50b2dnbGUoKVxyXG4gICAgICAgICAgICBicmVha1xyXG4gICAgfVxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cy51cGRhdGVOcGMgPSAoaWQsIGFjdGlvbiwgcGFyYW1zKSA9PiB7XHJcbiAgICB2YXIgY3VycmVudE5wYyA9IG5wY0J5SWQoaWQpXHJcbiAgICBpZiAoIWN1cnJlbnROcGMpIHJldHVyblxyXG5cclxuICAgIHN3aXRjaCAoYWN0aW9uKSB7XHJcbiAgICAgICAgY2FzZSBDaGFyYWN0ZXJBY3Rpb24uRGFtYWdlOlxyXG4gICAgICAgICAgICBjdXJyZW50TnBjLmFwcGx5RGFtYWdlKHBhcmFtc1swXSlcclxuICAgICAgICAgICAgYnJlYWtcclxuICAgICAgICBjYXNlIENoYXJhY3RlckFjdGlvbi5Jbml0aWF0aXZlOlxyXG4gICAgICAgICAgICBpZiAoY3VycmVudE5wYy50ZW1wbGF0ZSkge1xyXG4gICAgICAgICAgICAgICAgdmFyIG4gPSBjdXJyZW50TnBjLmNsb25lKClcclxuICAgICAgICAgICAgICAgIGFkZE5wYyhuKVxyXG4gICAgICAgICAgICAgICAgY3VycmVudE5wYyA9IG5cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBjdXJyZW50TnBjLnJvbGxJbml0aWF0aXZlKClcclxuICAgICAgICAgICAgaWYgKGN1cnJlbnROcGMuY29tcGFuaW9ucy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IGN1cnJlbnROcGMuY29tcGFuaW9ucy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgYyA9IG5wY0J5SWQoY3VycmVudE5wYy5jb21wYW5pb25zW2ldKVxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChjKSBjLmFwcGx5SW5pdGlhdGl2ZShjdXJyZW50TnBjLmluaXRpYXRpdmUpXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgYnJlYWtcclxuICAgICAgICBjYXNlIENoYXJhY3RlckFjdGlvbi5MZWF2ZTpcclxuICAgICAgICAgICAgY3VycmVudE5wYy5sZWF2ZUVuY291bnRlcigpXHJcbiAgICAgICAgICAgIGlmIChjdXJyZW50TnBjLmNvbXBhbmlvbnMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBjdXJyZW50TnBjLmNvbXBhbmlvbnMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGMgPSBucGNCeUlkKGN1cnJlbnROcGMuY29tcGFuaW9uc1tpXSlcclxuICAgICAgICAgICAgICAgICAgICBpZiAoYykgYy5sZWF2ZUVuY291bnRlcigpXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgYnJlYWtcclxuICAgICAgICBjYXNlIENoYXJhY3RlckFjdGlvbi5SZXZpdmU6XHJcbiAgICAgICAgICAgIGN1cnJlbnROcGMucmV2aXZlKClcclxuICAgICAgICAgICAgYnJlYWtcclxuICAgICAgICBjYXNlIENoYXJhY3RlckFjdGlvbi5EaWU6XHJcbiAgICAgICAgICAgIGN1cnJlbnROcGMuZGllKClcclxuICAgICAgICAgICAgYnJlYWtcclxuICAgICAgICBjYXNlIENoYXJhY3RlckFjdGlvbi5TcGVsbDpcclxuICAgICAgICAgICAgY3VycmVudE5wYy51c2VTcGVsbChwYXJhbXNbMF0sIHBhcmFtc1sxXSlcclxuICAgICAgICAgICAgYnJlYWtcclxuICAgICAgICBjYXNlIENoYXJhY3RlckFjdGlvbi5SZXN0OlxyXG4gICAgICAgICAgICBjdXJyZW50TnBjLmFwcGx5UmVzdCgpXHJcbiAgICAgICAgICAgIGJyZWFrXHJcbiAgICAgICAgY2FzZSBDaGFyYWN0ZXJBY3Rpb24uQ29uY2VudHJhdGU6XHJcbiAgICAgICAgICAgIGN1cnJlbnROcGMuY29uY2VudHJhdGUoKVxyXG4gICAgICAgICAgICBicmVha1xyXG4gICAgICAgIGNhc2UgQ2hhcmFjdGVyQWN0aW9uLlRvZ2dsZTpcclxuICAgICAgICAgICAgY3VycmVudE5wYy50b2dnbGUoKVxyXG4gICAgICAgICAgICBicmVha1xyXG4gICAgfVxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cy51cGRhdGVWZWhpY2xlID0gKGlkLCBhY3Rpb24sIHBhcmFtcykgPT4ge1xyXG4gICAgdmFyIHZlaGljbGUgPSB2ZWhpY2xlQnlJZChpZClcclxuICAgIGlmICghdmVoaWNsZSkgcmV0dXJuXHJcblxyXG4gICAgc3dpdGNoIChhY3Rpb24pIHtcclxuICAgICAgICBjYXNlIENoYXJhY3RlckFjdGlvbi5EYW1hZ2U6XHJcbiAgICAgICAgICAgIHZlaGljbGUuYXBwbHlEYW1hZ2UocGFyYW1zWzBdLCBwYXJhbXNbMV0pXHJcbiAgICAgICAgICAgIGJyZWFrXHJcbiAgICAgICAgY2FzZSBDaGFyYWN0ZXJBY3Rpb24uVG9nZ2xlOlxyXG4gICAgICAgICAgICB2ZWhpY2xlLnRvZ2dsZSgpXHJcbiAgICAgICAgICAgIGJyZWFrXHJcbiAgICB9XHJcbn0iLCLvu78ndXNlIHN0cmljdCdcclxuXHJcbmNvbnN0IGF4aW9zID0gcmVxdWlyZSgnYXhpb3MnKVxyXG5jb25zdCBzdG9yYWdlS2V5ID0gJ09zc2FyaWFTZXNzaW9uTmluZSdcclxuXHJcbnZhciBzYXZlID0gKGRhdGEpID0+IGxvY2FsU3RvcmFnZS5zZXRJdGVtKHN0b3JhZ2VLZXksIGRhdGEpXHJcblxyXG52YXIgbGFzdFVzZWRJZCA9IDBcclxuXHJcbnZhciBmZXRjaEpzb24gPSAoKSA9PiB7XHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgICAgIGF4aW9zLmdldChnbG9iYWwuRGF0YUZpbGUpXHJcbiAgICAgICAgICAgIC50aGVuKGZ1bmN0aW9uIChyZXNwb25zZSkge1xyXG4gICAgICAgICAgICAgICAgc2F2ZShKU09OLnN0cmluZ2lmeShyZXNwb25zZS5kYXRhKSk7XHJcbiAgICAgICAgICAgICAgICByZXNvbHZlKFtyZXNwb25zZS5kYXRhLCB0cnVlXSlcclxuICAgICAgICAgICAgfSlcclxuICAgICAgICAgICAgLmNhdGNoKGZ1bmN0aW9uIChlcnJvcikge1xyXG4gICAgICAgICAgICAgICAgcmVqZWN0KGVycm9yKVxyXG4gICAgICAgICAgICB9KVxyXG4gICAgfSlcclxufVxyXG5cclxudmFyIHB1bGxJbm5lciA9IChyYXcpID0+IHtcclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgcmVzb2x2ZShbSlNPTi5wYXJzZShyYXcpLCBmYWxzZV0pXHJcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgICAgICAgIHJlamVjdChlcnIpXHJcbiAgICAgICAgfVxyXG4gICAgfSlcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMucHVsbCA9ICgpID0+IHtcclxuICAgIHZhciBmcm9tU3RvcmFnZSA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKHN0b3JhZ2VLZXkpO1xyXG4gICAgcmV0dXJuIGZyb21TdG9yYWdlID9cclxuICAgICAgICBwdWxsSW5uZXIoZnJvbVN0b3JhZ2UpIDpcclxuICAgICAgICBmZXRjaEpzb24oKVxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cy5wdXNoID0gKGRhdGEpID0+IHtcclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgc2F2ZShKU09OLnN0cmluZ2lmeShkYXRhKSlcclxuICAgICAgICAgICAgcmVzb2x2ZSgpXHJcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgICAgICAgIHJlamVjdChlcnIpXHJcbiAgICAgICAgfVxyXG4gICAgfSlcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMucmVzZXQgPSAoKSA9PiB7XHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKHN0b3JhZ2VLZXkpXHJcbiAgICAgICAgICAgIHJlc29sdmUoKVxyXG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xyXG4gICAgICAgICAgICByZWplY3QoZXJyKVxyXG4gICAgICAgIH1cclxuICAgIH0pXHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzLmFzc2lnbklkID0gKCkgPT4ge1xyXG4gICAgbGFzdFVzZWRJZCsrXHJcbiAgICByZXR1cm4gbGFzdFVzZWRJZFxyXG59XHJcbiIsIu+7vyd1c2Ugc3RyaWN0J1xyXG5cclxudmFyIEVudGl0aWVzID0gcmVxdWlyZSgnLi9lbnRpdGllcy5qcycpXHJcbnZhciBTdG9yYWdlID0gcmVxdWlyZSgnLi9zdG9yYWdlLmpzJylcclxuXHJcbnZhciBhY3RpdmUgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYWN0aXZlJylcclxudmFyIGluYWN0aXZlID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2luYWN0aXZlJylcclxudmFyIGRlYWRndXlzID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RlYWRndXlzJylcclxuXHJcbnZhciB1cGRhdGUgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICBTdG9yYWdlLnB1c2goRW50aXRpZXMucHVzaCgpKS50aGVuKCgpID0+IHtcclxuICAgICAgICByZW5kZXIoKVxyXG4gICAgfSlcclxufVxyXG5cclxudmFyIHJlbmRlciA9IGZ1bmN0aW9uICgpIHtcclxuICAgIGFjdGl2ZS5pbm5lckhUTUwgPSAnJ1xyXG4gICAgaW5hY3RpdmUuaW5uZXJIVE1MID0gJydcclxuICAgIGRlYWRndXlzLmlubmVySFRNTCA9ICcnXHJcblxyXG4gICAgRW50aXRpZXMuY2hhcnNCeVN0YXRlKENoYXJhY3RlclN0YXRlLkVuY291bnRlciwgZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHZhciByb3cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCd0cicpXHJcbiAgICAgICAgdmFyIGNlbGwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCd0ZCcpXHJcblxyXG4gICAgICAgIGNlbGwuaW5uZXJIVE1MID0gdGhpcy5yZW5kZXIoKVxyXG5cclxuICAgICAgICByb3cuYXBwZW5kQ2hpbGQoY2VsbClcclxuICAgICAgICBhY3RpdmUuYXBwZW5kQ2hpbGQocm93KVxyXG4gICAgfSlcclxuXHJcbiAgICBFbnRpdGllcy5jaGFyc0J5U3RhdGUoQ2hhcmFjdGVyU3RhdGUuSWRsZSwgZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHZhciByb3cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCd0cicpXHJcbiAgICAgICAgdmFyIGNlbGwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCd0ZCcpXHJcblxyXG4gICAgICAgIGNlbGwuaW5uZXJIVE1MID0gdGhpcy5yZW5kZXIoKVxyXG5cclxuICAgICAgICByb3cuYXBwZW5kQ2hpbGQoY2VsbClcclxuICAgICAgICBpbmFjdGl2ZS5hcHBlbmRDaGlsZChyb3cpXHJcbiAgICB9KVxyXG5cclxuICAgIEVudGl0aWVzLmNoYXJzQnlTdGF0ZShDaGFyYWN0ZXJTdGF0ZS5EZWFkLCBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdmFyIHJvdyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3RyJylcclxuICAgICAgICB2YXIgY2VsbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3RkJylcclxuXHJcbiAgICAgICAgY2VsbC5pbm5lckhUTUwgPSB0aGlzLnJlbmRlcigpXHJcblxyXG4gICAgICAgIHJvdy5hcHBlbmRDaGlsZChjZWxsKVxyXG4gICAgICAgIGRlYWRndXlzLmFwcGVuZENoaWxkKHJvdylcclxuICAgIH0pXHJcbn1cclxuXHJcbnZhciBhZGRMaXN0ZW5lciA9IGZ1bmN0aW9uICgpIHtcclxuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZnVuY3Rpb24gKGUpIHtcclxuICAgICAgICBpZiAoZS50YXJnZXQpIHtcclxuICAgICAgICAgICAgdmFyIGRvVXBkYXRlID0gdHJ1ZTtcclxuICAgICAgICAgICAgdmFyIGlkID0gcGFyc2VJbnQoZS50YXJnZXQuZ2V0QXR0cmlidXRlKCdkYXRhLWlkJykpXHJcblxyXG4gICAgICAgICAgICBzd2l0Y2ggKGUudGFyZ2V0LmNsYXNzTmFtZSkge1xyXG4gICAgICAgICAgICAgICAgY2FzZSAnaGFyZF9yZXNldCc6XHJcbiAgICAgICAgICAgICAgICAgICAgZG9VcGRhdGUgPSBmYWxzZVxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChjb25maXJtKCdBcmUgeW91IHN1cmU/IFRoaXMgY2Fubm90IGJlIHVuZG9uZS4nKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgY2VsbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdtYWluLWNvbnRlbnQnKVxyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgU3RvcmFnZS5yZXNldCgpLnRoZW4oKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgRW50aXRpZXMucmVzZXQoKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2VsbC5pbm5lckhUTUwgPSAncmVzZXR0aW5nIHVwIGluIGhlcmUnXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHdpbmRvdy5sb2NhdGlvbi5yZWxvYWQoKSwgNjAwKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBicmVha1xyXG4gICAgICAgICAgICAgICAgY2FzZSAncGxheWVyX2luaXRpYXRpdmUnOlxyXG4gICAgICAgICAgICAgICAgICAgIHZhciBpbml0aWF0aXZlID0gcGFyc2VJbnQoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BsYXllcl9pbml0aWF0aXZlXycgKyBpZCkudmFsdWUpXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKFV0aWxzLmlzSW50ZWdlcihpbml0aWF0aXZlKSkgRW50aXRpZXMudXBkYXRlUGxheWVyKGlkLCBDaGFyYWN0ZXJBY3Rpb24uSW5pdGlhdGl2ZSwgW2luaXRpYXRpdmVdKVxyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrXHJcbiAgICAgICAgICAgICAgICBjYXNlICdwbGF5ZXJfbGVhdmUnOlxyXG4gICAgICAgICAgICAgICAgICAgIEVudGl0aWVzLnVwZGF0ZVBsYXllcihpZCwgQ2hhcmFjdGVyQWN0aW9uLkxlYXZlKVxyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgY2FzZSAncGxheWVyX3Jldml2ZSc6XHJcbiAgICAgICAgICAgICAgICAgICAgRW50aXRpZXMudXBkYXRlUGxheWVyKGlkLCBDaGFyYWN0ZXJBY3Rpb24uUmV2aXZlKVxyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrXHJcbiAgICAgICAgICAgICAgICBjYXNlICdwbGF5ZXJfZGllJzpcclxuICAgICAgICAgICAgICAgICAgICBFbnRpdGllcy51cGRhdGVQbGF5ZXIoaWQsIENoYXJhY3RlckFjdGlvbi5EaWUpXHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWtcclxuICAgICAgICAgICAgICAgIGNhc2UgJ3BsYXllcl9jb25jZW50cmF0ZSc6XHJcbiAgICAgICAgICAgICAgICAgICAgRW50aXRpZXMudXBkYXRlUGxheWVyKGlkLCBDaGFyYWN0ZXJBY3Rpb24uQ29uY2VudHJhdGUpXHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWtcclxuICAgICAgICAgICAgICAgIGNhc2UgJ3BsYXllcl90b2dnbGUnOlxyXG4gICAgICAgICAgICAgICAgICAgIEVudGl0aWVzLnVwZGF0ZVBsYXllcihpZCwgQ2hhcmFjdGVyQWN0aW9uLlRvZ2dsZSlcclxuICAgICAgICAgICAgICAgICAgICBicmVha1xyXG4gICAgICAgICAgICAgICAgY2FzZSAnbnBjX2luaXRpYXRpdmUnOlxyXG4gICAgICAgICAgICAgICAgICAgIEVudGl0aWVzLnVwZGF0ZU5wYyhpZCwgQ2hhcmFjdGVyQWN0aW9uLkluaXRpYXRpdmUpXHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWtcclxuICAgICAgICAgICAgICAgIGNhc2UgJ25wY19kYW1hZ2UnOlxyXG4gICAgICAgICAgICAgICAgICAgIHZhciBkYW1hZ2UgPSBwYXJzZUludChkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbnBjX2RhbWFnZV8nICsgaWQpLnZhbHVlKVxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChVdGlscy5pc0ludGVnZXIoZGFtYWdlKSkgRW50aXRpZXMudXBkYXRlTnBjKGlkLCBDaGFyYWN0ZXJBY3Rpb24uRGFtYWdlLCBbZGFtYWdlXSlcclxuICAgICAgICAgICAgICAgICAgICBicmVha1xyXG4gICAgICAgICAgICAgICAgY2FzZSAnbnBjX2xlYXZlJzpcclxuICAgICAgICAgICAgICAgICAgICBFbnRpdGllcy51cGRhdGVOcGMoaWQsIENoYXJhY3RlckFjdGlvbi5MZWF2ZSlcclxuICAgICAgICAgICAgICAgICAgICBicmVha1xyXG4gICAgICAgICAgICAgICAgY2FzZSAnbnBjX3Jldml2ZSc6XHJcbiAgICAgICAgICAgICAgICAgICAgRW50aXRpZXMudXBkYXRlTnBjKGlkLCBDaGFyYWN0ZXJBY3Rpb24uUmV2aXZlKVxyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrXHJcbiAgICAgICAgICAgICAgICBjYXNlICducGNfZGllJzpcclxuICAgICAgICAgICAgICAgICAgICBFbnRpdGllcy51cGRhdGVOcGMoaWQsIENoYXJhY3RlckFjdGlvbi5EaWUpXHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWtcclxuICAgICAgICAgICAgICAgIGNhc2UgJ25wY19yZXN0JzpcclxuICAgICAgICAgICAgICAgICAgICBFbnRpdGllcy51cGRhdGVOcGMoaWQsIENoYXJhY3RlckFjdGlvbi5SZXN0KVxyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrXHJcbiAgICAgICAgICAgICAgICBjYXNlICducGNfc3BlbGxfc2xvdCc6XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHNwZWxsU2xvdElkID0gcGFyc2VJbnQoZS50YXJnZXQuZ2V0QXR0cmlidXRlKCdkYXRhLWxldmVsLWlkJykpXHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGNoZWNrZWQgPSBlLnRhcmdldC5jaGVja2VkXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKFV0aWxzLmlzSW50ZWdlcihzcGVsbFNsb3RJZCkpIEVudGl0aWVzLnVwZGF0ZU5wYyhpZCwgQ2hhcmFjdGVyQWN0aW9uLlNwZWxsLCBbc3BlbGxTbG90SWQsIGNoZWNrZWRdKVxyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrXHJcbiAgICAgICAgICAgICAgICBjYXNlICducGNfY29uY2VudHJhdGUnOlxyXG4gICAgICAgICAgICAgICAgICAgIEVudGl0aWVzLnVwZGF0ZU5wYyhpZCwgQ2hhcmFjdGVyQWN0aW9uLkNvbmNlbnRyYXRlKVxyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrXHJcbiAgICAgICAgICAgICAgICBjYXNlICducGNfdG9nZ2xlJzpcclxuICAgICAgICAgICAgICAgICAgICBFbnRpdGllcy51cGRhdGVOcGMoaWQsIENoYXJhY3RlckFjdGlvbi5Ub2dnbGUpXHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWtcclxuICAgICAgICAgICAgICAgIGNhc2UgJ3ZlaGljbGVfdG9nZ2xlJzpcclxuICAgICAgICAgICAgICAgICAgICBFbnRpdGllcy51cGRhdGVWZWhpY2xlKGlkLCBDaGFyYWN0ZXJBY3Rpb24uVG9nZ2xlKVxyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrXHJcbiAgICAgICAgICAgICAgICBjYXNlICdjb21wb25lbnRfZGFtYWdlJzpcclxuICAgICAgICAgICAgICAgICAgICB2YXIgdmVoaWNsZUlkID0gcGFyc2VJbnQoZS50YXJnZXQuZ2V0QXR0cmlidXRlKCdkYXRhLXZlaGljbGUtaWQnKSlcclxuICAgICAgICAgICAgICAgICAgICB2YXIgZGFtYWdlID0gcGFyc2VJbnQoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NvbXBvbmVudF9kYW1hZ2VfJyArIGlkKS52YWx1ZSlcclxuICAgICAgICAgICAgICAgICAgICBpZiAoVXRpbHMuaXNJbnRlZ2VyKGRhbWFnZSkpIEVudGl0aWVzLnVwZGF0ZVZlaGljbGUodmVoaWNsZUlkLCBDaGFyYWN0ZXJBY3Rpb24uRGFtYWdlLCBbaWQsIGRhbWFnZV0pXHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWtcclxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICAgICAgZG9VcGRhdGUgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgICAgICBicmVha1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBpZiAoZG9VcGRhdGUpIHVwZGF0ZSgpXHJcbiAgICAgICAgfVxyXG4gICAgfSlcclxufVxyXG5cclxudmFyIHJ1biA9IGZ1bmN0aW9uICgpIHtcclxuICAgIGFkZExpc3RlbmVyKClcclxuXHJcbiAgICBTdG9yYWdlLnB1bGwoKS50aGVuKChbZGF0YSwgZnJlc2hdKSA9PiB7XHJcbiAgICAgICAgRW50aXRpZXMucHVsbChkYXRhLCBmcmVzaClcclxuICAgICAgICByZW5kZXIoKVxyXG4gICAgfSlcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSB7XHJcbiAgICBydW46IHJ1blxyXG59Iiwi77u/J3VzZSBzdHJpY3QnXHJcblxyXG52YXIgU3RvcmFnZSA9IHJlcXVpcmUoJy4uL2FwcC9zdG9yYWdlLmpzJylcclxuXHJcbnZhciBjb21wb25lbnQgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICB0aGlzLmlkID0gMFxyXG4gICAgdGhpcy52ZWhpY2xlSWQgPSAwXHJcbiAgICB0aGlzLm5hbWUgPSBcIlwiXHJcbiAgICB0aGlzLmhlYWx0aCA9IDBcclxuICAgIHRoaXMubWF4SGVhbHRoID0gMFxyXG4gICAgdGhpcy5hcm1vciA9IDBcclxuICAgIHRoaXMuc3BlZWQgPSAwXHJcbiAgICB0aGlzLmRlY3JlbWVudCA9IDBcclxuICAgIHRoaXMuc3RhZ2VzID0gMFxyXG4gICAgdGhpcy50aHJlc2hvbGQgPSAwXHJcbiAgICB0aGlzLmF0dGFja1RvSGl0ID0gMFxyXG4gICAgdGhpcy5hdHRhY2tSb2xsID0gXCIxZDZcIlxyXG4gICAgdGhpcy5hdHRhY2tSYW5nZSA9IFwiMTIwLzMyMFwiXHJcbiAgICB0aGlzLmF0dGFja0RhbWFnZSA9IFwicGllcmNpbmdcIlxyXG4gICAgdGhpcy52aXNpYmxlID0gdHJ1ZVxyXG59XHJcblxyXG5jb21wb25lbnQucHJvdG90eXBlLnBhcnNlID0gZnVuY3Rpb24gKGpzb24pIHtcclxuICAgIGlmICghanNvbikgcmV0dXJuXHJcblxyXG4gICAgaWYgKGpzb24uaWQgJiYgVXRpbHMuaXNOdW1lcmljKGpzb24uaWQpKSB7XHJcbiAgICAgICAgdGhpcy5pZCA9IGpzb24uaWRcclxuICAgIH1cclxuXHJcbiAgICBpZiAodGhpcy5pZCA9PT0gMCkge1xyXG4gICAgICAgIHRoaXMuaWQgPSBTdG9yYWdlLmFzc2lnbklkKClcclxuICAgIH1cclxuXHJcbiAgICBpZiAoanNvbi52ZWhpY2xlSWQgJiYgVXRpbHMuaXNOdW1lcmljKGpzb24udmVoaWNsZUlkKSkge1xyXG4gICAgICAgIHRoaXMudmVoaWNsZUlkID0ganNvbi52ZWhpY2xlSWRcclxuICAgIH1cclxuXHJcbiAgICBpZiAoanNvbi5uYW1lKSB7XHJcbiAgICAgICAgdGhpcy5uYW1lID0ganNvbi5uYW1lXHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGpzb24uaGVhbHRoICYmIFV0aWxzLmlzTnVtZXJpYyhqc29uLmhlYWx0aCkpIHtcclxuICAgICAgICB0aGlzLmhlYWx0aCA9IGpzb24uaGVhbHRoXHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGpzb24ubWF4SGVhbHRoICYmIFV0aWxzLmlzTnVtZXJpYyhqc29uLm1heEhlYWx0aCkpIHtcclxuICAgICAgICB0aGlzLm1heEhlYWx0aCA9IGpzb24ubWF4SGVhbHRoXHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGpzb24uYXJtb3IgJiYgVXRpbHMuaXNOdW1lcmljKGpzb24uYXJtb3IpKSB7XHJcbiAgICAgICAgdGhpcy5hcm1vciA9IGpzb24uYXJtb3JcclxuICAgIH1cclxuXHJcbiAgICBpZiAoanNvbi5zcGVlZCAmJiBVdGlscy5pc051bWVyaWMoanNvbi5zcGVlZCkpIHtcclxuICAgICAgICB0aGlzLnNwZWVkID0ganNvbi5zcGVlZFxyXG4gICAgfVxyXG5cclxuICAgIGlmIChqc29uLmRlY3JlbWVudCAmJiBVdGlscy5pc051bWVyaWMoanNvbi5kZWNyZW1lbnQpKSB7XHJcbiAgICAgICAgdGhpcy5kZWNyZW1lbnQgPSBqc29uLmRlY3JlbWVudFxyXG4gICAgfVxyXG5cclxuICAgIGlmIChqc29uLnN0YWdlcyAmJiBVdGlscy5pc051bWVyaWMoanNvbi5zdGFnZXMpKSB7XHJcbiAgICAgICAgdGhpcy5zdGFnZXMgPSBqc29uLnN0YWdlc1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChqc29uLnRocmVzaG9sZCAmJiBVdGlscy5pc051bWVyaWMoanNvbi50aHJlc2hvbGQpKSB7XHJcbiAgICAgICAgdGhpcy50aHJlc2hvbGQgPSBqc29uLnRocmVzaG9sZFxyXG4gICAgfVxyXG5cclxuICAgIGlmIChqc29uLmF0dGFja1RvSGl0ICYmIFV0aWxzLmlzTnVtZXJpYyhqc29uLmF0dGFja1RvSGl0KSkge1xyXG4gICAgICAgIHRoaXMuYXR0YWNrVG9IaXQgPSBqc29uLmF0dGFja1RvSGl0XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGpzb24uYXR0YWNrUm9sbCkge1xyXG4gICAgICAgIHRoaXMuYXR0YWNrUm9sbCA9IGpzb24uYXR0YWNrUm9sbFxyXG4gICAgfVxyXG5cclxuICAgIGlmIChqc29uLmF0dGFja1JhbmdlKSB7XHJcbiAgICAgICAgdGhpcy5hdHRhY2tSb2xsID0ganNvbi5hdHRhY2tSb2xsXHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGpzb24uYXR0YWNrRGFtYWdlKSB7XHJcbiAgICAgICAgdGhpcy5hdHRhY2tEYW1hZ2UgPSBqc29uLmF0dGFja0RhbWFnZVxyXG4gICAgfVxyXG5cclxuICAgIGlmIChqc29uLnZpc2libGUpIHtcclxuICAgICAgICB0aGlzLnZpc2libGUgPSBqc29uLnZpc2libGVcclxuICAgIH1cclxufVxyXG5cclxuY29tcG9uZW50LnByb3RvdHlwZS5zZXJpYWxpemUgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIGlkOiB0aGlzLmlkLFxyXG4gICAgICAgIHZlaGljbGVJZDogdGhpcy52ZWhpY2xlSWQsXHJcbiAgICAgICAgbmFtZTogdGhpcy5uYW1lLFxyXG4gICAgICAgIGhlYWx0aDogdGhpcy5oZWFsdGgsXHJcbiAgICAgICAgbWF4SGVhbHRoOiB0aGlzLm1heEhlYWx0aCxcclxuICAgICAgICBhcm1vcjogdGhpcy5hcm1vcixcclxuICAgICAgICBzcGVlZDogdGhpcy5zcGVlZCxcclxuICAgICAgICBkZWNyZW1lbnQ6IHRoaXMuZGVjcmVtZW50LFxyXG4gICAgICAgIHN0YWdlczogdGhpcy5zdGFnZXMsXHJcbiAgICAgICAgdGhyZXNob2xkOiB0aGlzLnRocmVzaG9sZCxcclxuICAgICAgICBhdHRhY2tUb0hpdDogdGhpcy5hdHRhY2tUb0hpdCxcclxuICAgICAgICBhdHRhY2tSb2xsOiB0aGlzLmF0dGFja1JvbGwsXHJcbiAgICAgICAgYXR0YWNrUmFuZ2U6IHRoaXMuYXR0YWNrUmFuZ2UsXHJcbiAgICAgICAgYXR0YWNrRGFtYWdlOiB0aGlzLmF0dGFja0RhbWFnZSxcclxuICAgICAgICB2aXNpYmxlOiB0aGlzLnZpc2libGVcclxuICAgIH1cclxufVxyXG5cclxuY29tcG9uZW50LnByb3RvdHlwZS5yZW5kZXIgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICB2YXIgb3V0ID0gJzxkaXYgY2xhc3M9XCJjb21wb25lbnRcIiBkYXRhLWlkPVwiJyArIHRoaXMuaWQgKyAnXCI+J1xyXG4gICAgb3V0ICs9ICc8ZGl2IGNsYXNzPVwiYm9sZFwiPicgKyB0aGlzLm5hbWUgKyAnPC9kaXY+J1xyXG5cclxuICAgIGlmICh0aGlzLnNwZWVkID4gMCkge1xyXG4gICAgICAgIG91dCArPSAnPGRpdj48c3BhbiBjbGFzcz1cImJvbGRcIj5TcGVlZDo8L3NwYW4+ICcgKyB0aGlzLmNhbGN1bGF0ZVNwZWVkKCkgKyAnPC9kaXY+J1xyXG4gICAgfVxyXG5cclxuICAgIG91dCArPSAnPGRpdj5IZWFsdGg6IDxzcGFuIGNsYXNzPVwiYm9sZFwiPicgKyB0aGlzLmhlYWx0aCArICc8L3NwYW4+LCBBQzogPHNwYW4gY2xhc3M9XCJib2xkXCI+JyArIHRoaXMuYXJtb3IgKyAnPC9zcGFuPjwvZGl2PidcclxuICAgIG91dCArPSAnPGRpdj48aW5wdXQgdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwiY29tcG9uZW50X2RhbWFnZVwiIHZhbHVlPVwiQXBwbHkgRGFtYWdlXCIgZGF0YS1pZD1cIicgKyB0aGlzLmlkICsgJ1wiIGRhdGEtdmVoaWNsZS1pZD1cIicgKyB0aGlzLnZlaGljbGVJZCArICdcIiAvPjxpbnB1dCB0eXBlPVwidGV4dFwiIGlkPVwiY29tcG9uZW50X2RhbWFnZV8nICsgdGhpcy5pZCArICdcIiAvPjwvZGl2PidcclxuXHJcbiAgICBpZiAodGhpcy5hdHRhY2tUb0hpdCA+IDApIHtcclxuICAgICAgICBvdXQgKz0gJzxkaXYgY2xhc3M9XCJjb21wb25lbnQtYXR0YWNrXCI+PGRpdiBjbGFzcz1cImJvbGRcIj5SYW5nZWQgV2VhcG9uIEF0dGFjazwvZGl2PidcclxuICAgICAgICBvdXQgKz0gJzxkaXY+MWQyMCArICcgKyB0aGlzLmF0dGFja1RvSGl0ICsgJyB0byBoaXQsICcgKyB0aGlzLmF0dGFja1JvbGwgKyAnPC9kaXY+J1xyXG4gICAgICAgIG91dCArPSAnPGRpdiBjbGFzcz1cIml0YWxpY1wiPicgKyB0aGlzLmF0dGFja0RhbWFnZSArICc8L2Rpdj48L2Rpdj4nXHJcbiAgICB9XHJcblxyXG4gICAgb3V0ICs9ICc8L2Rpdj4nXHJcbiAgICByZXR1cm4gb3V0XHJcbn1cclxuXHJcbmNvbXBvbmVudC5wcm90b3R5cGUuY2FsY3VsYXRlU3BlZWQgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICB2YXIgc2xvd2Rvd24gPSAwXHJcblxyXG4gICAgaWYgKHRoaXMuc3RhZ2VzID4gMCAmJiB0aGlzLmhlYWx0aCA8IHRoaXMubWF4SGVhbHRoKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuaGVhbHRoID4gMCkge1xyXG4gICAgICAgICAgICB2YXIgcG9ydGlvbiA9IE1hdGguZmxvb3IodGhpcy5tYXhIZWFsdGggLyB0aGlzLnN0YWdlcylcclxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IHRoaXMuc3RhZ2VzOyBpID4gMDsgaS0tKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAocG9ydGlvbiAqIGkgPj0gdGhpcy5oZWFsdGgpIHNsb3dkb3duICs9IHRoaXMuZGVjcmVtZW50XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBzbG93ZG93biA9IHRoaXMuc3BlZWRcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIFV0aWxzLmNsYW1wKHRoaXMuc3BlZWQgLSBzbG93ZG93biwgMCwgdGhpcy5zcGVlZClcclxufVxyXG5cclxuY29tcG9uZW50LnByb3RvdHlwZS5hcHBseURhbWFnZSA9IGZ1bmN0aW9uIChkYW1hZ2UpIHtcclxuICAgIGlmICh0aGlzLnRocmVzaG9sZCA+IDApIHtcclxuICAgICAgICBpZiAoTWF0aC5hYnMoZGFtYWdlKSA+PSB0aGlzLnRocmVzaG9sZCkgdGhpcy5oZWFsdGggLT0gZGFtYWdlXHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIHRoaXMuaGVhbHRoIC09IGRhbWFnZVxyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuaGVhbHRoID0gVXRpbHMuY2xhbXAodGhpcy5oZWFsdGgsIDAsIHRoaXMubWF4SGVhbHRoKVxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGNvbXBvbmVudCIsIu+7vyd1c2Ugc3RyaWN0J1xyXG5cclxuZ2xvYmFsLkNoYXJhY3RlclN0YXRlID0ge1xyXG4gICAgRGVhZDogJ2RlYWQnLFxyXG4gICAgSWRsZTogJ2FsaXZlJyxcclxuICAgIEVuY291bnRlcjogJ2VuY291bnRlcidcclxufVxyXG5cclxuZ2xvYmFsLkNoYXJhY3RlckFjdGlvbiA9IHtcclxuICAgIERhbWFnZTogJ2RhbWFnZScsXHJcbiAgICBEaWU6ICdkaWUnLFxyXG4gICAgSW5pdGlhdGl2ZTogJ2luaXRpYXRpdmUnLFxyXG4gICAgTGVhdmU6ICdsZWF2ZScsXHJcbiAgICBSZXZpdmU6ICdyZXZpdmUnLFxyXG4gICAgU3BlbGw6ICdzcGVsbCcsXHJcbiAgICBSZXN0OiAncmVzdCcsXHJcbiAgICBDb25jZW50cmF0ZTogJ2NvbmNlbnRyYXRlJyxcclxuICAgIFRvZ2dsZTogJ3RvZ2dsZSdcclxufVxyXG5cclxuZ2xvYmFsLkRhbWFnZVR5cGUgPSB7XHJcbiAgICBBY2lkOiAnYWNpZCcsXHJcbiAgICBCbHVkZ2VvbmluZzogJ2JsdWRnZW9uaW5nJyxcclxuICAgIENvbGQ6ICdjb2xkJyxcclxuICAgIEZpcmU6ICdmaXJlJyxcclxuICAgIEZvcmNlOiAnZm9yY2UnLFxyXG4gICAgTGlnaHRuaW5nOiAnbGlnaHRuaW5nJyxcclxuICAgIE5lY3JvdGljOiAnbmVjcm90aWMnLFxyXG4gICAgUGllcmNpbmc6ICdwaWVyY2luZycsXHJcbiAgICBQb2lzb246ICdwb2lzb24nLFxyXG4gICAgUHN5Y2hpYzogJ3BzeWNoaWMnLFxyXG4gICAgUmFkaWFudDogJ3JhZGlhbnQnLFxyXG4gICAgU2xhc2hpbmc6ICdzbGFzaGluZycsXHJcbiAgICBUaHVuZGVyOiAndGh1bmRlcidcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBudWxsIiwi77u/J3VzZSBzdHJpY3QnXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHtcclxuICAgIGQ0OiBmdW5jdGlvbiAoKSB7IHJldHVybiBVdGlscy5yYW5kb21JbnQoMSwgNCkgfSxcclxuICAgIGQ2OiBmdW5jdGlvbiAoKSB7IHJldHVybiBVdGlscy5yYW5kb21JbnQoMSwgNikgfSxcclxuICAgIGQ4OiBmdW5jdGlvbiAoKSB7IHJldHVybiBVdGlscy5yYW5kb21JbnQoMSwgOCkgfSxcclxuICAgIGQxMDogZnVuY3Rpb24gKCkgeyByZXR1cm4gVXRpbHMucmFuZG9tSW50KDEsIDEwKSB9LFxyXG4gICAgZDEyOiBmdW5jdGlvbiAoKSB7IHJldHVybiBVdGlscy5yYW5kb21JbnQoMSwgMTIpIH0sXHJcbiAgICBkMjA6IGZ1bmN0aW9uICgpIHsgcmV0dXJuIFV0aWxzLnJhbmRvbUludCgxLCAyMCkgfSxcclxuICAgIGQxMDA6IGZ1bmN0aW9uICgpIHsgcmV0dXJuIFV0aWxzLnJhbmRvbUludCgxLCAxMDApIH1cclxufVxyXG4iLCLvu78ndXNlIHN0cmljdCdcclxuXHJcbnZhciBXZWFwb24gPSByZXF1aXJlKCcuL3dlYXBvbi5qcycpXHJcbnZhciBTcGVsbCA9IHJlcXVpcmUoJy4vc3BlbGwuanMnKVxyXG52YXIgcm9sbCA9IHJlcXVpcmUoJy4uL2RuZC9kaWNlLmpzJylcclxudmFyIFN0b3JhZ2UgPSByZXF1aXJlKCcuLi9hcHAvc3RvcmFnZS5qcycpXHJcblxyXG52YXIgbnBjID0gZnVuY3Rpb24gKCkge1xyXG4gICAgdGhpcy5pZCA9IDBcclxuICAgIHRoaXMubmFtZSA9ICcnXHJcbiAgICB0aGlzLmhlYWx0aCA9IDVcclxuICAgIHRoaXMubWF4SGVhbHRoID0gNVxyXG4gICAgdGhpcy5hcm1vciA9IDEwXHJcbiAgICB0aGlzLnNwZWVkID0gMTVcclxuICAgIHRoaXMucmFjZSA9ICdIdW1hbidcclxuICAgIHRoaXMuaW5pdGlhdGl2ZSA9IDBcclxuICAgIHRoaXMud2VhcG9ucyA9IFtdXHJcbiAgICB0aGlzLnNwZWxscyA9IFtdXHJcbiAgICB0aGlzLmNvbXBhbmlvbnMgPSBbXVxyXG4gICAgdGhpcy5jb21wYW5pb25UbyA9IG51bGxcclxuICAgIHRoaXMuc3RhdGUgPSBDaGFyYWN0ZXJTdGF0ZS5JZGxlXHJcbiAgICB0aGlzLmxpbmsgPSAnJ1xyXG4gICAgdGhpcy5pbml0TW9kID0gMFxyXG4gICAgdGhpcy50ZW1wbGF0ZSA9IGZhbHNlXHJcbiAgICB0aGlzLmluc3RhbmNlID0gMFxyXG4gICAgdGhpcy5jb25jZW50cmF0aW5nID0gZmFsc2VcclxuICAgIHRoaXMudmlzaWJsZSA9IGZhbHNlXHJcbn1cclxuXHJcbm5wYy5wcm90b3R5cGUucGFyc2UgPSBmdW5jdGlvbiAoanNvbikge1xyXG4gICAgaWYgKCFqc29uKSByZXR1cm5cclxuXHJcbiAgICBpZiAoanNvbi5pZCAmJiBVdGlscy5pc051bWVyaWMoanNvbi5pZCkpIHtcclxuICAgICAgICB0aGlzLmlkID0ganNvbi5pZFxyXG4gICAgfVxyXG5cclxuICAgIGlmICh0aGlzLmlkID09PSAwKSB7XHJcbiAgICAgICAgdGhpcy5pZCA9IFN0b3JhZ2UuYXNzaWduSWQoKVxyXG4gICAgfVxyXG5cclxuICAgIGlmIChqc29uLm5hbWUpIHtcclxuICAgICAgICB0aGlzLm5hbWUgPSBqc29uLm5hbWVcclxuICAgIH1cclxuXHJcbiAgICBpZiAoanNvbi5oZWFsdGggJiYgVXRpbHMuaXNOdW1lcmljKGpzb24uaGVhbHRoKSkge1xyXG4gICAgICAgIHRoaXMuaGVhbHRoID0ganNvbi5oZWFsdGhcclxuICAgIH1cclxuXHJcbiAgICBpZiAoanNvbi5tYXhIZWFsdGggJiYgVXRpbHMuaXNOdW1lcmljKGpzb24ubWF4SGVhbHRoKSkge1xyXG4gICAgICAgIHRoaXMubWF4SGVhbHRoID0ganNvbi5tYXhIZWFsdGhcclxuICAgIH1cclxuXHJcbiAgICBpZiAoanNvbi5hcm1vciAmJiBVdGlscy5pc051bWVyaWMoanNvbi5hcm1vcikpIHtcclxuICAgICAgICB0aGlzLmFybW9yID0ganNvbi5hcm1vclxyXG4gICAgfVxyXG5cclxuICAgIGlmIChqc29uLnNwZWVkICYmIFV0aWxzLmlzTnVtZXJpYyhqc29uLnNwZWVkKSkge1xyXG4gICAgICAgIHRoaXMuc3BlZWQgPSBqc29uLnNwZWVkXHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGpzb24ucmFjZSkge1xyXG4gICAgICAgIHRoaXMucmFjZSA9IGpzb24ucmFjZVxyXG4gICAgfVxyXG5cclxuICAgIGlmIChqc29uLmluaXRpYXRpdmUgJiYgVXRpbHMuaXNOdW1lcmljKGpzb24uaW5pdGlhdGl2ZSkpIHtcclxuICAgICAgICB0aGlzLmluaXRpYXRpdmUgPSBqc29uLmluaXRpYXRpdmVcclxuICAgIH1cclxuXHJcbiAgICBpZiAoanNvbi5zdGF0ZSkge1xyXG4gICAgICAgIHRoaXMuc3RhdGUgPSBqc29uLnN0YXRlXHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGpzb24ud2VhcG9ucyAmJiBVdGlscy5pc0FycmF5KGpzb24ud2VhcG9ucykpIHtcclxuICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IGpzb24ud2VhcG9ucy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICAgICAgdmFyIHcgPSBuZXcgV2VhcG9uKClcclxuICAgICAgICAgICAgdy5wYXJzZShqc29uLndlYXBvbnNbaV0pXHJcbiAgICAgICAgICAgIHRoaXMud2VhcG9ucy5wdXNoKHcpXHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGlmIChqc29uLnNwZWxscyAmJiBVdGlscy5pc0FycmF5KGpzb24uc3BlbGxzKSkge1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0ganNvbi5zcGVsbHMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XHJcbiAgICAgICAgICAgIHZhciBzID0gbmV3IFNwZWxsKClcclxuICAgICAgICAgICAgcy5wYXJzZShqc29uLnNwZWxsc1tpXSlcclxuICAgICAgICAgICAgaWYgKHMucGFyZW50SWQgPT09IDApIHMucGFyZW50SWQgPSB0aGlzLmlkXHJcbiAgICAgICAgICAgIHRoaXMuc3BlbGxzLnB1c2gocylcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGpzb24uY29tcGFuaW9ucyAmJiBVdGlscy5pc0FycmF5KGpzb24uY29tcGFuaW9ucykpIHtcclxuICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IGpzb24uY29tcGFuaW9ucy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICAgICAgdGhpcy5jb21wYW5pb25zLnB1c2goanNvbi5jb21wYW5pb25zW2ldKVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBpZiAoanNvbi5saW5rKSB7XHJcbiAgICAgICAgdGhpcy5saW5rID0ganNvbi5saW5rXHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGpzb24udGVtcGxhdGUpIHtcclxuICAgICAgICB0aGlzLnRlbXBsYXRlID0ganNvbi50ZW1wbGF0ZVxyXG4gICAgfVxyXG5cclxuICAgIGlmICghdGhpcy50ZW1wbGF0ZSAmJiBqc29uLmNvbXBhbmlvblRvKSB7XHJcbiAgICAgICAgdGhpcy5jb21wYW5pb25UbyA9IGpzb24uY29tcGFuaW9uVG9cclxuICAgIH1cclxuXHJcbiAgICBpZiAoanNvbi5pbml0TW9kICYmIFV0aWxzLmlzTnVtZXJpYyhqc29uLmluaXRNb2QpKSB7XHJcbiAgICAgICAgdGhpcy5pbml0TW9kID0ganNvbi5pbml0TW9kXHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGpzb24uY29uY2VudHJhdGluZykge1xyXG4gICAgICAgIHRoaXMuY29uY2VudHJhdGluZyA9IGpzb24uY29uY2VudHJhdGluZ1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChqc29uLnZpc2libGUpIHtcclxuICAgICAgICB0aGlzLnZpc2libGUgPSBqc29uLnZpc2libGVcclxuICAgIH1cclxufVxyXG5cclxubnBjLnByb3RvdHlwZS5zZXJpYWxpemUgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICB2YXIgd2VhcG9ucyA9IFtdXHJcbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IHRoaXMud2VhcG9ucy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICB3ZWFwb25zLnB1c2godGhpcy53ZWFwb25zW2ldLnNlcmlhbGl6ZSgpKVxyXG4gICAgfVxyXG5cclxuICAgIHZhciBzcGVsbHMgPSBbXVxyXG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSB0aGlzLnNwZWxscy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICBzcGVsbHMucHVzaCh0aGlzLnNwZWxsc1tpXS5zZXJpYWxpemUoKSlcclxuICAgIH1cclxuXHJcbiAgICB2YXIgY29tcGFuaW9ucyA9IFtdXHJcbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IHRoaXMuY29tcGFuaW9ucy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICBjb21wYW5pb25zLnB1c2godGhpcy5jb21wYW5pb25zW2ldKVxyXG4gICAgfVxyXG5cclxuICAgIHZhciBvdXQgPSB7XHJcbiAgICAgICAgaWQ6IHRoaXMuaWQsXHJcbiAgICAgICAgbmFtZTogdGhpcy5uYW1lLFxyXG4gICAgICAgIGhlYWx0aDogdGhpcy5oZWFsdGgsXHJcbiAgICAgICAgbWF4SGVhbHRoOiB0aGlzLm1heEhlYWx0aCxcclxuICAgICAgICBhcm1vcjogdGhpcy5hcm1vcixcclxuICAgICAgICBzcGVlZDogdGhpcy5zcGVlZCxcclxuICAgICAgICByYWNlOiB0aGlzLnJhY2UsXHJcbiAgICAgICAgaW5pdGlhdGl2ZTogdGhpcy5pbml0aWF0aXZlLFxyXG4gICAgICAgIHdlYXBvbnM6IHdlYXBvbnMsXHJcbiAgICAgICAgc3BlbGxzOiBzcGVsbHMsXHJcbiAgICAgICAgY29tcGFuaW9uczogY29tcGFuaW9ucyxcclxuICAgICAgICBjb21wYW5pb25UbzogdGhpcy5jb21wYW5pb25UbyxcclxuICAgICAgICBzdGF0ZTogdGhpcy5zdGF0ZSxcclxuICAgICAgICBsaW5rOiB0aGlzLmxpbmssXHJcbiAgICAgICAgaW5pdE1vZDogdGhpcy5pbml0TW9kLFxyXG4gICAgICAgIHRlbXBsYXRlOiB0aGlzLnRlbXBsYXRlLFxyXG4gICAgICAgIGluc3RhbmNlOiB0aGlzLmluc3RhbmNlLFxyXG4gICAgICAgIGNvbmNlbnRyYXRpbmc6IHRoaXMuY29uY2VudHJhdGluZyxcclxuICAgICAgICB2aXNpYmxlOiB0aGlzLnZpc2libGVcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gb3V0XHJcbn1cclxuXHJcbm5wYy5wcm90b3R5cGUucmVuZGVyID0gZnVuY3Rpb24gKCkge1xyXG4gICAgdmFyIGNsYXNzZXMgPSAnZW50IG5wYyc7XHJcbiAgICBpZiAodGhpcy5jb21wYW5pb25UbylcclxuICAgICAgICBjbGFzc2VzICs9ICcgY29tcGFuaW9uJ1xyXG5cclxuICAgIHZhciBvdXQgPSAnPGRpdiBjbGFzcz1cIicgKyBjbGFzc2VzICsgJ1wiIGRhdGEtaWQ9XCInICsgdGhpcy5pZCArICdcIj4nO1xyXG5cclxuICAgIHZhciB0b2dnbGVDaGFyID0gdGhpcy52aXNpYmxlID8gJ2Nsb3NlJyA6ICdvcGVuJ1xyXG4gICAgb3V0ICs9ICc8ZGl2PjxzcGFuIGNsYXNzPVwiYm9sZFwiPicgKyB0aGlzLm5hbWUgKyAnPC9zcGFuPiwgPHNwYW4gY2xhc3M9XCJpdGFsaWNcIj4nICsgdGhpcy5yYWNlICsgJzwvc3Bhbj4uIFNwZWVkOiAnICsgdGhpcy5zcGVlZFxyXG4gICAgb3V0ICs9ICc8aW5wdXQgdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwibnBjX3RvZ2dsZVwiIGRhdGEtaWQ9XCInICsgdGhpcy5pZCArICdcIiB2YWx1ZT1cIicgKyB0b2dnbGVDaGFyICsgJ1wiIC8+PGRpdiBjbGFzcz1cImNsZWFyXCI+PC9kaXY+PC9kaXY+J1xyXG5cclxuICAgIGlmICh0aGlzLnZpc2libGUpIHtcclxuICAgICAgICB2YXIgaW5pdGlhdGl2ZSA9ICcnO1xyXG4gICAgICAgIGlmICh0aGlzLnN0YXRlID09PSBDaGFyYWN0ZXJTdGF0ZS5FbmNvdW50ZXIpXHJcbiAgICAgICAgICAgIGluaXRpYXRpdmUgPSAnICgnICsgKHRoaXMuaGVhbHRoID4gMCA/ICdhbGl2ZScgOiAnZGVhZCcpICsgJyksIEluaXRpYXRpdmU6IDxzcGFuIGNsYXNzPVwiYm9sZFwiPicgKyB0aGlzLmluaXRpYXRpdmUgKyAnPC9zcGFuPidcclxuXHJcbiAgICAgICAgb3V0ICs9ICc8ZGl2PkhlYWx0aDogPHNwYW4gY2xhc3M9XCJib2xkXCI+JyArIHRoaXMuaGVhbHRoICsgJzwvc3Bhbj4sIEFDOiA8c3BhbiBjbGFzcz1cImJvbGRcIj4nICsgdGhpcy5hcm1vciArICc8L3NwYW4+JyArIGluaXRpYXRpdmUgKyAnPC9kaXY+J1xyXG5cclxuICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IHRoaXMud2VhcG9ucy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICAgICAgb3V0ICs9ICc8ZGl2PicgKyB0aGlzLndlYXBvbnNbaV0ucmVuZGVyKCkgKyAnPC9kaXY+J1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHRoaXMuc3BlbGxzLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgICAgb3V0ICs9ICc8dGFibGUgY2VsbHBhZGRpbmc9XCIwXCIgY2VsbHNwYWNpbmc9XCIwXCIgYm9yZGVyPVwiMFwiIGNsYXNzPVwibnBjLXNwZWxsLWxpc3RcIj4nXHJcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gdGhpcy5zcGVsbHMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICBvdXQgKz0gdGhpcy5zcGVsbHNbaV0ucmVuZGVyKClcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBvdXQgKz0gJzwvdGFibGU+J1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHRoaXMuc3RhdGUgPT09IENoYXJhY3RlclN0YXRlLkVuY291bnRlcikge1xyXG4gICAgICAgICAgICBvdXQgKz0gJzxkaXY+PGlucHV0IHR5cGU9XCJidXR0b25cIiBjbGFzcz1cIm5wY19kYW1hZ2VcIiB2YWx1ZT1cIkFwcGx5IERhbWFnZVwiIGRhdGEtaWQ9XCInICsgdGhpcy5pZCArICdcIiAvPjxpbnB1dCB0eXBlPVwidGV4dFwiIGlkPVwibnBjX2RhbWFnZV8nICsgdGhpcy5pZCArICdcIiAvPjwvZGl2PidcclxuICAgICAgICAgICAgb3V0ICs9ICc8ZGl2IHN0eWxlPVwibWFyZ2luLXRvcDogNHB4O1wiPidcclxuICAgICAgICAgICAgaWYgKCF0aGlzLmNvbXBhbmlvblRvKSBvdXQgKz0gJzxpbnB1dCB0eXBlPVwiYnV0dG9uXCIgY2xhc3M9XCJucGNfbGVhdmVcIiB2YWx1ZT1cIkxlYXZlIEVuY291bnRlclwiIGRhdGEtaWQ9XCInICsgdGhpcy5pZCArICdcIiAvPiZuYnNwOydcclxuICAgICAgICAgICAgb3V0ICs9ICc8aW5wdXQgdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwibnBjX3Jlc3RcIiB2YWx1ZT1cIlJlc3RcIiBkYXRhLWlkPVwiJyArIHRoaXMuaWQgKyAnXCIgLz4mbmJzcDsnXHJcbiAgICAgICAgICAgIG91dCArPSAnPGlucHV0IHR5cGU9XCJidXR0b25cIiBjbGFzcz1cIm5wY19kaWVcIiB2YWx1ZT1cIkRpZVwiIGRhdGEtaWQ9XCInICsgdGhpcy5pZCArICdcIiAvPidcclxuICAgICAgICAgICAgb3V0ICs9ICc8L2Rpdj4nO1xyXG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5zdGF0ZSA9PT0gQ2hhcmFjdGVyU3RhdGUuSWRsZSkge1xyXG4gICAgICAgICAgICBvdXQgKz0gJzxkaXY+J1xyXG4gICAgICAgICAgICBpZiAoIXRoaXMuY29tcGFuaW9uVG8pIG91dCArPSAnPGlucHV0IHR5cGU9XCJidXR0b25cIiBjbGFzcz1cIm5wY19pbml0aWF0aXZlXCIgdmFsdWU9XCJSb2xsIEluaXRpYXRpdmVcIiBkYXRhLWlkPVwiJyArIHRoaXMuaWQgKyAnXCIgLz4mbmJzcDsnXHJcbiAgICAgICAgICAgIG91dCArPSAnPGlucHV0IHR5cGU9XCJidXR0b25cIiBjbGFzcz1cIm5wY19yZXN0XCIgdmFsdWU9XCJSZXN0XCIgZGF0YS1pZD1cIicgKyB0aGlzLmlkICsgJ1wiIC8+Jm5ic3A7J1xyXG4gICAgICAgICAgICBpZiAoIXRoaXMudGVtcGxhdGUpIG91dCArPSAnPGlucHV0IHR5cGU9XCJidXR0b25cIiBjbGFzcz1cIm5wY19kaWVcIiB2YWx1ZT1cIkRpZVwiIGRhdGEtaWQ9XCInICsgdGhpcy5pZCArICdcIiAvPidcclxuICAgICAgICAgICAgb3V0ICs9ICc8L2Rpdj4nO1xyXG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5zdGF0ZSA9PT0gQ2hhcmFjdGVyU3RhdGUuRGVhZCkge1xyXG4gICAgICAgICAgICBvdXQgKz0gJzxkaXY+PGlucHV0IHR5cGU9XCJidXR0b25cIiBjbGFzcz1cIm5wY19yZXZpdmVcIiB2YWx1ZT1cIlJldml2ZSBOUENcIiBkYXRhLWlkPVwiJyArIHRoaXMuaWQgKyAnXCIgLz48L2Rpdj4nXHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB2YXIgY29uID0gJ25wY19jb25jZW50cmF0aW5nXycgKyB0aGlzLmlkO1xyXG4gICAgICAgIGlmICh0aGlzLmNvbmNlbnRyYXRpbmcpIHtcclxuICAgICAgICAgICAgb3V0ICs9ICc8ZGl2IGNsYXNzPVwiY29uY2VudHJhdGlvblwiPjxsYWJlbCBmb3I9XCInICsgY29uICsgJ1wiPkNvbmNlbnRyYXRpbmc8L2xhYmVsPjxpbnB1dCBjbGFzcz1cIm5wY19jb25jZW50cmF0ZVwiIGlkPVwiJyArIGNvbiArICdcIiBkYXRhLWlkPVwiJyArIHRoaXMuaWQgKyAnXCIgdHlwZT1cImNoZWNrYm94XCIgY2hlY2tlZD1cImNoZWNrZWRcIiAvPjwvZGl2Pic7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgb3V0ICs9ICc8ZGl2IGNsYXNzPVwiY29uY2VudHJhdGlvblwiPjxsYWJlbCBmb3I9XCInICsgY29uICsgJ1wiPkNvbmNlbnRyYXRpbmc8L2xhYmVsPjxpbnB1dCBjbGFzcz1cIm5wY19jb25jZW50cmF0ZVwiIGlkPVwiJyArIGNvbiArICdcIiBkYXRhLWlkPVwiJyArIHRoaXMuaWQgKyAnXCIgdHlwZT1cImNoZWNrYm94XCIgLz48L2Rpdj4nO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHRoaXMubGluaykgb3V0ICs9ICc8ZGl2PjxhIGhyZWY9XCInICsgdGhpcy5saW5rICsgJ1wiIHRhcmdldD1cIl9ibGFua1wiPkQmRCBCZXlvbmQ8L2E+PC9kaXY+J1xyXG4gICAgfVxyXG5cclxuICAgIG91dCArPSAnPC9kaXY+J1xyXG4gICAgcmV0dXJuIG91dDtcclxufVxyXG5cclxubnBjLnByb3RvdHlwZS5yb2xsSW5pdGlhdGl2ZSA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHRoaXMuc3RhdGUgPSBDaGFyYWN0ZXJTdGF0ZS5FbmNvdW50ZXJcclxuICAgIHRoaXMuaW5pdGlhdGl2ZSA9IHJvbGwuZDIwKCkgKyB0aGlzLmluaXRNb2RcclxufVxyXG5cclxubnBjLnByb3RvdHlwZS5hcHBseUluaXRpYXRpdmUgPSBmdW5jdGlvbiAoaW5pdGlhdGl2ZSkge1xyXG4gICAgdGhpcy5pbml0aWF0aXZlID0gaW5pdGlhdGl2ZVxyXG4gICAgaWYgKHRoaXMuc3RhdGUgIT09IENoYXJhY3RlclN0YXRlLkRlYWQpIHtcclxuICAgICAgICB0aGlzLnN0YXRlID0gQ2hhcmFjdGVyU3RhdGUuRW5jb3VudGVyXHJcbiAgICB9XHJcbn1cclxuXHJcbm5wYy5wcm90b3R5cGUuYXBwbHlEYW1hZ2UgPSBmdW5jdGlvbiAoZGFtYWdlKSB7XHJcbiAgICB0aGlzLmhlYWx0aCAtPSBkYW1hZ2VcclxuICAgIGlmICh0aGlzLmhlYWx0aCA8PSAwKSB7XHJcbiAgICAgICAgdGhpcy5zdGF0ZSA9IENoYXJhY3RlclN0YXRlLkRlYWRcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLmhlYWx0aCA9IFV0aWxzLmNsYW1wKHRoaXMuaGVhbHRoLCAwLCB0aGlzLm1heEhlYWx0aClcclxufVxyXG5cclxubnBjLnByb3RvdHlwZS5yZXZpdmUgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICB0aGlzLmhlYWx0aCA9IDFcclxuICAgIHRoaXMuc3RhdGUgPSBDaGFyYWN0ZXJTdGF0ZS5FbmNvdW50ZXJcclxufVxyXG5cclxubnBjLnByb3RvdHlwZS5sZWF2ZUVuY291bnRlciA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHRoaXMuaW5pdGlhdGl2ZSA9IDBcclxuICAgIHRoaXMuc3RhdGUgPSBDaGFyYWN0ZXJTdGF0ZS5JZGxlXHJcbn1cclxuXHJcbm5wYy5wcm90b3R5cGUuZGllID0gZnVuY3Rpb24gKCkge1xyXG4gICAgdGhpcy5oZWFsdGggPSAwXHJcbiAgICB0aGlzLnN0YXRlID0gQ2hhcmFjdGVyU3RhdGUuRGVhZFxyXG59XHJcblxyXG5ucGMucHJvdG90eXBlLmNsb25lID0gZnVuY3Rpb24gKCkge1xyXG4gICAgdmFyIG4gPSBuZXcgbnBjKClcclxuICAgIHRoaXMuaW5zdGFuY2UrK1xyXG5cclxuICAgIG4ucGFyc2Uoe1xyXG4gICAgICAgIG5hbWU6IHRoaXMubmFtZSArICcgIycgKyB0aGlzLmluc3RhbmNlLFxyXG4gICAgICAgIGhlYWx0aDogdGhpcy5oZWFsdGgsXHJcbiAgICAgICAgbWF4SGVhbHRoOiB0aGlzLm1heEhlYWx0aCxcclxuICAgICAgICBhcm1vcjogdGhpcy5hcm1vcixcclxuICAgICAgICBzcGVlZDogdGhpcy5zcGVlZCxcclxuICAgICAgICByYWNlOiB0aGlzLnJhY2UsXHJcbiAgICAgICAgbGluazogdGhpcy5saW5rLFxyXG4gICAgICAgIGluaXRNb2Q6IHRoaXMuaW5pdE1vZCxcclxuICAgICAgICB2aXNpYmxlOiB0aGlzLnZpc2libGVcclxuICAgIH0pXHJcblxyXG4gICAgdmFyIHdlYXBvbnMgPSBbXVxyXG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSB0aGlzLndlYXBvbnMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XHJcbiAgICAgICAgd2VhcG9ucy5wdXNoKHRoaXMud2VhcG9uc1tpXS5jbG9uZShuLmlkKSlcclxuICAgIH1cclxuICAgIG4ud2VhcG9ucyA9IHdlYXBvbnM7XHJcblxyXG4gICAgdmFyIHNwZWxscyA9IFtdXHJcbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IHRoaXMuc3BlbGxzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xyXG4gICAgICAgIHNwZWxscy5wdXNoKHRoaXMuc3BlbGxzW2ldLmNsb25lKG4uaWQpKVxyXG4gICAgfVxyXG4gICAgbi5zcGVsbHMgPSBzcGVsbHNcclxuXHJcbiAgICByZXR1cm4gblxyXG59XHJcblxyXG5ucGMucHJvdG90eXBlLnVzZVNwZWxsID0gZnVuY3Rpb24gKHNsb3RJZCwgdXNlKSB7XHJcbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IHRoaXMuc3BlbGxzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xyXG4gICAgICAgIGlmICh0aGlzLnNwZWxsc1tpXS5pZCA9PT0gc2xvdElkKSB7XHJcbiAgICAgICAgICAgIGlmICh1c2UpXHJcbiAgICAgICAgICAgICAgICB0aGlzLnNwZWxsc1tpXS51c2VkKytcclxuICAgICAgICAgICAgZWxzZVxyXG4gICAgICAgICAgICAgICAgdGhpcy5zcGVsbHNbaV0udXNlZC0tXHJcbiAgICAgICAgICAgIHRoaXMuc3BlbGxzW2ldLnVzZWQgPSBVdGlscy5jbGFtcCh0aGlzLnNwZWxsc1tpXS51c2VkLCAwLCB0aGlzLnNwZWxscy5zbG90cylcclxuICAgICAgICAgICAgcmV0dXJuIHRydWVcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGZhbHNlXHJcbn1cclxuXHJcbm5wYy5wcm90b3R5cGUuYXBwbHlSZXN0ID0gZnVuY3Rpb24gKCkge1xyXG4gICAgdGhpcy5oZWFsdGggPSB0aGlzLm1heEhlYWx0aFxyXG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSB0aGlzLnNwZWxscy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICB0aGlzLnNwZWxsc1tpXS51c2VkID0gMFxyXG4gICAgfVxyXG59XHJcblxyXG5ucGMucHJvdG90eXBlLmNvbmNlbnRyYXRlID0gZnVuY3Rpb24gKCkge1xyXG4gICAgdGhpcy5jb25jZW50cmF0aW5nID0gIXRoaXMuY29uY2VudHJhdGluZ1xyXG59XHJcblxyXG5ucGMucHJvdG90eXBlLnRvZ2dsZSA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHRoaXMudmlzaWJsZSA9IHRoaXMudmlzaWJsZSA/IGZhbHNlIDogdHJ1ZVxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IG5wYyIsIu+7vyd1c2Ugc3RyaWN0J1xyXG5cclxudmFyIFN0b3JhZ2UgPSByZXF1aXJlKCcuLi9hcHAvc3RvcmFnZS5qcycpXHJcblxyXG52YXIgcGxheWVyID0gZnVuY3Rpb24gKCkge1xyXG4gICAgdGhpcy5pZCA9IDBcclxuICAgIHRoaXMubmFtZSA9ICcnXHJcbiAgICB0aGlzLnBsYXllciA9ICcnXHJcbiAgICB0aGlzLmluaXRpYXRpdmUgPSAwXHJcbiAgICB0aGlzLnN0YXRlID0gQ2hhcmFjdGVyU3RhdGUuSWRsZVxyXG4gICAgdGhpcy5leGhhdXN0aW9uID0gMFxyXG4gICAgdGhpcy5saW5rID0gJydcclxuICAgIHRoaXMuY29tcGFuaW9ucyA9IFtdXHJcbiAgICB0aGlzLmNvbmNlbnRyYXRpbmcgPSBmYWxzZVxyXG4gICAgdGhpcy52aXNpYmxlID0gZmFsc2VcclxufTtcclxuXHJcbnBsYXllci5wcm90b3R5cGUucGFyc2UgPSBmdW5jdGlvbiAoanNvbikge1xyXG4gICAgaWYgKCFqc29uKSByZXR1cm5cclxuXHJcbiAgICBpZiAoanNvbi5pZCAmJiBVdGlscy5pc051bWVyaWMoanNvbi5pZCkpIHtcclxuICAgICAgICB0aGlzLmlkID0ganNvbi5pZFxyXG4gICAgfVxyXG5cclxuICAgIGlmICh0aGlzLmlkID09PSAwKSB7XHJcbiAgICAgICAgdGhpcy5pZCA9IFN0b3JhZ2UuYXNzaWduSWQoKVxyXG4gICAgfVxyXG5cclxuICAgIGlmIChqc29uLm5hbWUpIHtcclxuICAgICAgICB0aGlzLm5hbWUgPSBqc29uLm5hbWVcclxuICAgIH1cclxuXHJcbiAgICBpZiAoanNvbi5wbGF5ZXIpIHtcclxuICAgICAgICB0aGlzLnBsYXllciA9IGpzb24ucGxheWVyXHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGpzb24uaW5pdGlhdGl2ZSAmJiBVdGlscy5pc051bWVyaWMoanNvbi5pbml0aWF0aXZlKSkge1xyXG4gICAgICAgIHRoaXMuaW5pdGlhdGl2ZSA9IGpzb24uaW5pdGlhdGl2ZVxyXG4gICAgfVxyXG5cclxuICAgIGlmIChqc29uLnN0YXRlKSB7XHJcbiAgICAgICAgdGhpcy5zdGF0ZSA9IGpzb24uc3RhdGVcclxuICAgIH1cclxuXHJcbiAgICBpZiAoanNvbi5leGhhdXN0aW9uICYmIFV0aWxzLmlzTnVtZXJpYyhqc29uLmV4aGF1c3Rpb24pKSB7XHJcbiAgICAgICAgdGhpcy5leGhhdXN0aW9uID0gVXRpbHMuY2xhbXAoanNvbi5leGhhdXN0aW9uLCAxLCA2KVxyXG5cclxuICAgICAgICBpZiAodGhpcy5leGhhdXN0aW9uID09IDYpXHJcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBDaGFyYWN0ZXJTdGF0ZS5EZWFkXHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGpzb24ubGluaykge1xyXG4gICAgICAgIHRoaXMubGluayA9IGpzb24ubGlua1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChqc29uLmNvbXBhbmlvbnMgJiYgVXRpbHMuaXNBcnJheShqc29uLmNvbXBhbmlvbnMpKSB7XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBqc29uLmNvbXBhbmlvbnMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XHJcbiAgICAgICAgICAgIHRoaXMuY29tcGFuaW9ucy5wdXNoKGpzb24uY29tcGFuaW9uc1tpXSlcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGpzb24uY29uY2VudHJhdGluZykge1xyXG4gICAgICAgIHRoaXMuY29uY2VudHJhdGluZyA9IGpzb24uY29uY2VudHJhdGluZyBcclxuICAgIH1cclxuXHJcbiAgICBpZiAoanNvbi52aXNpYmxlKSB7XHJcbiAgICAgICAgdGhpcy52aXNpYmxlID0ganNvbi52aXNpYmxlXHJcbiAgICB9XHJcbn1cclxuXHJcbnBsYXllci5wcm90b3R5cGUuc2VyaWFsaXplID0gZnVuY3Rpb24gKCkge1xyXG4gICAgdmFyIGNvbXBhbmlvbnMgPSBbXVxyXG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSB0aGlzLmNvbXBhbmlvbnMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XHJcbiAgICAgICAgY29tcGFuaW9ucy5wdXNoKHRoaXMuY29tcGFuaW9uc1tpXSlcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIGlkOiB0aGlzLmlkLFxyXG4gICAgICAgIG5hbWU6IHRoaXMubmFtZSxcclxuICAgICAgICBwbGF5ZXI6IHRoaXMucGxheWVyLFxyXG4gICAgICAgIGluaXRpYXRpdmU6IHRoaXMuaW5pdGlhdGl2ZSxcclxuICAgICAgICBzdGF0ZTogdGhpcy5zdGF0ZSxcclxuICAgICAgICBleGhhdXN0aW9uOiB0aGlzLmV4aGF1c3Rpb24sXHJcbiAgICAgICAgbGluazogdGhpcy5saW5rLFxyXG4gICAgICAgIGNvbXBhbmlvbnM6IGNvbXBhbmlvbnMsXHJcbiAgICAgICAgY29uY2VudHJhdGluZzogdGhpcy5jb25jZW50cmF0aW5nLFxyXG4gICAgICAgIHZpc2libGU6IHRoaXMudmlzaWJsZVxyXG4gICAgfVxyXG59XHJcblxyXG5wbGF5ZXIucHJvdG90eXBlLnJlbmRlciA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHZhciBvdXQgPSAnPGRpdiBjbGFzcz1cImVudCBwbGF5ZXJcIiBkYXRhLWlkPVwiJyArIHRoaXMuaWQgKyAnXCI+J1xyXG5cclxuICAgIHZhciB0b2dnbGVDaGFyID0gdGhpcy52aXNpYmxlID8gJ2Nsb3NlJyA6ICdvcGVuJ1xyXG4gICAgb3V0ICs9ICc8ZGl2PjxzcGFuIGNsYXNzPVwiYm9sZFwiPicgKyB0aGlzLm5hbWUgKyAnPC9zcGFuPiA8c3BhbiBjbGFzcz1cIml0YWxpY3NcIj4nICsgdGhpcy5wbGF5ZXIgKyAnPC9zcGFuPidcclxuICAgIG91dCArPSAnPGlucHV0IHR5cGU9XCJidXR0b25cIiBjbGFzcz1cInBsYXllcl90b2dnbGVcIiBkYXRhLWlkPVwiJyArIHRoaXMuaWQgKyAnXCIgdmFsdWU9XCInICsgdG9nZ2xlQ2hhciArICdcIiAvPjxkaXYgY2xhc3M9XCJjbGVhclwiPjwvZGl2PjwvZGl2PidcclxuXHJcbiAgICBpZiAodGhpcy52aXNpYmxlKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuc3RhdGUgPT09IENoYXJhY3RlclN0YXRlLkVuY291bnRlcikge1xyXG4gICAgICAgICAgICBvdXQgKz0gJzxkaXY+SW5pdGlhdGl2ZTogPHNwYW4gY2xhc3M9XCJib2xkXCI+JyArIHRoaXMuaW5pdGlhdGl2ZSArICc8L3NwYW4+PC9kaXY+J1xyXG4gICAgICAgICAgICBvdXQgKz0gJzxkaXY+J1xyXG4gICAgICAgICAgICBvdXQgKz0gJzxpbnB1dCB0eXBlPVwiYnV0dG9uXCIgY2xhc3M9XCJwbGF5ZXJfbGVhdmVcIiB2YWx1ZT1cIkxlYXZlIEVuY291bnRlclwiIGRhdGEtaWQ9XCInICsgdGhpcy5pZCArICdcIiBzdHlsZT1cIm1hcmdpbi1yaWdodDo1cHhcIiAvPidcclxuICAgICAgICAgICAgb3V0ICs9ICc8aW5wdXQgdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwicGxheWVyX2RpZVwiIHZhbHVlPVwiRGllXCIgZGF0YS1pZD1cIicgKyB0aGlzLmlkICsgJ1wiIC8+J1xyXG4gICAgICAgICAgICBvdXQgKz0gJzwvZGl2PidcclxuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuc3RhdGUgPT09IENoYXJhY3RlclN0YXRlLklkbGUpIHtcclxuICAgICAgICAgICAgb3V0ICs9ICc8ZGl2PidcclxuICAgICAgICAgICAgb3V0ICs9ICc8aW5wdXQgdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwicGxheWVyX2luaXRpYXRpdmVcIiB2YWx1ZT1cIkFwcGx5IEluaXRpYXR2ZVwiIGRhdGEtaWQ9XCInICsgdGhpcy5pZCArICdcIiAvPjxpbnB1dCB0eXBlPVwidGV4dFwiIGlkPVwicGxheWVyX2luaXRpYXRpdmVfJyArIHRoaXMuaWQgKyAnXCIgLz4nXHJcbiAgICAgICAgICAgIG91dCArPSAnPGlucHV0IHR5cGU9XCJidXR0b25cIiBjbGFzcz1cInBsYXllcl9kaWVcIiB2YWx1ZT1cIkRpZVwiIGRhdGEtaWQ9XCInICsgdGhpcy5pZCArICdcIiAvPidcclxuICAgICAgICAgICAgb3V0ICs9ICc8L2Rpdj4nO1xyXG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5zdGF0ZSA9PT0gQ2hhcmFjdGVyU3RhdGUuRGVhZCkge1xyXG4gICAgICAgICAgICBvdXQgKz0gJzxkaXY+PGlucHV0IHR5cGU9XCJidXR0b25cIiBjbGFzcz1cInBsYXllcl9yZXZpdmVcIiB2YWx1ZT1cIlJldml2ZSBQbGF5ZXJcIiBkYXRhLWlkPVwiJyArIHRoaXMuaWQgKyAnXCIgLz48L2Rpdj4nXHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAodGhpcy5jb25jZW50cmF0aW5nKSB7XHJcbiAgICAgICAgICAgIG91dCArPSAnPGxhYmVsIGNsYXNzPVwiY29uY2VudHJhdGlvblwiPkNvbmNlbnRyYXRpbmc8aW5wdXQgY2xhc3M9XCJwbGF5ZXJfY29uY2VudHJhdGVcIiBkYXRhLWlkPVwiJyArIHRoaXMuaWQgKyAnXCIgdHlwZT1cImNoZWNrYm94XCIgY2hlY2tlZD1cImNoZWNrZWRcIiAvPjwvbGFiZWw+JztcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBvdXQgKz0gJzxsYWJlbCBjbGFzcz1cImNvbmNlbnRyYXRpb25cIj5Db25jZW50cmF0aW5nPGlucHV0IGNsYXNzPVwicGxheWVyX2NvbmNlbnRyYXRlXCIgZGF0YS1pZD1cIicgKyB0aGlzLmlkICsgJ1wiIHR5cGU9XCJjaGVja2JveFwiIC8+PC9sYWJlbD4nO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHRoaXMubGluaykgb3V0ICs9ICc8ZGl2PjxhIGhyZWY9XCInICsgdGhpcy5saW5rICsgJ1wiIHRhcmdldD1cIl9ibGFua1wiPkQmRCBCZXlvbmQ8L2E+PC9kaXY+J1xyXG4gICAgfVxyXG5cclxuICAgIG91dCArPSAnPC9kaXY+J1xyXG5cclxuICAgIHJldHVybiBvdXRcclxufVxyXG5cclxucGxheWVyLnByb3RvdHlwZS5hcHBseUluaXRpYXRpdmUgPSBmdW5jdGlvbiAoaW5pdGlhdGl2ZSkge1xyXG4gICAgdGhpcy5pbml0aWF0aXZlID0gaW5pdGlhdGl2ZVxyXG4gICAgdGhpcy5zdGF0ZSA9IENoYXJhY3RlclN0YXRlLkVuY291bnRlclxyXG59XHJcblxyXG5wbGF5ZXIucHJvdG90eXBlLmxlYXZlRW5jb3VudGVyID0gZnVuY3Rpb24gKCkge1xyXG4gICAgdGhpcy5pbml0aWF0aXZlID0gMFxyXG4gICAgdGhpcy5zdGF0ZSA9IENoYXJhY3RlclN0YXRlLklkbGVcclxufVxyXG5cclxucGxheWVyLnByb3RvdHlwZS5yZXZpdmUgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICB0aGlzLnN0YXRlID0gQ2hhcmFjdGVyU3RhdGUuRW5jb3VudGVyXHJcbn1cclxuXHJcbnBsYXllci5wcm90b3R5cGUuZGllID0gZnVuY3Rpb24gKCkge1xyXG4gICAgdGhpcy5zdGF0ZSA9IENoYXJhY3RlclN0YXRlLkRlYWRcclxufVxyXG5cclxucGxheWVyLnByb3RvdHlwZS51c2VTcGVsbCA9IGZ1bmN0aW9uIChzbG90SWQsIHVzZSkge1xyXG4gICAgcmV0dXJuIGZhbHNlXHJcbn1cclxuXHJcbnBsYXllci5wcm90b3R5cGUuYXBwbHlSZXN0ID0gZnVuY3Rpb24gKCkge1xyXG5cclxufVxyXG5cclxucGxheWVyLnByb3RvdHlwZS5jb25jZW50cmF0ZSA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHRoaXMuY29uY2VudHJhdGluZyA9ICF0aGlzLmNvbmNlbnRyYXRpbmdcclxufVxyXG5cclxucGxheWVyLnByb3RvdHlwZS50b2dnbGUgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICB0aGlzLnZpc2libGUgPSB0aGlzLnZpc2libGUgPyBmYWxzZSA6IHRydWVcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBwbGF5ZXI7Iiwi77u/J3VzZSBzdHJpY3QnXHJcblxyXG52YXIgU3RvcmFnZSA9IHJlcXVpcmUoJy4uL2FwcC9zdG9yYWdlLmpzJylcclxuXHJcbnZhciBzcGVsbCA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHRoaXMuaWQgPSAwXHJcbiAgICB0aGlzLnBhcmVudElkID0gMFxyXG4gICAgdGhpcy5uYW1lID0gJydcclxuICAgIHRoaXMuc2xvdHMgPSAwXHJcbiAgICB0aGlzLnVzZWQgPSAwXHJcbn1cclxuXHJcbnNwZWxsLnByb3RvdHlwZS5wYXJzZSA9IGZ1bmN0aW9uIChqc29uKSB7XHJcbiAgICBpZiAoIWpzb24pIHJldHVyblxyXG5cclxuICAgIGlmIChqc29uLmlkICYmIFV0aWxzLmlzTnVtZXJpYyhqc29uLmlkKSkge1xyXG4gICAgICAgIHRoaXMuaWQgPSBqc29uLmlkXHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHRoaXMuaWQgPT09IDApIHtcclxuICAgICAgICB0aGlzLmlkID0gU3RvcmFnZS5hc3NpZ25JZCgpXHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGpzb24ucGFyZW50SWQgJiYgVXRpbHMuaXNOdW1lcmljKGpzb24ucGFyZW50SWQpKSB7XHJcbiAgICAgICAgdGhpcy5wYXJlbnRJZCA9IGpzb24ucGFyZW50SWRcclxuICAgIH1cclxuXHJcbiAgICBpZiAoanNvbi5uYW1lKSB7XHJcbiAgICAgICAgdGhpcy5uYW1lID0ganNvbi5uYW1lXHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGpzb24uc2xvdHMgJiYgVXRpbHMuaXNOdW1lcmljKGpzb24uc2xvdHMpKSB7XHJcbiAgICAgICAgdGhpcy5zbG90cyA9IFV0aWxzLmNsYW1wKGpzb24uc2xvdHMsIDAsIDk5OSlcclxuICAgIH1cclxuXHJcbiAgICBpZiAoanNvbi51c2VkICYmIFV0aWxzLmlzTnVtZXJpYyhqc29uLnVzZWQpKSB7XHJcbiAgICAgICAgdGhpcy51c2VkID0gVXRpbHMuY2xhbXAoanNvbi51c2VkLCAwLCA5OTkpXHJcbiAgICB9XHJcbn1cclxuXHJcbnNwZWxsLnByb3RvdHlwZS5zZXJpYWxpemUgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIGlkOiB0aGlzLmlkLFxyXG4gICAgICAgIHBhcmVudElkOiB0aGlzLnBhcmVudElkLFxyXG4gICAgICAgIG5hbWU6IHRoaXMubmFtZSxcclxuICAgICAgICBzbG90czogdGhpcy5zbG90cyxcclxuICAgICAgICB1c2VkOiB0aGlzLnVzZWRcclxuICAgIH1cclxufVxyXG5cclxuc3BlbGwucHJvdG90eXBlLnNlcmlhbGl6ZSA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgaWQ6IHRoaXMuaWQsXHJcbiAgICAgICAgcGFyZW50SWQ6IHRoaXMucGFyZW50SWQsXHJcbiAgICAgICAgbmFtZTogdGhpcy5uYW1lLFxyXG4gICAgICAgIHNsb3RzOiB0aGlzLnNsb3RzLFxyXG4gICAgICAgIHVzZWQ6IHRoaXMudXNlZFxyXG4gICAgfVxyXG59XHJcblxyXG5zcGVsbC5wcm90b3R5cGUuY2xvbmUgPSBmdW5jdGlvbiAocGFyZW50SWQpIHtcclxuICAgIHZhciBzID0gbmV3IHNwZWxsKClcclxuXHJcbiAgICBzLnBhcnNlKHtcclxuICAgICAgICBuYW1lOiB0aGlzLm5hbWUsXHJcbiAgICAgICAgcGFyZW50SWQ6IHBhcmVudElkLFxyXG4gICAgICAgIHNsb3RzOiB0aGlzLnNsb3RzLFxyXG4gICAgICAgIHVzZWQ6IHRoaXMudXNlZFxyXG4gICAgfSlcclxuXHJcbiAgICByZXR1cm4gc1xyXG59XHJcblxyXG5zcGVsbC5wcm90b3R5cGUucmVuZGVyID0gZnVuY3Rpb24gKCkge1xyXG4gICAgdmFyIG91dCA9ICc8dHI+J1xyXG5cclxuICAgIG91dCArPSAnPHRkPicgKyB0aGlzLm5hbWUgKyAnPC90ZD4nO1xyXG5cclxuICAgIGZvciAodmFyIGkgPSAwLCBsID0gdGhpcy5zbG90czsgaSA8IGw7IGkrKykge1xyXG4gICAgICAgIG91dCArPSAnPHRkPidcclxuICAgICAgICBpZiAoKGkgKyAxKSA8PSB0aGlzLnVzZWQpIHtcclxuICAgICAgICAgICAgb3V0ICs9ICc8aW5wdXQgY2xhc3M9XCJucGNfc3BlbGxfc2xvdFwiIHR5cGU9XCJjaGVja2JveFwiIGNoZWNrZWQ9XCJjaGVja2VkXCIgZGF0YS1pZD1cIicgKyB0aGlzLnBhcmVudElkICsgJ1wiIGRhdGEtbGV2ZWwtaWQ9XCInICsgdGhpcy5pZCArICdcIiAvPidcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBvdXQgKz0gJzxpbnB1dCBjbGFzcz1cIm5wY19zcGVsbF9zbG90XCIgdHlwZT1cImNoZWNrYm94XCIgZGF0YS1pZD1cIicgKyB0aGlzLnBhcmVudElkICsgJ1wiIGRhdGEtbGV2ZWwtaWQ9XCInICsgdGhpcy5pZCArICdcIiAvPidcclxuICAgICAgICB9XHJcbiAgICAgICAgb3V0ICs9ICc8L3RkPidcclxuICAgIH1cclxuXHJcbiAgICBvdXQgKz0gJzwvdHI+J1xyXG5cclxuICAgIHJldHVybiBvdXRcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBzcGVsbCIsIu+7vyd1c2Ugc3RyaWN0J1xyXG5cclxudmFyIENvbXBvbmVudCA9IHJlcXVpcmUoJy4vY29tcG9uZW50LmpzJylcclxudmFyIFN0b3JhZ2UgPSByZXF1aXJlKCcuLi9hcHAvc3RvcmFnZS5qcycpXHJcblxyXG52YXIgdmVoaWNsZSA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHRoaXMuaWQgPSAwXHJcbiAgICB0aGlzLm5hbWUgPSBcIlwiXHJcbiAgICB0aGlzLnR5cGUgPSBcIlwiXHJcbiAgICB0aGlzLmNvbXBvbmVudHMgPSBbXVxyXG4gICAgdGhpcy5saW5rID0gXCJcIlxyXG4gICAgdGhpcy52aXNpYmxlID0gZmFsc2VcclxufVxyXG5cclxudmVoaWNsZS5wcm90b3R5cGUucGFyc2UgPSBmdW5jdGlvbiAoanNvbikge1xyXG4gICAgaWYgKCFqc29uKSByZXR1cm5cclxuXHJcbiAgICBpZiAoanNvbi5pZCAmJiBVdGlscy5pc051bWVyaWMoanNvbi5pZCkpIHtcclxuICAgICAgICB0aGlzLmlkID0ganNvbi5pZFxyXG4gICAgfVxyXG5cclxuICAgIGlmICh0aGlzLmlkID09PSAwKSB7XHJcbiAgICAgICAgdGhpcy5pZCA9IFN0b3JhZ2UuYXNzaWduSWQoKVxyXG4gICAgfVxyXG5cclxuICAgIGlmIChqc29uLm5hbWUpIHtcclxuICAgICAgICB0aGlzLm5hbWUgPSBqc29uLm5hbWVcclxuICAgIH1cclxuXHJcbiAgICBpZiAoanNvbi50eXBlKSB7XHJcbiAgICAgICAgdGhpcy50eXBlID0ganNvbi50eXBlXHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGpzb24uY29tcG9uZW50cyAmJiBVdGlscy5pc0FycmF5KGpzb24uY29tcG9uZW50cykpIHtcclxuICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IGpzb24uY29tcG9uZW50cy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICAgICAgdmFyIGMgPSBuZXcgQ29tcG9uZW50KClcclxuICAgICAgICAgICAgYy5wYXJzZShqc29uLmNvbXBvbmVudHNbaV0pXHJcbiAgICAgICAgICAgIGlmIChjLnZlaGljbGVJZCA9PT0gMCkgYy52ZWhpY2xlSWQgPSB0aGlzLmlkXHJcbiAgICAgICAgICAgIHRoaXMuY29tcG9uZW50cy5wdXNoKGMpXHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGlmIChqc29uLmxpbmspIHtcclxuICAgICAgICB0aGlzLmxpbmsgPSBqc29uLmxpbmtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoanNvbi52aXNpYmxlKSB7XHJcbiAgICAgICAgdGhpcy52aXNpYmxlID0ganNvbi52aXNpYmxlXHJcbiAgICB9XHJcbn1cclxuXHJcbnZlaGljbGUucHJvdG90eXBlLnNlcmlhbGl6ZSA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHZhciBjb21wb25lbnRzID0gW11cclxuICAgIGZvciAodmFyIGkgPSAwLCBsID0gdGhpcy5jb21wb25lbnRzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xyXG4gICAgICAgIGNvbXBvbmVudHMucHVzaCh0aGlzLmNvbXBvbmVudHNbaV0pXHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBpZDogdGhpcy5pZCxcclxuICAgICAgICBuYW1lOiB0aGlzLm5hbWUsXHJcbiAgICAgICAgdHlwZTogdGhpcy50eXBlLFxyXG4gICAgICAgIGNvbXBvbmVudHM6IGNvbXBvbmVudHMsXHJcbiAgICAgICAgbGluazogdGhpcy5saW5rLFxyXG4gICAgICAgIHZpc2libGU6IHRoaXMudmlzaWJsZVxyXG4gICAgfVxyXG59XHJcblxyXG52ZWhpY2xlLnByb3RvdHlwZS5yZW5kZXIgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICB2YXIgb3V0ID0gJzxkaXYgY2xhc3M9XCJlbnQgdmVoaWNsZVwiIGRhdGEtaWQ9XCInICsgdGhpcy5pZCArICdcIj4nXHJcblxyXG4gICAgdmFyIHRvZ2dsZUNoYXIgPSB0aGlzLnZpc2libGUgPyAnY2xvc2UnIDogJ29wZW4nXHJcbiAgICBvdXQgKz0gJzxkaXY+PHNwYW4gY2xhc3M9XCJib2xkXCI+JyArIHRoaXMubmFtZSArICc8L3NwYW4+IDxzcGFuIGNsYXNzPVwiaXRhbGljc1wiPicgKyB0aGlzLnR5cGUgKyAnPC9zcGFuPiAnXHJcbiAgICBvdXQgKz0gJzxpbnB1dCB0eXBlPVwiYnV0dG9uXCIgY2xhc3M9XCJ2ZWhpY2xlX3RvZ2dsZVwiIGRhdGEtaWQ9XCInICsgdGhpcy5pZCArICdcIiB2YWx1ZT1cIicgKyB0b2dnbGVDaGFyICsgJ1wiIC8+PGRpdiBjbGFzcz1cImNsZWFyXCI+PC9kaXY+PC9kaXY+J1xyXG5cclxuICAgIGlmICh0aGlzLnZpc2libGUpIHtcclxuICAgICAgICBpZiAodGhpcy5jb21wb25lbnRzLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgICAgb3V0ICs9ICc8ZGl2IGNsYXNzPVwiY29tcG9uZW50c1wiPidcclxuICAgICAgICAgICAgb3V0ICs9ICc8dGFibGUgY2VsbHBhZGRpbmc9XCIwXCIgY2VsbHNwYWNpbmc9XCIyXCIgYm9yZGVyPVwiMFwiPidcclxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSB0aGlzLmNvbXBvbmVudHMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoaSAlIDIgPT09IDApIG91dCArPSAnPHRyPidcclxuXHJcbiAgICAgICAgICAgICAgICBvdXQgKz0gJzx0ZD4nICsgdGhpcy5jb21wb25lbnRzW2ldLnJlbmRlcigpICsgJzwvdGQ+J1xyXG5cclxuICAgICAgICAgICAgICAgIGlmIChpICUgMiAhPT0gMCkgb3V0ICs9ICc8L3RyPidcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAoaSAlIDIgPT09IDApIG91dCArPSAnPC90cj4nXHJcbiAgICAgICAgICAgIG91dCArPSAnPC90YWJsZT4nXHJcbiAgICAgICAgICAgIG91dCArPSAnPC9kaXY+J1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHRoaXMubGluaykgb3V0ICs9ICc8ZGl2PjxhIGhyZWY9XCInICsgdGhpcy5saW5rICsgJ1wiIHRhcmdldD1cIl9ibGFua1wiPkQmRCBCZXlvbmQ8L2E+PC9kaXY+J1xyXG4gICAgfVxyXG5cclxuICAgIG91dCArPSAnPC9kaXY+J1xyXG5cclxuICAgIHJldHVybiBvdXRcclxufVxyXG5cclxudmVoaWNsZS5wcm90b3R5cGUuYXBwbHlEYW1hZ2UgPSBmdW5jdGlvbiAoY29tcG9uZW50SWQsIGRhbWFnZSkge1xyXG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSB0aGlzLmNvbXBvbmVudHMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuY29tcG9uZW50c1tpXS5pZCA9PT0gY29tcG9uZW50SWQpIHtcclxuICAgICAgICAgICAgdGhpcy5jb21wb25lbnRzW2ldLmFwcGx5RGFtYWdlKGRhbWFnZSlcclxuICAgICAgICAgICAgcmV0dXJuIHRydWVcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGZhbHNlXHJcbn1cclxuXHJcbnZlaGljbGUucHJvdG90eXBlLnRvZ2dsZSA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHRoaXMudmlzaWJsZSA9IHRoaXMudmlzaWJsZSA/IGZhbHNlIDogdHJ1ZVxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHZlaGljbGUiLCLvu78ndXNlIHN0cmljdCdcclxuXHJcbnZhciBTdG9yYWdlID0gcmVxdWlyZSgnLi4vYXBwL3N0b3JhZ2UuanMnKVxyXG5cclxudmFyIHdlYXBvbiA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHRoaXMuaWQgPSAwXHJcbiAgICB0aGlzLnBhcmVudElkID0gMFxyXG4gICAgdGhpcy5uYW1lID0gJydcclxuICAgIHRoaXMuZGljZSA9ICcxZDQnXHJcbiAgICB0aGlzLmhpdE1vZCA9IDBcclxuICAgIHRoaXMuYXR0YWNrTW9kID0gMFxyXG4gICAgdGhpcy5kYW1hZ2VUeXBlID0gRGFtYWdlVHlwZS5CbHVkZ2VvbmluZ1xyXG59XHJcblxyXG53ZWFwb24ucHJvdG90eXBlLnBhcnNlID0gZnVuY3Rpb24gKGpzb24pIHtcclxuICAgIGlmICghanNvbikgcmV0dXJuXHJcblxyXG4gICAgaWYgKGpzb24uaWQgJiYgVXRpbHMuaXNOdW1lcmljKGpzb24uaWQpKSB7XHJcbiAgICAgICAgdGhpcy5pZCA9IGpzb24uaWRcclxuICAgIH1cclxuXHJcbiAgICBpZiAodGhpcy5pZCA9PT0gMCkge1xyXG4gICAgICAgIHRoaXMuaWQgPSBTdG9yYWdlLmFzc2lnbklkKClcclxuICAgIH1cclxuXHJcbiAgICBpZiAoanNvbi5wYXJlbnRJZCAmJiBVdGlscy5pc051bWVyaWMoanNvbi5wYXJlbnRJZCkpIHtcclxuICAgICAgICB0aGlzLnBhcmVudElkID0ganNvbi5wYXJlbnRJZFxyXG4gICAgfVxyXG5cclxuICAgIGlmIChqc29uLm5hbWUpIHtcclxuICAgICAgICB0aGlzLm5hbWUgPSBqc29uLm5hbWVcclxuICAgIH1cclxuXHJcbiAgICBpZiAoanNvbi5kaWNlKSB7XHJcbiAgICAgICAgdGhpcy5kaWNlID0ganNvbi5kaWNlXHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGpzb24uaGl0TW9kICYmIFV0aWxzLmlzTnVtZXJpYyhqc29uLmhpdE1vZCkpIHtcclxuICAgICAgICB0aGlzLmhpdE1vZCA9IFV0aWxzLmNsYW1wKGpzb24uaGl0TW9kLCAwLCA5OTkpXHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGpzb24uYXR0YWNrTW9kICYmIFV0aWxzLmlzTnVtZXJpYyhqc29uLmF0dGFja01vZCkpIHtcclxuICAgICAgICB0aGlzLmF0dGFja01vZCA9IFV0aWxzLmNsYW1wKGpzb24uYXR0YWNrTW9kLCAwLCA5OTkpXHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGpzb24uZGFtYWdlVHlwZSkge1xyXG4gICAgICAgIHRoaXMuZGFtYWdlVHlwZSA9IGpzb24uZGFtYWdlVHlwZVxyXG4gICAgfVxyXG59XHJcblxyXG53ZWFwb24ucHJvdG90eXBlLnNlcmlhbGl6ZSA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgaWQ6IHRoaXMuaWQsXHJcbiAgICAgICAgbmFtZTogdGhpcy5uYW1lLFxyXG4gICAgICAgIGRpY2U6IHRoaXMuZGljZSxcclxuICAgICAgICBoaXRNb2Q6IHRoaXMuaGl0TW9kLFxyXG4gICAgICAgIGF0dGFja01vZDogdGhpcy5hdHRhY2tNb2QsXHJcbiAgICAgICAgZGFtYWdlVHlwZTogdGhpcy5kYW1hZ2VUeXBlXHJcbiAgICB9XHJcbn1cclxuXHJcbndlYXBvbi5wcm90b3R5cGUuY2xvbmUgPSBmdW5jdGlvbiAocGFyZW50SWQpIHtcclxuICAgIHZhciB3ID0gbmV3IHdlYXBvbigpXHJcblxyXG4gICAgdy5wYXJzZSh7XHJcbiAgICAgICAgbmFtZTogdGhpcy5uYW1lLFxyXG4gICAgICAgIHBhcmVudElkOiBwYXJlbnRJZCxcclxuICAgICAgICBkaWNlOiB0aGlzLmRpY2UsXHJcbiAgICAgICAgaGl0TW9kOiB0aGlzLmhpdE1vZCxcclxuICAgICAgICBhdHRhY2tNb2Q6IHRoaXMuYXR0YWNrTW9kLFxyXG4gICAgICAgIGRhbWFnZVR5cGU6IHRoaXMuZGFtYWdlVHlwZVxyXG4gICAgfSlcclxuXHJcbiAgICByZXR1cm4gd1xyXG59XHJcblxyXG53ZWFwb24ucHJvdG90eXBlLnJlbmRlciA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHZhciBvdXQgPSAnPHNwYW4gY2xhc3M9XCJib2xkXCI+JyArIHRoaXMubmFtZSArICc8L3NwYW4+OiAxZDIwJ1xyXG4gICAgaWYgKHRoaXMuaGl0TW9kID4gMCkgb3V0ICs9ICcgKyAnICsgdGhpcy5oaXRNb2RcclxuICAgIG91dCArPSAnIHRvIGhpdCwgJyArIHRoaXMuZGljZVxyXG4gICAgaWYgKHRoaXMuYXR0YWNrTW9kID4gMCkgb3V0ICs9ICcgKyAnICsgdGhpcy5hdHRhY2tNb2RcclxuICAgIG91dCArPSAnLCA8c3BhbiBjbGFzcz1cIml0YWxpY1wiPicgKyB0aGlzLmRhbWFnZVR5cGUgKyAnPC9zcGFuPidcclxuXHJcbiAgICByZXR1cm4gb3V0XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gd2VhcG9uIiwi77u/J3VzZSBzdHJpY3QnXHJcblxyXG4vLyBnbG9iYWwgdmFycy9mdW5jdGlvbnNcclxuZ2xvYmFsLkRlYnVnID0gcmVxdWlyZSgnLi91dGlscy9kZWJ1Zy5qcycpXHJcbmdsb2JhbC5VdGlscyA9IHJlcXVpcmUoJy4vdXRpbHMvdXRpbHMuanMnKVxyXG5cclxuLy8gcGFyc2UgYXBwIHNwZWNpZmljIGdsb2JhbHNcclxucmVxdWlyZSgnLi9kbmQvY29uc3RhbnRzLmpzJyk7XHJcblxyXG5nbG9iYWwuRGF0YUZpbGUgPSAnL2pzb24vc3RhdGUuanNvbidcclxuXHJcbnZhciB1aSA9IHJlcXVpcmUoJy4vYXBwL3VpLmpzJylcclxuXHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgcnVuOiB1aS5ydW5cclxufVxyXG5cclxuIiwi77u/J3VzZSBzdHJpY3QnXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHtcclxuICAgIGFzc2VydDogY29uc29sZSA/IGNvbnNvbGUuYXNzZXJ0LmJpbmQoY29uc29sZSkgOiBmdW5jdGlvbiAoKSB7IH0sXHJcbiAgICBjbGVhcjogY29uc29sZSA/IGNvbnNvbGUuY2xlYXIuYmluZChjb25zb2xlKSA6IGZ1bmN0aW9uICgpIHsgfSxcclxuICAgIGVycm9yOiBjb25zb2xlID8gY29uc29sZS5lcnJvci5iaW5kKGNvbnNvbGUpIDogZnVuY3Rpb24gKCkgeyB9LFxyXG4gICAgZ3JvdXA6IGNvbnNvbGUgPyBjb25zb2xlLmdyb3VwLmJpbmQoY29uc29sZSkgOiBmdW5jdGlvbiAoKSB7IH0sXHJcbiAgICBncm91cENvbGxhcHNlZDogY29uc29sZSA/IGNvbnNvbGUuZ3JvdXBDb2xsYXBzZWQuYmluZChjb25zb2xlKSA6IGZ1bmN0aW9uICgpIHsgfSxcclxuICAgIGdyb3VwRW5kOiBjb25zb2xlID8gY29uc29sZS5ncm91cEVuZC5iaW5kKGNvbnNvbGUpIDogZnVuY3Rpb24gKCkgeyB9LFxyXG4gICAgaW5mbzogY29uc29sZSA/IGNvbnNvbGUuaW5mby5iaW5kKGNvbnNvbGUpIDogZnVuY3Rpb24gKCkgeyB9LFxyXG4gICAgbG9nOiBjb25zb2xlID8gY29uc29sZS5sb2cuYmluZChjb25zb2xlKSA6IGZ1bmN0aW9uICgpIHsgfSxcclxuICAgIHRyYWNlOiBjb25zb2xlID8gY29uc29sZS50cmFjZS5iaW5kKGNvbnNvbGUpIDogZnVuY3Rpb24gKCkgeyB9LFxyXG4gICAgd2FybjogY29uc29sZSA/IGNvbnNvbGUud2Fybi5iaW5kKGNvbnNvbGUpIDogZnVuY3Rpb24gKCkgeyB9LFxyXG59XHJcbiIsIu+7vyd1c2Ugc3RyaWN0J1xyXG5cclxudmFyIHJhbmRvbUludCA9IGZ1bmN0aW9uIChtaW4sIG1heCkge1xyXG4gICAgcmV0dXJuIE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIChtYXggLSBtaW4gKyAxKSkgKyBtaW5cclxufVxyXG5cclxudmFyIHJhbmRvbUNoYW5jZSA9IGZ1bmN0aW9uIChwZXJjZW50VHJ1ZSkge1xyXG4gICAgcGVyY2VudFRydWUgPSBwZXJjZW50VHJ1ZSB8fCA1MDtcclxuICAgIHJldHVybiByYW5kb21JbnQoMSwgMTAwKSA8PSBwZXJjZW50VHJ1ZSA/IHRydWUgOiBmYWxzZVxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHtcclxuICAgIGNsYW1wOiAodmFsLCBtaW4sIG1heCkgPT4ge1xyXG4gICAgICAgIGlmICh2YWwgPCBtaW4pXHJcbiAgICAgICAgICAgIHJldHVybiBtaW5cclxuICAgICAgICBpZiAodmFsID4gbWF4KVxyXG4gICAgICAgICAgICByZXR1cm4gbWF4XHJcbiAgICAgICAgcmV0dXJuIHZhbFxyXG4gICAgfSxcclxuXHJcbiAgICBpc051bWVyaWM6IChuKSA9PiB7XHJcbiAgICAgICAgcmV0dXJuICFpc05hTihwYXJzZUZsb2F0KG4pKSAmJiBpc0Zpbml0ZShuKVxyXG4gICAgfSxcclxuXHJcbiAgICByYW5kb21JbnQ6IHJhbmRvbUludCxcclxuXHJcbiAgICByYW5kb21DaGFuY2U6IHJhbmRvbUNoYW5jZVxyXG59XHJcbiIsIu+7vyd1c2Ugc3RyaWN0J1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSB7XHJcbiAgICBpc0FycmF5OiAob2JqKSA9PiB7XHJcbiAgICAgICAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvYmopID09PSAnW29iamVjdCBBcnJheV0nID8gdHJ1ZSA6IGZhbHNlXHJcbiAgICB9LFxyXG5cclxuICAgIGFycmF5Q2xvbmU6IChhcnIpID0+IHtcclxuICAgICAgICByZXR1cm4gYXJyLnNsaWNlKDApXHJcbiAgICB9LFxyXG5cclxuICAgIGlzRnVuY3Rpb246IChvYmopID0+IHtcclxuICAgICAgICByZXR1cm4gdHlwZW9mIG9iaiA9PT0gJ2Z1bmN0aW9uJyA/IHRydWUgOiBmYWxzZVxyXG4gICAgfSxcclxuXHJcbiAgICBpc0ludGVnZXI6ICh2YWx1ZSkgPT4ge1xyXG4gICAgICAgIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInICYmXHJcbiAgICAgICAgICAgIGlzRmluaXRlKHZhbHVlKSAmJlxyXG4gICAgICAgICAgICBNYXRoLmZsb29yKHZhbHVlKSA9PT0gdmFsdWU7XHJcbiAgICB9LFxyXG5cclxuICAgIHN0b3JhZ2VBdmFpbGFibGU6ICh0eXBlKSA9PiB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgdmFyIHN0b3JhZ2UgPSB3aW5kb3dbdHlwZV0sIHggPSAnX19zdG9yYWdlX3Rlc3RfXydcclxuICAgICAgICAgICAgc3RvcmFnZS5zZXRJdGVtKHgsIHgpXHJcbiAgICAgICAgICAgIHN0b3JhZ2UucmVtb3ZlSXRlbSh4KVxyXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZVxyXG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGUgaW5zdGFuY2VvZiBET01FeGNlcHRpb24gJiYgKGUuY29kZSA9PT0gMjIgfHwgZS5jb2RlID09PSAxMDE0IHx8IGUubmFtZSA9PT0gJ1F1b3RhRXhjZWVkZWRFcnJvcicgfHwgZS5uYW1lID09PSAnTlNfRVJST1JfRE9NX1FVT1RBX1JFQUNIRUQnKSAmJiBzdG9yYWdlLmxlbmd0aCAhPT0gMFxyXG4gICAgICAgIH1cclxuICAgIH1cclxufTsiLCLvu78ndXNlIHN0cmljdCdcclxuXHJcbnZhciB1dGlscyA9IHt9XHJcblxyXG52YXIgZW51bWVyYXRlID0gZnVuY3Rpb24gKG9iaikge1xyXG4gICAgZm9yICh2YXIgcHJvcGVydHkgaW4gb2JqKSB7XHJcbiAgICAgICAgaWYgKG9iai5oYXNPd25Qcm9wZXJ0eShwcm9wZXJ0eSkpIHtcclxuICAgICAgICAgICAgdXRpbHNbcHJvcGVydHldID0gb2JqW3Byb3BlcnR5XVxyXG4gICAgICAgIH1cclxuICAgIH1cclxufVxyXG5cclxuZW51bWVyYXRlKHJlcXVpcmUoJy4vbnVtYmVycy5qcycpKVxyXG5lbnVtZXJhdGUocmVxdWlyZSgnLi90b29scy5qcycpKVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSB1dGlsc1xyXG4iXX0=
