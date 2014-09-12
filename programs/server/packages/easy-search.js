(function () {

/* Imports */
var _ = Package.underscore._;
var DDP = Package.livedata.DDP;
var DDPServer = Package.livedata.DDPServer;
var MongoInternals = Package['mongo-livedata'].MongoInternals;
var Meteor = Package.meteor.Meteor;
var WebApp = Package.webapp.WebApp;
var main = Package.webapp.main;
var WebAppInternals = Package.webapp.WebAppInternals;
var Log = Package.logging.Log;
var Deps = Package.deps.Deps;
var UI = Package.ui.UI;
var Handlebars = Package.ui.Handlebars;
var Spacebars = Package.spacebars.Spacebars;
var check = Package.check.check;
var Match = Package.check.Match;
var Random = Package.random.Random;
var EJSON = Package.ejson.EJSON;
var HTML = Package.htmljs.HTML;
var Blaze = Package.blaze.Blaze;

/* Package-scope variables */
var EasySearch;

(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/easy-search/lib/easy-search-server.js                                                                      //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
/**                                                                                                                    // 1
 * @title EasySearch Server Methods                                                                                    // 2
 * @overview These are all the methods exposed on the Server.                                                          // 3
 * @author Matteo De Micheli                                                                                           // 4
 * @license MIT                                                                                                        // 5
 *                                                                                                                     // 6
 */                                                                                                                    // 7
                                                                                                                       // 8
EasySearch = (function () {                                                                                            // 9
    'use strict';                                                                                                      // 10
                                                                                                                       // 11
    var ElasticSearchClient,                                                                                           // 12
        Searchers,                                                                                                     // 13
        indexes = {                                                                                                    // 14
            /*                                                                                                         // 15
            collection: Meteor.Collection (required),                                                                  // 16
            field: [string] || string (required),                                                                      // 17
            sort: function (searchFields),                                                                             // 18
            query : function (searchFields),                                                                           // 19
            limit: number (default: 10)                                                                                // 20
            format: string (default: mongo),                                                                           // 21
            use : string (default: 'mongo-db')                                                                         // 22
                                                                                                                       // 23
            @see defaultOptions                                                                                        // 24
            */                                                                                                         // 25
        },                                                                                                             // 26
        // Default config used in EasySearch.config()                                                                  // 27
        config = {                                                                                                     // 28
            host : 'localhost:9200'                                                                                    // 29
        },                                                                                                             // 30
        // Default options used in EasySearch.createSearchIndex()                                                      // 31
        defaultOptions = {                                                                                             // 32
            'format' : 'mongo',                                                                                        // 33
            'limit' : 10,                                                                                              // 34
            /* also useable: 'elastic-search' */                                                                       // 35
            'use' : 'mongo-db',                                                                                        // 36
            'sort' : function () {                                                                                     // 37
                return Searchers[this.use].defaultSort(this);                                                          // 38
            },                                                                                                         // 39
            /*                                                                                                         // 40
             * When using elastic-search it's the query object,                                                        // 41
             * while using with mongo-db it's the selector object.                                                     // 42
             *                                                                                                         // 43
             * @param {String} searchString                                                                            // 44
             * @return {Object}                                                                                        // 45
             */                                                                                                        // 46
            'query' : function (searchString) {                                                                        // 47
                return Searchers[this.use].defaultQuery(this, searchString);                                           // 48
            }                                                                                                          // 49
        },                                                                                                             // 50
        Future = Npm.require('fibers/future'),                                                                         // 51
        ElasticSearch = Npm.require('elasticsearch');                                                                  // 52
                                                                                                                       // 53
    /**                                                                                                                // 54
     * Return Elastic Search indexable data.                                                                           // 55
     *                                                                                                                 // 56
     * @param {Object} doc      the document to get the values from                                                    // 57
     * @return {Object}                                                                                                // 58
     */                                                                                                                // 59
    function getESFields(doc) {                                                                                        // 60
        var newDoc = {};                                                                                               // 61
                                                                                                                       // 62
        _.each(doc, function (value, key) {                                                                            // 63
            newDoc[key] = "string" === typeof value ? value : JSON.stringify(value);                                   // 64
        });                                                                                                            // 65
                                                                                                                       // 66
        return newDoc;                                                                                                 // 67
    }                                                                                                                  // 68
                                                                                                                       // 69
    /**                                                                                                                // 70
     * Searchers which contain all types which can be used to search content, until now:                               // 71
     *                                                                                                                 // 72
     * elastic-search: Use an elastic search server to search with (fast)                                              // 73
     * mongo-db: Use mongodb to search (more convenient)                                                               // 74
     */                                                                                                                // 75
    Searchers = {                                                                                                      // 76
        'elastic-search' : {                                                                                           // 77
            /**                                                                                                        // 78
             * Write a document to a specified index.                                                                  // 79
             *                                                                                                         // 80
             * @param {String} name                                                                                    // 81
             * @param {Object} doc                                                                                     // 82
             * @param {String} id                                                                                      // 83
             */                                                                                                        // 84
            'writeToIndex' : function (name, doc, id) {                                                                // 85
                // add to index                                                                                        // 86
                ElasticSearchClient.index({                                                                            // 87
                    index : name,                                                                                      // 88
                    type : 'default',                                                                                  // 89
                    id : id,                                                                                           // 90
                    body : doc                                                                                         // 91
                }, function (err, data) {                                                                              // 92
                    if (err) {                                                                                         // 93
                        console.log('Had error adding a document!');                                                   // 94
                        console.log(err);                                                                              // 95
                    }                                                                                                  // 96
                                                                                                                       // 97
                    if (config.debug && console) {                                                                     // 98
                        console.log('EasySearch: Added / Replaced document to Elastic Search:');                       // 99
                        console.log('EasySearch: ' + data + "\n");                                                     // 100
                    }                                                                                                  // 101
                });                                                                                                    // 102
            },                                                                                                         // 103
            /**                                                                                                        // 104
             * Setup some observers on the mongo db collection provided.                                               // 105
             *                                                                                                         // 106
             * @param {String} name                                                                                    // 107
             * @param {Object} options                                                                                 // 108
             */                                                                                                        // 109
            'createSearchIndex' : function (name, options) {                                                           // 110
                var searcherScope = this;                                                                              // 111
                                                                                                                       // 112
                if ("undefined" === typeof ElasticSearchClient) {                                                      // 113
                    ElasticSearchClient = new ElasticSearch.Client(config);                                            // 114
                }                                                                                                      // 115
                                                                                                                       // 116
                options.collection.find().observeChanges({                                                             // 117
                    added: function (id, fields) {                                                                     // 118
                        searcherScope.writeToIndex(name, getESFields(fields), id);                                     // 119
                    },                                                                                                 // 120
                    changed: function (id, fields) {                                                                   // 121
                        // Overwrites the current document with the new doc                                            // 122
                        searcherScope.writeToIndex(name, getESFields(options.collection.findOne(id)), id);             // 123
                    },                                                                                                 // 124
                    removed: function (id) {                                                                           // 125
                        client.delete({                                                                                // 126
                          index: name,                                                                                 // 127
                          type: 'default',                                                                             // 128
                          id: id                                                                                       // 129
                        }, function (error, response) {                                                                // 130
                          console.log('Removed document with id ( ' +  id + ' )!');                                    // 131
                          console.log(error);                                                                          // 132
                        });                                                                                            // 133
                    }                                                                                                  // 134
                });                                                                                                    // 135
            },                                                                                                         // 136
            /**                                                                                                        // 137
             * Get the data out of the JSON elastic search response.                                                   // 138
             *                                                                                                         // 139
             * @param {Object} data                                                                                    // 140
             * @returns {Array}                                                                                        // 141
             */                                                                                                        // 142
            'extractJSONData' : function (data) {                                                                      // 143
                data = _.isString(data) ? JSON.parse(data) : data;                                                     // 144
                                                                                                                       // 145
                var results = _.map(data.hits.hits, function (resultSet) {                                             // 146
                    var mongoDbDocFake = resultSet['_source'];                                                         // 147
                                                                                                                       // 148
                    mongoDbDocFake['_id'] = resultSet['_id'];                                                          // 149
                                                                                                                       // 150
                    return resultSet['_source'];                                                                       // 151
                });                                                                                                    // 152
                                                                                                                       // 153
                return {                                                                                               // 154
                    'results' : results,                                                                               // 155
                    'total' : data.hits.total                                                                          // 156
                };                                                                                                     // 157
            },                                                                                                         // 158
            /**                                                                                                        // 159
             * Perform a search with Elastic Search, using fibers.                                                     // 160
             *                                                                                                         // 161
             * @param {String} name                                                                                    // 162
             * @param {String} searchString                                                                            // 163
             * @param {Object} options                                                                                 // 164
             * @param {Function} callback                                                                              // 165
             * @returns {*}                                                                                            // 166
             */                                                                                                        // 167
            'search' : function (name, searchString, options, callback) {                                              // 168
                var bodyObj,                                                                                           // 169
                    that = this,                                                                                       // 170
                    fut = new Future(),                                                                                // 171
                    index = indexes[name],                                                                             // 172
                    searchFields = options.field;                                                                      // 173
                                                                                                                       // 174
                if (!_.isObject(index)) {                                                                              // 175
                    return;                                                                                            // 176
                }                                                                                                      // 177
                                                                                                                       // 178
                bodyObj = {                                                                                            // 179
                    "query" : index.query(searchString),                                                               // 180
                    "sort" : index.sort(searchString),                                                                 // 181
                    "size" : options.limit                                                                             // 182
                };                                                                                                     // 183
                                                                                                                       // 184
                if ("function" === typeof callback) {                                                                  // 185
                    ElasticSearchClient.search(name, queryObj, callback);                                              // 186
                    return;                                                                                            // 187
                }                                                                                                      // 188
                                                                                                                       // 189
                // Most likely client call, return data set                                                            // 190
                ElasticSearchClient.search({                                                                           // 191
                    index : name,                                                                                      // 192
                    body : bodyObj                                                                                     // 193
                }, function (error, data) {                                                                            // 194
                    if (error) {                                                                                       // 195
                        console.log('Had an error while searching!');                                                  // 196
                        console.log(error);                                                                            // 197
                        return;                                                                                        // 198
                    }                                                                                                  // 199
                                                                                                                       // 200
                    if ("raw" !== index.format) {                                                                      // 201
                        data = that.extractJSONData(data);                                                             // 202
                    }                                                                                                  // 203
                                                                                                                       // 204
                    fut['return'](data);                                                                               // 205
                });                                                                                                    // 206
                                                                                                                       // 207
                return fut.wait();                                                                                     // 208
            },                                                                                                         // 209
            /**                                                                                                        // 210
             * The default ES query object used for searching the results.                                             // 211
             *                                                                                                         // 212
             * @param {Object} options                                                                                 // 213
             * @return array                                                                                           // 214
             */                                                                                                        // 215
            'defaultQuery' : function (options, searchString) {                                                        // 216
                return {                                                                                               // 217
                    "fuzzy_like_this" : {                                                                              // 218
                        "fields" : options.field,                                                                      // 219
                        "like_text" : searchString                                                                     // 220
                    }                                                                                                  // 221
                };                                                                                                     // 222
            },                                                                                                         // 223
            /**                                                                                                        // 224
             * The default ES sorting method used for sorting the results.                                             // 225
             *                                                                                                         // 226
             * @param {Object} options                                                                                 // 227
             * @return array                                                                                           // 228
             */                                                                                                        // 229
            'defaultSort' : function (options) {                                                                       // 230
                return options.field;                                                                                  // 231
            }                                                                                                          // 232
        },                                                                                                             // 233
        'mongo-db' : {                                                                                                 // 234
            /**                                                                                                        // 235
             * Set up a search index.                                                                                  // 236
             *                                                                                                         // 237
             * @param name                                                                                             // 238
             * @param options                                                                                          // 239
             * @returns {*}                                                                                            // 240
             */                                                                                                        // 241
            'createSearchIndex' : function (name, options) {                                                           // 242
                // Don't have to setup anything                                                                        // 243
            },                                                                                                         // 244
            /**                                                                                                        // 245
             *                                                                                                         // 246
             * Perform a really simple search with mongo db.                                                           // 247
             *                                                                                                         // 248
             * @param {String} name                                                                                    // 249
             * @param {String} searchString                                                                            // 250
             * @param {Object} options                                                                                 // 251
             * @param {Function} callback                                                                              // 252
             * @returns {*}                                                                                            // 253
             */                                                                                                        // 254
            'search' : function (name, searchString, options, callback) {                                              // 255
                var cursor,                                                                                            // 256
                    selector,                                                                                          // 257
                    that = this,                                                                                       // 258
                    index = indexes[name];                                                                             // 259
                                                                                                                       // 260
                if (!_.isObject(index)) {                                                                              // 261
                    return;                                                                                            // 262
                }                                                                                                      // 263
                                                                                                                       // 264
                options.limit = options.limit || 10;                                                                   // 265
                                                                                                                       // 266
                // if several, fields do an $or search, otherwise only over the field                                  // 267
                selector = index.query(searchString);                                                                  // 268
                                                                                                                       // 269
                cursor = index.collection.find(selector, {                                                             // 270
                    sort : index.sort(searchString)                                                                    // 271
                });                                                                                                    // 272
                                                                                                                       // 273
                if (_.isFunction(callback)) {                                                                          // 274
                    callback({                                                                                         // 275
                        'results' : _.first(cursor.fetch(), options.limit),                                            // 276
                        'total' : cursor.count()                                                                       // 277
                    });                                                                                                // 278
                }                                                                                                      // 279
                                                                                                                       // 280
                return {                                                                                               // 281
                    'results' : _.first(cursor.fetch(), options.limit),                                                // 282
                    'total' : cursor.count()                                                                           // 283
                };                                                                                                     // 284
            },                                                                                                         // 285
            /**                                                                                                        // 286
             * The default mongo-db query - selector used for searching.                                               // 287
             *                                                                                                         // 288
             * @param {Object} index                                                                                   // 289
             * @param {String} searchString                                                                            // 290
             * @param {Obejct} options                                                                                 // 291
             * @returns {Object}                                                                                       // 292
             */                                                                                                        // 293
            'defaultQuery' : function (options, searchString) {                                                        // 294
                var orSelector,                                                                                        // 295
                    selector = {},                                                                                     // 296
                    field = options.field,                                                                             // 297
                    stringSelector = { '$regex' : '.*' + searchString + '.*', '$options' : '-i' };                     // 298
                                                                                                                       // 299
                if (_.isString(field)) {                                                                               // 300
                    selector[field] = stringSelector;                                                                  // 301
                    return selector;                                                                                   // 302
                }                                                                                                      // 303
                                                                                                                       // 304
                // Convert numbers if configured                                                                       // 305
                if (options.convertNumbers && parseInt(searchString, 10) == searchString) {                            // 306
                    searchString = parseInt(searchString, 10);                                                         // 307
                }                                                                                                      // 308
                                                                                                                       // 309
                // Should be an array                                                                                  // 310
                selector['$or'] = [];                                                                                  // 311
                                                                                                                       // 312
                _.each(field, function (fieldString) {                                                                 // 313
                    orSelector = {};                                                                                   // 314
                                                                                                                       // 315
                    if (_.isString(searchString)) {                                                                    // 316
                        orSelector[fieldString] = stringSelector;                                                      // 317
                    } else if (_.isNumber(searchString)) {                                                             // 318
                        orSelector[fieldString] = searchString;                                                        // 319
                    }                                                                                                  // 320
                                                                                                                       // 321
                    selector['$or'].push(orSelector);                                                                  // 322
                });                                                                                                    // 323
                                                                                                                       // 324
                return selector;                                                                                       // 325
            },                                                                                                         // 326
            /**                                                                                                        // 327
             * The default mongo-db sorting method used for sorting the results.                                       // 328
             *                                                                                                         // 329
             * @param {Object} options                                                                                 // 330
             * @return array                                                                                           // 331
             */                                                                                                        // 332
            'defaultSort' : function (options) {                                                                       // 333
                return options.field;                                                                                  // 334
            }                                                                                                          // 335
        }                                                                                                              // 336
    };                                                                                                                 // 337
                                                                                                                       // 338
    return {                                                                                                           // 339
        /**                                                                                                            // 340
         * Override the config for Elastic Search.                                                                     // 341
         *                                                                                                             // 342
         * @param {object} newConfig                                                                                   // 343
         */                                                                                                            // 344
        'config' : function (newConfig) {                                                                              // 345
            if ("undefined" === typeof newConfig) {                                                                    // 346
                return config;                                                                                         // 347
            }                                                                                                          // 348
                                                                                                                       // 349
            check(newConfig, Object);                                                                                  // 350
                                                                                                                       // 351
            config = _.extend(config, newConfig);                                                                      // 352
            ElasticSearchClient = new ElasticSearch.Client(config);                                                    // 353
        },                                                                                                             // 354
        /**                                                                                                            // 355
         * Create a search index.                                                                                      // 356
         *                                                                                                             // 357
         * @param {String} name                                                                                        // 358
         * @param {Object} options                                                                                     // 359
         */                                                                                                            // 360
        'createSearchIndex' : function (name, options) {                                                               // 361
            check(name, String);                                                                                       // 362
            check(options, Object);                                                                                    // 363
                                                                                                                       // 364
            options = _.extend(_.clone(defaultOptions), options);                                                      // 365
                                                                                                                       // 366
            check(Searchers[options.use], Object);                                                                     // 367
            options.field = _.isArray(options.field) ? options.field : [options.field];                                // 368
            indexes[name] = options;                                                                                   // 369
                                                                                                                       // 370
            Searchers[options.use].createSearchIndex(name, options);                                                   // 371
        },                                                                                                             // 372
        /**                                                                                                            // 373
         * Perform a search.                                                                                           // 374
         *                                                                                                             // 375
         * @param {String} name             the search index                                                           // 376
         * @param {String} searchString     the string to be searched                                                  // 377
         * @param {Object} options          defined with createSearchInde                                              // 378
         * @param {Function} callback       optional callback to be used                                               // 379
         */                                                                                                            // 380
        'search' : function (name, searchString, options, callback) {                                                  // 381
            var searcherType = indexes[name].use;                                                                      // 382
                                                                                                                       // 383
            check(name, String);                                                                                       // 384
            check(searchString, String);                                                                               // 385
            check(options, Object);                                                                                    // 386
            check(callback, Match.Optional(Function));                                                                 // 387
                                                                                                                       // 388
            if ("undefined" === typeof Searchers[searcherType]) {                                                      // 389
                throw new Meteor.Error(500, "Couldnt search with the type: '" + searcherType + "'");                   // 390
            }                                                                                                          // 391
                                                                                                                       // 392
            // If custom permission check fails                                                                        // 393
            if (_.isFunction(indexes[name].permission)                                                                 // 394
                    && !indexes[name].permission(searchString)) {                                                      // 395
                return { 'results' : [], 'total' : 0 };                                                                // 396
            } else {                                                                                                   // 397
                return Searchers[searcherType].search(name, searchString, _.extend(indexes[name], options), callback); // 398
            }                                                                                                          // 399
        },                                                                                                             // 400
        /**                                                                                                            // 401
         * Get the ElasticSearchClient                                                                                 // 402
         * @see http://www.elasticsearch.org/guide/en/elasticsearch/client/javascript-api/current                      // 403
         *                                                                                                             // 404
         * @return {ElasticSearchInstance}                                                                             // 405
         */                                                                                                            // 406
        'getElasticSearchClient' : function () {                                                                       // 407
            return ElasticSearchClient;                                                                                // 408
        },                                                                                                             // 409
        /**                                                                                                            // 410
         * Retrieve a specific index configuration.                                                                    // 411
         *                                                                                                             // 412
         * @param {String} name                                                                                        // 413
         * @return {Object}                                                                                            // 414
         * @api public                                                                                                 // 415
         */                                                                                                            // 416
        'getIndex' : function (name) {                                                                                 // 417
            return indexes[name];                                                                                      // 418
        },                                                                                                             // 419
        /**                                                                                                            // 420
          * Retrieve all index configurations                                                                          // 421
          */                                                                                                           // 422
        'getIndexes' : function () {                                                                                   // 423
            return indexes;                                                                                            // 424
        },                                                                                                             // 425
        /**                                                                                                            // 426
         * Retrieve a specific Seacher.                                                                                // 427
         *                                                                                                             // 428
         * @param {String} name                                                                                        // 429
         * @return {Object}                                                                                            // 430
         * @api public                                                                                                 // 431
         */                                                                                                            // 432
        'getSearcher' : function (name) {                                                                              // 433
            return Searchers[name];                                                                                    // 434
        },                                                                                                             // 435
        /**                                                                                                            // 436
         * Retrieve all Searchers                                                                                      // 437
         */                                                                                                            // 438
        'getSearchers' : function () {                                                                                 // 439
            return Searchers;                                                                                          // 440
        },                                                                                                             // 441
        /**                                                                                                            // 442
         * Makes it possible to override or extend the different                                                       // 443
         * types of search to use with EasySearch (the "use" property)                                                 // 444
         * when using EasySearch.createSearchIndex()                                                                   // 445
         *                                                                                                             // 446
         * @param {String} key      Type, e.g. mongo-db, elastic-search                                                // 447
         * @param {Object} methods  Methods to be used, only 2 are required:                                           // 448
         *                          - createSearchIndex (name, options)                                                // 449
         *                          - search (name, searchString, [options, callback])                                 // 450
         */                                                                                                            // 451
        'extendSearch' : function (key, methods) {                                                                     // 452
            check(key, String);                                                                                        // 453
            check(methods.search, Function);                                                                           // 454
            check(methods.createSearchIndex, Function);                                                                // 455
                                                                                                                       // 456
            Searchers[key] = methods;                                                                                  // 457
        }                                                                                                              // 458
    };                                                                                                                 // 459
})();                                                                                                                  // 460
                                                                                                                       // 461
Meteor.methods({                                                                                                       // 462
    /**                                                                                                                // 463
     * Make search possible on the client.                                                                             // 464
     *                                                                                                                 // 465
     * @param {String} name                                                                                            // 466
     * @param {String} searchString                                                                                    // 467
     */                                                                                                                // 468
    easySearch: function (name, searchString, options) {                                                               // 469
        check(name, String);                                                                                           // 470
        check(searchString, String);                                                                                   // 471
        check(options, Object);                                                                                        // 472
        return EasySearch.search(name, searchString, options);                                                         // 473
    }                                                                                                                  // 474
});                                                                                                                    // 475
                                                                                                                       // 476
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/easy-search/lib/easy-search-convenience.js                                                                 //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
Meteor.Collection.prototype.initEasySearch = function (fields, options) {                                              // 1
    if (!_.isObject(options)) {                                                                                        // 2
        options = {};                                                                                                  // 3
    }                                                                                                                  // 4
                                                                                                                       // 5
    EasySearch.createSearchIndex(this._name, _.extend(options, {                                                       // 6
        'collection' : this,                                                                                           // 7
        'field' : fields                                                                                               // 8
    }));                                                                                                               // 9
};                                                                                                                     // 10
                                                                                                                       // 11
if (Meteor.isClient) {                                                                                                 // 12
    jQuery.fn.esAutosuggestData = function () {                                                                        // 13
        var id,                                                                                                        // 14
            input = $(this);                                                                                           // 15
                                                                                                                       // 16
        if (input.prop("tagName") !== 'INPUT') {                                                                       // 17
            return [];                                                                                                 // 18
        }                                                                                                              // 19
                                                                                                                       // 20
        id = EasySearch.Components.generateId(input.parent().data('index'), input.parent().data('id'));                // 21
                                                                                                                       // 22
        return EasySearch.ComponentVariables.get(id, 'autosuggestSelected');                                           // 23
    }                                                                                                                  // 24
}                                                                                                                      // 25
                                                                                                                       // 26
                                                                                                                       // 27
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['easy-search'] = {
  EasySearch: EasySearch
};

})();

//# sourceMappingURL=easy-search.js.map
