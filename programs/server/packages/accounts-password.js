(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var NpmModuleBcrypt = Package['npm-bcrypt'].NpmModuleBcrypt;
var Accounts = Package['accounts-base'].Accounts;
var SRP = Package.srp.SRP;
var SHA256 = Package.sha.SHA256;
var Email = Package.email.Email;
var Random = Package.random.Random;
var check = Package.check.check;
var Match = Package.check.Match;
var _ = Package.underscore._;
var DDP = Package.livedata.DDP;
var DDPServer = Package.livedata.DDPServer;

(function () {

/////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                         //
// packages/accounts-password/email_templates.js                                           //
//                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////
                                                                                           //
Accounts.emailTemplates = {                                                                // 1
  from: "Meteor Accounts <no-reply@meteor.com>",                                           // 2
  siteName: Meteor.absoluteUrl().replace(/^https?:\/\//, '').replace(/\/$/, ''),           // 3
                                                                                           // 4
  resetPassword: {                                                                         // 5
    subject: function(user) {                                                              // 6
      return "How to reset your password on " + Accounts.emailTemplates.siteName;          // 7
    },                                                                                     // 8
    text: function(user, url) {                                                            // 9
      var greeting = (user.profile && user.profile.name) ?                                 // 10
            ("Hello " + user.profile.name + ",") : "Hello,";                               // 11
      return greeting + "\n"                                                               // 12
        + "\n"                                                                             // 13
        + "To reset your password, simply click the link below.\n"                         // 14
        + "\n"                                                                             // 15
        + url + "\n"                                                                       // 16
        + "\n"                                                                             // 17
        + "Thanks.\n";                                                                     // 18
    }                                                                                      // 19
  },                                                                                       // 20
  verifyEmail: {                                                                           // 21
    subject: function(user) {                                                              // 22
      return "How to verify email address on " + Accounts.emailTemplates.siteName;         // 23
    },                                                                                     // 24
    text: function(user, url) {                                                            // 25
      var greeting = (user.profile && user.profile.name) ?                                 // 26
            ("Hello " + user.profile.name + ",") : "Hello,";                               // 27
      return greeting + "\n"                                                               // 28
        + "\n"                                                                             // 29
        + "To verify your account email, simply click the link below.\n"                   // 30
        + "\n"                                                                             // 31
        + url + "\n"                                                                       // 32
        + "\n"                                                                             // 33
        + "Thanks.\n";                                                                     // 34
    }                                                                                      // 35
  },                                                                                       // 36
  enrollAccount: {                                                                         // 37
    subject: function(user) {                                                              // 38
      return "An account has been created for you on " + Accounts.emailTemplates.siteName; // 39
    },                                                                                     // 40
    text: function(user, url) {                                                            // 41
      var greeting = (user.profile && user.profile.name) ?                                 // 42
            ("Hello " + user.profile.name + ",") : "Hello,";                               // 43
      return greeting + "\n"                                                               // 44
        + "\n"                                                                             // 45
        + "To start using the service, simply click the link below.\n"                     // 46
        + "\n"                                                                             // 47
        + url + "\n"                                                                       // 48
        + "\n"                                                                             // 49
        + "Thanks.\n";                                                                     // 50
    }                                                                                      // 51
  }                                                                                        // 52
};                                                                                         // 53
                                                                                           // 54
/////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                         //
// packages/accounts-password/password_server.js                                           //
//                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////
                                                                                           //
/// BCRYPT                                                                                 // 1
                                                                                           // 2
var bcrypt = NpmModuleBcrypt;                                                              // 3
var bcryptHash = Meteor._wrapAsync(bcrypt.hash);                                           // 4
var bcryptCompare = Meteor._wrapAsync(bcrypt.compare);                                     // 5
                                                                                           // 6
// User records have a 'services.password.bcrypt' field on them to hold                    // 7
// their hashed passwords (unless they have a 'services.password.srp'                      // 8
// field, in which case they will be upgraded to bcrypt the next time                      // 9
// they log in).                                                                           // 10
//                                                                                         // 11
// When the client sends a password to the server, it can either be a                      // 12
// string (the plaintext password) or an object with keys 'digest' and                     // 13
// 'algorithm' (must be "sha-256" for now). The Meteor client always sends                 // 14
// password objects { digest: *, algorithm: "sha-256" }, but DDP clients                   // 15
// that don't have access to SHA can just send plaintext passwords as                      // 16
// strings.                                                                                // 17
//                                                                                         // 18
// When the server receives a plaintext password as a string, it always                    // 19
// hashes it with SHA256 before passing it into bcrypt. When the server                    // 20
// receives a password as an object, it asserts that the algorithm is                      // 21
// "sha-256" and then passes the digest to bcrypt.                                         // 22
                                                                                           // 23
                                                                                           // 24
Accounts._bcryptRounds = 10;                                                               // 25
                                                                                           // 26
// Given a 'password' from the client, extract the string that we should                   // 27
// bcrypt. 'password' can be one of:                                                       // 28
//  - String (the plaintext password)                                                      // 29
//  - Object with 'digest' and 'algorithm' keys. 'algorithm' must be "sha-256".            // 30
//                                                                                         // 31
var getPasswordString = function (password) {                                              // 32
  if (typeof password === "string") {                                                      // 33
    password = SHA256(password);                                                           // 34
  } else { // 'password' is an object                                                      // 35
    if (password.algorithm !== "sha-256") {                                                // 36
      throw new Error("Invalid password hash algorithm. " +                                // 37
                      "Only 'sha-256' is allowed.");                                       // 38
    }                                                                                      // 39
    password = password.digest;                                                            // 40
  }                                                                                        // 41
  return password;                                                                         // 42
};                                                                                         // 43
                                                                                           // 44
// Use bcrypt to hash the password for storage in the database.                            // 45
// `password` can be a string (in which case it will be run through                        // 46
// SHA256 before bcrypt) or an object with properties `digest` and                         // 47
// `algorithm` (in which case we bcrypt `password.digest`).                                // 48
//                                                                                         // 49
var hashPassword = function (password) {                                                   // 50
  password = getPasswordString(password);                                                  // 51
  return bcryptHash(password, Accounts._bcryptRounds);                                     // 52
};                                                                                         // 53
                                                                                           // 54
// Check whether the provided password matches the bcrypt'ed password in                   // 55
// the database user record. `password` can be a string (in which case                     // 56
// it will be run through SHA256 before bcrypt) or an object with                          // 57
// properties `digest` and `algorithm` (in which case we bcrypt                            // 58
// `password.digest`).                                                                     // 59
//                                                                                         // 60
Accounts._checkPassword = function (user, password) {                                      // 61
  var result = {                                                                           // 62
    userId: user._id                                                                       // 63
  };                                                                                       // 64
                                                                                           // 65
  password = getPasswordString(password);                                                  // 66
                                                                                           // 67
  if (! bcryptCompare(password, user.services.password.bcrypt)) {                          // 68
    result.error = new Meteor.Error(403, "Incorrect password");                            // 69
  }                                                                                        // 70
                                                                                           // 71
  return result;                                                                           // 72
};                                                                                         // 73
var checkPassword = Accounts._checkPassword;                                               // 74
                                                                                           // 75
///                                                                                        // 76
/// LOGIN                                                                                  // 77
///                                                                                        // 78
                                                                                           // 79
// Users can specify various keys to identify themselves with.                             // 80
// @param user {Object} with one of `id`, `username`, or `email`.                          // 81
// @returns A selector to pass to mongo to get the user record.                            // 82
                                                                                           // 83
var selectorFromUserQuery = function (user) {                                              // 84
  if (user.id)                                                                             // 85
    return {_id: user.id};                                                                 // 86
  else if (user.username)                                                                  // 87
    return {username: user.username};                                                      // 88
  else if (user.email)                                                                     // 89
    return {"emails.address": user.email};                                                 // 90
  throw new Error("shouldn't happen (validation missed something)");                       // 91
};                                                                                         // 92
                                                                                           // 93
var findUserFromUserQuery = function (user) {                                              // 94
  var selector = selectorFromUserQuery(user);                                              // 95
                                                                                           // 96
  var user = Meteor.users.findOne(selector);                                               // 97
  if (!user)                                                                               // 98
    throw new Meteor.Error(403, "User not found");                                         // 99
                                                                                           // 100
  return user;                                                                             // 101
};                                                                                         // 102
                                                                                           // 103
// XXX maybe this belongs in the check package                                             // 104
var NonEmptyString = Match.Where(function (x) {                                            // 105
  check(x, String);                                                                        // 106
  return x.length > 0;                                                                     // 107
});                                                                                        // 108
                                                                                           // 109
var userQueryValidator = Match.Where(function (user) {                                     // 110
  check(user, {                                                                            // 111
    id: Match.Optional(NonEmptyString),                                                    // 112
    username: Match.Optional(NonEmptyString),                                              // 113
    email: Match.Optional(NonEmptyString)                                                  // 114
  });                                                                                      // 115
  if (_.keys(user).length !== 1)                                                           // 116
    throw new Match.Error("User property must have exactly one field");                    // 117
  return true;                                                                             // 118
});                                                                                        // 119
                                                                                           // 120
var passwordValidator = Match.OneOf(                                                       // 121
  String,                                                                                  // 122
  { digest: String, algorithm: String }                                                    // 123
);                                                                                         // 124
                                                                                           // 125
// Handler to login with a password.                                                       // 126
//                                                                                         // 127
// The Meteor client sets options.password to an object with keys                          // 128
// 'digest' (set to SHA256(password)) and 'algorithm' ("sha-256").                         // 129
//                                                                                         // 130
// For other DDP clients which don't have access to SHA, the handler                       // 131
// also accepts the plaintext password in options.password as a string.                    // 132
//                                                                                         // 133
// (It might be nice if servers could turn the plaintext password                          // 134
// option off. Or maybe it should be opt-in, not opt-out?                                  // 135
// Accounts.config option?)                                                                // 136
//                                                                                         // 137
// Note that neither password option is secure without SSL.                                // 138
//                                                                                         // 139
Accounts.registerLoginHandler("password", function (options) {                             // 140
  if (! options.password || options.srp)                                                   // 141
    return undefined; // don't handle                                                      // 142
                                                                                           // 143
  check(options, {                                                                         // 144
    user: userQueryValidator,                                                              // 145
    password: passwordValidator                                                            // 146
  });                                                                                      // 147
                                                                                           // 148
                                                                                           // 149
  var user = findUserFromUserQuery(options.user);                                          // 150
                                                                                           // 151
  if (!user.services || !user.services.password ||                                         // 152
      !(user.services.password.bcrypt || user.services.password.srp))                      // 153
    throw new Meteor.Error(403, "User has no password set");                               // 154
                                                                                           // 155
  if (!user.services.password.bcrypt) {                                                    // 156
    if (typeof options.password === "string") {                                            // 157
      // The client has presented a plaintext password, and the user is                    // 158
      // not upgraded to bcrypt yet. We don't attempt to tell the client                   // 159
      // to upgrade to bcrypt, because it might be a standalone DDP                        // 160
      // client doesn't know how to do such a thing.                                       // 161
      var verifier = user.services.password.srp;                                           // 162
      var newVerifier = SRP.generateVerifier(options.password, {                           // 163
        identity: verifier.identity, salt: verifier.salt});                                // 164
                                                                                           // 165
      if (verifier.verifier !== newVerifier.verifier) {                                    // 166
        return {                                                                           // 167
          userId: user._id,                                                                // 168
          error: new Meteor.Error(403, "Incorrect password")                               // 169
        };                                                                                 // 170
      }                                                                                    // 171
                                                                                           // 172
      return {userId: user._id};                                                           // 173
    } else {                                                                               // 174
      // Tell the client to use the SRP upgrade process.                                   // 175
      throw new Meteor.Error(400, "old password format", EJSON.stringify({                 // 176
        format: 'srp',                                                                     // 177
        identity: user.services.password.srp.identity                                      // 178
      }));                                                                                 // 179
    }                                                                                      // 180
  }                                                                                        // 181
                                                                                           // 182
  return checkPassword(                                                                    // 183
    user,                                                                                  // 184
    options.password                                                                       // 185
  );                                                                                       // 186
});                                                                                        // 187
                                                                                           // 188
// Handler to login using the SRP upgrade path. To use this login                          // 189
// handler, the client must provide:                                                       // 190
//   - srp: H(identity + ":" + password)                                                   // 191
//   - password: a string or an object with properties 'digest' and 'algorithm'            // 192
//                                                                                         // 193
// We use `options.srp` to verify that the client knows the correct                        // 194
// password without doing a full SRP flow. Once we've checked that, we                     // 195
// upgrade the user to bcrypt and remove the SRP information from the                      // 196
// user document.                                                                          // 197
//                                                                                         // 198
// The client ends up using this login handler after trying the normal                     // 199
// login handler (above), which throws an error telling the client to                      // 200
// try the SRP upgrade path.                                                               // 201
//                                                                                         // 202
// XXX COMPAT WITH 0.8.1.3                                                                 // 203
Accounts.registerLoginHandler("password", function (options) {                             // 204
  if (!options.srp || !options.password)                                                   // 205
    return undefined; // don't handle                                                      // 206
                                                                                           // 207
  check(options, {                                                                         // 208
    user: userQueryValidator,                                                              // 209
    srp: String,                                                                           // 210
    password: passwordValidator                                                            // 211
  });                                                                                      // 212
                                                                                           // 213
  var user = findUserFromUserQuery(options.user);                                          // 214
                                                                                           // 215
  // Check to see if another simultaneous login has already upgraded                       // 216
  // the user record to bcrypt.                                                            // 217
  if (user.services && user.services.password && user.services.password.bcrypt)            // 218
    return checkPassword(user, options.password);                                          // 219
                                                                                           // 220
  if (!(user.services && user.services.password && user.services.password.srp))            // 221
    throw new Meteor.Error(403, "User has no password set");                               // 222
                                                                                           // 223
  var v1 = user.services.password.srp.verifier;                                            // 224
  var v2 = SRP.generateVerifier(                                                           // 225
    null,                                                                                  // 226
    {                                                                                      // 227
      hashedIdentityAndPassword: options.srp,                                              // 228
      salt: user.services.password.srp.salt                                                // 229
    }                                                                                      // 230
  ).verifier;                                                                              // 231
  if (v1 !== v2)                                                                           // 232
    return {                                                                               // 233
      userId: user._id,                                                                    // 234
      error: new Meteor.Error(403, "Incorrect password")                                   // 235
    };                                                                                     // 236
                                                                                           // 237
  // Upgrade to bcrypt on successful login.                                                // 238
  var salted = hashPassword(options.password);                                             // 239
  Meteor.users.update(                                                                     // 240
    user._id,                                                                              // 241
    {                                                                                      // 242
      $unset: { 'services.password.srp': 1 },                                              // 243
      $set: { 'services.password.bcrypt': salted }                                         // 244
    }                                                                                      // 245
  );                                                                                       // 246
                                                                                           // 247
  return {userId: user._id};                                                               // 248
});                                                                                        // 249
                                                                                           // 250
                                                                                           // 251
///                                                                                        // 252
/// CHANGING                                                                               // 253
///                                                                                        // 254
                                                                                           // 255
// Let the user change their own password if they know the old                             // 256
// password. `oldPassword` and `newPassword` should be objects with keys                   // 257
// `digest` and `algorithm` (representing the SHA256 of the password).                     // 258
//                                                                                         // 259
// XXX COMPAT WITH 0.8.1.3                                                                 // 260
// Like the login method, if the user hasn't been upgraded from SRP to                     // 261
// bcrypt yet, then this method will throw an 'old password format'                        // 262
// error. The client should call the SRP upgrade login handler and then                    // 263
// retry this method again.                                                                // 264
//                                                                                         // 265
// UNLIKE the login method, there is no way to avoid getting SRP upgrade                   // 266
// errors thrown. The reasoning for this is that clients using this                        // 267
// method directly will need to be updated anyway because we no longer                     // 268
// support the SRP flow that they would have been doing to use this                        // 269
// method previously.                                                                      // 270
Meteor.methods({changePassword: function (oldPassword, newPassword) {                      // 271
  check(oldPassword, passwordValidator);                                                   // 272
  check(newPassword, passwordValidator);                                                   // 273
                                                                                           // 274
  if (!this.userId)                                                                        // 275
    throw new Meteor.Error(401, "Must be logged in");                                      // 276
                                                                                           // 277
  var user = Meteor.users.findOne(this.userId);                                            // 278
  if (!user)                                                                               // 279
    throw new Meteor.Error(403, "User not found");                                         // 280
                                                                                           // 281
  if (!user.services || !user.services.password ||                                         // 282
      (!user.services.password.bcrypt && !user.services.password.srp))                     // 283
    throw new Meteor.Error(403, "User has no password set");                               // 284
                                                                                           // 285
  if (! user.services.password.bcrypt) {                                                   // 286
    throw new Meteor.Error(400, "old password format", EJSON.stringify({                   // 287
      format: 'srp',                                                                       // 288
      identity: user.services.password.srp.identity                                        // 289
    }));                                                                                   // 290
  }                                                                                        // 291
                                                                                           // 292
  var result = checkPassword(user, oldPassword);                                           // 293
  if (result.error)                                                                        // 294
    throw result.error;                                                                    // 295
                                                                                           // 296
  var hashed = hashPassword(newPassword);                                                  // 297
                                                                                           // 298
  // It would be better if this removed ALL existing tokens and replaced                   // 299
  // the token for the current connection with a new one, but that would                   // 300
  // be tricky, so we'll settle for just replacing all tokens other than                   // 301
  // the one for the current connection.                                                   // 302
  var currentToken = Accounts._getLoginToken(this.connection.id);                          // 303
  Meteor.users.update(                                                                     // 304
    { _id: this.userId },                                                                  // 305
    {                                                                                      // 306
      $set: { 'services.password.bcrypt': hashed },                                        // 307
      $pull: {                                                                             // 308
        'services.resume.loginTokens': { hashedToken: { $ne: currentToken } }              // 309
      }                                                                                    // 310
    }                                                                                      // 311
  );                                                                                       // 312
                                                                                           // 313
  return {passwordChanged: true};                                                          // 314
}});                                                                                       // 315
                                                                                           // 316
                                                                                           // 317
// Force change the users password.                                                        // 318
Accounts.setPassword = function (userId, newPlaintextPassword) {                           // 319
  var user = Meteor.users.findOne(userId);                                                 // 320
  if (!user)                                                                               // 321
    throw new Meteor.Error(403, "User not found");                                         // 322
                                                                                           // 323
  Meteor.users.update(                                                                     // 324
    {_id: user._id},                                                                       // 325
    { $unset: {'services.password.srp': 1}, // XXX COMPAT WITH 0.8.1.3                     // 326
      $set: {'services.password.bcrypt': hashPassword(newPlaintextPassword)} }             // 327
  );                                                                                       // 328
};                                                                                         // 329
                                                                                           // 330
                                                                                           // 331
///                                                                                        // 332
/// RESETTING VIA EMAIL                                                                    // 333
///                                                                                        // 334
                                                                                           // 335
// Method called by a user to request a password reset email. This is                      // 336
// the start of the reset process.                                                         // 337
Meteor.methods({forgotPassword: function (options) {                                       // 338
  check(options, {email: String});                                                         // 339
                                                                                           // 340
  var user = Meteor.users.findOne({"emails.address": options.email});                      // 341
  if (!user)                                                                               // 342
    throw new Meteor.Error(403, "User not found");                                         // 343
                                                                                           // 344
  Accounts.sendResetPasswordEmail(user._id, options.email);                                // 345
}});                                                                                       // 346
                                                                                           // 347
// send the user an email with a link that when opened allows the user                     // 348
// to set a new password, without the old password.                                        // 349
//                                                                                         // 350
Accounts.sendResetPasswordEmail = function (userId, email) {                               // 351
  // Make sure the user exists, and email is one of their addresses.                       // 352
  var user = Meteor.users.findOne(userId);                                                 // 353
  if (!user)                                                                               // 354
    throw new Error("Can't find user");                                                    // 355
  // pick the first email if we weren't passed an email.                                   // 356
  if (!email && user.emails && user.emails[0])                                             // 357
    email = user.emails[0].address;                                                        // 358
  // make sure we have a valid email                                                       // 359
  if (!email || !_.contains(_.pluck(user.emails || [], 'address'), email))                 // 360
    throw new Error("No such email for user.");                                            // 361
                                                                                           // 362
  var token = Random.secret();                                                             // 363
  var when = new Date();                                                                   // 364
  var tokenRecord = {                                                                      // 365
    token: token,                                                                          // 366
    email: email,                                                                          // 367
    when: when                                                                             // 368
  };                                                                                       // 369
  Meteor.users.update(userId, {$set: {                                                     // 370
    "services.password.reset": tokenRecord                                                 // 371
  }});                                                                                     // 372
  // before passing to template, update user object with new token                         // 373
  Meteor._ensure(user, 'services', 'password').reset = tokenRecord;                        // 374
                                                                                           // 375
  var resetPasswordUrl = Accounts.urls.resetPassword(token);                               // 376
                                                                                           // 377
  var options = {                                                                          // 378
    to: email,                                                                             // 379
    from: Accounts.emailTemplates.from,                                                    // 380
    subject: Accounts.emailTemplates.resetPassword.subject(user),                          // 381
    text: Accounts.emailTemplates.resetPassword.text(user, resetPasswordUrl)               // 382
  };                                                                                       // 383
                                                                                           // 384
  if (typeof Accounts.emailTemplates.resetPassword.html === 'function')                    // 385
    options.html =                                                                         // 386
      Accounts.emailTemplates.resetPassword.html(user, resetPasswordUrl);                  // 387
                                                                                           // 388
  Email.send(options);                                                                     // 389
};                                                                                         // 390
                                                                                           // 391
// send the user an email informing them that their account was created, with              // 392
// a link that when opened both marks their email as verified and forces them              // 393
// to choose their password. The email must be one of the addresses in the                 // 394
// user's emails field, or undefined to pick the first email automatically.                // 395
//                                                                                         // 396
// This is not called automatically. It must be called manually if you                     // 397
// want to use enrollment emails.                                                          // 398
//                                                                                         // 399
Accounts.sendEnrollmentEmail = function (userId, email) {                                  // 400
  // XXX refactor! This is basically identical to sendResetPasswordEmail.                  // 401
                                                                                           // 402
  // Make sure the user exists, and email is in their addresses.                           // 403
  var user = Meteor.users.findOne(userId);                                                 // 404
  if (!user)                                                                               // 405
    throw new Error("Can't find user");                                                    // 406
  // pick the first email if we weren't passed an email.                                   // 407
  if (!email && user.emails && user.emails[0])                                             // 408
    email = user.emails[0].address;                                                        // 409
  // make sure we have a valid email                                                       // 410
  if (!email || !_.contains(_.pluck(user.emails || [], 'address'), email))                 // 411
    throw new Error("No such email for user.");                                            // 412
                                                                                           // 413
  var token = Random.secret();                                                             // 414
  var when = new Date();                                                                   // 415
  var tokenRecord = {                                                                      // 416
    token: token,                                                                          // 417
    email: email,                                                                          // 418
    when: when                                                                             // 419
  };                                                                                       // 420
  Meteor.users.update(userId, {$set: {                                                     // 421
    "services.password.reset": tokenRecord                                                 // 422
  }});                                                                                     // 423
                                                                                           // 424
  // before passing to template, update user object with new token                         // 425
  Meteor._ensure(user, 'services', 'password').reset = tokenRecord;                        // 426
                                                                                           // 427
  var enrollAccountUrl = Accounts.urls.enrollAccount(token);                               // 428
                                                                                           // 429
  var options = {                                                                          // 430
    to: email,                                                                             // 431
    from: Accounts.emailTemplates.from,                                                    // 432
    subject: Accounts.emailTemplates.enrollAccount.subject(user),                          // 433
    text: Accounts.emailTemplates.enrollAccount.text(user, enrollAccountUrl)               // 434
  };                                                                                       // 435
                                                                                           // 436
  if (typeof Accounts.emailTemplates.enrollAccount.html === 'function')                    // 437
    options.html =                                                                         // 438
      Accounts.emailTemplates.enrollAccount.html(user, enrollAccountUrl);                  // 439
                                                                                           // 440
  Email.send(options);                                                                     // 441
};                                                                                         // 442
                                                                                           // 443
                                                                                           // 444
// Take token from sendResetPasswordEmail or sendEnrollmentEmail, change                   // 445
// the users password, and log them in.                                                    // 446
Meteor.methods({resetPassword: function (token, newPassword) {                             // 447
  var self = this;                                                                         // 448
  return Accounts._loginMethod(                                                            // 449
    self,                                                                                  // 450
    "resetPassword",                                                                       // 451
    arguments,                                                                             // 452
    "password",                                                                            // 453
    function () {                                                                          // 454
      check(token, String);                                                                // 455
      check(newPassword, passwordValidator);                                               // 456
                                                                                           // 457
      var user = Meteor.users.findOne({                                                    // 458
        "services.password.reset.token": token});                                          // 459
      if (!user)                                                                           // 460
        throw new Meteor.Error(403, "Token expired");                                      // 461
      var email = user.services.password.reset.email;                                      // 462
      if (!_.include(_.pluck(user.emails || [], 'address'), email))                        // 463
        return {                                                                           // 464
          userId: user._id,                                                                // 465
          error: new Meteor.Error(403, "Token has invalid email address")                  // 466
        };                                                                                 // 467
                                                                                           // 468
      var hashed = hashPassword(newPassword);                                              // 469
                                                                                           // 470
      // NOTE: We're about to invalidate tokens on the user, who we might be               // 471
      // logged in as. Make sure to avoid logging ourselves out if this                    // 472
      // happens. But also make sure not to leave the connection in a state                // 473
      // of having a bad token set if things fail.                                         // 474
      var oldToken = Accounts._getLoginToken(self.connection.id);                          // 475
      Accounts._setLoginToken(user._id, self.connection, null);                            // 476
      var resetToOldToken = function () {                                                  // 477
        Accounts._setLoginToken(user._id, self.connection, oldToken);                      // 478
      };                                                                                   // 479
                                                                                           // 480
      try {                                                                                // 481
        // Update the user record by:                                                      // 482
        // - Changing the password to the new one                                          // 483
        // - Forgetting about the reset token that was just used                           // 484
        // - Verifying their email, since they got the password reset via email.           // 485
        var affectedRecords = Meteor.users.update(                                         // 486
          {                                                                                // 487
            _id: user._id,                                                                 // 488
            'emails.address': email,                                                       // 489
            'services.password.reset.token': token                                         // 490
          },                                                                               // 491
          {$set: {'services.password.bcrypt': hashed,                                      // 492
                  'emails.$.verified': true},                                              // 493
           $unset: {'services.password.reset': 1,                                          // 494
                    'services.password.srp': 1}});                                         // 495
        if (affectedRecords !== 1)                                                         // 496
          return {                                                                         // 497
            userId: user._id,                                                              // 498
            error: new Meteor.Error(403, "Invalid email")                                  // 499
          };                                                                               // 500
      } catch (err) {                                                                      // 501
        resetToOldToken();                                                                 // 502
        throw err;                                                                         // 503
      }                                                                                    // 504
                                                                                           // 505
      // Replace all valid login tokens with new ones (changing                            // 506
      // password should invalidate existing sessions).                                    // 507
      Accounts._clearAllLoginTokens(user._id);                                             // 508
                                                                                           // 509
      return {userId: user._id};                                                           // 510
    }                                                                                      // 511
  );                                                                                       // 512
}});                                                                                       // 513
                                                                                           // 514
///                                                                                        // 515
/// EMAIL VERIFICATION                                                                     // 516
///                                                                                        // 517
                                                                                           // 518
                                                                                           // 519
// send the user an email with a link that when opened marks that                          // 520
// address as verified                                                                     // 521
//                                                                                         // 522
Accounts.sendVerificationEmail = function (userId, address) {                              // 523
  // XXX Also generate a link using which someone can delete this                          // 524
  // account if they own said address but weren't those who created                        // 525
  // this account.                                                                         // 526
                                                                                           // 527
  // Make sure the user exists, and address is one of their addresses.                     // 528
  var user = Meteor.users.findOne(userId);                                                 // 529
  if (!user)                                                                               // 530
    throw new Error("Can't find user");                                                    // 531
  // pick the first unverified address if we weren't passed an address.                    // 532
  if (!address) {                                                                          // 533
    var email = _.find(user.emails || [],                                                  // 534
                       function (e) { return !e.verified; });                              // 535
    address = (email || {}).address;                                                       // 536
  }                                                                                        // 537
  // make sure we have a valid address                                                     // 538
  if (!address || !_.contains(_.pluck(user.emails || [], 'address'), address))             // 539
    throw new Error("No such email address for user.");                                    // 540
                                                                                           // 541
                                                                                           // 542
  var tokenRecord = {                                                                      // 543
    token: Random.secret(),                                                                // 544
    address: address,                                                                      // 545
    when: new Date()};                                                                     // 546
  Meteor.users.update(                                                                     // 547
    {_id: userId},                                                                         // 548
    {$push: {'services.email.verificationTokens': tokenRecord}});                          // 549
                                                                                           // 550
  // before passing to template, update user object with new token                         // 551
  Meteor._ensure(user, 'services', 'email');                                               // 552
  if (!user.services.email.verificationTokens) {                                           // 553
    user.services.email.verificationTokens = [];                                           // 554
  }                                                                                        // 555
  user.services.email.verificationTokens.push(tokenRecord);                                // 556
                                                                                           // 557
  var verifyEmailUrl = Accounts.urls.verifyEmail(tokenRecord.token);                       // 558
                                                                                           // 559
  var options = {                                                                          // 560
    to: address,                                                                           // 561
    from: Accounts.emailTemplates.from,                                                    // 562
    subject: Accounts.emailTemplates.verifyEmail.subject(user),                            // 563
    text: Accounts.emailTemplates.verifyEmail.text(user, verifyEmailUrl)                   // 564
  };                                                                                       // 565
                                                                                           // 566
  if (typeof Accounts.emailTemplates.verifyEmail.html === 'function')                      // 567
    options.html =                                                                         // 568
      Accounts.emailTemplates.verifyEmail.html(user, verifyEmailUrl);                      // 569
                                                                                           // 570
  Email.send(options);                                                                     // 571
};                                                                                         // 572
                                                                                           // 573
// Take token from sendVerificationEmail, mark the email as verified,                      // 574
// and log them in.                                                                        // 575
Meteor.methods({verifyEmail: function (token) {                                            // 576
  var self = this;                                                                         // 577
  return Accounts._loginMethod(                                                            // 578
    self,                                                                                  // 579
    "verifyEmail",                                                                         // 580
    arguments,                                                                             // 581
    "password",                                                                            // 582
    function () {                                                                          // 583
      check(token, String);                                                                // 584
                                                                                           // 585
      var user = Meteor.users.findOne(                                                     // 586
        {'services.email.verificationTokens.token': token});                               // 587
      if (!user)                                                                           // 588
        throw new Meteor.Error(403, "Verify email link expired");                          // 589
                                                                                           // 590
      var tokenRecord = _.find(user.services.email.verificationTokens,                     // 591
                               function (t) {                                              // 592
                                 return t.token == token;                                  // 593
                               });                                                         // 594
      if (!tokenRecord)                                                                    // 595
        return {                                                                           // 596
          userId: user._id,                                                                // 597
          error: new Meteor.Error(403, "Verify email link expired")                        // 598
        };                                                                                 // 599
                                                                                           // 600
      var emailsRecord = _.find(user.emails, function (e) {                                // 601
        return e.address == tokenRecord.address;                                           // 602
      });                                                                                  // 603
      if (!emailsRecord)                                                                   // 604
        return {                                                                           // 605
          userId: user._id,                                                                // 606
          error: new Meteor.Error(403, "Verify email link is for unknown address")         // 607
        };                                                                                 // 608
                                                                                           // 609
      // By including the address in the query, we can use 'emails.$' in the               // 610
      // modifier to get a reference to the specific object in the emails                  // 611
      // array. See                                                                        // 612
      // http://www.mongodb.org/display/DOCS/Updating/#Updating-The%24positionaloperator)  // 613
      // http://www.mongodb.org/display/DOCS/Updating#Updating-%24pull                     // 614
      Meteor.users.update(                                                                 // 615
        {_id: user._id,                                                                    // 616
         'emails.address': tokenRecord.address},                                           // 617
        {$set: {'emails.$.verified': true},                                                // 618
         $pull: {'services.email.verificationTokens': {token: token}}});                   // 619
                                                                                           // 620
      return {userId: user._id};                                                           // 621
    }                                                                                      // 622
  );                                                                                       // 623
}});                                                                                       // 624
                                                                                           // 625
                                                                                           // 626
                                                                                           // 627
///                                                                                        // 628
/// CREATING USERS                                                                         // 629
///                                                                                        // 630
                                                                                           // 631
// Shared createUser function called from the createUser method, both                      // 632
// if originates in client or server code. Calls user provided hooks,                      // 633
// does the actual user insertion.                                                         // 634
//                                                                                         // 635
// returns the user id                                                                     // 636
var createUser = function (options) {                                                      // 637
  // Unknown keys allowed, because a onCreateUserHook can take arbitrary                   // 638
  // options.                                                                              // 639
  check(options, Match.ObjectIncluding({                                                   // 640
    username: Match.Optional(String),                                                      // 641
    email: Match.Optional(String),                                                         // 642
    password: Match.Optional(passwordValidator)                                            // 643
  }));                                                                                     // 644
                                                                                           // 645
  var username = options.username;                                                         // 646
  var email = options.email;                                                               // 647
  if (!username && !email)                                                                 // 648
    throw new Meteor.Error(400, "Need to set a username or email");                        // 649
                                                                                           // 650
  var user = {services: {}};                                                               // 651
  if (options.password) {                                                                  // 652
    var hashed = hashPassword(options.password);                                           // 653
    user.services.password = { bcrypt: hashed };                                           // 654
  }                                                                                        // 655
                                                                                           // 656
  if (username)                                                                            // 657
    user.username = username;                                                              // 658
  if (email)                                                                               // 659
    user.emails = [{address: email, verified: false}];                                     // 660
                                                                                           // 661
  return Accounts.insertUserDoc(options, user);                                            // 662
};                                                                                         // 663
                                                                                           // 664
// method for create user. Requests come from the client.                                  // 665
Meteor.methods({createUser: function (options) {                                           // 666
  var self = this;                                                                         // 667
  return Accounts._loginMethod(                                                            // 668
    self,                                                                                  // 669
    "createUser",                                                                          // 670
    arguments,                                                                             // 671
    "password",                                                                            // 672
    function () {                                                                          // 673
      // createUser() above does more checking.                                            // 674
      check(options, Object);                                                              // 675
      if (Accounts._options.forbidClientAccountCreation)                                   // 676
        return {                                                                           // 677
          error: new Meteor.Error(403, "Signups forbidden")                                // 678
        };                                                                                 // 679
                                                                                           // 680
      // Create user. result contains id and token.                                        // 681
      var userId = createUser(options);                                                    // 682
      // safety belt. createUser is supposed to throw on error. send 500 error             // 683
      // instead of sending a verification email with empty userid.                        // 684
      if (! userId)                                                                        // 685
        throw new Error("createUser failed to insert new user");                           // 686
                                                                                           // 687
      // If `Accounts._options.sendVerificationEmail` is set, register                     // 688
      // a token to verify the user's primary email, and send it to                        // 689
      // that address.                                                                     // 690
      if (options.email && Accounts._options.sendVerificationEmail)                        // 691
        Accounts.sendVerificationEmail(userId, options.email);                             // 692
                                                                                           // 693
      // client gets logged in as the new user afterwards.                                 // 694
      return {userId: userId};                                                             // 695
    }                                                                                      // 696
  );                                                                                       // 697
}});                                                                                       // 698
                                                                                           // 699
// Create user directly on the server.                                                     // 700
//                                                                                         // 701
// Unlike the client version, this does not log you in as this user                        // 702
// after creation.                                                                         // 703
//                                                                                         // 704
// returns userId or throws an error if it can't create                                    // 705
//                                                                                         // 706
// XXX add another argument ("server options") that gets sent to onCreateUser,             // 707
// which is always empty when called from the createUser method? eg, "admin:               // 708
// true", which we want to prevent the client from setting, but which a custom             // 709
// method calling Accounts.createUser could set?                                           // 710
//                                                                                         // 711
Accounts.createUser = function (options, callback) {                                       // 712
  options = _.clone(options);                                                              // 713
                                                                                           // 714
  // XXX allow an optional callback?                                                       // 715
  if (callback) {                                                                          // 716
    throw new Error("Accounts.createUser with callback not supported on the server yet."); // 717
  }                                                                                        // 718
                                                                                           // 719
  return createUser(options);                                                              // 720
};                                                                                         // 721
                                                                                           // 722
///                                                                                        // 723
/// PASSWORD-SPECIFIC INDEXES ON USERS                                                     // 724
///                                                                                        // 725
Meteor.users._ensureIndex('emails.validationTokens.token',                                 // 726
                          {unique: 1, sparse: 1});                                         // 727
Meteor.users._ensureIndex('services.password.reset.token',                                 // 728
                          {unique: 1, sparse: 1});                                         // 729
                                                                                           // 730
/////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['accounts-password'] = {};

})();

//# sourceMappingURL=accounts-password.js.map
