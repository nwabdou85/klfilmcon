(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var ReactiveDict = Package['reactive-dict'].ReactiveDict;
var Deps = Package.deps.Deps;
var _ = Package.underscore._;
var EJSON = Package.ejson.EJSON;
var WebApp = Package.webapp.WebApp;
var main = Package.webapp.main;
var WebAppInternals = Package.webapp.WebAppInternals;
var Iron = Package['iron-core'].Iron;

/* Package-scope variables */
var RouteController, Route, Router, Utils, IronRouter, hasOld, paramParts;

(function () {

///////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                   //
// packages/iron-router/lib/utils.js                                                                 //
//                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                     //
/**                                                                                                  // 1
 * Utility methods available privately to the package.                                               // 2
 */                                                                                                  // 3
                                                                                                     // 4
Utils = {};                                                                                          // 5
                                                                                                     // 6
/**                                                                                                  // 7
 * global object on node or window object in the browser.                                            // 8
 */                                                                                                  // 9
                                                                                                     // 10
Utils.global = (function () { return this; })();                                                     // 11
                                                                                                     // 12
/**                                                                                                  // 13
 * Assert that the given condition is truthy.                                                        // 14
 *                                                                                                   // 15
 * @param {Boolean} condition The boolean condition to test for truthiness.                          // 16
 * @param {String} msg The error message to show if the condition is falsy.                          // 17
 */                                                                                                  // 18
                                                                                                     // 19
Utils.assert = function (condition, msg) {                                                           // 20
  if (!condition)                                                                                    // 21
    throw new Error(msg);                                                                            // 22
};                                                                                                   // 23
                                                                                                     // 24
var warn = function (msg) {                                                                          // 25
  if (!Router || Router.options.supressWarnings !== true) {                                          // 26
    console && console.warn && console.warn(msg);                                                    // 27
  }                                                                                                  // 28
};                                                                                                   // 29
                                                                                                     // 30
Utils.warn = function (condition, msg) {                                                             // 31
  if (!condition)                                                                                    // 32
    warn(msg);                                                                                       // 33
};                                                                                                   // 34
                                                                                                     // 35
/**                                                                                                  // 36
 * deprecatation notice to the user which can be a string or object                                  // 37
 * of the form:                                                                                      // 38
 *                                                                                                   // 39
 * {                                                                                                 // 40
 *  name: 'somePropertyOrMethod',                                                                    // 41
 *  where: 'RouteController',                                                                        // 42
 *  instead: 'someOtherPropertyOrMethod',                                                            // 43
 *  message: ':name is deprecated. Please use :instead instead'                                      // 44
 * }                                                                                                 // 45
 */                                                                                                  // 46
Utils.notifyDeprecated = function (info) {                                                           // 47
  var name;                                                                                          // 48
  var instead;                                                                                       // 49
  var message;                                                                                       // 50
  var where;                                                                                         // 51
  var defaultMessage = "[:where] ':name' is deprecated. Please use ':instead' instead.";             // 52
                                                                                                     // 53
  if (_.isObject(info)) {                                                                            // 54
    name = info.name;                                                                                // 55
    instead = info.instead;                                                                          // 56
    message = info.message || defaultMessage;                                                        // 57
    where = info.where || 'IronRouter';                                                              // 58
  } else {                                                                                           // 59
    message = info;                                                                                  // 60
    name = '';                                                                                       // 61
    instead = '';                                                                                    // 62
    where = '';                                                                                      // 63
  }                                                                                                  // 64
                                                                                                     // 65
  warn(                                                                                              // 66
      '<deprecated> ' +                                                                              // 67
      message                                                                                        // 68
      .replace(':name', name)                                                                        // 69
      .replace(':instead', instead)                                                                  // 70
      .replace(':where', where) +                                                                    // 71
      ' ' +                                                                                          // 72
      (new Error).stack                                                                              // 73
  );                                                                                                 // 74
};                                                                                                   // 75
                                                                                                     // 76
Utils.withDeprecatedNotice = function (info, fn, thisArg) {                                          // 77
  return function () {                                                                               // 78
    Utils.notifyDeprecated(info);                                                                    // 79
    return fn && fn.apply(thisArg || this, arguments);                                               // 80
  };                                                                                                 // 81
};                                                                                                   // 82
                                                                                                     // 83
// so we can do this:                                                                                // 84
//   getController: function () {                                                                    // 85
//    ...                                                                                            // 86
//   }.deprecate({...})                                                                              // 87
Function.prototype.deprecate = function (info) {                                                     // 88
  var fn = this;                                                                                     // 89
  return Utils.withDeprecatedNotice(info, fn);                                                       // 90
};                                                                                                   // 91
                                                                                                     // 92
/**                                                                                                  // 93
 * Given the name of a property, resolves to the value. Works with namespacing                       // 94
 * too. If first parameter is already a value that isn't a string it's returned                      // 95
 * immediately.                                                                                      // 96
 *                                                                                                   // 97
 * Examples:                                                                                         // 98
 *  'SomeClass' => window.SomeClass || global.someClass                                              // 99
 *  'App.namespace.SomeClass' => window.App.namespace.SomeClass                                      // 100
 *                                                                                                   // 101
 * @param {String|Object} nameOrValue                                                                // 102
 */                                                                                                  // 103
                                                                                                     // 104
Utils.resolveValue = function (nameOrValue) {                                                        // 105
  var global = Utils.global;                                                                         // 106
  var parts;                                                                                         // 107
  var ptr;                                                                                           // 108
                                                                                                     // 109
  if (_.isString(nameOrValue)) {                                                                     // 110
    parts = nameOrValue.split('.')                                                                   // 111
    ptr = global;                                                                                    // 112
    for (var i = 0; i < parts.length; i++) {                                                         // 113
      ptr = ptr[parts[i]];                                                                           // 114
      if (!ptr)                                                                                      // 115
        return undefined;                                                                            // 116
    }                                                                                                // 117
  } else {                                                                                           // 118
    ptr = nameOrValue;                                                                               // 119
  }                                                                                                  // 120
                                                                                                     // 121
  // final position of ptr should be the resolved value                                              // 122
  return ptr;                                                                                        // 123
};                                                                                                   // 124
                                                                                                     // 125
Utils.hasOwnProperty = function (obj, key) {                                                         // 126
  var prop = {}.hasOwnProperty;                                                                      // 127
  return prop.call(obj, key);                                                                        // 128
};                                                                                                   // 129
                                                                                                     // 130
/**                                                                                                  // 131
 * Don't mess with this function. It's exactly the same as the compiled                              // 132
 * coffeescript mechanism. If you change it we can't guarantee that our code                         // 133
 * will work when used with Coffeescript. One exception is putting in a runtime                      // 134
 * check that both child and parent are of type Function.                                            // 135
 */                                                                                                  // 136
                                                                                                     // 137
Utils.inherits = function (child, parent) {                                                          // 138
  if (Utils.typeOf(child) !== '[object Function]')                                                   // 139
    throw new Error('First parameter to Utils.inherits must be a function');                         // 140
                                                                                                     // 141
  if (Utils.typeOf(parent) !== '[object Function]')                                                  // 142
    throw new Error('Second parameter to Utils.inherits must be a function');                        // 143
                                                                                                     // 144
  for (var key in parent) {                                                                          // 145
    if (Utils.hasOwnProperty(parent, key))                                                           // 146
      child[key] = parent[key];                                                                      // 147
  }                                                                                                  // 148
                                                                                                     // 149
  function ctor () {                                                                                 // 150
    this.constructor = child;                                                                        // 151
  }                                                                                                  // 152
                                                                                                     // 153
  ctor.prototype = parent.prototype;                                                                 // 154
  child.prototype = new ctor();                                                                      // 155
  child.__super__ = parent.prototype;                                                                // 156
  return child;                                                                                      // 157
};                                                                                                   // 158
                                                                                                     // 159
Utils.toArray = function (obj) {                                                                     // 160
  if (!obj)                                                                                          // 161
    return [];                                                                                       // 162
  else if (Utils.typeOf(obj) !== '[object Array]')                                                   // 163
    return [obj];                                                                                    // 164
  else                                                                                               // 165
    return obj;                                                                                      // 166
};                                                                                                   // 167
                                                                                                     // 168
Utils.typeOf = function (obj) {                                                                      // 169
  if (obj && obj.typeName)                                                                           // 170
    return obj.typeName;                                                                             // 171
  else                                                                                               // 172
    return Object.prototype.toString.call(obj);                                                      // 173
};                                                                                                   // 174
                                                                                                     // 175
Utils.extend = function (Super, definition, onBeforeExtendPrototype) {                               // 176
  if (arguments.length === 1)                                                                        // 177
    definition = Super;                                                                              // 178
  else {                                                                                             // 179
    definition = definition || {};                                                                   // 180
    definition.extend = Super;                                                                       // 181
  }                                                                                                  // 182
                                                                                                     // 183
  return Utils.create(definition, {                                                                  // 184
    onBeforeExtendPrototype: onBeforeExtendPrototype                                                 // 185
  });                                                                                                // 186
};                                                                                                   // 187
                                                                                                     // 188
Utils.create = function (definition, options) {                                                      // 189
  var Constructor                                                                                    // 190
    , extendFrom                                                                                     // 191
    , savedPrototype;                                                                                // 192
                                                                                                     // 193
  options = options || {};                                                                           // 194
  definition = definition || {};                                                                     // 195
                                                                                                     // 196
  if (Utils.hasOwnProperty(definition, 'constructor'))                                               // 197
    Constructor = definition.constructor;                                                            // 198
  else {                                                                                             // 199
    Constructor = function () {                                                                      // 200
      if (Constructor.__super__ && Constructor.__super__.constructor)                                // 201
        return Constructor.__super__.constructor.apply(this, arguments);                             // 202
    }                                                                                                // 203
  }                                                                                                  // 204
                                                                                                     // 205
  extendFrom = definition.extend;                                                                    // 206
                                                                                                     // 207
  if (definition.extend) delete definition.extend;                                                   // 208
                                                                                                     // 209
  var inherit = function (Child, Super, prototype) {                                                 // 210
    Utils.inherits(Child, Utils.resolveValue(Super));                                                // 211
    if (prototype) _.extend(Child.prototype, prototype);                                             // 212
  };                                                                                                 // 213
                                                                                                     // 214
  if (extendFrom) {                                                                                  // 215
    inherit(Constructor, extendFrom);                                                                // 216
  }                                                                                                  // 217
                                                                                                     // 218
  if (options.onBeforeExtendPrototype)                                                               // 219
    options.onBeforeExtendPrototype.call(Constructor, definition);                                   // 220
                                                                                                     // 221
  _.extend(Constructor.prototype, definition);                                                       // 222
                                                                                                     // 223
  return Constructor;                                                                                // 224
};                                                                                                   // 225
                                                                                                     // 226
Utils.capitalize = function (str) {                                                                  // 227
  return str.charAt(0).toUpperCase() + str.slice(1, str.length);                                     // 228
};                                                                                                   // 229
                                                                                                     // 230
Utils.upperCamelCase = function (str) {                                                              // 231
  var re = /_|-|\./;                                                                                 // 232
                                                                                                     // 233
  if (!str)                                                                                          // 234
    return '';                                                                                       // 235
                                                                                                     // 236
  return _.map(str.split(re), function (word) {                                                      // 237
    return Utils.capitalize(word);                                                                   // 238
  }).join('');                                                                                       // 239
};                                                                                                   // 240
                                                                                                     // 241
Utils.camelCase = function (str) {                                                                   // 242
  var output = Utils.upperCamelCase(str);                                                            // 243
  output = output.charAt(0).toLowerCase() + output.slice(1, output.length);                          // 244
  return output;                                                                                     // 245
};                                                                                                   // 246
                                                                                                     // 247
Utils.pick = function (/* args */) {                                                                 // 248
  var args = _.toArray(arguments)                                                                    // 249
    , arg;                                                                                           // 250
  for (var i = 0; i < args.length; i++) {                                                            // 251
    arg = args[i];                                                                                   // 252
    if (typeof arg !== 'undefined' && arg !== null)                                                  // 253
      return arg;                                                                                    // 254
  }                                                                                                  // 255
                                                                                                     // 256
  return null;                                                                                       // 257
};                                                                                                   // 258
                                                                                                     // 259
Utils.StringConverters = {                                                                           // 260
  'none': function(input) {                                                                          // 261
    return input;                                                                                    // 262
  },                                                                                                 // 263
                                                                                                     // 264
  'upperCamelCase': function (input) {                                                               // 265
    return Utils.upperCamelCase(input);                                                              // 266
  },                                                                                                 // 267
                                                                                                     // 268
  'camelCase': function (input) {                                                                    // 269
    return Utils.camelCase(input);                                                                   // 270
  }                                                                                                  // 271
};                                                                                                   // 272
                                                                                                     // 273
Utils.rewriteLegacyHooks = function (obj) {                                                          // 274
  var legacyToNew = IronRouter.LEGACY_HOOK_TYPES;                                                    // 275
                                                                                                     // 276
  _.each(legacyToNew, function (newHook, oldHook) {                                                  // 277
    // only look on the immediate object, not its                                                    // 278
    // proto chain                                                                                   // 279
    if (_.has(obj, oldHook)) {                                                                       // 280
      hasOld = true;                                                                                 // 281
      obj[newHook] = obj[oldHook];                                                                   // 282
                                                                                                     // 283
      Utils.notifyDeprecated({                                                                       // 284
        where: 'RouteController',                                                                    // 285
        name: oldHook,                                                                               // 286
        instead: newHook                                                                             // 287
      });                                                                                            // 288
    }                                                                                                // 289
  });                                                                                                // 290
};                                                                                                   // 291
                                                                                                     // 292
                                                                                                     // 293
///////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

///////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                   //
// packages/iron-router/lib/route.js                                                                 //
//                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                     //
/*                                                                                                   // 1
 * Inspiration and some code for the compilation of routes comes from pagejs.                        // 2
 * The original has been modified to better handle hash fragments, and to store                      // 3
 * the regular expression on the Route instance. Also, the resolve method has                        // 4
 * been added to return a resolved path given a parameters object.                                   // 5
 */                                                                                                  // 6
                                                                                                     // 7
Route = function (router, name, options) {                                                           // 8
  var path;                                                                                          // 9
                                                                                                     // 10
  Utils.assert(                                                                                      // 11
    router instanceof IronRouter,                                                                    // 12
    "Route constructor first parameter must be a Router");                                           // 13
                                                                                                     // 14
  Utils.assert(                                                                                      // 15
    _.isString(name),                                                                                // 16
    "Route constructor second parameter must be a String name");                                     // 17
                                                                                                     // 18
  if (_.isFunction(options))                                                                         // 19
    options = { handler: options };                                                                  // 20
                                                                                                     // 21
  options = this.options = options || {};                                                            // 22
  path = options.path || ('/' + name);                                                               // 23
                                                                                                     // 24
  this.router = router;                                                                              // 25
  this.originalPath = path;                                                                          // 26
                                                                                                     // 27
  if (_.isString(this.originalPath) && this.originalPath.charAt(0) !== '/')                          // 28
    this.originalPath = '/' + this.originalPath;                                                     // 29
                                                                                                     // 30
  this.name = name;                                                                                  // 31
  this.where = options.where || 'client';                                                            // 32
  this.controller = options.controller;                                                              // 33
  this.action = options.action;                                                                      // 34
                                                                                                     // 35
  if (typeof options.reactive !== 'undefined')                                                       // 36
    this.isReactive = options.reactive;                                                              // 37
  else                                                                                               // 38
    this.isReactive = true;                                                                          // 39
                                                                                                     // 40
  Utils.rewriteLegacyHooks(this.options);                                                            // 41
                                                                                                     // 42
  this.compile();                                                                                    // 43
};                                                                                                   // 44
                                                                                                     // 45
Route.prototype = {                                                                                  // 46
  constructor: Route,                                                                                // 47
                                                                                                     // 48
  /**                                                                                                // 49
   * Compile the path.                                                                               // 50
   *                                                                                                 // 51
   *  @return {Route}                                                                                // 52
   *  @api public                                                                                    // 53
   */                                                                                                // 54
                                                                                                     // 55
  compile: function () {                                                                             // 56
    var self = this;                                                                                 // 57
    var path;                                                                                        // 58
    var options = self.options;                                                                      // 59
                                                                                                     // 60
    this.keys = [];                                                                                  // 61
                                                                                                     // 62
    if (self.originalPath instanceof RegExp) {                                                       // 63
      self.re = self.originalPath;                                                                   // 64
    } else {                                                                                         // 65
      path = self.originalPath                                                                       // 66
        .replace(/(.)\/$/, '$1')                                                                     // 67
        .concat(options.strict ? '' : '/?')                                                          // 68
        .replace(/\/\(/g, '(?:/')                                                                    // 69
        .replace(/#/, '/?#')                                                                         // 70
        .replace(                                                                                    // 71
          /(\/)?(\.)?:(\w+)(?:(\(.*?\)))?(\?)?/g,                                                    // 72
          function (match, slash, format, key, capture, optional){                                   // 73
            self.keys.push({ name: key, optional: !! optional });                                    // 74
            slash = slash || '';                                                                     // 75
            return ''                                                                                // 76
              + (optional ? '' : slash)                                                              // 77
              + '(?:'                                                                                // 78
              + (optional ? slash : '')                                                              // 79
              + (format || '')                                                                       // 80
              + (capture || (format && '([^/.]+?)' || '([^/]+?)')) + ')'                             // 81
              + (optional || '');                                                                    // 82
          }                                                                                          // 83
        )                                                                                            // 84
        .replace(/([\/.])/g, '\\$1')                                                                 // 85
        .replace(/\*/g, '(.*)');                                                                     // 86
                                                                                                     // 87
      self.re = new RegExp('^' + path + '$', options.sensitive ? '' : 'i');                          // 88
    }                                                                                                // 89
                                                                                                     // 90
    return this;                                                                                     // 91
  },                                                                                                 // 92
                                                                                                     // 93
  /**                                                                                                // 94
   * Returns an array of parameters given a path. The array may have named                           // 95
   * properties in addition to indexed values.                                                       // 96
   *                                                                                                 // 97
   * @param {String} path                                                                            // 98
   * @return {Array}                                                                                 // 99
   * @api public                                                                                     // 100
   */                                                                                                // 101
                                                                                                     // 102
  params: function (path) {                                                                          // 103
    if (!path)                                                                                       // 104
      return null;                                                                                   // 105
                                                                                                     // 106
    var params = [];                                                                                 // 107
    var m = this.exec(path);                                                                         // 108
    var queryString;                                                                                 // 109
    var keys = this.keys;                                                                            // 110
    var key;                                                                                         // 111
    var value;                                                                                       // 112
                                                                                                     // 113
    if (!m)                                                                                          // 114
      throw new Error('The route named "' + this.name + '" does not match the path "' + path + '"'); // 115
                                                                                                     // 116
    for (var i = 1, len = m.length; i < len; ++i) {                                                  // 117
      key = keys[i - 1];                                                                             // 118
      value = typeof m[i] == 'string' ? decodeURIComponent(m[i]) : m[i];                             // 119
      if (key) {                                                                                     // 120
        params[key.name] = params[key.name] !== undefined ?                                          // 121
          params[key.name] : value;                                                                  // 122
      } else                                                                                         // 123
        params.push(value);                                                                          // 124
    }                                                                                                // 125
                                                                                                     // 126
    path = decodeURI(path);                                                                          // 127
                                                                                                     // 128
    queryString = path.split('?')[1];                                                                // 129
    if (queryString)                                                                                 // 130
      queryString = queryString.split('#')[0];                                                       // 131
                                                                                                     // 132
    params.hash = path.split('#')[1];                                                                // 133
                                                                                                     // 134
    if (queryString) {                                                                               // 135
      _.each(queryString.split('&'), function (paramString) {                                        // 136
        paramParts = paramString.split('=');                                                         // 137
        params[paramParts[0]] = decodeURIComponent(paramParts[1]);                                   // 138
      });                                                                                            // 139
    }                                                                                                // 140
                                                                                                     // 141
    return params;                                                                                   // 142
  },                                                                                                 // 143
                                                                                                     // 144
  normalizePath: function (path) {                                                                   // 145
    var origin = Meteor.absoluteUrl();                                                               // 146
                                                                                                     // 147
    path = path.replace(origin, '');                                                                 // 148
                                                                                                     // 149
    var queryStringIndex = path.indexOf('?');                                                        // 150
    path = ~queryStringIndex ? path.slice(0, queryStringIndex) : path;                               // 151
                                                                                                     // 152
    var hashIndex = path.indexOf('#');                                                               // 153
    path = ~hashIndex ? path.slice(0, hashIndex) : path;                                             // 154
                                                                                                     // 155
    if (path.charAt(0) !== '/')                                                                      // 156
      path = '/' + path;                                                                             // 157
                                                                                                     // 158
    return path;                                                                                     // 159
  },                                                                                                 // 160
                                                                                                     // 161
  /**                                                                                                // 162
   * Returns true if the path matches and false otherwise.                                           // 163
   *                                                                                                 // 164
   * @param {String} path                                                                            // 165
   * @return {Boolean}                                                                               // 166
   * @api public                                                                                     // 167
   */                                                                                                // 168
  test: function (path) {                                                                            // 169
    return this.re.test(this.normalizePath(path));                                                   // 170
  },                                                                                                 // 171
                                                                                                     // 172
  exec: function (path) {                                                                            // 173
    return this.re.exec(this.normalizePath(path));                                                   // 174
  },                                                                                                 // 175
                                                                                                     // 176
  resolve: function (params, options) {                                                              // 177
    var value;                                                                                       // 178
    var isValueDefined;                                                                              // 179
    var result;                                                                                      // 180
    var wildCardCount = 0;                                                                           // 181
    var path = this.originalPath;                                                                    // 182
    var hash;                                                                                        // 183
    var query;                                                                                       // 184
    var isMissingParams = false;                                                                     // 185
                                                                                                     // 186
    options = options || {};                                                                         // 187
    params = params || [];                                                                           // 188
    query = options.query;                                                                           // 189
    hash = options.hash && options.hash.toString();                                                  // 190
                                                                                                     // 191
    if (path instanceof RegExp) {                                                                    // 192
      throw new Error('Cannot currently resolve a regular expression path');                         // 193
    } else {                                                                                         // 194
      path = this.originalPath                                                                       // 195
        .replace(                                                                                    // 196
          /(\/)?(\.)?:(\w+)(?:(\(.*?\)))?(\?)?/g,                                                    // 197
          function (match, slash, format, key, capture, optional, offset) {                          // 198
            slash = slash || '';                                                                     // 199
            value = params[key];                                                                     // 200
            isValueDefined = typeof value !== 'undefined';                                           // 201
                                                                                                     // 202
            if (optional && !isValueDefined) {                                                       // 203
              value = '';                                                                            // 204
            } else if (!isValueDefined) {                                                            // 205
              isMissingParams = true;                                                                // 206
              return;                                                                                // 207
            }                                                                                        // 208
                                                                                                     // 209
            value = _.isFunction(value) ? value.call(params) : value;                                // 210
            var escapedValue = _.map(String(value).split('/'), function (segment) {                  // 211
              return encodeURIComponent(segment);                                                    // 212
            }).join('/');                                                                            // 213
            return slash + escapedValue                                                              // 214
          }                                                                                          // 215
        )                                                                                            // 216
        .replace(                                                                                    // 217
          /\*/g,                                                                                     // 218
          function (match) {                                                                         // 219
            if (typeof params[wildCardCount] === 'undefined') {                                      // 220
              throw new Error(                                                                       // 221
                'You are trying to access a wild card parameter at index ' +                         // 222
                wildCardCount +                                                                      // 223
                ' but the value of params at that index is undefined');                              // 224
            }                                                                                        // 225
                                                                                                     // 226
            var paramValue = String(params[wildCardCount++]);                                        // 227
            return _.map(paramValue.split('/'), function (segment) {                                 // 228
              return encodeURIComponent(segment);                                                    // 229
            }).join('/');                                                                            // 230
          }                                                                                          // 231
        );                                                                                           // 232
                                                                                                     // 233
      if (_.isObject(query)) {                                                                       // 234
        query = _.map(_.pairs(query), function (queryPart) {                                         // 235
          return queryPart[0] + '=' + encodeURIComponent(queryPart[1]);                              // 236
        }).join('&');                                                                                // 237
      }                                                                                              // 238
                                                                                                     // 239
      if (query && query.length)                                                                     // 240
        path = path + '?' + query;                                                                   // 241
                                                                                                     // 242
      if (hash) {                                                                                    // 243
        hash = encodeURI(hash.replace('#', ''));                                                     // 244
        path = query ?                                                                               // 245
          path + '#' + hash : path + '/#' + hash;                                                    // 246
      }                                                                                              // 247
    }                                                                                                // 248
                                                                                                     // 249
    // Because of optional possibly empty segments we normalize path here                            // 250
    path = path.replace(/\/+/g, '/'); // Multiple / -> one /                                         // 251
    path = path.replace(/^(.+)\/$/g, '$1'); // Removal of trailing /                                 // 252
                                                                                                     // 253
    return isMissingParams ? null : path;                                                            // 254
  },                                                                                                 // 255
                                                                                                     // 256
  path: function (params, options) {                                                                 // 257
    return this.resolve(params, options);                                                            // 258
  },                                                                                                 // 259
                                                                                                     // 260
  url: function (params, options) {                                                                  // 261
    var path = this.path(params, options);                                                           // 262
    if (path) {                                                                                      // 263
      if (path.charAt(0) === '/')                                                                    // 264
        path = path.slice(1, path.length);                                                           // 265
      return Meteor.absoluteUrl() + path;                                                            // 266
    } else {                                                                                         // 267
      return null;                                                                                   // 268
    }                                                                                                // 269
  },                                                                                                 // 270
                                                                                                     // 271
  findController: function (path, options) {                                                         // 272
    var self = this;                                                                                 // 273
    var handler;                                                                                     // 274
    var controllerClass;                                                                             // 275
    var controller;                                                                                  // 276
    var action;                                                                                      // 277
    var routeName;                                                                                   // 278
                                                                                                     // 279
    var resolveValue = Utils.resolveValue;                                                           // 280
    var toArray = Utils.toArray;                                                                     // 281
                                                                                                     // 282
    var resolveController = function (name) {                                                        // 283
      var controller = resolveValue(name);                                                           // 284
      if (typeof controller === 'undefined') {                                                       // 285
        throw new Error(                                                                             // 286
          'controller "' + name + '" is not defined');                                               // 287
      }                                                                                              // 288
                                                                                                     // 289
      return controller;                                                                             // 290
    };                                                                                               // 291
                                                                                                     // 292
    // controller option is a string specifying the name                                             // 293
    // of a controller somewhere                                                                     // 294
    if (_.isString(this.controller))                                                                 // 295
      controller = resolveController(this.controller);                                               // 296
    else if (_.isFunction(this.controller))                                                          // 297
      controller = this.controller;                                                                  // 298
    else if (this.name)                                                                              // 299
      controller = resolveValue(Router.convertRouteControllerName(this.name + 'Controller'));        // 300
                                                                                                     // 301
    if (!controller)                                                                                 // 302
      controller = RouteController;                                                                  // 303
                                                                                                     // 304
    return controller;                                                                               // 305
  },                                                                                                 // 306
                                                                                                     // 307
  newController: function (path, options) {                                                          // 308
    var C = this.findController(path, options);                                                      // 309
                                                                                                     // 310
    options = _.extend({}, options, {                                                                // 311
      path: path,                                                                                    // 312
      params: this.params(path),                                                                     // 313
      where: this.where,                                                                             // 314
      action: this.action                                                                            // 315
    });                                                                                              // 316
                                                                                                     // 317
    return new C(this.router, this, options);                                                        // 318
  },                                                                                                 // 319
                                                                                                     // 320
  getController: function (path, options) {                                                          // 321
    return this.newController(path, options);                                                        // 322
  }.deprecate({where: 'Route', name: 'getController', instead: 'newController'})                     // 323
};                                                                                                   // 324
                                                                                                     // 325
///////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

///////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                   //
// packages/iron-router/lib/route_controller.js                                                      //
//                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                     //
RouteController = function (router, route, options) {                                                // 1
  var self = this;                                                                                   // 2
                                                                                                     // 3
  if (!(router instanceof IronRouter))                                                               // 4
    throw new Error('RouteController requires a router');                                            // 5
                                                                                                     // 6
  if (!(route instanceof Route))                                                                     // 7
    throw new Error('RouteController requires a route');                                             // 8
                                                                                                     // 9
  options = this.options = options || {};                                                            // 10
                                                                                                     // 11
  this.router = router;                                                                              // 12
  this.route = route;                                                                                // 13
                                                                                                     // 14
  this.path = options.path || '';                                                                    // 15
  this.params = options.params || [];                                                                // 16
  this.where = options.where || 'client';                                                            // 17
  this.action = options.action || this.action;                                                       // 18
                                                                                                     // 19
  Utils.rewriteLegacyHooks(this.options);                                                            // 20
  Utils.rewriteLegacyHooks(this);                                                                    // 21
};                                                                                                   // 22
                                                                                                     // 23
RouteController.prototype = {                                                                        // 24
  constructor: RouteController,                                                                      // 25
                                                                                                     // 26
  /**                                                                                                // 27
   * Returns the value of a property, searching for the property in this lookup                      // 28
   * order:                                                                                          // 29
   *                                                                                                 // 30
   *   1. RouteController options                                                                    // 31
   *   2. RouteController prototype                                                                  // 32
   *   3. Route options                                                                              // 33
   *   4. Router options                                                                             // 34
   */                                                                                                // 35
  lookupProperty: function (key) {                                                                   // 36
    var value;                                                                                       // 37
                                                                                                     // 38
    if (!_.isString(key))                                                                            // 39
      throw new Error('key must be a string');                                                       // 40
                                                                                                     // 41
    // 1. RouteController options                                                                    // 42
    if (typeof (value = this.options[key]) !== 'undefined')                                          // 43
      return value;                                                                                  // 44
                                                                                                     // 45
    // 2. RouteController instance                                                                   // 46
    if (typeof (value = this[key]) !== 'undefined')                                                  // 47
      return value;                                                                                  // 48
                                                                                                     // 49
    var opts;                                                                                        // 50
                                                                                                     // 51
    // 3. Route options                                                                              // 52
    opts = this.route.options;                                                                       // 53
    if (opts && typeof (value = opts[key]) !== 'undefined')                                          // 54
      return value;                                                                                  // 55
                                                                                                     // 56
    // 4. Router options                                                                             // 57
    opts = this.router.options;                                                                      // 58
    if (opts && typeof (value = opts[key]) !== 'undefined')                                          // 59
      return value;                                                                                  // 60
                                                                                                     // 61
    // 5. Oops couldn't find property                                                                // 62
    return undefined;                                                                                // 63
  },                                                                                                 // 64
                                                                                                     // 65
  runHooks: function (hookName, more, cb) {                                                          // 66
    var self = this;                                                                                 // 67
    var ctor = this.constructor;                                                                     // 68
                                                                                                     // 69
    if (!_.isString(hookName))                                                                       // 70
      throw new Error('hookName must be a string');                                                  // 71
                                                                                                     // 72
    if (more && !_.isArray(more))                                                                    // 73
      throw new Error('more must be an array of functions');                                         // 74
                                                                                                     // 75
    var isPaused = false;                                                                            // 76
                                                                                                     // 77
    var lookupHook = function (nameOrFn) {                                                           // 78
      var fn = nameOrFn;                                                                             // 79
                                                                                                     // 80
      // if we already have a func just return it                                                    // 81
      if (_.isFunction(fn))                                                                          // 82
        return fn;                                                                                   // 83
                                                                                                     // 84
      // look up one of the out-of-box hooks like                                                    // 85
      // 'loaded or 'dataNotFound' if the nameOrFn is a                                              // 86
      // string                                                                                      // 87
      if (_.isString(fn)) {                                                                          // 88
        if (_.isFunction(Router.hooks[fn]))                                                          // 89
          return Router.hooks[fn];                                                                   // 90
      }                                                                                              // 91
                                                                                                     // 92
      // we couldn't find it so throw an error                                                       // 93
      throw new Error("No hook found named: ", nameOrFn);                                            // 94
    };                                                                                               // 95
                                                                                                     // 96
    // concatenate together hook arrays from the inheritance                                         // 97
    // heirarchy, starting at the top parent down to the child.                                      // 98
    var collectInheritedHooks = function (ctor) {                                                    // 99
      var hooks = [];                                                                                // 100
                                                                                                     // 101
      if (ctor.__super__)                                                                            // 102
        hooks = hooks.concat(collectInheritedHooks(ctor.__super__.constructor));                     // 103
                                                                                                     // 104
      return Utils.hasOwnProperty(ctor.prototype, hookName) ?                                        // 105
        hooks.concat(ctor.prototype[hookName]) : hooks;                                              // 106
    };                                                                                               // 107
                                                                                                     // 108
                                                                                                     // 109
    // get a list of hooks to run in the following order:                                            // 110
    // 1. RouteController option hooks                                                               // 111
    // 2. RouteController proto hooks (including inherited super to child)                           // 112
    // 3. RouteController object hooks                                                               // 113
    // 4. Router global hooks                                                                        // 114
    // 5. Route option hooks                                                                         // 115
    // 6. more                                                                                       // 116
                                                                                                     // 117
    var toArray = Utils.toArray;                                                                     // 118
    var routerHooks = this.router.getHooks(hookName, this.route.name);                               // 119
                                                                                                     // 120
    var opts;                                                                                        // 121
    opts = this.route.options;                                                                       // 122
    var routeOptionHooks = toArray(opts && opts[hookName]);                                          // 123
                                                                                                     // 124
    opts = this.options;                                                                             // 125
    var optionHooks = toArray(opts && opts[hookName]);                                               // 126
                                                                                                     // 127
    var protoHooks = collectInheritedHooks(this.constructor);                                        // 128
                                                                                                     // 129
    var objectHooks;                                                                                 // 130
    // don't accidentally grab the prototype hooks!                                                  // 131
    // this makes sure the hook is on the object itself                                              // 132
    // not on its constructor's prototype object.                                                    // 133
    if (_.has(this, hookName))                                                                       // 134
      objectHooks = toArray(this[hookName])                                                          // 135
    else                                                                                             // 136
      objectHooks = [];                                                                              // 137
                                                                                                     // 138
    var allHooks = optionHooks                                                                       // 139
      .concat(protoHooks)                                                                            // 140
      .concat(objectHooks)                                                                           // 141
      .concat(routeOptionHooks)                                                                      // 142
      .concat(routerHooks)                                                                           // 143
      .concat(more);                                                                                 // 144
                                                                                                     // 145
    var isPaused = false;                                                                            // 146
    var pauseFn = function () {                                                                      // 147
      isPaused = true;                                                                               // 148
    };                                                                                               // 149
                                                                                                     // 150
    for (var i = 0, hook; hook = allHooks[i]; i++) {                                                 // 151
      var hookFn = lookupHook(hook);                                                                 // 152
                                                                                                     // 153
      if (!isPaused && !this.isStopped)                                                              // 154
        hookFn.call(self, pauseFn, i);                                                               // 155
    }                                                                                                // 156
                                                                                                     // 157
    cb && cb.call(self, isPaused);                                                                   // 158
    return isPaused;                                                                                 // 159
  },                                                                                                 // 160
                                                                                                     // 161
  action: function () {                                                                              // 162
    throw new Error('not implemented');                                                              // 163
  },                                                                                                 // 164
                                                                                                     // 165
  stop: function (cb) {                                                                              // 166
    return this._stopController(cb);                                                                 // 167
  },                                                                                                 // 168
                                                                                                     // 169
  _stopController: function (cb) {                                                                   // 170
    var self = this;                                                                                 // 171
                                                                                                     // 172
    if (this.isStopped)                                                                              // 173
      return;                                                                                        // 174
                                                                                                     // 175
    self.isRunning = false;                                                                          // 176
    self.runHooks('onStop');                                                                         // 177
    self.isStopped = true;                                                                           // 178
    cb && cb.call(self);                                                                             // 179
  },                                                                                                 // 180
                                                                                                     // 181
  _run: function () {                                                                                // 182
    throw new Error('not implemented');                                                              // 183
  }                                                                                                  // 184
};                                                                                                   // 185
                                                                                                     // 186
_.extend(RouteController, {                                                                          // 187
  /**                                                                                                // 188
   * Inherit from RouteController                                                                    // 189
   *                                                                                                 // 190
   * @param {Object} definition Prototype properties for inherited class.                            // 191
   */                                                                                                // 192
                                                                                                     // 193
  extend: function (definition) {                                                                    // 194
    Utils.rewriteLegacyHooks(definition);                                                            // 195
                                                                                                     // 196
    return Utils.extend(this, definition, function (definition) {                                    // 197
      var klass = this;                                                                              // 198
                                                                                                     // 199
                                                                                                     // 200
      /*                                                                                             // 201
        Allow calling a class method from javascript, directly in the subclass                       // 202
        definition.                                                                                  // 203
                                                                                                     // 204
        Instead of this:                                                                             // 205
          MyController = RouteController.extend({...});                                              // 206
          MyController.before(function () {});                                                       // 207
                                                                                                     // 208
        You can do:                                                                                  // 209
          MyController = RouteController.extend({                                                    // 210
            before: function () {}                                                                   // 211
          });                                                                                        // 212
                                                                                                     // 213
        And in Coffeescript you can do:                                                              // 214
         MyController extends RouteController                                                        // 215
           @before function () {}                                                                    // 216
       */                                                                                            // 217
    });                                                                                              // 218
  }                                                                                                  // 219
});                                                                                                  // 220
                                                                                                     // 221
///////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

///////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                   //
// packages/iron-router/lib/router.js                                                                //
//                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                     //
IronRouter = function (options) {                                                                    // 1
  var self = this;                                                                                   // 2
                                                                                                     // 3
  this.configure(options);                                                                           // 4
                                                                                                     // 5
  /**                                                                                                // 6
   * The routes array which doubles as a named route index by adding                                 // 7
   * properties to the array.                                                                        // 8
   *                                                                                                 // 9
   * @api public                                                                                     // 10
   */                                                                                                // 11
  this.routes = [];                                                                                  // 12
                                                                                                     // 13
  /**                                                                                                // 14
   * Default name conversions for controller                                                         // 15
   * and template lookup.                                                                            // 16
   */                                                                                                // 17
  this._nameConverters = {};                                                                         // 18
  this.setNameConverter('Template', 'none');                                                         // 19
  this.setNameConverter('RouteController', 'upperCamelCase');                                        // 20
                                                                                                     // 21
  this._globalHooks = {};                                                                            // 22
  _.each(IronRouter.HOOK_TYPES, function (type) {                                                    // 23
    self._globalHooks[type] = [];                                                                    // 24
                                                                                                     // 25
    // example:                                                                                      // 26
    //  self.onRun = function (hook, options) {                                                      // 27
    //    return self.addHook('onRun', hook, options);                                               // 28
    //  };                                                                                           // 29
    self[type] = function (hook, options) {                                                          // 30
      return self.addHook(type, hook, options);                                                      // 31
    };                                                                                               // 32
  });                                                                                                // 33
                                                                                                     // 34
  _.each(IronRouter.LEGACY_HOOK_TYPES, function (type, legacyType) {                                 // 35
    self[legacyType] = function () {                                                                 // 36
      Utils.notifyDeprecated({                                                                       // 37
        where: 'Router',                                                                             // 38
        name: legacyType,                                                                            // 39
        instead: type                                                                                // 40
      });                                                                                            // 41
                                                                                                     // 42
      return self[type].apply(this, arguments);                                                      // 43
    }                                                                                                // 44
  });                                                                                                // 45
};                                                                                                   // 46
                                                                                                     // 47
IronRouter.HOOK_TYPES = [                                                                            // 48
  'onRun',                                                                                           // 49
  'onData',                                                                                          // 50
  'onBeforeAction',                                                                                  // 51
  'onAfterAction',                                                                                   // 52
  'onStop',                                                                                          // 53
                                                                                                     // 54
  // not technically a hook but we'll use it                                                         // 55
  // in a similar way. This will cause waitOn                                                        // 56
  // to be added as a method to the Router and then                                                  // 57
  // it can be selectively applied to specific routes                                                // 58
  'waitOn'                                                                                           // 59
];                                                                                                   // 60
                                                                                                     // 61
IronRouter.LEGACY_HOOK_TYPES = {                                                                     // 62
  'load': 'onRun',                                                                                   // 63
  'before': 'onBeforeAction',                                                                        // 64
  'after': 'onAfterAction',                                                                          // 65
  'unload': 'onStop'                                                                                 // 66
};                                                                                                   // 67
                                                                                                     // 68
IronRouter.prototype = {                                                                             // 69
  constructor: IronRouter,                                                                           // 70
                                                                                                     // 71
  /**                                                                                                // 72
   * Configure instance with options. This can be called at any time. If the                         // 73
   * instance options object hasn't been created yet it is created here.                             // 74
   *                                                                                                 // 75
   * @param {Object} options                                                                         // 76
   * @return {IronRouter}                                                                            // 77
   * @api public                                                                                     // 78
   */                                                                                                // 79
                                                                                                     // 80
  configure: function (options) {                                                                    // 81
    var self = this;                                                                                 // 82
                                                                                                     // 83
    options = options || {};                                                                         // 84
    this.options = this.options || {};                                                               // 85
    _.extend(this.options, options);                                                                 // 86
                                                                                                     // 87
    // e.g. before: fn OR before: [fn1, fn2]                                                         // 88
    _.each(IronRouter.HOOK_TYPES, function(type) {                                                   // 89
      if (self.options[type]) {                                                                      // 90
        _.each(Utils.toArray(self.options[type]), function(hook) {                                   // 91
          self.addHook(type, hook);                                                                  // 92
        });                                                                                          // 93
                                                                                                     // 94
        delete self.options[type];                                                                   // 95
      }                                                                                              // 96
    });                                                                                              // 97
                                                                                                     // 98
    _.each(IronRouter.LEGACY_HOOK_TYPES, function(type, legacyType) {                                // 99
      if (self.options[legacyType]) {                                                                // 100
        // XXX: warning?                                                                             // 101
        _.each(Utils.toArray(self.options[legacyType]), function(hook) {                             // 102
          self.addHook(type, hook);                                                                  // 103
        });                                                                                          // 104
                                                                                                     // 105
        delete self.options[legacyType];                                                             // 106
      }                                                                                              // 107
    });                                                                                              // 108
                                                                                                     // 109
    if (options.templateNameConverter)                                                               // 110
      this.setNameConverter('Template', options.templateNameConverter);                              // 111
                                                                                                     // 112
    if (options.routeControllerNameConverter)                                                        // 113
      this.setNameConverter('RouteController', options.routeControllerNameConverter);                // 114
                                                                                                     // 115
    return this;                                                                                     // 116
  },                                                                                                 // 117
                                                                                                     // 118
  convertTemplateName: function (input) {                                                            // 119
    var converter = this._nameConverters['Template'];                                                // 120
    if (!converter)                                                                                  // 121
      throw new Error('No name converter found for Template');                                       // 122
    return converter(input);                                                                         // 123
  },                                                                                                 // 124
                                                                                                     // 125
  convertRouteControllerName: function (input) {                                                     // 126
    var converter = this._nameConverters['RouteController'];                                         // 127
    if (!converter)                                                                                  // 128
      throw new Error('No name converter found for RouteController');                                // 129
    return converter(input);                                                                         // 130
  },                                                                                                 // 131
                                                                                                     // 132
  setNameConverter: function (key, stringOrFunc) {                                                   // 133
    var converter;                                                                                   // 134
                                                                                                     // 135
    if (_.isFunction(stringOrFunc))                                                                  // 136
      converter = stringOrFunc;                                                                      // 137
                                                                                                     // 138
    if (_.isString(stringOrFunc))                                                                    // 139
      converter = Utils.StringConverters[stringOrFunc];                                              // 140
                                                                                                     // 141
    if (!converter) {                                                                                // 142
      throw new Error('No converter found named: ' + stringOrFunc);                                  // 143
    }                                                                                                // 144
                                                                                                     // 145
    this._nameConverters[key] = converter;                                                           // 146
    return this;                                                                                     // 147
  },                                                                                                 // 148
                                                                                                     // 149
  /**                                                                                                // 150
   *                                                                                                 // 151
   * Add a hook to all routes. The hooks will apply to all routes,                                   // 152
   * unless you name routes to include or exclude via `only` and `except` options                    // 153
   *                                                                                                 // 154
   * @param {String} [type] one of 'load', 'unload', 'before' or 'after'                             // 155
   * @param {Object} [options] Options to controll the hooks [optional]                              // 156
   * @param {Function} [hook] Callback to run                                                        // 157
   * @return {IronRouter}                                                                            // 158
   * @api public                                                                                     // 159
   *                                                                                                 // 160
   */                                                                                                // 161
                                                                                                     // 162
  addHook: function(type, hook, options) {                                                           // 163
    options = options || {}                                                                          // 164
                                                                                                     // 165
    if (options.only)                                                                                // 166
      options.only = Utils.toArray(options.only);                                                    // 167
    if (options.except)                                                                              // 168
      options.except = Utils.toArray(options.except);                                                // 169
                                                                                                     // 170
    this._globalHooks[type].push({options: options, hook: hook});                                    // 171
                                                                                                     // 172
    return this;                                                                                     // 173
  },                                                                                                 // 174
                                                                                                     // 175
  /**                                                                                                // 176
   *                                                                                                 // 177
   * Fetch the list of global hooks that apply to the given route name.                              // 178
   * Hooks are defined by the .addHook() function above.                                             // 179
   *                                                                                                 // 180
   * @param {String} [type] one of IronRouter.HOOK_TYPES                                             // 181
   * @param {String} [name] the name of the route we are interested in                               // 182
   * @return {[Function]} [hooks] an array of hooks to run                                           // 183
   * @api public                                                                                     // 184
   *                                                                                                 // 185
   */                                                                                                // 186
                                                                                                     // 187
  getHooks: function(type, name) {                                                                   // 188
    var hooks = [];                                                                                  // 189
                                                                                                     // 190
    _.each(this._globalHooks[type], function(hook) {                                                 // 191
      var options = hook.options;                                                                    // 192
                                                                                                     // 193
      if (options.except && _.include(options.except, name))                                         // 194
        return;                                                                                      // 195
                                                                                                     // 196
      if (options.only && ! _.include(options.only, name))                                           // 197
        return;                                                                                      // 198
                                                                                                     // 199
      hooks.push(hook.hook);                                                                         // 200
    });                                                                                              // 201
                                                                                                     // 202
    return hooks;                                                                                    // 203
  },                                                                                                 // 204
                                                                                                     // 205
                                                                                                     // 206
  /**                                                                                                // 207
   * Convenience function to define a bunch of routes at once. In the future we                      // 208
   * might call the callback with a custom dsl.                                                      // 209
   *                                                                                                 // 210
   * Example:                                                                                        // 211
   *  Router.map(function () {                                                                       // 212
   *    this.route('posts');                                                                         // 213
   *  });                                                                                            // 214
   *                                                                                                 // 215
   *  @param {Function} cb                                                                           // 216
   *  @return {IronRouter}                                                                           // 217
   *  @api public                                                                                    // 218
   */                                                                                                // 219
                                                                                                     // 220
  map: function (cb) {                                                                               // 221
    Utils.assert(_.isFunction(cb),                                                                   // 222
           'map requires a function as the first parameter');                                        // 223
    cb.call(this);                                                                                   // 224
    return this;                                                                                     // 225
  },                                                                                                 // 226
                                                                                                     // 227
  /**                                                                                                // 228
   * Define a new route. You must name the route, but as a second parameter you                      // 229
   * can either provide an object of options or a Route instance.                                    // 230
   *                                                                                                 // 231
   * @param {String} name The name of the route                                                      // 232
   * @param {Object} [options] Options to pass along to the route                                    // 233
   * @return {Route}                                                                                 // 234
   * @api public                                                                                     // 235
   */                                                                                                // 236
                                                                                                     // 237
  route: function (name, options) {                                                                  // 238
    var route;                                                                                       // 239
                                                                                                     // 240
    Utils.assert(_.isString(name), 'name is a required parameter');                                  // 241
                                                                                                     // 242
    if (options instanceof Route)                                                                    // 243
      route = options;                                                                               // 244
    else                                                                                             // 245
      route = new Route(this, name, options);                                                        // 246
                                                                                                     // 247
    this.routes[name] = route;                                                                       // 248
    this.routes.push(route);                                                                         // 249
    return route;                                                                                    // 250
  },                                                                                                 // 251
                                                                                                     // 252
  path: function (routeName, params, options) {                                                      // 253
    var route = this.routes[routeName];                                                              // 254
    Utils.warn(route,                                                                                // 255
     'You called Router.path for a route named ' + routeName + ' but that route doesn\'t seem to exist. Are you sure you created it?');
    return route && route.path(params, options);                                                     // 257
  },                                                                                                 // 258
                                                                                                     // 259
  url: function (routeName, params, options) {                                                       // 260
    var route = this.routes[routeName];                                                              // 261
    Utils.warn(route,                                                                                // 262
      'You called Router.url for a route named "' + routeName + '" but that route doesn\'t seem to exist. Are you sure you created it?');
    return route && route.url(params, options);                                                      // 264
  },                                                                                                 // 265
                                                                                                     // 266
  match: function (path) {                                                                           // 267
    return _.find(this.routes, function(r) { return r.test(path); });                                // 268
  },                                                                                                 // 269
                                                                                                     // 270
  dispatch: function (path, options, cb) {                                                           // 271
    var route = this.match(path);                                                                    // 272
                                                                                                     // 273
    if (! route)                                                                                     // 274
      return this.onRouteNotFound(path, options);                                                    // 275
                                                                                                     // 276
    if (route.where !== (Meteor.isClient ? 'client' : 'server'))                                     // 277
      return this.onUnhandled(path, options);                                                        // 278
                                                                                                     // 279
    var controller = route.newController(path, options);                                             // 280
    this.run(controller, cb);                                                                        // 281
  },                                                                                                 // 282
                                                                                                     // 283
  run: function (controller, cb) {                                                                   // 284
    var self = this;                                                                                 // 285
    var where = Meteor.isClient ? 'client' : 'server';                                               // 286
                                                                                                     // 287
    Utils.assert(controller, 'run requires a controller');                                           // 288
                                                                                                     // 289
    // one last check to see if we should handle the route here                                      // 290
    if (controller.where != where) {                                                                 // 291
      self.onUnhandled(controller.path, controller.options);                                         // 292
      return;                                                                                        // 293
    }                                                                                                // 294
                                                                                                     // 295
    var run = function () {                                                                          // 296
      self._currentController = controller;                                                          // 297
      // set the location                                                                            // 298
      cb && cb(controller);                                                                          // 299
      self._currentController._run();                                                                // 300
    };                                                                                               // 301
                                                                                                     // 302
    // if we already have a current controller let's stop it and then                                // 303
    // run the new one once the old controller is stopped. this will add                             // 304
    // the run function as an onInvalidate callback to the controller's                              // 305
    // computation. Otherwse, just run the new controller.                                           // 306
    if (this._currentController)                                                                     // 307
      this._currentController._stopController(run);                                                  // 308
    else                                                                                             // 309
      run();                                                                                         // 310
  },                                                                                                 // 311
                                                                                                     // 312
  onUnhandled: function (path, options) {                                                            // 313
    throw new Error('onUnhandled not implemented');                                                  // 314
  },                                                                                                 // 315
                                                                                                     // 316
  onRouteNotFound: function (path, options) {                                                        // 317
    throw new Error('Oh no! No route found for path: "' + path + '"');                               // 318
  }                                                                                                  // 319
};                                                                                                   // 320
                                                                                                     // 321
///////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

///////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                   //
// packages/iron-router/lib/server/route_controller.js                                               //
//                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                     //
RouteController = Utils.extend(RouteController, {                                                    // 1
  constructor: function () {                                                                         // 2
    RouteController.__super__.constructor.apply(this, arguments);                                    // 3
    this.request = this.options.request;                                                             // 4
    this.response = this.options.response;                                                           // 5
    this.next = this.options.next;                                                                   // 6
                                                                                                     // 7
    this._dataValue = this.data || {};                                                               // 8
                                                                                                     // 9
    this.data = function (value) {                                                                   // 10
      if (value)                                                                                     // 11
        this._dataValue = value;                                                                     // 12
      else                                                                                           // 13
        return _.isFunction(this._dataValue) ? this._dataValue.call(this) : this._dataValue;         // 14
    };                                                                                               // 15
  },                                                                                                 // 16
                                                                                                     // 17
  _run: function () {                                                                                // 18
    var self = this                                                                                  // 19
      , args = _.toArray(arguments);                                                                 // 20
                                                                                                     // 21
    try {                                                                                            // 22
      // if we're already running, you can't call run again without                                  // 23
      // calling stop first.                                                                         // 24
      if (self.isRunning)                                                                            // 25
        throw new Error("You called _run without first calling stop");                               // 26
                                                                                                     // 27
      self.isRunning = true;                                                                         // 28
      self.isStopped = false;                                                                        // 29
                                                                                                     // 30
      var action = _.isFunction(self.action) ? self.action : self[self.action];                      // 31
      Utils.assert(action,                                                                           // 32
        "You don't have an action named \"" + self.action + "\" defined on your RouteController");   // 33
                                                                                                     // 34
      this.runHooks('onRun');                                                                        // 35
      var isPaused = this.runHooks('onBeforeAction');                                                // 36
                                                                                                     // 37
      if (! isPaused) {                                                                              // 38
        action.call(this);                                                                           // 39
        this.runHooks('onAfterAction');                                                              // 40
      }                                                                                              // 41
    } catch (e) {                                                                                    // 42
      console.error(e.toString());                                                                   // 43
      this.response.end();                                                                           // 44
    }                                                                                                // 45
  },                                                                                                 // 46
                                                                                                     // 47
  action: function () {                                                                              // 48
    this.response.end();                                                                             // 49
  }                                                                                                  // 50
});                                                                                                  // 51
                                                                                                     // 52
///////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

///////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                   //
// packages/iron-router/lib/server/router.js                                                         //
//                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                     //
var connect = Npm.require('connect');                                                                // 1
var Fiber = Npm.require('fibers');                                                                   // 2
                                                                                                     // 3
var root = global;                                                                                   // 4
                                                                                                     // 5
var connectHandlers;                                                                                 // 6
var connect;                                                                                         // 7
                                                                                                     // 8
if (typeof __meteor_bootstrap__.app !== 'undefined') {                                               // 9
  connectHandlers = __meteor_bootstrap__.app;                                                        // 10
} else {                                                                                             // 11
  connectHandlers = WebApp.connectHandlers;                                                          // 12
}                                                                                                    // 13
                                                                                                     // 14
IronRouter = Utils.extend(IronRouter, {                                                              // 15
  constructor: function (options) {                                                                  // 16
    var self = this;                                                                                 // 17
    IronRouter.__super__.constructor.apply(this, arguments);                                         // 18
    Meteor.startup(function () {                                                                     // 19
      setTimeout(function () {                                                                       // 20
        if (self.options.autoStart !== false)                                                        // 21
          self.start();                                                                              // 22
      });                                                                                            // 23
    });                                                                                              // 24
  },                                                                                                 // 25
                                                                                                     // 26
  start: function () {                                                                               // 27
    connectHandlers                                                                                  // 28
      .use(connect.query())                                                                          // 29
      .use(connect.bodyParser())                                                                     // 30
      .use(_.bind(this.onRequest, this));                                                            // 31
  },                                                                                                 // 32
                                                                                                     // 33
  onRequest: function (req, res, next) {                                                             // 34
    var self = this;                                                                                 // 35
    Fiber(function () {                                                                              // 36
      self.dispatch(req.url, {                                                                       // 37
        request: req,                                                                                // 38
        response: res,                                                                               // 39
        next: next                                                                                   // 40
      });                                                                                            // 41
    }).run();                                                                                        // 42
  },                                                                                                 // 43
                                                                                                     // 44
  run: function (controller, cb) {                                                                   // 45
    IronRouter.__super__.run.apply(this, arguments);                                                 // 46
    if (controller === this._currentController)                                                      // 47
      cb && cb(controller);                                                                          // 48
  },                                                                                                 // 49
                                                                                                     // 50
  stop: function () {                                                                                // 51
  },                                                                                                 // 52
                                                                                                     // 53
  onUnhandled: function (path, options) {                                                            // 54
    options.next();                                                                                  // 55
  },                                                                                                 // 56
                                                                                                     // 57
  onRouteNotFound: function (path, options) {                                                        // 58
    options.next();                                                                                  // 59
  }                                                                                                  // 60
});                                                                                                  // 61
                                                                                                     // 62
Router = new IronRouter;                                                                             // 63
                                                                                                     // 64
///////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['iron-router'] = {
  RouteController: RouteController,
  Route: Route,
  Router: Router,
  Utils: Utils,
  IronRouter: IronRouter
};

})();

//# sourceMappingURL=iron-router.js.map
