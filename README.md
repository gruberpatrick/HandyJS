# HandyJS

## FILE OPERATIONS

**Networking.fileRequest(** sLocation, fCallback = *function(){}*, sMethod = *"GET"*, oParams = *{}*, oHeaders = *{}*, lPort = *80* **)**

**@param** sLocation : Triggers for http, https and local files ("http://", "https://", "file://").<br />
**@param** fCallback : Callback function for response.<br />
**@param** sMethod   : GET or POST request.<br />
**@param** oParams   : Object of POST parameters.<br />
**@param** oHeaders  : Set header settings for request.<br />
**@param** lPort     : Set the port for the request. If https is used, the port is automatically set to 443.

**EXAMPLE**
```
var sContent = "";
Networking.fileRequest("https://localhost/tests/requests.php?test=A", function(sData, lStatus){
  if(lStatus == 200)
    sContent += sData;
  else if(lStatus == 0)
    console.log(sData); // request complete now
}, "POST", {"test":"B"}, {}, 443);
```

**Networking.fileWrite(** sLocation, sContent, bAppend = *false* **)**

**@param** sLocation : Set local file to write data to.<br />
**@param** sContent  : Data to be written to file.<br />
**@param** sMethod   : Append = true; Overwrite = false.

**EXAMPLE**
```
Networking.fileWrite("./testfile", "Write this to a file.", true);
```

## SOCKET OPERATIONS

### SERVER:

**Networking.initializeWebSocket(** lPort, fConnectionCallback, fMessageCallback, fErrorCallback **)**

**@param** lPort                : Port to open.<br />
**@param** fConnectionCallback  : Callback for opened connection.<br />
**@param** fMessageCallback     : Callback for message received.<br />
**@param** fErrorCallback       : Callback for error handling.

**Networking.clientBroadcast(** sData **)**

**@param** sData : Data to send to all clients. If object, data is transformed to string.

**Networking.clientSend(** client, sData **)**

**@param** client : Client either as object or the key as string.<br />
**@param** sData  : Data to send to all clients. If object, data is transformed to string.

**Networking.clientData(** client, oData **)**

**@param** sKey   : Client key as string.<br />
**@param** oData  : Data to send to client object session.

**EXAMPLE**
```
Networking.oSocket.initializeWebSocket(3333, function(oWS){
  console.log("SERVER: Connection opened.");
}, function(sClientKey, oClient){
  console.log("CLIENT #" + sClientKey + ": " + oClient['sLastMessage']);
  Networking.oSocket.clientBroadcast("New connection!");
}, function(e){
  console.log(e);
});
```

### CLIENT:

**Networking.connectWebSocket(** sHost, lPort, fConnectionCallback, fMessageCallback, fErrorCallback **)**

**@param** sHost                : Host to connect to.<br />
**@param** lPort                : Port to connect to.<br />
**@param** fConnectionCallback  : Callback for opened connection.<br />
**@param** fMessageCallback     : Callback for message received.<br />
**@param** fErrorCallback       : Callback for error handling.

**Networking.serverSend(** sData **)**

**@param** sData : Data to send to server. If object, data is transformed to string.

**EXAMPLE**
```
Networking.oSocket.connectWebSocket("localhost", 3333, function(oWS){
  console.log("CLIENT: connection opened");
  Networking.oSocket.serverSend("hey server!");
}, function(oServer){
  console.log("SERVER: " + oServer["sLastMessage"]);
}, function(e){
  console.log(e);
});
```
