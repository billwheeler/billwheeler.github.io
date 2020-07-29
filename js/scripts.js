(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.App = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
module.exports = require('./lib/axios');
},{"./lib/axios":3}],2:[function(require,module,exports){
'use strict';

var utils = require('./../utils');
var settle = require('./../core/settle');
var buildURL = require('./../helpers/buildURL');
var buildFullPath = require('../core/buildFullPath');
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

    var fullPath = buildFullPath(config.baseURL, config.url);
    request.open(config.method.toUpperCase(), buildURL(fullPath, config.params, config.paramsSerializer), true);

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
      var timeoutErrorMessage = 'timeout of ' + config.timeout + 'ms exceeded';
      if (config.timeoutErrorMessage) {
        timeoutErrorMessage = config.timeoutErrorMessage;
      }
      reject(createError(timeoutErrorMessage, config, 'ECONNABORTED',
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
      var xsrfValue = (config.withCredentials || isURLSameOrigin(fullPath)) && config.xsrfCookieName ?
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
    if (!utils.isUndefined(config.withCredentials)) {
      request.withCredentials = !!config.withCredentials;
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

},{"../core/buildFullPath":9,"../core/createError":10,"./../core/settle":14,"./../helpers/buildURL":18,"./../helpers/cookies":20,"./../helpers/isURLSameOrigin":22,"./../helpers/parseHeaders":24,"./../utils":26}],3:[function(require,module,exports){
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

},{"./cancel/Cancel":4,"./cancel/CancelToken":5,"./cancel/isCancel":6,"./core/Axios":7,"./core/mergeConfig":13,"./defaults":16,"./helpers/bind":17,"./helpers/spread":25,"./utils":26}],4:[function(require,module,exports){
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

  // Set config.method
  if (config.method) {
    config.method = config.method.toLowerCase();
  } else if (this.defaults.method) {
    config.method = this.defaults.method.toLowerCase();
  } else {
    config.method = 'get';
  }

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

},{"../helpers/buildURL":18,"./../utils":26,"./InterceptorManager":8,"./dispatchRequest":11,"./mergeConfig":13}],8:[function(require,module,exports){
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

},{"./../utils":26}],9:[function(require,module,exports){
'use strict';

var isAbsoluteURL = require('../helpers/isAbsoluteURL');
var combineURLs = require('../helpers/combineURLs');

/**
 * Creates a new URL by combining the baseURL with the requestedURL,
 * only when the requestedURL is not already an absolute URL.
 * If the requestURL is absolute, this function returns the requestedURL untouched.
 *
 * @param {string} baseURL The base URL
 * @param {string} requestedURL Absolute or relative URL to combine
 * @returns {string} The combined full path
 */
module.exports = function buildFullPath(baseURL, requestedURL) {
  if (baseURL && !isAbsoluteURL(requestedURL)) {
    return combineURLs(baseURL, requestedURL);
  }
  return requestedURL;
};

},{"../helpers/combineURLs":19,"../helpers/isAbsoluteURL":21}],10:[function(require,module,exports){
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

},{"./enhanceError":12}],11:[function(require,module,exports){
'use strict';

var utils = require('./../utils');
var transformData = require('./transformData');
var isCancel = require('../cancel/isCancel');
var defaults = require('../defaults');

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
    config.headers
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

},{"../cancel/isCancel":6,"../defaults":16,"./../utils":26,"./transformData":15}],12:[function(require,module,exports){
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

},{}],13:[function(require,module,exports){
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

  var valueFromConfig2Keys = ['url', 'method', 'params', 'data'];
  var mergeDeepPropertiesKeys = ['headers', 'auth', 'proxy'];
  var defaultToConfig2Keys = [
    'baseURL', 'url', 'transformRequest', 'transformResponse', 'paramsSerializer',
    'timeout', 'withCredentials', 'adapter', 'responseType', 'xsrfCookieName',
    'xsrfHeaderName', 'onUploadProgress', 'onDownloadProgress',
    'maxContentLength', 'validateStatus', 'maxRedirects', 'httpAgent',
    'httpsAgent', 'cancelToken', 'socketPath'
  ];

  utils.forEach(valueFromConfig2Keys, function valueFromConfig2(prop) {
    if (typeof config2[prop] !== 'undefined') {
      config[prop] = config2[prop];
    }
  });

  utils.forEach(mergeDeepPropertiesKeys, function mergeDeepProperties(prop) {
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

  utils.forEach(defaultToConfig2Keys, function defaultToConfig2(prop) {
    if (typeof config2[prop] !== 'undefined') {
      config[prop] = config2[prop];
    } else if (typeof config1[prop] !== 'undefined') {
      config[prop] = config1[prop];
    }
  });

  var axiosKeys = valueFromConfig2Keys
    .concat(mergeDeepPropertiesKeys)
    .concat(defaultToConfig2Keys);

  var otherKeys = Object
    .keys(config2)
    .filter(function filterAxiosKeys(key) {
      return axiosKeys.indexOf(key) === -1;
    });

  utils.forEach(otherKeys, function otherKeysDefaultToConfig2(prop) {
    if (typeof config2[prop] !== 'undefined') {
      config[prop] = config2[prop];
    } else if (typeof config1[prop] !== 'undefined') {
      config[prop] = config1[prop];
    }
  });

  return config;
};

},{"../utils":26}],14:[function(require,module,exports){
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

},{"./createError":10}],15:[function(require,module,exports){
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

},{"./../utils":26}],16:[function(require,module,exports){
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
  if (typeof XMLHttpRequest !== 'undefined') {
    // For browsers use XHR adapter
    adapter = require('./adapters/xhr');
  } else if (typeof process !== 'undefined' && Object.prototype.toString.call(process) === '[object process]') {
    // For node use HTTP adapter
    adapter = require('./adapters/http');
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

},{"./adapters/http":2,"./adapters/xhr":2,"./helpers/normalizeHeaderName":23,"./utils":26,"_process":27}],17:[function(require,module,exports){
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

},{}],18:[function(require,module,exports){
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

},{"./../utils":26}],19:[function(require,module,exports){
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

},{}],20:[function(require,module,exports){
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

},{"./../utils":26}],21:[function(require,module,exports){
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

},{}],22:[function(require,module,exports){
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

},{"./../utils":26}],23:[function(require,module,exports){
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

},{"../utils":26}],24:[function(require,module,exports){
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

},{"./../utils":26}],25:[function(require,module,exports){
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

},{}],26:[function(require,module,exports){
'use strict';

var bind = require('./helpers/bind');

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
 * Determine if a value is undefined
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if the value is undefined, otherwise false
 */
function isUndefined(val) {
  return typeof val === 'undefined';
}

/**
 * Determine if a value is a Buffer
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Buffer, otherwise false
 */
function isBuffer(val) {
  return val !== null && !isUndefined(val) && val.constructor !== null && !isUndefined(val.constructor)
    && typeof val.constructor.isBuffer === 'function' && val.constructor.isBuffer(val);
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

},{"./helpers/bind":17}],27:[function(require,module,exports){
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

  push();
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

    case CharacterAction.Spell:
      player.useSpell(params[0], params[1]);
      break;

    case CharacterAction.Rest:
      player.applyRest();
      break;

    case CharacterAction.Toggle:
      player.toggle();
      break;

    case CharacterAction.ApplyCondition:
      player.condition(params[0], params[1]);
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

    case CharacterAction.Spell:
      currentNpc.useSpell(params[0], params[1]);
      break;

    case CharacterAction.Rest:
      currentNpc.applyRest();
      break;

    case CharacterAction.Toggle:
      currentNpc.toggle();
      break;

    case CharacterAction.ApplyCondition:
      currentNpc.condition(params[0], params[1]);
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

},{"../dnd/npc.js":35,"../dnd/player.js":36,"../dnd/vehicle.js":38}],29:[function(require,module,exports){
(function (global){
'use strict';

var axios = require('axios');

var storageKey = 'OssariaSessionTwentyThree';

var save = function save(data) {
  return localStorage.setItem(storageKey, data);
};

var lastUsedId = 0;

var fetchJson = function fetchJson() {
  return new Promise(function (resolve, reject) {
    axios.get(global.DataFile).then(function (response) {
      save(JSON.stringify(response.data));
      resolve([response.data]);
    })["catch"](function (error) {
      reject(error);
    });
  });
};

var pullInner = function pullInner(raw) {
  return new Promise(function (resolve, reject) {
    try {
      resolve([JSON.parse(raw)]);
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

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _unsupportedIterableToArray(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

function _iterableToArrayLimit(arr, i) { if (typeof Symbol === "undefined" || !(Symbol.iterator in Object(arr))) return; var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

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

        case 'player_condition_remove':
          Entities.updatePlayer(id, CharacterAction.ApplyCondition, [e.target.getAttribute('data-condition'), false]);
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

        case 'npc_condition_remove':
          Entities.updateNpc(id, CharacterAction.ApplyCondition, [e.target.getAttribute('data-condition'), false]);
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
  document.addEventListener('change', function (e) {
    if (e.target) {
      var doUpdate = true;
      var id = parseInt(e.target.getAttribute('data-id'));

      switch (e.target.className) {
        case 'player_condition_add':
          Entities.updatePlayer(id, CharacterAction.ApplyCondition, [e.target.options[e.target.selectedIndex].value, true]);
          break;

        case 'npc_condition_add':
          Entities.updateNpc(id, CharacterAction.ApplyCondition, [e.target.options[e.target.selectedIndex].value, true]);
          break;

        case 'player_exhaustion':
          Entities.updatePlayer(id, CharacterAction.ApplyCondition, [CharacterCondition.Exhaustion, parseInt(e.target.options[e.target.selectedIndex].value)]);
          break;

        case 'npc_exhaustion':
          Entities.updateNpc(id, CharacterAction.ApplyCondition, [CharacterCondition.Exhaustion, parseInt(e.target.options[e.target.selectedIndex].value)]);
          break;

        default:
          doUpdate = false;
      }

      if (doUpdate) update();
    }
  });
};

var run = function run() {
  addListener();
  Storage.pull().then(function (_ref) {
    var _ref2 = _slicedToArray(_ref, 1),
        data = _ref2[0];

    Entities.pull(data);
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
'use strict';

var Storage = require('../app/storage.js');

var conditions = function conditions() {
  this.id = 0;
  this.parentId = 0;
  this.exhaustion = 0;
  this.concentrating = false;
  this.blinded = false;
  this.deafened = false;
  this.charmed = false;
  this.frightened = false;
  this.grappled = false;
  this.incapacitated = false;
  this.invisible = false;
  this.paralyzed = false;
  this.petrified = false;
  this.poisoned = false;
  this.prone = false;
  this.restrained = false;
  this.stunned = false;
  this.unconscious = false;
  this.hexed = false;
  this.huntersmark = false;
  this.isPlayer = false;
};

conditions.prototype.parse = function (json) {
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

  if (json.exhaustion && Utils.isNumeric(json.exhaustion)) {
    this.exhaustion = Utils.clamp(json.exhaustion, 0, 6);
  }

  if (json.concentrating) this.concentrating = json.concentrating;
  if (json.blinded) this.blinded = json.blinded;
  if (json.deafened) this.deafened = json.deafened;
  if (json.charmed) this.charmed = json.charmed;
  if (json.blinded) this.blinded = json.blinded;
  if (json.deafened) this.deafened = json.deafened;
  if (json.charmed) this.charmed = json.charmed;
  if (json.frightened) this.frightened = json.frightened;
  if (json.grappled) this.grappled = json.grappled;
  if (json.incapacitated) this.incapacitated = json.incapacitated;
  if (json.invisible) this.invisible = json.invisible;
  if (json.paralyzed) this.paralyzed = json.paralyzed;
  if (json.petrified) this.petrified = json.petrified;
  if (json.poisoned) this.poisoned = json.poisoned;
  if (json.prone) this.prone = json.prone;
  if (json.restrained) this.restrained = json.restrained;
  if (json.stunned) this.stunned = json.stunned;
  if (json.unconscious) this.unconscious = json.unconscious;
  if (json.hexed) this.hexed = json.hexed;
  if (json.huntersmark) this.huntersmark = json.huntersmark;
};

conditions.prototype.serialize = function () {
  return {
    id: this.id,
    parentId: this.parentId,
    exhaustion: Utils.clamp(this.exhaustion, 0, 6),
    concentrating: this.concentrating,
    blinded: this.blinded,
    deafened: this.deafened,
    charmed: this.charmed,
    cursed: this.cursed,
    frightened: this.frightened,
    grappled: this.grappled,
    incapacitated: this.incapacitated,
    invisible: this.invisible,
    paralyzed: this.paralyzed,
    petrified: this.petrified,
    poisoned: this.poisoned,
    prone: this.prone,
    restrained: this.restrained,
    stunned: this.stunned,
    unconscious: this.unconscious,
    hexed: this.hexed,
    huntersmark: this.huntersmark
  };
};

conditions.prototype.clone = function (parentId) {
  var c = new conditions();
  c.parse({
    parentId: parentId,
    concentrating: false,
    exhaustion: 0,
    blinded: false,
    deafened: false,
    charmed: false,
    cursed: false,
    frightened: false,
    grappled: false,
    incapacitated: false,
    invisible: false,
    paralyzed: false,
    petrified: false,
    poisoned: false,
    prone: false,
    restrained: false,
    stunned: false,
    unconscious: false,
    hexed: false,
    huntersmark: false
  });
  return c;
};

conditions.prototype.setValue = function (key, value) {
  switch (key) {
    case CharacterCondition.Concentrating:
      this.concentrating = value ? true : false;
      break;

    case CharacterCondition.Exhaustion:
      this.exhaustion = Utils.isNumeric(value) ? Utils.clamp(value, 0, 6) : 0;
      break;

    case CharacterCondition.Blinded:
      this.blinded = value ? true : false;
      break;

    case CharacterCondition.Deafened:
      this.deafened = value ? true : false;
      break;

    case CharacterCondition.Charmed:
      this.charmed = value ? true : false;
      break;

    case CharacterCondition.Cursed:
      this.cursed = value ? true : false;
      break;

    case CharacterCondition.Frightened:
      this.frightened = value ? true : false;
      break;

    case CharacterCondition.Grappled:
      this.grappled = value ? true : false;
      break;

    case CharacterCondition.Incapacitated:
      this.incapacitated = value ? true : false;
      break;

    case CharacterCondition.Invisible:
      this.invisible = value ? true : false;
      break;

    case CharacterCondition.Paralyzed:
      this.paralyzed = value ? true : false;
      break;

    case CharacterCondition.Petrified:
      this.petrified = value ? true : false;
      break;

    case CharacterCondition.Poisoned:
      this.poisoned = value ? true : false;
      break;

    case CharacterCondition.Prone:
      this.prone = value ? true : false;
      break;

    case CharacterCondition.Restrained:
      this.restrained = value ? true : false;
      break;

    case CharacterCondition.Stunned:
      this.stunned = value ? true : false;
      break;

    case CharacterCondition.Unconscious:
      this.unconscious = value ? true : false;
      break;

    case CharacterCondition.Hexed:
      this.hexed = value ? true : false;
      break;

    case CharacterCondition.HuntersMark:
      this.huntersmark = value ? true : false;
      break;
  }
};

conditions.prototype.render = function () {
  var out = '';
  if (this.isPlayer) out += '<select class="player_condition_add" data-id="' + this.parentId + '">';else out += '<select class="npc_condition_add" data-id="' + this.parentId + '">';
  out += '<option value="0"> -- Select -- </option>';
  out += '<option value="' + CharacterCondition.Blinded + '">Blinded</option>';
  out += '<option value="' + CharacterCondition.Charmed + '">Charmed</option>';
  out += '<option value="' + CharacterCondition.Concentrating + '">Concentrating</option>';
  out += '<option value="' + CharacterCondition.Cursed + '">Cursed</option>';
  out += '<option value="' + CharacterCondition.Deafened + '">Deafened</option>';
  out += '<option value="' + CharacterCondition.Frightened + '">Frightened</option>';
  out += '<option value="' + CharacterCondition.Grappled + '">Grappled</option>';
  out += '<option value="' + CharacterCondition.Hexed + '">Hexed</option>';
  out += '<option value="' + CharacterCondition.HuntersMark + '">Hunter\'s Mark</option>';
  out += '<option value="' + CharacterCondition.Incapacitated + '">Incapacitated</option>';
  out += '<option value="' + CharacterCondition.Invisible + '">Invisible</option>';
  out += '<option value="' + CharacterCondition.Paralyzed + '">Paralyzed</option>';
  out += '<option value="' + CharacterCondition.Petrified + '">Petrified</option>';
  out += '<option value="' + CharacterCondition.Poisoned + '">Poisoned</option>';
  out += '<option value="' + CharacterCondition.Prone + '">Prone</option>';
  out += '<option value="' + CharacterCondition.Restrained + '">Restrained</option>';
  out += '<option value="' + CharacterCondition.Stunned + '">Stunned</option>';
  out += '<option value="' + CharacterCondition.Unconscious + '">Unconscious</option>';
  out += '</select>';

  if (this.isPlayer) {
    out += '<label>Exhausion: ';
    out += '<select class="player_exhaustion" data-id="' + this.parentId + '">';
    out += this.exhaustion === 0 ? '<option selected="selected" value="0">0</option>' : '<option value="0">0</option>';
    out += this.exhaustion === 1 ? '<option selected="selected" value="1">1</option>' : '<option value="1">1</option>';
    out += this.exhaustion === 2 ? '<option selected="selected" value="2">2</option>' : '<option value="2">2</option>';
    out += this.exhaustion === 3 ? '<option selected="selected" value="3">3</option>' : '<option value="3">3</option>';
    out += this.exhaustion === 4 ? '<option selected="selected" value="4">4</option>' : '<option value="4">4</option>';
    out += this.exhaustion === 5 ? '<option selected="selected" value="5">5</option>' : '<option value="5">5</option>';
    out += '</select>';
    out += '</label>';
  }

  if (this.isPlayer) out += '<div class="player_conditions">';else out += '<div class="npc_conditions">';
  var removeClass = this.isPlayer ? 'player_condition_remove' : 'npc_condition_remove';
  if (this.blinded) out += '<div class="' + removeClass + '" data-id="' + this.parentId + '" data-condition="' + CharacterCondition.Blinded + '">Blinded</div>';
  if (this.charmed) out += '<div class="' + removeClass + '" data-id="' + this.parentId + '" data-condition="' + CharacterCondition.Charmed + '">Charmed</div>';
  if (this.concentrating) out += '<div class="' + removeClass + '" data-id="' + this.parentId + '" data-condition="' + CharacterCondition.Concentrating + '">Concentrating</div>';
  if (this.cursed) out += '<div class="' + removeClass + '" data-id="' + this.parentId + '" data-condition="' + CharacterCondition.Cursed + '">Cursed</div>';
  if (this.deafened) out += '<div class="' + removeClass + '" data-id="' + this.parentId + '" data-condition="' + CharacterCondition.Deafened + '">Deafened</div>';
  if (this.frightened) out += '<div class="' + removeClass + '" data-id="' + this.parentId + '" data-condition="' + CharacterCondition.Frightened + '">Frightened</div>';
  if (this.grappled) out += '<div class="' + removeClass + '" data-id="' + this.parentId + '" data-condition="' + CharacterCondition.Grappled + '">Grappled</div>';
  if (this.hexed) out += '<div class="' + removeClass + '" data-id="' + this.parentId + '" data-condition="' + CharacterCondition.Hexed + '">Hexed</div>';
  if (this.huntersmark) out += '<div class="' + removeClass + '" data-id="' + this.parentId + '" data-condition="' + CharacterCondition.HuntersMark + '">Hunter\'s Mark</div>';
  if (this.incapacitated) out += '<div class="' + removeClass + '" data-id="' + this.parentId + '" data-condition="' + CharacterCondition.Incapacitated + '">Incapacitated</div>';
  if (this.invisible) out += '<div class="' + removeClass + '" data-id="' + this.parentId + '" data-condition="' + CharacterCondition.Invisible + '">Invisible</div>';
  if (this.paralyzed) out += '<div class="' + removeClass + '" data-id="' + this.parentId + '" data-condition="' + CharacterCondition.Paralyzed + '">Paralyzed</div>';
  if (this.petrified) out += '<div class="' + removeClass + '" data-id="' + this.parentId + '" data-condition="' + CharacterCondition.Petrified + '">Petrified</div>';
  if (this.poisoned) out += '<div class="' + removeClass + '" data-id="' + this.parentId + '" data-condition="' + CharacterCondition.Poisoned + '">Poisoned</div>';
  if (this.prone) out += '<div class="' + removeClass + '" data-id="' + this.parentId + '" data-condition="' + CharacterCondition.Prone + '">Prone</div>';
  if (this.restrained) out += '<div class="' + removeClass + '" data-id="' + this.parentId + '" data-condition="' + CharacterCondition.Restrained + '">Restrained</div>';
  if (this.stunned) out += '<div class="' + removeClass + '" data-id="' + this.parentId + '" data-condition="' + CharacterCondition.Stunned + '">Stunned</div>';
  if (this.unconscious) out += '<div class="' + removeClass + '" data-id="' + this.parentId + '" data-condition="' + CharacterCondition.Unconscious + '">Unconscious</div>';
  out += '<div class="clear"></div></div>';
  return out;
};

module.exports = conditions;

},{"../app/storage.js":29}],33:[function(require,module,exports){
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
  Toggle: 'toggle',
  ApplyCondition: 'apply-condition'
};
global.CharacterCondition = {
  Concentrating: 'concentrating',
  Exhaustion: 'exhaustion',
  Blinded: 'blinded',
  Deafened: 'deafened',
  Charmed: 'charmed',
  Cursed: 'cursed',
  Frightened: 'frightened',
  Grappled: 'grappled',
  Incapacitated: 'incapacitated',
  Invisible: 'invisible',
  Paralyzed: 'paralyzed',
  Petrified: 'petrified',
  Poisoned: 'poisoned',
  Prone: 'prone',
  Restrained: 'restrained',
  Stunned: 'stunned',
  Unconscious: 'unconscious',
  Hexed: 'hexed',
  HuntersMark: 'huntersmark'
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

},{}],34:[function(require,module,exports){
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

},{}],35:[function(require,module,exports){
'use strict';

var Weapon = require('./weapon.js');

var Spell = require('./spell.js');

var Conditions = require('./conditions.js');

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
  this.state = CharacterState.Idle;
  this.link = '';
  this.image = '';
  this.initMod = 0;
  this.template = false;
  this.instance = 0;
  this.visible = false;
  this.conditions = null;
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

  if (json.link) {
    this.link = json.link;
  }

  if (json.image) {
    this.image = json.image;
  }

  if (json.template) {
    this.template = json.template;
  }

  if (json.initMod && Utils.isNumeric(json.initMod)) {
    this.initMod = json.initMod;
  }

  if (json.visible) {
    this.visible = json.visible;
  }

  var c = new Conditions();
  if (c.parentId === 0) c.parentId = this.id;
  this.conditions = c;
  if (json.conditions) c.parse(json.conditions);
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
    maxHealth: this.maxHealth,
    armor: this.armor,
    speed: this.speed,
    race: this.race,
    initiative: this.initiative,
    weapons: weapons,
    spells: spells,
    state: this.state,
    link: this.link,
    image: this.image,
    initMod: this.initMod,
    template: this.template,
    instance: this.instance,
    visible: this.visible,
    conditions: this.conditions.serialize()
  };
  return out;
};

npc.prototype.render = function () {
  var classes = 'ent npc';
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
      out += '<div>';
      out += '<input type="button" class="npc_rest" value="Rest" data-id="' + this.id + '" />';
      out += '<input type="button" class="npc_leave" value="Leave Encounter" data-id="' + this.id + '" />';
      out += '<input type="button" class="npc_die" value="Die" data-id="' + this.id + '" />';
      out += '</div>';
      if (this.conditions) out += this.conditions.render();
    } else if (this.state === CharacterState.Idle) {
      out += '<div>';
      out += '<input type="button" class="npc_initiative" value="Roll Initiative" data-id="' + this.id + '" />&nbsp;'; // template npc's can't do these things

      if (!this.template) {
        out += '<input type="button" class="npc_rest" value="Rest" data-id="' + this.id + '" />&nbsp;';
        out += '<input type="button" class="npc_die" value="Die" data-id="' + this.id + '" />';
      }

      out += '</div>';
      if (!this.template && this.conditions) out += this.conditions.render();
    } else if (this.state === CharacterState.Dead) {
      out += '<div><input type="button" class="npc_revive" value="Revive NPC" data-id="' + this.id + '" /></div>';
    }

    if (this.link || this.image) {
      out += '<div>';
      if (this.link) out += '<a href="' + this.link + '" target="_blank">D&D Beyond</a>';
      if (this.link && this.image) out += '&nbsp;&amp;&nbsp;';
      if (this.image) out += '<a href="' + this.image + '" target="_blank">Image</a>';
      out += '</div>';
    }
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
    image: this.image,
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

npc.prototype.toggle = function () {
  this.visible = this.visible ? false : true;
};

npc.prototype.condition = function (key, value) {
  if (this.conditions) this.conditions.setValue(key, value);
};

module.exports = npc;

},{"../app/storage.js":29,"../dnd/dice.js":34,"./conditions.js":32,"./spell.js":37,"./weapon.js":39}],36:[function(require,module,exports){
'use strict';

var Storage = require('../app/storage.js');

var Conditions = require('./conditions.js');

var player = function player() {
  this.id = 0;
  this.name = '';
  this.player = '';
  this.initiative = 0;
  this.state = CharacterState.Idle;
  this.link = '';
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

  if (json.link) {
    this.link = json.link;
  }

  if (json.visible) {
    this.visible = json.visible;
  }

  var c = new Conditions();
  if (c.parentId === 0) c.parentId = this.id;
  c.isPlayer = true;
  this.conditions = c;
  if (json.conditions) c.parse(json.conditions);
};

player.prototype.serialize = function () {
  return {
    id: this.id,
    name: this.name,
    player: this.player,
    initiative: this.initiative,
    state: this.state,
    link: this.link,
    visible: this.visible,
    conditions: this.conditions.serialize()
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
      out += '<input type="button" class="player_leave" value="Leave Encounter" data-id="' + this.id + '" />';
      out += '<input type="button" class="player_die" value="Die" data-id="' + this.id + '" />';
      out += '</div>';
      if (this.conditions) out += this.conditions.render();
    } else if (this.state === CharacterState.Idle) {
      out += '<div>';
      out += '<input type="button" class="player_initiative" value="Apply Initiatve" data-id="' + this.id + '" /><input type="text" id="player_initiative_' + this.id + '" />';
      out += '<input type="button" class="player_die" value="Die" data-id="' + this.id + '" />';
      out += '</div>';
      if (this.conditions) out += this.conditions.render();
    } else if (this.state === CharacterState.Dead) {
      out += '<div><input type="button" class="player_revive" value="Revive Player" data-id="' + this.id + '" /></div>';
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

player.prototype.toggle = function () {
  this.visible = this.visible ? false : true;
};

player.prototype.condition = function (key, value) {
  if (this.conditions) this.conditions.setValue(key, value);
};

module.exports = player;

},{"../app/storage.js":29,"./conditions.js":32}],37:[function(require,module,exports){
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

},{"../app/storage.js":29}],38:[function(require,module,exports){
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

},{"../app/storage.js":29,"./component.js":31}],39:[function(require,module,exports){
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

},{"../app/storage.js":29}],40:[function(require,module,exports){
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

},{"./app/ui.js":30,"./dnd/constants.js":33,"./utils/debug.js":41,"./utils/utils.js":44}],41:[function(require,module,exports){
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

},{}],42:[function(require,module,exports){
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

},{}],43:[function(require,module,exports){
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

},{}],44:[function(require,module,exports){
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

},{"./numbers.js":42,"./tools.js":43}]},{},[40])(40)
});

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYXhpb3MvaW5kZXguanMiLCJub2RlX21vZHVsZXMvYXhpb3MvbGliL2FkYXB0ZXJzL3hoci5qcyIsIm5vZGVfbW9kdWxlcy9heGlvcy9saWIvYXhpb3MuanMiLCJub2RlX21vZHVsZXMvYXhpb3MvbGliL2NhbmNlbC9DYW5jZWwuanMiLCJub2RlX21vZHVsZXMvYXhpb3MvbGliL2NhbmNlbC9DYW5jZWxUb2tlbi5qcyIsIm5vZGVfbW9kdWxlcy9heGlvcy9saWIvY2FuY2VsL2lzQ2FuY2VsLmpzIiwibm9kZV9tb2R1bGVzL2F4aW9zL2xpYi9jb3JlL0F4aW9zLmpzIiwibm9kZV9tb2R1bGVzL2F4aW9zL2xpYi9jb3JlL0ludGVyY2VwdG9yTWFuYWdlci5qcyIsIm5vZGVfbW9kdWxlcy9heGlvcy9saWIvY29yZS9idWlsZEZ1bGxQYXRoLmpzIiwibm9kZV9tb2R1bGVzL2F4aW9zL2xpYi9jb3JlL2NyZWF0ZUVycm9yLmpzIiwibm9kZV9tb2R1bGVzL2F4aW9zL2xpYi9jb3JlL2Rpc3BhdGNoUmVxdWVzdC5qcyIsIm5vZGVfbW9kdWxlcy9heGlvcy9saWIvY29yZS9lbmhhbmNlRXJyb3IuanMiLCJub2RlX21vZHVsZXMvYXhpb3MvbGliL2NvcmUvbWVyZ2VDb25maWcuanMiLCJub2RlX21vZHVsZXMvYXhpb3MvbGliL2NvcmUvc2V0dGxlLmpzIiwibm9kZV9tb2R1bGVzL2F4aW9zL2xpYi9jb3JlL3RyYW5zZm9ybURhdGEuanMiLCJub2RlX21vZHVsZXMvYXhpb3MvbGliL2RlZmF1bHRzLmpzIiwibm9kZV9tb2R1bGVzL2F4aW9zL2xpYi9oZWxwZXJzL2JpbmQuanMiLCJub2RlX21vZHVsZXMvYXhpb3MvbGliL2hlbHBlcnMvYnVpbGRVUkwuanMiLCJub2RlX21vZHVsZXMvYXhpb3MvbGliL2hlbHBlcnMvY29tYmluZVVSTHMuanMiLCJub2RlX21vZHVsZXMvYXhpb3MvbGliL2hlbHBlcnMvY29va2llcy5qcyIsIm5vZGVfbW9kdWxlcy9heGlvcy9saWIvaGVscGVycy9pc0Fic29sdXRlVVJMLmpzIiwibm9kZV9tb2R1bGVzL2F4aW9zL2xpYi9oZWxwZXJzL2lzVVJMU2FtZU9yaWdpbi5qcyIsIm5vZGVfbW9kdWxlcy9heGlvcy9saWIvaGVscGVycy9ub3JtYWxpemVIZWFkZXJOYW1lLmpzIiwibm9kZV9tb2R1bGVzL2F4aW9zL2xpYi9oZWxwZXJzL3BhcnNlSGVhZGVycy5qcyIsIm5vZGVfbW9kdWxlcy9heGlvcy9saWIvaGVscGVycy9zcHJlYWQuanMiLCJub2RlX21vZHVsZXMvYXhpb3MvbGliL3V0aWxzLmpzIiwibm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qcyIsInNyYy9hcHAvZW50aXRpZXMuanMiLCJzcmMvYXBwL3N0b3JhZ2UuanMiLCJzcmMvYXBwL3VpLmpzIiwic3JjL2RuZC9jb21wb25lbnQuanMiLCJzcmMvZG5kL2NvbmRpdGlvbnMuanMiLCJzcmMvZG5kL2NvbnN0YW50cy5qcyIsInNyYy9kbmQvZGljZS5qcyIsInNyYy9kbmQvbnBjLmpzIiwic3JjL2RuZC9wbGF5ZXIuanMiLCJzcmMvZG5kL3NwZWxsLmpzIiwic3JjL2RuZC92ZWhpY2xlLmpzIiwic3JjL2RuZC93ZWFwb24uanMiLCJzcmMvbWFpbi5qcyIsInNyYy91dGlscy9kZWJ1Zy5qcyIsInNyYy91dGlscy9udW1iZXJzLmpzIiwic3JjL3V0aWxzL3Rvb2xzLmpzIiwic3JjL3V0aWxzL3V0aWxzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcExBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9FQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNwQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ2pHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNaQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeFZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFD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QUQsQ0FBUixDQUFUO0FBQ0EsU0FBUyxDQUFDLE9BQU8sQ0FBQyxZQUFELENBQVIsQ0FBVDtBQUVBLE1BQU0sQ0FBQyxPQUFQLEdBQWlCLEtBQWpCIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oKXtmdW5jdGlvbiByKGUsbix0KXtmdW5jdGlvbiBvKGksZil7aWYoIW5baV0pe2lmKCFlW2ldKXt2YXIgYz1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlO2lmKCFmJiZjKXJldHVybiBjKGksITApO2lmKHUpcmV0dXJuIHUoaSwhMCk7dmFyIGE9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitpK1wiJ1wiKTt0aHJvdyBhLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsYX12YXIgcD1uW2ldPXtleHBvcnRzOnt9fTtlW2ldWzBdLmNhbGwocC5leHBvcnRzLGZ1bmN0aW9uKHIpe3ZhciBuPWVbaV1bMV1bcl07cmV0dXJuIG8obnx8cil9LHAscC5leHBvcnRzLHIsZSxuLHQpfXJldHVybiBuW2ldLmV4cG9ydHN9Zm9yKHZhciB1PVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmUsaT0wO2k8dC5sZW5ndGg7aSsrKW8odFtpXSk7cmV0dXJuIG99cmV0dXJuIHJ9KSgpIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL2xpYi9heGlvcycpOyIsIid1c2Ugc3RyaWN0JztcblxudmFyIHV0aWxzID0gcmVxdWlyZSgnLi8uLi91dGlscycpO1xudmFyIHNldHRsZSA9IHJlcXVpcmUoJy4vLi4vY29yZS9zZXR0bGUnKTtcbnZhciBidWlsZFVSTCA9IHJlcXVpcmUoJy4vLi4vaGVscGVycy9idWlsZFVSTCcpO1xudmFyIGJ1aWxkRnVsbFBhdGggPSByZXF1aXJlKCcuLi9jb3JlL2J1aWxkRnVsbFBhdGgnKTtcbnZhciBwYXJzZUhlYWRlcnMgPSByZXF1aXJlKCcuLy4uL2hlbHBlcnMvcGFyc2VIZWFkZXJzJyk7XG52YXIgaXNVUkxTYW1lT3JpZ2luID0gcmVxdWlyZSgnLi8uLi9oZWxwZXJzL2lzVVJMU2FtZU9yaWdpbicpO1xudmFyIGNyZWF0ZUVycm9yID0gcmVxdWlyZSgnLi4vY29yZS9jcmVhdGVFcnJvcicpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIHhockFkYXB0ZXIoY29uZmlnKSB7XG4gIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiBkaXNwYXRjaFhoclJlcXVlc3QocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgdmFyIHJlcXVlc3REYXRhID0gY29uZmlnLmRhdGE7XG4gICAgdmFyIHJlcXVlc3RIZWFkZXJzID0gY29uZmlnLmhlYWRlcnM7XG5cbiAgICBpZiAodXRpbHMuaXNGb3JtRGF0YShyZXF1ZXN0RGF0YSkpIHtcbiAgICAgIGRlbGV0ZSByZXF1ZXN0SGVhZGVyc1snQ29udGVudC1UeXBlJ107IC8vIExldCB0aGUgYnJvd3NlciBzZXQgaXRcbiAgICB9XG5cbiAgICB2YXIgcmVxdWVzdCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuXG4gICAgLy8gSFRUUCBiYXNpYyBhdXRoZW50aWNhdGlvblxuICAgIGlmIChjb25maWcuYXV0aCkge1xuICAgICAgdmFyIHVzZXJuYW1lID0gY29uZmlnLmF1dGgudXNlcm5hbWUgfHwgJyc7XG4gICAgICB2YXIgcGFzc3dvcmQgPSBjb25maWcuYXV0aC5wYXNzd29yZCB8fCAnJztcbiAgICAgIHJlcXVlc3RIZWFkZXJzLkF1dGhvcml6YXRpb24gPSAnQmFzaWMgJyArIGJ0b2EodXNlcm5hbWUgKyAnOicgKyBwYXNzd29yZCk7XG4gICAgfVxuXG4gICAgdmFyIGZ1bGxQYXRoID0gYnVpbGRGdWxsUGF0aChjb25maWcuYmFzZVVSTCwgY29uZmlnLnVybCk7XG4gICAgcmVxdWVzdC5vcGVuKGNvbmZpZy5tZXRob2QudG9VcHBlckNhc2UoKSwgYnVpbGRVUkwoZnVsbFBhdGgsIGNvbmZpZy5wYXJhbXMsIGNvbmZpZy5wYXJhbXNTZXJpYWxpemVyKSwgdHJ1ZSk7XG5cbiAgICAvLyBTZXQgdGhlIHJlcXVlc3QgdGltZW91dCBpbiBNU1xuICAgIHJlcXVlc3QudGltZW91dCA9IGNvbmZpZy50aW1lb3V0O1xuXG4gICAgLy8gTGlzdGVuIGZvciByZWFkeSBzdGF0ZVxuICAgIHJlcXVlc3Qub25yZWFkeXN0YXRlY2hhbmdlID0gZnVuY3Rpb24gaGFuZGxlTG9hZCgpIHtcbiAgICAgIGlmICghcmVxdWVzdCB8fCByZXF1ZXN0LnJlYWR5U3RhdGUgIT09IDQpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICAvLyBUaGUgcmVxdWVzdCBlcnJvcmVkIG91dCBhbmQgd2UgZGlkbid0IGdldCBhIHJlc3BvbnNlLCB0aGlzIHdpbGwgYmVcbiAgICAgIC8vIGhhbmRsZWQgYnkgb25lcnJvciBpbnN0ZWFkXG4gICAgICAvLyBXaXRoIG9uZSBleGNlcHRpb246IHJlcXVlc3QgdGhhdCB1c2luZyBmaWxlOiBwcm90b2NvbCwgbW9zdCBicm93c2Vyc1xuICAgICAgLy8gd2lsbCByZXR1cm4gc3RhdHVzIGFzIDAgZXZlbiB0aG91Z2ggaXQncyBhIHN1Y2Nlc3NmdWwgcmVxdWVzdFxuICAgICAgaWYgKHJlcXVlc3Quc3RhdHVzID09PSAwICYmICEocmVxdWVzdC5yZXNwb25zZVVSTCAmJiByZXF1ZXN0LnJlc3BvbnNlVVJMLmluZGV4T2YoJ2ZpbGU6JykgPT09IDApKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgLy8gUHJlcGFyZSB0aGUgcmVzcG9uc2VcbiAgICAgIHZhciByZXNwb25zZUhlYWRlcnMgPSAnZ2V0QWxsUmVzcG9uc2VIZWFkZXJzJyBpbiByZXF1ZXN0ID8gcGFyc2VIZWFkZXJzKHJlcXVlc3QuZ2V0QWxsUmVzcG9uc2VIZWFkZXJzKCkpIDogbnVsbDtcbiAgICAgIHZhciByZXNwb25zZURhdGEgPSAhY29uZmlnLnJlc3BvbnNlVHlwZSB8fCBjb25maWcucmVzcG9uc2VUeXBlID09PSAndGV4dCcgPyByZXF1ZXN0LnJlc3BvbnNlVGV4dCA6IHJlcXVlc3QucmVzcG9uc2U7XG4gICAgICB2YXIgcmVzcG9uc2UgPSB7XG4gICAgICAgIGRhdGE6IHJlc3BvbnNlRGF0YSxcbiAgICAgICAgc3RhdHVzOiByZXF1ZXN0LnN0YXR1cyxcbiAgICAgICAgc3RhdHVzVGV4dDogcmVxdWVzdC5zdGF0dXNUZXh0LFxuICAgICAgICBoZWFkZXJzOiByZXNwb25zZUhlYWRlcnMsXG4gICAgICAgIGNvbmZpZzogY29uZmlnLFxuICAgICAgICByZXF1ZXN0OiByZXF1ZXN0XG4gICAgICB9O1xuXG4gICAgICBzZXR0bGUocmVzb2x2ZSwgcmVqZWN0LCByZXNwb25zZSk7XG5cbiAgICAgIC8vIENsZWFuIHVwIHJlcXVlc3RcbiAgICAgIHJlcXVlc3QgPSBudWxsO1xuICAgIH07XG5cbiAgICAvLyBIYW5kbGUgYnJvd3NlciByZXF1ZXN0IGNhbmNlbGxhdGlvbiAoYXMgb3Bwb3NlZCB0byBhIG1hbnVhbCBjYW5jZWxsYXRpb24pXG4gICAgcmVxdWVzdC5vbmFib3J0ID0gZnVuY3Rpb24gaGFuZGxlQWJvcnQoKSB7XG4gICAgICBpZiAoIXJlcXVlc3QpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICByZWplY3QoY3JlYXRlRXJyb3IoJ1JlcXVlc3QgYWJvcnRlZCcsIGNvbmZpZywgJ0VDT05OQUJPUlRFRCcsIHJlcXVlc3QpKTtcblxuICAgICAgLy8gQ2xlYW4gdXAgcmVxdWVzdFxuICAgICAgcmVxdWVzdCA9IG51bGw7XG4gICAgfTtcblxuICAgIC8vIEhhbmRsZSBsb3cgbGV2ZWwgbmV0d29yayBlcnJvcnNcbiAgICByZXF1ZXN0Lm9uZXJyb3IgPSBmdW5jdGlvbiBoYW5kbGVFcnJvcigpIHtcbiAgICAgIC8vIFJlYWwgZXJyb3JzIGFyZSBoaWRkZW4gZnJvbSB1cyBieSB0aGUgYnJvd3NlclxuICAgICAgLy8gb25lcnJvciBzaG91bGQgb25seSBmaXJlIGlmIGl0J3MgYSBuZXR3b3JrIGVycm9yXG4gICAgICByZWplY3QoY3JlYXRlRXJyb3IoJ05ldHdvcmsgRXJyb3InLCBjb25maWcsIG51bGwsIHJlcXVlc3QpKTtcblxuICAgICAgLy8gQ2xlYW4gdXAgcmVxdWVzdFxuICAgICAgcmVxdWVzdCA9IG51bGw7XG4gICAgfTtcblxuICAgIC8vIEhhbmRsZSB0aW1lb3V0XG4gICAgcmVxdWVzdC5vbnRpbWVvdXQgPSBmdW5jdGlvbiBoYW5kbGVUaW1lb3V0KCkge1xuICAgICAgdmFyIHRpbWVvdXRFcnJvck1lc3NhZ2UgPSAndGltZW91dCBvZiAnICsgY29uZmlnLnRpbWVvdXQgKyAnbXMgZXhjZWVkZWQnO1xuICAgICAgaWYgKGNvbmZpZy50aW1lb3V0RXJyb3JNZXNzYWdlKSB7XG4gICAgICAgIHRpbWVvdXRFcnJvck1lc3NhZ2UgPSBjb25maWcudGltZW91dEVycm9yTWVzc2FnZTtcbiAgICAgIH1cbiAgICAgIHJlamVjdChjcmVhdGVFcnJvcih0aW1lb3V0RXJyb3JNZXNzYWdlLCBjb25maWcsICdFQ09OTkFCT1JURUQnLFxuICAgICAgICByZXF1ZXN0KSk7XG5cbiAgICAgIC8vIENsZWFuIHVwIHJlcXVlc3RcbiAgICAgIHJlcXVlc3QgPSBudWxsO1xuICAgIH07XG5cbiAgICAvLyBBZGQgeHNyZiBoZWFkZXJcbiAgICAvLyBUaGlzIGlzIG9ubHkgZG9uZSBpZiBydW5uaW5nIGluIGEgc3RhbmRhcmQgYnJvd3NlciBlbnZpcm9ubWVudC5cbiAgICAvLyBTcGVjaWZpY2FsbHkgbm90IGlmIHdlJ3JlIGluIGEgd2ViIHdvcmtlciwgb3IgcmVhY3QtbmF0aXZlLlxuICAgIGlmICh1dGlscy5pc1N0YW5kYXJkQnJvd3NlckVudigpKSB7XG4gICAgICB2YXIgY29va2llcyA9IHJlcXVpcmUoJy4vLi4vaGVscGVycy9jb29raWVzJyk7XG5cbiAgICAgIC8vIEFkZCB4c3JmIGhlYWRlclxuICAgICAgdmFyIHhzcmZWYWx1ZSA9IChjb25maWcud2l0aENyZWRlbnRpYWxzIHx8IGlzVVJMU2FtZU9yaWdpbihmdWxsUGF0aCkpICYmIGNvbmZpZy54c3JmQ29va2llTmFtZSA/XG4gICAgICAgIGNvb2tpZXMucmVhZChjb25maWcueHNyZkNvb2tpZU5hbWUpIDpcbiAgICAgICAgdW5kZWZpbmVkO1xuXG4gICAgICBpZiAoeHNyZlZhbHVlKSB7XG4gICAgICAgIHJlcXVlc3RIZWFkZXJzW2NvbmZpZy54c3JmSGVhZGVyTmFtZV0gPSB4c3JmVmFsdWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gQWRkIGhlYWRlcnMgdG8gdGhlIHJlcXVlc3RcbiAgICBpZiAoJ3NldFJlcXVlc3RIZWFkZXInIGluIHJlcXVlc3QpIHtcbiAgICAgIHV0aWxzLmZvckVhY2gocmVxdWVzdEhlYWRlcnMsIGZ1bmN0aW9uIHNldFJlcXVlc3RIZWFkZXIodmFsLCBrZXkpIHtcbiAgICAgICAgaWYgKHR5cGVvZiByZXF1ZXN0RGF0YSA9PT0gJ3VuZGVmaW5lZCcgJiYga2V5LnRvTG93ZXJDYXNlKCkgPT09ICdjb250ZW50LXR5cGUnKSB7XG4gICAgICAgICAgLy8gUmVtb3ZlIENvbnRlbnQtVHlwZSBpZiBkYXRhIGlzIHVuZGVmaW5lZFxuICAgICAgICAgIGRlbGV0ZSByZXF1ZXN0SGVhZGVyc1trZXldO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIE90aGVyd2lzZSBhZGQgaGVhZGVyIHRvIHRoZSByZXF1ZXN0XG4gICAgICAgICAgcmVxdWVzdC5zZXRSZXF1ZXN0SGVhZGVyKGtleSwgdmFsKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gQWRkIHdpdGhDcmVkZW50aWFscyB0byByZXF1ZXN0IGlmIG5lZWRlZFxuICAgIGlmICghdXRpbHMuaXNVbmRlZmluZWQoY29uZmlnLndpdGhDcmVkZW50aWFscykpIHtcbiAgICAgIHJlcXVlc3Qud2l0aENyZWRlbnRpYWxzID0gISFjb25maWcud2l0aENyZWRlbnRpYWxzO1xuICAgIH1cblxuICAgIC8vIEFkZCByZXNwb25zZVR5cGUgdG8gcmVxdWVzdCBpZiBuZWVkZWRcbiAgICBpZiAoY29uZmlnLnJlc3BvbnNlVHlwZSkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgcmVxdWVzdC5yZXNwb25zZVR5cGUgPSBjb25maWcucmVzcG9uc2VUeXBlO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAvLyBFeHBlY3RlZCBET01FeGNlcHRpb24gdGhyb3duIGJ5IGJyb3dzZXJzIG5vdCBjb21wYXRpYmxlIFhNTEh0dHBSZXF1ZXN0IExldmVsIDIuXG4gICAgICAgIC8vIEJ1dCwgdGhpcyBjYW4gYmUgc3VwcHJlc3NlZCBmb3IgJ2pzb24nIHR5cGUgYXMgaXQgY2FuIGJlIHBhcnNlZCBieSBkZWZhdWx0ICd0cmFuc2Zvcm1SZXNwb25zZScgZnVuY3Rpb24uXG4gICAgICAgIGlmIChjb25maWcucmVzcG9uc2VUeXBlICE9PSAnanNvbicpIHtcbiAgICAgICAgICB0aHJvdyBlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gSGFuZGxlIHByb2dyZXNzIGlmIG5lZWRlZFxuICAgIGlmICh0eXBlb2YgY29uZmlnLm9uRG93bmxvYWRQcm9ncmVzcyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgcmVxdWVzdC5hZGRFdmVudExpc3RlbmVyKCdwcm9ncmVzcycsIGNvbmZpZy5vbkRvd25sb2FkUHJvZ3Jlc3MpO1xuICAgIH1cblxuICAgIC8vIE5vdCBhbGwgYnJvd3NlcnMgc3VwcG9ydCB1cGxvYWQgZXZlbnRzXG4gICAgaWYgKHR5cGVvZiBjb25maWcub25VcGxvYWRQcm9ncmVzcyA9PT0gJ2Z1bmN0aW9uJyAmJiByZXF1ZXN0LnVwbG9hZCkge1xuICAgICAgcmVxdWVzdC51cGxvYWQuYWRkRXZlbnRMaXN0ZW5lcigncHJvZ3Jlc3MnLCBjb25maWcub25VcGxvYWRQcm9ncmVzcyk7XG4gICAgfVxuXG4gICAgaWYgKGNvbmZpZy5jYW5jZWxUb2tlbikge1xuICAgICAgLy8gSGFuZGxlIGNhbmNlbGxhdGlvblxuICAgICAgY29uZmlnLmNhbmNlbFRva2VuLnByb21pc2UudGhlbihmdW5jdGlvbiBvbkNhbmNlbGVkKGNhbmNlbCkge1xuICAgICAgICBpZiAoIXJlcXVlc3QpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICByZXF1ZXN0LmFib3J0KCk7XG4gICAgICAgIHJlamVjdChjYW5jZWwpO1xuICAgICAgICAvLyBDbGVhbiB1cCByZXF1ZXN0XG4gICAgICAgIHJlcXVlc3QgPSBudWxsO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgaWYgKHJlcXVlc3REYXRhID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJlcXVlc3REYXRhID0gbnVsbDtcbiAgICB9XG5cbiAgICAvLyBTZW5kIHRoZSByZXF1ZXN0XG4gICAgcmVxdWVzdC5zZW5kKHJlcXVlc3REYXRhKTtcbiAgfSk7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuL3V0aWxzJyk7XG52YXIgYmluZCA9IHJlcXVpcmUoJy4vaGVscGVycy9iaW5kJyk7XG52YXIgQXhpb3MgPSByZXF1aXJlKCcuL2NvcmUvQXhpb3MnKTtcbnZhciBtZXJnZUNvbmZpZyA9IHJlcXVpcmUoJy4vY29yZS9tZXJnZUNvbmZpZycpO1xudmFyIGRlZmF1bHRzID0gcmVxdWlyZSgnLi9kZWZhdWx0cycpO1xuXG4vKipcbiAqIENyZWF0ZSBhbiBpbnN0YW5jZSBvZiBBeGlvc1xuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBkZWZhdWx0Q29uZmlnIFRoZSBkZWZhdWx0IGNvbmZpZyBmb3IgdGhlIGluc3RhbmNlXG4gKiBAcmV0dXJuIHtBeGlvc30gQSBuZXcgaW5zdGFuY2Ugb2YgQXhpb3NcbiAqL1xuZnVuY3Rpb24gY3JlYXRlSW5zdGFuY2UoZGVmYXVsdENvbmZpZykge1xuICB2YXIgY29udGV4dCA9IG5ldyBBeGlvcyhkZWZhdWx0Q29uZmlnKTtcbiAgdmFyIGluc3RhbmNlID0gYmluZChBeGlvcy5wcm90b3R5cGUucmVxdWVzdCwgY29udGV4dCk7XG5cbiAgLy8gQ29weSBheGlvcy5wcm90b3R5cGUgdG8gaW5zdGFuY2VcbiAgdXRpbHMuZXh0ZW5kKGluc3RhbmNlLCBBeGlvcy5wcm90b3R5cGUsIGNvbnRleHQpO1xuXG4gIC8vIENvcHkgY29udGV4dCB0byBpbnN0YW5jZVxuICB1dGlscy5leHRlbmQoaW5zdGFuY2UsIGNvbnRleHQpO1xuXG4gIHJldHVybiBpbnN0YW5jZTtcbn1cblxuLy8gQ3JlYXRlIHRoZSBkZWZhdWx0IGluc3RhbmNlIHRvIGJlIGV4cG9ydGVkXG52YXIgYXhpb3MgPSBjcmVhdGVJbnN0YW5jZShkZWZhdWx0cyk7XG5cbi8vIEV4cG9zZSBBeGlvcyBjbGFzcyB0byBhbGxvdyBjbGFzcyBpbmhlcml0YW5jZVxuYXhpb3MuQXhpb3MgPSBBeGlvcztcblxuLy8gRmFjdG9yeSBmb3IgY3JlYXRpbmcgbmV3IGluc3RhbmNlc1xuYXhpb3MuY3JlYXRlID0gZnVuY3Rpb24gY3JlYXRlKGluc3RhbmNlQ29uZmlnKSB7XG4gIHJldHVybiBjcmVhdGVJbnN0YW5jZShtZXJnZUNvbmZpZyhheGlvcy5kZWZhdWx0cywgaW5zdGFuY2VDb25maWcpKTtcbn07XG5cbi8vIEV4cG9zZSBDYW5jZWwgJiBDYW5jZWxUb2tlblxuYXhpb3MuQ2FuY2VsID0gcmVxdWlyZSgnLi9jYW5jZWwvQ2FuY2VsJyk7XG5heGlvcy5DYW5jZWxUb2tlbiA9IHJlcXVpcmUoJy4vY2FuY2VsL0NhbmNlbFRva2VuJyk7XG5heGlvcy5pc0NhbmNlbCA9IHJlcXVpcmUoJy4vY2FuY2VsL2lzQ2FuY2VsJyk7XG5cbi8vIEV4cG9zZSBhbGwvc3ByZWFkXG5heGlvcy5hbGwgPSBmdW5jdGlvbiBhbGwocHJvbWlzZXMpIHtcbiAgcmV0dXJuIFByb21pc2UuYWxsKHByb21pc2VzKTtcbn07XG5heGlvcy5zcHJlYWQgPSByZXF1aXJlKCcuL2hlbHBlcnMvc3ByZWFkJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gYXhpb3M7XG5cbi8vIEFsbG93IHVzZSBvZiBkZWZhdWx0IGltcG9ydCBzeW50YXggaW4gVHlwZVNjcmlwdFxubW9kdWxlLmV4cG9ydHMuZGVmYXVsdCA9IGF4aW9zO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIEEgYENhbmNlbGAgaXMgYW4gb2JqZWN0IHRoYXQgaXMgdGhyb3duIHdoZW4gYW4gb3BlcmF0aW9uIGlzIGNhbmNlbGVkLlxuICpcbiAqIEBjbGFzc1xuICogQHBhcmFtIHtzdHJpbmc9fSBtZXNzYWdlIFRoZSBtZXNzYWdlLlxuICovXG5mdW5jdGlvbiBDYW5jZWwobWVzc2FnZSkge1xuICB0aGlzLm1lc3NhZ2UgPSBtZXNzYWdlO1xufVxuXG5DYW5jZWwucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24gdG9TdHJpbmcoKSB7XG4gIHJldHVybiAnQ2FuY2VsJyArICh0aGlzLm1lc3NhZ2UgPyAnOiAnICsgdGhpcy5tZXNzYWdlIDogJycpO1xufTtcblxuQ2FuY2VsLnByb3RvdHlwZS5fX0NBTkNFTF9fID0gdHJ1ZTtcblxubW9kdWxlLmV4cG9ydHMgPSBDYW5jZWw7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBDYW5jZWwgPSByZXF1aXJlKCcuL0NhbmNlbCcpO1xuXG4vKipcbiAqIEEgYENhbmNlbFRva2VuYCBpcyBhbiBvYmplY3QgdGhhdCBjYW4gYmUgdXNlZCB0byByZXF1ZXN0IGNhbmNlbGxhdGlvbiBvZiBhbiBvcGVyYXRpb24uXG4gKlxuICogQGNsYXNzXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBleGVjdXRvciBUaGUgZXhlY3V0b3IgZnVuY3Rpb24uXG4gKi9cbmZ1bmN0aW9uIENhbmNlbFRva2VuKGV4ZWN1dG9yKSB7XG4gIGlmICh0eXBlb2YgZXhlY3V0b3IgIT09ICdmdW5jdGlvbicpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdleGVjdXRvciBtdXN0IGJlIGEgZnVuY3Rpb24uJyk7XG4gIH1cblxuICB2YXIgcmVzb2x2ZVByb21pc2U7XG4gIHRoaXMucHJvbWlzZSA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uIHByb21pc2VFeGVjdXRvcihyZXNvbHZlKSB7XG4gICAgcmVzb2x2ZVByb21pc2UgPSByZXNvbHZlO1xuICB9KTtcblxuICB2YXIgdG9rZW4gPSB0aGlzO1xuICBleGVjdXRvcihmdW5jdGlvbiBjYW5jZWwobWVzc2FnZSkge1xuICAgIGlmICh0b2tlbi5yZWFzb24pIHtcbiAgICAgIC8vIENhbmNlbGxhdGlvbiBoYXMgYWxyZWFkeSBiZWVuIHJlcXVlc3RlZFxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRva2VuLnJlYXNvbiA9IG5ldyBDYW5jZWwobWVzc2FnZSk7XG4gICAgcmVzb2x2ZVByb21pc2UodG9rZW4ucmVhc29uKTtcbiAgfSk7XG59XG5cbi8qKlxuICogVGhyb3dzIGEgYENhbmNlbGAgaWYgY2FuY2VsbGF0aW9uIGhhcyBiZWVuIHJlcXVlc3RlZC5cbiAqL1xuQ2FuY2VsVG9rZW4ucHJvdG90eXBlLnRocm93SWZSZXF1ZXN0ZWQgPSBmdW5jdGlvbiB0aHJvd0lmUmVxdWVzdGVkKCkge1xuICBpZiAodGhpcy5yZWFzb24pIHtcbiAgICB0aHJvdyB0aGlzLnJlYXNvbjtcbiAgfVxufTtcblxuLyoqXG4gKiBSZXR1cm5zIGFuIG9iamVjdCB0aGF0IGNvbnRhaW5zIGEgbmV3IGBDYW5jZWxUb2tlbmAgYW5kIGEgZnVuY3Rpb24gdGhhdCwgd2hlbiBjYWxsZWQsXG4gKiBjYW5jZWxzIHRoZSBgQ2FuY2VsVG9rZW5gLlxuICovXG5DYW5jZWxUb2tlbi5zb3VyY2UgPSBmdW5jdGlvbiBzb3VyY2UoKSB7XG4gIHZhciBjYW5jZWw7XG4gIHZhciB0b2tlbiA9IG5ldyBDYW5jZWxUb2tlbihmdW5jdGlvbiBleGVjdXRvcihjKSB7XG4gICAgY2FuY2VsID0gYztcbiAgfSk7XG4gIHJldHVybiB7XG4gICAgdG9rZW46IHRva2VuLFxuICAgIGNhbmNlbDogY2FuY2VsXG4gIH07XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IENhbmNlbFRva2VuO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGlzQ2FuY2VsKHZhbHVlKSB7XG4gIHJldHVybiAhISh2YWx1ZSAmJiB2YWx1ZS5fX0NBTkNFTF9fKTtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciB1dGlscyA9IHJlcXVpcmUoJy4vLi4vdXRpbHMnKTtcbnZhciBidWlsZFVSTCA9IHJlcXVpcmUoJy4uL2hlbHBlcnMvYnVpbGRVUkwnKTtcbnZhciBJbnRlcmNlcHRvck1hbmFnZXIgPSByZXF1aXJlKCcuL0ludGVyY2VwdG9yTWFuYWdlcicpO1xudmFyIGRpc3BhdGNoUmVxdWVzdCA9IHJlcXVpcmUoJy4vZGlzcGF0Y2hSZXF1ZXN0Jyk7XG52YXIgbWVyZ2VDb25maWcgPSByZXF1aXJlKCcuL21lcmdlQ29uZmlnJyk7XG5cbi8qKlxuICogQ3JlYXRlIGEgbmV3IGluc3RhbmNlIG9mIEF4aW9zXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IGluc3RhbmNlQ29uZmlnIFRoZSBkZWZhdWx0IGNvbmZpZyBmb3IgdGhlIGluc3RhbmNlXG4gKi9cbmZ1bmN0aW9uIEF4aW9zKGluc3RhbmNlQ29uZmlnKSB7XG4gIHRoaXMuZGVmYXVsdHMgPSBpbnN0YW5jZUNvbmZpZztcbiAgdGhpcy5pbnRlcmNlcHRvcnMgPSB7XG4gICAgcmVxdWVzdDogbmV3IEludGVyY2VwdG9yTWFuYWdlcigpLFxuICAgIHJlc3BvbnNlOiBuZXcgSW50ZXJjZXB0b3JNYW5hZ2VyKClcbiAgfTtcbn1cblxuLyoqXG4gKiBEaXNwYXRjaCBhIHJlcXVlc3RcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gY29uZmlnIFRoZSBjb25maWcgc3BlY2lmaWMgZm9yIHRoaXMgcmVxdWVzdCAobWVyZ2VkIHdpdGggdGhpcy5kZWZhdWx0cylcbiAqL1xuQXhpb3MucHJvdG90eXBlLnJlcXVlc3QgPSBmdW5jdGlvbiByZXF1ZXN0KGNvbmZpZykge1xuICAvKmVzbGludCBuby1wYXJhbS1yZWFzc2lnbjowKi9cbiAgLy8gQWxsb3cgZm9yIGF4aW9zKCdleGFtcGxlL3VybCdbLCBjb25maWddKSBhIGxhIGZldGNoIEFQSVxuICBpZiAodHlwZW9mIGNvbmZpZyA9PT0gJ3N0cmluZycpIHtcbiAgICBjb25maWcgPSBhcmd1bWVudHNbMV0gfHwge307XG4gICAgY29uZmlnLnVybCA9IGFyZ3VtZW50c1swXTtcbiAgfSBlbHNlIHtcbiAgICBjb25maWcgPSBjb25maWcgfHwge307XG4gIH1cblxuICBjb25maWcgPSBtZXJnZUNvbmZpZyh0aGlzLmRlZmF1bHRzLCBjb25maWcpO1xuXG4gIC8vIFNldCBjb25maWcubWV0aG9kXG4gIGlmIChjb25maWcubWV0aG9kKSB7XG4gICAgY29uZmlnLm1ldGhvZCA9IGNvbmZpZy5tZXRob2QudG9Mb3dlckNhc2UoKTtcbiAgfSBlbHNlIGlmICh0aGlzLmRlZmF1bHRzLm1ldGhvZCkge1xuICAgIGNvbmZpZy5tZXRob2QgPSB0aGlzLmRlZmF1bHRzLm1ldGhvZC50b0xvd2VyQ2FzZSgpO1xuICB9IGVsc2Uge1xuICAgIGNvbmZpZy5tZXRob2QgPSAnZ2V0JztcbiAgfVxuXG4gIC8vIEhvb2sgdXAgaW50ZXJjZXB0b3JzIG1pZGRsZXdhcmVcbiAgdmFyIGNoYWluID0gW2Rpc3BhdGNoUmVxdWVzdCwgdW5kZWZpbmVkXTtcbiAgdmFyIHByb21pc2UgPSBQcm9taXNlLnJlc29sdmUoY29uZmlnKTtcblxuICB0aGlzLmludGVyY2VwdG9ycy5yZXF1ZXN0LmZvckVhY2goZnVuY3Rpb24gdW5zaGlmdFJlcXVlc3RJbnRlcmNlcHRvcnMoaW50ZXJjZXB0b3IpIHtcbiAgICBjaGFpbi51bnNoaWZ0KGludGVyY2VwdG9yLmZ1bGZpbGxlZCwgaW50ZXJjZXB0b3IucmVqZWN0ZWQpO1xuICB9KTtcblxuICB0aGlzLmludGVyY2VwdG9ycy5yZXNwb25zZS5mb3JFYWNoKGZ1bmN0aW9uIHB1c2hSZXNwb25zZUludGVyY2VwdG9ycyhpbnRlcmNlcHRvcikge1xuICAgIGNoYWluLnB1c2goaW50ZXJjZXB0b3IuZnVsZmlsbGVkLCBpbnRlcmNlcHRvci5yZWplY3RlZCk7XG4gIH0pO1xuXG4gIHdoaWxlIChjaGFpbi5sZW5ndGgpIHtcbiAgICBwcm9taXNlID0gcHJvbWlzZS50aGVuKGNoYWluLnNoaWZ0KCksIGNoYWluLnNoaWZ0KCkpO1xuICB9XG5cbiAgcmV0dXJuIHByb21pc2U7XG59O1xuXG5BeGlvcy5wcm90b3R5cGUuZ2V0VXJpID0gZnVuY3Rpb24gZ2V0VXJpKGNvbmZpZykge1xuICBjb25maWcgPSBtZXJnZUNvbmZpZyh0aGlzLmRlZmF1bHRzLCBjb25maWcpO1xuICByZXR1cm4gYnVpbGRVUkwoY29uZmlnLnVybCwgY29uZmlnLnBhcmFtcywgY29uZmlnLnBhcmFtc1NlcmlhbGl6ZXIpLnJlcGxhY2UoL15cXD8vLCAnJyk7XG59O1xuXG4vLyBQcm92aWRlIGFsaWFzZXMgZm9yIHN1cHBvcnRlZCByZXF1ZXN0IG1ldGhvZHNcbnV0aWxzLmZvckVhY2goWydkZWxldGUnLCAnZ2V0JywgJ2hlYWQnLCAnb3B0aW9ucyddLCBmdW5jdGlvbiBmb3JFYWNoTWV0aG9kTm9EYXRhKG1ldGhvZCkge1xuICAvKmVzbGludCBmdW5jLW5hbWVzOjAqL1xuICBBeGlvcy5wcm90b3R5cGVbbWV0aG9kXSA9IGZ1bmN0aW9uKHVybCwgY29uZmlnKSB7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdCh1dGlscy5tZXJnZShjb25maWcgfHwge30sIHtcbiAgICAgIG1ldGhvZDogbWV0aG9kLFxuICAgICAgdXJsOiB1cmxcbiAgICB9KSk7XG4gIH07XG59KTtcblxudXRpbHMuZm9yRWFjaChbJ3Bvc3QnLCAncHV0JywgJ3BhdGNoJ10sIGZ1bmN0aW9uIGZvckVhY2hNZXRob2RXaXRoRGF0YShtZXRob2QpIHtcbiAgLyplc2xpbnQgZnVuYy1uYW1lczowKi9cbiAgQXhpb3MucHJvdG90eXBlW21ldGhvZF0gPSBmdW5jdGlvbih1cmwsIGRhdGEsIGNvbmZpZykge1xuICAgIHJldHVybiB0aGlzLnJlcXVlc3QodXRpbHMubWVyZ2UoY29uZmlnIHx8IHt9LCB7XG4gICAgICBtZXRob2Q6IG1ldGhvZCxcbiAgICAgIHVybDogdXJsLFxuICAgICAgZGF0YTogZGF0YVxuICAgIH0pKTtcbiAgfTtcbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEF4aW9zO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuLy4uL3V0aWxzJyk7XG5cbmZ1bmN0aW9uIEludGVyY2VwdG9yTWFuYWdlcigpIHtcbiAgdGhpcy5oYW5kbGVycyA9IFtdO1xufVxuXG4vKipcbiAqIEFkZCBhIG5ldyBpbnRlcmNlcHRvciB0byB0aGUgc3RhY2tcbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmdWxmaWxsZWQgVGhlIGZ1bmN0aW9uIHRvIGhhbmRsZSBgdGhlbmAgZm9yIGEgYFByb21pc2VgXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSByZWplY3RlZCBUaGUgZnVuY3Rpb24gdG8gaGFuZGxlIGByZWplY3RgIGZvciBhIGBQcm9taXNlYFxuICpcbiAqIEByZXR1cm4ge051bWJlcn0gQW4gSUQgdXNlZCB0byByZW1vdmUgaW50ZXJjZXB0b3IgbGF0ZXJcbiAqL1xuSW50ZXJjZXB0b3JNYW5hZ2VyLnByb3RvdHlwZS51c2UgPSBmdW5jdGlvbiB1c2UoZnVsZmlsbGVkLCByZWplY3RlZCkge1xuICB0aGlzLmhhbmRsZXJzLnB1c2goe1xuICAgIGZ1bGZpbGxlZDogZnVsZmlsbGVkLFxuICAgIHJlamVjdGVkOiByZWplY3RlZFxuICB9KTtcbiAgcmV0dXJuIHRoaXMuaGFuZGxlcnMubGVuZ3RoIC0gMTtcbn07XG5cbi8qKlxuICogUmVtb3ZlIGFuIGludGVyY2VwdG9yIGZyb20gdGhlIHN0YWNrXG4gKlxuICogQHBhcmFtIHtOdW1iZXJ9IGlkIFRoZSBJRCB0aGF0IHdhcyByZXR1cm5lZCBieSBgdXNlYFxuICovXG5JbnRlcmNlcHRvck1hbmFnZXIucHJvdG90eXBlLmVqZWN0ID0gZnVuY3Rpb24gZWplY3QoaWQpIHtcbiAgaWYgKHRoaXMuaGFuZGxlcnNbaWRdKSB7XG4gICAgdGhpcy5oYW5kbGVyc1tpZF0gPSBudWxsO1xuICB9XG59O1xuXG4vKipcbiAqIEl0ZXJhdGUgb3ZlciBhbGwgdGhlIHJlZ2lzdGVyZWQgaW50ZXJjZXB0b3JzXG4gKlxuICogVGhpcyBtZXRob2QgaXMgcGFydGljdWxhcmx5IHVzZWZ1bCBmb3Igc2tpcHBpbmcgb3ZlciBhbnlcbiAqIGludGVyY2VwdG9ycyB0aGF0IG1heSBoYXZlIGJlY29tZSBgbnVsbGAgY2FsbGluZyBgZWplY3RgLlxuICpcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZuIFRoZSBmdW5jdGlvbiB0byBjYWxsIGZvciBlYWNoIGludGVyY2VwdG9yXG4gKi9cbkludGVyY2VwdG9yTWFuYWdlci5wcm90b3R5cGUuZm9yRWFjaCA9IGZ1bmN0aW9uIGZvckVhY2goZm4pIHtcbiAgdXRpbHMuZm9yRWFjaCh0aGlzLmhhbmRsZXJzLCBmdW5jdGlvbiBmb3JFYWNoSGFuZGxlcihoKSB7XG4gICAgaWYgKGggIT09IG51bGwpIHtcbiAgICAgIGZuKGgpO1xuICAgIH1cbiAgfSk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEludGVyY2VwdG9yTWFuYWdlcjtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGlzQWJzb2x1dGVVUkwgPSByZXF1aXJlKCcuLi9oZWxwZXJzL2lzQWJzb2x1dGVVUkwnKTtcbnZhciBjb21iaW5lVVJMcyA9IHJlcXVpcmUoJy4uL2hlbHBlcnMvY29tYmluZVVSTHMnKTtcblxuLyoqXG4gKiBDcmVhdGVzIGEgbmV3IFVSTCBieSBjb21iaW5pbmcgdGhlIGJhc2VVUkwgd2l0aCB0aGUgcmVxdWVzdGVkVVJMLFxuICogb25seSB3aGVuIHRoZSByZXF1ZXN0ZWRVUkwgaXMgbm90IGFscmVhZHkgYW4gYWJzb2x1dGUgVVJMLlxuICogSWYgdGhlIHJlcXVlc3RVUkwgaXMgYWJzb2x1dGUsIHRoaXMgZnVuY3Rpb24gcmV0dXJucyB0aGUgcmVxdWVzdGVkVVJMIHVudG91Y2hlZC5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gYmFzZVVSTCBUaGUgYmFzZSBVUkxcbiAqIEBwYXJhbSB7c3RyaW5nfSByZXF1ZXN0ZWRVUkwgQWJzb2x1dGUgb3IgcmVsYXRpdmUgVVJMIHRvIGNvbWJpbmVcbiAqIEByZXR1cm5zIHtzdHJpbmd9IFRoZSBjb21iaW5lZCBmdWxsIHBhdGhcbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBidWlsZEZ1bGxQYXRoKGJhc2VVUkwsIHJlcXVlc3RlZFVSTCkge1xuICBpZiAoYmFzZVVSTCAmJiAhaXNBYnNvbHV0ZVVSTChyZXF1ZXN0ZWRVUkwpKSB7XG4gICAgcmV0dXJuIGNvbWJpbmVVUkxzKGJhc2VVUkwsIHJlcXVlc3RlZFVSTCk7XG4gIH1cbiAgcmV0dXJuIHJlcXVlc3RlZFVSTDtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBlbmhhbmNlRXJyb3IgPSByZXF1aXJlKCcuL2VuaGFuY2VFcnJvcicpO1xuXG4vKipcbiAqIENyZWF0ZSBhbiBFcnJvciB3aXRoIHRoZSBzcGVjaWZpZWQgbWVzc2FnZSwgY29uZmlnLCBlcnJvciBjb2RlLCByZXF1ZXN0IGFuZCByZXNwb25zZS5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gbWVzc2FnZSBUaGUgZXJyb3IgbWVzc2FnZS5cbiAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWcgVGhlIGNvbmZpZy5cbiAqIEBwYXJhbSB7c3RyaW5nfSBbY29kZV0gVGhlIGVycm9yIGNvZGUgKGZvciBleGFtcGxlLCAnRUNPTk5BQk9SVEVEJykuXG4gKiBAcGFyYW0ge09iamVjdH0gW3JlcXVlc3RdIFRoZSByZXF1ZXN0LlxuICogQHBhcmFtIHtPYmplY3R9IFtyZXNwb25zZV0gVGhlIHJlc3BvbnNlLlxuICogQHJldHVybnMge0Vycm9yfSBUaGUgY3JlYXRlZCBlcnJvci5cbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBjcmVhdGVFcnJvcihtZXNzYWdlLCBjb25maWcsIGNvZGUsIHJlcXVlc3QsIHJlc3BvbnNlKSB7XG4gIHZhciBlcnJvciA9IG5ldyBFcnJvcihtZXNzYWdlKTtcbiAgcmV0dXJuIGVuaGFuY2VFcnJvcihlcnJvciwgY29uZmlnLCBjb2RlLCByZXF1ZXN0LCByZXNwb25zZSk7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuLy4uL3V0aWxzJyk7XG52YXIgdHJhbnNmb3JtRGF0YSA9IHJlcXVpcmUoJy4vdHJhbnNmb3JtRGF0YScpO1xudmFyIGlzQ2FuY2VsID0gcmVxdWlyZSgnLi4vY2FuY2VsL2lzQ2FuY2VsJyk7XG52YXIgZGVmYXVsdHMgPSByZXF1aXJlKCcuLi9kZWZhdWx0cycpO1xuXG4vKipcbiAqIFRocm93cyBhIGBDYW5jZWxgIGlmIGNhbmNlbGxhdGlvbiBoYXMgYmVlbiByZXF1ZXN0ZWQuXG4gKi9cbmZ1bmN0aW9uIHRocm93SWZDYW5jZWxsYXRpb25SZXF1ZXN0ZWQoY29uZmlnKSB7XG4gIGlmIChjb25maWcuY2FuY2VsVG9rZW4pIHtcbiAgICBjb25maWcuY2FuY2VsVG9rZW4udGhyb3dJZlJlcXVlc3RlZCgpO1xuICB9XG59XG5cbi8qKlxuICogRGlzcGF0Y2ggYSByZXF1ZXN0IHRvIHRoZSBzZXJ2ZXIgdXNpbmcgdGhlIGNvbmZpZ3VyZWQgYWRhcHRlci5cbiAqXG4gKiBAcGFyYW0ge29iamVjdH0gY29uZmlnIFRoZSBjb25maWcgdGhhdCBpcyB0byBiZSB1c2VkIGZvciB0aGUgcmVxdWVzdFxuICogQHJldHVybnMge1Byb21pc2V9IFRoZSBQcm9taXNlIHRvIGJlIGZ1bGZpbGxlZFxuICovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGRpc3BhdGNoUmVxdWVzdChjb25maWcpIHtcbiAgdGhyb3dJZkNhbmNlbGxhdGlvblJlcXVlc3RlZChjb25maWcpO1xuXG4gIC8vIEVuc3VyZSBoZWFkZXJzIGV4aXN0XG4gIGNvbmZpZy5oZWFkZXJzID0gY29uZmlnLmhlYWRlcnMgfHwge307XG5cbiAgLy8gVHJhbnNmb3JtIHJlcXVlc3QgZGF0YVxuICBjb25maWcuZGF0YSA9IHRyYW5zZm9ybURhdGEoXG4gICAgY29uZmlnLmRhdGEsXG4gICAgY29uZmlnLmhlYWRlcnMsXG4gICAgY29uZmlnLnRyYW5zZm9ybVJlcXVlc3RcbiAgKTtcblxuICAvLyBGbGF0dGVuIGhlYWRlcnNcbiAgY29uZmlnLmhlYWRlcnMgPSB1dGlscy5tZXJnZShcbiAgICBjb25maWcuaGVhZGVycy5jb21tb24gfHwge30sXG4gICAgY29uZmlnLmhlYWRlcnNbY29uZmlnLm1ldGhvZF0gfHwge30sXG4gICAgY29uZmlnLmhlYWRlcnNcbiAgKTtcblxuICB1dGlscy5mb3JFYWNoKFxuICAgIFsnZGVsZXRlJywgJ2dldCcsICdoZWFkJywgJ3Bvc3QnLCAncHV0JywgJ3BhdGNoJywgJ2NvbW1vbiddLFxuICAgIGZ1bmN0aW9uIGNsZWFuSGVhZGVyQ29uZmlnKG1ldGhvZCkge1xuICAgICAgZGVsZXRlIGNvbmZpZy5oZWFkZXJzW21ldGhvZF07XG4gICAgfVxuICApO1xuXG4gIHZhciBhZGFwdGVyID0gY29uZmlnLmFkYXB0ZXIgfHwgZGVmYXVsdHMuYWRhcHRlcjtcblxuICByZXR1cm4gYWRhcHRlcihjb25maWcpLnRoZW4oZnVuY3Rpb24gb25BZGFwdGVyUmVzb2x1dGlvbihyZXNwb25zZSkge1xuICAgIHRocm93SWZDYW5jZWxsYXRpb25SZXF1ZXN0ZWQoY29uZmlnKTtcblxuICAgIC8vIFRyYW5zZm9ybSByZXNwb25zZSBkYXRhXG4gICAgcmVzcG9uc2UuZGF0YSA9IHRyYW5zZm9ybURhdGEoXG4gICAgICByZXNwb25zZS5kYXRhLFxuICAgICAgcmVzcG9uc2UuaGVhZGVycyxcbiAgICAgIGNvbmZpZy50cmFuc2Zvcm1SZXNwb25zZVxuICAgICk7XG5cbiAgICByZXR1cm4gcmVzcG9uc2U7XG4gIH0sIGZ1bmN0aW9uIG9uQWRhcHRlclJlamVjdGlvbihyZWFzb24pIHtcbiAgICBpZiAoIWlzQ2FuY2VsKHJlYXNvbikpIHtcbiAgICAgIHRocm93SWZDYW5jZWxsYXRpb25SZXF1ZXN0ZWQoY29uZmlnKTtcblxuICAgICAgLy8gVHJhbnNmb3JtIHJlc3BvbnNlIGRhdGFcbiAgICAgIGlmIChyZWFzb24gJiYgcmVhc29uLnJlc3BvbnNlKSB7XG4gICAgICAgIHJlYXNvbi5yZXNwb25zZS5kYXRhID0gdHJhbnNmb3JtRGF0YShcbiAgICAgICAgICByZWFzb24ucmVzcG9uc2UuZGF0YSxcbiAgICAgICAgICByZWFzb24ucmVzcG9uc2UuaGVhZGVycyxcbiAgICAgICAgICBjb25maWcudHJhbnNmb3JtUmVzcG9uc2VcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QocmVhc29uKTtcbiAgfSk7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIFVwZGF0ZSBhbiBFcnJvciB3aXRoIHRoZSBzcGVjaWZpZWQgY29uZmlnLCBlcnJvciBjb2RlLCBhbmQgcmVzcG9uc2UuXG4gKlxuICogQHBhcmFtIHtFcnJvcn0gZXJyb3IgVGhlIGVycm9yIHRvIHVwZGF0ZS5cbiAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWcgVGhlIGNvbmZpZy5cbiAqIEBwYXJhbSB7c3RyaW5nfSBbY29kZV0gVGhlIGVycm9yIGNvZGUgKGZvciBleGFtcGxlLCAnRUNPTk5BQk9SVEVEJykuXG4gKiBAcGFyYW0ge09iamVjdH0gW3JlcXVlc3RdIFRoZSByZXF1ZXN0LlxuICogQHBhcmFtIHtPYmplY3R9IFtyZXNwb25zZV0gVGhlIHJlc3BvbnNlLlxuICogQHJldHVybnMge0Vycm9yfSBUaGUgZXJyb3IuXG4gKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gZW5oYW5jZUVycm9yKGVycm9yLCBjb25maWcsIGNvZGUsIHJlcXVlc3QsIHJlc3BvbnNlKSB7XG4gIGVycm9yLmNvbmZpZyA9IGNvbmZpZztcbiAgaWYgKGNvZGUpIHtcbiAgICBlcnJvci5jb2RlID0gY29kZTtcbiAgfVxuXG4gIGVycm9yLnJlcXVlc3QgPSByZXF1ZXN0O1xuICBlcnJvci5yZXNwb25zZSA9IHJlc3BvbnNlO1xuICBlcnJvci5pc0F4aW9zRXJyb3IgPSB0cnVlO1xuXG4gIGVycm9yLnRvSlNPTiA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB7XG4gICAgICAvLyBTdGFuZGFyZFxuICAgICAgbWVzc2FnZTogdGhpcy5tZXNzYWdlLFxuICAgICAgbmFtZTogdGhpcy5uYW1lLFxuICAgICAgLy8gTWljcm9zb2Z0XG4gICAgICBkZXNjcmlwdGlvbjogdGhpcy5kZXNjcmlwdGlvbixcbiAgICAgIG51bWJlcjogdGhpcy5udW1iZXIsXG4gICAgICAvLyBNb3ppbGxhXG4gICAgICBmaWxlTmFtZTogdGhpcy5maWxlTmFtZSxcbiAgICAgIGxpbmVOdW1iZXI6IHRoaXMubGluZU51bWJlcixcbiAgICAgIGNvbHVtbk51bWJlcjogdGhpcy5jb2x1bW5OdW1iZXIsXG4gICAgICBzdGFjazogdGhpcy5zdGFjayxcbiAgICAgIC8vIEF4aW9zXG4gICAgICBjb25maWc6IHRoaXMuY29uZmlnLFxuICAgICAgY29kZTogdGhpcy5jb2RlXG4gICAgfTtcbiAgfTtcbiAgcmV0dXJuIGVycm9yO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHV0aWxzID0gcmVxdWlyZSgnLi4vdXRpbHMnKTtcblxuLyoqXG4gKiBDb25maWctc3BlY2lmaWMgbWVyZ2UtZnVuY3Rpb24gd2hpY2ggY3JlYXRlcyBhIG5ldyBjb25maWctb2JqZWN0XG4gKiBieSBtZXJnaW5nIHR3byBjb25maWd1cmF0aW9uIG9iamVjdHMgdG9nZXRoZXIuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IGNvbmZpZzFcbiAqIEBwYXJhbSB7T2JqZWN0fSBjb25maWcyXG4gKiBAcmV0dXJucyB7T2JqZWN0fSBOZXcgb2JqZWN0IHJlc3VsdGluZyBmcm9tIG1lcmdpbmcgY29uZmlnMiB0byBjb25maWcxXG4gKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gbWVyZ2VDb25maWcoY29uZmlnMSwgY29uZmlnMikge1xuICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tcGFyYW0tcmVhc3NpZ25cbiAgY29uZmlnMiA9IGNvbmZpZzIgfHwge307XG4gIHZhciBjb25maWcgPSB7fTtcblxuICB2YXIgdmFsdWVGcm9tQ29uZmlnMktleXMgPSBbJ3VybCcsICdtZXRob2QnLCAncGFyYW1zJywgJ2RhdGEnXTtcbiAgdmFyIG1lcmdlRGVlcFByb3BlcnRpZXNLZXlzID0gWydoZWFkZXJzJywgJ2F1dGgnLCAncHJveHknXTtcbiAgdmFyIGRlZmF1bHRUb0NvbmZpZzJLZXlzID0gW1xuICAgICdiYXNlVVJMJywgJ3VybCcsICd0cmFuc2Zvcm1SZXF1ZXN0JywgJ3RyYW5zZm9ybVJlc3BvbnNlJywgJ3BhcmFtc1NlcmlhbGl6ZXInLFxuICAgICd0aW1lb3V0JywgJ3dpdGhDcmVkZW50aWFscycsICdhZGFwdGVyJywgJ3Jlc3BvbnNlVHlwZScsICd4c3JmQ29va2llTmFtZScsXG4gICAgJ3hzcmZIZWFkZXJOYW1lJywgJ29uVXBsb2FkUHJvZ3Jlc3MnLCAnb25Eb3dubG9hZFByb2dyZXNzJyxcbiAgICAnbWF4Q29udGVudExlbmd0aCcsICd2YWxpZGF0ZVN0YXR1cycsICdtYXhSZWRpcmVjdHMnLCAnaHR0cEFnZW50JyxcbiAgICAnaHR0cHNBZ2VudCcsICdjYW5jZWxUb2tlbicsICdzb2NrZXRQYXRoJ1xuICBdO1xuXG4gIHV0aWxzLmZvckVhY2godmFsdWVGcm9tQ29uZmlnMktleXMsIGZ1bmN0aW9uIHZhbHVlRnJvbUNvbmZpZzIocHJvcCkge1xuICAgIGlmICh0eXBlb2YgY29uZmlnMltwcm9wXSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIGNvbmZpZ1twcm9wXSA9IGNvbmZpZzJbcHJvcF07XG4gICAgfVxuICB9KTtcblxuICB1dGlscy5mb3JFYWNoKG1lcmdlRGVlcFByb3BlcnRpZXNLZXlzLCBmdW5jdGlvbiBtZXJnZURlZXBQcm9wZXJ0aWVzKHByb3ApIHtcbiAgICBpZiAodXRpbHMuaXNPYmplY3QoY29uZmlnMltwcm9wXSkpIHtcbiAgICAgIGNvbmZpZ1twcm9wXSA9IHV0aWxzLmRlZXBNZXJnZShjb25maWcxW3Byb3BdLCBjb25maWcyW3Byb3BdKTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBjb25maWcyW3Byb3BdICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgY29uZmlnW3Byb3BdID0gY29uZmlnMltwcm9wXTtcbiAgICB9IGVsc2UgaWYgKHV0aWxzLmlzT2JqZWN0KGNvbmZpZzFbcHJvcF0pKSB7XG4gICAgICBjb25maWdbcHJvcF0gPSB1dGlscy5kZWVwTWVyZ2UoY29uZmlnMVtwcm9wXSk7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgY29uZmlnMVtwcm9wXSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIGNvbmZpZ1twcm9wXSA9IGNvbmZpZzFbcHJvcF07XG4gICAgfVxuICB9KTtcblxuICB1dGlscy5mb3JFYWNoKGRlZmF1bHRUb0NvbmZpZzJLZXlzLCBmdW5jdGlvbiBkZWZhdWx0VG9Db25maWcyKHByb3ApIHtcbiAgICBpZiAodHlwZW9mIGNvbmZpZzJbcHJvcF0gIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICBjb25maWdbcHJvcF0gPSBjb25maWcyW3Byb3BdO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIGNvbmZpZzFbcHJvcF0gIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICBjb25maWdbcHJvcF0gPSBjb25maWcxW3Byb3BdO1xuICAgIH1cbiAgfSk7XG5cbiAgdmFyIGF4aW9zS2V5cyA9IHZhbHVlRnJvbUNvbmZpZzJLZXlzXG4gICAgLmNvbmNhdChtZXJnZURlZXBQcm9wZXJ0aWVzS2V5cylcbiAgICAuY29uY2F0KGRlZmF1bHRUb0NvbmZpZzJLZXlzKTtcblxuICB2YXIgb3RoZXJLZXlzID0gT2JqZWN0XG4gICAgLmtleXMoY29uZmlnMilcbiAgICAuZmlsdGVyKGZ1bmN0aW9uIGZpbHRlckF4aW9zS2V5cyhrZXkpIHtcbiAgICAgIHJldHVybiBheGlvc0tleXMuaW5kZXhPZihrZXkpID09PSAtMTtcbiAgICB9KTtcblxuICB1dGlscy5mb3JFYWNoKG90aGVyS2V5cywgZnVuY3Rpb24gb3RoZXJLZXlzRGVmYXVsdFRvQ29uZmlnMihwcm9wKSB7XG4gICAgaWYgKHR5cGVvZiBjb25maWcyW3Byb3BdICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgY29uZmlnW3Byb3BdID0gY29uZmlnMltwcm9wXTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBjb25maWcxW3Byb3BdICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgY29uZmlnW3Byb3BdID0gY29uZmlnMVtwcm9wXTtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBjb25maWc7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgY3JlYXRlRXJyb3IgPSByZXF1aXJlKCcuL2NyZWF0ZUVycm9yJyk7XG5cbi8qKlxuICogUmVzb2x2ZSBvciByZWplY3QgYSBQcm9taXNlIGJhc2VkIG9uIHJlc3BvbnNlIHN0YXR1cy5cbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSByZXNvbHZlIEEgZnVuY3Rpb24gdGhhdCByZXNvbHZlcyB0aGUgcHJvbWlzZS5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IHJlamVjdCBBIGZ1bmN0aW9uIHRoYXQgcmVqZWN0cyB0aGUgcHJvbWlzZS5cbiAqIEBwYXJhbSB7b2JqZWN0fSByZXNwb25zZSBUaGUgcmVzcG9uc2UuXG4gKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gc2V0dGxlKHJlc29sdmUsIHJlamVjdCwgcmVzcG9uc2UpIHtcbiAgdmFyIHZhbGlkYXRlU3RhdHVzID0gcmVzcG9uc2UuY29uZmlnLnZhbGlkYXRlU3RhdHVzO1xuICBpZiAoIXZhbGlkYXRlU3RhdHVzIHx8IHZhbGlkYXRlU3RhdHVzKHJlc3BvbnNlLnN0YXR1cykpIHtcbiAgICByZXNvbHZlKHJlc3BvbnNlKTtcbiAgfSBlbHNlIHtcbiAgICByZWplY3QoY3JlYXRlRXJyb3IoXG4gICAgICAnUmVxdWVzdCBmYWlsZWQgd2l0aCBzdGF0dXMgY29kZSAnICsgcmVzcG9uc2Uuc3RhdHVzLFxuICAgICAgcmVzcG9uc2UuY29uZmlnLFxuICAgICAgbnVsbCxcbiAgICAgIHJlc3BvbnNlLnJlcXVlc3QsXG4gICAgICByZXNwb25zZVxuICAgICkpO1xuICB9XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuLy4uL3V0aWxzJyk7XG5cbi8qKlxuICogVHJhbnNmb3JtIHRoZSBkYXRhIGZvciBhIHJlcXVlc3Qgb3IgYSByZXNwb25zZVxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fFN0cmluZ30gZGF0YSBUaGUgZGF0YSB0byBiZSB0cmFuc2Zvcm1lZFxuICogQHBhcmFtIHtBcnJheX0gaGVhZGVycyBUaGUgaGVhZGVycyBmb3IgdGhlIHJlcXVlc3Qgb3IgcmVzcG9uc2VcbiAqIEBwYXJhbSB7QXJyYXl8RnVuY3Rpb259IGZucyBBIHNpbmdsZSBmdW5jdGlvbiBvciBBcnJheSBvZiBmdW5jdGlvbnNcbiAqIEByZXR1cm5zIHsqfSBUaGUgcmVzdWx0aW5nIHRyYW5zZm9ybWVkIGRhdGFcbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiB0cmFuc2Zvcm1EYXRhKGRhdGEsIGhlYWRlcnMsIGZucykge1xuICAvKmVzbGludCBuby1wYXJhbS1yZWFzc2lnbjowKi9cbiAgdXRpbHMuZm9yRWFjaChmbnMsIGZ1bmN0aW9uIHRyYW5zZm9ybShmbikge1xuICAgIGRhdGEgPSBmbihkYXRhLCBoZWFkZXJzKTtcbiAgfSk7XG5cbiAgcmV0dXJuIGRhdGE7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuL3V0aWxzJyk7XG52YXIgbm9ybWFsaXplSGVhZGVyTmFtZSA9IHJlcXVpcmUoJy4vaGVscGVycy9ub3JtYWxpemVIZWFkZXJOYW1lJyk7XG5cbnZhciBERUZBVUxUX0NPTlRFTlRfVFlQRSA9IHtcbiAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWQnXG59O1xuXG5mdW5jdGlvbiBzZXRDb250ZW50VHlwZUlmVW5zZXQoaGVhZGVycywgdmFsdWUpIHtcbiAgaWYgKCF1dGlscy5pc1VuZGVmaW5lZChoZWFkZXJzKSAmJiB1dGlscy5pc1VuZGVmaW5lZChoZWFkZXJzWydDb250ZW50LVR5cGUnXSkpIHtcbiAgICBoZWFkZXJzWydDb250ZW50LVR5cGUnXSA9IHZhbHVlO1xuICB9XG59XG5cbmZ1bmN0aW9uIGdldERlZmF1bHRBZGFwdGVyKCkge1xuICB2YXIgYWRhcHRlcjtcbiAgaWYgKHR5cGVvZiBYTUxIdHRwUmVxdWVzdCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAvLyBGb3IgYnJvd3NlcnMgdXNlIFhIUiBhZGFwdGVyXG4gICAgYWRhcHRlciA9IHJlcXVpcmUoJy4vYWRhcHRlcnMveGhyJyk7XG4gIH0gZWxzZSBpZiAodHlwZW9mIHByb2Nlc3MgIT09ICd1bmRlZmluZWQnICYmIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChwcm9jZXNzKSA9PT0gJ1tvYmplY3QgcHJvY2Vzc10nKSB7XG4gICAgLy8gRm9yIG5vZGUgdXNlIEhUVFAgYWRhcHRlclxuICAgIGFkYXB0ZXIgPSByZXF1aXJlKCcuL2FkYXB0ZXJzL2h0dHAnKTtcbiAgfVxuICByZXR1cm4gYWRhcHRlcjtcbn1cblxudmFyIGRlZmF1bHRzID0ge1xuICBhZGFwdGVyOiBnZXREZWZhdWx0QWRhcHRlcigpLFxuXG4gIHRyYW5zZm9ybVJlcXVlc3Q6IFtmdW5jdGlvbiB0cmFuc2Zvcm1SZXF1ZXN0KGRhdGEsIGhlYWRlcnMpIHtcbiAgICBub3JtYWxpemVIZWFkZXJOYW1lKGhlYWRlcnMsICdBY2NlcHQnKTtcbiAgICBub3JtYWxpemVIZWFkZXJOYW1lKGhlYWRlcnMsICdDb250ZW50LVR5cGUnKTtcbiAgICBpZiAodXRpbHMuaXNGb3JtRGF0YShkYXRhKSB8fFxuICAgICAgdXRpbHMuaXNBcnJheUJ1ZmZlcihkYXRhKSB8fFxuICAgICAgdXRpbHMuaXNCdWZmZXIoZGF0YSkgfHxcbiAgICAgIHV0aWxzLmlzU3RyZWFtKGRhdGEpIHx8XG4gICAgICB1dGlscy5pc0ZpbGUoZGF0YSkgfHxcbiAgICAgIHV0aWxzLmlzQmxvYihkYXRhKVxuICAgICkge1xuICAgICAgcmV0dXJuIGRhdGE7XG4gICAgfVxuICAgIGlmICh1dGlscy5pc0FycmF5QnVmZmVyVmlldyhkYXRhKSkge1xuICAgICAgcmV0dXJuIGRhdGEuYnVmZmVyO1xuICAgIH1cbiAgICBpZiAodXRpbHMuaXNVUkxTZWFyY2hQYXJhbXMoZGF0YSkpIHtcbiAgICAgIHNldENvbnRlbnRUeXBlSWZVbnNldChoZWFkZXJzLCAnYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkO2NoYXJzZXQ9dXRmLTgnKTtcbiAgICAgIHJldHVybiBkYXRhLnRvU3RyaW5nKCk7XG4gICAgfVxuICAgIGlmICh1dGlscy5pc09iamVjdChkYXRhKSkge1xuICAgICAgc2V0Q29udGVudFR5cGVJZlVuc2V0KGhlYWRlcnMsICdhcHBsaWNhdGlvbi9qc29uO2NoYXJzZXQ9dXRmLTgnKTtcbiAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShkYXRhKTtcbiAgICB9XG4gICAgcmV0dXJuIGRhdGE7XG4gIH1dLFxuXG4gIHRyYW5zZm9ybVJlc3BvbnNlOiBbZnVuY3Rpb24gdHJhbnNmb3JtUmVzcG9uc2UoZGF0YSkge1xuICAgIC8qZXNsaW50IG5vLXBhcmFtLXJlYXNzaWduOjAqL1xuICAgIGlmICh0eXBlb2YgZGF0YSA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGRhdGEgPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgICAgfSBjYXRjaCAoZSkgeyAvKiBJZ25vcmUgKi8gfVxuICAgIH1cbiAgICByZXR1cm4gZGF0YTtcbiAgfV0sXG5cbiAgLyoqXG4gICAqIEEgdGltZW91dCBpbiBtaWxsaXNlY29uZHMgdG8gYWJvcnQgYSByZXF1ZXN0LiBJZiBzZXQgdG8gMCAoZGVmYXVsdCkgYVxuICAgKiB0aW1lb3V0IGlzIG5vdCBjcmVhdGVkLlxuICAgKi9cbiAgdGltZW91dDogMCxcblxuICB4c3JmQ29va2llTmFtZTogJ1hTUkYtVE9LRU4nLFxuICB4c3JmSGVhZGVyTmFtZTogJ1gtWFNSRi1UT0tFTicsXG5cbiAgbWF4Q29udGVudExlbmd0aDogLTEsXG5cbiAgdmFsaWRhdGVTdGF0dXM6IGZ1bmN0aW9uIHZhbGlkYXRlU3RhdHVzKHN0YXR1cykge1xuICAgIHJldHVybiBzdGF0dXMgPj0gMjAwICYmIHN0YXR1cyA8IDMwMDtcbiAgfVxufTtcblxuZGVmYXVsdHMuaGVhZGVycyA9IHtcbiAgY29tbW9uOiB7XG4gICAgJ0FjY2VwdCc6ICdhcHBsaWNhdGlvbi9qc29uLCB0ZXh0L3BsYWluLCAqLyonXG4gIH1cbn07XG5cbnV0aWxzLmZvckVhY2goWydkZWxldGUnLCAnZ2V0JywgJ2hlYWQnXSwgZnVuY3Rpb24gZm9yRWFjaE1ldGhvZE5vRGF0YShtZXRob2QpIHtcbiAgZGVmYXVsdHMuaGVhZGVyc1ttZXRob2RdID0ge307XG59KTtcblxudXRpbHMuZm9yRWFjaChbJ3Bvc3QnLCAncHV0JywgJ3BhdGNoJ10sIGZ1bmN0aW9uIGZvckVhY2hNZXRob2RXaXRoRGF0YShtZXRob2QpIHtcbiAgZGVmYXVsdHMuaGVhZGVyc1ttZXRob2RdID0gdXRpbHMubWVyZ2UoREVGQVVMVF9DT05URU5UX1RZUEUpO1xufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gZGVmYXVsdHM7XG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gYmluZChmbiwgdGhpc0FyZykge1xuICByZXR1cm4gZnVuY3Rpb24gd3JhcCgpIHtcbiAgICB2YXIgYXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFyZ3MubGVuZ3RoOyBpKyspIHtcbiAgICAgIGFyZ3NbaV0gPSBhcmd1bWVudHNbaV07XG4gICAgfVxuICAgIHJldHVybiBmbi5hcHBseSh0aGlzQXJnLCBhcmdzKTtcbiAgfTtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciB1dGlscyA9IHJlcXVpcmUoJy4vLi4vdXRpbHMnKTtcblxuZnVuY3Rpb24gZW5jb2RlKHZhbCkge1xuICByZXR1cm4gZW5jb2RlVVJJQ29tcG9uZW50KHZhbCkuXG4gICAgcmVwbGFjZSgvJTQwL2dpLCAnQCcpLlxuICAgIHJlcGxhY2UoLyUzQS9naSwgJzonKS5cbiAgICByZXBsYWNlKC8lMjQvZywgJyQnKS5cbiAgICByZXBsYWNlKC8lMkMvZ2ksICcsJykuXG4gICAgcmVwbGFjZSgvJTIwL2csICcrJykuXG4gICAgcmVwbGFjZSgvJTVCL2dpLCAnWycpLlxuICAgIHJlcGxhY2UoLyU1RC9naSwgJ10nKTtcbn1cblxuLyoqXG4gKiBCdWlsZCBhIFVSTCBieSBhcHBlbmRpbmcgcGFyYW1zIHRvIHRoZSBlbmRcbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gdXJsIFRoZSBiYXNlIG9mIHRoZSB1cmwgKGUuZy4sIGh0dHA6Ly93d3cuZ29vZ2xlLmNvbSlcbiAqIEBwYXJhbSB7b2JqZWN0fSBbcGFyYW1zXSBUaGUgcGFyYW1zIHRvIGJlIGFwcGVuZGVkXG4gKiBAcmV0dXJucyB7c3RyaW5nfSBUaGUgZm9ybWF0dGVkIHVybFxuICovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGJ1aWxkVVJMKHVybCwgcGFyYW1zLCBwYXJhbXNTZXJpYWxpemVyKSB7XG4gIC8qZXNsaW50IG5vLXBhcmFtLXJlYXNzaWduOjAqL1xuICBpZiAoIXBhcmFtcykge1xuICAgIHJldHVybiB1cmw7XG4gIH1cblxuICB2YXIgc2VyaWFsaXplZFBhcmFtcztcbiAgaWYgKHBhcmFtc1NlcmlhbGl6ZXIpIHtcbiAgICBzZXJpYWxpemVkUGFyYW1zID0gcGFyYW1zU2VyaWFsaXplcihwYXJhbXMpO1xuICB9IGVsc2UgaWYgKHV0aWxzLmlzVVJMU2VhcmNoUGFyYW1zKHBhcmFtcykpIHtcbiAgICBzZXJpYWxpemVkUGFyYW1zID0gcGFyYW1zLnRvU3RyaW5nKCk7XG4gIH0gZWxzZSB7XG4gICAgdmFyIHBhcnRzID0gW107XG5cbiAgICB1dGlscy5mb3JFYWNoKHBhcmFtcywgZnVuY3Rpb24gc2VyaWFsaXplKHZhbCwga2V5KSB7XG4gICAgICBpZiAodmFsID09PSBudWxsIHx8IHR5cGVvZiB2YWwgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgaWYgKHV0aWxzLmlzQXJyYXkodmFsKSkge1xuICAgICAgICBrZXkgPSBrZXkgKyAnW10nO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFsID0gW3ZhbF07XG4gICAgICB9XG5cbiAgICAgIHV0aWxzLmZvckVhY2godmFsLCBmdW5jdGlvbiBwYXJzZVZhbHVlKHYpIHtcbiAgICAgICAgaWYgKHV0aWxzLmlzRGF0ZSh2KSkge1xuICAgICAgICAgIHYgPSB2LnRvSVNPU3RyaW5nKCk7XG4gICAgICAgIH0gZWxzZSBpZiAodXRpbHMuaXNPYmplY3QodikpIHtcbiAgICAgICAgICB2ID0gSlNPTi5zdHJpbmdpZnkodik7XG4gICAgICAgIH1cbiAgICAgICAgcGFydHMucHVzaChlbmNvZGUoa2V5KSArICc9JyArIGVuY29kZSh2KSk7XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIHNlcmlhbGl6ZWRQYXJhbXMgPSBwYXJ0cy5qb2luKCcmJyk7XG4gIH1cblxuICBpZiAoc2VyaWFsaXplZFBhcmFtcykge1xuICAgIHZhciBoYXNobWFya0luZGV4ID0gdXJsLmluZGV4T2YoJyMnKTtcbiAgICBpZiAoaGFzaG1hcmtJbmRleCAhPT0gLTEpIHtcbiAgICAgIHVybCA9IHVybC5zbGljZSgwLCBoYXNobWFya0luZGV4KTtcbiAgICB9XG5cbiAgICB1cmwgKz0gKHVybC5pbmRleE9mKCc/JykgPT09IC0xID8gJz8nIDogJyYnKSArIHNlcmlhbGl6ZWRQYXJhbXM7XG4gIH1cblxuICByZXR1cm4gdXJsO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBDcmVhdGVzIGEgbmV3IFVSTCBieSBjb21iaW5pbmcgdGhlIHNwZWNpZmllZCBVUkxzXG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IGJhc2VVUkwgVGhlIGJhc2UgVVJMXG4gKiBAcGFyYW0ge3N0cmluZ30gcmVsYXRpdmVVUkwgVGhlIHJlbGF0aXZlIFVSTFxuICogQHJldHVybnMge3N0cmluZ30gVGhlIGNvbWJpbmVkIFVSTFxuICovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGNvbWJpbmVVUkxzKGJhc2VVUkwsIHJlbGF0aXZlVVJMKSB7XG4gIHJldHVybiByZWxhdGl2ZVVSTFxuICAgID8gYmFzZVVSTC5yZXBsYWNlKC9cXC8rJC8sICcnKSArICcvJyArIHJlbGF0aXZlVVJMLnJlcGxhY2UoL15cXC8rLywgJycpXG4gICAgOiBiYXNlVVJMO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHV0aWxzID0gcmVxdWlyZSgnLi8uLi91dGlscycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IChcbiAgdXRpbHMuaXNTdGFuZGFyZEJyb3dzZXJFbnYoKSA/XG5cbiAgLy8gU3RhbmRhcmQgYnJvd3NlciBlbnZzIHN1cHBvcnQgZG9jdW1lbnQuY29va2llXG4gICAgKGZ1bmN0aW9uIHN0YW5kYXJkQnJvd3NlckVudigpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHdyaXRlOiBmdW5jdGlvbiB3cml0ZShuYW1lLCB2YWx1ZSwgZXhwaXJlcywgcGF0aCwgZG9tYWluLCBzZWN1cmUpIHtcbiAgICAgICAgICB2YXIgY29va2llID0gW107XG4gICAgICAgICAgY29va2llLnB1c2gobmFtZSArICc9JyArIGVuY29kZVVSSUNvbXBvbmVudCh2YWx1ZSkpO1xuXG4gICAgICAgICAgaWYgKHV0aWxzLmlzTnVtYmVyKGV4cGlyZXMpKSB7XG4gICAgICAgICAgICBjb29raWUucHVzaCgnZXhwaXJlcz0nICsgbmV3IERhdGUoZXhwaXJlcykudG9HTVRTdHJpbmcoKSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKHV0aWxzLmlzU3RyaW5nKHBhdGgpKSB7XG4gICAgICAgICAgICBjb29raWUucHVzaCgncGF0aD0nICsgcGF0aCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKHV0aWxzLmlzU3RyaW5nKGRvbWFpbikpIHtcbiAgICAgICAgICAgIGNvb2tpZS5wdXNoKCdkb21haW49JyArIGRvbWFpbik7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKHNlY3VyZSA9PT0gdHJ1ZSkge1xuICAgICAgICAgICAgY29va2llLnB1c2goJ3NlY3VyZScpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGRvY3VtZW50LmNvb2tpZSA9IGNvb2tpZS5qb2luKCc7ICcpO1xuICAgICAgICB9LFxuXG4gICAgICAgIHJlYWQ6IGZ1bmN0aW9uIHJlYWQobmFtZSkge1xuICAgICAgICAgIHZhciBtYXRjaCA9IGRvY3VtZW50LmNvb2tpZS5tYXRjaChuZXcgUmVnRXhwKCcoXnw7XFxcXHMqKSgnICsgbmFtZSArICcpPShbXjtdKiknKSk7XG4gICAgICAgICAgcmV0dXJuIChtYXRjaCA/IGRlY29kZVVSSUNvbXBvbmVudChtYXRjaFszXSkgOiBudWxsKTtcbiAgICAgICAgfSxcblxuICAgICAgICByZW1vdmU6IGZ1bmN0aW9uIHJlbW92ZShuYW1lKSB7XG4gICAgICAgICAgdGhpcy53cml0ZShuYW1lLCAnJywgRGF0ZS5ub3coKSAtIDg2NDAwMDAwKTtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9KSgpIDpcblxuICAvLyBOb24gc3RhbmRhcmQgYnJvd3NlciBlbnYgKHdlYiB3b3JrZXJzLCByZWFjdC1uYXRpdmUpIGxhY2sgbmVlZGVkIHN1cHBvcnQuXG4gICAgKGZ1bmN0aW9uIG5vblN0YW5kYXJkQnJvd3NlckVudigpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHdyaXRlOiBmdW5jdGlvbiB3cml0ZSgpIHt9LFxuICAgICAgICByZWFkOiBmdW5jdGlvbiByZWFkKCkgeyByZXR1cm4gbnVsbDsgfSxcbiAgICAgICAgcmVtb3ZlOiBmdW5jdGlvbiByZW1vdmUoKSB7fVxuICAgICAgfTtcbiAgICB9KSgpXG4pO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIERldGVybWluZXMgd2hldGhlciB0aGUgc3BlY2lmaWVkIFVSTCBpcyBhYnNvbHV0ZVxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSB1cmwgVGhlIFVSTCB0byB0ZXN0XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgc3BlY2lmaWVkIFVSTCBpcyBhYnNvbHV0ZSwgb3RoZXJ3aXNlIGZhbHNlXG4gKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gaXNBYnNvbHV0ZVVSTCh1cmwpIHtcbiAgLy8gQSBVUkwgaXMgY29uc2lkZXJlZCBhYnNvbHV0ZSBpZiBpdCBiZWdpbnMgd2l0aCBcIjxzY2hlbWU+Oi8vXCIgb3IgXCIvL1wiIChwcm90b2NvbC1yZWxhdGl2ZSBVUkwpLlxuICAvLyBSRkMgMzk4NiBkZWZpbmVzIHNjaGVtZSBuYW1lIGFzIGEgc2VxdWVuY2Ugb2YgY2hhcmFjdGVycyBiZWdpbm5pbmcgd2l0aCBhIGxldHRlciBhbmQgZm9sbG93ZWRcbiAgLy8gYnkgYW55IGNvbWJpbmF0aW9uIG9mIGxldHRlcnMsIGRpZ2l0cywgcGx1cywgcGVyaW9kLCBvciBoeXBoZW4uXG4gIHJldHVybiAvXihbYS16XVthLXpcXGRcXCtcXC1cXC5dKjopP1xcL1xcLy9pLnRlc3QodXJsKTtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciB1dGlscyA9IHJlcXVpcmUoJy4vLi4vdXRpbHMnKTtcblxubW9kdWxlLmV4cG9ydHMgPSAoXG4gIHV0aWxzLmlzU3RhbmRhcmRCcm93c2VyRW52KCkgP1xuXG4gIC8vIFN0YW5kYXJkIGJyb3dzZXIgZW52cyBoYXZlIGZ1bGwgc3VwcG9ydCBvZiB0aGUgQVBJcyBuZWVkZWQgdG8gdGVzdFxuICAvLyB3aGV0aGVyIHRoZSByZXF1ZXN0IFVSTCBpcyBvZiB0aGUgc2FtZSBvcmlnaW4gYXMgY3VycmVudCBsb2NhdGlvbi5cbiAgICAoZnVuY3Rpb24gc3RhbmRhcmRCcm93c2VyRW52KCkge1xuICAgICAgdmFyIG1zaWUgPSAvKG1zaWV8dHJpZGVudCkvaS50ZXN0KG5hdmlnYXRvci51c2VyQWdlbnQpO1xuICAgICAgdmFyIHVybFBhcnNpbmdOb2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYScpO1xuICAgICAgdmFyIG9yaWdpblVSTDtcblxuICAgICAgLyoqXG4gICAgKiBQYXJzZSBhIFVSTCB0byBkaXNjb3ZlciBpdCdzIGNvbXBvbmVudHNcbiAgICAqXG4gICAgKiBAcGFyYW0ge1N0cmluZ30gdXJsIFRoZSBVUkwgdG8gYmUgcGFyc2VkXG4gICAgKiBAcmV0dXJucyB7T2JqZWN0fVxuICAgICovXG4gICAgICBmdW5jdGlvbiByZXNvbHZlVVJMKHVybCkge1xuICAgICAgICB2YXIgaHJlZiA9IHVybDtcblxuICAgICAgICBpZiAobXNpZSkge1xuICAgICAgICAvLyBJRSBuZWVkcyBhdHRyaWJ1dGUgc2V0IHR3aWNlIHRvIG5vcm1hbGl6ZSBwcm9wZXJ0aWVzXG4gICAgICAgICAgdXJsUGFyc2luZ05vZGUuc2V0QXR0cmlidXRlKCdocmVmJywgaHJlZik7XG4gICAgICAgICAgaHJlZiA9IHVybFBhcnNpbmdOb2RlLmhyZWY7XG4gICAgICAgIH1cblxuICAgICAgICB1cmxQYXJzaW5nTm9kZS5zZXRBdHRyaWJ1dGUoJ2hyZWYnLCBocmVmKTtcblxuICAgICAgICAvLyB1cmxQYXJzaW5nTm9kZSBwcm92aWRlcyB0aGUgVXJsVXRpbHMgaW50ZXJmYWNlIC0gaHR0cDovL3VybC5zcGVjLndoYXR3Zy5vcmcvI3VybHV0aWxzXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgaHJlZjogdXJsUGFyc2luZ05vZGUuaHJlZixcbiAgICAgICAgICBwcm90b2NvbDogdXJsUGFyc2luZ05vZGUucHJvdG9jb2wgPyB1cmxQYXJzaW5nTm9kZS5wcm90b2NvbC5yZXBsYWNlKC86JC8sICcnKSA6ICcnLFxuICAgICAgICAgIGhvc3Q6IHVybFBhcnNpbmdOb2RlLmhvc3QsXG4gICAgICAgICAgc2VhcmNoOiB1cmxQYXJzaW5nTm9kZS5zZWFyY2ggPyB1cmxQYXJzaW5nTm9kZS5zZWFyY2gucmVwbGFjZSgvXlxcPy8sICcnKSA6ICcnLFxuICAgICAgICAgIGhhc2g6IHVybFBhcnNpbmdOb2RlLmhhc2ggPyB1cmxQYXJzaW5nTm9kZS5oYXNoLnJlcGxhY2UoL14jLywgJycpIDogJycsXG4gICAgICAgICAgaG9zdG5hbWU6IHVybFBhcnNpbmdOb2RlLmhvc3RuYW1lLFxuICAgICAgICAgIHBvcnQ6IHVybFBhcnNpbmdOb2RlLnBvcnQsXG4gICAgICAgICAgcGF0aG5hbWU6ICh1cmxQYXJzaW5nTm9kZS5wYXRobmFtZS5jaGFyQXQoMCkgPT09ICcvJykgP1xuICAgICAgICAgICAgdXJsUGFyc2luZ05vZGUucGF0aG5hbWUgOlxuICAgICAgICAgICAgJy8nICsgdXJsUGFyc2luZ05vZGUucGF0aG5hbWVcbiAgICAgICAgfTtcbiAgICAgIH1cblxuICAgICAgb3JpZ2luVVJMID0gcmVzb2x2ZVVSTCh3aW5kb3cubG9jYXRpb24uaHJlZik7XG5cbiAgICAgIC8qKlxuICAgICogRGV0ZXJtaW5lIGlmIGEgVVJMIHNoYXJlcyB0aGUgc2FtZSBvcmlnaW4gYXMgdGhlIGN1cnJlbnQgbG9jYXRpb25cbiAgICAqXG4gICAgKiBAcGFyYW0ge1N0cmluZ30gcmVxdWVzdFVSTCBUaGUgVVJMIHRvIHRlc3RcbiAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIFVSTCBzaGFyZXMgdGhlIHNhbWUgb3JpZ2luLCBvdGhlcndpc2UgZmFsc2VcbiAgICAqL1xuICAgICAgcmV0dXJuIGZ1bmN0aW9uIGlzVVJMU2FtZU9yaWdpbihyZXF1ZXN0VVJMKSB7XG4gICAgICAgIHZhciBwYXJzZWQgPSAodXRpbHMuaXNTdHJpbmcocmVxdWVzdFVSTCkpID8gcmVzb2x2ZVVSTChyZXF1ZXN0VVJMKSA6IHJlcXVlc3RVUkw7XG4gICAgICAgIHJldHVybiAocGFyc2VkLnByb3RvY29sID09PSBvcmlnaW5VUkwucHJvdG9jb2wgJiZcbiAgICAgICAgICAgIHBhcnNlZC5ob3N0ID09PSBvcmlnaW5VUkwuaG9zdCk7XG4gICAgICB9O1xuICAgIH0pKCkgOlxuXG4gIC8vIE5vbiBzdGFuZGFyZCBicm93c2VyIGVudnMgKHdlYiB3b3JrZXJzLCByZWFjdC1uYXRpdmUpIGxhY2sgbmVlZGVkIHN1cHBvcnQuXG4gICAgKGZ1bmN0aW9uIG5vblN0YW5kYXJkQnJvd3NlckVudigpIHtcbiAgICAgIHJldHVybiBmdW5jdGlvbiBpc1VSTFNhbWVPcmlnaW4oKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfTtcbiAgICB9KSgpXG4pO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuLi91dGlscycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIG5vcm1hbGl6ZUhlYWRlck5hbWUoaGVhZGVycywgbm9ybWFsaXplZE5hbWUpIHtcbiAgdXRpbHMuZm9yRWFjaChoZWFkZXJzLCBmdW5jdGlvbiBwcm9jZXNzSGVhZGVyKHZhbHVlLCBuYW1lKSB7XG4gICAgaWYgKG5hbWUgIT09IG5vcm1hbGl6ZWROYW1lICYmIG5hbWUudG9VcHBlckNhc2UoKSA9PT0gbm9ybWFsaXplZE5hbWUudG9VcHBlckNhc2UoKSkge1xuICAgICAgaGVhZGVyc1tub3JtYWxpemVkTmFtZV0gPSB2YWx1ZTtcbiAgICAgIGRlbGV0ZSBoZWFkZXJzW25hbWVdO1xuICAgIH1cbiAgfSk7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuLy4uL3V0aWxzJyk7XG5cbi8vIEhlYWRlcnMgd2hvc2UgZHVwbGljYXRlcyBhcmUgaWdub3JlZCBieSBub2RlXG4vLyBjLmYuIGh0dHBzOi8vbm9kZWpzLm9yZy9hcGkvaHR0cC5odG1sI2h0dHBfbWVzc2FnZV9oZWFkZXJzXG52YXIgaWdub3JlRHVwbGljYXRlT2YgPSBbXG4gICdhZ2UnLCAnYXV0aG9yaXphdGlvbicsICdjb250ZW50LWxlbmd0aCcsICdjb250ZW50LXR5cGUnLCAnZXRhZycsXG4gICdleHBpcmVzJywgJ2Zyb20nLCAnaG9zdCcsICdpZi1tb2RpZmllZC1zaW5jZScsICdpZi11bm1vZGlmaWVkLXNpbmNlJyxcbiAgJ2xhc3QtbW9kaWZpZWQnLCAnbG9jYXRpb24nLCAnbWF4LWZvcndhcmRzJywgJ3Byb3h5LWF1dGhvcml6YXRpb24nLFxuICAncmVmZXJlcicsICdyZXRyeS1hZnRlcicsICd1c2VyLWFnZW50J1xuXTtcblxuLyoqXG4gKiBQYXJzZSBoZWFkZXJzIGludG8gYW4gb2JqZWN0XG4gKlxuICogYGBgXG4gKiBEYXRlOiBXZWQsIDI3IEF1ZyAyMDE0IDA4OjU4OjQ5IEdNVFxuICogQ29udGVudC1UeXBlOiBhcHBsaWNhdGlvbi9qc29uXG4gKiBDb25uZWN0aW9uOiBrZWVwLWFsaXZlXG4gKiBUcmFuc2Zlci1FbmNvZGluZzogY2h1bmtlZFxuICogYGBgXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGhlYWRlcnMgSGVhZGVycyBuZWVkaW5nIHRvIGJlIHBhcnNlZFxuICogQHJldHVybnMge09iamVjdH0gSGVhZGVycyBwYXJzZWQgaW50byBhbiBvYmplY3RcbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBwYXJzZUhlYWRlcnMoaGVhZGVycykge1xuICB2YXIgcGFyc2VkID0ge307XG4gIHZhciBrZXk7XG4gIHZhciB2YWw7XG4gIHZhciBpO1xuXG4gIGlmICghaGVhZGVycykgeyByZXR1cm4gcGFyc2VkOyB9XG5cbiAgdXRpbHMuZm9yRWFjaChoZWFkZXJzLnNwbGl0KCdcXG4nKSwgZnVuY3Rpb24gcGFyc2VyKGxpbmUpIHtcbiAgICBpID0gbGluZS5pbmRleE9mKCc6Jyk7XG4gICAga2V5ID0gdXRpbHMudHJpbShsaW5lLnN1YnN0cigwLCBpKSkudG9Mb3dlckNhc2UoKTtcbiAgICB2YWwgPSB1dGlscy50cmltKGxpbmUuc3Vic3RyKGkgKyAxKSk7XG5cbiAgICBpZiAoa2V5KSB7XG4gICAgICBpZiAocGFyc2VkW2tleV0gJiYgaWdub3JlRHVwbGljYXRlT2YuaW5kZXhPZihrZXkpID49IDApIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKGtleSA9PT0gJ3NldC1jb29raWUnKSB7XG4gICAgICAgIHBhcnNlZFtrZXldID0gKHBhcnNlZFtrZXldID8gcGFyc2VkW2tleV0gOiBbXSkuY29uY2F0KFt2YWxdKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBhcnNlZFtrZXldID0gcGFyc2VkW2tleV0gPyBwYXJzZWRba2V5XSArICcsICcgKyB2YWwgOiB2YWw7XG4gICAgICB9XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gcGFyc2VkO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBTeW50YWN0aWMgc3VnYXIgZm9yIGludm9raW5nIGEgZnVuY3Rpb24gYW5kIGV4cGFuZGluZyBhbiBhcnJheSBmb3IgYXJndW1lbnRzLlxuICpcbiAqIENvbW1vbiB1c2UgY2FzZSB3b3VsZCBiZSB0byB1c2UgYEZ1bmN0aW9uLnByb3RvdHlwZS5hcHBseWAuXG4gKlxuICogIGBgYGpzXG4gKiAgZnVuY3Rpb24gZih4LCB5LCB6KSB7fVxuICogIHZhciBhcmdzID0gWzEsIDIsIDNdO1xuICogIGYuYXBwbHkobnVsbCwgYXJncyk7XG4gKiAgYGBgXG4gKlxuICogV2l0aCBgc3ByZWFkYCB0aGlzIGV4YW1wbGUgY2FuIGJlIHJlLXdyaXR0ZW4uXG4gKlxuICogIGBgYGpzXG4gKiAgc3ByZWFkKGZ1bmN0aW9uKHgsIHksIHopIHt9KShbMSwgMiwgM10pO1xuICogIGBgYFxuICpcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259XG4gKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gc3ByZWFkKGNhbGxiYWNrKSB7XG4gIHJldHVybiBmdW5jdGlvbiB3cmFwKGFycikge1xuICAgIHJldHVybiBjYWxsYmFjay5hcHBseShudWxsLCBhcnIpO1xuICB9O1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGJpbmQgPSByZXF1aXJlKCcuL2hlbHBlcnMvYmluZCcpO1xuXG4vKmdsb2JhbCB0b1N0cmluZzp0cnVlKi9cblxuLy8gdXRpbHMgaXMgYSBsaWJyYXJ5IG9mIGdlbmVyaWMgaGVscGVyIGZ1bmN0aW9ucyBub24tc3BlY2lmaWMgdG8gYXhpb3NcblxudmFyIHRvU3RyaW5nID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZztcblxuLyoqXG4gKiBEZXRlcm1pbmUgaWYgYSB2YWx1ZSBpcyBhbiBBcnJheVxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSB2YWwgVGhlIHZhbHVlIHRvIHRlc3RcbiAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHZhbHVlIGlzIGFuIEFycmF5LCBvdGhlcndpc2UgZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNBcnJheSh2YWwpIHtcbiAgcmV0dXJuIHRvU3RyaW5nLmNhbGwodmFsKSA9PT0gJ1tvYmplY3QgQXJyYXldJztcbn1cblxuLyoqXG4gKiBEZXRlcm1pbmUgaWYgYSB2YWx1ZSBpcyB1bmRlZmluZWRcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gdmFsIFRoZSB2YWx1ZSB0byB0ZXN0XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgdmFsdWUgaXMgdW5kZWZpbmVkLCBvdGhlcndpc2UgZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNVbmRlZmluZWQodmFsKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsID09PSAndW5kZWZpbmVkJztcbn1cblxuLyoqXG4gKiBEZXRlcm1pbmUgaWYgYSB2YWx1ZSBpcyBhIEJ1ZmZlclxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSB2YWwgVGhlIHZhbHVlIHRvIHRlc3RcbiAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHZhbHVlIGlzIGEgQnVmZmVyLCBvdGhlcndpc2UgZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNCdWZmZXIodmFsKSB7XG4gIHJldHVybiB2YWwgIT09IG51bGwgJiYgIWlzVW5kZWZpbmVkKHZhbCkgJiYgdmFsLmNvbnN0cnVjdG9yICE9PSBudWxsICYmICFpc1VuZGVmaW5lZCh2YWwuY29uc3RydWN0b3IpXG4gICAgJiYgdHlwZW9mIHZhbC5jb25zdHJ1Y3Rvci5pc0J1ZmZlciA9PT0gJ2Z1bmN0aW9uJyAmJiB2YWwuY29uc3RydWN0b3IuaXNCdWZmZXIodmFsKTtcbn1cblxuLyoqXG4gKiBEZXRlcm1pbmUgaWYgYSB2YWx1ZSBpcyBhbiBBcnJheUJ1ZmZlclxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSB2YWwgVGhlIHZhbHVlIHRvIHRlc3RcbiAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHZhbHVlIGlzIGFuIEFycmF5QnVmZmVyLCBvdGhlcndpc2UgZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNBcnJheUJ1ZmZlcih2YWwpIHtcbiAgcmV0dXJuIHRvU3RyaW5nLmNhbGwodmFsKSA9PT0gJ1tvYmplY3QgQXJyYXlCdWZmZXJdJztcbn1cblxuLyoqXG4gKiBEZXRlcm1pbmUgaWYgYSB2YWx1ZSBpcyBhIEZvcm1EYXRhXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IHZhbCBUaGUgdmFsdWUgdG8gdGVzdFxuICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdmFsdWUgaXMgYW4gRm9ybURhdGEsIG90aGVyd2lzZSBmYWxzZVxuICovXG5mdW5jdGlvbiBpc0Zvcm1EYXRhKHZhbCkge1xuICByZXR1cm4gKHR5cGVvZiBGb3JtRGF0YSAhPT0gJ3VuZGVmaW5lZCcpICYmICh2YWwgaW5zdGFuY2VvZiBGb3JtRGF0YSk7XG59XG5cbi8qKlxuICogRGV0ZXJtaW5lIGlmIGEgdmFsdWUgaXMgYSB2aWV3IG9uIGFuIEFycmF5QnVmZmVyXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IHZhbCBUaGUgdmFsdWUgdG8gdGVzdFxuICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdmFsdWUgaXMgYSB2aWV3IG9uIGFuIEFycmF5QnVmZmVyLCBvdGhlcndpc2UgZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNBcnJheUJ1ZmZlclZpZXcodmFsKSB7XG4gIHZhciByZXN1bHQ7XG4gIGlmICgodHlwZW9mIEFycmF5QnVmZmVyICE9PSAndW5kZWZpbmVkJykgJiYgKEFycmF5QnVmZmVyLmlzVmlldykpIHtcbiAgICByZXN1bHQgPSBBcnJheUJ1ZmZlci5pc1ZpZXcodmFsKTtcbiAgfSBlbHNlIHtcbiAgICByZXN1bHQgPSAodmFsKSAmJiAodmFsLmJ1ZmZlcikgJiYgKHZhbC5idWZmZXIgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcik7XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuLyoqXG4gKiBEZXRlcm1pbmUgaWYgYSB2YWx1ZSBpcyBhIFN0cmluZ1xuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSB2YWwgVGhlIHZhbHVlIHRvIHRlc3RcbiAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHZhbHVlIGlzIGEgU3RyaW5nLCBvdGhlcndpc2UgZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNTdHJpbmcodmFsKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsID09PSAnc3RyaW5nJztcbn1cblxuLyoqXG4gKiBEZXRlcm1pbmUgaWYgYSB2YWx1ZSBpcyBhIE51bWJlclxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSB2YWwgVGhlIHZhbHVlIHRvIHRlc3RcbiAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHZhbHVlIGlzIGEgTnVtYmVyLCBvdGhlcndpc2UgZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNOdW1iZXIodmFsKSB7XG4gIHJldHVybiB0eXBlb2YgdmFsID09PSAnbnVtYmVyJztcbn1cblxuLyoqXG4gKiBEZXRlcm1pbmUgaWYgYSB2YWx1ZSBpcyBhbiBPYmplY3RcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gdmFsIFRoZSB2YWx1ZSB0byB0ZXN0XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB2YWx1ZSBpcyBhbiBPYmplY3QsIG90aGVyd2lzZSBmYWxzZVxuICovXG5mdW5jdGlvbiBpc09iamVjdCh2YWwpIHtcbiAgcmV0dXJuIHZhbCAhPT0gbnVsbCAmJiB0eXBlb2YgdmFsID09PSAnb2JqZWN0Jztcbn1cblxuLyoqXG4gKiBEZXRlcm1pbmUgaWYgYSB2YWx1ZSBpcyBhIERhdGVcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gdmFsIFRoZSB2YWx1ZSB0byB0ZXN0XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB2YWx1ZSBpcyBhIERhdGUsIG90aGVyd2lzZSBmYWxzZVxuICovXG5mdW5jdGlvbiBpc0RhdGUodmFsKSB7XG4gIHJldHVybiB0b1N0cmluZy5jYWxsKHZhbCkgPT09ICdbb2JqZWN0IERhdGVdJztcbn1cblxuLyoqXG4gKiBEZXRlcm1pbmUgaWYgYSB2YWx1ZSBpcyBhIEZpbGVcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gdmFsIFRoZSB2YWx1ZSB0byB0ZXN0XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB2YWx1ZSBpcyBhIEZpbGUsIG90aGVyd2lzZSBmYWxzZVxuICovXG5mdW5jdGlvbiBpc0ZpbGUodmFsKSB7XG4gIHJldHVybiB0b1N0cmluZy5jYWxsKHZhbCkgPT09ICdbb2JqZWN0IEZpbGVdJztcbn1cblxuLyoqXG4gKiBEZXRlcm1pbmUgaWYgYSB2YWx1ZSBpcyBhIEJsb2JcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gdmFsIFRoZSB2YWx1ZSB0byB0ZXN0XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB2YWx1ZSBpcyBhIEJsb2IsIG90aGVyd2lzZSBmYWxzZVxuICovXG5mdW5jdGlvbiBpc0Jsb2IodmFsKSB7XG4gIHJldHVybiB0b1N0cmluZy5jYWxsKHZhbCkgPT09ICdbb2JqZWN0IEJsb2JdJztcbn1cblxuLyoqXG4gKiBEZXRlcm1pbmUgaWYgYSB2YWx1ZSBpcyBhIEZ1bmN0aW9uXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IHZhbCBUaGUgdmFsdWUgdG8gdGVzdFxuICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdmFsdWUgaXMgYSBGdW5jdGlvbiwgb3RoZXJ3aXNlIGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzRnVuY3Rpb24odmFsKSB7XG4gIHJldHVybiB0b1N0cmluZy5jYWxsKHZhbCkgPT09ICdbb2JqZWN0IEZ1bmN0aW9uXSc7XG59XG5cbi8qKlxuICogRGV0ZXJtaW5lIGlmIGEgdmFsdWUgaXMgYSBTdHJlYW1cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gdmFsIFRoZSB2YWx1ZSB0byB0ZXN0XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB2YWx1ZSBpcyBhIFN0cmVhbSwgb3RoZXJ3aXNlIGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzU3RyZWFtKHZhbCkge1xuICByZXR1cm4gaXNPYmplY3QodmFsKSAmJiBpc0Z1bmN0aW9uKHZhbC5waXBlKTtcbn1cblxuLyoqXG4gKiBEZXRlcm1pbmUgaWYgYSB2YWx1ZSBpcyBhIFVSTFNlYXJjaFBhcmFtcyBvYmplY3RcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gdmFsIFRoZSB2YWx1ZSB0byB0ZXN0XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB2YWx1ZSBpcyBhIFVSTFNlYXJjaFBhcmFtcyBvYmplY3QsIG90aGVyd2lzZSBmYWxzZVxuICovXG5mdW5jdGlvbiBpc1VSTFNlYXJjaFBhcmFtcyh2YWwpIHtcbiAgcmV0dXJuIHR5cGVvZiBVUkxTZWFyY2hQYXJhbXMgIT09ICd1bmRlZmluZWQnICYmIHZhbCBpbnN0YW5jZW9mIFVSTFNlYXJjaFBhcmFtcztcbn1cblxuLyoqXG4gKiBUcmltIGV4Y2VzcyB3aGl0ZXNwYWNlIG9mZiB0aGUgYmVnaW5uaW5nIGFuZCBlbmQgb2YgYSBzdHJpbmdcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyIFRoZSBTdHJpbmcgdG8gdHJpbVxuICogQHJldHVybnMge1N0cmluZ30gVGhlIFN0cmluZyBmcmVlZCBvZiBleGNlc3Mgd2hpdGVzcGFjZVxuICovXG5mdW5jdGlvbiB0cmltKHN0cikge1xuICByZXR1cm4gc3RyLnJlcGxhY2UoL15cXHMqLywgJycpLnJlcGxhY2UoL1xccyokLywgJycpO1xufVxuXG4vKipcbiAqIERldGVybWluZSBpZiB3ZSdyZSBydW5uaW5nIGluIGEgc3RhbmRhcmQgYnJvd3NlciBlbnZpcm9ubWVudFxuICpcbiAqIFRoaXMgYWxsb3dzIGF4aW9zIHRvIHJ1biBpbiBhIHdlYiB3b3JrZXIsIGFuZCByZWFjdC1uYXRpdmUuXG4gKiBCb3RoIGVudmlyb25tZW50cyBzdXBwb3J0IFhNTEh0dHBSZXF1ZXN0LCBidXQgbm90IGZ1bGx5IHN0YW5kYXJkIGdsb2JhbHMuXG4gKlxuICogd2ViIHdvcmtlcnM6XG4gKiAgdHlwZW9mIHdpbmRvdyAtPiB1bmRlZmluZWRcbiAqICB0eXBlb2YgZG9jdW1lbnQgLT4gdW5kZWZpbmVkXG4gKlxuICogcmVhY3QtbmF0aXZlOlxuICogIG5hdmlnYXRvci5wcm9kdWN0IC0+ICdSZWFjdE5hdGl2ZSdcbiAqIG5hdGl2ZXNjcmlwdFxuICogIG5hdmlnYXRvci5wcm9kdWN0IC0+ICdOYXRpdmVTY3JpcHQnIG9yICdOUydcbiAqL1xuZnVuY3Rpb24gaXNTdGFuZGFyZEJyb3dzZXJFbnYoKSB7XG4gIGlmICh0eXBlb2YgbmF2aWdhdG9yICE9PSAndW5kZWZpbmVkJyAmJiAobmF2aWdhdG9yLnByb2R1Y3QgPT09ICdSZWFjdE5hdGl2ZScgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuYXZpZ2F0b3IucHJvZHVjdCA9PT0gJ05hdGl2ZVNjcmlwdCcgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuYXZpZ2F0b3IucHJvZHVjdCA9PT0gJ05TJykpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgcmV0dXJuIChcbiAgICB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJlxuICAgIHR5cGVvZiBkb2N1bWVudCAhPT0gJ3VuZGVmaW5lZCdcbiAgKTtcbn1cblxuLyoqXG4gKiBJdGVyYXRlIG92ZXIgYW4gQXJyYXkgb3IgYW4gT2JqZWN0IGludm9raW5nIGEgZnVuY3Rpb24gZm9yIGVhY2ggaXRlbS5cbiAqXG4gKiBJZiBgb2JqYCBpcyBhbiBBcnJheSBjYWxsYmFjayB3aWxsIGJlIGNhbGxlZCBwYXNzaW5nXG4gKiB0aGUgdmFsdWUsIGluZGV4LCBhbmQgY29tcGxldGUgYXJyYXkgZm9yIGVhY2ggaXRlbS5cbiAqXG4gKiBJZiAnb2JqJyBpcyBhbiBPYmplY3QgY2FsbGJhY2sgd2lsbCBiZSBjYWxsZWQgcGFzc2luZ1xuICogdGhlIHZhbHVlLCBrZXksIGFuZCBjb21wbGV0ZSBvYmplY3QgZm9yIGVhY2ggcHJvcGVydHkuXG4gKlxuICogQHBhcmFtIHtPYmplY3R8QXJyYXl9IG9iaiBUaGUgb2JqZWN0IHRvIGl0ZXJhdGVcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZuIFRoZSBjYWxsYmFjayB0byBpbnZva2UgZm9yIGVhY2ggaXRlbVxuICovXG5mdW5jdGlvbiBmb3JFYWNoKG9iaiwgZm4pIHtcbiAgLy8gRG9uJ3QgYm90aGVyIGlmIG5vIHZhbHVlIHByb3ZpZGVkXG4gIGlmIChvYmogPT09IG51bGwgfHwgdHlwZW9mIG9iaiA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICAvLyBGb3JjZSBhbiBhcnJheSBpZiBub3QgYWxyZWFkeSBzb21ldGhpbmcgaXRlcmFibGVcbiAgaWYgKHR5cGVvZiBvYmogIT09ICdvYmplY3QnKSB7XG4gICAgLyplc2xpbnQgbm8tcGFyYW0tcmVhc3NpZ246MCovXG4gICAgb2JqID0gW29ial07XG4gIH1cblxuICBpZiAoaXNBcnJheShvYmopKSB7XG4gICAgLy8gSXRlcmF0ZSBvdmVyIGFycmF5IHZhbHVlc1xuICAgIGZvciAodmFyIGkgPSAwLCBsID0gb2JqLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgZm4uY2FsbChudWxsLCBvYmpbaV0sIGksIG9iaik7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIC8vIEl0ZXJhdGUgb3ZlciBvYmplY3Qga2V5c1xuICAgIGZvciAodmFyIGtleSBpbiBvYmopIHtcbiAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqLCBrZXkpKSB7XG4gICAgICAgIGZuLmNhbGwobnVsbCwgb2JqW2tleV0sIGtleSwgb2JqKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBBY2NlcHRzIHZhcmFyZ3MgZXhwZWN0aW5nIGVhY2ggYXJndW1lbnQgdG8gYmUgYW4gb2JqZWN0LCB0aGVuXG4gKiBpbW11dGFibHkgbWVyZ2VzIHRoZSBwcm9wZXJ0aWVzIG9mIGVhY2ggb2JqZWN0IGFuZCByZXR1cm5zIHJlc3VsdC5cbiAqXG4gKiBXaGVuIG11bHRpcGxlIG9iamVjdHMgY29udGFpbiB0aGUgc2FtZSBrZXkgdGhlIGxhdGVyIG9iamVjdCBpblxuICogdGhlIGFyZ3VtZW50cyBsaXN0IHdpbGwgdGFrZSBwcmVjZWRlbmNlLlxuICpcbiAqIEV4YW1wbGU6XG4gKlxuICogYGBganNcbiAqIHZhciByZXN1bHQgPSBtZXJnZSh7Zm9vOiAxMjN9LCB7Zm9vOiA0NTZ9KTtcbiAqIGNvbnNvbGUubG9nKHJlc3VsdC5mb28pOyAvLyBvdXRwdXRzIDQ1NlxuICogYGBgXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IG9iajEgT2JqZWN0IHRvIG1lcmdlXG4gKiBAcmV0dXJucyB7T2JqZWN0fSBSZXN1bHQgb2YgYWxsIG1lcmdlIHByb3BlcnRpZXNcbiAqL1xuZnVuY3Rpb24gbWVyZ2UoLyogb2JqMSwgb2JqMiwgb2JqMywgLi4uICovKSB7XG4gIHZhciByZXN1bHQgPSB7fTtcbiAgZnVuY3Rpb24gYXNzaWduVmFsdWUodmFsLCBrZXkpIHtcbiAgICBpZiAodHlwZW9mIHJlc3VsdFtrZXldID09PSAnb2JqZWN0JyAmJiB0eXBlb2YgdmFsID09PSAnb2JqZWN0Jykge1xuICAgICAgcmVzdWx0W2tleV0gPSBtZXJnZShyZXN1bHRba2V5XSwgdmFsKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzdWx0W2tleV0gPSB2YWw7XG4gICAgfVxuICB9XG5cbiAgZm9yICh2YXIgaSA9IDAsIGwgPSBhcmd1bWVudHMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgZm9yRWFjaChhcmd1bWVudHNbaV0sIGFzc2lnblZhbHVlKTtcbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuXG4vKipcbiAqIEZ1bmN0aW9uIGVxdWFsIHRvIG1lcmdlIHdpdGggdGhlIGRpZmZlcmVuY2UgYmVpbmcgdGhhdCBubyByZWZlcmVuY2VcbiAqIHRvIG9yaWdpbmFsIG9iamVjdHMgaXMga2VwdC5cbiAqXG4gKiBAc2VlIG1lcmdlXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqMSBPYmplY3QgdG8gbWVyZ2VcbiAqIEByZXR1cm5zIHtPYmplY3R9IFJlc3VsdCBvZiBhbGwgbWVyZ2UgcHJvcGVydGllc1xuICovXG5mdW5jdGlvbiBkZWVwTWVyZ2UoLyogb2JqMSwgb2JqMiwgb2JqMywgLi4uICovKSB7XG4gIHZhciByZXN1bHQgPSB7fTtcbiAgZnVuY3Rpb24gYXNzaWduVmFsdWUodmFsLCBrZXkpIHtcbiAgICBpZiAodHlwZW9mIHJlc3VsdFtrZXldID09PSAnb2JqZWN0JyAmJiB0eXBlb2YgdmFsID09PSAnb2JqZWN0Jykge1xuICAgICAgcmVzdWx0W2tleV0gPSBkZWVwTWVyZ2UocmVzdWx0W2tleV0sIHZhbCk7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgdmFsID09PSAnb2JqZWN0Jykge1xuICAgICAgcmVzdWx0W2tleV0gPSBkZWVwTWVyZ2Uoe30sIHZhbCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlc3VsdFtrZXldID0gdmFsO1xuICAgIH1cbiAgfVxuXG4gIGZvciAodmFyIGkgPSAwLCBsID0gYXJndW1lbnRzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgIGZvckVhY2goYXJndW1lbnRzW2ldLCBhc3NpZ25WYWx1ZSk7XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuLyoqXG4gKiBFeHRlbmRzIG9iamVjdCBhIGJ5IG11dGFibHkgYWRkaW5nIHRvIGl0IHRoZSBwcm9wZXJ0aWVzIG9mIG9iamVjdCBiLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBhIFRoZSBvYmplY3QgdG8gYmUgZXh0ZW5kZWRcbiAqIEBwYXJhbSB7T2JqZWN0fSBiIFRoZSBvYmplY3QgdG8gY29weSBwcm9wZXJ0aWVzIGZyb21cbiAqIEBwYXJhbSB7T2JqZWN0fSB0aGlzQXJnIFRoZSBvYmplY3QgdG8gYmluZCBmdW5jdGlvbiB0b1xuICogQHJldHVybiB7T2JqZWN0fSBUaGUgcmVzdWx0aW5nIHZhbHVlIG9mIG9iamVjdCBhXG4gKi9cbmZ1bmN0aW9uIGV4dGVuZChhLCBiLCB0aGlzQXJnKSB7XG4gIGZvckVhY2goYiwgZnVuY3Rpb24gYXNzaWduVmFsdWUodmFsLCBrZXkpIHtcbiAgICBpZiAodGhpc0FyZyAmJiB0eXBlb2YgdmFsID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBhW2tleV0gPSBiaW5kKHZhbCwgdGhpc0FyZyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGFba2V5XSA9IHZhbDtcbiAgICB9XG4gIH0pO1xuICByZXR1cm4gYTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIGlzQXJyYXk6IGlzQXJyYXksXG4gIGlzQXJyYXlCdWZmZXI6IGlzQXJyYXlCdWZmZXIsXG4gIGlzQnVmZmVyOiBpc0J1ZmZlcixcbiAgaXNGb3JtRGF0YTogaXNGb3JtRGF0YSxcbiAgaXNBcnJheUJ1ZmZlclZpZXc6IGlzQXJyYXlCdWZmZXJWaWV3LFxuICBpc1N0cmluZzogaXNTdHJpbmcsXG4gIGlzTnVtYmVyOiBpc051bWJlcixcbiAgaXNPYmplY3Q6IGlzT2JqZWN0LFxuICBpc1VuZGVmaW5lZDogaXNVbmRlZmluZWQsXG4gIGlzRGF0ZTogaXNEYXRlLFxuICBpc0ZpbGU6IGlzRmlsZSxcbiAgaXNCbG9iOiBpc0Jsb2IsXG4gIGlzRnVuY3Rpb246IGlzRnVuY3Rpb24sXG4gIGlzU3RyZWFtOiBpc1N0cmVhbSxcbiAgaXNVUkxTZWFyY2hQYXJhbXM6IGlzVVJMU2VhcmNoUGFyYW1zLFxuICBpc1N0YW5kYXJkQnJvd3NlckVudjogaXNTdGFuZGFyZEJyb3dzZXJFbnYsXG4gIGZvckVhY2g6IGZvckVhY2gsXG4gIG1lcmdlOiBtZXJnZSxcbiAgZGVlcE1lcmdlOiBkZWVwTWVyZ2UsXG4gIGV4dGVuZDogZXh0ZW5kLFxuICB0cmltOiB0cmltXG59O1xuIiwiLy8gc2hpbSBmb3IgdXNpbmcgcHJvY2VzcyBpbiBicm93c2VyXG52YXIgcHJvY2VzcyA9IG1vZHVsZS5leHBvcnRzID0ge307XG5cbi8vIGNhY2hlZCBmcm9tIHdoYXRldmVyIGdsb2JhbCBpcyBwcmVzZW50IHNvIHRoYXQgdGVzdCBydW5uZXJzIHRoYXQgc3R1YiBpdFxuLy8gZG9uJ3QgYnJlYWsgdGhpbmdzLiAgQnV0IHdlIG5lZWQgdG8gd3JhcCBpdCBpbiBhIHRyeSBjYXRjaCBpbiBjYXNlIGl0IGlzXG4vLyB3cmFwcGVkIGluIHN0cmljdCBtb2RlIGNvZGUgd2hpY2ggZG9lc24ndCBkZWZpbmUgYW55IGdsb2JhbHMuICBJdCdzIGluc2lkZSBhXG4vLyBmdW5jdGlvbiBiZWNhdXNlIHRyeS9jYXRjaGVzIGRlb3B0aW1pemUgaW4gY2VydGFpbiBlbmdpbmVzLlxuXG52YXIgY2FjaGVkU2V0VGltZW91dDtcbnZhciBjYWNoZWRDbGVhclRpbWVvdXQ7XG5cbmZ1bmN0aW9uIGRlZmF1bHRTZXRUaW1vdXQoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdzZXRUaW1lb3V0IGhhcyBub3QgYmVlbiBkZWZpbmVkJyk7XG59XG5mdW5jdGlvbiBkZWZhdWx0Q2xlYXJUaW1lb3V0ICgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2NsZWFyVGltZW91dCBoYXMgbm90IGJlZW4gZGVmaW5lZCcpO1xufVxuKGZ1bmN0aW9uICgpIHtcbiAgICB0cnkge1xuICAgICAgICBpZiAodHlwZW9mIHNldFRpbWVvdXQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBzZXRUaW1lb3V0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IGRlZmF1bHRTZXRUaW1vdXQ7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBkZWZhdWx0U2V0VGltb3V0O1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgICBpZiAodHlwZW9mIGNsZWFyVGltZW91dCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gY2xlYXJUaW1lb3V0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gZGVmYXVsdENsZWFyVGltZW91dDtcbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gZGVmYXVsdENsZWFyVGltZW91dDtcbiAgICB9XG59ICgpKVxuZnVuY3Rpb24gcnVuVGltZW91dChmdW4pIHtcbiAgICBpZiAoY2FjaGVkU2V0VGltZW91dCA9PT0gc2V0VGltZW91dCkge1xuICAgICAgICAvL25vcm1hbCBlbnZpcm9tZW50cyBpbiBzYW5lIHNpdHVhdGlvbnNcbiAgICAgICAgcmV0dXJuIHNldFRpbWVvdXQoZnVuLCAwKTtcbiAgICB9XG4gICAgLy8gaWYgc2V0VGltZW91dCB3YXNuJ3QgYXZhaWxhYmxlIGJ1dCB3YXMgbGF0dGVyIGRlZmluZWRcbiAgICBpZiAoKGNhY2hlZFNldFRpbWVvdXQgPT09IGRlZmF1bHRTZXRUaW1vdXQgfHwgIWNhY2hlZFNldFRpbWVvdXQpICYmIHNldFRpbWVvdXQpIHtcbiAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IHNldFRpbWVvdXQ7XG4gICAgICAgIHJldHVybiBzZXRUaW1lb3V0KGZ1biwgMCk7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAgIC8vIHdoZW4gd2hlbiBzb21lYm9keSBoYXMgc2NyZXdlZCB3aXRoIHNldFRpbWVvdXQgYnV0IG5vIEkuRS4gbWFkZG5lc3NcbiAgICAgICAgcmV0dXJuIGNhY2hlZFNldFRpbWVvdXQoZnVuLCAwKTtcbiAgICB9IGNhdGNoKGUpe1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gV2hlbiB3ZSBhcmUgaW4gSS5FLiBidXQgdGhlIHNjcmlwdCBoYXMgYmVlbiBldmFsZWQgc28gSS5FLiBkb2Vzbid0IHRydXN0IHRoZSBnbG9iYWwgb2JqZWN0IHdoZW4gY2FsbGVkIG5vcm1hbGx5XG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkU2V0VGltZW91dC5jYWxsKG51bGwsIGZ1biwgMCk7XG4gICAgICAgIH0gY2F0Y2goZSl7XG4gICAgICAgICAgICAvLyBzYW1lIGFzIGFib3ZlIGJ1dCB3aGVuIGl0J3MgYSB2ZXJzaW9uIG9mIEkuRS4gdGhhdCBtdXN0IGhhdmUgdGhlIGdsb2JhbCBvYmplY3QgZm9yICd0aGlzJywgaG9wZnVsbHkgb3VyIGNvbnRleHQgY29ycmVjdCBvdGhlcndpc2UgaXQgd2lsbCB0aHJvdyBhIGdsb2JhbCBlcnJvclxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZFNldFRpbWVvdXQuY2FsbCh0aGlzLCBmdW4sIDApO1xuICAgICAgICB9XG4gICAgfVxuXG5cbn1cbmZ1bmN0aW9uIHJ1bkNsZWFyVGltZW91dChtYXJrZXIpIHtcbiAgICBpZiAoY2FjaGVkQ2xlYXJUaW1lb3V0ID09PSBjbGVhclRpbWVvdXQpIHtcbiAgICAgICAgLy9ub3JtYWwgZW52aXJvbWVudHMgaW4gc2FuZSBzaXR1YXRpb25zXG4gICAgICAgIHJldHVybiBjbGVhclRpbWVvdXQobWFya2VyKTtcbiAgICB9XG4gICAgLy8gaWYgY2xlYXJUaW1lb3V0IHdhc24ndCBhdmFpbGFibGUgYnV0IHdhcyBsYXR0ZXIgZGVmaW5lZFxuICAgIGlmICgoY2FjaGVkQ2xlYXJUaW1lb3V0ID09PSBkZWZhdWx0Q2xlYXJUaW1lb3V0IHx8ICFjYWNoZWRDbGVhclRpbWVvdXQpICYmIGNsZWFyVGltZW91dCkge1xuICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBjbGVhclRpbWVvdXQ7XG4gICAgICAgIHJldHVybiBjbGVhclRpbWVvdXQobWFya2VyKTtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgLy8gd2hlbiB3aGVuIHNvbWVib2R5IGhhcyBzY3Jld2VkIHdpdGggc2V0VGltZW91dCBidXQgbm8gSS5FLiBtYWRkbmVzc1xuICAgICAgICByZXR1cm4gY2FjaGVkQ2xlYXJUaW1lb3V0KG1hcmtlcik7XG4gICAgfSBjYXRjaCAoZSl7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBXaGVuIHdlIGFyZSBpbiBJLkUuIGJ1dCB0aGUgc2NyaXB0IGhhcyBiZWVuIGV2YWxlZCBzbyBJLkUuIGRvZXNuJ3QgIHRydXN0IHRoZSBnbG9iYWwgb2JqZWN0IHdoZW4gY2FsbGVkIG5vcm1hbGx5XG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkQ2xlYXJUaW1lb3V0LmNhbGwobnVsbCwgbWFya2VyKTtcbiAgICAgICAgfSBjYXRjaCAoZSl7XG4gICAgICAgICAgICAvLyBzYW1lIGFzIGFib3ZlIGJ1dCB3aGVuIGl0J3MgYSB2ZXJzaW9uIG9mIEkuRS4gdGhhdCBtdXN0IGhhdmUgdGhlIGdsb2JhbCBvYmplY3QgZm9yICd0aGlzJywgaG9wZnVsbHkgb3VyIGNvbnRleHQgY29ycmVjdCBvdGhlcndpc2UgaXQgd2lsbCB0aHJvdyBhIGdsb2JhbCBlcnJvci5cbiAgICAgICAgICAgIC8vIFNvbWUgdmVyc2lvbnMgb2YgSS5FLiBoYXZlIGRpZmZlcmVudCBydWxlcyBmb3IgY2xlYXJUaW1lb3V0IHZzIHNldFRpbWVvdXRcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRDbGVhclRpbWVvdXQuY2FsbCh0aGlzLCBtYXJrZXIpO1xuICAgICAgICB9XG4gICAgfVxuXG5cblxufVxudmFyIHF1ZXVlID0gW107XG52YXIgZHJhaW5pbmcgPSBmYWxzZTtcbnZhciBjdXJyZW50UXVldWU7XG52YXIgcXVldWVJbmRleCA9IC0xO1xuXG5mdW5jdGlvbiBjbGVhblVwTmV4dFRpY2soKSB7XG4gICAgaWYgKCFkcmFpbmluZyB8fCAhY3VycmVudFF1ZXVlKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBpZiAoY3VycmVudFF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBxdWV1ZSA9IGN1cnJlbnRRdWV1ZS5jb25jYXQocXVldWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICB9XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBkcmFpblF1ZXVlKCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBkcmFpblF1ZXVlKCkge1xuICAgIGlmIChkcmFpbmluZykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciB0aW1lb3V0ID0gcnVuVGltZW91dChjbGVhblVwTmV4dFRpY2spO1xuICAgIGRyYWluaW5nID0gdHJ1ZTtcblxuICAgIHZhciBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgd2hpbGUobGVuKSB7XG4gICAgICAgIGN1cnJlbnRRdWV1ZSA9IHF1ZXVlO1xuICAgICAgICBxdWV1ZSA9IFtdO1xuICAgICAgICB3aGlsZSAoKytxdWV1ZUluZGV4IDwgbGVuKSB7XG4gICAgICAgICAgICBpZiAoY3VycmVudFF1ZXVlKSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFF1ZXVlW3F1ZXVlSW5kZXhdLnJ1bigpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICAgICAgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIH1cbiAgICBjdXJyZW50UXVldWUgPSBudWxsO1xuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgcnVuQ2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xufVxuXG5wcm9jZXNzLm5leHRUaWNrID0gZnVuY3Rpb24gKGZ1bikge1xuICAgIHZhciBhcmdzID0gbmV3IEFycmF5KGFyZ3VtZW50cy5sZW5ndGggLSAxKTtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICB9XG4gICAgfVxuICAgIHF1ZXVlLnB1c2gobmV3IEl0ZW0oZnVuLCBhcmdzKSk7XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCA9PT0gMSAmJiAhZHJhaW5pbmcpIHtcbiAgICAgICAgcnVuVGltZW91dChkcmFpblF1ZXVlKTtcbiAgICB9XG59O1xuXG4vLyB2OCBsaWtlcyBwcmVkaWN0aWJsZSBvYmplY3RzXG5mdW5jdGlvbiBJdGVtKGZ1biwgYXJyYXkpIHtcbiAgICB0aGlzLmZ1biA9IGZ1bjtcbiAgICB0aGlzLmFycmF5ID0gYXJyYXk7XG59XG5JdGVtLnByb3RvdHlwZS5ydW4gPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5mdW4uYXBwbHkobnVsbCwgdGhpcy5hcnJheSk7XG59O1xucHJvY2Vzcy50aXRsZSA9ICdicm93c2VyJztcbnByb2Nlc3MuYnJvd3NlciA9IHRydWU7XG5wcm9jZXNzLmVudiA9IHt9O1xucHJvY2Vzcy5hcmd2ID0gW107XG5wcm9jZXNzLnZlcnNpb24gPSAnJzsgLy8gZW1wdHkgc3RyaW5nIHRvIGF2b2lkIHJlZ2V4cCBpc3N1ZXNcbnByb2Nlc3MudmVyc2lvbnMgPSB7fTtcblxuZnVuY3Rpb24gbm9vcCgpIHt9XG5cbnByb2Nlc3Mub24gPSBub29wO1xucHJvY2Vzcy5hZGRMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLm9uY2UgPSBub29wO1xucHJvY2Vzcy5vZmYgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUFsbExpc3RlbmVycyA9IG5vb3A7XG5wcm9jZXNzLmVtaXQgPSBub29wO1xucHJvY2Vzcy5wcmVwZW5kTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5wcmVwZW5kT25jZUxpc3RlbmVyID0gbm9vcDtcblxucHJvY2Vzcy5saXN0ZW5lcnMgPSBmdW5jdGlvbiAobmFtZSkgeyByZXR1cm4gW10gfVxuXG5wcm9jZXNzLmJpbmRpbmcgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5iaW5kaW5nIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5cbnByb2Nlc3MuY3dkID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gJy8nIH07XG5wcm9jZXNzLmNoZGlyID0gZnVuY3Rpb24gKGRpcikge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5jaGRpciBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xucHJvY2Vzcy51bWFzayA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gMDsgfTtcbiIsIu+7vyd1c2Ugc3RyaWN0J1xyXG5cclxudmFyIFBsYXllciA9IHJlcXVpcmUoJy4uL2RuZC9wbGF5ZXIuanMnKVxyXG52YXIgTnBjID0gcmVxdWlyZSgnLi4vZG5kL25wYy5qcycpXHJcbnZhciBWZWhpY2xlID0gcmVxdWlyZSgnLi4vZG5kL3ZlaGljbGUuanMnKVxyXG5cclxudmFyIHBsYXllcnMgPSBbXVxyXG52YXIgbnBjcyA9IFtdXHJcbnZhciB2ZWhpY2xlcyA9IFtdXHJcblxyXG52YXIgcGxheWVyQnlJZCA9IGZ1bmN0aW9uIChpZCkge1xyXG4gICAgdmFyIHBsYXllciA9IG51bGxcclxuXHJcbiAgICBpZiAoVXRpbHMuaXNOdW1lcmljKGlkKSkge1xyXG4gICAgICAgIHBsYXllciA9IHBsYXllcnMuZmlsdGVyKChhKSA9PiBhLmlkID09PSBpZClcclxuICAgICAgICBpZiAocGxheWVyLmxlbmd0aCA+IDApXHJcbiAgICAgICAgICAgIHJldHVybiBwbGF5ZXJbMF1cclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gcGxheWVyXHJcbn1cclxuXHJcbnZhciBucGNCeUlkID0gZnVuY3Rpb24gKGlkKSB7XHJcbiAgICB2YXIgbnBjID0gbnVsbDtcclxuXHJcbiAgICBpZiAoVXRpbHMuaXNOdW1lcmljKGlkKSkge1xyXG4gICAgICAgIG5wYyA9IG5wY3MuZmlsdGVyKChhKSA9PiBhLmlkID09PSBpZClcclxuICAgICAgICBpZiAobnBjLmxlbmd0aCA+IDApXHJcbiAgICAgICAgICAgIHJldHVybiBucGNbMF1cclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gbnBjXHJcbn1cclxuXHJcbnZhciB2ZWhpY2xlQnlJZCA9IGZ1bmN0aW9uIChpZCkge1xyXG4gICAgdmFyIHZlaGljbGUgPSBudWxsO1xyXG5cclxuICAgIGlmIChVdGlscy5pc051bWVyaWMoaWQpKSB7XHJcbiAgICAgICAgdmVoaWNsZSA9IHZlaGljbGVzLmZpbHRlcigoYSkgPT4gYS5pZCA9PT0gaWQpXHJcbiAgICAgICAgaWYgKHZlaGljbGUubGVuZ3RoID4gMClcclxuICAgICAgICAgICAgcmV0dXJuIHZlaGljbGVbMF1cclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gdmVoaWNsZVxyXG59XHJcblxyXG52YXIgYWRkTnBjID0gZnVuY3Rpb24gKG5wYykge1xyXG4gICAgbnBjcy5wdXNoKG5wYylcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMucHVsbCA9IChkYXRhLCBmcmVzaCkgPT4ge1xyXG4gICAgcGxheWVycy5sZW5ndGggPSAwXHJcbiAgICBucGNzLmxlbmd0aCA9IDBcclxuICAgIHZlaGljbGVzLmxlbmd0aCA9IDBcclxuXHJcbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IGRhdGEucGxheWVycy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICB2YXIgcCA9IG5ldyBQbGF5ZXIoKVxyXG4gICAgICAgIHAucGFyc2UoZGF0YS5wbGF5ZXJzW2ldKVxyXG4gICAgICAgIHBsYXllcnMucHVzaChwKVxyXG4gICAgfVxyXG5cclxuICAgIGZvciAodmFyIGkgPSAwLCBsID0gZGF0YS5ucGNzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xyXG4gICAgICAgIHZhciBuID0gbmV3IE5wYygpXHJcbiAgICAgICAgbi5wYXJzZShkYXRhLm5wY3NbaV0pXHJcbiAgICAgICAgbnBjcy5wdXNoKG4pXHJcbiAgICB9XHJcblxyXG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSBkYXRhLnZlaGljbGVzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xyXG4gICAgICAgIHZhciB2ID0gbmV3IFZlaGljbGUoKVxyXG4gICAgICAgIHYucGFyc2UoZGF0YS52ZWhpY2xlc1tpXSlcclxuICAgICAgICB2ZWhpY2xlcy5wdXNoKHYpXHJcbiAgICB9XHJcblxyXG4gICAgcHVzaCgpXHJcbn1cclxuXHJcbnZhciBwdXNoID0gKCkgPT4ge1xyXG4gICAgdmFyIG91dCA9IHtcclxuICAgICAgICBucGNzOiBbXSxcclxuICAgICAgICBwbGF5ZXJzOiBbXSxcclxuICAgICAgICB2ZWhpY2xlczogW11cclxuICAgIH1cclxuXHJcbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IG5wY3MubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XHJcbiAgICAgICAgb3V0Lm5wY3MucHVzaChucGNzW2ldLnNlcmlhbGl6ZSgpKVxyXG4gICAgfVxyXG5cclxuICAgIGZvciAodmFyIGkgPSAwLCBsID0gcGxheWVycy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICBvdXQucGxheWVycy5wdXNoKHBsYXllcnNbaV0uc2VyaWFsaXplKCkpXHJcbiAgICB9XHJcblxyXG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSB2ZWhpY2xlcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICBvdXQudmVoaWNsZXMucHVzaCh2ZWhpY2xlc1tpXS5zZXJpYWxpemUoKSlcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gb3V0XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzLnB1c2ggPSBwdXNoXHJcblxyXG5tb2R1bGUuZXhwb3J0cy5yZXNldCA9ICgpID0+IHsgfVxyXG5cclxubW9kdWxlLmV4cG9ydHMuY2hhcnNCeVN0YXRlID0gKGN1clN0YXRlLCBjYWxsYmFjaykgPT4ge1xyXG4gICAgaWYgKFV0aWxzLmlzRnVuY3Rpb24oY2FsbGJhY2spKSB7XHJcbiAgICAgICAgdmFyIG91dHB1dCA9IFtdXHJcblxyXG4gICAgICAgIGlmIChjdXJTdGF0ZSA9PT0gQ2hhcmFjdGVyU3RhdGUuSWRsZSkge1xyXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IHZlaGljbGVzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xyXG4gICAgICAgICAgICAgICAgb3V0cHV0LnB1c2godmVoaWNsZXNbaV0pXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gcGxheWVycy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICAgICAgaWYgKHBsYXllcnNbaV0uc3RhdGUgPT09IGN1clN0YXRlKVxyXG4gICAgICAgICAgICAgICAgb3V0cHV0LnB1c2gocGxheWVyc1tpXSlcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gbnBjcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICAgICAgaWYgKG5wY3NbaV0uc3RhdGUgPT09IGN1clN0YXRlKVxyXG4gICAgICAgICAgICAgICAgb3V0cHV0LnB1c2gobnBjc1tpXSlcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIGlmIGluIGFuIGVuY291bnRlciwgc29ydCBieSBpbml0aWF0aXZlIG9yZGVyXHJcbiAgICAgICAgaWYgKGN1clN0YXRlID09PSBDaGFyYWN0ZXJTdGF0ZS5FbmNvdW50ZXIpIHtcclxuICAgICAgICAgICAgb3V0cHV0LnNvcnQoZnVuY3Rpb24gKGEsIGIpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBiLmluaXRpYXRpdmUgLSBhLmluaXRpYXRpdmU7XHJcbiAgICAgICAgICAgIH0pXHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IG91dHB1dC5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICAgICAgY2FsbGJhY2suY2FsbChvdXRwdXRbaV0pXHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cy51cGRhdGVQbGF5ZXIgPSAoaWQsIGFjdGlvbiwgcGFyYW1zKSA9PiB7XHJcbiAgICB2YXIgcGxheWVyID0gcGxheWVyQnlJZChpZClcclxuICAgIGlmICghcGxheWVyKSByZXR1cm5cclxuXHJcbiAgICBzd2l0Y2ggKGFjdGlvbikge1xyXG4gICAgICAgIGNhc2UgQ2hhcmFjdGVyQWN0aW9uLkluaXRpYXRpdmU6XHJcbiAgICAgICAgICAgIHBsYXllci5hcHBseUluaXRpYXRpdmUocGFyYW1zWzBdKVxyXG4gICAgICAgICAgICBicmVha1xyXG4gICAgICAgIGNhc2UgQ2hhcmFjdGVyQWN0aW9uLkxlYXZlOlxyXG4gICAgICAgICAgICBwbGF5ZXIubGVhdmVFbmNvdW50ZXIoKVxyXG4gICAgICAgICAgICBicmVha1xyXG4gICAgICAgIGNhc2UgQ2hhcmFjdGVyQWN0aW9uLlJldml2ZTpcclxuICAgICAgICAgICAgcGxheWVyLnJldml2ZSgpXHJcbiAgICAgICAgICAgIGJyZWFrXHJcbiAgICAgICAgY2FzZSBDaGFyYWN0ZXJBY3Rpb24uRGllOlxyXG4gICAgICAgICAgICBwbGF5ZXIuZGllKClcclxuICAgICAgICAgICAgYnJlYWtcclxuICAgICAgICBjYXNlIENoYXJhY3RlckFjdGlvbi5TcGVsbDpcclxuICAgICAgICAgICAgcGxheWVyLnVzZVNwZWxsKHBhcmFtc1swXSwgcGFyYW1zWzFdKVxyXG4gICAgICAgICAgICBicmVha1xyXG4gICAgICAgIGNhc2UgQ2hhcmFjdGVyQWN0aW9uLlJlc3Q6XHJcbiAgICAgICAgICAgIHBsYXllci5hcHBseVJlc3QoKVxyXG4gICAgICAgICAgICBicmVha1xyXG4gICAgICAgIGNhc2UgQ2hhcmFjdGVyQWN0aW9uLlRvZ2dsZTpcclxuICAgICAgICAgICAgcGxheWVyLnRvZ2dsZSgpXHJcbiAgICAgICAgICAgIGJyZWFrXHJcbiAgICAgICAgY2FzZSBDaGFyYWN0ZXJBY3Rpb24uQXBwbHlDb25kaXRpb246XHJcbiAgICAgICAgICAgIHBsYXllci5jb25kaXRpb24ocGFyYW1zWzBdLCBwYXJhbXNbMV0pXHJcbiAgICAgICAgICAgIGJyZWFrXHJcbiAgICB9XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzLnVwZGF0ZU5wYyA9IChpZCwgYWN0aW9uLCBwYXJhbXMpID0+IHtcclxuICAgIHZhciBjdXJyZW50TnBjID0gbnBjQnlJZChpZClcclxuICAgIGlmICghY3VycmVudE5wYykgcmV0dXJuXHJcblxyXG4gICAgc3dpdGNoIChhY3Rpb24pIHtcclxuICAgICAgICBjYXNlIENoYXJhY3RlckFjdGlvbi5EYW1hZ2U6XHJcbiAgICAgICAgICAgIGN1cnJlbnROcGMuYXBwbHlEYW1hZ2UocGFyYW1zWzBdKVxyXG4gICAgICAgICAgICBicmVha1xyXG4gICAgICAgIGNhc2UgQ2hhcmFjdGVyQWN0aW9uLkluaXRpYXRpdmU6XHJcbiAgICAgICAgICAgIGlmIChjdXJyZW50TnBjLnRlbXBsYXRlKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgbiA9IGN1cnJlbnROcGMuY2xvbmUoKVxyXG4gICAgICAgICAgICAgICAgYWRkTnBjKG4pXHJcbiAgICAgICAgICAgICAgICBjdXJyZW50TnBjID0gblxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGN1cnJlbnROcGMucm9sbEluaXRpYXRpdmUoKVxyXG4gICAgICAgICAgICBicmVha1xyXG4gICAgICAgIGNhc2UgQ2hhcmFjdGVyQWN0aW9uLkxlYXZlOlxyXG4gICAgICAgICAgICBjdXJyZW50TnBjLmxlYXZlRW5jb3VudGVyKClcclxuICAgICAgICAgICAgYnJlYWtcclxuICAgICAgICBjYXNlIENoYXJhY3RlckFjdGlvbi5SZXZpdmU6XHJcbiAgICAgICAgICAgIGN1cnJlbnROcGMucmV2aXZlKClcclxuICAgICAgICAgICAgYnJlYWtcclxuICAgICAgICBjYXNlIENoYXJhY3RlckFjdGlvbi5EaWU6XHJcbiAgICAgICAgICAgIGN1cnJlbnROcGMuZGllKClcclxuICAgICAgICAgICAgYnJlYWtcclxuICAgICAgICBjYXNlIENoYXJhY3RlckFjdGlvbi5TcGVsbDpcclxuICAgICAgICAgICAgY3VycmVudE5wYy51c2VTcGVsbChwYXJhbXNbMF0sIHBhcmFtc1sxXSlcclxuICAgICAgICAgICAgYnJlYWtcclxuICAgICAgICBjYXNlIENoYXJhY3RlckFjdGlvbi5SZXN0OlxyXG4gICAgICAgICAgICBjdXJyZW50TnBjLmFwcGx5UmVzdCgpXHJcbiAgICAgICAgICAgIGJyZWFrXHJcbiAgICAgICAgY2FzZSBDaGFyYWN0ZXJBY3Rpb24uVG9nZ2xlOlxyXG4gICAgICAgICAgICBjdXJyZW50TnBjLnRvZ2dsZSgpXHJcbiAgICAgICAgICAgIGJyZWFrXHJcbiAgICAgICAgY2FzZSBDaGFyYWN0ZXJBY3Rpb24uQXBwbHlDb25kaXRpb246XHJcbiAgICAgICAgICAgIGN1cnJlbnROcGMuY29uZGl0aW9uKHBhcmFtc1swXSwgcGFyYW1zWzFdKVxyXG4gICAgICAgICAgICBicmVha1xyXG4gICAgfVxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cy51cGRhdGVWZWhpY2xlID0gKGlkLCBhY3Rpb24sIHBhcmFtcykgPT4ge1xyXG4gICAgdmFyIHZlaGljbGUgPSB2ZWhpY2xlQnlJZChpZClcclxuICAgIGlmICghdmVoaWNsZSkgcmV0dXJuXHJcblxyXG4gICAgc3dpdGNoIChhY3Rpb24pIHtcclxuICAgICAgICBjYXNlIENoYXJhY3RlckFjdGlvbi5EYW1hZ2U6XHJcbiAgICAgICAgICAgIHZlaGljbGUuYXBwbHlEYW1hZ2UocGFyYW1zWzBdLCBwYXJhbXNbMV0pXHJcbiAgICAgICAgICAgIGJyZWFrXHJcbiAgICAgICAgY2FzZSBDaGFyYWN0ZXJBY3Rpb24uVG9nZ2xlOlxyXG4gICAgICAgICAgICB2ZWhpY2xlLnRvZ2dsZSgpXHJcbiAgICAgICAgICAgIGJyZWFrXHJcbiAgICB9XHJcbn0iLCLvu78ndXNlIHN0cmljdCdcclxuXHJcbmNvbnN0IGF4aW9zID0gcmVxdWlyZSgnYXhpb3MnKVxyXG5jb25zdCBzdG9yYWdlS2V5ID0gJ09zc2FyaWFTZXNzaW9uVHdlbnR5VGhyZWUnXHJcblxyXG52YXIgc2F2ZSA9IChkYXRhKSA9PiBsb2NhbFN0b3JhZ2Uuc2V0SXRlbShzdG9yYWdlS2V5LCBkYXRhKVxyXG5cclxudmFyIGxhc3RVc2VkSWQgPSAwXHJcblxyXG52YXIgZmV0Y2hKc29uID0gKCkgPT4ge1xyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgICAgICBheGlvcy5nZXQoZ2xvYmFsLkRhdGFGaWxlKVxyXG4gICAgICAgICAgICAudGhlbihmdW5jdGlvbiAocmVzcG9uc2UpIHtcclxuICAgICAgICAgICAgICAgIHNhdmUoSlNPTi5zdHJpbmdpZnkocmVzcG9uc2UuZGF0YSkpXHJcbiAgICAgICAgICAgICAgICByZXNvbHZlKFtyZXNwb25zZS5kYXRhXSlcclxuICAgICAgICAgICAgfSlcclxuICAgICAgICAgICAgLmNhdGNoKGZ1bmN0aW9uIChlcnJvcikge1xyXG4gICAgICAgICAgICAgICAgcmVqZWN0KGVycm9yKVxyXG4gICAgICAgICAgICB9KVxyXG4gICAgfSlcclxufVxyXG5cclxudmFyIHB1bGxJbm5lciA9IChyYXcpID0+IHtcclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgcmVzb2x2ZShbSlNPTi5wYXJzZShyYXcpXSlcclxuICAgICAgICB9IGNhdGNoIChlcnIpIHtcclxuICAgICAgICAgICAgcmVqZWN0KGVycilcclxuICAgICAgICB9XHJcbiAgICB9KVxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cy5wdWxsID0gKCkgPT4ge1xyXG4gICAgdmFyIGZyb21TdG9yYWdlID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oc3RvcmFnZUtleSk7XHJcbiAgICByZXR1cm4gZnJvbVN0b3JhZ2UgP1xyXG4gICAgICAgIHB1bGxJbm5lcihmcm9tU3RvcmFnZSkgOlxyXG4gICAgICAgIGZldGNoSnNvbigpXHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzLnB1c2ggPSAoZGF0YSkgPT4ge1xyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBzYXZlKEpTT04uc3RyaW5naWZ5KGRhdGEpKVxyXG4gICAgICAgICAgICByZXNvbHZlKClcclxuICAgICAgICB9IGNhdGNoIChlcnIpIHtcclxuICAgICAgICAgICAgcmVqZWN0KGVycilcclxuICAgICAgICB9XHJcbiAgICB9KVxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cy5yZXNldCA9ICgpID0+IHtcclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgbG9jYWxTdG9yYWdlLnJlbW92ZUl0ZW0oc3RvcmFnZUtleSlcclxuICAgICAgICAgICAgcmVzb2x2ZSgpXHJcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgICAgICAgIHJlamVjdChlcnIpXHJcbiAgICAgICAgfVxyXG4gICAgfSlcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMuYXNzaWduSWQgPSAoKSA9PiB7XHJcbiAgICBsYXN0VXNlZElkKytcclxuICAgIHJldHVybiBsYXN0VXNlZElkXHJcbn1cclxuIiwi77u/J3VzZSBzdHJpY3QnXHJcblxyXG52YXIgRW50aXRpZXMgPSByZXF1aXJlKCcuL2VudGl0aWVzLmpzJylcclxudmFyIFN0b3JhZ2UgPSByZXF1aXJlKCcuL3N0b3JhZ2UuanMnKVxyXG5cclxudmFyIGFjdGl2ZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhY3RpdmUnKVxyXG52YXIgaW5hY3RpdmUgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnaW5hY3RpdmUnKVxyXG52YXIgZGVhZGd1eXMgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZGVhZGd1eXMnKVxyXG5cclxudmFyIHVwZGF0ZSA9IGZ1bmN0aW9uICgpIHtcclxuICAgIFN0b3JhZ2UucHVzaChFbnRpdGllcy5wdXNoKCkpLnRoZW4oKCkgPT4ge1xyXG4gICAgICAgIHJlbmRlcigpXHJcbiAgICB9KVxyXG59XHJcblxyXG52YXIgcmVuZGVyID0gZnVuY3Rpb24gKCkge1xyXG4gICAgYWN0aXZlLmlubmVySFRNTCA9ICcnXHJcbiAgICBpbmFjdGl2ZS5pbm5lckhUTUwgPSAnJ1xyXG4gICAgZGVhZGd1eXMuaW5uZXJIVE1MID0gJydcclxuXHJcbiAgICBFbnRpdGllcy5jaGFyc0J5U3RhdGUoQ2hhcmFjdGVyU3RhdGUuRW5jb3VudGVyLCBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdmFyIHJvdyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3RyJylcclxuICAgICAgICB2YXIgY2VsbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3RkJylcclxuXHJcbiAgICAgICAgY2VsbC5pbm5lckhUTUwgPSB0aGlzLnJlbmRlcigpXHJcblxyXG4gICAgICAgIHJvdy5hcHBlbmRDaGlsZChjZWxsKVxyXG4gICAgICAgIGFjdGl2ZS5hcHBlbmRDaGlsZChyb3cpXHJcbiAgICB9KVxyXG5cclxuICAgIEVudGl0aWVzLmNoYXJzQnlTdGF0ZShDaGFyYWN0ZXJTdGF0ZS5JZGxlLCBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdmFyIHJvdyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3RyJylcclxuICAgICAgICB2YXIgY2VsbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3RkJylcclxuXHJcbiAgICAgICAgY2VsbC5pbm5lckhUTUwgPSB0aGlzLnJlbmRlcigpXHJcblxyXG4gICAgICAgIHJvdy5hcHBlbmRDaGlsZChjZWxsKVxyXG4gICAgICAgIGluYWN0aXZlLmFwcGVuZENoaWxkKHJvdylcclxuICAgIH0pXHJcblxyXG4gICAgRW50aXRpZXMuY2hhcnNCeVN0YXRlKENoYXJhY3RlclN0YXRlLkRlYWQsIGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB2YXIgcm93ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgndHInKVxyXG4gICAgICAgIHZhciBjZWxsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgndGQnKVxyXG5cclxuICAgICAgICBjZWxsLmlubmVySFRNTCA9IHRoaXMucmVuZGVyKClcclxuXHJcbiAgICAgICAgcm93LmFwcGVuZENoaWxkKGNlbGwpXHJcbiAgICAgICAgZGVhZGd1eXMuYXBwZW5kQ2hpbGQocm93KVxyXG4gICAgfSlcclxufVxyXG5cclxudmFyIGFkZExpc3RlbmVyID0gZnVuY3Rpb24gKCkge1xyXG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBmdW5jdGlvbiAoZSkge1xyXG4gICAgICAgIGlmIChlLnRhcmdldCkge1xyXG4gICAgICAgICAgICB2YXIgZG9VcGRhdGUgPSB0cnVlO1xyXG4gICAgICAgICAgICB2YXIgaWQgPSBwYXJzZUludChlLnRhcmdldC5nZXRBdHRyaWJ1dGUoJ2RhdGEtaWQnKSlcclxuXHJcbiAgICAgICAgICAgIHN3aXRjaCAoZS50YXJnZXQuY2xhc3NOYW1lKSB7XHJcbiAgICAgICAgICAgICAgICBjYXNlICdoYXJkX3Jlc2V0JzpcclxuICAgICAgICAgICAgICAgICAgICBkb1VwZGF0ZSA9IGZhbHNlXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNvbmZpcm0oJ0FyZSB5b3Ugc3VyZT8gVGhpcyBjYW5ub3QgYmUgdW5kb25lLicpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBjZWxsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ21haW4tY29udGVudCcpXHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICBTdG9yYWdlLnJlc2V0KCkudGhlbigoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBFbnRpdGllcy5yZXNldCgpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjZWxsLmlubmVySFRNTCA9ICdyZXNldHRpbmcgdXAgaW4gaGVyZSdcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4gd2luZG93LmxvY2F0aW9uLnJlbG9hZCgpLCA2MDApXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrXHJcbiAgICAgICAgICAgICAgICBjYXNlICdwbGF5ZXJfaW5pdGlhdGl2ZSc6XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGluaXRpYXRpdmUgPSBwYXJzZUludChkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGxheWVyX2luaXRpYXRpdmVfJyArIGlkKS52YWx1ZSlcclxuICAgICAgICAgICAgICAgICAgICBpZiAoVXRpbHMuaXNJbnRlZ2VyKGluaXRpYXRpdmUpKSBFbnRpdGllcy51cGRhdGVQbGF5ZXIoaWQsIENoYXJhY3RlckFjdGlvbi5Jbml0aWF0aXZlLCBbaW5pdGlhdGl2ZV0pXHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWtcclxuICAgICAgICAgICAgICAgIGNhc2UgJ3BsYXllcl9sZWF2ZSc6XHJcbiAgICAgICAgICAgICAgICAgICAgRW50aXRpZXMudXBkYXRlUGxheWVyKGlkLCBDaGFyYWN0ZXJBY3Rpb24uTGVhdmUpXHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICBjYXNlICdwbGF5ZXJfcmV2aXZlJzpcclxuICAgICAgICAgICAgICAgICAgICBFbnRpdGllcy51cGRhdGVQbGF5ZXIoaWQsIENoYXJhY3RlckFjdGlvbi5SZXZpdmUpXHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWtcclxuICAgICAgICAgICAgICAgIGNhc2UgJ3BsYXllcl9kaWUnOlxyXG4gICAgICAgICAgICAgICAgICAgIEVudGl0aWVzLnVwZGF0ZVBsYXllcihpZCwgQ2hhcmFjdGVyQWN0aW9uLkRpZSlcclxuICAgICAgICAgICAgICAgICAgICBicmVha1xyXG4gICAgICAgICAgICAgICAgY2FzZSAncGxheWVyX2NvbmNlbnRyYXRlJzpcclxuICAgICAgICAgICAgICAgICAgICBFbnRpdGllcy51cGRhdGVQbGF5ZXIoaWQsIENoYXJhY3RlckFjdGlvbi5Db25jZW50cmF0ZSlcclxuICAgICAgICAgICAgICAgICAgICBicmVha1xyXG4gICAgICAgICAgICAgICAgY2FzZSAncGxheWVyX3RvZ2dsZSc6XHJcbiAgICAgICAgICAgICAgICAgICAgRW50aXRpZXMudXBkYXRlUGxheWVyKGlkLCBDaGFyYWN0ZXJBY3Rpb24uVG9nZ2xlKVxyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrXHJcbiAgICAgICAgICAgICAgICBjYXNlICdwbGF5ZXJfY29uZGl0aW9uX3JlbW92ZSc6XHJcbiAgICAgICAgICAgICAgICAgICAgRW50aXRpZXMudXBkYXRlUGxheWVyKGlkLCBDaGFyYWN0ZXJBY3Rpb24uQXBwbHlDb25kaXRpb24sIFtlLnRhcmdldC5nZXRBdHRyaWJ1dGUoJ2RhdGEtY29uZGl0aW9uJyksIGZhbHNlXSlcclxuICAgICAgICAgICAgICAgICAgICBicmVha1xyXG4gICAgICAgICAgICAgICAgY2FzZSAnbnBjX2luaXRpYXRpdmUnOlxyXG4gICAgICAgICAgICAgICAgICAgIEVudGl0aWVzLnVwZGF0ZU5wYyhpZCwgQ2hhcmFjdGVyQWN0aW9uLkluaXRpYXRpdmUpXHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWtcclxuICAgICAgICAgICAgICAgIGNhc2UgJ25wY19kYW1hZ2UnOlxyXG4gICAgICAgICAgICAgICAgICAgIHZhciBkYW1hZ2UgPSBwYXJzZUludChkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbnBjX2RhbWFnZV8nICsgaWQpLnZhbHVlKVxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChVdGlscy5pc0ludGVnZXIoZGFtYWdlKSkgRW50aXRpZXMudXBkYXRlTnBjKGlkLCBDaGFyYWN0ZXJBY3Rpb24uRGFtYWdlLCBbZGFtYWdlXSlcclxuICAgICAgICAgICAgICAgICAgICBicmVha1xyXG4gICAgICAgICAgICAgICAgY2FzZSAnbnBjX2xlYXZlJzpcclxuICAgICAgICAgICAgICAgICAgICBFbnRpdGllcy51cGRhdGVOcGMoaWQsIENoYXJhY3RlckFjdGlvbi5MZWF2ZSlcclxuICAgICAgICAgICAgICAgICAgICBicmVha1xyXG4gICAgICAgICAgICAgICAgY2FzZSAnbnBjX3Jldml2ZSc6XHJcbiAgICAgICAgICAgICAgICAgICAgRW50aXRpZXMudXBkYXRlTnBjKGlkLCBDaGFyYWN0ZXJBY3Rpb24uUmV2aXZlKVxyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrXHJcbiAgICAgICAgICAgICAgICBjYXNlICducGNfZGllJzpcclxuICAgICAgICAgICAgICAgICAgICBFbnRpdGllcy51cGRhdGVOcGMoaWQsIENoYXJhY3RlckFjdGlvbi5EaWUpXHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWtcclxuICAgICAgICAgICAgICAgIGNhc2UgJ25wY19yZXN0JzpcclxuICAgICAgICAgICAgICAgICAgICBFbnRpdGllcy51cGRhdGVOcGMoaWQsIENoYXJhY3RlckFjdGlvbi5SZXN0KVxyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrXHJcbiAgICAgICAgICAgICAgICBjYXNlICducGNfc3BlbGxfc2xvdCc6XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHNwZWxsU2xvdElkID0gcGFyc2VJbnQoZS50YXJnZXQuZ2V0QXR0cmlidXRlKCdkYXRhLWxldmVsLWlkJykpXHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGNoZWNrZWQgPSBlLnRhcmdldC5jaGVja2VkXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKFV0aWxzLmlzSW50ZWdlcihzcGVsbFNsb3RJZCkpIEVudGl0aWVzLnVwZGF0ZU5wYyhpZCwgQ2hhcmFjdGVyQWN0aW9uLlNwZWxsLCBbc3BlbGxTbG90SWQsIGNoZWNrZWRdKVxyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrXHJcbiAgICAgICAgICAgICAgICBjYXNlICducGNfY29uY2VudHJhdGUnOlxyXG4gICAgICAgICAgICAgICAgICAgIEVudGl0aWVzLnVwZGF0ZU5wYyhpZCwgQ2hhcmFjdGVyQWN0aW9uLkNvbmNlbnRyYXRlKVxyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrXHJcbiAgICAgICAgICAgICAgICBjYXNlICducGNfdG9nZ2xlJzpcclxuICAgICAgICAgICAgICAgICAgICBFbnRpdGllcy51cGRhdGVOcGMoaWQsIENoYXJhY3RlckFjdGlvbi5Ub2dnbGUpXHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWtcclxuICAgICAgICAgICAgICAgIGNhc2UgJ25wY19jb25kaXRpb25fcmVtb3ZlJzpcclxuICAgICAgICAgICAgICAgICAgICBFbnRpdGllcy51cGRhdGVOcGMoaWQsIENoYXJhY3RlckFjdGlvbi5BcHBseUNvbmRpdGlvbiwgW2UudGFyZ2V0LmdldEF0dHJpYnV0ZSgnZGF0YS1jb25kaXRpb24nKSwgZmFsc2VdKVxyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrXHJcbiAgICAgICAgICAgICAgICBjYXNlICd2ZWhpY2xlX3RvZ2dsZSc6XHJcbiAgICAgICAgICAgICAgICAgICAgRW50aXRpZXMudXBkYXRlVmVoaWNsZShpZCwgQ2hhcmFjdGVyQWN0aW9uLlRvZ2dsZSlcclxuICAgICAgICAgICAgICAgICAgICBicmVha1xyXG4gICAgICAgICAgICAgICAgY2FzZSAnY29tcG9uZW50X2RhbWFnZSc6XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHZlaGljbGVJZCA9IHBhcnNlSW50KGUudGFyZ2V0LmdldEF0dHJpYnV0ZSgnZGF0YS12ZWhpY2xlLWlkJykpXHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGRhbWFnZSA9IHBhcnNlSW50KGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjb21wb25lbnRfZGFtYWdlXycgKyBpZCkudmFsdWUpXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKFV0aWxzLmlzSW50ZWdlcihkYW1hZ2UpKSBFbnRpdGllcy51cGRhdGVWZWhpY2xlKHZlaGljbGVJZCwgQ2hhcmFjdGVyQWN0aW9uLkRhbWFnZSwgW2lkLCBkYW1hZ2VdKVxyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrXHJcbiAgICAgICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgICAgIGRvVXBkYXRlID0gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgaWYgKGRvVXBkYXRlKSB1cGRhdGUoKVxyXG4gICAgICAgIH1cclxuICAgIH0pXHJcblxyXG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgZnVuY3Rpb24gKGUpIHtcclxuICAgICAgICBpZiAoZS50YXJnZXQpIHtcclxuICAgICAgICAgICAgdmFyIGRvVXBkYXRlID0gdHJ1ZTtcclxuICAgICAgICAgICAgdmFyIGlkID0gcGFyc2VJbnQoZS50YXJnZXQuZ2V0QXR0cmlidXRlKCdkYXRhLWlkJykpXHJcblxyXG4gICAgICAgICAgICBzd2l0Y2ggKGUudGFyZ2V0LmNsYXNzTmFtZSkge1xyXG4gICAgICAgICAgICAgICAgY2FzZSAncGxheWVyX2NvbmRpdGlvbl9hZGQnOlxyXG4gICAgICAgICAgICAgICAgICAgIEVudGl0aWVzLnVwZGF0ZVBsYXllcihpZCwgQ2hhcmFjdGVyQWN0aW9uLkFwcGx5Q29uZGl0aW9uLCBbZS50YXJnZXQub3B0aW9uc1tlLnRhcmdldC5zZWxlY3RlZEluZGV4XS52YWx1ZSwgdHJ1ZV0pXHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWtcclxuICAgICAgICAgICAgICAgIGNhc2UgJ25wY19jb25kaXRpb25fYWRkJzpcclxuICAgICAgICAgICAgICAgICAgICBFbnRpdGllcy51cGRhdGVOcGMoaWQsIENoYXJhY3RlckFjdGlvbi5BcHBseUNvbmRpdGlvbiwgW2UudGFyZ2V0Lm9wdGlvbnNbZS50YXJnZXQuc2VsZWN0ZWRJbmRleF0udmFsdWUsIHRydWVdKVxyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrXHJcbiAgICAgICAgICAgICAgICBjYXNlICdwbGF5ZXJfZXhoYXVzdGlvbic6XHJcbiAgICAgICAgICAgICAgICAgICAgRW50aXRpZXMudXBkYXRlUGxheWVyKGlkLCBDaGFyYWN0ZXJBY3Rpb24uQXBwbHlDb25kaXRpb24sIFtDaGFyYWN0ZXJDb25kaXRpb24uRXhoYXVzdGlvbiwgcGFyc2VJbnQoZS50YXJnZXQub3B0aW9uc1tlLnRhcmdldC5zZWxlY3RlZEluZGV4XS52YWx1ZSldKVxyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrXHJcbiAgICAgICAgICAgICAgICBjYXNlICducGNfZXhoYXVzdGlvbic6XHJcbiAgICAgICAgICAgICAgICAgICAgRW50aXRpZXMudXBkYXRlTnBjKGlkLCBDaGFyYWN0ZXJBY3Rpb24uQXBwbHlDb25kaXRpb24sIFtDaGFyYWN0ZXJDb25kaXRpb24uRXhoYXVzdGlvbiwgcGFyc2VJbnQoZS50YXJnZXQub3B0aW9uc1tlLnRhcmdldC5zZWxlY3RlZEluZGV4XS52YWx1ZSldKVxyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrXHJcbiAgICAgICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgICAgIGRvVXBkYXRlID0gZmFsc2VcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgaWYgKGRvVXBkYXRlKSB1cGRhdGUoKVxyXG4gICAgICAgIH1cclxuICAgIH0pXHJcbn1cclxuXHJcbnZhciBydW4gPSBmdW5jdGlvbiAoKSB7XHJcbiAgICBhZGRMaXN0ZW5lcigpXHJcblxyXG4gICAgU3RvcmFnZS5wdWxsKCkudGhlbigoW2RhdGFdKSA9PiB7XHJcbiAgICAgICAgRW50aXRpZXMucHVsbChkYXRhKVxyXG4gICAgICAgIHJlbmRlcigpXHJcbiAgICB9KVxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHtcclxuICAgIHJ1bjogcnVuXHJcbn0iLCLvu78ndXNlIHN0cmljdCdcclxuXHJcbnZhciBTdG9yYWdlID0gcmVxdWlyZSgnLi4vYXBwL3N0b3JhZ2UuanMnKVxyXG5cclxudmFyIGNvbXBvbmVudCA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHRoaXMuaWQgPSAwXHJcbiAgICB0aGlzLnZlaGljbGVJZCA9IDBcclxuICAgIHRoaXMubmFtZSA9IFwiXCJcclxuICAgIHRoaXMuaGVhbHRoID0gMFxyXG4gICAgdGhpcy5tYXhIZWFsdGggPSAwXHJcbiAgICB0aGlzLmFybW9yID0gMFxyXG4gICAgdGhpcy5zcGVlZCA9IDBcclxuICAgIHRoaXMuZGVjcmVtZW50ID0gMFxyXG4gICAgdGhpcy5zdGFnZXMgPSAwXHJcbiAgICB0aGlzLnRocmVzaG9sZCA9IDBcclxuICAgIHRoaXMuYXR0YWNrVG9IaXQgPSAwXHJcbiAgICB0aGlzLmF0dGFja1JvbGwgPSBcIjFkNlwiXHJcbiAgICB0aGlzLmF0dGFja1JhbmdlID0gXCIxMjAvMzIwXCJcclxuICAgIHRoaXMuYXR0YWNrRGFtYWdlID0gXCJwaWVyY2luZ1wiXHJcbiAgICB0aGlzLnZpc2libGUgPSB0cnVlXHJcbn1cclxuXHJcbmNvbXBvbmVudC5wcm90b3R5cGUucGFyc2UgPSBmdW5jdGlvbiAoanNvbikge1xyXG4gICAgaWYgKCFqc29uKSByZXR1cm5cclxuXHJcbiAgICBpZiAoanNvbi5pZCAmJiBVdGlscy5pc051bWVyaWMoanNvbi5pZCkpIHtcclxuICAgICAgICB0aGlzLmlkID0ganNvbi5pZFxyXG4gICAgfVxyXG5cclxuICAgIGlmICh0aGlzLmlkID09PSAwKSB7XHJcbiAgICAgICAgdGhpcy5pZCA9IFN0b3JhZ2UuYXNzaWduSWQoKVxyXG4gICAgfVxyXG5cclxuICAgIGlmIChqc29uLnZlaGljbGVJZCAmJiBVdGlscy5pc051bWVyaWMoanNvbi52ZWhpY2xlSWQpKSB7XHJcbiAgICAgICAgdGhpcy52ZWhpY2xlSWQgPSBqc29uLnZlaGljbGVJZFxyXG4gICAgfVxyXG5cclxuICAgIGlmIChqc29uLm5hbWUpIHtcclxuICAgICAgICB0aGlzLm5hbWUgPSBqc29uLm5hbWVcclxuICAgIH1cclxuXHJcbiAgICBpZiAoanNvbi5oZWFsdGggJiYgVXRpbHMuaXNOdW1lcmljKGpzb24uaGVhbHRoKSkge1xyXG4gICAgICAgIHRoaXMuaGVhbHRoID0ganNvbi5oZWFsdGhcclxuICAgIH1cclxuXHJcbiAgICBpZiAoanNvbi5tYXhIZWFsdGggJiYgVXRpbHMuaXNOdW1lcmljKGpzb24ubWF4SGVhbHRoKSkge1xyXG4gICAgICAgIHRoaXMubWF4SGVhbHRoID0ganNvbi5tYXhIZWFsdGhcclxuICAgIH1cclxuXHJcbiAgICBpZiAoanNvbi5hcm1vciAmJiBVdGlscy5pc051bWVyaWMoanNvbi5hcm1vcikpIHtcclxuICAgICAgICB0aGlzLmFybW9yID0ganNvbi5hcm1vclxyXG4gICAgfVxyXG5cclxuICAgIGlmIChqc29uLnNwZWVkICYmIFV0aWxzLmlzTnVtZXJpYyhqc29uLnNwZWVkKSkge1xyXG4gICAgICAgIHRoaXMuc3BlZWQgPSBqc29uLnNwZWVkXHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGpzb24uZGVjcmVtZW50ICYmIFV0aWxzLmlzTnVtZXJpYyhqc29uLmRlY3JlbWVudCkpIHtcclxuICAgICAgICB0aGlzLmRlY3JlbWVudCA9IGpzb24uZGVjcmVtZW50XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGpzb24uc3RhZ2VzICYmIFV0aWxzLmlzTnVtZXJpYyhqc29uLnN0YWdlcykpIHtcclxuICAgICAgICB0aGlzLnN0YWdlcyA9IGpzb24uc3RhZ2VzXHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGpzb24udGhyZXNob2xkICYmIFV0aWxzLmlzTnVtZXJpYyhqc29uLnRocmVzaG9sZCkpIHtcclxuICAgICAgICB0aGlzLnRocmVzaG9sZCA9IGpzb24udGhyZXNob2xkXHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGpzb24uYXR0YWNrVG9IaXQgJiYgVXRpbHMuaXNOdW1lcmljKGpzb24uYXR0YWNrVG9IaXQpKSB7XHJcbiAgICAgICAgdGhpcy5hdHRhY2tUb0hpdCA9IGpzb24uYXR0YWNrVG9IaXRcclxuICAgIH1cclxuXHJcbiAgICBpZiAoanNvbi5hdHRhY2tSb2xsKSB7XHJcbiAgICAgICAgdGhpcy5hdHRhY2tSb2xsID0ganNvbi5hdHRhY2tSb2xsXHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGpzb24uYXR0YWNrUmFuZ2UpIHtcclxuICAgICAgICB0aGlzLmF0dGFja1JvbGwgPSBqc29uLmF0dGFja1JvbGxcclxuICAgIH1cclxuXHJcbiAgICBpZiAoanNvbi5hdHRhY2tEYW1hZ2UpIHtcclxuICAgICAgICB0aGlzLmF0dGFja0RhbWFnZSA9IGpzb24uYXR0YWNrRGFtYWdlXHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGpzb24udmlzaWJsZSkge1xyXG4gICAgICAgIHRoaXMudmlzaWJsZSA9IGpzb24udmlzaWJsZVxyXG4gICAgfVxyXG59XHJcblxyXG5jb21wb25lbnQucHJvdG90eXBlLnNlcmlhbGl6ZSA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgaWQ6IHRoaXMuaWQsXHJcbiAgICAgICAgdmVoaWNsZUlkOiB0aGlzLnZlaGljbGVJZCxcclxuICAgICAgICBuYW1lOiB0aGlzLm5hbWUsXHJcbiAgICAgICAgaGVhbHRoOiB0aGlzLmhlYWx0aCxcclxuICAgICAgICBtYXhIZWFsdGg6IHRoaXMubWF4SGVhbHRoLFxyXG4gICAgICAgIGFybW9yOiB0aGlzLmFybW9yLFxyXG4gICAgICAgIHNwZWVkOiB0aGlzLnNwZWVkLFxyXG4gICAgICAgIGRlY3JlbWVudDogdGhpcy5kZWNyZW1lbnQsXHJcbiAgICAgICAgc3RhZ2VzOiB0aGlzLnN0YWdlcyxcclxuICAgICAgICB0aHJlc2hvbGQ6IHRoaXMudGhyZXNob2xkLFxyXG4gICAgICAgIGF0dGFja1RvSGl0OiB0aGlzLmF0dGFja1RvSGl0LFxyXG4gICAgICAgIGF0dGFja1JvbGw6IHRoaXMuYXR0YWNrUm9sbCxcclxuICAgICAgICBhdHRhY2tSYW5nZTogdGhpcy5hdHRhY2tSYW5nZSxcclxuICAgICAgICBhdHRhY2tEYW1hZ2U6IHRoaXMuYXR0YWNrRGFtYWdlLFxyXG4gICAgICAgIHZpc2libGU6IHRoaXMudmlzaWJsZVxyXG4gICAgfVxyXG59XHJcblxyXG5jb21wb25lbnQucHJvdG90eXBlLnJlbmRlciA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHZhciBvdXQgPSAnPGRpdiBjbGFzcz1cImNvbXBvbmVudFwiIGRhdGEtaWQ9XCInICsgdGhpcy5pZCArICdcIj4nXHJcbiAgICBvdXQgKz0gJzxkaXYgY2xhc3M9XCJib2xkXCI+JyArIHRoaXMubmFtZSArICc8L2Rpdj4nXHJcblxyXG4gICAgaWYgKHRoaXMuc3BlZWQgPiAwKSB7XHJcbiAgICAgICAgb3V0ICs9ICc8ZGl2PjxzcGFuIGNsYXNzPVwiYm9sZFwiPlNwZWVkOjwvc3Bhbj4gJyArIHRoaXMuY2FsY3VsYXRlU3BlZWQoKSArICc8L2Rpdj4nXHJcbiAgICB9XHJcblxyXG4gICAgb3V0ICs9ICc8ZGl2PkhlYWx0aDogPHNwYW4gY2xhc3M9XCJib2xkXCI+JyArIHRoaXMuaGVhbHRoICsgJzwvc3Bhbj4sIEFDOiA8c3BhbiBjbGFzcz1cImJvbGRcIj4nICsgdGhpcy5hcm1vciArICc8L3NwYW4+PC9kaXY+J1xyXG4gICAgb3V0ICs9ICc8ZGl2PjxpbnB1dCB0eXBlPVwiYnV0dG9uXCIgY2xhc3M9XCJjb21wb25lbnRfZGFtYWdlXCIgdmFsdWU9XCJBcHBseSBEYW1hZ2VcIiBkYXRhLWlkPVwiJyArIHRoaXMuaWQgKyAnXCIgZGF0YS12ZWhpY2xlLWlkPVwiJyArIHRoaXMudmVoaWNsZUlkICsgJ1wiIC8+PGlucHV0IHR5cGU9XCJ0ZXh0XCIgaWQ9XCJjb21wb25lbnRfZGFtYWdlXycgKyB0aGlzLmlkICsgJ1wiIC8+PC9kaXY+J1xyXG5cclxuICAgIGlmICh0aGlzLmF0dGFja1RvSGl0ID4gMCkge1xyXG4gICAgICAgIG91dCArPSAnPGRpdiBjbGFzcz1cImNvbXBvbmVudC1hdHRhY2tcIj48ZGl2IGNsYXNzPVwiYm9sZFwiPlJhbmdlZCBXZWFwb24gQXR0YWNrPC9kaXY+J1xyXG4gICAgICAgIG91dCArPSAnPGRpdj4xZDIwICsgJyArIHRoaXMuYXR0YWNrVG9IaXQgKyAnIHRvIGhpdCwgJyArIHRoaXMuYXR0YWNrUm9sbCArICc8L2Rpdj4nXHJcbiAgICAgICAgb3V0ICs9ICc8ZGl2IGNsYXNzPVwiaXRhbGljXCI+JyArIHRoaXMuYXR0YWNrRGFtYWdlICsgJzwvZGl2PjwvZGl2PidcclxuICAgIH1cclxuXHJcbiAgICBvdXQgKz0gJzwvZGl2PidcclxuICAgIHJldHVybiBvdXRcclxufVxyXG5cclxuY29tcG9uZW50LnByb3RvdHlwZS5jYWxjdWxhdGVTcGVlZCA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHZhciBzbG93ZG93biA9IDBcclxuXHJcbiAgICBpZiAodGhpcy5zdGFnZXMgPiAwICYmIHRoaXMuaGVhbHRoIDwgdGhpcy5tYXhIZWFsdGgpIHtcclxuICAgICAgICBpZiAodGhpcy5oZWFsdGggPiAwKSB7XHJcbiAgICAgICAgICAgIHZhciBwb3J0aW9uID0gTWF0aC5mbG9vcih0aGlzLm1heEhlYWx0aCAvIHRoaXMuc3RhZ2VzKVxyXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gdGhpcy5zdGFnZXM7IGkgPiAwOyBpLS0pIHtcclxuICAgICAgICAgICAgICAgIGlmIChwb3J0aW9uICogaSA+PSB0aGlzLmhlYWx0aCkgc2xvd2Rvd24gKz0gdGhpcy5kZWNyZW1lbnRcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHNsb3dkb3duID0gdGhpcy5zcGVlZFxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gVXRpbHMuY2xhbXAodGhpcy5zcGVlZCAtIHNsb3dkb3duLCAwLCB0aGlzLnNwZWVkKVxyXG59XHJcblxyXG5jb21wb25lbnQucHJvdG90eXBlLmFwcGx5RGFtYWdlID0gZnVuY3Rpb24gKGRhbWFnZSkge1xyXG4gICAgaWYgKHRoaXMudGhyZXNob2xkID4gMCkge1xyXG4gICAgICAgIGlmIChNYXRoLmFicyhkYW1hZ2UpID49IHRoaXMudGhyZXNob2xkKSB0aGlzLmhlYWx0aCAtPSBkYW1hZ2VcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgICAgdGhpcy5oZWFsdGggLT0gZGFtYWdlXHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5oZWFsdGggPSBVdGlscy5jbGFtcCh0aGlzLmhlYWx0aCwgMCwgdGhpcy5tYXhIZWFsdGgpXHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gY29tcG9uZW50Iiwi77u/J3VzZSBzdHJpY3QnXHJcblxyXG52YXIgU3RvcmFnZSA9IHJlcXVpcmUoJy4uL2FwcC9zdG9yYWdlLmpzJylcclxuXHJcbnZhciBjb25kaXRpb25zID0gZnVuY3Rpb24gKCkge1xyXG4gICAgdGhpcy5pZCA9IDBcclxuICAgIHRoaXMucGFyZW50SWQgPSAwXHJcbiAgICB0aGlzLmV4aGF1c3Rpb24gPSAwXHJcbiAgICB0aGlzLmNvbmNlbnRyYXRpbmcgPSBmYWxzZVxyXG4gICAgdGhpcy5ibGluZGVkID0gZmFsc2VcclxuICAgIHRoaXMuZGVhZmVuZWQgPSBmYWxzZVxyXG4gICAgdGhpcy5jaGFybWVkID0gZmFsc2VcclxuICAgIHRoaXMuZnJpZ2h0ZW5lZCA9IGZhbHNlXHJcbiAgICB0aGlzLmdyYXBwbGVkID0gZmFsc2VcclxuICAgIHRoaXMuaW5jYXBhY2l0YXRlZCA9IGZhbHNlXHJcbiAgICB0aGlzLmludmlzaWJsZSA9IGZhbHNlXHJcbiAgICB0aGlzLnBhcmFseXplZCA9IGZhbHNlXHJcbiAgICB0aGlzLnBldHJpZmllZCA9IGZhbHNlXHJcbiAgICB0aGlzLnBvaXNvbmVkID0gZmFsc2VcclxuICAgIHRoaXMucHJvbmUgPSBmYWxzZVxyXG4gICAgdGhpcy5yZXN0cmFpbmVkID0gZmFsc2VcclxuICAgIHRoaXMuc3R1bm5lZCA9IGZhbHNlXHJcbiAgICB0aGlzLnVuY29uc2Npb3VzID0gZmFsc2VcclxuICAgIHRoaXMuaGV4ZWQgPSBmYWxzZVxyXG4gICAgdGhpcy5odW50ZXJzbWFyayA9IGZhbHNlXHJcbiAgICB0aGlzLmlzUGxheWVyID0gZmFsc2VcclxufVxyXG5cclxuY29uZGl0aW9ucy5wcm90b3R5cGUucGFyc2UgPSBmdW5jdGlvbiAoanNvbikge1xyXG4gICAgaWYgKCFqc29uKSByZXR1cm5cclxuXHJcbiAgICBpZiAoanNvbi5pZCAmJiBVdGlscy5pc051bWVyaWMoanNvbi5pZCkpIHtcclxuICAgICAgICB0aGlzLmlkID0ganNvbi5pZFxyXG4gICAgfVxyXG5cclxuICAgIGlmICh0aGlzLmlkID09PSAwKSB7XHJcbiAgICAgICAgdGhpcy5pZCA9IFN0b3JhZ2UuYXNzaWduSWQoKVxyXG4gICAgfVxyXG5cclxuICAgIGlmIChqc29uLnBhcmVudElkICYmIFV0aWxzLmlzTnVtZXJpYyhqc29uLnBhcmVudElkKSkge1xyXG4gICAgICAgIHRoaXMucGFyZW50SWQgPSBqc29uLnBhcmVudElkXHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGpzb24uZXhoYXVzdGlvbiAmJiBVdGlscy5pc051bWVyaWMoanNvbi5leGhhdXN0aW9uKSkge1xyXG4gICAgICAgIHRoaXMuZXhoYXVzdGlvbiA9IFV0aWxzLmNsYW1wKGpzb24uZXhoYXVzdGlvbiwgMCwgNilcclxuICAgIH1cclxuXHJcbiAgICBpZiAoanNvbi5jb25jZW50cmF0aW5nKSB0aGlzLmNvbmNlbnRyYXRpbmcgPSBqc29uLmNvbmNlbnRyYXRpbmdcclxuICAgIGlmIChqc29uLmJsaW5kZWQpIHRoaXMuYmxpbmRlZCA9IGpzb24uYmxpbmRlZFxyXG4gICAgaWYgKGpzb24uZGVhZmVuZWQpIHRoaXMuZGVhZmVuZWQgPSBqc29uLmRlYWZlbmVkXHJcbiAgICBpZiAoanNvbi5jaGFybWVkKSB0aGlzLmNoYXJtZWQgPSBqc29uLmNoYXJtZWRcclxuICAgIGlmIChqc29uLmJsaW5kZWQpIHRoaXMuYmxpbmRlZCA9IGpzb24uYmxpbmRlZFxyXG4gICAgaWYgKGpzb24uZGVhZmVuZWQpIHRoaXMuZGVhZmVuZWQgPSBqc29uLmRlYWZlbmVkXHJcbiAgICBpZiAoanNvbi5jaGFybWVkKSB0aGlzLmNoYXJtZWQgPSBqc29uLmNoYXJtZWRcclxuICAgIGlmIChqc29uLmZyaWdodGVuZWQpIHRoaXMuZnJpZ2h0ZW5lZCA9IGpzb24uZnJpZ2h0ZW5lZFxyXG4gICAgaWYgKGpzb24uZ3JhcHBsZWQpIHRoaXMuZ3JhcHBsZWQgPSBqc29uLmdyYXBwbGVkXHJcbiAgICBpZiAoanNvbi5pbmNhcGFjaXRhdGVkKSB0aGlzLmluY2FwYWNpdGF0ZWQgPSBqc29uLmluY2FwYWNpdGF0ZWRcclxuICAgIGlmIChqc29uLmludmlzaWJsZSkgdGhpcy5pbnZpc2libGUgPSBqc29uLmludmlzaWJsZVxyXG4gICAgaWYgKGpzb24ucGFyYWx5emVkKSB0aGlzLnBhcmFseXplZCA9IGpzb24ucGFyYWx5emVkXHJcbiAgICBpZiAoanNvbi5wZXRyaWZpZWQpIHRoaXMucGV0cmlmaWVkID0ganNvbi5wZXRyaWZpZWRcclxuICAgIGlmIChqc29uLnBvaXNvbmVkKSB0aGlzLnBvaXNvbmVkID0ganNvbi5wb2lzb25lZFxyXG4gICAgaWYgKGpzb24ucHJvbmUpIHRoaXMucHJvbmUgPSBqc29uLnByb25lXHJcbiAgICBpZiAoanNvbi5yZXN0cmFpbmVkKSB0aGlzLnJlc3RyYWluZWQgPSBqc29uLnJlc3RyYWluZWRcclxuICAgIGlmIChqc29uLnN0dW5uZWQpIHRoaXMuc3R1bm5lZCA9IGpzb24uc3R1bm5lZFxyXG4gICAgaWYgKGpzb24udW5jb25zY2lvdXMpIHRoaXMudW5jb25zY2lvdXMgPSBqc29uLnVuY29uc2Npb3VzXHJcbiAgICBpZiAoanNvbi5oZXhlZCkgdGhpcy5oZXhlZCA9IGpzb24uaGV4ZWRcclxuICAgIGlmIChqc29uLmh1bnRlcnNtYXJrKSB0aGlzLmh1bnRlcnNtYXJrID0ganNvbi5odW50ZXJzbWFya1xyXG59XHJcblxyXG5jb25kaXRpb25zLnByb3RvdHlwZS5zZXJpYWxpemUgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIGlkOiB0aGlzLmlkLFxyXG4gICAgICAgIHBhcmVudElkOiB0aGlzLnBhcmVudElkLFxyXG4gICAgICAgIGV4aGF1c3Rpb246IFV0aWxzLmNsYW1wKHRoaXMuZXhoYXVzdGlvbiwgMCwgNiksXHJcbiAgICAgICAgY29uY2VudHJhdGluZzogdGhpcy5jb25jZW50cmF0aW5nLFxyXG4gICAgICAgIGJsaW5kZWQ6IHRoaXMuYmxpbmRlZCxcclxuICAgICAgICBkZWFmZW5lZDogdGhpcy5kZWFmZW5lZCxcclxuICAgICAgICBjaGFybWVkOiB0aGlzLmNoYXJtZWQsXHJcbiAgICAgICAgY3Vyc2VkOiB0aGlzLmN1cnNlZCxcclxuICAgICAgICBmcmlnaHRlbmVkOiB0aGlzLmZyaWdodGVuZWQsXHJcbiAgICAgICAgZ3JhcHBsZWQ6IHRoaXMuZ3JhcHBsZWQsXHJcbiAgICAgICAgaW5jYXBhY2l0YXRlZDogdGhpcy5pbmNhcGFjaXRhdGVkLFxyXG4gICAgICAgIGludmlzaWJsZTogdGhpcy5pbnZpc2libGUsXHJcbiAgICAgICAgcGFyYWx5emVkOiB0aGlzLnBhcmFseXplZCxcclxuICAgICAgICBwZXRyaWZpZWQ6IHRoaXMucGV0cmlmaWVkLFxyXG4gICAgICAgIHBvaXNvbmVkOiB0aGlzLnBvaXNvbmVkLFxyXG4gICAgICAgIHByb25lOiB0aGlzLnByb25lLFxyXG4gICAgICAgIHJlc3RyYWluZWQ6IHRoaXMucmVzdHJhaW5lZCxcclxuICAgICAgICBzdHVubmVkOiB0aGlzLnN0dW5uZWQsXHJcbiAgICAgICAgdW5jb25zY2lvdXM6IHRoaXMudW5jb25zY2lvdXMsXHJcbiAgICAgICAgaGV4ZWQ6IHRoaXMuaGV4ZWQsXHJcbiAgICAgICAgaHVudGVyc21hcms6IHRoaXMuaHVudGVyc21hcmtcclxuICAgIH1cclxufVxyXG5cclxuY29uZGl0aW9ucy5wcm90b3R5cGUuY2xvbmUgPSBmdW5jdGlvbiAocGFyZW50SWQpIHtcclxuICAgIHZhciBjID0gbmV3IGNvbmRpdGlvbnMoKVxyXG5cclxuICAgIGMucGFyc2Uoe1xyXG4gICAgICAgIHBhcmVudElkOiBwYXJlbnRJZCxcclxuICAgICAgICBjb25jZW50cmF0aW5nOiBmYWxzZSxcclxuICAgICAgICBleGhhdXN0aW9uOiAwLFxyXG4gICAgICAgIGJsaW5kZWQ6IGZhbHNlLFxyXG4gICAgICAgIGRlYWZlbmVkOiBmYWxzZSxcclxuICAgICAgICBjaGFybWVkOiBmYWxzZSxcclxuICAgICAgICBjdXJzZWQ6IGZhbHNlLFxyXG4gICAgICAgIGZyaWdodGVuZWQ6IGZhbHNlLFxyXG4gICAgICAgIGdyYXBwbGVkOiBmYWxzZSxcclxuICAgICAgICBpbmNhcGFjaXRhdGVkOiBmYWxzZSxcclxuICAgICAgICBpbnZpc2libGU6IGZhbHNlLFxyXG4gICAgICAgIHBhcmFseXplZDogZmFsc2UsXHJcbiAgICAgICAgcGV0cmlmaWVkOiBmYWxzZSxcclxuICAgICAgICBwb2lzb25lZDogZmFsc2UsXHJcbiAgICAgICAgcHJvbmU6IGZhbHNlLFxyXG4gICAgICAgIHJlc3RyYWluZWQ6IGZhbHNlLFxyXG4gICAgICAgIHN0dW5uZWQ6IGZhbHNlLFxyXG4gICAgICAgIHVuY29uc2Npb3VzOiBmYWxzZSxcclxuICAgICAgICBoZXhlZDogZmFsc2UsXHJcbiAgICAgICAgaHVudGVyc21hcms6IGZhbHNlXHJcbiAgICB9KVxyXG5cclxuICAgIHJldHVybiBjXHJcbn1cclxuXHJcbmNvbmRpdGlvbnMucHJvdG90eXBlLnNldFZhbHVlID0gZnVuY3Rpb24gKGtleSwgdmFsdWUpIHtcclxuICAgIHN3aXRjaCAoa2V5KSB7XHJcbiAgICAgICAgY2FzZSBDaGFyYWN0ZXJDb25kaXRpb24uQ29uY2VudHJhdGluZzpcclxuICAgICAgICAgICAgdGhpcy5jb25jZW50cmF0aW5nID0gdmFsdWUgPyB0cnVlIDogZmFsc2VcclxuICAgICAgICAgICAgYnJlYWtcclxuICAgICAgICBjYXNlIENoYXJhY3RlckNvbmRpdGlvbi5FeGhhdXN0aW9uOlxyXG4gICAgICAgICAgICB0aGlzLmV4aGF1c3Rpb24gPSBVdGlscy5pc051bWVyaWModmFsdWUpID8gVXRpbHMuY2xhbXAodmFsdWUsIDAsIDYpIDogMFxyXG4gICAgICAgICAgICBicmVha1xyXG4gICAgICAgIGNhc2UgQ2hhcmFjdGVyQ29uZGl0aW9uLkJsaW5kZWQ6XHJcbiAgICAgICAgICAgIHRoaXMuYmxpbmRlZCA9IHZhbHVlID8gdHJ1ZSA6IGZhbHNlXHJcbiAgICAgICAgICAgIGJyZWFrXHJcbiAgICAgICAgY2FzZSBDaGFyYWN0ZXJDb25kaXRpb24uRGVhZmVuZWQ6XHJcbiAgICAgICAgICAgIHRoaXMuZGVhZmVuZWQgPSB2YWx1ZSA/IHRydWUgOiBmYWxzZVxyXG4gICAgICAgICAgICBicmVha1xyXG4gICAgICAgIGNhc2UgQ2hhcmFjdGVyQ29uZGl0aW9uLkNoYXJtZWQ6XHJcbiAgICAgICAgICAgIHRoaXMuY2hhcm1lZCA9IHZhbHVlID8gdHJ1ZSA6IGZhbHNlXHJcbiAgICAgICAgICAgIGJyZWFrXHJcbiAgICAgICAgY2FzZSBDaGFyYWN0ZXJDb25kaXRpb24uQ3Vyc2VkOlxyXG4gICAgICAgICAgICB0aGlzLmN1cnNlZCA9IHZhbHVlID8gdHJ1ZSA6IGZhbHNlXHJcbiAgICAgICAgICAgIGJyZWFrXHJcbiAgICAgICAgY2FzZSBDaGFyYWN0ZXJDb25kaXRpb24uRnJpZ2h0ZW5lZDpcclxuICAgICAgICAgICAgdGhpcy5mcmlnaHRlbmVkID0gdmFsdWUgPyB0cnVlIDogZmFsc2VcclxuICAgICAgICAgICAgYnJlYWtcclxuICAgICAgICBjYXNlIENoYXJhY3RlckNvbmRpdGlvbi5HcmFwcGxlZDpcclxuICAgICAgICAgICAgdGhpcy5ncmFwcGxlZCA9IHZhbHVlID8gdHJ1ZSA6IGZhbHNlXHJcbiAgICAgICAgICAgIGJyZWFrXHJcbiAgICAgICAgY2FzZSBDaGFyYWN0ZXJDb25kaXRpb24uSW5jYXBhY2l0YXRlZDpcclxuICAgICAgICAgICAgdGhpcy5pbmNhcGFjaXRhdGVkID0gdmFsdWUgPyB0cnVlIDogZmFsc2VcclxuICAgICAgICAgICAgYnJlYWtcclxuICAgICAgICBjYXNlIENoYXJhY3RlckNvbmRpdGlvbi5JbnZpc2libGU6XHJcbiAgICAgICAgICAgIHRoaXMuaW52aXNpYmxlID0gdmFsdWUgPyB0cnVlIDogZmFsc2VcclxuICAgICAgICAgICAgYnJlYWtcclxuICAgICAgICBjYXNlIENoYXJhY3RlckNvbmRpdGlvbi5QYXJhbHl6ZWQ6XHJcbiAgICAgICAgICAgIHRoaXMucGFyYWx5emVkID0gdmFsdWUgPyB0cnVlIDogZmFsc2VcclxuICAgICAgICAgICAgYnJlYWtcclxuICAgICAgICBjYXNlIENoYXJhY3RlckNvbmRpdGlvbi5QZXRyaWZpZWQ6XHJcbiAgICAgICAgICAgIHRoaXMucGV0cmlmaWVkID0gdmFsdWUgPyB0cnVlIDogZmFsc2VcclxuICAgICAgICAgICAgYnJlYWtcclxuICAgICAgICBjYXNlIENoYXJhY3RlckNvbmRpdGlvbi5Qb2lzb25lZDpcclxuICAgICAgICAgICAgdGhpcy5wb2lzb25lZCA9IHZhbHVlID8gdHJ1ZSA6IGZhbHNlXHJcbiAgICAgICAgICAgIGJyZWFrXHJcbiAgICAgICAgY2FzZSBDaGFyYWN0ZXJDb25kaXRpb24uUHJvbmU6XHJcbiAgICAgICAgICAgIHRoaXMucHJvbmUgPSB2YWx1ZSA/IHRydWUgOiBmYWxzZVxyXG4gICAgICAgICAgICBicmVha1xyXG4gICAgICAgIGNhc2UgQ2hhcmFjdGVyQ29uZGl0aW9uLlJlc3RyYWluZWQ6XHJcbiAgICAgICAgICAgIHRoaXMucmVzdHJhaW5lZCA9IHZhbHVlID8gdHJ1ZSA6IGZhbHNlXHJcbiAgICAgICAgICAgIGJyZWFrXHJcbiAgICAgICAgY2FzZSBDaGFyYWN0ZXJDb25kaXRpb24uU3R1bm5lZDpcclxuICAgICAgICAgICAgdGhpcy5zdHVubmVkID0gdmFsdWUgPyB0cnVlIDogZmFsc2VcclxuICAgICAgICAgICAgYnJlYWtcclxuICAgICAgICBjYXNlIENoYXJhY3RlckNvbmRpdGlvbi5VbmNvbnNjaW91czpcclxuICAgICAgICAgICAgdGhpcy51bmNvbnNjaW91cyA9IHZhbHVlID8gdHJ1ZSA6IGZhbHNlXHJcbiAgICAgICAgICAgIGJyZWFrXHJcbiAgICAgICAgY2FzZSBDaGFyYWN0ZXJDb25kaXRpb24uSGV4ZWQ6XHJcbiAgICAgICAgICAgIHRoaXMuaGV4ZWQgPSB2YWx1ZSA/IHRydWUgOiBmYWxzZVxyXG4gICAgICAgICAgICBicmVha1xyXG4gICAgICAgIGNhc2UgQ2hhcmFjdGVyQ29uZGl0aW9uLkh1bnRlcnNNYXJrOlxyXG4gICAgICAgICAgICB0aGlzLmh1bnRlcnNtYXJrID0gdmFsdWUgPyB0cnVlIDogZmFsc2VcclxuICAgICAgICAgICAgYnJlYWtcclxuICAgIH1cclxufVxyXG5cclxuY29uZGl0aW9ucy5wcm90b3R5cGUucmVuZGVyID0gZnVuY3Rpb24gKCkge1xyXG4gICAgdmFyIG91dCA9ICcnXHJcblxyXG4gICAgaWYgKHRoaXMuaXNQbGF5ZXIpXHJcbiAgICAgICAgb3V0ICs9ICc8c2VsZWN0IGNsYXNzPVwicGxheWVyX2NvbmRpdGlvbl9hZGRcIiBkYXRhLWlkPVwiJyArIHRoaXMucGFyZW50SWQgKyAnXCI+J1xyXG4gICAgZWxzZVxyXG4gICAgICAgIG91dCArPSAnPHNlbGVjdCBjbGFzcz1cIm5wY19jb25kaXRpb25fYWRkXCIgZGF0YS1pZD1cIicgKyB0aGlzLnBhcmVudElkICsgJ1wiPidcclxuXHJcbiAgICBvdXQgKz0gJzxvcHRpb24gdmFsdWU9XCIwXCI+IC0tIFNlbGVjdCAtLSA8L29wdGlvbj4nXHJcbiAgICBvdXQgKz0gJzxvcHRpb24gdmFsdWU9XCInICsgQ2hhcmFjdGVyQ29uZGl0aW9uLkJsaW5kZWQgKyAnXCI+QmxpbmRlZDwvb3B0aW9uPidcclxuICAgIG91dCArPSAnPG9wdGlvbiB2YWx1ZT1cIicgKyBDaGFyYWN0ZXJDb25kaXRpb24uQ2hhcm1lZCArICdcIj5DaGFybWVkPC9vcHRpb24+J1xyXG4gICAgb3V0ICs9ICc8b3B0aW9uIHZhbHVlPVwiJyArIENoYXJhY3RlckNvbmRpdGlvbi5Db25jZW50cmF0aW5nICsgJ1wiPkNvbmNlbnRyYXRpbmc8L29wdGlvbj4nICAgIFxyXG4gICAgb3V0ICs9ICc8b3B0aW9uIHZhbHVlPVwiJyArIENoYXJhY3RlckNvbmRpdGlvbi5DdXJzZWQgKyAnXCI+Q3Vyc2VkPC9vcHRpb24+JyAgICBcclxuICAgIG91dCArPSAnPG9wdGlvbiB2YWx1ZT1cIicgKyBDaGFyYWN0ZXJDb25kaXRpb24uRGVhZmVuZWQgKyAnXCI+RGVhZmVuZWQ8L29wdGlvbj4nXHJcbiAgICBvdXQgKz0gJzxvcHRpb24gdmFsdWU9XCInICsgQ2hhcmFjdGVyQ29uZGl0aW9uLkZyaWdodGVuZWQgKyAnXCI+RnJpZ2h0ZW5lZDwvb3B0aW9uPidcclxuICAgIG91dCArPSAnPG9wdGlvbiB2YWx1ZT1cIicgKyBDaGFyYWN0ZXJDb25kaXRpb24uR3JhcHBsZWQgKyAnXCI+R3JhcHBsZWQ8L29wdGlvbj4nXHJcbiAgICBvdXQgKz0gJzxvcHRpb24gdmFsdWU9XCInICsgQ2hhcmFjdGVyQ29uZGl0aW9uLkhleGVkICsgJ1wiPkhleGVkPC9vcHRpb24+J1xyXG4gICAgb3V0ICs9ICc8b3B0aW9uIHZhbHVlPVwiJyArIENoYXJhY3RlckNvbmRpdGlvbi5IdW50ZXJzTWFyayArICdcIj5IdW50ZXJcXCdzIE1hcms8L29wdGlvbj4nXHJcbiAgICBvdXQgKz0gJzxvcHRpb24gdmFsdWU9XCInICsgQ2hhcmFjdGVyQ29uZGl0aW9uLkluY2FwYWNpdGF0ZWQgKyAnXCI+SW5jYXBhY2l0YXRlZDwvb3B0aW9uPidcclxuICAgIG91dCArPSAnPG9wdGlvbiB2YWx1ZT1cIicgKyBDaGFyYWN0ZXJDb25kaXRpb24uSW52aXNpYmxlICsgJ1wiPkludmlzaWJsZTwvb3B0aW9uPidcclxuICAgIG91dCArPSAnPG9wdGlvbiB2YWx1ZT1cIicgKyBDaGFyYWN0ZXJDb25kaXRpb24uUGFyYWx5emVkICsgJ1wiPlBhcmFseXplZDwvb3B0aW9uPidcclxuICAgIG91dCArPSAnPG9wdGlvbiB2YWx1ZT1cIicgKyBDaGFyYWN0ZXJDb25kaXRpb24uUGV0cmlmaWVkICsgJ1wiPlBldHJpZmllZDwvb3B0aW9uPidcclxuICAgIG91dCArPSAnPG9wdGlvbiB2YWx1ZT1cIicgKyBDaGFyYWN0ZXJDb25kaXRpb24uUG9pc29uZWQgKyAnXCI+UG9pc29uZWQ8L29wdGlvbj4nXHJcbiAgICBvdXQgKz0gJzxvcHRpb24gdmFsdWU9XCInICsgQ2hhcmFjdGVyQ29uZGl0aW9uLlByb25lICsgJ1wiPlByb25lPC9vcHRpb24+J1xyXG4gICAgb3V0ICs9ICc8b3B0aW9uIHZhbHVlPVwiJyArIENoYXJhY3RlckNvbmRpdGlvbi5SZXN0cmFpbmVkICsgJ1wiPlJlc3RyYWluZWQ8L29wdGlvbj4nXHJcbiAgICBvdXQgKz0gJzxvcHRpb24gdmFsdWU9XCInICsgQ2hhcmFjdGVyQ29uZGl0aW9uLlN0dW5uZWQgKyAnXCI+U3R1bm5lZDwvb3B0aW9uPidcclxuICAgIG91dCArPSAnPG9wdGlvbiB2YWx1ZT1cIicgKyBDaGFyYWN0ZXJDb25kaXRpb24uVW5jb25zY2lvdXMgKyAnXCI+VW5jb25zY2lvdXM8L29wdGlvbj4nXHJcbiAgICBvdXQgKz0gJzwvc2VsZWN0PidcclxuXHJcbiAgICBpZiAodGhpcy5pc1BsYXllcikge1xyXG4gICAgICAgIG91dCArPSAnPGxhYmVsPkV4aGF1c2lvbjogJ1xyXG4gICAgICAgIG91dCArPSAnPHNlbGVjdCBjbGFzcz1cInBsYXllcl9leGhhdXN0aW9uXCIgZGF0YS1pZD1cIicgKyB0aGlzLnBhcmVudElkICsgJ1wiPidcclxuICAgICAgICBvdXQgKz0gdGhpcy5leGhhdXN0aW9uID09PSAwID8gJzxvcHRpb24gc2VsZWN0ZWQ9XCJzZWxlY3RlZFwiIHZhbHVlPVwiMFwiPjA8L29wdGlvbj4nIDogJzxvcHRpb24gdmFsdWU9XCIwXCI+MDwvb3B0aW9uPidcclxuICAgICAgICBvdXQgKz0gdGhpcy5leGhhdXN0aW9uID09PSAxID8gJzxvcHRpb24gc2VsZWN0ZWQ9XCJzZWxlY3RlZFwiIHZhbHVlPVwiMVwiPjE8L29wdGlvbj4nIDogJzxvcHRpb24gdmFsdWU9XCIxXCI+MTwvb3B0aW9uPidcclxuICAgICAgICBvdXQgKz0gdGhpcy5leGhhdXN0aW9uID09PSAyID8gJzxvcHRpb24gc2VsZWN0ZWQ9XCJzZWxlY3RlZFwiIHZhbHVlPVwiMlwiPjI8L29wdGlvbj4nIDogJzxvcHRpb24gdmFsdWU9XCIyXCI+Mjwvb3B0aW9uPidcclxuICAgICAgICBvdXQgKz0gdGhpcy5leGhhdXN0aW9uID09PSAzID8gJzxvcHRpb24gc2VsZWN0ZWQ9XCJzZWxlY3RlZFwiIHZhbHVlPVwiM1wiPjM8L29wdGlvbj4nIDogJzxvcHRpb24gdmFsdWU9XCIzXCI+Mzwvb3B0aW9uPidcclxuICAgICAgICBvdXQgKz0gdGhpcy5leGhhdXN0aW9uID09PSA0ID8gJzxvcHRpb24gc2VsZWN0ZWQ9XCJzZWxlY3RlZFwiIHZhbHVlPVwiNFwiPjQ8L29wdGlvbj4nIDogJzxvcHRpb24gdmFsdWU9XCI0XCI+NDwvb3B0aW9uPidcclxuICAgICAgICBvdXQgKz0gdGhpcy5leGhhdXN0aW9uID09PSA1ID8gJzxvcHRpb24gc2VsZWN0ZWQ9XCJzZWxlY3RlZFwiIHZhbHVlPVwiNVwiPjU8L29wdGlvbj4nIDogJzxvcHRpb24gdmFsdWU9XCI1XCI+NTwvb3B0aW9uPidcclxuICAgICAgICBvdXQgKz0gJzwvc2VsZWN0PidcclxuICAgICAgICBvdXQgKz0gJzwvbGFiZWw+J1xyXG4gICAgfVxyXG5cclxuICAgIGlmICh0aGlzLmlzUGxheWVyKVxyXG4gICAgICAgIG91dCArPSAnPGRpdiBjbGFzcz1cInBsYXllcl9jb25kaXRpb25zXCI+J1xyXG4gICAgZWxzZSBcclxuICAgICAgICBvdXQgKz0gJzxkaXYgY2xhc3M9XCJucGNfY29uZGl0aW9uc1wiPidcclxuXHJcbiAgICB2YXIgcmVtb3ZlQ2xhc3MgPSB0aGlzLmlzUGxheWVyID8gJ3BsYXllcl9jb25kaXRpb25fcmVtb3ZlJyA6ICducGNfY29uZGl0aW9uX3JlbW92ZSdcclxuXHJcbiAgICBpZiAodGhpcy5ibGluZGVkKVxyXG4gICAgICAgIG91dCArPSAnPGRpdiBjbGFzcz1cIicgKyByZW1vdmVDbGFzcyArICdcIiBkYXRhLWlkPVwiJyArIHRoaXMucGFyZW50SWQgKyAnXCIgZGF0YS1jb25kaXRpb249XCInICsgQ2hhcmFjdGVyQ29uZGl0aW9uLkJsaW5kZWQgKyAnXCI+QmxpbmRlZDwvZGl2PidcclxuXHJcbiAgICBpZiAodGhpcy5jaGFybWVkKVxyXG4gICAgICAgIG91dCArPSAnPGRpdiBjbGFzcz1cIicgKyByZW1vdmVDbGFzcyArICdcIiBkYXRhLWlkPVwiJyArIHRoaXMucGFyZW50SWQgKyAnXCIgZGF0YS1jb25kaXRpb249XCInICsgQ2hhcmFjdGVyQ29uZGl0aW9uLkNoYXJtZWQgKyAnXCI+Q2hhcm1lZDwvZGl2PidcclxuXHJcbiAgICBpZiAodGhpcy5jb25jZW50cmF0aW5nKVxyXG4gICAgICAgIG91dCArPSAnPGRpdiBjbGFzcz1cIicgKyByZW1vdmVDbGFzcyArICdcIiBkYXRhLWlkPVwiJyArIHRoaXMucGFyZW50SWQgKyAnXCIgZGF0YS1jb25kaXRpb249XCInICsgQ2hhcmFjdGVyQ29uZGl0aW9uLkNvbmNlbnRyYXRpbmcgKyAnXCI+Q29uY2VudHJhdGluZzwvZGl2PidcclxuXHJcbiAgICBpZiAodGhpcy5jdXJzZWQpXHJcbiAgICAgICAgb3V0ICs9ICc8ZGl2IGNsYXNzPVwiJyArIHJlbW92ZUNsYXNzICsgJ1wiIGRhdGEtaWQ9XCInICsgdGhpcy5wYXJlbnRJZCArICdcIiBkYXRhLWNvbmRpdGlvbj1cIicgKyBDaGFyYWN0ZXJDb25kaXRpb24uQ3Vyc2VkICsgJ1wiPkN1cnNlZDwvZGl2PidcclxuXHJcbiAgICBpZiAodGhpcy5kZWFmZW5lZClcclxuICAgICAgICBvdXQgKz0gJzxkaXYgY2xhc3M9XCInICsgcmVtb3ZlQ2xhc3MgKyAnXCIgZGF0YS1pZD1cIicgKyB0aGlzLnBhcmVudElkICsgJ1wiIGRhdGEtY29uZGl0aW9uPVwiJyArIENoYXJhY3RlckNvbmRpdGlvbi5EZWFmZW5lZCArICdcIj5EZWFmZW5lZDwvZGl2PidcclxuXHJcbiAgICBpZiAodGhpcy5mcmlnaHRlbmVkKVxyXG4gICAgICAgIG91dCArPSAnPGRpdiBjbGFzcz1cIicgKyByZW1vdmVDbGFzcyArICdcIiBkYXRhLWlkPVwiJyArIHRoaXMucGFyZW50SWQgKyAnXCIgZGF0YS1jb25kaXRpb249XCInICsgQ2hhcmFjdGVyQ29uZGl0aW9uLkZyaWdodGVuZWQgKyAnXCI+RnJpZ2h0ZW5lZDwvZGl2PidcclxuXHJcbiAgICBpZiAodGhpcy5ncmFwcGxlZClcclxuICAgICAgICBvdXQgKz0gJzxkaXYgY2xhc3M9XCInICsgcmVtb3ZlQ2xhc3MgKyAnXCIgZGF0YS1pZD1cIicgKyB0aGlzLnBhcmVudElkICsgJ1wiIGRhdGEtY29uZGl0aW9uPVwiJyArIENoYXJhY3RlckNvbmRpdGlvbi5HcmFwcGxlZCArICdcIj5HcmFwcGxlZDwvZGl2PidcclxuXHJcbiAgICBpZiAodGhpcy5oZXhlZClcclxuICAgICAgICBvdXQgKz0gJzxkaXYgY2xhc3M9XCInICsgcmVtb3ZlQ2xhc3MgKyAnXCIgZGF0YS1pZD1cIicgKyB0aGlzLnBhcmVudElkICsgJ1wiIGRhdGEtY29uZGl0aW9uPVwiJyArIENoYXJhY3RlckNvbmRpdGlvbi5IZXhlZCArICdcIj5IZXhlZDwvZGl2PidcclxuXHJcbiAgICBpZiAodGhpcy5odW50ZXJzbWFyaylcclxuICAgICAgICBvdXQgKz0gJzxkaXYgY2xhc3M9XCInICsgcmVtb3ZlQ2xhc3MgKyAnXCIgZGF0YS1pZD1cIicgKyB0aGlzLnBhcmVudElkICsgJ1wiIGRhdGEtY29uZGl0aW9uPVwiJyArIENoYXJhY3RlckNvbmRpdGlvbi5IdW50ZXJzTWFyayArICdcIj5IdW50ZXJcXCdzIE1hcms8L2Rpdj4nXHJcblxyXG4gICAgaWYgKHRoaXMuaW5jYXBhY2l0YXRlZClcclxuICAgICAgICBvdXQgKz0gJzxkaXYgY2xhc3M9XCInICsgcmVtb3ZlQ2xhc3MgKyAnXCIgZGF0YS1pZD1cIicgKyB0aGlzLnBhcmVudElkICsgJ1wiIGRhdGEtY29uZGl0aW9uPVwiJyArIENoYXJhY3RlckNvbmRpdGlvbi5JbmNhcGFjaXRhdGVkICsgJ1wiPkluY2FwYWNpdGF0ZWQ8L2Rpdj4nXHJcblxyXG4gICAgaWYgKHRoaXMuaW52aXNpYmxlKVxyXG4gICAgICAgIG91dCArPSAnPGRpdiBjbGFzcz1cIicgKyByZW1vdmVDbGFzcyArICdcIiBkYXRhLWlkPVwiJyArIHRoaXMucGFyZW50SWQgKyAnXCIgZGF0YS1jb25kaXRpb249XCInICsgQ2hhcmFjdGVyQ29uZGl0aW9uLkludmlzaWJsZSArICdcIj5JbnZpc2libGU8L2Rpdj4nXHJcblxyXG4gICAgaWYgKHRoaXMucGFyYWx5emVkKVxyXG4gICAgICAgIG91dCArPSAnPGRpdiBjbGFzcz1cIicgKyByZW1vdmVDbGFzcyArICdcIiBkYXRhLWlkPVwiJyArIHRoaXMucGFyZW50SWQgKyAnXCIgZGF0YS1jb25kaXRpb249XCInICsgQ2hhcmFjdGVyQ29uZGl0aW9uLlBhcmFseXplZCArICdcIj5QYXJhbHl6ZWQ8L2Rpdj4nXHJcblxyXG4gICAgaWYgKHRoaXMucGV0cmlmaWVkKVxyXG4gICAgICAgIG91dCArPSAnPGRpdiBjbGFzcz1cIicgKyByZW1vdmVDbGFzcyArICdcIiBkYXRhLWlkPVwiJyArIHRoaXMucGFyZW50SWQgKyAnXCIgZGF0YS1jb25kaXRpb249XCInICsgQ2hhcmFjdGVyQ29uZGl0aW9uLlBldHJpZmllZCArICdcIj5QZXRyaWZpZWQ8L2Rpdj4nXHJcblxyXG4gICAgaWYgKHRoaXMucG9pc29uZWQpXHJcbiAgICAgICAgb3V0ICs9ICc8ZGl2IGNsYXNzPVwiJyArIHJlbW92ZUNsYXNzICsgJ1wiIGRhdGEtaWQ9XCInICsgdGhpcy5wYXJlbnRJZCArICdcIiBkYXRhLWNvbmRpdGlvbj1cIicgKyBDaGFyYWN0ZXJDb25kaXRpb24uUG9pc29uZWQgKyAnXCI+UG9pc29uZWQ8L2Rpdj4nXHJcblxyXG4gICAgaWYgKHRoaXMucHJvbmUpXHJcbiAgICAgICAgb3V0ICs9ICc8ZGl2IGNsYXNzPVwiJyArIHJlbW92ZUNsYXNzICsgJ1wiIGRhdGEtaWQ9XCInICsgdGhpcy5wYXJlbnRJZCArICdcIiBkYXRhLWNvbmRpdGlvbj1cIicgKyBDaGFyYWN0ZXJDb25kaXRpb24uUHJvbmUgKyAnXCI+UHJvbmU8L2Rpdj4nXHJcblxyXG4gICAgaWYgKHRoaXMucmVzdHJhaW5lZClcclxuICAgICAgICBvdXQgKz0gJzxkaXYgY2xhc3M9XCInICsgcmVtb3ZlQ2xhc3MgKyAnXCIgZGF0YS1pZD1cIicgKyB0aGlzLnBhcmVudElkICsgJ1wiIGRhdGEtY29uZGl0aW9uPVwiJyArIENoYXJhY3RlckNvbmRpdGlvbi5SZXN0cmFpbmVkICsgJ1wiPlJlc3RyYWluZWQ8L2Rpdj4nXHJcblxyXG4gICAgaWYgKHRoaXMuc3R1bm5lZClcclxuICAgICAgICBvdXQgKz0gJzxkaXYgY2xhc3M9XCInICsgcmVtb3ZlQ2xhc3MgKyAnXCIgZGF0YS1pZD1cIicgKyB0aGlzLnBhcmVudElkICsgJ1wiIGRhdGEtY29uZGl0aW9uPVwiJyArIENoYXJhY3RlckNvbmRpdGlvbi5TdHVubmVkICsgJ1wiPlN0dW5uZWQ8L2Rpdj4nXHJcblxyXG4gICAgaWYgKHRoaXMudW5jb25zY2lvdXMpXHJcbiAgICAgICAgb3V0ICs9ICc8ZGl2IGNsYXNzPVwiJyArIHJlbW92ZUNsYXNzICsgJ1wiIGRhdGEtaWQ9XCInICsgdGhpcy5wYXJlbnRJZCArICdcIiBkYXRhLWNvbmRpdGlvbj1cIicgKyBDaGFyYWN0ZXJDb25kaXRpb24uVW5jb25zY2lvdXMgKyAnXCI+VW5jb25zY2lvdXM8L2Rpdj4nXHJcblxyXG4gICAgb3V0ICs9ICc8ZGl2IGNsYXNzPVwiY2xlYXJcIj48L2Rpdj48L2Rpdj4nXHJcblxyXG4gICAgcmV0dXJuIG91dFxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGNvbmRpdGlvbnMiLCLvu78ndXNlIHN0cmljdCdcclxuXHJcbmdsb2JhbC5DaGFyYWN0ZXJTdGF0ZSA9IHtcclxuICAgIERlYWQ6ICdkZWFkJyxcclxuICAgIElkbGU6ICdhbGl2ZScsXHJcbiAgICBFbmNvdW50ZXI6ICdlbmNvdW50ZXInXHJcbn1cclxuXHJcbmdsb2JhbC5DaGFyYWN0ZXJBY3Rpb24gPSB7XHJcbiAgICBEYW1hZ2U6ICdkYW1hZ2UnLFxyXG4gICAgRGllOiAnZGllJyxcclxuICAgIEluaXRpYXRpdmU6ICdpbml0aWF0aXZlJyxcclxuICAgIExlYXZlOiAnbGVhdmUnLFxyXG4gICAgUmV2aXZlOiAncmV2aXZlJyxcclxuICAgIFNwZWxsOiAnc3BlbGwnLFxyXG4gICAgUmVzdDogJ3Jlc3QnLFxyXG4gICAgVG9nZ2xlOiAndG9nZ2xlJyxcclxuICAgIEFwcGx5Q29uZGl0aW9uOiAnYXBwbHktY29uZGl0aW9uJ1xyXG59XHJcblxyXG5nbG9iYWwuQ2hhcmFjdGVyQ29uZGl0aW9uID0ge1xyXG4gICAgQ29uY2VudHJhdGluZzogJ2NvbmNlbnRyYXRpbmcnLFxyXG4gICAgRXhoYXVzdGlvbjogJ2V4aGF1c3Rpb24nLFxyXG4gICAgQmxpbmRlZDogJ2JsaW5kZWQnLFxyXG4gICAgRGVhZmVuZWQ6ICdkZWFmZW5lZCcsXHJcbiAgICBDaGFybWVkOiAnY2hhcm1lZCcsXHJcbiAgICBDdXJzZWQ6ICdjdXJzZWQnLFxyXG4gICAgRnJpZ2h0ZW5lZDogJ2ZyaWdodGVuZWQnLFxyXG4gICAgR3JhcHBsZWQ6ICdncmFwcGxlZCcsXHJcbiAgICBJbmNhcGFjaXRhdGVkOiAnaW5jYXBhY2l0YXRlZCcsXHJcbiAgICBJbnZpc2libGU6ICdpbnZpc2libGUnLFxyXG4gICAgUGFyYWx5emVkOiAncGFyYWx5emVkJyxcclxuICAgIFBldHJpZmllZDogJ3BldHJpZmllZCcsXHJcbiAgICBQb2lzb25lZDogJ3BvaXNvbmVkJyxcclxuICAgIFByb25lOiAncHJvbmUnLFxyXG4gICAgUmVzdHJhaW5lZDogJ3Jlc3RyYWluZWQnLFxyXG4gICAgU3R1bm5lZDogJ3N0dW5uZWQnLFxyXG4gICAgVW5jb25zY2lvdXM6ICd1bmNvbnNjaW91cycsXHJcbiAgICBIZXhlZDogJ2hleGVkJyxcclxuICAgIEh1bnRlcnNNYXJrOiAnaHVudGVyc21hcmsnLFxyXG59XHJcblxyXG5nbG9iYWwuRGFtYWdlVHlwZSA9IHtcclxuICAgIEFjaWQ6ICdhY2lkJyxcclxuICAgIEJsdWRnZW9uaW5nOiAnYmx1ZGdlb25pbmcnLFxyXG4gICAgQ29sZDogJ2NvbGQnLFxyXG4gICAgRmlyZTogJ2ZpcmUnLFxyXG4gICAgRm9yY2U6ICdmb3JjZScsXHJcbiAgICBMaWdodG5pbmc6ICdsaWdodG5pbmcnLFxyXG4gICAgTmVjcm90aWM6ICduZWNyb3RpYycsXHJcbiAgICBQaWVyY2luZzogJ3BpZXJjaW5nJyxcclxuICAgIFBvaXNvbjogJ3BvaXNvbicsXHJcbiAgICBQc3ljaGljOiAncHN5Y2hpYycsXHJcbiAgICBSYWRpYW50OiAncmFkaWFudCcsXHJcbiAgICBTbGFzaGluZzogJ3NsYXNoaW5nJyxcclxuICAgIFRodW5kZXI6ICd0aHVuZGVyJ1xyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IG51bGwiLCLvu78ndXNlIHN0cmljdCdcclxuXHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgZDQ6IGZ1bmN0aW9uICgpIHsgcmV0dXJuIFV0aWxzLnJhbmRvbUludCgxLCA0KSB9LFxyXG4gICAgZDY6IGZ1bmN0aW9uICgpIHsgcmV0dXJuIFV0aWxzLnJhbmRvbUludCgxLCA2KSB9LFxyXG4gICAgZDg6IGZ1bmN0aW9uICgpIHsgcmV0dXJuIFV0aWxzLnJhbmRvbUludCgxLCA4KSB9LFxyXG4gICAgZDEwOiBmdW5jdGlvbiAoKSB7IHJldHVybiBVdGlscy5yYW5kb21JbnQoMSwgMTApIH0sXHJcbiAgICBkMTI6IGZ1bmN0aW9uICgpIHsgcmV0dXJuIFV0aWxzLnJhbmRvbUludCgxLCAxMikgfSxcclxuICAgIGQyMDogZnVuY3Rpb24gKCkgeyByZXR1cm4gVXRpbHMucmFuZG9tSW50KDEsIDIwKSB9LFxyXG4gICAgZDEwMDogZnVuY3Rpb24gKCkgeyByZXR1cm4gVXRpbHMucmFuZG9tSW50KDEsIDEwMCkgfVxyXG59XHJcbiIsIu+7vyd1c2Ugc3RyaWN0J1xyXG5cclxudmFyIFdlYXBvbiA9IHJlcXVpcmUoJy4vd2VhcG9uLmpzJylcclxudmFyIFNwZWxsID0gcmVxdWlyZSgnLi9zcGVsbC5qcycpXHJcbnZhciBDb25kaXRpb25zID0gcmVxdWlyZSgnLi9jb25kaXRpb25zLmpzJylcclxudmFyIHJvbGwgPSByZXF1aXJlKCcuLi9kbmQvZGljZS5qcycpXHJcbnZhciBTdG9yYWdlID0gcmVxdWlyZSgnLi4vYXBwL3N0b3JhZ2UuanMnKVxyXG5cclxudmFyIG5wYyA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHRoaXMuaWQgPSAwXHJcbiAgICB0aGlzLm5hbWUgPSAnJ1xyXG4gICAgdGhpcy5oZWFsdGggPSA1XHJcbiAgICB0aGlzLm1heEhlYWx0aCA9IDVcclxuICAgIHRoaXMuYXJtb3IgPSAxMFxyXG4gICAgdGhpcy5zcGVlZCA9IDE1XHJcbiAgICB0aGlzLnJhY2UgPSAnSHVtYW4nXHJcbiAgICB0aGlzLmluaXRpYXRpdmUgPSAwXHJcbiAgICB0aGlzLndlYXBvbnMgPSBbXVxyXG4gICAgdGhpcy5zcGVsbHMgPSBbXVxyXG4gICAgdGhpcy5zdGF0ZSA9IENoYXJhY3RlclN0YXRlLklkbGVcclxuICAgIHRoaXMubGluayA9ICcnXHJcbiAgICB0aGlzLmltYWdlID0gJydcclxuICAgIHRoaXMuaW5pdE1vZCA9IDBcclxuICAgIHRoaXMudGVtcGxhdGUgPSBmYWxzZVxyXG4gICAgdGhpcy5pbnN0YW5jZSA9IDBcclxuICAgIHRoaXMudmlzaWJsZSA9IGZhbHNlXHJcbiAgICB0aGlzLmNvbmRpdGlvbnMgPSBudWxsXHJcbn1cclxuXHJcbm5wYy5wcm90b3R5cGUucGFyc2UgPSBmdW5jdGlvbiAoanNvbikge1xyXG4gICAgaWYgKCFqc29uKSByZXR1cm5cclxuXHJcbiAgICBpZiAoanNvbi5pZCAmJiBVdGlscy5pc051bWVyaWMoanNvbi5pZCkpIHtcclxuICAgICAgICB0aGlzLmlkID0ganNvbi5pZFxyXG4gICAgfVxyXG5cclxuICAgIGlmICh0aGlzLmlkID09PSAwKSB7XHJcbiAgICAgICAgdGhpcy5pZCA9IFN0b3JhZ2UuYXNzaWduSWQoKVxyXG4gICAgfVxyXG5cclxuICAgIGlmIChqc29uLm5hbWUpIHtcclxuICAgICAgICB0aGlzLm5hbWUgPSBqc29uLm5hbWVcclxuICAgIH1cclxuXHJcbiAgICBpZiAoanNvbi5oZWFsdGggJiYgVXRpbHMuaXNOdW1lcmljKGpzb24uaGVhbHRoKSkge1xyXG4gICAgICAgIHRoaXMuaGVhbHRoID0ganNvbi5oZWFsdGhcclxuICAgIH1cclxuXHJcbiAgICBpZiAoanNvbi5tYXhIZWFsdGggJiYgVXRpbHMuaXNOdW1lcmljKGpzb24ubWF4SGVhbHRoKSkge1xyXG4gICAgICAgIHRoaXMubWF4SGVhbHRoID0ganNvbi5tYXhIZWFsdGhcclxuICAgIH1cclxuXHJcbiAgICBpZiAoanNvbi5hcm1vciAmJiBVdGlscy5pc051bWVyaWMoanNvbi5hcm1vcikpIHtcclxuICAgICAgICB0aGlzLmFybW9yID0ganNvbi5hcm1vclxyXG4gICAgfVxyXG5cclxuICAgIGlmIChqc29uLnNwZWVkICYmIFV0aWxzLmlzTnVtZXJpYyhqc29uLnNwZWVkKSkge1xyXG4gICAgICAgIHRoaXMuc3BlZWQgPSBqc29uLnNwZWVkXHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGpzb24ucmFjZSkge1xyXG4gICAgICAgIHRoaXMucmFjZSA9IGpzb24ucmFjZVxyXG4gICAgfVxyXG5cclxuICAgIGlmIChqc29uLmluaXRpYXRpdmUgJiYgVXRpbHMuaXNOdW1lcmljKGpzb24uaW5pdGlhdGl2ZSkpIHtcclxuICAgICAgICB0aGlzLmluaXRpYXRpdmUgPSBqc29uLmluaXRpYXRpdmVcclxuICAgIH1cclxuXHJcbiAgICBpZiAoanNvbi5zdGF0ZSkge1xyXG4gICAgICAgIHRoaXMuc3RhdGUgPSBqc29uLnN0YXRlXHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGpzb24ud2VhcG9ucyAmJiBVdGlscy5pc0FycmF5KGpzb24ud2VhcG9ucykpIHtcclxuICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IGpzb24ud2VhcG9ucy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICAgICAgdmFyIHcgPSBuZXcgV2VhcG9uKClcclxuICAgICAgICAgICAgdy5wYXJzZShqc29uLndlYXBvbnNbaV0pXHJcbiAgICAgICAgICAgIHRoaXMud2VhcG9ucy5wdXNoKHcpXHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGlmIChqc29uLnNwZWxscyAmJiBVdGlscy5pc0FycmF5KGpzb24uc3BlbGxzKSkge1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0ganNvbi5zcGVsbHMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XHJcbiAgICAgICAgICAgIHZhciBzID0gbmV3IFNwZWxsKClcclxuICAgICAgICAgICAgcy5wYXJzZShqc29uLnNwZWxsc1tpXSlcclxuICAgICAgICAgICAgaWYgKHMucGFyZW50SWQgPT09IDApIHMucGFyZW50SWQgPSB0aGlzLmlkXHJcbiAgICAgICAgICAgIHRoaXMuc3BlbGxzLnB1c2gocylcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGpzb24ubGluaykge1xyXG4gICAgICAgIHRoaXMubGluayA9IGpzb24ubGlua1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChqc29uLmltYWdlKSB7XHJcbiAgICAgICAgdGhpcy5pbWFnZSA9IGpzb24uaW1hZ2VcclxuICAgIH1cclxuXHJcbiAgICBpZiAoanNvbi50ZW1wbGF0ZSkge1xyXG4gICAgICAgIHRoaXMudGVtcGxhdGUgPSBqc29uLnRlbXBsYXRlXHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGpzb24uaW5pdE1vZCAmJiBVdGlscy5pc051bWVyaWMoanNvbi5pbml0TW9kKSkge1xyXG4gICAgICAgIHRoaXMuaW5pdE1vZCA9IGpzb24uaW5pdE1vZFxyXG4gICAgfVxyXG5cclxuICAgIGlmIChqc29uLnZpc2libGUpIHtcclxuICAgICAgICB0aGlzLnZpc2libGUgPSBqc29uLnZpc2libGVcclxuICAgIH1cclxuXHJcbiAgICB2YXIgYyA9IG5ldyBDb25kaXRpb25zKClcclxuICAgIGlmIChjLnBhcmVudElkID09PSAwKSBjLnBhcmVudElkID0gdGhpcy5pZFxyXG4gICAgdGhpcy5jb25kaXRpb25zID0gY1xyXG5cclxuICAgIGlmIChqc29uLmNvbmRpdGlvbnMpIGMucGFyc2UoanNvbi5jb25kaXRpb25zKVxyXG59XHJcblxyXG5ucGMucHJvdG90eXBlLnNlcmlhbGl6ZSA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHZhciB3ZWFwb25zID0gW11cclxuICAgIGZvciAodmFyIGkgPSAwLCBsID0gdGhpcy53ZWFwb25zLmxlbmd0aDsgaSA8IGw7IGkrKykge1xyXG4gICAgICAgIHdlYXBvbnMucHVzaCh0aGlzLndlYXBvbnNbaV0uc2VyaWFsaXplKCkpXHJcbiAgICB9XHJcblxyXG4gICAgdmFyIHNwZWxscyA9IFtdXHJcbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IHRoaXMuc3BlbGxzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xyXG4gICAgICAgIHNwZWxscy5wdXNoKHRoaXMuc3BlbGxzW2ldLnNlcmlhbGl6ZSgpKVxyXG4gICAgfVxyXG5cclxuICAgIHZhciBvdXQgPSB7XHJcbiAgICAgICAgaWQ6IHRoaXMuaWQsXHJcbiAgICAgICAgbmFtZTogdGhpcy5uYW1lLFxyXG4gICAgICAgIGhlYWx0aDogdGhpcy5oZWFsdGgsXHJcbiAgICAgICAgbWF4SGVhbHRoOiB0aGlzLm1heEhlYWx0aCxcclxuICAgICAgICBhcm1vcjogdGhpcy5hcm1vcixcclxuICAgICAgICBzcGVlZDogdGhpcy5zcGVlZCxcclxuICAgICAgICByYWNlOiB0aGlzLnJhY2UsXHJcbiAgICAgICAgaW5pdGlhdGl2ZTogdGhpcy5pbml0aWF0aXZlLFxyXG4gICAgICAgIHdlYXBvbnM6IHdlYXBvbnMsXHJcbiAgICAgICAgc3BlbGxzOiBzcGVsbHMsXHJcbiAgICAgICAgc3RhdGU6IHRoaXMuc3RhdGUsXHJcbiAgICAgICAgbGluazogdGhpcy5saW5rLFxyXG4gICAgICAgIGltYWdlOiB0aGlzLmltYWdlLFxyXG4gICAgICAgIGluaXRNb2Q6IHRoaXMuaW5pdE1vZCxcclxuICAgICAgICB0ZW1wbGF0ZTogdGhpcy50ZW1wbGF0ZSxcclxuICAgICAgICBpbnN0YW5jZTogdGhpcy5pbnN0YW5jZSxcclxuICAgICAgICB2aXNpYmxlOiB0aGlzLnZpc2libGUsXHJcbiAgICAgICAgY29uZGl0aW9uczogdGhpcy5jb25kaXRpb25zLnNlcmlhbGl6ZSgpXHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIG91dFxyXG59XHJcblxyXG5ucGMucHJvdG90eXBlLnJlbmRlciA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHZhciBjbGFzc2VzID0gJ2VudCBucGMnO1xyXG5cclxuICAgIHZhciBvdXQgPSAnPGRpdiBjbGFzcz1cIicgKyBjbGFzc2VzICsgJ1wiIGRhdGEtaWQ9XCInICsgdGhpcy5pZCArICdcIj4nO1xyXG5cclxuICAgIHZhciB0b2dnbGVDaGFyID0gdGhpcy52aXNpYmxlID8gJ2Nsb3NlJyA6ICdvcGVuJ1xyXG4gICAgb3V0ICs9ICc8ZGl2PjxzcGFuIGNsYXNzPVwiYm9sZFwiPicgKyB0aGlzLm5hbWUgKyAnPC9zcGFuPiwgPHNwYW4gY2xhc3M9XCJpdGFsaWNcIj4nICsgdGhpcy5yYWNlICsgJzwvc3Bhbj4uIFNwZWVkOiAnICsgdGhpcy5zcGVlZFxyXG4gICAgb3V0ICs9ICc8aW5wdXQgdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwibnBjX3RvZ2dsZVwiIGRhdGEtaWQ9XCInICsgdGhpcy5pZCArICdcIiB2YWx1ZT1cIicgKyB0b2dnbGVDaGFyICsgJ1wiIC8+PGRpdiBjbGFzcz1cImNsZWFyXCI+PC9kaXY+PC9kaXY+J1xyXG5cclxuICAgIGlmICh0aGlzLnZpc2libGUpIHtcclxuICAgICAgICB2YXIgaW5pdGlhdGl2ZSA9ICcnO1xyXG4gICAgICAgIGlmICh0aGlzLnN0YXRlID09PSBDaGFyYWN0ZXJTdGF0ZS5FbmNvdW50ZXIpXHJcbiAgICAgICAgICAgIGluaXRpYXRpdmUgPSAnICgnICsgKHRoaXMuaGVhbHRoID4gMCA/ICdhbGl2ZScgOiAnZGVhZCcpICsgJyksIEluaXRpYXRpdmU6IDxzcGFuIGNsYXNzPVwiYm9sZFwiPicgKyB0aGlzLmluaXRpYXRpdmUgKyAnPC9zcGFuPidcclxuXHJcbiAgICAgICAgb3V0ICs9ICc8ZGl2PkhlYWx0aDogPHNwYW4gY2xhc3M9XCJib2xkXCI+JyArIHRoaXMuaGVhbHRoICsgJzwvc3Bhbj4sIEFDOiA8c3BhbiBjbGFzcz1cImJvbGRcIj4nICsgdGhpcy5hcm1vciArICc8L3NwYW4+JyArIGluaXRpYXRpdmUgKyAnPC9kaXY+J1xyXG5cclxuICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IHRoaXMud2VhcG9ucy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICAgICAgb3V0ICs9ICc8ZGl2PicgKyB0aGlzLndlYXBvbnNbaV0ucmVuZGVyKCkgKyAnPC9kaXY+J1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHRoaXMuc3BlbGxzLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgICAgb3V0ICs9ICc8dGFibGUgY2VsbHBhZGRpbmc9XCIwXCIgY2VsbHNwYWNpbmc9XCIwXCIgYm9yZGVyPVwiMFwiIGNsYXNzPVwibnBjLXNwZWxsLWxpc3RcIj4nXHJcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gdGhpcy5zcGVsbHMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICBvdXQgKz0gdGhpcy5zcGVsbHNbaV0ucmVuZGVyKClcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBvdXQgKz0gJzwvdGFibGU+J1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHRoaXMuc3RhdGUgPT09IENoYXJhY3RlclN0YXRlLkVuY291bnRlcikge1xyXG4gICAgICAgICAgICBvdXQgKz0gJzxkaXY+PGlucHV0IHR5cGU9XCJidXR0b25cIiBjbGFzcz1cIm5wY19kYW1hZ2VcIiB2YWx1ZT1cIkFwcGx5IERhbWFnZVwiIGRhdGEtaWQ9XCInICsgdGhpcy5pZCArICdcIiAvPjxpbnB1dCB0eXBlPVwidGV4dFwiIGlkPVwibnBjX2RhbWFnZV8nICsgdGhpcy5pZCArICdcIiAvPjwvZGl2PidcclxuICAgICAgICAgICAgb3V0ICs9ICc8ZGl2PidcclxuICAgICAgICAgICAgb3V0ICs9ICc8aW5wdXQgdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwibnBjX3Jlc3RcIiB2YWx1ZT1cIlJlc3RcIiBkYXRhLWlkPVwiJyArIHRoaXMuaWQgKyAnXCIgLz4nXHJcbiAgICAgICAgICAgIG91dCArPSAnPGlucHV0IHR5cGU9XCJidXR0b25cIiBjbGFzcz1cIm5wY19sZWF2ZVwiIHZhbHVlPVwiTGVhdmUgRW5jb3VudGVyXCIgZGF0YS1pZD1cIicgKyB0aGlzLmlkICsgJ1wiIC8+J1xyXG4gICAgICAgICAgICBvdXQgKz0gJzxpbnB1dCB0eXBlPVwiYnV0dG9uXCIgY2xhc3M9XCJucGNfZGllXCIgdmFsdWU9XCJEaWVcIiBkYXRhLWlkPVwiJyArIHRoaXMuaWQgKyAnXCIgLz4nXHJcbiAgICAgICAgICAgIG91dCArPSAnPC9kaXY+JztcclxuICAgICAgICAgICAgaWYgKHRoaXMuY29uZGl0aW9ucykgb3V0ICs9IHRoaXMuY29uZGl0aW9ucy5yZW5kZXIoKTtcclxuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuc3RhdGUgPT09IENoYXJhY3RlclN0YXRlLklkbGUpIHtcclxuICAgICAgICAgICAgb3V0ICs9ICc8ZGl2PidcclxuICAgICAgICAgICAgb3V0ICs9ICc8aW5wdXQgdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwibnBjX2luaXRpYXRpdmVcIiB2YWx1ZT1cIlJvbGwgSW5pdGlhdGl2ZVwiIGRhdGEtaWQ9XCInICsgdGhpcy5pZCArICdcIiAvPiZuYnNwOydcclxuXHJcbiAgICAgICAgICAgIC8vIHRlbXBsYXRlIG5wYydzIGNhbid0IGRvIHRoZXNlIHRoaW5nc1xyXG4gICAgICAgICAgICBpZiAoIXRoaXMudGVtcGxhdGUpIHtcclxuICAgICAgICAgICAgICAgIG91dCArPSAnPGlucHV0IHR5cGU9XCJidXR0b25cIiBjbGFzcz1cIm5wY19yZXN0XCIgdmFsdWU9XCJSZXN0XCIgZGF0YS1pZD1cIicgKyB0aGlzLmlkICsgJ1wiIC8+Jm5ic3A7J1xyXG4gICAgICAgICAgICAgICAgb3V0ICs9ICc8aW5wdXQgdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwibnBjX2RpZVwiIHZhbHVlPVwiRGllXCIgZGF0YS1pZD1cIicgKyB0aGlzLmlkICsgJ1wiIC8+J1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIG91dCArPSAnPC9kaXY+JztcclxuICAgICAgICAgICAgaWYgKCF0aGlzLnRlbXBsYXRlICYmIHRoaXMuY29uZGl0aW9ucykgb3V0ICs9IHRoaXMuY29uZGl0aW9ucy5yZW5kZXIoKTtcclxuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuc3RhdGUgPT09IENoYXJhY3RlclN0YXRlLkRlYWQpIHtcclxuICAgICAgICAgICAgb3V0ICs9ICc8ZGl2PjxpbnB1dCB0eXBlPVwiYnV0dG9uXCIgY2xhc3M9XCJucGNfcmV2aXZlXCIgdmFsdWU9XCJSZXZpdmUgTlBDXCIgZGF0YS1pZD1cIicgKyB0aGlzLmlkICsgJ1wiIC8+PC9kaXY+J1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHRoaXMubGluayB8fCB0aGlzLmltYWdlKSB7XHJcbiAgICAgICAgICAgIG91dCArPSAnPGRpdj4nXHJcbiAgICAgICAgICAgIGlmICh0aGlzLmxpbmspIG91dCArPSAnPGEgaHJlZj1cIicgKyB0aGlzLmxpbmsgKyAnXCIgdGFyZ2V0PVwiX2JsYW5rXCI+RCZEIEJleW9uZDwvYT4nXHJcbiAgICAgICAgICAgIGlmICh0aGlzLmxpbmsgJiYgdGhpcy5pbWFnZSkgb3V0ICs9ICcmbmJzcDsmYW1wOyZuYnNwOydcclxuICAgICAgICAgICAgaWYgKHRoaXMuaW1hZ2UpIG91dCArPSAnPGEgaHJlZj1cIicgKyB0aGlzLmltYWdlICsgJ1wiIHRhcmdldD1cIl9ibGFua1wiPkltYWdlPC9hPidcclxuICAgICAgICAgICAgb3V0ICs9ICc8L2Rpdj4nXHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIG91dCArPSAnPC9kaXY+J1xyXG4gICAgcmV0dXJuIG91dDtcclxufVxyXG5cclxubnBjLnByb3RvdHlwZS5yb2xsSW5pdGlhdGl2ZSA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHRoaXMuc3RhdGUgPSBDaGFyYWN0ZXJTdGF0ZS5FbmNvdW50ZXJcclxuICAgIHRoaXMuaW5pdGlhdGl2ZSA9IHJvbGwuZDIwKCkgKyB0aGlzLmluaXRNb2RcclxufVxyXG5cclxubnBjLnByb3RvdHlwZS5hcHBseUluaXRpYXRpdmUgPSBmdW5jdGlvbiAoaW5pdGlhdGl2ZSkge1xyXG4gICAgdGhpcy5pbml0aWF0aXZlID0gaW5pdGlhdGl2ZVxyXG4gICAgaWYgKHRoaXMuc3RhdGUgIT09IENoYXJhY3RlclN0YXRlLkRlYWQpIHtcclxuICAgICAgICB0aGlzLnN0YXRlID0gQ2hhcmFjdGVyU3RhdGUuRW5jb3VudGVyXHJcbiAgICB9XHJcbn1cclxuXHJcbm5wYy5wcm90b3R5cGUuYXBwbHlEYW1hZ2UgPSBmdW5jdGlvbiAoZGFtYWdlKSB7XHJcbiAgICB0aGlzLmhlYWx0aCAtPSBkYW1hZ2VcclxuICAgIGlmICh0aGlzLmhlYWx0aCA8PSAwKSB7XHJcbiAgICAgICAgdGhpcy5zdGF0ZSA9IENoYXJhY3RlclN0YXRlLkRlYWRcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLmhlYWx0aCA9IFV0aWxzLmNsYW1wKHRoaXMuaGVhbHRoLCAwLCB0aGlzLm1heEhlYWx0aClcclxufVxyXG5cclxubnBjLnByb3RvdHlwZS5yZXZpdmUgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICB0aGlzLmhlYWx0aCA9IDFcclxuICAgIHRoaXMuc3RhdGUgPSBDaGFyYWN0ZXJTdGF0ZS5FbmNvdW50ZXJcclxufVxyXG5cclxubnBjLnByb3RvdHlwZS5sZWF2ZUVuY291bnRlciA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHRoaXMuaW5pdGlhdGl2ZSA9IDBcclxuICAgIHRoaXMuc3RhdGUgPSBDaGFyYWN0ZXJTdGF0ZS5JZGxlXHJcbn1cclxuXHJcbm5wYy5wcm90b3R5cGUuZGllID0gZnVuY3Rpb24gKCkge1xyXG4gICAgdGhpcy5oZWFsdGggPSAwXHJcbiAgICB0aGlzLnN0YXRlID0gQ2hhcmFjdGVyU3RhdGUuRGVhZFxyXG59XHJcblxyXG5ucGMucHJvdG90eXBlLmNsb25lID0gZnVuY3Rpb24gKCkge1xyXG4gICAgdmFyIG4gPSBuZXcgbnBjKClcclxuICAgIHRoaXMuaW5zdGFuY2UrK1xyXG5cclxuICAgIG4ucGFyc2Uoe1xyXG4gICAgICAgIG5hbWU6IHRoaXMubmFtZSArICcgIycgKyB0aGlzLmluc3RhbmNlLFxyXG4gICAgICAgIGhlYWx0aDogdGhpcy5oZWFsdGgsXHJcbiAgICAgICAgbWF4SGVhbHRoOiB0aGlzLm1heEhlYWx0aCxcclxuICAgICAgICBhcm1vcjogdGhpcy5hcm1vcixcclxuICAgICAgICBzcGVlZDogdGhpcy5zcGVlZCxcclxuICAgICAgICByYWNlOiB0aGlzLnJhY2UsXHJcbiAgICAgICAgbGluazogdGhpcy5saW5rLFxyXG4gICAgICAgIGltYWdlOiB0aGlzLmltYWdlLFxyXG4gICAgICAgIGluaXRNb2Q6IHRoaXMuaW5pdE1vZCxcclxuICAgICAgICB2aXNpYmxlOiB0aGlzLnZpc2libGVcclxuICAgIH0pXHJcblxyXG4gICAgdmFyIHdlYXBvbnMgPSBbXVxyXG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSB0aGlzLndlYXBvbnMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XHJcbiAgICAgICAgd2VhcG9ucy5wdXNoKHRoaXMud2VhcG9uc1tpXS5jbG9uZShuLmlkKSlcclxuICAgIH1cclxuICAgIG4ud2VhcG9ucyA9IHdlYXBvbnM7XHJcblxyXG4gICAgdmFyIHNwZWxscyA9IFtdXHJcbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IHRoaXMuc3BlbGxzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xyXG4gICAgICAgIHNwZWxscy5wdXNoKHRoaXMuc3BlbGxzW2ldLmNsb25lKG4uaWQpKVxyXG4gICAgfVxyXG4gICAgbi5zcGVsbHMgPSBzcGVsbHNcclxuXHJcbiAgICByZXR1cm4gblxyXG59XHJcblxyXG5ucGMucHJvdG90eXBlLnVzZVNwZWxsID0gZnVuY3Rpb24gKHNsb3RJZCwgdXNlKSB7XHJcbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IHRoaXMuc3BlbGxzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xyXG4gICAgICAgIGlmICh0aGlzLnNwZWxsc1tpXS5pZCA9PT0gc2xvdElkKSB7XHJcbiAgICAgICAgICAgIGlmICh1c2UpXHJcbiAgICAgICAgICAgICAgICB0aGlzLnNwZWxsc1tpXS51c2VkKytcclxuICAgICAgICAgICAgZWxzZVxyXG4gICAgICAgICAgICAgICAgdGhpcy5zcGVsbHNbaV0udXNlZC0tXHJcbiAgICAgICAgICAgIHRoaXMuc3BlbGxzW2ldLnVzZWQgPSBVdGlscy5jbGFtcCh0aGlzLnNwZWxsc1tpXS51c2VkLCAwLCB0aGlzLnNwZWxscy5zbG90cylcclxuICAgICAgICAgICAgcmV0dXJuIHRydWVcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGZhbHNlXHJcbn1cclxuXHJcbm5wYy5wcm90b3R5cGUuYXBwbHlSZXN0ID0gZnVuY3Rpb24gKCkge1xyXG4gICAgdGhpcy5oZWFsdGggPSB0aGlzLm1heEhlYWx0aFxyXG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSB0aGlzLnNwZWxscy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICB0aGlzLnNwZWxsc1tpXS51c2VkID0gMFxyXG4gICAgfVxyXG59XHJcblxyXG5ucGMucHJvdG90eXBlLnRvZ2dsZSA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHRoaXMudmlzaWJsZSA9IHRoaXMudmlzaWJsZSA/IGZhbHNlIDogdHJ1ZVxyXG59XHJcblxyXG5ucGMucHJvdG90eXBlLmNvbmRpdGlvbiA9IGZ1bmN0aW9uIChrZXksIHZhbHVlKSB7XHJcbiAgICBpZiAodGhpcy5jb25kaXRpb25zKSB0aGlzLmNvbmRpdGlvbnMuc2V0VmFsdWUoa2V5LCB2YWx1ZSlcclxufTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gbnBjIiwi77u/J3VzZSBzdHJpY3QnXHJcblxyXG52YXIgU3RvcmFnZSA9IHJlcXVpcmUoJy4uL2FwcC9zdG9yYWdlLmpzJylcclxudmFyIENvbmRpdGlvbnMgPSByZXF1aXJlKCcuL2NvbmRpdGlvbnMuanMnKVxyXG5cclxudmFyIHBsYXllciA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHRoaXMuaWQgPSAwXHJcbiAgICB0aGlzLm5hbWUgPSAnJ1xyXG4gICAgdGhpcy5wbGF5ZXIgPSAnJ1xyXG4gICAgdGhpcy5pbml0aWF0aXZlID0gMFxyXG4gICAgdGhpcy5zdGF0ZSA9IENoYXJhY3RlclN0YXRlLklkbGVcclxuICAgIHRoaXMubGluayA9ICcnXHJcbiAgICB0aGlzLnZpc2libGUgPSBmYWxzZVxyXG59O1xyXG5cclxucGxheWVyLnByb3RvdHlwZS5wYXJzZSA9IGZ1bmN0aW9uIChqc29uKSB7XHJcbiAgICBpZiAoIWpzb24pIHJldHVyblxyXG5cclxuICAgIGlmIChqc29uLmlkICYmIFV0aWxzLmlzTnVtZXJpYyhqc29uLmlkKSkge1xyXG4gICAgICAgIHRoaXMuaWQgPSBqc29uLmlkXHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHRoaXMuaWQgPT09IDApIHtcclxuICAgICAgICB0aGlzLmlkID0gU3RvcmFnZS5hc3NpZ25JZCgpXHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGpzb24ubmFtZSkge1xyXG4gICAgICAgIHRoaXMubmFtZSA9IGpzb24ubmFtZVxyXG4gICAgfVxyXG5cclxuICAgIGlmIChqc29uLnBsYXllcikge1xyXG4gICAgICAgIHRoaXMucGxheWVyID0ganNvbi5wbGF5ZXJcclxuICAgIH1cclxuXHJcbiAgICBpZiAoanNvbi5pbml0aWF0aXZlICYmIFV0aWxzLmlzTnVtZXJpYyhqc29uLmluaXRpYXRpdmUpKSB7XHJcbiAgICAgICAgdGhpcy5pbml0aWF0aXZlID0ganNvbi5pbml0aWF0aXZlXHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGpzb24uc3RhdGUpIHtcclxuICAgICAgICB0aGlzLnN0YXRlID0ganNvbi5zdGF0ZVxyXG4gICAgfVxyXG5cclxuICAgIGlmIChqc29uLmxpbmspIHtcclxuICAgICAgICB0aGlzLmxpbmsgPSBqc29uLmxpbmtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoanNvbi52aXNpYmxlKSB7XHJcbiAgICAgICAgdGhpcy52aXNpYmxlID0ganNvbi52aXNpYmxlXHJcbiAgICB9XHJcblxyXG4gICAgdmFyIGMgPSBuZXcgQ29uZGl0aW9ucygpXHJcbiAgICBpZiAoYy5wYXJlbnRJZCA9PT0gMCkgYy5wYXJlbnRJZCA9IHRoaXMuaWRcclxuICAgIGMuaXNQbGF5ZXIgPSB0cnVlXHJcbiAgICB0aGlzLmNvbmRpdGlvbnMgPSBjXHJcblxyXG4gICAgaWYgKGpzb24uY29uZGl0aW9ucykgYy5wYXJzZShqc29uLmNvbmRpdGlvbnMpXHJcbn1cclxuXHJcbnBsYXllci5wcm90b3R5cGUuc2VyaWFsaXplID0gZnVuY3Rpb24gKCkge1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBpZDogdGhpcy5pZCxcclxuICAgICAgICBuYW1lOiB0aGlzLm5hbWUsXHJcbiAgICAgICAgcGxheWVyOiB0aGlzLnBsYXllcixcclxuICAgICAgICBpbml0aWF0aXZlOiB0aGlzLmluaXRpYXRpdmUsXHJcbiAgICAgICAgc3RhdGU6IHRoaXMuc3RhdGUsXHJcbiAgICAgICAgbGluazogdGhpcy5saW5rLFxyXG4gICAgICAgIHZpc2libGU6IHRoaXMudmlzaWJsZSxcclxuICAgICAgICBjb25kaXRpb25zOiB0aGlzLmNvbmRpdGlvbnMuc2VyaWFsaXplKClcclxuICAgIH1cclxufVxyXG5cclxucGxheWVyLnByb3RvdHlwZS5yZW5kZXIgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICB2YXIgb3V0ID0gJzxkaXYgY2xhc3M9XCJlbnQgcGxheWVyXCIgZGF0YS1pZD1cIicgKyB0aGlzLmlkICsgJ1wiPidcclxuXHJcbiAgICB2YXIgdG9nZ2xlQ2hhciA9IHRoaXMudmlzaWJsZSA/ICdjbG9zZScgOiAnb3BlbidcclxuICAgIG91dCArPSAnPGRpdj48c3BhbiBjbGFzcz1cImJvbGRcIj4nICsgdGhpcy5uYW1lICsgJzwvc3Bhbj4gPHNwYW4gY2xhc3M9XCJpdGFsaWNzXCI+JyArIHRoaXMucGxheWVyICsgJzwvc3Bhbj4nXHJcbiAgICBvdXQgKz0gJzxpbnB1dCB0eXBlPVwiYnV0dG9uXCIgY2xhc3M9XCJwbGF5ZXJfdG9nZ2xlXCIgZGF0YS1pZD1cIicgKyB0aGlzLmlkICsgJ1wiIHZhbHVlPVwiJyArIHRvZ2dsZUNoYXIgKyAnXCIgLz48ZGl2IGNsYXNzPVwiY2xlYXJcIj48L2Rpdj48L2Rpdj4nXHJcblxyXG4gICAgaWYgKHRoaXMudmlzaWJsZSkge1xyXG4gICAgICAgIGlmICh0aGlzLnN0YXRlID09PSBDaGFyYWN0ZXJTdGF0ZS5FbmNvdW50ZXIpIHtcclxuICAgICAgICAgICAgb3V0ICs9ICc8ZGl2PkluaXRpYXRpdmU6IDxzcGFuIGNsYXNzPVwiYm9sZFwiPicgKyB0aGlzLmluaXRpYXRpdmUgKyAnPC9zcGFuPjwvZGl2PidcclxuICAgICAgICAgICAgb3V0ICs9ICc8ZGl2PidcclxuICAgICAgICAgICAgb3V0ICs9ICc8aW5wdXQgdHlwZT1cImJ1dHRvblwiIGNsYXNzPVwicGxheWVyX2xlYXZlXCIgdmFsdWU9XCJMZWF2ZSBFbmNvdW50ZXJcIiBkYXRhLWlkPVwiJyArIHRoaXMuaWQgKyAnXCIgLz4nXHJcbiAgICAgICAgICAgIG91dCArPSAnPGlucHV0IHR5cGU9XCJidXR0b25cIiBjbGFzcz1cInBsYXllcl9kaWVcIiB2YWx1ZT1cIkRpZVwiIGRhdGEtaWQ9XCInICsgdGhpcy5pZCArICdcIiAvPidcclxuICAgICAgICAgICAgb3V0ICs9ICc8L2Rpdj4nXHJcbiAgICAgICAgICAgIGlmICh0aGlzLmNvbmRpdGlvbnMpIG91dCArPSB0aGlzLmNvbmRpdGlvbnMucmVuZGVyKCk7XHJcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLnN0YXRlID09PSBDaGFyYWN0ZXJTdGF0ZS5JZGxlKSB7XHJcbiAgICAgICAgICAgIG91dCArPSAnPGRpdj4nXHJcbiAgICAgICAgICAgIG91dCArPSAnPGlucHV0IHR5cGU9XCJidXR0b25cIiBjbGFzcz1cInBsYXllcl9pbml0aWF0aXZlXCIgdmFsdWU9XCJBcHBseSBJbml0aWF0dmVcIiBkYXRhLWlkPVwiJyArIHRoaXMuaWQgKyAnXCIgLz48aW5wdXQgdHlwZT1cInRleHRcIiBpZD1cInBsYXllcl9pbml0aWF0aXZlXycgKyB0aGlzLmlkICsgJ1wiIC8+J1xyXG4gICAgICAgICAgICBvdXQgKz0gJzxpbnB1dCB0eXBlPVwiYnV0dG9uXCIgY2xhc3M9XCJwbGF5ZXJfZGllXCIgdmFsdWU9XCJEaWVcIiBkYXRhLWlkPVwiJyArIHRoaXMuaWQgKyAnXCIgLz4nXHJcbiAgICAgICAgICAgIG91dCArPSAnPC9kaXY+JztcclxuICAgICAgICAgICAgaWYgKHRoaXMuY29uZGl0aW9ucykgb3V0ICs9IHRoaXMuY29uZGl0aW9ucy5yZW5kZXIoKTtcclxuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuc3RhdGUgPT09IENoYXJhY3RlclN0YXRlLkRlYWQpIHtcclxuICAgICAgICAgICAgb3V0ICs9ICc8ZGl2PjxpbnB1dCB0eXBlPVwiYnV0dG9uXCIgY2xhc3M9XCJwbGF5ZXJfcmV2aXZlXCIgdmFsdWU9XCJSZXZpdmUgUGxheWVyXCIgZGF0YS1pZD1cIicgKyB0aGlzLmlkICsgJ1wiIC8+PC9kaXY+J1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHRoaXMubGluaykgb3V0ICs9ICc8ZGl2PjxhIGhyZWY9XCInICsgdGhpcy5saW5rICsgJ1wiIHRhcmdldD1cIl9ibGFua1wiPkQmRCBCZXlvbmQ8L2E+PC9kaXY+J1xyXG4gICAgfVxyXG5cclxuICAgIG91dCArPSAnPC9kaXY+J1xyXG5cclxuICAgIHJldHVybiBvdXRcclxufVxyXG5cclxucGxheWVyLnByb3RvdHlwZS5hcHBseUluaXRpYXRpdmUgPSBmdW5jdGlvbiAoaW5pdGlhdGl2ZSkge1xyXG4gICAgdGhpcy5pbml0aWF0aXZlID0gaW5pdGlhdGl2ZVxyXG4gICAgdGhpcy5zdGF0ZSA9IENoYXJhY3RlclN0YXRlLkVuY291bnRlclxyXG59XHJcblxyXG5wbGF5ZXIucHJvdG90eXBlLmxlYXZlRW5jb3VudGVyID0gZnVuY3Rpb24gKCkge1xyXG4gICAgdGhpcy5pbml0aWF0aXZlID0gMFxyXG4gICAgdGhpcy5zdGF0ZSA9IENoYXJhY3RlclN0YXRlLklkbGVcclxufVxyXG5cclxucGxheWVyLnByb3RvdHlwZS5yZXZpdmUgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICB0aGlzLnN0YXRlID0gQ2hhcmFjdGVyU3RhdGUuRW5jb3VudGVyXHJcbn1cclxuXHJcbnBsYXllci5wcm90b3R5cGUuZGllID0gZnVuY3Rpb24gKCkge1xyXG4gICAgdGhpcy5zdGF0ZSA9IENoYXJhY3RlclN0YXRlLkRlYWRcclxufVxyXG5cclxucGxheWVyLnByb3RvdHlwZS51c2VTcGVsbCA9IGZ1bmN0aW9uIChzbG90SWQsIHVzZSkge1xyXG4gICAgcmV0dXJuIGZhbHNlXHJcbn1cclxuXHJcbnBsYXllci5wcm90b3R5cGUuYXBwbHlSZXN0ID0gZnVuY3Rpb24gKCkge1xyXG5cclxufVxyXG5cclxucGxheWVyLnByb3RvdHlwZS50b2dnbGUgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICB0aGlzLnZpc2libGUgPSB0aGlzLnZpc2libGUgPyBmYWxzZSA6IHRydWVcclxufVxyXG5cclxucGxheWVyLnByb3RvdHlwZS5jb25kaXRpb24gPSBmdW5jdGlvbiAoa2V5LCB2YWx1ZSkge1xyXG4gICAgaWYgKHRoaXMuY29uZGl0aW9ucykgdGhpcy5jb25kaXRpb25zLnNldFZhbHVlKGtleSwgdmFsdWUpXHJcbn07XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHBsYXllcjsiLCLvu78ndXNlIHN0cmljdCdcclxuXHJcbnZhciBTdG9yYWdlID0gcmVxdWlyZSgnLi4vYXBwL3N0b3JhZ2UuanMnKVxyXG5cclxudmFyIHNwZWxsID0gZnVuY3Rpb24gKCkge1xyXG4gICAgdGhpcy5pZCA9IDBcclxuICAgIHRoaXMucGFyZW50SWQgPSAwXHJcbiAgICB0aGlzLm5hbWUgPSAnJ1xyXG4gICAgdGhpcy5zbG90cyA9IDBcclxuICAgIHRoaXMudXNlZCA9IDBcclxufVxyXG5cclxuc3BlbGwucHJvdG90eXBlLnBhcnNlID0gZnVuY3Rpb24gKGpzb24pIHtcclxuICAgIGlmICghanNvbikgcmV0dXJuXHJcblxyXG4gICAgaWYgKGpzb24uaWQgJiYgVXRpbHMuaXNOdW1lcmljKGpzb24uaWQpKSB7XHJcbiAgICAgICAgdGhpcy5pZCA9IGpzb24uaWRcclxuICAgIH1cclxuXHJcbiAgICBpZiAodGhpcy5pZCA9PT0gMCkge1xyXG4gICAgICAgIHRoaXMuaWQgPSBTdG9yYWdlLmFzc2lnbklkKClcclxuICAgIH1cclxuXHJcbiAgICBpZiAoanNvbi5wYXJlbnRJZCAmJiBVdGlscy5pc051bWVyaWMoanNvbi5wYXJlbnRJZCkpIHtcclxuICAgICAgICB0aGlzLnBhcmVudElkID0ganNvbi5wYXJlbnRJZFxyXG4gICAgfVxyXG5cclxuICAgIGlmIChqc29uLm5hbWUpIHtcclxuICAgICAgICB0aGlzLm5hbWUgPSBqc29uLm5hbWVcclxuICAgIH1cclxuXHJcbiAgICBpZiAoanNvbi5zbG90cyAmJiBVdGlscy5pc051bWVyaWMoanNvbi5zbG90cykpIHtcclxuICAgICAgICB0aGlzLnNsb3RzID0gVXRpbHMuY2xhbXAoanNvbi5zbG90cywgMCwgOTk5KVxyXG4gICAgfVxyXG5cclxuICAgIGlmIChqc29uLnVzZWQgJiYgVXRpbHMuaXNOdW1lcmljKGpzb24udXNlZCkpIHtcclxuICAgICAgICB0aGlzLnVzZWQgPSBVdGlscy5jbGFtcChqc29uLnVzZWQsIDAsIDk5OSlcclxuICAgIH1cclxufVxyXG5cclxuc3BlbGwucHJvdG90eXBlLnNlcmlhbGl6ZSA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHJldHVybiB7XHJcbiAgICAgICAgaWQ6IHRoaXMuaWQsXHJcbiAgICAgICAgcGFyZW50SWQ6IHRoaXMucGFyZW50SWQsXHJcbiAgICAgICAgbmFtZTogdGhpcy5uYW1lLFxyXG4gICAgICAgIHNsb3RzOiB0aGlzLnNsb3RzLFxyXG4gICAgICAgIHVzZWQ6IHRoaXMudXNlZFxyXG4gICAgfVxyXG59XHJcblxyXG5zcGVsbC5wcm90b3R5cGUuc2VyaWFsaXplID0gZnVuY3Rpb24gKCkge1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBpZDogdGhpcy5pZCxcclxuICAgICAgICBwYXJlbnRJZDogdGhpcy5wYXJlbnRJZCxcclxuICAgICAgICBuYW1lOiB0aGlzLm5hbWUsXHJcbiAgICAgICAgc2xvdHM6IHRoaXMuc2xvdHMsXHJcbiAgICAgICAgdXNlZDogdGhpcy51c2VkXHJcbiAgICB9XHJcbn1cclxuXHJcbnNwZWxsLnByb3RvdHlwZS5jbG9uZSA9IGZ1bmN0aW9uIChwYXJlbnRJZCkge1xyXG4gICAgdmFyIHMgPSBuZXcgc3BlbGwoKVxyXG5cclxuICAgIHMucGFyc2Uoe1xyXG4gICAgICAgIG5hbWU6IHRoaXMubmFtZSxcclxuICAgICAgICBwYXJlbnRJZDogcGFyZW50SWQsXHJcbiAgICAgICAgc2xvdHM6IHRoaXMuc2xvdHMsXHJcbiAgICAgICAgdXNlZDogdGhpcy51c2VkXHJcbiAgICB9KVxyXG5cclxuICAgIHJldHVybiBzXHJcbn1cclxuXHJcbnNwZWxsLnByb3RvdHlwZS5yZW5kZXIgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICB2YXIgb3V0ID0gJzx0cj4nXHJcblxyXG4gICAgb3V0ICs9ICc8dGQ+JyArIHRoaXMubmFtZSArICc8L3RkPic7XHJcblxyXG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSB0aGlzLnNsb3RzOyBpIDwgbDsgaSsrKSB7XHJcbiAgICAgICAgb3V0ICs9ICc8dGQ+J1xyXG4gICAgICAgIGlmICgoaSArIDEpIDw9IHRoaXMudXNlZCkge1xyXG4gICAgICAgICAgICBvdXQgKz0gJzxpbnB1dCBjbGFzcz1cIm5wY19zcGVsbF9zbG90XCIgdHlwZT1cImNoZWNrYm94XCIgY2hlY2tlZD1cImNoZWNrZWRcIiBkYXRhLWlkPVwiJyArIHRoaXMucGFyZW50SWQgKyAnXCIgZGF0YS1sZXZlbC1pZD1cIicgKyB0aGlzLmlkICsgJ1wiIC8+J1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIG91dCArPSAnPGlucHV0IGNsYXNzPVwibnBjX3NwZWxsX3Nsb3RcIiB0eXBlPVwiY2hlY2tib3hcIiBkYXRhLWlkPVwiJyArIHRoaXMucGFyZW50SWQgKyAnXCIgZGF0YS1sZXZlbC1pZD1cIicgKyB0aGlzLmlkICsgJ1wiIC8+J1xyXG4gICAgICAgIH1cclxuICAgICAgICBvdXQgKz0gJzwvdGQ+J1xyXG4gICAgfVxyXG5cclxuICAgIG91dCArPSAnPC90cj4nXHJcblxyXG4gICAgcmV0dXJuIG91dFxyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHNwZWxsIiwi77u/J3VzZSBzdHJpY3QnXHJcblxyXG52YXIgQ29tcG9uZW50ID0gcmVxdWlyZSgnLi9jb21wb25lbnQuanMnKVxyXG52YXIgU3RvcmFnZSA9IHJlcXVpcmUoJy4uL2FwcC9zdG9yYWdlLmpzJylcclxuXHJcbnZhciB2ZWhpY2xlID0gZnVuY3Rpb24gKCkge1xyXG4gICAgdGhpcy5pZCA9IDBcclxuICAgIHRoaXMubmFtZSA9IFwiXCJcclxuICAgIHRoaXMudHlwZSA9IFwiXCJcclxuICAgIHRoaXMuY29tcG9uZW50cyA9IFtdXHJcbiAgICB0aGlzLmxpbmsgPSBcIlwiXHJcbiAgICB0aGlzLnZpc2libGUgPSBmYWxzZVxyXG59XHJcblxyXG52ZWhpY2xlLnByb3RvdHlwZS5wYXJzZSA9IGZ1bmN0aW9uIChqc29uKSB7XHJcbiAgICBpZiAoIWpzb24pIHJldHVyblxyXG5cclxuICAgIGlmIChqc29uLmlkICYmIFV0aWxzLmlzTnVtZXJpYyhqc29uLmlkKSkge1xyXG4gICAgICAgIHRoaXMuaWQgPSBqc29uLmlkXHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHRoaXMuaWQgPT09IDApIHtcclxuICAgICAgICB0aGlzLmlkID0gU3RvcmFnZS5hc3NpZ25JZCgpXHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGpzb24ubmFtZSkge1xyXG4gICAgICAgIHRoaXMubmFtZSA9IGpzb24ubmFtZVxyXG4gICAgfVxyXG5cclxuICAgIGlmIChqc29uLnR5cGUpIHtcclxuICAgICAgICB0aGlzLnR5cGUgPSBqc29uLnR5cGVcclxuICAgIH1cclxuXHJcbiAgICBpZiAoanNvbi5jb21wb25lbnRzICYmIFV0aWxzLmlzQXJyYXkoanNvbi5jb21wb25lbnRzKSkge1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0ganNvbi5jb21wb25lbnRzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xyXG4gICAgICAgICAgICB2YXIgYyA9IG5ldyBDb21wb25lbnQoKVxyXG4gICAgICAgICAgICBjLnBhcnNlKGpzb24uY29tcG9uZW50c1tpXSlcclxuICAgICAgICAgICAgaWYgKGMudmVoaWNsZUlkID09PSAwKSBjLnZlaGljbGVJZCA9IHRoaXMuaWRcclxuICAgICAgICAgICAgdGhpcy5jb21wb25lbnRzLnB1c2goYylcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGpzb24ubGluaykge1xyXG4gICAgICAgIHRoaXMubGluayA9IGpzb24ubGlua1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChqc29uLnZpc2libGUpIHtcclxuICAgICAgICB0aGlzLnZpc2libGUgPSBqc29uLnZpc2libGVcclxuICAgIH1cclxufVxyXG5cclxudmVoaWNsZS5wcm90b3R5cGUuc2VyaWFsaXplID0gZnVuY3Rpb24gKCkge1xyXG4gICAgdmFyIGNvbXBvbmVudHMgPSBbXVxyXG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSB0aGlzLmNvbXBvbmVudHMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XHJcbiAgICAgICAgY29tcG9uZW50cy5wdXNoKHRoaXMuY29tcG9uZW50c1tpXSlcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAgIGlkOiB0aGlzLmlkLFxyXG4gICAgICAgIG5hbWU6IHRoaXMubmFtZSxcclxuICAgICAgICB0eXBlOiB0aGlzLnR5cGUsXHJcbiAgICAgICAgY29tcG9uZW50czogY29tcG9uZW50cyxcclxuICAgICAgICBsaW5rOiB0aGlzLmxpbmssXHJcbiAgICAgICAgdmlzaWJsZTogdGhpcy52aXNpYmxlXHJcbiAgICB9XHJcbn1cclxuXHJcbnZlaGljbGUucHJvdG90eXBlLnJlbmRlciA9IGZ1bmN0aW9uICgpIHtcclxuICAgIHZhciBvdXQgPSAnPGRpdiBjbGFzcz1cImVudCB2ZWhpY2xlXCIgZGF0YS1pZD1cIicgKyB0aGlzLmlkICsgJ1wiPidcclxuXHJcbiAgICB2YXIgdG9nZ2xlQ2hhciA9IHRoaXMudmlzaWJsZSA/ICdjbG9zZScgOiAnb3BlbidcclxuICAgIG91dCArPSAnPGRpdj48c3BhbiBjbGFzcz1cImJvbGRcIj4nICsgdGhpcy5uYW1lICsgJzwvc3Bhbj4gPHNwYW4gY2xhc3M9XCJpdGFsaWNzXCI+JyArIHRoaXMudHlwZSArICc8L3NwYW4+ICdcclxuICAgIG91dCArPSAnPGlucHV0IHR5cGU9XCJidXR0b25cIiBjbGFzcz1cInZlaGljbGVfdG9nZ2xlXCIgZGF0YS1pZD1cIicgKyB0aGlzLmlkICsgJ1wiIHZhbHVlPVwiJyArIHRvZ2dsZUNoYXIgKyAnXCIgLz48ZGl2IGNsYXNzPVwiY2xlYXJcIj48L2Rpdj48L2Rpdj4nXHJcblxyXG4gICAgaWYgKHRoaXMudmlzaWJsZSkge1xyXG4gICAgICAgIGlmICh0aGlzLmNvbXBvbmVudHMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgICBvdXQgKz0gJzxkaXYgY2xhc3M9XCJjb21wb25lbnRzXCI+J1xyXG4gICAgICAgICAgICBvdXQgKz0gJzx0YWJsZSBjZWxscGFkZGluZz1cIjBcIiBjZWxsc3BhY2luZz1cIjJcIiBib3JkZXI9XCIwXCI+J1xyXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IHRoaXMuY29tcG9uZW50cy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICAgICAgICAgIGlmIChpICUgMiA9PT0gMCkgb3V0ICs9ICc8dHI+J1xyXG5cclxuICAgICAgICAgICAgICAgIG91dCArPSAnPHRkPicgKyB0aGlzLmNvbXBvbmVudHNbaV0ucmVuZGVyKCkgKyAnPC90ZD4nXHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKGkgJSAyICE9PSAwKSBvdXQgKz0gJzwvdHI+J1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmIChpICUgMiA9PT0gMCkgb3V0ICs9ICc8L3RyPidcclxuICAgICAgICAgICAgb3V0ICs9ICc8L3RhYmxlPidcclxuICAgICAgICAgICAgb3V0ICs9ICc8L2Rpdj4nXHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAodGhpcy5saW5rKSBvdXQgKz0gJzxkaXY+PGEgaHJlZj1cIicgKyB0aGlzLmxpbmsgKyAnXCIgdGFyZ2V0PVwiX2JsYW5rXCI+RCZEIEJleW9uZDwvYT48L2Rpdj4nXHJcbiAgICB9XHJcblxyXG4gICAgb3V0ICs9ICc8L2Rpdj4nXHJcblxyXG4gICAgcmV0dXJuIG91dFxyXG59XHJcblxyXG52ZWhpY2xlLnByb3RvdHlwZS5hcHBseURhbWFnZSA9IGZ1bmN0aW9uIChjb21wb25lbnRJZCwgZGFtYWdlKSB7XHJcbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IHRoaXMuY29tcG9uZW50cy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICBpZiAodGhpcy5jb21wb25lbnRzW2ldLmlkID09PSBjb21wb25lbnRJZCkge1xyXG4gICAgICAgICAgICB0aGlzLmNvbXBvbmVudHNbaV0uYXBwbHlEYW1hZ2UoZGFtYWdlKVxyXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gZmFsc2VcclxufVxyXG5cclxudmVoaWNsZS5wcm90b3R5cGUudG9nZ2xlID0gZnVuY3Rpb24gKCkge1xyXG4gICAgdGhpcy52aXNpYmxlID0gdGhpcy52aXNpYmxlID8gZmFsc2UgOiB0cnVlXHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gdmVoaWNsZSIsIu+7vyd1c2Ugc3RyaWN0J1xyXG5cclxudmFyIFN0b3JhZ2UgPSByZXF1aXJlKCcuLi9hcHAvc3RvcmFnZS5qcycpXHJcblxyXG52YXIgd2VhcG9uID0gZnVuY3Rpb24gKCkge1xyXG4gICAgdGhpcy5pZCA9IDBcclxuICAgIHRoaXMucGFyZW50SWQgPSAwXHJcbiAgICB0aGlzLm5hbWUgPSAnJ1xyXG4gICAgdGhpcy5kaWNlID0gJzFkNCdcclxuICAgIHRoaXMuaGl0TW9kID0gMFxyXG4gICAgdGhpcy5hdHRhY2tNb2QgPSAwXHJcbiAgICB0aGlzLmRhbWFnZVR5cGUgPSBEYW1hZ2VUeXBlLkJsdWRnZW9uaW5nXHJcbn1cclxuXHJcbndlYXBvbi5wcm90b3R5cGUucGFyc2UgPSBmdW5jdGlvbiAoanNvbikge1xyXG4gICAgaWYgKCFqc29uKSByZXR1cm5cclxuXHJcbiAgICBpZiAoanNvbi5pZCAmJiBVdGlscy5pc051bWVyaWMoanNvbi5pZCkpIHtcclxuICAgICAgICB0aGlzLmlkID0ganNvbi5pZFxyXG4gICAgfVxyXG5cclxuICAgIGlmICh0aGlzLmlkID09PSAwKSB7XHJcbiAgICAgICAgdGhpcy5pZCA9IFN0b3JhZ2UuYXNzaWduSWQoKVxyXG4gICAgfVxyXG5cclxuICAgIGlmIChqc29uLnBhcmVudElkICYmIFV0aWxzLmlzTnVtZXJpYyhqc29uLnBhcmVudElkKSkge1xyXG4gICAgICAgIHRoaXMucGFyZW50SWQgPSBqc29uLnBhcmVudElkXHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGpzb24ubmFtZSkge1xyXG4gICAgICAgIHRoaXMubmFtZSA9IGpzb24ubmFtZVxyXG4gICAgfVxyXG5cclxuICAgIGlmIChqc29uLmRpY2UpIHtcclxuICAgICAgICB0aGlzLmRpY2UgPSBqc29uLmRpY2VcclxuICAgIH1cclxuXHJcbiAgICBpZiAoanNvbi5oaXRNb2QgJiYgVXRpbHMuaXNOdW1lcmljKGpzb24uaGl0TW9kKSkge1xyXG4gICAgICAgIHRoaXMuaGl0TW9kID0gVXRpbHMuY2xhbXAoanNvbi5oaXRNb2QsIDAsIDk5OSlcclxuICAgIH1cclxuXHJcbiAgICBpZiAoanNvbi5hdHRhY2tNb2QgJiYgVXRpbHMuaXNOdW1lcmljKGpzb24uYXR0YWNrTW9kKSkge1xyXG4gICAgICAgIHRoaXMuYXR0YWNrTW9kID0gVXRpbHMuY2xhbXAoanNvbi5hdHRhY2tNb2QsIDAsIDk5OSlcclxuICAgIH1cclxuXHJcbiAgICBpZiAoanNvbi5kYW1hZ2VUeXBlKSB7XHJcbiAgICAgICAgdGhpcy5kYW1hZ2VUeXBlID0ganNvbi5kYW1hZ2VUeXBlXHJcbiAgICB9XHJcbn1cclxuXHJcbndlYXBvbi5wcm90b3R5cGUuc2VyaWFsaXplID0gZnVuY3Rpb24gKCkge1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICBpZDogdGhpcy5pZCxcclxuICAgICAgICBuYW1lOiB0aGlzLm5hbWUsXHJcbiAgICAgICAgZGljZTogdGhpcy5kaWNlLFxyXG4gICAgICAgIGhpdE1vZDogdGhpcy5oaXRNb2QsXHJcbiAgICAgICAgYXR0YWNrTW9kOiB0aGlzLmF0dGFja01vZCxcclxuICAgICAgICBkYW1hZ2VUeXBlOiB0aGlzLmRhbWFnZVR5cGVcclxuICAgIH1cclxufVxyXG5cclxud2VhcG9uLnByb3RvdHlwZS5jbG9uZSA9IGZ1bmN0aW9uIChwYXJlbnRJZCkge1xyXG4gICAgdmFyIHcgPSBuZXcgd2VhcG9uKClcclxuXHJcbiAgICB3LnBhcnNlKHtcclxuICAgICAgICBuYW1lOiB0aGlzLm5hbWUsXHJcbiAgICAgICAgcGFyZW50SWQ6IHBhcmVudElkLFxyXG4gICAgICAgIGRpY2U6IHRoaXMuZGljZSxcclxuICAgICAgICBoaXRNb2Q6IHRoaXMuaGl0TW9kLFxyXG4gICAgICAgIGF0dGFja01vZDogdGhpcy5hdHRhY2tNb2QsXHJcbiAgICAgICAgZGFtYWdlVHlwZTogdGhpcy5kYW1hZ2VUeXBlXHJcbiAgICB9KVxyXG5cclxuICAgIHJldHVybiB3XHJcbn1cclxuXHJcbndlYXBvbi5wcm90b3R5cGUucmVuZGVyID0gZnVuY3Rpb24gKCkge1xyXG4gICAgdmFyIG91dCA9ICc8c3BhbiBjbGFzcz1cImJvbGRcIj4nICsgdGhpcy5uYW1lICsgJzwvc3Bhbj46IDFkMjAnXHJcbiAgICBpZiAodGhpcy5oaXRNb2QgPiAwKSBvdXQgKz0gJyArICcgKyB0aGlzLmhpdE1vZFxyXG4gICAgb3V0ICs9ICcgdG8gaGl0LCAnICsgdGhpcy5kaWNlXHJcbiAgICBpZiAodGhpcy5hdHRhY2tNb2QgPiAwKSBvdXQgKz0gJyArICcgKyB0aGlzLmF0dGFja01vZFxyXG4gICAgb3V0ICs9ICcsIDxzcGFuIGNsYXNzPVwiaXRhbGljXCI+JyArIHRoaXMuZGFtYWdlVHlwZSArICc8L3NwYW4+J1xyXG5cclxuICAgIHJldHVybiBvdXRcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSB3ZWFwb24iLCLvu78ndXNlIHN0cmljdCdcclxuXHJcbi8vIGdsb2JhbCB2YXJzL2Z1bmN0aW9uc1xyXG5nbG9iYWwuRGVidWcgPSByZXF1aXJlKCcuL3V0aWxzL2RlYnVnLmpzJylcclxuZ2xvYmFsLlV0aWxzID0gcmVxdWlyZSgnLi91dGlscy91dGlscy5qcycpXHJcblxyXG4vLyBwYXJzZSBhcHAgc3BlY2lmaWMgZ2xvYmFsc1xyXG5yZXF1aXJlKCcuL2RuZC9jb25zdGFudHMuanMnKTtcclxuXHJcbmdsb2JhbC5EYXRhRmlsZSA9ICcvanNvbi9zdGF0ZS5qc29uJ1xyXG5cclxudmFyIHVpID0gcmVxdWlyZSgnLi9hcHAvdWkuanMnKVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSB7XHJcbiAgICBydW46IHVpLnJ1blxyXG59XHJcblxyXG4iLCLvu78ndXNlIHN0cmljdCdcclxuXHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgYXNzZXJ0OiBjb25zb2xlID8gY29uc29sZS5hc3NlcnQuYmluZChjb25zb2xlKSA6IGZ1bmN0aW9uICgpIHsgfSxcclxuICAgIGNsZWFyOiBjb25zb2xlID8gY29uc29sZS5jbGVhci5iaW5kKGNvbnNvbGUpIDogZnVuY3Rpb24gKCkgeyB9LFxyXG4gICAgZXJyb3I6IGNvbnNvbGUgPyBjb25zb2xlLmVycm9yLmJpbmQoY29uc29sZSkgOiBmdW5jdGlvbiAoKSB7IH0sXHJcbiAgICBncm91cDogY29uc29sZSA/IGNvbnNvbGUuZ3JvdXAuYmluZChjb25zb2xlKSA6IGZ1bmN0aW9uICgpIHsgfSxcclxuICAgIGdyb3VwQ29sbGFwc2VkOiBjb25zb2xlID8gY29uc29sZS5ncm91cENvbGxhcHNlZC5iaW5kKGNvbnNvbGUpIDogZnVuY3Rpb24gKCkgeyB9LFxyXG4gICAgZ3JvdXBFbmQ6IGNvbnNvbGUgPyBjb25zb2xlLmdyb3VwRW5kLmJpbmQoY29uc29sZSkgOiBmdW5jdGlvbiAoKSB7IH0sXHJcbiAgICBpbmZvOiBjb25zb2xlID8gY29uc29sZS5pbmZvLmJpbmQoY29uc29sZSkgOiBmdW5jdGlvbiAoKSB7IH0sXHJcbiAgICBsb2c6IGNvbnNvbGUgPyBjb25zb2xlLmxvZy5iaW5kKGNvbnNvbGUpIDogZnVuY3Rpb24gKCkgeyB9LFxyXG4gICAgdHJhY2U6IGNvbnNvbGUgPyBjb25zb2xlLnRyYWNlLmJpbmQoY29uc29sZSkgOiBmdW5jdGlvbiAoKSB7IH0sXHJcbiAgICB3YXJuOiBjb25zb2xlID8gY29uc29sZS53YXJuLmJpbmQoY29uc29sZSkgOiBmdW5jdGlvbiAoKSB7IH0sXHJcbn1cclxuIiwi77u/J3VzZSBzdHJpY3QnXHJcblxyXG52YXIgcmFuZG9tSW50ID0gZnVuY3Rpb24gKG1pbiwgbWF4KSB7XHJcbiAgICByZXR1cm4gTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogKG1heCAtIG1pbiArIDEpKSArIG1pblxyXG59XHJcblxyXG52YXIgcmFuZG9tQ2hhbmNlID0gZnVuY3Rpb24gKHBlcmNlbnRUcnVlKSB7XHJcbiAgICBwZXJjZW50VHJ1ZSA9IHBlcmNlbnRUcnVlIHx8IDUwO1xyXG4gICAgcmV0dXJuIHJhbmRvbUludCgxLCAxMDApIDw9IHBlcmNlbnRUcnVlID8gdHJ1ZSA6IGZhbHNlXHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgY2xhbXA6ICh2YWwsIG1pbiwgbWF4KSA9PiB7XHJcbiAgICAgICAgaWYgKHZhbCA8IG1pbilcclxuICAgICAgICAgICAgcmV0dXJuIG1pblxyXG4gICAgICAgIGlmICh2YWwgPiBtYXgpXHJcbiAgICAgICAgICAgIHJldHVybiBtYXhcclxuICAgICAgICByZXR1cm4gdmFsXHJcbiAgICB9LFxyXG5cclxuICAgIGlzTnVtZXJpYzogKG4pID0+IHtcclxuICAgICAgICByZXR1cm4gIWlzTmFOKHBhcnNlRmxvYXQobikpICYmIGlzRmluaXRlKG4pXHJcbiAgICB9LFxyXG5cclxuICAgIHJhbmRvbUludDogcmFuZG9tSW50LFxyXG5cclxuICAgIHJhbmRvbUNoYW5jZTogcmFuZG9tQ2hhbmNlXHJcbn1cclxuIiwi77u/J3VzZSBzdHJpY3QnXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHtcclxuICAgIGlzQXJyYXk6IChvYmopID0+IHtcclxuICAgICAgICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG9iaikgPT09ICdbb2JqZWN0IEFycmF5XScgPyB0cnVlIDogZmFsc2VcclxuICAgIH0sXHJcblxyXG4gICAgYXJyYXlDbG9uZTogKGFycikgPT4ge1xyXG4gICAgICAgIHJldHVybiBhcnIuc2xpY2UoMClcclxuICAgIH0sXHJcblxyXG4gICAgaXNGdW5jdGlvbjogKG9iaikgPT4ge1xyXG4gICAgICAgIHJldHVybiB0eXBlb2Ygb2JqID09PSAnZnVuY3Rpb24nID8gdHJ1ZSA6IGZhbHNlXHJcbiAgICB9LFxyXG5cclxuICAgIGlzSW50ZWdlcjogKHZhbHVlKSA9PiB7XHJcbiAgICAgICAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicgJiZcclxuICAgICAgICAgICAgaXNGaW5pdGUodmFsdWUpICYmXHJcbiAgICAgICAgICAgIE1hdGguZmxvb3IodmFsdWUpID09PSB2YWx1ZTtcclxuICAgIH0sXHJcblxyXG4gICAgc3RvcmFnZUF2YWlsYWJsZTogKHR5cGUpID0+IHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICB2YXIgc3RvcmFnZSA9IHdpbmRvd1t0eXBlXSwgeCA9ICdfX3N0b3JhZ2VfdGVzdF9fJ1xyXG4gICAgICAgICAgICBzdG9yYWdlLnNldEl0ZW0oeCwgeClcclxuICAgICAgICAgICAgc3RvcmFnZS5yZW1vdmVJdGVtKHgpXHJcbiAgICAgICAgICAgIHJldHVybiB0cnVlXHJcbiAgICAgICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICAgICAgICByZXR1cm4gZSBpbnN0YW5jZW9mIERPTUV4Y2VwdGlvbiAmJiAoZS5jb2RlID09PSAyMiB8fCBlLmNvZGUgPT09IDEwMTQgfHwgZS5uYW1lID09PSAnUXVvdGFFeGNlZWRlZEVycm9yJyB8fCBlLm5hbWUgPT09ICdOU19FUlJPUl9ET01fUVVPVEFfUkVBQ0hFRCcpICYmIHN0b3JhZ2UubGVuZ3RoICE9PSAwXHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59OyIsIu+7vyd1c2Ugc3RyaWN0J1xyXG5cclxudmFyIHV0aWxzID0ge31cclxuXHJcbnZhciBlbnVtZXJhdGUgPSBmdW5jdGlvbiAob2JqKSB7XHJcbiAgICBmb3IgKHZhciBwcm9wZXJ0eSBpbiBvYmopIHtcclxuICAgICAgICBpZiAob2JqLmhhc093blByb3BlcnR5KHByb3BlcnR5KSkge1xyXG4gICAgICAgICAgICB1dGlsc1twcm9wZXJ0eV0gPSBvYmpbcHJvcGVydHldXHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59XHJcblxyXG5lbnVtZXJhdGUocmVxdWlyZSgnLi9udW1iZXJzLmpzJykpXHJcbmVudW1lcmF0ZShyZXF1aXJlKCcuL3Rvb2xzLmpzJykpXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHV0aWxzXHJcbiJdfQ==
