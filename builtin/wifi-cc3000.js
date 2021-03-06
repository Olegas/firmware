var util = require('util');
var EventEmitter = require('events').EventEmitter;

var hw = process.binding('hw');

function Wifi(){
  var self = this;

  if (Wifi.instance) {
    return Wifi.instance;
  }
  else {
    Wifi.instance = this;
  }

  self.connect = function(options, callback){
    // options consists of 
    // { ssid: 
    //   , password: optional only if security == "unsecured"
    //   , security: defaults to wpa2 
    //   , timeout: defaults to 20s
    // }

    if (!options || !options.ssid) {
      throw Error("No SSID given");
    }

    options.security = (options.security && options.security.toLowerCase()) || "wpa2";
    options.timeout = options.timeout || 20;

    if (!options.password && options.security != "unsecured") {
      throw Error("No password given for a network with security type", options.security);
    }

    // initiate connection
    var ret = hw.wifi_connect(options.ssid, options.password, options.security);
    var connectionTimeout;

    if (ret != 0) {
      process.removeListener('wifi_connect_complete', callback);

      self._failProcedure("Previous wifi connect is in the middle of a call", callback);
    } else {
      connectionTimeout = setTimeout(function(){
        self.emit('timeout', null);
        callback && callback("Connection timed out");
      }, options.timeout * 1000);
    }

    if (callback) {
      process.once('wifi_connect_complete', function(err, data){
        clearTimeout(connectionTimeout);
        if (!err) {
          try {
            callback(err, JSON.parse(data));
          } catch (e) {
            callback(e);
          }
        } else {
          callback(err, data);
        }
      });
    }
    
    process.on('wifi_connect_complete', function(err, data){
      clearTimeout(connectionTimeout);
      if (!err) {
        try {
          self.emit('connect', err, JSON.parse(data));
        } catch (e) {
          self.emit('connect', e);
        }
      } else {
        self.emit('disconnect', err, data)
      }
    })

    return self;
  }

  self.isConnected = function() {
    return hw.wifi_is_connected() == 1 ? true : false;
  }

  self.isBusy = function(){
    return hw.wifi_is_busy() == 1 ? true : false;
  }

  self.connection = function() {
    var data = JSON.parse(hw.wifi_connection());
    if (data.connected) {
      return data;
    }
    return null;
  }

  self.reset = function(callback) {
    // disable and then enable
    self.disable();
    self.enable();
    callback && callback();
    return self;
  }

  self.disconnect = function(callback){
    if (self.isConnected()){

      process.once('wifi_disconnect_complete', function(err, data){
        self.emit('disconnect', err, data);

        callback && callback();
      });

      // disconnect
      var ret = hw.wifi_disconnect();

      if (ret != 0) {
        process.removeListener('wifi_disconnect_complete', callback);
        self._failProcedure("Could not disconnect properly, wifi is currently busy.", callback);
      }

    } else {
      self._failProcedure("Cannot disconnect. Wifi is not currently connnected.", callback);
    }
  }

  self._failProcedure = function (err, callback){
    self.emit('error', err);
    if (callback) callback(err);
  } 

  self.isEnabled = function() {
    return hw.wifi_is_enabled() == 1 ? true : false;
  }

  self.disable = function(callback) {
    hw.wifi_disable();
    callback && callback();
    return self;
  }

  self.enable = function(callback) {
    hw.wifi_enable();
    callback && callback();
    return self;
  }
}

util.inherits(Wifi, EventEmitter);

module.exports = new Wifi();
