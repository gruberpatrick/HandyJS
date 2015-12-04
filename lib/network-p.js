var fs = require("fs");
var http = require("http");
var https = require("https");
var querystring = require('querystring');
var WS = require("ws");

module.exports = {

  // request a local file
  localFileRequest: function(sLocation, fCallback){
    if(fs.existsSync(sLocation)){
      fCallback(fs.readFileSync(sLocation, {encoding:"utf8"}), 200);
      fCallback("", 0);
    }else{
      fCallback("", -1)
    }
  },

  // request a remote file
  remoteFileRequest: function(sDomain, sPath, sType, sMethod, oParams, oHeaders, lPort, fCallback){
    // set request options
    var sParams = querystring.stringify(oParams);
    var oOptions = {
      hostname: sDomain,
      port: lPort,
      path: sPath,
      method: sMethod,
      headers: oHeaders
    };
    oOptions["headers"]["Content-Type"] = "application/x-www-form-urlencoded";
    oOptions["headers"]["Content-Length"] = Buffer.byteLength(sParams);
    // make request
    var oReq = null;
    if(sType == "http"){ // http request
      oReq = http.request(oOptions, function(oRes){
        oRes.on("data", function(oChunk){
          fCallback(oChunk.toString("utf8"), oRes.statusCode);
        });
        oRes.on("end", function(){
          fCallback("", 0);
        });
      });
    }else if(sType == "https"){ // https request
      if(oOptions['port'] == 80) oOptions['port'] = 443; // force https request port to 443
      oReq = https.request(oOptions, function(oRes){
        oRes.on("data", function(oChunk){
          console.log();
          fCallback(oChunk.toString("utf8"), oRes.statusCode);
        });
        oRes.on("end", function(){
          fCallback("", 0);
        });
      });
    }else{
      return;
    }
    oReq.on("error", function(){
      fCallback("", -1);
    });
    oReq.write(sParams);
    oReq.end();
  },

  // request local, http or https file
  fileRequest: function(sLocation, fCallback, sMethod, oParams, oHeaders, lPort){
    // define standard values
    if(typeof sLocation == "undefined") return;
    if(typeof fCallback == "undefined") fCallback = function(){};
    if(typeof sMethod == "undefined") sMethod = "GET";
    if(typeof oParams == "undefined") oParams = {};
    if(typeof oHeaders == "undefined") oHeaders = {};
    if(typeof lPort == "undefined") lPort = 80;
    // detect request type
    var sFileType = sLocation.substr(0, sLocation.indexOf(":"));
    var sDomain = sLocation.substr(sLocation.indexOf("/") + 1);
    sDomain = sDomain.substr(sDomain.indexOf("/") + 1);
    // get a local file
    if(sFileType == "file")
      return this.localFileRequest(sDomain, fCallback)
    // determine path for domain
    var lPos = sDomain.indexOf("/");
    var sPath = "";
    if(lPos >= 0){
      sPath = sDomain.substr(lPos);
      sDomain = sDomain.substr(0, lPos);
    }else{
      sPath = "/";
    }
    // handle http and https request
    if(sFileType == "http" || sFileType == "https"){
      return this.remoteFileRequest(sDomain, sPath, sFileType, sMethod, oParams, oHeaders, lPort, fCallback);
    }
    return "";
  },

  // write data to local file
  fileWrite: function(sLocation, sContent, bAppend){
    // define standard values
    if(typeof sLocation == "undefined") return;
    if(typeof sContent == "undefined") return;
    if(typeof bAppend == "undefined") bAppend = false;
    // write data to file
    if(!fs.existsSync(sLocation) && bAppend)
      return false;
    var sMode = "w+";
    if(bAppend)
      sMode = "a+";
    fs.writeFileSync(sLocation, sContent, {encoding:"utf8",flag:sMode});
    return true;
  },

  // websocket object
  oSocket: {

    oWebSocketObject: null,
    oWebSocketClients: {},
    oLastConnection: {},
    sType: "",

    // initialize websocket
    initializeWebSocket: function(lPort, fConnectionCallback, fMessageCallback, fErrorCallback){
      // start server
      if(this.sType != "")
        return false;
      var oThat = this;
      this.sType = "server";
      this.oWebSocketObject = new WS.Server({port:lPort});
      this.oWebSocketObject.on("connection", function(oWS){
        // add client to object
        if(typeof fConnectionCallback != "undefined")
            fConnectionCallback(oWS);
        var lCurrentDate = Date.now();
        oThat.oWebSocketClients[oWS.upgradeReq.headers["sec-websocket-key"]] = {
          sKey: oWS.upgradeReq.headers["sec-websocket-key"],
          sLastMessage: "",
          lFirstConnectionTime: lCurrentDate,
          lLastConnectionTime: lCurrentDate,
          oClientWebSocket: oWS
        };
        // handle new message
        oWS.on("message", function(sMessage){
          oThat.oWebSocketClients[oWS.upgradeReq.headers["sec-websocket-key"]]["lLastConnectionTime"] = Date.now();
          oThat.oWebSocketClients[oWS.upgradeReq.headers["sec-websocket-key"]]["sLastMessage"] = sMessage;
          if(typeof fMessageCallback != "undefined")
            fMessageCallback(oWS.upgradeReq.headers["sec-websocket-key"], oThat.oWebSocketClients[oWS.upgradeReq.headers["sec-websocket-key"]]);
        });
        // handle connection closed
        oWS.on("close", function(){
          delete oThat.oWebSocketClients[oWS.upgradeReq.headers["sec-websocket-key"]];
        });
        // handle connection error
        oWS.on("error", function(e){
          if(typeof fMessageCallback != "undefined")
            fErrorCallback(e);
        });
      });
    },

    // broadcast to all clients
    clientBroadcast: function(sData){
      if(this.sType != "server")
        return false;
      if(typeof sData == "object")
        sData = JSON.stringify(sData);
      for(var sKeys in this.oWebSocketClients){
        try{
          this.oWebSocketClients[sKeys].oClientWebSocket.send(sData);
          return true;
        }catch(e){
          delete this.oWebSocketClients[sKeys];
          return false;
        }
      }
    },

    // send to specific clients
    clientSend: function(client, sData){
      if(this.sType != "server")
        return false;
      if(typeof client == "string")
        client =  this.oWebSocketClients[client];
      if(typeof sData == "object")
        sData = JSON.stringify(sData);
      try{
        client.oClientWebSocket.send(sData);
        return true;
      }catch(e){
        delete this.oWebSocketClients[client.oClientWebSocket.sKey];
        return false;
      }
    },

    // connect to websocket
    connectWebSocket: function(sHost, lPort, fConnectionCallback, fMessageCallback, fErrorCallback){
      // start server
      if(this.sType != "")
        return false;
      var oThat = this;
      this.sType = "client";
      this.oWebSocketObject = new WS("ws://" + sHost + ":" + lPort);
      // handle open event
      this.oWebSocketObject.on("open", function(){
        var lCurrentDate = Date.now();
        oThat.oLastConnection = {
          sLastMessage: "",
          lFirstConnectionTime: lCurrentDate,
          lLastConnectionTime: lCurrentDate
        };
        if(typeof fConnectionCallback != "undefined")
          fConnectionCallback();
      });
      // handle message event
      this.oWebSocketObject.on("message", function(sData, lFlags){
        oThat.oLastConnection["sLastMessage"] = sData;
        oThat.oLastConnection["lLastConnectionTime"] = Date.now();
        if(typeof fMessageCallback != "undefined")
          fMessageCallback(oThat.oLastConnection, lFlags);
      });
      // handle close event
      this.oWebSocketObject.on("close", function(){
        oThat.oWebSocketObject = null;
        oThat.sType = "";
        oThat.oLastConnection = {};
      });
       // handle error event
      this.oWebSocketObject.on("error", function(e){
        if(typeof fErrorCallback != "undefined")
          fErrorCallback(e);
      });
    },

    serverSend: function(sData){
      if(this.sType != "client")
        return false;
      if(typeof sData == "object")
        sData = JSON.stringify(sData);
      this.oWebSocketObject.send(sData);
      return true;
    }

  }

};
