(function(){Meteor.publish('links', function(options) {
return Links.find({}, options);
});

Meteor.publish('singleLink', function(id) {
return id && Links.find(id);
});



Meteor.publish('comments', function(linkId) {
return Comments.find({linkId: linkId});
});

Meteor.publish('notifications', function() {
return Notifications.find({userId: this.userId});
});

//Meteor.publish('results', function(limit) {
//return Links.find({url: 'policier'}, {sort: {votes: -1, submitted: -1}, limit: limit});
//});


})();
