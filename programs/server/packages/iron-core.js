(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var _ = Package.underscore._;
var EJSON = Package.ejson.EJSON;

/* Package-scope variables */
var Iron;

(function () {

///////////////////////////////////////////////////////////////////////////////////////////
//                                                                                       //
// packages/iron-core/lib/iron_core.js                                                   //
//                                                                                       //
///////////////////////////////////////////////////////////////////////////////////////////
                                                                                         //
Iron = {};                                                                               // 1
Iron.utils = {};                                                                         // 2
                                                                                         // 3
/**                                                                                      // 4
 * Assert that the given condition is truthy and throw an error if not.                  // 5
 */                                                                                      // 6
                                                                                         // 7
Iron.utils.assert = function (condition, msg) {                                          // 8
  if (!condition)                                                                        // 9
    throw new Error(msg);                                                                // 10
};                                                                                       // 11
                                                                                         // 12
/**                                                                                      // 13
 * Print a warning message to the console if the console is defined.                     // 14
 */                                                                                      // 15
Iron.utils.warn = function (condition, msg) {                                            // 16
  if (!condition)                                                                        // 17
    console && console.warn && console.warn(msg);                                        // 18
};                                                                                       // 19
                                                                                         // 20
/**                                                                                      // 21
 * Given a target object and a property name, if the value of that property is           // 22
 * undefined, set a default value and return it. If the value is already                 // 23
 * defined, return the existing value.                                                   // 24
 */                                                                                      // 25
Iron.utils.defaultValue = function (target, prop, value) {                               // 26
  if (typeof target[prop] === 'undefined') {                                             // 27
    target[prop] = value;                                                                // 28
    return value;                                                                        // 29
  } else {                                                                               // 30
    return target[prop]                                                                  // 31
  }                                                                                      // 32
};                                                                                       // 33
                                                                                         // 34
/**                                                                                      // 35
 * Make one constructor function inherit from another. Optionally provide                // 36
 * prototype properties for the child.                                                   // 37
 *                                                                                       // 38
 * @param {Function} Child The child constructor function.                               // 39
 * @param {Function} Parent The parent constructor function.                             // 40
 * @param {Object} [props] Prototype properties to add to the child                      // 41
 */                                                                                      // 42
Iron.utils.inherits = function (Child, Parent, props) {                                  // 43
  // copy static fields                                                                  // 44
  for (var key in Parent) {                                                              // 45
    if (_.has(Parent, key))                                                              // 46
      Child[key] = Parent[key];                                                          // 47
  }                                                                                      // 48
                                                                                         // 49
  var Middle = function () {                                                             // 50
    this.constructor = Child;                                                            // 51
  };                                                                                     // 52
                                                                                         // 53
  // hook up the proto chain                                                             // 54
  Middle.prototype = Parent.prototype;                                                   // 55
  Child.prototype = new Middle;                                                          // 56
  Child.__super__ = Parent.prototype;                                                    // 57
                                                                                         // 58
  // copy over the prototype props                                                       // 59
  if (_.isObject(props))                                                                 // 60
    _.extend(Child.prototype, props);                                                    // 61
                                                                                         // 62
  return Child;                                                                          // 63
};                                                                                       // 64
                                                                                         // 65
/**                                                                                      // 66
 * Create a new constructor function that inherits from Parent and copy in the           // 67
 * provided prototype properties.                                                        // 68
 *                                                                                       // 69
 * @param {Function} Parent The parent constructor function.                             // 70
 * @param {Object} [props] Prototype properties to add to the child                      // 71
 */                                                                                      // 72
Iron.utils.extend = function (Parent, props) {                                           // 73
  props = props || {};                                                                   // 74
                                                                                         // 75
  var ctor = function () {                                                               // 76
    // automatically call the parent constructor if a new one                            // 77
    // isn't provided.                                                                   // 78
    var constructor;                                                                     // 79
    if (_.has(props, 'constructor'))                                                     // 80
      constructor = props.constructor                                                    // 81
    else                                                                                 // 82
      constructor = ctor.__super__.constructor;                                          // 83
                                                                                         // 84
    constructor.apply(this, arguments);                                                  // 85
  };                                                                                     // 86
                                                                                         // 87
  return Iron.utils.inherits(ctor, Parent, props);                                       // 88
};                                                                                       // 89
                                                                                         // 90
/**                                                                                      // 91
 * Either window in the browser or global in NodeJS.                                     // 92
 */                                                                                      // 93
Iron.utils.global = (function () { return this; })();                                    // 94
                                                                                         // 95
/**                                                                                      // 96
 * Returns the resolved value at the given namespace or the value itself if it's         // 97
 * not a string.                                                                         // 98
 *                                                                                       // 99
 * Example:                                                                              // 100
 *                                                                                       // 101
 * var Iron = {};                                                                        // 102
 * Iron.foo = {};                                                                        // 103
 *                                                                                       // 104
 * var baz = Iron.foo.baz = {};                                                          // 105
 * Iron.utils.resolve("Iron.foo.baz") === baz                                            // 106
 */                                                                                      // 107
Iron.utils.resolve = function (nameOrValue) {                                            // 108
  var global = Iron.utils.global;                                                        // 109
  var parts;                                                                             // 110
  var ptr;                                                                               // 111
                                                                                         // 112
  if (typeof nameOrValue === 'string') {                                                 // 113
    parts = nameOrValue.split('.')                                                       // 114
    ptr = global;                                                                        // 115
    for (var i = 0; i < parts.length; i++) {                                             // 116
      ptr = ptr[parts[i]];                                                               // 117
      if (!ptr)                                                                          // 118
        return undefined;                                                                // 119
    }                                                                                    // 120
  } else {                                                                               // 121
    ptr = nameOrValue;                                                                   // 122
  }                                                                                      // 123
                                                                                         // 124
  // final position of ptr should be the resolved value                                  // 125
  return ptr;                                                                            // 126
};                                                                                       // 127
                                                                                         // 128
/**                                                                                      // 129
 * Capitalize a string.                                                                  // 130
 */                                                                                      // 131
Iron.utils.capitalize = function (str) {                                                 // 132
  return str.charAt(0).toUpperCase() + str.slice(1, str.length);                         // 133
};                                                                                       // 134
                                                                                         // 135
/**                                                                                      // 136
 * Convert a string to class case.                                                       // 137
 */                                                                                      // 138
Iron.utils.classCase = function (str) {                                                  // 139
  var re = /_|-|\.|\//;                                                                  // 140
                                                                                         // 141
  if (!str)                                                                              // 142
    return '';                                                                           // 143
                                                                                         // 144
  return _.map(str.split(re), function (word) {                                          // 145
    return Iron.utils.capitalize(word);                                                  // 146
  }).join('');                                                                           // 147
};                                                                                       // 148
                                                                                         // 149
/**                                                                                      // 150
 * Convert a string to camel case.                                                       // 151
 */                                                                                      // 152
Iron.utils.camelCase = function (str) {                                                  // 153
  var output = Iron.utils.classCase(str);                                                // 154
  output = output.charAt(0).toLowerCase() + output.slice(1, output.length);              // 155
  return output;                                                                         // 156
};                                                                                       // 157
                                                                                         // 158
/**                                                                                      // 159
 * deprecatation notice to the user which can be a string or object                      // 160
 * of the form:                                                                          // 161
 *                                                                                       // 162
 * {                                                                                     // 163
 *  name: 'somePropertyOrMethod',                                                        // 164
 *  where: 'RouteController',                                                            // 165
 *  instead: 'someOtherPropertyOrMethod',                                                // 166
 *  message: ':name is deprecated. Please use :instead instead'                          // 167
 * }                                                                                     // 168
 */                                                                                      // 169
Iron.utils.notifyDeprecated = function (info) {                                          // 170
  var name;                                                                              // 171
  var instead;                                                                           // 172
  var message;                                                                           // 173
  var where;                                                                             // 174
  var defaultMessage = "[:where] ':name' is deprecated. Please use ':instead' instead."; // 175
                                                                                         // 176
  if (_.isObject(info)) {                                                                // 177
    name = info.name;                                                                    // 178
    instead = info.instead;                                                              // 179
    message = info.message || defaultMessage;                                            // 180
    where = info.where || 'IronRouter';                                                  // 181
  } else {                                                                               // 182
    message = info;                                                                      // 183
    name = '';                                                                           // 184
    instead = '';                                                                        // 185
    where = '';                                                                          // 186
  }                                                                                      // 187
                                                                                         // 188
  if (typeof console !== 'undefined' && console.warn) {                                  // 189
    console.warn(                                                                        // 190
      '<deprecated> ' +                                                                  // 191
      message                                                                            // 192
      .replace(':name', name)                                                            // 193
      .replace(':instead', instead)                                                      // 194
      .replace(':where', where) +                                                        // 195
      ' ' +                                                                              // 196
      (new Error).stack                                                                  // 197
    );                                                                                   // 198
  }                                                                                      // 199
};                                                                                       // 200
                                                                                         // 201
Iron.utils.withDeprecatedNotice = function (info, fn, thisArg) {                         // 202
  return function () {                                                                   // 203
    Utils.notifyDeprecated(info);                                                        // 204
    return fn && fn.apply(thisArg || this, arguments);                                   // 205
  };                                                                                     // 206
};                                                                                       // 207
                                                                                         // 208
// warn if we already have a deprecate prototype                                         // 209
// method on Function!                                                                   // 210
Iron.utils.warn(!Function.prototype.deprecate, "It looks like the Function.prototype already has a deprecate method, and the iron-router package is about to override it!");
                                                                                         // 212
// so we can do this:                                                                    // 213
//   getController: function () {                                                        // 214
//    ...                                                                                // 215
//   }.deprecate({...})                                                                  // 216
Function.prototype.deprecate = function (info) {                                         // 217
  var fn = this;                                                                         // 218
  return Iron.utils.withDeprecatedNotice(info, fn);                                      // 219
};                                                                                       // 220
                                                                                         // 221
/**                                                                                      // 222
 * Returns a function that can be used to log debug messages for a given                 // 223
 * package.                                                                              // 224
 */                                                                                      // 225
Iron.utils.debug = function (package) {                                                  // 226
  Iron.utils.assert(typeof package === 'string', "debug requires a package name");       // 227
                                                                                         // 228
  return function debug (/* args */) {                                                   // 229
    if (console && console.log && Iron.utils.debug === true) {                           // 230
      var msg = _.toArray(arguments).join(' ');                                          // 231
      console.log("%c<" + package + "> %c" + msg, "color: #999;", "color: #000;");       // 232
    }                                                                                    // 233
  };                                                                                     // 234
};                                                                                       // 235
                                                                                         // 236
///////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['iron-core'] = {
  Iron: Iron
};

})();

//# sourceMappingURL=iron-core.js.map
