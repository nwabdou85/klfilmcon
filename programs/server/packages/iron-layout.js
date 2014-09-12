(function () {

/* Imports */
var UI = Package.ui.UI;
var Handlebars = Package.ui.Handlebars;
var Meteor = Package.meteor.Meteor;
var _ = Package.underscore._;
var Iron = Package['iron-core'].Iron;
var HTML = Package.htmljs.HTML;
var Blaze = Package.blaze.Blaze;

(function () {

///////////////////////////////////////////////////////////////////////////////
//                                                                           //
// packages/iron-layout/blaze_layout_errors.js                               //
//                                                                           //
///////////////////////////////////////////////////////////////////////////////
                                                                             //
// If the user still has blaze-layout throw  an error. Let's get rid of that // 1
// package so it's not lingering around with all its nastiness.              // 2
if (Package['blaze-layout']) {                                               // 3
  throw new Error(                                                           // 4
    "Sorry! The blaze-layout package has been replaced by iron-layout. Please remove the package like this:\n> mrt remove blaze-layout\n> meteor remove blaze-layout"
  );                                                                         // 6
}                                                                            // 7
                                                                             // 8
///////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['iron-layout'] = {};

})();

//# sourceMappingURL=iron-layout.js.map
