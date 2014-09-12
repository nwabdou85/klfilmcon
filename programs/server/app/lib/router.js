(function(){Router.configure({
layoutTemplate: 'layout',
loadingTemplate: 'loading',
waitOn: function() {
return [Meteor.subscribe('notifications')];
}
});


LinksListController = RouteController.extend({
template : 'linksList',
increment: 5,
limit: function() {
return parseInt(this.params.linksLimit) || this.increment;
},
findOptions: function() {
return {sort: this.sort, limit: this.limit()};
},
waitOn: function() {
return Meteor.subscribe('links', this.findOptions());
},
links: function() {
return Links.find({}, this.findOptions());
},

data: function() {
var hasMore = this.links().fetch().length === this.limit();
return {
links: this.links(),
nextPath: hasMore ? this.nextPath() : null
};
}
});
NewLinksListController = LinksListController.extend({
sort: {submitted: -1, _id: -1},
nextPath: function() {
return Router.routes.newLinks.path({linksLimit: this.limit() + this.increment})
}
});

BestLinksListController = LinksListController.extend({
sort: {votes: -1, submitted: -1, _id: -1},
nextPath: function() {
return Router.routes.bestLinks.path({linksLimit: this.limit() + this.increment})
}
});







ResultListController = RouteController.extend({
template : 'linksList',
increment: 50,
limit: function() {
return parseInt(this.params.linksLimit) || this.increment;
},
findOptions: function() {
return {sort: this.sort, limit: this.limit()};
},
waitOn: function() {
return Meteor.subscribe('links', this.findOptions());
},
links: function() {
	var  quer = Session.get("query");
return Links.find({$or: [{title: { $regex: quer, $options: 'i' } }, {url: { $regex: quer, $options: 'i' }}]}, this.findOptions());
},

data: function() {
var hasMore = this.links().fetch().length === this.limit();
return {
links: this.links(),
nextPath: hasMore ? this.nextPath() : null
};
}
});

ResultController = ResultListController.extend({
sort: {votes: -1, submitted: -1, _id: -1},
nextPath: function() {
return Router.routes.results.path({linksLimit: this.limit() + this.increment})
}
});








 



Router.map(function() {
this.route('home', {
path: '/',
controller: NewLinksListController
});
this.route('newLinks', {
path: '/new/:linksLimit?',
controller: NewLinksListController
});
this.route('bestLinks', {
path: '/best/:linksLimit?',
controller: BestLinksListController
});




// this.route('linksList', {path: '/'});
this.route('linkPage', {
path: '/links/:_id',
waitOn: function() {
return [
Meteor.subscribe('singleLink', this.params._id),
Meteor.subscribe('comments', this.params._id)
];
},
data: function() { return Links.findOne(this.params._id); }
});
this.route('linkEdit', {
path: '/links/:_id/edit',
waitOn: function() {
return Meteor.subscribe('singleLink', this.params._id);
},
data: function() { return Links.findOne(this.params._id); }
});


this.route('linkSubmit', {
path: '/submit',
disableProgress: true
});

this.route('search', {
path: '/search',
});

this.route('results', {
path: '/results/:linksLimit?',
controller: ResultController
});
this.route('aboutus', {
path: '/aboutus',
});

// this.route('howto', {
// path: '/howto',
// });

this.route('linksList', {
path: '/linksLimit?',
controller: LinksListController
});
});


var requireLogin = function() {
if (! Meteor.user()) {
if (Meteor.loggingIn())
this.render('loading')
else
this.render('accessDenied');
this.pause();
}
}
Router.onBeforeAction(requireLogin, {only: 'linkSubmit'});
Router.onBeforeAction(function() { clearErrors() });

})();
