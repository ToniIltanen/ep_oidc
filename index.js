var ERR = require('async-stacktrace');
var settings = require('ep_etherpad-lite/node/utils/Settings');
var authorManager = require('ep_etherpad-lite/node/db/AuthorManager');
var request = require('request');
var passport = require('passport');
var OpenIDConnectStrategy = require('passport-openidconnect').Strategy;

// Settings variables check
if(!settings.users || !settings.users.oidc) {
    throw new Error('ep_oidc plugin requires users and oidc settings!');
}
else {
    if (!settings.users.oidc.issuer) throw new Error('ep_oidc plugin requires a issuer setting!');
    if (!settings.users.oidc.authorizationURL) throw new Error('ep_oidc plugin requires a authorizationURL setting!');
    if (!settings.users.oidc.tokenURL) throw new Error('ep_oidc plugin requires a tokenURL setting!');
    if (!settings.users.oidc.clientID) throw new Error('ep_oidc plugin requires a clientID setting!');
    if (!settings.users.oidc.clientSecret) throw new Error('ep_oidc plugin requires a clientSecret setting!');
    if (!settings.users.oidc.userinfoURL) throw new Error('ep_oidc plugin requires a userinfoURL setting!');
    if (!settings.users.oidc.usernameKey) throw new Error('ep_oidc plugin requires a usernameKey setting!');
    if (!settings.users.oidc.useridKey) throw new Error('ep_oidc plugin requires a useridKey setting!');
    if (!settings.users.oidc.callbackURL) throw new Error('ep_oidc plugin requires a callbackURL setting!');
    if (!settings.users.oidc.responseType) throw new Error('ep_oidc plugin requires a responseType setting!');
    if (!settings.users.oidc.scope) throw new Error('ep_oidc plugin requires a scope setting!');
}

// Settings Variables
var issuer = settings.users.oidc.issuer;
var authorizationURL = settings.users.oidc.authorizationURL;
var tokenURL = settings.users.oidc.tokenURL;
var clientID = settings.users.oidc.clientID;
var clientSecret = settings.users.oidc.clientSecret;
var userinfoURL = settings.users.oidc.userinfoURL;
var usernameKey = settings.users.oidc.usernameKey;
var idKey = settings.users.oidc.useridKey;
var passReqToCallback = settings.users.oidc.passReqToCallback ? true : false;
var skipUserProfile = settings.users.oidc.skipUserProfile ? true : false;
var callbackURL = settings.users.oidc.callbackURL;
var responseType = settings.users.oidc.responseType;
var scope = settings.users.oidc.scope; //openid added automatically, no need to add that


exports.expressConfigure = function(hook_name, context) {
  console.debug('ep_oidc.expressConfigure');
  passport.use('hbp', new OpenIDConnectStrategy({
          issuer: issuer,
          passReqToCallback: passReqToCallback,
          skipUserProfile: skipUserProfile,
          authorizationURL: authorizationURL,
          tokenURL: tokenURL,
          clientID: clientID,
          userInfoURL: userinfoURL,
          clientSecret: clientSecret,
          callbackURL: callbackURL,
          responseType: responseType,
          scope: scope
  }, function(iss, sub, profile, accessToken, refreshToken, cb) {
      request.get({
      url: userinfoURL,
      auth: {
        bearer: accessToken
      },
      json: true
    }, function (error, response, data) {
      if (error) {
        return cb(error);
      }
      data.token = {
        type: 'bearer',
        accessToken: accessToken,
        refreshToken: refreshToken
      };
      authorManager.createAuthorIfNotExistsFor(data[idKey], data[usernameKey], function(err, authorId) {
        if (err) {
          return cb(err);
        }
        data.authorId = authorId;
        return cb(null, data);
      });
    });
  }));

  //if this fails and you get an exception for missing passport session, add the passport initialize and session directly in the etherpad server configuration. 
  //(/node_modules/ep_etherpad-lite/node/hooks/express.js, before server.listen)
  var app = context.app;
  app.use(passport.initialize());
  app.use(passport.session());
}

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  done(null, user);
});


function setUsername(token, username) {
  console.debug('ep_oidc.setUsername: getting authorid for token %s', token);
  authorManager.getAuthor4Token(token, function(err, author) {
    if (ERR(err)) {
      console.debug('ep_oidc.setUsername: could not get authorid for token %s', token);
    } else {
      console.debug('ep_oidc.setUsername: have authorid %s, setting username to "%s"', author, username);
      authorManager.setAuthorName(author, username);
    }
  });
  return;
}

exports.expressCreateServer = function (hook_name, context) {
  console.debug('ep_oidc.expressCreateServer');
  var app = context.app;

    app.get('/logout', function(req, res){
        req.session.destroy(function(e){
          req.logout();
          res.redirect('/');
        });
    });

  app.get('/auth/callback', passport.authenticate('hbp', {
    failureRedirect: '/auth/failure'
  }), function(req, res) {
  req.session.userFound = true;
    req.session.user = req.user;
    res.redirect(req.session.afterAuthUrl);
  });
  app.get('/auth/failure', function(req, res) {
    res.send("<em>Authentication Failed</em>")
  });
  app.get('/auth/done', function(req, res) {
    res.send("<em>Authentication Suceeded</em>");
  });
}

exports.authenticate = function(hook_name, context) {
  console.debug('ep_oidc.authenticate from ->', context.req.url);
  context.req.session.afterAuthUrl = context.req.url;
  return passport.authenticate('hbp')(context.req, context.res, context.next);
}

exports.handleMessage = function(hook_name, context, cb) {
  console.debug("ep_oidc.handleMessage");
  if ( context.message.type == "CLIENT_READY" ) {
    if (!context.message.token) {
      console.debug('ep_oidc.handleMessage: intercepted CLIENT_READY message has no token!');
    } else {
      var client_id = context.client.id;
            console.log(JSON.stringify(context.client.client.request.session.user));
      if ('user' in context.client.client.request.session) {
        var displayName = context.client.client.request.session.user['name'];
        console.debug('ep:oidc.handleMessage: intercepted CLIENT_READY message for client_id = %s, setting username for token %s to %s', client_id, context.message.token, displayName);
        setUsername(context.message.token, displayName);
      }
      else {
        console.debug('ep_oidc.handleMessage: intercepted CLIENT_READY but user does have displayName !');
      }
    }
  } else if ( context.message.type == "COLLABROOM" && context.message.data.type == "USERINFO_UPDATE" ) {
    console.debug('ep_oidc.handleMessage: intercepted USERINFO_UPDATE and dropping it!');
    return cb([null]);
  }
  return cb([context.message]);
};
