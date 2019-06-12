!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{("undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof self?self:this).App=e()}}(function(){return function a(s,o,c){function u(t,e){if(!o[t]){if(!s[t]){var n="function"==typeof require&&require;if(!e&&n)return n(t,!0);if(l)return l(t,!0);var i=new Error("Cannot find module '"+t+"'");throw i.code="MODULE_NOT_FOUND",i}var r=o[t]={exports:{}};s[t][0].call(r.exports,function(e){return u(s[t][1][e]||e)},r,r.exports,a,s,o,c)}return o[t].exports}for(var l="function"==typeof require&&require,e=0;e<c.length;e++)u(c[e]);return u}({1:[function(e,t,n){t.exports=e("./lib/axios")},{"./lib/axios":3}],2:[function(l,e,t){"use strict";var p=l("./../utils"),d=l("./../core/settle"),f=l("./../helpers/buildURL"),h=l("./../helpers/parseHeaders"),m=l("./../helpers/isURLSameOrigin"),v=l("../core/createError");e.exports=function(u){return new Promise(function(n,i){var r=u.data,a=u.headers;p.isFormData(r)&&delete a["Content-Type"];var s=new XMLHttpRequest;if(u.auth){var e=u.auth.username||"",t=u.auth.password||"";a.Authorization="Basic "+btoa(e+":"+t)}if(s.open(u.method.toUpperCase(),f(u.url,u.params,u.paramsSerializer),!0),s.timeout=u.timeout,s.onreadystatechange=function(){if(s&&4===s.readyState&&(0!==s.status||s.responseURL&&0===s.responseURL.indexOf("file:"))){var e="getAllResponseHeaders"in s?h(s.getAllResponseHeaders()):null,t={data:u.responseType&&"text"!==u.responseType?s.response:s.responseText,status:s.status,statusText:s.statusText,headers:e,config:u,request:s};d(n,i,t),s=null}},s.onabort=function(){s&&(i(v("Request aborted",u,"ECONNABORTED",s)),s=null)},s.onerror=function(){i(v("Network Error",u,null,s)),s=null},s.ontimeout=function(){i(v("timeout of "+u.timeout+"ms exceeded",u,"ECONNABORTED",s)),s=null},p.isStandardBrowserEnv()){var o=l("./../helpers/cookies"),c=(u.withCredentials||m(u.url))&&u.xsrfCookieName?o.read(u.xsrfCookieName):void 0;c&&(a[u.xsrfHeaderName]=c)}if("setRequestHeader"in s&&p.forEach(a,function(e,t){void 0===r&&"content-type"===t.toLowerCase()?delete a[t]:s.setRequestHeader(t,e)}),u.withCredentials&&(s.withCredentials=!0),u.responseType)try{s.responseType=u.responseType}catch(e){if("json"!==u.responseType)throw e}"function"==typeof u.onDownloadProgress&&s.addEventListener("progress",u.onDownloadProgress),"function"==typeof u.onUploadProgress&&s.upload&&s.upload.addEventListener("progress",u.onUploadProgress),u.cancelToken&&u.cancelToken.promise.then(function(e){s&&(s.abort(),i(e),s=null)}),void 0===r&&(r=null),s.send(r)})}},{"../core/createError":9,"./../core/settle":13,"./../helpers/buildURL":17,"./../helpers/cookies":19,"./../helpers/isURLSameOrigin":21,"./../helpers/parseHeaders":23,"./../utils":25}],3:[function(e,t,n){"use strict";var i=e("./utils"),r=e("./helpers/bind"),a=e("./core/Axios"),s=e("./core/mergeConfig");function o(e){var t=new a(e),n=r(a.prototype.request,t);return i.extend(n,a.prototype,t),i.extend(n,t),n}var c=o(e("./defaults"));c.Axios=a,c.create=function(e){return o(s(c.defaults,e))},c.Cancel=e("./cancel/Cancel"),c.CancelToken=e("./cancel/CancelToken"),c.isCancel=e("./cancel/isCancel"),c.all=function(e){return Promise.all(e)},c.spread=e("./helpers/spread"),t.exports=c,t.exports.default=c},{"./cancel/Cancel":4,"./cancel/CancelToken":5,"./cancel/isCancel":6,"./core/Axios":7,"./core/mergeConfig":12,"./defaults":15,"./helpers/bind":16,"./helpers/spread":24,"./utils":25}],4:[function(e,t,n){"use strict";function i(e){this.message=e}i.prototype.toString=function(){return"Cancel"+(this.message?": "+this.message:"")},i.prototype.__CANCEL__=!0,t.exports=i},{}],5:[function(e,t,n){"use strict";var i=e("./Cancel");function r(e){if("function"!=typeof e)throw new TypeError("executor must be a function.");var t;this.promise=new Promise(function(e){t=e});var n=this;e(function(e){n.reason||(n.reason=new i(e),t(n.reason))})}r.prototype.throwIfRequested=function(){if(this.reason)throw this.reason},r.source=function(){var t;return{token:new r(function(e){t=e}),cancel:t}},t.exports=r},{"./Cancel":4}],6:[function(e,t,n){"use strict";t.exports=function(e){return!(!e||!e.__CANCEL__)}},{}],7:[function(e,t,n){"use strict";var r=e("./../utils"),i=e("../helpers/buildURL"),a=e("./InterceptorManager"),s=e("./dispatchRequest"),o=e("./mergeConfig");function c(e){this.defaults=e,this.interceptors={request:new a,response:new a}}c.prototype.request=function(e,t){"string"==typeof e?(e=t||{}).url=arguments[0]:e=e||{},(e=o(this.defaults,e)).method=e.method?e.method.toLowerCase():"get";var n=[s,void 0],i=Promise.resolve(e);for(this.interceptors.request.forEach(function(e){n.unshift(e.fulfilled,e.rejected)}),this.interceptors.response.forEach(function(e){n.push(e.fulfilled,e.rejected)});n.length;)i=i.then(n.shift(),n.shift());return i},c.prototype.getUri=function(e){return e=o(this.defaults,e),i(e.url,e.params,e.paramsSerializer).replace(/^\?/,"")},r.forEach(["delete","get","head","options"],function(n){c.prototype[n]=function(e,t){return this.request(r.merge(t||{},{method:n,url:e}))}}),r.forEach(["post","put","patch"],function(i){c.prototype[i]=function(e,t,n){return this.request(r.merge(n||{},{method:i,url:e,data:t}))}}),t.exports=c},{"../helpers/buildURL":17,"./../utils":25,"./InterceptorManager":8,"./dispatchRequest":10,"./mergeConfig":12}],8:[function(e,t,n){"use strict";var i=e("./../utils");function r(){this.handlers=[]}r.prototype.use=function(e,t){return this.handlers.push({fulfilled:e,rejected:t}),this.handlers.length-1},r.prototype.eject=function(e){this.handlers[e]&&(this.handlers[e]=null)},r.prototype.forEach=function(t){i.forEach(this.handlers,function(e){null!==e&&t(e)})},t.exports=r},{"./../utils":25}],9:[function(e,t,n){"use strict";var s=e("./enhanceError");t.exports=function(e,t,n,i,r){var a=new Error(e);return s(a,t,n,i,r)}},{"./enhanceError":11}],10:[function(e,t,n){"use strict";var i=e("./../utils"),r=e("./transformData"),a=e("../cancel/isCancel"),s=e("../defaults"),o=e("./../helpers/isAbsoluteURL"),c=e("./../helpers/combineURLs");function u(e){e.cancelToken&&e.cancelToken.throwIfRequested()}t.exports=function(t){return u(t),t.baseURL&&!o(t.url)&&(t.url=c(t.baseURL,t.url)),t.headers=t.headers||{},t.data=r(t.data,t.headers,t.transformRequest),t.headers=i.merge(t.headers.common||{},t.headers[t.method]||{},t.headers||{}),i.forEach(["delete","get","head","post","put","patch","common"],function(e){delete t.headers[e]}),(t.adapter||s.adapter)(t).then(function(e){return u(t),e.data=r(e.data,e.headers,t.transformResponse),e},function(e){return a(e)||(u(t),e&&e.response&&(e.response.data=r(e.response.data,e.response.headers,t.transformResponse))),Promise.reject(e)})}},{"../cancel/isCancel":6,"../defaults":15,"./../helpers/combineURLs":18,"./../helpers/isAbsoluteURL":20,"./../utils":25,"./transformData":14}],11:[function(e,t,n){"use strict";t.exports=function(e,t,n,i,r){return e.config=t,n&&(e.code=n),e.request=i,e.response=r,e.isAxiosError=!0,e.toJSON=function(){return{message:this.message,name:this.name,description:this.description,number:this.number,fileName:this.fileName,lineNumber:this.lineNumber,columnNumber:this.columnNumber,stack:this.stack,config:this.config,code:this.code}},e}},{}],12:[function(e,t,n){"use strict";var r=e("../utils");t.exports=function(t,n){n=n||{};var i={};return r.forEach(["url","method","params","data"],function(e){void 0!==n[e]&&(i[e]=n[e])}),r.forEach(["headers","auth","proxy"],function(e){r.isObject(n[e])?i[e]=r.deepMerge(t[e],n[e]):void 0!==n[e]?i[e]=n[e]:r.isObject(t[e])?i[e]=r.deepMerge(t[e]):void 0!==t[e]&&(i[e]=t[e])}),r.forEach(["baseURL","transformRequest","transformResponse","paramsSerializer","timeout","withCredentials","adapter","responseType","xsrfCookieName","xsrfHeaderName","onUploadProgress","onDownloadProgress","maxContentLength","validateStatus","maxRedirects","httpAgent","httpsAgent","cancelToken","socketPath"],function(e){void 0!==n[e]?i[e]=n[e]:void 0!==t[e]&&(i[e]=t[e])}),i}},{"../utils":25}],13:[function(e,t,n){"use strict";var r=e("./createError");t.exports=function(e,t,n){var i=n.config.validateStatus;!i||i(n.status)?e(n):t(r("Request failed with status code "+n.status,n.config,null,n.request,n))}},{"./createError":9}],14:[function(e,t,n){"use strict";var i=e("./../utils");t.exports=function(t,n,e){return i.forEach(e,function(e){t=e(t,n)}),t}},{"./../utils":25}],15:[function(o,c,e){(function(e){"use strict";var n=o("./utils"),i=o("./helpers/normalizeHeaderName"),t={"Content-Type":"application/x-www-form-urlencoded"};function r(e,t){!n.isUndefined(e)&&n.isUndefined(e["Content-Type"])&&(e["Content-Type"]=t)}var a,s={adapter:(void 0!==e&&"[object process]"===Object.prototype.toString.call(e)?a=o("./adapters/http"):"undefined"!=typeof XMLHttpRequest&&(a=o("./adapters/xhr")),a),transformRequest:[function(e,t){return i(t,"Accept"),i(t,"Content-Type"),n.isFormData(e)||n.isArrayBuffer(e)||n.isBuffer(e)||n.isStream(e)||n.isFile(e)||n.isBlob(e)?e:n.isArrayBufferView(e)?e.buffer:n.isURLSearchParams(e)?(r(t,"application/x-www-form-urlencoded;charset=utf-8"),e.toString()):n.isObject(e)?(r(t,"application/json;charset=utf-8"),JSON.stringify(e)):e}],transformResponse:[function(e){if("string"==typeof e)try{e=JSON.parse(e)}catch(e){}return e}],timeout:0,xsrfCookieName:"XSRF-TOKEN",xsrfHeaderName:"X-XSRF-TOKEN",maxContentLength:-1,validateStatus:function(e){return 200<=e&&e<300}};s.headers={common:{Accept:"application/json, text/plain, */*"}},n.forEach(["delete","get","head"],function(e){s.headers[e]={}}),n.forEach(["post","put","patch"],function(e){s.headers[e]=n.merge(t)}),c.exports=s}).call(this,o("_process"))},{"./adapters/http":2,"./adapters/xhr":2,"./helpers/normalizeHeaderName":22,"./utils":25,_process:27}],16:[function(e,t,n){"use strict";t.exports=function(n,i){return function(){for(var e=new Array(arguments.length),t=0;t<e.length;t++)e[t]=arguments[t];return n.apply(i,e)}}},{}],17:[function(e,t,n){"use strict";var s=e("./../utils");function o(e){return encodeURIComponent(e).replace(/%40/gi,"@").replace(/%3A/gi,":").replace(/%24/g,"$").replace(/%2C/gi,",").replace(/%20/g,"+").replace(/%5B/gi,"[").replace(/%5D/gi,"]")}t.exports=function(e,t,n){if(!t)return e;var i;if(n)i=n(t);else if(s.isURLSearchParams(t))i=t.toString();else{var r=[];s.forEach(t,function(e,t){null!=e&&(s.isArray(e)?t+="[]":e=[e],s.forEach(e,function(e){s.isDate(e)?e=e.toISOString():s.isObject(e)&&(e=JSON.stringify(e)),r.push(o(t)+"="+o(e))}))}),i=r.join("&")}if(i){var a=e.indexOf("#");-1!==a&&(e=e.slice(0,a)),e+=(-1===e.indexOf("?")?"?":"&")+i}return e}},{"./../utils":25}],18:[function(e,t,n){"use strict";t.exports=function(e,t){return t?e.replace(/\/+$/,"")+"/"+t.replace(/^\/+/,""):e}},{}],19:[function(e,t,n){"use strict";var o=e("./../utils");t.exports=o.isStandardBrowserEnv()?{write:function(e,t,n,i,r,a){var s=[];s.push(e+"="+encodeURIComponent(t)),o.isNumber(n)&&s.push("expires="+new Date(n).toGMTString()),o.isString(i)&&s.push("path="+i),o.isString(r)&&s.push("domain="+r),!0===a&&s.push("secure"),document.cookie=s.join("; ")},read:function(e){var t=document.cookie.match(new RegExp("(^|;\\s*)("+e+")=([^;]*)"));return t?decodeURIComponent(t[3]):null},remove:function(e){this.write(e,"",Date.now()-864e5)}}:{write:function(){},read:function(){return null},remove:function(){}}},{"./../utils":25}],20:[function(e,t,n){"use strict";t.exports=function(e){return/^([a-z][a-z\d\+\-\.]*:)?\/\//i.test(e)}},{}],21:[function(e,t,n){"use strict";var i,r,a,s=e("./../utils");function o(e){var t=e;return r&&(a.setAttribute("href",t),t=a.href),a.setAttribute("href",t),{href:a.href,protocol:a.protocol?a.protocol.replace(/:$/,""):"",host:a.host,search:a.search?a.search.replace(/^\?/,""):"",hash:a.hash?a.hash.replace(/^#/,""):"",hostname:a.hostname,port:a.port,pathname:"/"===a.pathname.charAt(0)?a.pathname:"/"+a.pathname}}t.exports=s.isStandardBrowserEnv()?(r=/(msie|trident)/i.test(navigator.userAgent),a=document.createElement("a"),i=o(window.location.href),function(e){var t=s.isString(e)?o(e):e;return t.protocol===i.protocol&&t.host===i.host}):function(){return!0}},{"./../utils":25}],22:[function(e,t,n){"use strict";var r=e("../utils");t.exports=function(n,i){r.forEach(n,function(e,t){t!==i&&t.toUpperCase()===i.toUpperCase()&&(n[i]=e,delete n[t])})}},{"../utils":25}],23:[function(e,t,n){"use strict";var a=e("./../utils"),s=["age","authorization","content-length","content-type","etag","expires","from","host","if-modified-since","if-unmodified-since","last-modified","location","max-forwards","proxy-authorization","referer","retry-after","user-agent"];t.exports=function(e){var t,n,i,r={};return e&&a.forEach(e.split("\n"),function(e){if(i=e.indexOf(":"),t=a.trim(e.substr(0,i)).toLowerCase(),n=a.trim(e.substr(i+1)),t){if(r[t]&&0<=s.indexOf(t))return;r[t]="set-cookie"===t?(r[t]?r[t]:[]).concat([n]):r[t]?r[t]+", "+n:n}}),r}},{"./../utils":25}],24:[function(e,t,n){"use strict";t.exports=function(t){return function(e){return t.apply(null,e)}}},{}],25:[function(e,t,n){"use strict";var r=e("./helpers/bind"),i=e("is-buffer"),a=Object.prototype.toString;function s(e){return"[object Array]"===a.call(e)}function o(e){return null!==e&&"object"==typeof e}function c(e){return"[object Function]"===a.call(e)}function u(e,t){if(null!=e)if("object"!=typeof e&&(e=[e]),s(e))for(var n=0,i=e.length;n<i;n++)t.call(null,e[n],n,e);else for(var r in e)Object.prototype.hasOwnProperty.call(e,r)&&t.call(null,e[r],r,e)}t.exports={isArray:s,isArrayBuffer:function(e){return"[object ArrayBuffer]"===a.call(e)},isBuffer:i,isFormData:function(e){return"undefined"!=typeof FormData&&e instanceof FormData},isArrayBufferView:function(e){return"undefined"!=typeof ArrayBuffer&&ArrayBuffer.isView?ArrayBuffer.isView(e):e&&e.buffer&&e.buffer instanceof ArrayBuffer},isString:function(e){return"string"==typeof e},isNumber:function(e){return"number"==typeof e},isObject:o,isUndefined:function(e){return void 0===e},isDate:function(e){return"[object Date]"===a.call(e)},isFile:function(e){return"[object File]"===a.call(e)},isBlob:function(e){return"[object Blob]"===a.call(e)},isFunction:c,isStream:function(e){return o(e)&&c(e.pipe)},isURLSearchParams:function(e){return"undefined"!=typeof URLSearchParams&&e instanceof URLSearchParams},isStandardBrowserEnv:function(){return("undefined"==typeof navigator||"ReactNative"!==navigator.product&&"NativeScript"!==navigator.product&&"NS"!==navigator.product)&&("undefined"!=typeof window&&"undefined"!=typeof document)},forEach:u,merge:function n(){var i={};function e(e,t){"object"==typeof i[t]&&"object"==typeof e?i[t]=n(i[t],e):i[t]=e}for(var t=0,r=arguments.length;t<r;t++)u(arguments[t],e);return i},deepMerge:function n(){var i={};function e(e,t){"object"==typeof i[t]&&"object"==typeof e?i[t]=n(i[t],e):i[t]="object"==typeof e?n({},e):e}for(var t=0,r=arguments.length;t<r;t++)u(arguments[t],e);return i},extend:function(n,e,i){return u(e,function(e,t){n[t]=i&&"function"==typeof e?r(e,i):e}),n},trim:function(e){return e.replace(/^\s*/,"").replace(/\s*$/,"")}}},{"./helpers/bind":16,"is-buffer":26}],26:[function(e,t,n){t.exports=function(e){return null!=e&&null!=e.constructor&&"function"==typeof e.constructor.isBuffer&&e.constructor.isBuffer(e)}},{}],27:[function(e,t,n){var i,r,a=t.exports={};function s(){throw new Error("setTimeout has not been defined")}function o(){throw new Error("clearTimeout has not been defined")}function c(t){if(i===setTimeout)return setTimeout(t,0);if((i===s||!i)&&setTimeout)return i=setTimeout,setTimeout(t,0);try{return i(t,0)}catch(e){try{return i.call(null,t,0)}catch(e){return i.call(this,t,0)}}}!function(){try{i="function"==typeof setTimeout?setTimeout:s}catch(e){i=s}try{r="function"==typeof clearTimeout?clearTimeout:o}catch(e){r=o}}();var u,l=[],p=!1,d=-1;function f(){p&&u&&(p=!1,u.length?l=u.concat(l):d=-1,l.length&&h())}function h(){if(!p){var e=c(f);p=!0;for(var t=l.length;t;){for(u=l,l=[];++d<t;)u&&u[d].run();d=-1,t=l.length}u=null,p=!1,function(t){if(r===clearTimeout)return clearTimeout(t);if((r===o||!r)&&clearTimeout)return r=clearTimeout,clearTimeout(t);try{r(t)}catch(e){try{return r.call(null,t)}catch(e){return r.call(this,t)}}}(e)}}function m(e,t){this.fun=e,this.array=t}function v(){}a.nextTick=function(e){var t=new Array(arguments.length-1);if(1<arguments.length)for(var n=1;n<arguments.length;n++)t[n-1]=arguments[n];l.push(new m(e,t)),1!==l.length||p||c(h)},m.prototype.run=function(){this.fun.apply(null,this.array)},a.title="browser",a.browser=!0,a.env={},a.argv=[],a.version="",a.versions={},a.on=v,a.addListener=v,a.once=v,a.off=v,a.removeListener=v,a.removeAllListeners=v,a.emit=v,a.prependListener=v,a.prependOnceListener=v,a.listeners=function(e){return[]},a.binding=function(e){throw new Error("process.binding is not supported")},a.cwd=function(){return"/"},a.chdir=function(e){throw new Error("process.chdir is not supported")},a.umask=function(){return 0}},{}],28:[function(e,t,n){"use strict";var r=e("./storage.js"),s=e("../dnd/player.js"),o=e("../dnd/npc.js"),c=[],u=[],l=0,p=function(e){if(Utils.isFunction(e)){for(var t={npcs:[],players:[]},n=0,i=u.length;n<i;n++)t.npcs.push(u[n].serialize());for(n=0,i=c.length;n<i;n++)t.players.push(c[n].serialize());r.push(t,e)}};t.exports={pull:function(a){Utils.isFunction(a)&&r.pull(function(e){c.length=0;for(var t=u.length=0,n=e.players.length;t<n;t++){"number"!=typeof e.players[t].id&&(l++,e.players[t].id=l);var i=new s;i.parse(e.players[t]),c.push(i)}for(t=0,n=e.npcs.length;t<n;t++){"number"!=typeof e.npcs[t].id&&(l++,e.npcs[t].id=l);var r=new o;r.parse(e.npcs[t]),u.push(r)}a.apply(this)&&p(a)})},push:p,reset:function(e){Utils.isFunction(e)&&r.reset(e)},charsByState:function(e,t){if(Utils.isFunction(t)){for(var n=[],i=0,r=c.length;i<r;i++)c[i].state===e&&n.push(c[i]);for(i=0,r=u.length;i<r;i++)u[i].state===e&&n.push(u[i]);e===CharacterState.Encounter&&n.sort(function(e,t){return t.initiative-e.initiative});for(i=0,r=n.length;i<r;i++)t.call(n[i])}},updatePlayer:function(e,t,n){var i=function(e){var t=null;if(Utils.isNumeric(e))for(var n=0,i=c.length;n<i;n++)if(c[n].id===e){t=c[n];break}return t}(e);if(i)switch(t){case CharacterAction.Initiative:i.applyInitiative(n[0]);break;case CharacterAction.Leave:i.leaveEncounter();break;case CharacterAction.Revive:i.revive();break;case CharacterAction.Die:i.die()}},updateNpc:function(e,t,n){var i=function(e){var t=null;if(Utils.isNumeric(e))for(var n=0,i=u.length;n<i;n++)if(u[n].id===e){t=u[n];break}return t}(e);if(i)switch(t){case CharacterAction.Damage:i.applyDamage(n[0]);break;case CharacterAction.Initiative:if(i.template){var r=i.clone();!function(e){"number"==typeof e.id&&0!==e.id||(l++,e.id=l),u.push(e)}(r),i=r}i.rollInitiative();break;case CharacterAction.Leave:i.leaveEncounter();break;case CharacterAction.Revive:i.revive();break;case CharacterAction.Die:i.die()}}}},{"../dnd/npc.js":33,"../dnd/player.js":34,"./storage.js":29}],29:[function(e,t,n){(function(i){"use strict";var r=e("axios"),a="OssariaSessionTwo",s=function(e){localStorage.setItem(a,e)};t.exports={pull:function(e){var t=!1;if(Utils.isFunction(e)){var n=localStorage.getItem(a);n?e.apply(this,[JSON.parse(n)]):(function(t){r.get(i.DataFile).then(function(e){s(JSON.stringify(e.data)),t.apply(this,[e.data])}).catch(function(e){Debug.warn(e)})}(e),t=!0)}return t},push:function(e,t){Utils.isFunction(t)&&(s(JSON.stringify(e)),t.apply(this))},reset:function(e){Utils.isFunction(e)&&(localStorage.removeItem(a),e.apply(this))}}}).call(this,"undefined"!=typeof global?global:"undefined"!=typeof self?self:"undefined"!=typeof window?window:{})},{axios:1}],30:[function(e,t,n){"use strict";function i(){document.addEventListener("click",function(e){if(e.target){var t=!0,n=parseInt(e.target.getAttribute("data-id"));switch(e.target.className){case"hard_reset":if(t=!1,confirm("Are you sure? This cannot be undone.")){var i=document.getElementById("main-content");s.reset(function(){i.innerHTML="resetting up in here",setTimeout(function(){window.location.reload()},600)})}break;case"player_initiative":var r=parseInt(document.getElementById("player_initiative_"+n).value);s.updatePlayer(n,CharacterAction.Initiative,[r]);break;case"player_leave":s.updatePlayer(n,CharacterAction.Leave);break;case"player_revive":s.updatePlayer(n,CharacterAction.Revive);break;case"player_die":s.updatePlayer(n,CharacterAction.Die);break;case"npc_initiative":s.updateNpc(n,CharacterAction.Initiative);break;case"npc_damage":var a=parseInt(document.getElementById("npc_damage_"+n).value);s.updateNpc(n,CharacterAction.Damage,[a]);break;case"npc_leave":s.updateNpc(n,CharacterAction.Leave);break;case"npc_revive":s.updateNpc(n,CharacterAction.Revive);break;case"npc_die":s.updateNpc(n,CharacterAction.Die);break;default:t=!1}t&&s.push(function(){c()})}})}var s=e("./entities.js"),r=document.getElementById("active"),a=document.getElementById("inactive"),o=document.getElementById("deadguys"),c=function(){r.innerHTML="",a.innerHTML="",o.innerHTML="",s.charsByState(CharacterState.Encounter,function(){var e=document.createElement("tr"),t=document.createElement("td");t.innerHTML=this.render(),e.appendChild(t),r.appendChild(e)}),s.charsByState(CharacterState.Idle,function(){var e=document.createElement("tr"),t=document.createElement("td");t.innerHTML=this.render(),e.appendChild(t),a.appendChild(e)}),s.charsByState(CharacterState.Dead,function(){var e=document.createElement("tr"),t=document.createElement("td");t.innerHTML=this.render(),e.appendChild(t),o.appendChild(e)})};t.exports={run:function(){i(),s.pull(function(){c()})}}},{"./entities.js":28}],31:[function(e,t,n){(function(e){"use strict";e.CharacterState={Dead:"dead",Idle:"alive",Encounter:"encounter"},e.CharacterAction={Damage:"damage",Die:"die",Initiative:"initiative",Leave:"leave",Revive:"revive"},e.DamageType={Acid:"acid",Bludgeoning:"bludgeoning",Cold:"cold",Fire:"fire",Force:"force",Lightning:"lightning",Necrotic:"necrotic",Piercing:"piercing",Poison:"poison",Psychic:"psychic",Radiant:"radiant",Slashing:"slashing",Thunder:"thunder"},t.exports=null}).call(this,"undefined"!=typeof global?global:"undefined"!=typeof self?self:"undefined"!=typeof window?window:{})},{}],32:[function(e,t,n){"use strict";t.exports={d4:function(){return Utils.randomInt(1,4)},d6:function(){return Utils.randomInt(1,6)},d8:function(){return Utils.randomInt(1,8)},d10:function(){return Utils.randomInt(1,10)},d12:function(){return Utils.randomInt(1,12)},d20:function(){return Utils.randomInt(1,20)},d100:function(){return Utils.randomInt(1,100)}}},{}],33:[function(e,t,n){"use strict";function i(){this.id=0,this.name="",this.health=5,this.armor=10,this.speed=15,this.race="Human",this.initiative=0,this.weapons=[],this.state=CharacterState.Idle,this.link="",this.initMod=0,this.template=!1,this.instance=0}var r=e("./weapon.js"),a=e("../dnd/dice.js");i.prototype.parse=function(e){if(e){if(e.id&&Utils.isNumeric(e.id)&&(this.id=e.id),e.name&&(this.name=e.name),e.health&&Utils.isNumeric(e.health)&&(this.health=e.health),e.armor&&Utils.isNumeric(e.armor)&&(this.armor=e.armor),e.speed&&Utils.isNumeric(e.speed)&&(this.speed=e.speed),e.race&&(this.race=e.race),e.initiative&&Utils.isNumeric(e.initiative)&&(this.initiative=e.initiative),e.state&&(this.state=e.state),e.weapons&&Utils.isArray(e.weapons))for(var t=0,n=e.weapons.length;t<n;t++){var i=new r;i.parse(e.weapons[t]),this.weapons.push(i)}e.link&&(this.link=e.link),e.template&&(this.template=e.template),e.initMod&&Utils.isNumeric(e.initMod)&&(this.initMod=e.initMod)}},i.prototype.serialize=function(){for(var e=[],t=0,n=this.weapons.length;t<n;t++)e.push(this.weapons[t].serialize());return{id:this.id,name:this.name,health:this.health,armor:this.armor,speed:this.speed,race:this.race,initiative:this.initiative,weapons:e,state:this.state,link:this.link,initMod:this.initMod,template:this.template,instance:this.instance}},i.prototype.render=function(){var e="<div class='ent npc' data-id='"+this.id+"'>";e+="<div><span class='bold'>"+this.name+"</span>, <span class='italic'>"+this.race+"</span>. Speed: "+this.speed+"</div>";var t="";this.state===CharacterState.Encounter&&(t=" ("+(0<this.health?"alive":"dead")+"), Initiative: <span class='bold'>"+this.initiative+"</span>"),e+="<div>Health: <span class='bold'>"+this.health+"</span>, AC: <span class='bold'>"+this.armor+"</span>"+t+"</div>";for(var n=0,i=this.weapons.length;n<i;n++)e+="<div>"+this.weapons[n].render()+"</div>";return this.state===CharacterState.Encounter?(e+="<div><input type='button' class='npc_damage' value='Apply Damage' data-id='"+this.id+"' /><input type='text' id='npc_damage_"+this.id+"' /></div>",e+="<div style='margin-top: 4px;'>",e+="<input type='button' class='npc_leave' value='Leave Encounter' data-id='"+this.id+"' />&nbsp;",e+="<input type='button' class='npc_die' value='Die' data-id='"+this.id+"' />",e+="</div>"):this.state===CharacterState.Idle?(e+="<div>",e+="<input type='button' class='npc_initiative' value='Roll Initiative' data-id='"+this.id+"' />",this.template||(e+="&nbsp;<input type='button' class='npc_die' value='Die' data-id='"+this.id+"' />"),e+="</div>"):this.state===CharacterState.Dead&&(e+="<div><input type='button' class='npc_revive' value='Revive NPC' data-id='"+this.id+"' /></div>"),this.link&&(e+="<div><a href='"+this.link+"' target='_blank'>D&D Beyond</a></div>"),e+="</div>"},i.prototype.rollInitiative=function(){this.state=CharacterState.Encounter,this.initiative=a.d20()+this.initMod},i.prototype.applyDamage=function(e){this.health-=e,this.health<=0&&(this.health=0,this.state=CharacterState.Dead)},i.prototype.revive=function(){this.health=1,this.state=CharacterState.Encounter},i.prototype.leaveEncounter=function(){this.initiative=0,this.state=CharacterState.Idle},i.prototype.die=function(){this.health=0,this.state=CharacterState.Dead},i.prototype.clone=function(){var e=new i;return this.instance++,e.name=this.name+" #"+this.instance,e.health=this.health,e.armor=this.armor,e.speed=this.speed,e.race=this.race,e.weapons=Utils.arrayClone(this.weapons),e.link=this.link,e.initMod=this.initMod,e},t.exports=i},{"../dnd/dice.js":32,"./weapon.js":35}],34:[function(e,t,n){"use strict";function i(){this.id=0,this.name="",this.player="",this.initiative=0,this.state=CharacterState.Idle,this.exhaustion=0,this.link=""}i.prototype.parse=function(e){e&&(e.id&&Utils.isNumeric(e.id)&&(this.id=e.id),e.name&&(this.name=e.name),e.player&&(this.player=e.player),e.initiative&&Utils.isNumeric(e.initiative)&&(this.initiative=e.initiative),e.state&&(this.state=e.state),e.exhaustion&&Utils.isNumeric(e.exhaustion)&&(this.exhaustion=Utils.clamp(e.exhaustion,1,6),6==this.exhaustion&&(this.state=CharacterState.Dead)),e.link&&(this.link=e.link))},i.prototype.serialize=function(){return{id:this.id,name:this.name,initiative:this.initiative,state:this.state,exhaustion:this.exhaustion,link:this.link}},i.prototype.render=function(){var e="<div class='ent player' data-id='"+this.id+"'>";return e+="<div><span class='bold'>"+this.name+"</span> <span class='italics'>"+this.player+"</span></div>",this.state===CharacterState.Encounter?(e+="<div>Initiative: <span class='bold'>"+this.initiative+"</span></div>",e+="<div>",e+="<input type='button' class='player_leave' value='Leave Encounter' data-id='"+this.id+"' style='margin-right:5px' />",e+="<input type='button' class='player_die' value='Die' data-id='"+this.id+"' />",e+="</div>"):this.state===CharacterState.Idle?(e+="<div>",e+="<input type='button' class='player_initiative' value='Apply Initiatve' data-id='"+this.id+"' /><input type='text' id='player_initiative_"+this.id+"' />",e+="<input type='button' class='player_die' value='Die' data-id='"+this.id+"' />",e+="</div>"):this.state===CharacterState.Dead&&(e+="<div><input type='button' class='player_revive' value='Revive Player' data-id='"+this.id+"' /></div>"),this.link&&(e+="<div><a href='"+this.link+"' target='_blank'>D&D Beyond</a></div>"),e+="</div>"},i.prototype.applyInitiative=function(e){this.initiative=e,this.state=CharacterState.Encounter},i.prototype.leaveEncounter=function(){this.initiative=0,this.state=CharacterState.Idle},i.prototype.revive=function(){this.state=CharacterState.Encounter},i.prototype.die=function(){this.state=CharacterState.Dead},t.exports=i},{}],35:[function(e,t,n){"use strict";function i(){this.name="",this.dice="1d4",this.hitMod=0,this.attackMod=0,this.damageType=DamageType.Bludgeoning}i.prototype.parse=function(e){e&&(e.name&&(this.name=e.name),e.dice&&(this.dice=e.dice),e.hitMod&&Utils.isNumeric(e.hitMod)&&(this.hitMod=Utils.clamp(e.hitMod,0,999)),e.attackMod&&Utils.isNumeric(e.attackMod)&&(this.attackMod=Utils.clamp(e.attackMod,0,999)),e.damageType&&(this.damageType=e.damageType))},i.prototype.serialize=function(){return{name:this.name,dice:this.dice,hitMod:this.hitMod,attackMod:this.attackMod,damageType:this.damageType}},i.prototype.render=function(){var e="<span class='bold'>"+this.name+"</span>: 1d20";return 0<this.hitMod&&(e+=" + "+this.hitMod),e+=" to hit, "+this.dice,0<this.attackMod&&(e+=" + "+this.attackMod),e+=", <span class='italic'>"+this.damageType+"</span>"},t.exports=i},{}],36:[function(n,i,e){(function(e){"use strict";e.Debug=n("./utils/debug.js"),e.Utils=n("./utils/utils.js"),n("./dnd/constants.js"),e.DataFile="/json/state.json";var t=n("./app/ui.js");i.exports={run:t.run}}).call(this,"undefined"!=typeof global?global:"undefined"!=typeof self?self:"undefined"!=typeof window?window:{})},{"./app/ui.js":30,"./dnd/constants.js":31,"./utils/debug.js":37,"./utils/utils.js":40}],37:[function(e,t,n){"use strict";t.exports={assert:console?console.assert.bind(console):function(){},clear:console?console.clear.bind(console):function(){},error:console?console.error.bind(console):function(){},group:console?console.group.bind(console):function(){},groupCollapsed:console?console.groupCollapsed.bind(console):function(){},groupEnd:console?console.groupEnd.bind(console):function(){},info:console?console.info.bind(console):function(){},log:console?console.log.bind(console):function(){},trace:console?console.trace.bind(console):function(){},warn:console?console.warn.bind(console):function(){}}},{}],38:[function(e,t,n){"use strict";function i(e,t){return Math.floor(Math.random()*(t-e+1))+e}t.exports={clamp:function(e,t,n){return e<t?t:n<e?n:e},isNumeric:function(e){return!isNaN(parseFloat(e))&&isFinite(e)},randomInt:i,randomChance:function(e){return e=e||50,i(1,100)<=e}}},{}],39:[function(e,t,n){"use strict";t.exports={isArray:function(e){return"[object Array]"===Object.prototype.toString.call(e)},arrayClone:function(e){return e.slice(0)},isFunction:function(e){return"function"==typeof e},storageAvailable:function(e){try{var t=window[e],n="__storage_test__";return t.setItem(n,n),t.removeItem(n),!0}catch(e){return e instanceof DOMException&&(22===e.code||1014===e.code||"QuotaExceededError"===e.name||"NS_ERROR_DOM_QUOTA_REACHED"===e.name)&&0!==t.length}}}},{}],40:[function(e,t,n){"use strict";function i(e){for(var t in e)e.hasOwnProperty(t)&&(r[t]=e[t])}var r={};i(e("./numbers.js")),i(e("./tools.js")),t.exports=r},{"./numbers.js":38,"./tools.js":39}]},{},[36])(36)});