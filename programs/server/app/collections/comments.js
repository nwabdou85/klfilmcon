(function(){Comments = new Meteor.Collection('comments');

Meteor.methods({
comment: function(commentAttributes) {
var user = Meteor.user();
var link = Links.findOne(commentAttributes.linkId);
// ensure the user is logged in
if (!user)
throw new Meteor.Error(401, "Vous devez vous connecter pour laisser un commentaire");
if (!commentAttributes.body)
throw new Meteor.Error(422, 'S.V.P, écrivez du contenu');
if (!link)
throw new Meteor.Error(422, 'S.V.P, veuillez laisser un commentaire');
comment = _.extend(_.pick(commentAttributes, 'linkId', 'body'), {
userId: user._id,
author: user.username,
submitted: new Date().getTime()
});

// update the post with the number of comments
Links.update(comment.linkId, {$inc: {commentsCount: 1}});

// create the comment, save the id
comment._id = Comments.insert(comment);
// now create a notification, informing the user that there's been a comment
createCommentNotification(comment);
return comment._id;

}
});

})();
