(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var Random = Package.random.Random;
var ServiceConfiguration = Package['service-configuration'].ServiceConfiguration;
var OAuth = Package.oauth.OAuth;
var Oauth = Package.oauth.Oauth;
var _ = Package.underscore._;
var HTTP = Package.http.HTTP;

/* Package-scope variables */
var OAuth1Binding, OAuth1Test;

(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                     //
// packages/oauth1/oauth1_binding.js                                                                   //
//                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                       //
var crypto = Npm.require("crypto");                                                                    // 1
var querystring = Npm.require("querystring");                                                          // 2
                                                                                                       // 3
// An OAuth1 wrapper around http calls which helps get tokens and                                      // 4
// takes care of HTTP headers                                                                          // 5
//                                                                                                     // 6
// @param config {Object}                                                                              // 7
//   - consumerKey (String): oauth consumer key                                                        // 8
//   - secret (String): oauth consumer secret                                                          // 9
// @param urls {Object}                                                                                // 10
//   - requestToken (String): url                                                                      // 11
//   - authorize (String): url                                                                         // 12
//   - accessToken (String): url                                                                       // 13
//   - authenticate (String): url                                                                      // 14
OAuth1Binding = function(config, urls) {                                                               // 15
  this._config = config;                                                                               // 16
  this._urls = urls;                                                                                   // 17
};                                                                                                     // 18
                                                                                                       // 19
OAuth1Binding.prototype.prepareRequestToken = function(callbackUrl) {                                  // 20
  var self = this;                                                                                     // 21
                                                                                                       // 22
  var headers = self._buildHeader({                                                                    // 23
    oauth_callback: callbackUrl                                                                        // 24
  });                                                                                                  // 25
                                                                                                       // 26
  var response = self._call('POST', self._urls.requestToken, headers);                                 // 27
  var tokens = querystring.parse(response.content);                                                    // 28
                                                                                                       // 29
  if (!tokens.oauth_callback_confirmed)                                                                // 30
    throw new Error(                                                                                   // 31
      "oauth_callback_confirmed false when requesting oauth1 token", tokens);                          // 32
                                                                                                       // 33
  self.requestToken = tokens.oauth_token;                                                              // 34
  self.requestTokenSecret = tokens.oauth_token_secret;                                                 // 35
};                                                                                                     // 36
                                                                                                       // 37
OAuth1Binding.prototype.prepareAccessToken = function(query, requestTokenSecret) {                     // 38
  var self = this;                                                                                     // 39
                                                                                                       // 40
  // support implementations that use request token secrets. This is                                   // 41
  // read by self._call.                                                                               // 42
  //                                                                                                   // 43
  // XXX make it a param to call, not something stashed on self? It's                                  // 44
  // kinda confusing right now, everything except this is passed as                                    // 45
  // arguments, but this is stored.                                                                    // 46
  if (requestTokenSecret)                                                                              // 47
    self.accessTokenSecret = requestTokenSecret;                                                       // 48
                                                                                                       // 49
  var headers = self._buildHeader({                                                                    // 50
    oauth_token: query.oauth_token,                                                                    // 51
    oauth_verifier: query.oauth_verifier                                                               // 52
  });                                                                                                  // 53
                                                                                                       // 54
  var response = self._call('POST', self._urls.accessToken, headers);                                  // 55
  var tokens = querystring.parse(response.content);                                                    // 56
                                                                                                       // 57
  self.accessToken = tokens.oauth_token;                                                               // 58
  self.accessTokenSecret = tokens.oauth_token_secret;                                                  // 59
};                                                                                                     // 60
                                                                                                       // 61
OAuth1Binding.prototype.call = function(method, url, params, callback) {                               // 62
  var self = this;                                                                                     // 63
                                                                                                       // 64
  var headers = self._buildHeader({                                                                    // 65
    oauth_token: self.accessToken                                                                      // 66
  });                                                                                                  // 67
                                                                                                       // 68
  if(!params) {                                                                                        // 69
    params = {};                                                                                       // 70
  }                                                                                                    // 71
                                                                                                       // 72
  return self._call(method, url, headers, params, callback);                                           // 73
};                                                                                                     // 74
                                                                                                       // 75
OAuth1Binding.prototype.get = function(url, params, callback) {                                        // 76
  return this.call('GET', url, params, callback);                                                      // 77
};                                                                                                     // 78
                                                                                                       // 79
OAuth1Binding.prototype.post = function(url, params, callback) {                                       // 80
  return this.call('POST', url, params, callback);                                                     // 81
};                                                                                                     // 82
                                                                                                       // 83
OAuth1Binding.prototype._buildHeader = function(headers) {                                             // 84
  var self = this;                                                                                     // 85
  return _.extend({                                                                                    // 86
    oauth_consumer_key: self._config.consumerKey,                                                      // 87
    oauth_nonce: Random.secret().replace(/\W/g, ''),                                                   // 88
    oauth_signature_method: 'HMAC-SHA1',                                                               // 89
    oauth_timestamp: (new Date().valueOf()/1000).toFixed().toString(),                                 // 90
    oauth_version: '1.0'                                                                               // 91
  }, headers);                                                                                         // 92
};                                                                                                     // 93
                                                                                                       // 94
OAuth1Binding.prototype._getSignature = function(method, url, rawHeaders, accessTokenSecret, params) { // 95
  var self = this;                                                                                     // 96
  var headers = self._encodeHeader(_.extend(rawHeaders, params));                                      // 97
                                                                                                       // 98
  var parameters = _.map(headers, function(val, key) {                                                 // 99
    return key + '=' + val;                                                                            // 100
  }).sort().join('&');                                                                                 // 101
                                                                                                       // 102
  var signatureBase = [                                                                                // 103
    method,                                                                                            // 104
    self._encodeString(url),                                                                           // 105
    self._encodeString(parameters)                                                                     // 106
  ].join('&');                                                                                         // 107
                                                                                                       // 108
  var secret = OAuth.openSecret(self._config.secret);                                                  // 109
                                                                                                       // 110
  var signingKey = self._encodeString(secret) + '&';                                                   // 111
  if (accessTokenSecret)                                                                               // 112
    signingKey += self._encodeString(accessTokenSecret);                                               // 113
                                                                                                       // 114
  return crypto.createHmac('SHA1', signingKey).update(signatureBase).digest('base64');                 // 115
};                                                                                                     // 116
                                                                                                       // 117
OAuth1Binding.prototype._call = function(method, url, headers, params, callback) {                     // 118
  var self = this;                                                                                     // 119
                                                                                                       // 120
  // all URLs to be functions to support parameters/customization                                      // 121
  if(typeof url === "function") {                                                                      // 122
    url = url(self);                                                                                   // 123
  }                                                                                                    // 124
                                                                                                       // 125
  // Get the signature                                                                                 // 126
  headers.oauth_signature =                                                                            // 127
    self._getSignature(method, url, headers, self.accessTokenSecret, params);                          // 128
                                                                                                       // 129
  // Make a authorization string according to oauth1 spec                                              // 130
  var authString = self._getAuthHeaderString(headers);                                                 // 131
                                                                                                       // 132
  // Make signed request                                                                               // 133
  try {                                                                                                // 134
    return HTTP.call(method, url, {                                                                    // 135
      params: params,                                                                                  // 136
      headers: {                                                                                       // 137
        Authorization: authString                                                                      // 138
      }                                                                                                // 139
    }, callback);                                                                                      // 140
  } catch (err) {                                                                                      // 141
    throw _.extend(new Error("Failed to send OAuth1 request to " + url + ". " + err.message),          // 142
                   {response: err.response});                                                          // 143
  }                                                                                                    // 144
};                                                                                                     // 145
                                                                                                       // 146
OAuth1Binding.prototype._encodeHeader = function(header) {                                             // 147
  var self = this;                                                                                     // 148
  return _.reduce(header, function(memo, val, key) {                                                   // 149
    memo[self._encodeString(key)] = self._encodeString(val);                                           // 150
    return memo;                                                                                       // 151
  }, {});                                                                                              // 152
};                                                                                                     // 153
                                                                                                       // 154
OAuth1Binding.prototype._encodeString = function(str) {                                                // 155
  return encodeURIComponent(str).replace(/[!'()]/g, escape).replace(/\*/g, "%2A");                     // 156
};                                                                                                     // 157
                                                                                                       // 158
OAuth1Binding.prototype._getAuthHeaderString = function(headers) {                                     // 159
  var self = this;                                                                                     // 160
  return 'OAuth ' +  _.map(headers, function(val, key) {                                               // 161
    return self._encodeString(key) + '="' + self._encodeString(val) + '"';                             // 162
  }).sort().join(', ');                                                                                // 163
};                                                                                                     // 164
                                                                                                       // 165
/////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                     //
// packages/oauth1/oauth1_server.js                                                                    //
//                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                       //
// connect middleware                                                                                  // 1
OAuth._requestHandlers['1'] = function (service, query, res) {                                         // 2
                                                                                                       // 3
  var config = ServiceConfiguration.configurations.findOne({service: service.serviceName});            // 4
  if (!config) {                                                                                       // 5
    throw new ServiceConfiguration.ConfigError(service.serviceName);                                   // 6
  }                                                                                                    // 7
                                                                                                       // 8
  var urls = service.urls;                                                                             // 9
  var oauthBinding = new OAuth1Binding(config, urls);                                                  // 10
                                                                                                       // 11
  if (query.requestTokenAndRedirect) {                                                                 // 12
    // step 1 - get and store a request token                                                          // 13
    var callbackUrl = Meteor.absoluteUrl("_oauth/" + service.serviceName +                             // 14
                                         "?close&state=" +                                             // 15
                                         query.state);                                                 // 16
                                                                                                       // 17
    // Get a request token to start auth process                                                       // 18
    oauthBinding.prepareRequestToken(callbackUrl);                                                     // 19
                                                                                                       // 20
    // Keep track of request token so we can verify it on the next step                                // 21
    OAuth._storeRequestToken(query.state,                                                              // 22
      oauthBinding.requestToken,                                                                       // 23
      oauthBinding.requestTokenSecret                                                                  // 24
    );                                                                                                 // 25
                                                                                                       // 26
    // support for scope/name parameters                                                               // 27
    var redirectUrl = undefined;                                                                       // 28
    if(typeof urls.authenticate === "function") {                                                      // 29
      redirectUrl = urls.authenticate(oauthBinding);                                                   // 30
    } else {                                                                                           // 31
      redirectUrl = urls.authenticate + '?oauth_token=' + oauthBinding.requestToken;                   // 32
    }                                                                                                  // 33
                                                                                                       // 34
    // redirect to provider login, which will redirect back to "step 2" below                          // 35
    res.writeHead(302, {'Location': redirectUrl});                                                     // 36
    res.end();                                                                                         // 37
  } else {                                                                                             // 38
    // step 2, redirected from provider login - store the result                                       // 39
    // and close the window to allow the login handler to proceed                                      // 40
                                                                                                       // 41
    // Get the user's request token so we can verify it and clear it                                   // 42
    var requestTokenInfo = OAuth._retrieveRequestToken(query.state);                                   // 43
                                                                                                       // 44
    // Verify user authorized access and the oauth_token matches                                       // 45
    // the requestToken from previous step                                                             // 46
    if (query.oauth_token && query.oauth_token === requestTokenInfo.requestToken) {                    // 47
                                                                                                       // 48
      // Prepare the login results before returning.  This way the                                     // 49
      // subsequent call to the `login` method will be immediate.                                      // 50
                                                                                                       // 51
      // Get the access token for signing requests                                                     // 52
      oauthBinding.prepareAccessToken(query, requestTokenInfo.requestTokenSecret);                     // 53
                                                                                                       // 54
      // Run service-specific handler.                                                                 // 55
      var oauthResult = service.handleOauthRequest(oauthBinding);                                      // 56
                                                                                                       // 57
      var credentialSecret = Random.secret();                                                          // 58
                                                                                                       // 59
      // Store the login result so it can be retrieved in another                                      // 60
      // browser tab by the result handler                                                             // 61
      OAuth._storePendingCredential(query.state, {                                                     // 62
        serviceName: service.serviceName,                                                              // 63
        serviceData: oauthResult.serviceData,                                                          // 64
        options: oauthResult.options                                                                   // 65
      }, credentialSecret);                                                                            // 66
    }                                                                                                  // 67
                                                                                                       // 68
    // Either close the window, redirect, or render nothing                                            // 69
    // if all else fails                                                                               // 70
    OAuth._renderOauthResults(res, query, credentialSecret);                                           // 71
  }                                                                                                    // 72
};                                                                                                     // 73
                                                                                                       // 74
/////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                     //
// packages/oauth1/oauth1_pending_request_tokens.js                                                    //
//                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                       //
//                                                                                                     // 1
// _pendingRequestTokens are request tokens that have been received                                    // 2
// but not yet fully authorized (processed).                                                           // 3
//                                                                                                     // 4
// During the oauth1 authorization process, the Meteor App opens                                       // 5
// a pop-up, requests a request token from the oauth1 service, and                                     // 6
// redirects the browser to the oauth1 service for the user                                            // 7
// to grant authorization.  The user is then returned to the                                           // 8
// Meteor Apps' callback url and the request token is verified.                                        // 9
//                                                                                                     // 10
// When Meteor Apps run on multiple servers, it's possible that                                        // 11
// 2 different servers may be used to generate the request token                                       // 12
// and to verify it in the callback once the user has authorized.                                      // 13
//                                                                                                     // 14
// For this reason, the _pendingRequestTokens are stored in the database                               // 15
// so they can be shared across Meteor App servers.                                                    // 16
//                                                                                                     // 17
// XXX This code is fairly similar to oauth/pending_credentials.js --                                  // 18
// maybe we can combine them somehow.                                                                  // 19
                                                                                                       // 20
// Collection containing pending request tokens                                                        // 21
// Has key, requestToken, requestTokenSecret, and createdAt fields.                                    // 22
OAuth._pendingRequestTokens = new Meteor.Collection(                                                   // 23
  "meteor_oauth_pendingRequestTokens", {                                                               // 24
    _preventAutopublish: true                                                                          // 25
  });                                                                                                  // 26
                                                                                                       // 27
OAuth._pendingRequestTokens._ensureIndex('key', {unique: 1});                                          // 28
OAuth._pendingRequestTokens._ensureIndex('createdAt');                                                 // 29
                                                                                                       // 30
                                                                                                       // 31
                                                                                                       // 32
// Periodically clear old entries that never got completed                                             // 33
var _cleanStaleResults = function() {                                                                  // 34
  // Remove request tokens older than 5 minute                                                         // 35
  var timeCutoff = new Date();                                                                         // 36
  timeCutoff.setMinutes(timeCutoff.getMinutes() - 5);                                                  // 37
  OAuth._pendingRequestTokens.remove({ createdAt: { $lt: timeCutoff } });                              // 38
};                                                                                                     // 39
var _cleanupHandle = Meteor.setInterval(_cleanStaleResults, 60 * 1000);                                // 40
                                                                                                       // 41
                                                                                                       // 42
// Stores the key and request token in the _pendingRequestTokens collection.                           // 43
// Will throw an exception if `key` is not a string.                                                   // 44
//                                                                                                     // 45
// @param key {string}                                                                                 // 46
// @param requestToken {string}                                                                        // 47
// @param requestTokenSecret {string}                                                                  // 48
//                                                                                                     // 49
OAuth._storeRequestToken = function (key, requestToken, requestTokenSecret) {                          // 50
  check(key, String);                                                                                  // 51
                                                                                                       // 52
  // We do an upsert here instead of an insert in case the user happens                                // 53
  // to somehow send the same `state` parameter twice during an OAuth                                  // 54
  // login; we don't want a duplicate key error.                                                       // 55
  OAuth._pendingRequestTokens.upsert({                                                                 // 56
    key: key                                                                                           // 57
  }, {                                                                                                 // 58
    key: key,                                                                                          // 59
    requestToken: OAuth.sealSecret(requestToken),                                                      // 60
    requestTokenSecret: OAuth.sealSecret(requestTokenSecret),                                          // 61
    createdAt: new Date()                                                                              // 62
  });                                                                                                  // 63
};                                                                                                     // 64
                                                                                                       // 65
                                                                                                       // 66
// Retrieves and removes a request token from the _pendingRequestTokens collection                     // 67
// Returns an object containing requestToken and requestTokenSecret properties                         // 68
//                                                                                                     // 69
// @param key {string}                                                                                 // 70
//                                                                                                     // 71
OAuth._retrieveRequestToken = function (key) {                                                         // 72
  check(key, String);                                                                                  // 73
                                                                                                       // 74
  var pendingRequestToken = OAuth._pendingRequestTokens.findOne({ key: key });                         // 75
  if (pendingRequestToken) {                                                                           // 76
    OAuth._pendingRequestTokens.remove({ _id: pendingRequestToken._id });                              // 77
    return {                                                                                           // 78
      requestToken: OAuth.openSecret(pendingRequestToken.requestToken),                                // 79
      requestTokenSecret: OAuth.openSecret(                                                            // 80
        pendingRequestToken.requestTokenSecret)                                                        // 81
    };                                                                                                 // 82
  } else {                                                                                             // 83
    return undefined;                                                                                  // 84
  }                                                                                                    // 85
};                                                                                                     // 86
                                                                                                       // 87
/////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package.oauth1 = {
  OAuth1Binding: OAuth1Binding,
  OAuth1Test: OAuth1Test
};

})();

//# sourceMappingURL=oauth1.js.map
