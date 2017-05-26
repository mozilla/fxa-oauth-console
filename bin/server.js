/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
/* global require */

const config = require('../lib/config');
const server = require('../lib/server');
var log = require('mozlog')('server');
var fs = require('fs');
var path = require('path');
var url = require('url');
var app;

var indexPath = path.join(__dirname, '..', 'dist', 'index.html');
var META_TAG_PATTERN = /<meta name="fxa-oauth-console\/config\/environment" content="(.*)" \/>/g;

function getConfigFromHtml(html) {
  var match = META_TAG_PATTERN.exec(html)[1];
  // var matchParsed = JSON.parse(match.trim());
  var decodedParsed = decodeURIComponent(match);
  return JSON.parse(decodedParsed);
}

function getConfigsFromENV() {
  return {
    oauthUri: process.env.OAUTH_URI || undefined,
    oauthInternalUri: process.env.OAUTH_INTERNAL_URI || undefined,
    profileUri: process.env.PROFILE_URI || undefined,
  };
}

function getUriParts(rawUri) {
  var uriParsed = url.parse(rawUri);
  var uri = uriParsed.protocol + '//' + uriParsed.host;

  return {
    uri,
    uriParsed,
  };
}

function applyEnvVars(currentConfig, envVars) {
  var servers = currentConfig.servers;
  if (envVars.oauthUri) {
    var oauthUriParts = getUriParts(envVars.oauthUri);
    servers.oauth = oauthUriParts.uri;
    servers.oauthUriParsed = oauthUriParts.uriParsed;
    config.set('fxaOAuth.oauth_uri', envVars.oauthUri);
  }

  if (envVars.oauthInternalUri) {
    var oauthInternalUriParts = getUriParts(envVars.oauthInternalUri);
    servers.oauthInternal = oauthInternalUriParts.uri;
    servers.oauthInternalUriParsed = oauthInternalUriParts.uriParsed;
    config.set('fxaOAuth.oauth_internal_uri', envVars.oauthInternalUri);
  }

  if (envVars.profileUri) {
    var profileUriParts = getUriParts(envVars.profileUri);
    servers.profileUriParsed = profileUriParts.uri;
    config.set('fxaOAuth.profile_uri', envVars.profileUri);
  }
  return currentConfig;
}

function writeNewConfigToIndexHtml(html, configToWrite) {
  var encodedConfig = encodeURIComponent(JSON.stringify(configToWrite));
  var newMetaTag = `<meta name="fxa-oauth-console/config/environment" content="${encodedConfig}" />`;
  var newHtml = html.replace(META_TAG_PATTERN, newMetaTag);
  fs.writeFile(indexPath, newHtml, err => {
    if (err) {
      log.debug(err);
      return log.debug('Error while writing meta tag to index.html');
    }
    log.info('Successfully wrote config to index.html');
    startServer();
  });
}

function startServer() {
  var configProps = config.getProperties();
  log.debug('Starting with config: %:2j', configProps);
  app = server.listen(configProps.server.port, function () {
    var port = app.address().port;
    log.info('FxA OAuth Developer Console started on port:', port);
  });
}

fs.readFile(indexPath, 'utf8', (err, html) => {
  if (err) {
    return log.debug(err);
  }
  var currentConfig = getConfigFromHtml(html);
  var envVars = getConfigsFromENV();
  var newConfig =  applyEnvVars(currentConfig, envVars);
  writeNewConfigToIndexHtml(html, newConfig);
});
