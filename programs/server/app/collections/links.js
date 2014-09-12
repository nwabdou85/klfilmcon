(function(){
Links = new Meteor.Collection('links');
Links.allow({
update: ownsDocument,
remove: ownsDocument
});

Links.deny({
update: function(userId, link, fieldNames) {
// may only edit the following two fields:
return (_.without(fieldNames, 'url', 'title', 'ur').length > 0);
}
});


Meteor.methods({
link: function(linkAttributes) {
var user = Meteor.user(),
linkWithSameTitle = Links.findOne({title: linkAttributes.title});
linkWithSameUr = Links.findOne({ur: linkAttributes.ur});



// ensure the user is logged in
if (!user)
throw new Meteor.Error(401, "Connectez-vous pour proposer un film");

// ensure the post has a title
if (!linkAttributes.title)
throw new Meteor.Error(422, 'Vous devez remplir tous les champs');

if (!linkAttributes.url)
throw new Meteor.Error(422, 'Vous devez remplir tous les champs');
if (!linkAttributes.ur)
throw new Meteor.Error(422, 'Vous devez remplir tous les champs');

// check that there are no previous posts with the same link
if (linkAttributes.title && linkWithSameTitle) {
throw new Meteor.Error(302,
'Ce film a déjà été proposé',
linkWithSameTitle._id);
}
if (linkAttributes.ur && linkWithSameUr) {
throw new Meteor.Error(302,
'Ce lien a déjà été proposé',
linkWithSameUr._id);
}

// pick out the whitelisted keys
var link = _.extend(_.pick(linkAttributes, 'url', 'title', 'ur'), {
userId: user._id,
author: user.username ||  user.services.twitter.screenName, 
submitted: new Date().getTime(),
commentsCount: 0,
upvoters: [],
votes: 0
});
var linkId = Links.insert(link);
return linkId;
},
upvote: function(linkId) {
var user = Meteor.user();
// ensure the user is logged in
if (!user)
throw new Meteor.Error(401, "You need to login to upvote");

Links.update({
_id: linkId,
upvoters: {$ne: user._id}
}, {
$addToSet: {upvoters: user._id},
$inc: {votes: 1}
});



var link = Links.findOne(linkId);
if (!link)
throw new Meteor.Error(422, 'Post not found');
if (_.include(link.upvoters, user._id))
throw new Meteor.Error(422, 'Already upvoted this post');
Links.update(link._id, {
$addToSet: {upvoters: user._id},
$inc: {votes: 1}
});/* cette partie à ete desactivé avant; en cas où; je le desactive comme avant */
}
});



EasySearch.createSearchIndex('links', {
    'field' : ['title', 'url'],
    'collection' : Links,
    'limit' : 20,
    'onlyShowDiscounts' : true, // demo purpose configuration, can be used in query
    'query' : function (searchString) {
        // this contains all the configuration specified above
        if (this.onlyShowDiscounts) {
            return { 'discount' : true, 'title' : searchString }; 
        }
        return { 'title' : searchString };
    }
});

})();
