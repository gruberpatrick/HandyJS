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

    checkLibMessage: function(sKey, oTo){
      if(oTo.sLastMessage.indexOf("[HANDYJS]") != 0)
        return false;

      //console.log(oTo.sLastMessage);

      var oData = JSON.parse(oTo.sLastMessage.substr(9));
      var sData = "";
      if(oData.sType == "ping-request"){
        sData = JSON.stringify({sType:"ping-response",lTime:Date.now()-oData.lTime});
      }else if(oData.sType == "ping-response"){
        if(sKey != "")
          this.setServerValue({bPingResponse:true});
        else
          this.setClientValue(sKey, {bPingResponse:true});
      }

      //console.log(this.getServerValue("bPingResponse").toString());

      if(sData == "")
        return true;

      if(this.sType == "server")
        this.clientSend(oTo, "[HANDYJS]" + sData);
      else if(this.sType == "client")
        this.serverSend("[HANDYJS]" + sData);

      return true;
    },

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
          if(oThat.checkLibMessage(oWS.upgradeReq.headers["sec-websocket-key"], oThat.oWebSocketClients[oWS.upgradeReq.headers["sec-websocket-key"]]))
            return;
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
      return true;
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
        //delete this.oWebSocketClients[client.oClientWebSocket.sKey];
        return false;
      }
    },

    // save a value to the client object
    setClientValue: function(sClient, oData){
      if(this.sType != "server")
        return false;

      for(var sKey in oData){
        this.oWebSocketClients[sClient][sKey] = oData[sKey];
      }

      return true;
    },

    getClientValue: function(sClient, sKey){
      if(this.sType != "server")
        return false;

      return this.oWebSocketClients[sClient][sKey];
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
        if(oThat.checkLibMessage("", oThat.oLastConnection))
          return;
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

      return true;
    },

    // send message to server
    serverSend: function(sData){
      if(this.sType != "client")
        return false;

      if(typeof sData == "object")
        sData = JSON.stringify(sData);

      this.oWebSocketObject.send(sData);
      return true;
    },

    // save a value to the server object
    setServerValue: function(sClient, oData){
      if(this.sType != "client")
        return false;

      for(var sKey in oData){
        this.oLastConnection[sKey] = oData[sKey];
      }

      return true;
    },

    getServerValue: function(sKey){
      if(this.sType != "client")
        return false;

      return this.oLastConnection[sKey];
    },

    // check if connection is up
    startConnectionCheck: function(lTimeout, fNoConnection){
      if(this.sType != "client" && this.sType != "server")
        return false;

      var oThat = this;
      setInterval(function(){
        // TODO: handle when no ping response
        if(oThat.sType == "client"){
          if(oThat.getServerValue("bPingResponse") && typeof fNoConnection == "function")
            fNoConnection();
          oThat.serverSend("[HANDYJS]" + JSON.stringify({sType:"ping-request",lTime:Date.now()}));
          oThat.setServerValue({bPingResponse:false});
        }else{
          for(var sKeys in oThat.oWebSocketClients){
            if(oThat.getClientValue(sKeys, "bPingResponse") && typeof fNoConnection == "function")
              fNoConnection();
            oThat.clientSend(sKeys, "[HANDYJS]" + JSON.stringify({sType:"ping-request",lTime:Date.now()}));
            oThat.setClientValue(sKeys, {bPingResponse:false});
          }
        }
      }, lTimeout);
    }

  }

};
