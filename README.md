# HandyJS

## FILE OPERATIONS

**Networking.fileRequest(** sLocation, fCallback = *function(){}*, sMethod = *"GET"*, oParams = *{}*, oHeaders = *{}*, lPort = *80* **)**

**@param** sLocation : Triggers for http, https and local files ("http://", "https://", "file://").
**@param** fCallback : Callback function for response.
**@param** sMethod   : GET or POST request.
**@param** oParams   : Object of POST parameters.
**@param** oHeaders  : Set header settings for request.
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

**@param** sLocation : Set local file to write data to.
**@param** sContent  : Data to be written to file.
**@param** sMethod   : Append = true; Overwrite = false.

**EXAMPLE**
```
Networking.fileWrite("./testfile", "Write this to a file.", true);
```

## SOCKET OPERATIONS

### SERVER:

**Networking.initializeWebSocket(lPort, fConnectionCallback, fMessageCallback, fErrorCallback)**

**@param** lPort                : Port to open.

**@param** fConnectionCallback  : Callback for opened connection.

**@param** fMessageCallback     : Callback for message received.

**@param** fErrorCallback       : Callback for error handling.

**Networking.clientBroadcast(sData)**

**@param** sData : Data to send to all clients. If object, data is transformed to string.

**Networking.clientSend(client, sData)**

**@param** client : Client eighter as object or the key as string.

**@param** sData  : Data to send to all clients. If object, data is transformed to string.

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

**CLIENT:**

**Networking.connectWebSocket(sHost, lPort, fConnectionCallback, fMessageCallback, fErrorCallback)**

**@param** sHost                : Host to connect to.

**@param** lPort                : Port to connect to.

**@param** fConnectionCallback  : Callback for opened connection.

**@param** fMessageCallback     : Callback for message received.

**@param** fErrorCallback       : Callback for error handling.

**Networking.serverSend(sData)**

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
});s
```
