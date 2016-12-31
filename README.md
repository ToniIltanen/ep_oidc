ep_oidc
=======

OIDC auth plugin for etherpad-lite

This plugin uses a passport.js strategy for OpenID Connect authentication,
through **passport-openidconnect** by [jaredhanson](https://github.com/jaredhanson/passport-openidconnect)

This plugin is mostly based on ep_oauth2 plugin by [HumanBrainProject](https://github.com/HumanBrainProject/ep_oauth2)

## Settings configuration

You must add the required keys to etherpad settings (here with example values):

``` json
 "users": {
  "oidc": {
      "issuer": "https://auth.yourserver.com",
      "authorizationURL": "https://auth.yourserver.com/auth",
      "tokenURL": "https://auth.yourserver.com/token",
      "clientID": "YOUR_CLIENT_ID",
      "clientSecret": "YOUR_CLIENT_SECRET",
      "userinfoURL": "https://auth.yourserver.com/me",
      "usernameKey": "name",
      "useridKey": "sub",
      "passReqToCallback": false,
      "skipUserProfile": false,
      "callbackURL": "https://etherpad.yourserver.com/auth/callback",
      "responseType": "id_token",
      "scope": ["profile"]
  }
 }
```
## Authorization

Note, that this plugin does not implement authorization for your etherpad-lite, 
so you must handle the authorization hook with another plugin (or create one yourself).
Without the authorization, your etherpad-lite installation will not allow the user a permission to the pads,
even though authenticated with ep_oidc. In example, going to the admin page with ep_oidc used as authentication and not implementing authorization,
will cause an endless loop of requests (auth passes, but not authorized).

## License

MIT