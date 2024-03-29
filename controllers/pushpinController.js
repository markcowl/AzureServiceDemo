/**
* Copyright (c) Microsoft.  All rights reserved.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

var util = require('util');
var fs = require('fs');
var nconf = require('nconf');

nconf.file({ file: 'config.json' });

var PushpinService = require('../services/pushpinService');

var initialized = false;
var pushpinService = new PushpinService(process.env.AZURE_STORAGE_ACCOUNT, process.env.AZURE_STORAGE_ACCESS_KEY);

exports.io = null;

exports.setup = function (request, response) {
  response.render('setup');
};

exports.setupPOST = function (request, response) {
  var showError = function (message) {
    // TODO: actually show the error message
    response.render('setup');
  };

  if (request.body.account &&
      request.body.accessKey &&
      request.body.bingMapsCredentials) {

    nconf.set('AZURE_STORAGE_ACCOUNT', request.body.account);
    nconf.set('AZURE_STORAGE_ACCESS_KEY', request.body.accessKey);
    nconf.set('BING_MAPS_CREDENTIALS', request.body.bingMapsCredentials);

    nconf.save(function (error) {
      if (error) {
        showError(error);
      } else {
        response.redirect('/');
      }
    });
  } else {
    showError();
  }
};

exports.showPushpins = function (request, response) {
  var action = function (error) {
    if (error) {
      renderPushpins(error);
    } else {
      initialized = true;
      pushpinService.listPushpins(renderPushpins);
    }
  };

  var renderPushpins = function (error, entities) {
    response.render('index', {
      locals: {
        error: error,
        pushpins: entities,
        bingMapsCredentials: process.env.BING_MAPS_CREDENTIALS
      }
    });
  };


if (!initialized) {
    pushpinService.initialize(action);
  } else {
    action();
  }
};

exports.createPushpin = function (request, response) {
  var action = function (error) {
    if (!error) {
      initialized = true;
    }

    var pushpinData = request.body;
    var pushpinImage = null;

    if (request.files && request.files.image && request.files.image.size > 0) {
      pushpinImage = request.files.image;
    }

    pushpinService.createPushpin(pushpinData, pushpinImage, function (createPushpinError) {
      if (createPushpinError) {
        response.writeHead(500, { 'Content-Type': 'text/plain' });
        response.end(JSON.stringify(util.inspect(createPushpinError)));
      } else {
        exports.io.sockets.emit('addPushpin', pushpinData);

        response.redirect('/');
      }
    });
  };

 if (!initialized) {
    pushpinService.initialize(action);
  } else {
    action();
  }
};

exports.socketConnection = function(socket) {
  socket.on('removePushpin', function(pushpin) {
    pushpinService.removePushpin(pushpin, function(error) {
      if (!error) {
        exports.io.sockets.emit('removePushpin', pushpin);
        socket.emit('removePushpin', pushpin);
      }
    });
  });

  socket.on('clearPushpins', function() {
    pushpinService.clearPushpins(function(error) {
      initialized = false;
      if (!error) {
        exports.io.sockets.emit('clearPushpins');
        socket.emit('clearPushpins');
      }
    });
  });
};
