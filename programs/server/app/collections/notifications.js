(function(){Notifications = new Meteor.Collection('notifications');

Notifications.allow({
update: ownsDocument
});
createCommentNotification = function(comment) {
var link = Links.findOne(comment.linkId);
if (comment.userId !== link.userId) {
Notifications.insert({
userId: link.userId,
linkId: link._id,
commentId: comment._id,
commenterName: comment.author,
read: false
});
}
};

})();
