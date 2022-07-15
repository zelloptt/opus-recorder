var Module = typeof Module !== "undefined" ? Module : {};

(function webpackUniversalModuleDefinition(root, factory) {
 if (typeof exports === "object" && typeof module === "object") module.exports = factory(); else if (typeof define === "function" && define.amd) define([], factory); else if (typeof exports === "object") exports["DecoderWorker"] = factory(); else root["DecoderWorker"] = factory();
})(typeof self !== "undefined" ? self : this, () => {
 return (() => {
  "use strict";
  var __webpack_modules__ = {
   "./src/decoderWorker.js": (module, __unused_webpack_exports, __webpack_require__) => {
    eval("\n\nvar decoder;\nvar mainReadyResolve;\nvar mainReady = new Promise(function(resolve){ mainReadyResolve = resolve; });\n\n__webpack_require__.g['onmessage'] = function( e ){\n  mainReady.then(function(){\n    switch( e['data']['command'] ){\n\n      case 'decode':\n        if (decoder){\n          decoder.decode( e['data']['pages'] );\n        }\n        break;\n\n      case 'done':\n        if (decoder) {\n          decoder.sendLastBuffer();\n          __webpack_require__.g['close']();\n        }\n        break;\n\n      case 'init':\n        decoder = new OggOpusDecoder( e['data'], Module );\n        break;\n\n      default:\n        // Ignore any unknown commands and continue recieving commands\n    }\n  });\n};\n\nvar OggOpusDecoder = function( config, Module ){\n\n  if ( !Module ) {\n    throw new Error('Module with exports required to initialize a decoder instance');\n  }\n\n  this.mainReady = mainReady; // Expose for unit testing\n  this.config = Object.assign({ \n    bufferLength: 4096, // Define size of outgoing buffer\n    decoderSampleRate: 48000, // Desired decoder sample rate.\n    outputBufferSampleRate: 48000, // Desired output sample rate. Audio will be resampled\n    resampleQuality: 3, // Value between 0 and 10 inclusive. 10 being highest quality.\n  }, config );\n\n  this._opus_decoder_create = Module._opus_decoder_create;\n  this._opus_decoder_destroy = Module._opus_decoder_destroy;\n  this._speex_resampler_process_interleaved_float = Module._speex_resampler_process_interleaved_float;\n  this._speex_resampler_init = Module._speex_resampler_init;\n  this._speex_resampler_destroy = Module._speex_resampler_destroy;\n  this._opus_decode_float = Module._opus_decode_float;\n  this._free = Module._free;\n  this._malloc = Module._malloc;\n  this.HEAPU8 = Module.HEAPU8;\n  this.HEAP32 = Module.HEAP32;\n  this.HEAPF32 = Module.HEAPF32;\n\n  this.outputBuffers = [];\n};\n\n\nOggOpusDecoder.prototype.decode = function( typedArray ) {\n  var dataView = new DataView( typedArray.buffer );\n  this.getPageBoundaries( dataView ).map( function( pageStart ) {\n    var headerType = dataView.getUint8( pageStart + 5, true );\n    var pageIndex = dataView.getUint32( pageStart + 18, true );\n\n    // Beginning of stream\n    if ( headerType & 2 ) {\n      this.numberOfChannels = dataView.getUint8( pageStart + 37, true );\n      this.init();\n    }\n\n    // Decode page\n    if ( pageIndex > 1 ) {\n      var segmentTableLength = dataView.getUint8( pageStart + 26, true );\n      var segmentTableIndex = pageStart + 27 + segmentTableLength;\n\n      for ( var i = 0; i < segmentTableLength; i++ ) {\n        var packetLength = dataView.getUint8( pageStart + 27 + i, true );\n        this.decoderBuffer.set( typedArray.subarray( segmentTableIndex, segmentTableIndex += packetLength ), this.decoderBufferIndex );\n        this.decoderBufferIndex += packetLength;\n\n        if ( packetLength < 255 ) {\n          var outputSampleLength = this._opus_decode_float( this.decoder, this.decoderBufferPointer, this.decoderBufferIndex, this.decoderOutputPointer, this.decoderOutputMaxLength, 0);\n          var resampledLength = Math.ceil( outputSampleLength * this.config.outputBufferSampleRate / this.config.decoderSampleRate );\n          this.HEAP32[ this.decoderOutputLengthPointer >> 2 ] = outputSampleLength;\n          this.HEAP32[ this.resampleOutputLengthPointer >> 2 ] = resampledLength;\n          this._speex_resampler_process_interleaved_float( this.resampler, this.decoderOutputPointer, this.decoderOutputLengthPointer, this.resampleOutputBufferPointer, this.resampleOutputLengthPointer );\n          this.sendToOutputBuffers( this.HEAPF32.subarray( this.resampleOutputBufferPointer >> 2, (this.resampleOutputBufferPointer >> 2) + resampledLength * this.numberOfChannels ) );\n          this.decoderBufferIndex = 0;\n        }\n      }\n\n      // End of stream\n      if ( headerType & 4 ) {\n        this.sendLastBuffer();\n      }\n    }\n  }, this );\n};\n\nOggOpusDecoder.prototype.getPageBoundaries = function( dataView ){\n  var pageBoundaries = [];\n\n  for ( var i = 0; i < dataView.byteLength - 32; i++ ) {\n    if ( dataView.getUint32( i, true ) == 1399285583 ) {\n      pageBoundaries.push( i );\n    }\n  }\n\n  return pageBoundaries;\n};\n\nOggOpusDecoder.prototype.init = function(){\n  this.resetOutputBuffers();\n  this.initCodec();\n  this.initResampler();\n};\n\nOggOpusDecoder.prototype.initCodec = function() {\n\n  if ( this.decoder ) {\n    this._opus_decoder_destroy( this.decoder );\n    this._free( this.decoderBufferPointer );\n    this._free( this.decoderOutputLengthPointer );\n    this._free( this.decoderOutputPointer );\n  }\n\n  var errReference = this._malloc( 4 );\n  this.decoder = this._opus_decoder_create( this.config.decoderSampleRate, this.numberOfChannels, errReference );\n  this._free( errReference );\n\n  this.decoderBufferMaxLength = 4000;\n  this.decoderBufferPointer = this._malloc( this.decoderBufferMaxLength );\n  this.decoderBuffer = this.HEAPU8.subarray( this.decoderBufferPointer, this.decoderBufferPointer + this.decoderBufferMaxLength );\n  this.decoderBufferIndex = 0;\n\n  this.decoderOutputLengthPointer = this._malloc( 4 );\n  this.decoderOutputMaxLength = this.config.decoderSampleRate * this.numberOfChannels * 120 / 1000; // Max 120ms frame size\n  this.decoderOutputPointer = this._malloc( this.decoderOutputMaxLength * 4 ); // 4 bytes per sample\n};\n\nOggOpusDecoder.prototype.initResampler = function() {\n\n  if ( this.resampler ) {\n    this._speex_resampler_destroy( this.resampler );\n    this._free( this.resampleOutputLengthPointer );\n    this._free( this.resampleOutputBufferPointer );\n  }\n\n  var errLocation = this._malloc( 4 );\n  this.resampler = this._speex_resampler_init( this.numberOfChannels, this.config.decoderSampleRate, this.config.outputBufferSampleRate, this.config.resampleQuality, errLocation );\n  this._free( errLocation );\n\n  this.resampleOutputLengthPointer = this._malloc( 4 );\n  this.resampleOutputMaxLength = Math.ceil( this.decoderOutputMaxLength * this.config.outputBufferSampleRate / this.config.decoderSampleRate );\n  this.resampleOutputBufferPointer = this._malloc( this.resampleOutputMaxLength * 4 ); // 4 bytes per sample\n};\n\nOggOpusDecoder.prototype.resetOutputBuffers = function(){\n  this.outputBuffers = [];\n  this.outputBufferArrayBuffers = [];\n  this.outputBufferIndex = 0;\n\n  for ( var i = 0; i < this.numberOfChannels; i++ ) {\n    this.outputBuffers.push( new Float32Array( this.config.bufferLength ) );\n    this.outputBufferArrayBuffers.push( this.outputBuffers[i].buffer );\n  }\n};\n\nOggOpusDecoder.prototype.sendLastBuffer = function(){\n  this.sendToOutputBuffers( new Float32Array( ( this.config.bufferLength - this.outputBufferIndex ) * this.numberOfChannels ) );\n  __webpack_require__.g['postMessage'](null);\n};\n\nOggOpusDecoder.prototype.sendToOutputBuffers = function( mergedBuffers ){\n  var dataIndex = 0;\n  var mergedBufferLength = mergedBuffers.length / this.numberOfChannels;\n\n  while ( dataIndex < mergedBufferLength ) {\n    var amountToCopy = Math.min( mergedBufferLength - dataIndex, this.config.bufferLength - this.outputBufferIndex );\n\n    if (this.numberOfChannels === 1) {\n      this.outputBuffers[0].set( mergedBuffers.subarray( dataIndex, dataIndex + amountToCopy ), this.outputBufferIndex );\n    }\n\n    // Deinterleave\n    else {\n      for ( var i = 0; i < amountToCopy; i++ ) {\n        this.outputBuffers.forEach( function( buffer, channelIndex ) {\n          buffer[ this.outputBufferIndex + i ] = mergedBuffers[ ( dataIndex + i ) * this.numberOfChannels + channelIndex ];\n        }, this);\n      }\n    }\n\n    dataIndex += amountToCopy;\n    this.outputBufferIndex += amountToCopy;\n\n    if ( this.outputBufferIndex == this.config.bufferLength ) {\n      __webpack_require__.g['postMessage']( this.outputBuffers, this.outputBufferArrayBuffers );\n      this.resetOutputBuffers();\n    }\n  }\n};\n\n\nif (!Module) {\n  Module = {};\n}\n\nModule['mainReady'] = mainReady;\nModule['OggOpusDecoder'] = OggOpusDecoder;\nModule['onRuntimeInitialized'] = mainReadyResolve;\n\nmodule.exports = Module;\n\n\n//# sourceURL=webpack://DecoderWorker/./src/decoderWorker.js?");
   }
  };
  var __webpack_module_cache__ = {};
  function __webpack_require__(moduleId) {
   var cachedModule = __webpack_module_cache__[moduleId];
   if (cachedModule !== undefined) {
    return cachedModule.exports;
   }
   var module = __webpack_module_cache__[moduleId] = {
    exports: {}
   };
   __webpack_modules__[moduleId](module, module.exports, __webpack_require__);
   return module.exports;
  }
  (() => {
   __webpack_require__.g = function() {
    if (typeof globalThis === "object") return globalThis;
    try {
     return this || new Function("return this")();
    } catch (e) {
     if (typeof window === "object") return window;
    }
   }();
  })();
  var __webpack_exports__ = __webpack_require__("./src/decoderWorker.js");
  return __webpack_exports__;
 })();
});

var moduleOverrides = {};

var key;

for (key in Module) {
 if (Module.hasOwnProperty(key)) {
  moduleOverrides[key] = Module[key];
 }
}

var arguments_ = [];

var thisProgram = "./this.program";

var quit_ = function(status, toThrow) {
 throw toThrow;
};

var ENVIRONMENT_IS_WEB = false;

var ENVIRONMENT_IS_WORKER = false;

var ENVIRONMENT_IS_NODE = false;

var ENVIRONMENT_HAS_NODE = false;

var ENVIRONMENT_IS_SHELL = false;

ENVIRONMENT_IS_WEB = typeof window === "object";

ENVIRONMENT_IS_WORKER = typeof importScripts === "function";

ENVIRONMENT_HAS_NODE = typeof process === "object" && typeof process.versions === "object" && typeof process.versions.node === "string";

ENVIRONMENT_IS_NODE = ENVIRONMENT_HAS_NODE && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER;

ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;

var scriptDirectory = "";

function locateFile(path) {
 if (Module["locateFile"]) {
  return Module["locateFile"](path, scriptDirectory);
 }
 return scriptDirectory + path;
}

var read_, readAsync, readBinary, setWindowTitle;

if (ENVIRONMENT_IS_NODE) {
 scriptDirectory = __dirname + "/";
 var nodeFS;
 var nodePath;
 read_ = function shell_read(filename, binary) {
  var ret;
  if (!nodeFS) nodeFS = require("fs");
  if (!nodePath) nodePath = require("path");
  filename = nodePath["normalize"](filename);
  ret = nodeFS["readFileSync"](filename);
  return binary ? ret : ret.toString();
 };
 readBinary = function readBinary(filename) {
  var ret = read_(filename, true);
  if (!ret.buffer) {
   ret = new Uint8Array(ret);
  }
  assert(ret.buffer);
  return ret;
 };
 if (process["argv"].length > 1) {
  thisProgram = process["argv"][1].replace(/\\/g, "/");
 }
 arguments_ = process["argv"].slice(2);
 if (typeof module !== "undefined") {
  module["exports"] = Module;
 }
 process["on"]("uncaughtException", function(ex) {
  if (!(ex instanceof ExitStatus)) {
   throw ex;
  }
 });
 process["on"]("unhandledRejection", abort);
 quit_ = function(status) {
  process["exit"](status);
 };
 Module["inspect"] = function() {
  return "[Emscripten Module object]";
 };
} else if (ENVIRONMENT_IS_SHELL) {
 if (typeof read != "undefined") {
  read_ = function shell_read(f) {
   return read(f);
  };
 }
 readBinary = function readBinary(f) {
  var data;
  if (typeof readbuffer === "function") {
   return new Uint8Array(readbuffer(f));
  }
  data = read(f, "binary");
  assert(typeof data === "object");
  return data;
 };
 if (typeof scriptArgs != "undefined") {
  arguments_ = scriptArgs;
 } else if (typeof arguments != "undefined") {
  arguments_ = arguments;
 }
 if (typeof quit === "function") {
  quit_ = function(status) {
   quit(status);
  };
 }
 if (typeof print !== "undefined") {
  if (typeof console === "undefined") console = {};
  console.log = print;
  console.warn = console.error = typeof printErr !== "undefined" ? printErr : print;
 }
} else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
 if (ENVIRONMENT_IS_WORKER) {
  scriptDirectory = self.location.href;
 } else if (document.currentScript) {
  scriptDirectory = document.currentScript.src;
 }
 if (scriptDirectory.indexOf("blob:") !== 0) {
  scriptDirectory = scriptDirectory.substr(0, scriptDirectory.lastIndexOf("/") + 1);
 } else {
  scriptDirectory = "";
 }
 read_ = function shell_read(url) {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", url, false);
  xhr.send(null);
  return xhr.responseText;
 };
 if (ENVIRONMENT_IS_WORKER) {
  readBinary = function readBinary(url) {
   var xhr = new XMLHttpRequest();
   xhr.open("GET", url, false);
   xhr.responseType = "arraybuffer";
   xhr.send(null);
   return new Uint8Array(xhr.response);
  };
 }
 readAsync = function readAsync(url, onload, onerror) {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", url, true);
  xhr.responseType = "arraybuffer";
  xhr.onload = function xhr_onload() {
   if (xhr.status == 200 || xhr.status == 0 && xhr.response) {
    onload(xhr.response);
    return;
   }
   onerror();
  };
  xhr.onerror = onerror;
  xhr.send(null);
 };
 setWindowTitle = function(title) {
  document.title = title;
 };
} else {}

var out = Module["print"] || console.log.bind(console);

var err = Module["printErr"] || console.warn.bind(console);

for (key in moduleOverrides) {
 if (moduleOverrides.hasOwnProperty(key)) {
  Module[key] = moduleOverrides[key];
 }
}

moduleOverrides = null;

if (Module["arguments"]) arguments_ = Module["arguments"];

if (Module["thisProgram"]) thisProgram = Module["thisProgram"];

if (Module["quit"]) quit_ = Module["quit"];

var asm2wasmImports = {
 "f64-rem": function(x, y) {
  return x % y;
 },
 "debugger": function() {}
};

var functionPointers = new Array(0);

var wasmBinary;

if (Module["wasmBinary"]) wasmBinary = Module["wasmBinary"];

var noExitRuntime;

if (Module["noExitRuntime"]) noExitRuntime = Module["noExitRuntime"];

if (typeof WebAssembly !== "object") {
 err("no native wasm support detected");
}

var wasmMemory;

var wasmTable = new WebAssembly.Table({
 "initial": 14,
 "maximum": 14,
 "element": "anyfunc"
});

var ABORT = false;

var EXITSTATUS = 0;

function assert(condition, text) {
 if (!condition) {
  abort("Assertion failed: " + text);
 }
}

var UTF8Decoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf8") : undefined;

function UTF8ArrayToString(u8Array, idx, maxBytesToRead) {
 var endIdx = idx + maxBytesToRead;
 var endPtr = idx;
 while (u8Array[endPtr] && !(endPtr >= endIdx)) ++endPtr;
 if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
  return UTF8Decoder.decode(u8Array.subarray(idx, endPtr));
 } else {
  var str = "";
  while (idx < endPtr) {
   var u0 = u8Array[idx++];
   if (!(u0 & 128)) {
    str += String.fromCharCode(u0);
    continue;
   }
   var u1 = u8Array[idx++] & 63;
   if ((u0 & 224) == 192) {
    str += String.fromCharCode((u0 & 31) << 6 | u1);
    continue;
   }
   var u2 = u8Array[idx++] & 63;
   if ((u0 & 240) == 224) {
    u0 = (u0 & 15) << 12 | u1 << 6 | u2;
   } else {
    u0 = (u0 & 7) << 18 | u1 << 12 | u2 << 6 | u8Array[idx++] & 63;
   }
   if (u0 < 65536) {
    str += String.fromCharCode(u0);
   } else {
    var ch = u0 - 65536;
    str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023);
   }
  }
 }
 return str;
}

function UTF8ToString(ptr, maxBytesToRead) {
 return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : "";
}

var UTF16Decoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf-16le") : undefined;

var WASM_PAGE_SIZE = 65536;

var buffer, HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;

function updateGlobalBufferAndViews(buf) {
 buffer = buf;
 Module["HEAP8"] = HEAP8 = new Int8Array(buf);
 Module["HEAP16"] = HEAP16 = new Int16Array(buf);
 Module["HEAP32"] = HEAP32 = new Int32Array(buf);
 Module["HEAPU8"] = HEAPU8 = new Uint8Array(buf);
 Module["HEAPU16"] = HEAPU16 = new Uint16Array(buf);
 Module["HEAPU32"] = HEAPU32 = new Uint32Array(buf);
 Module["HEAPF32"] = HEAPF32 = new Float32Array(buf);
 Module["HEAPF64"] = HEAPF64 = new Float64Array(buf);
}

var DYNAMIC_BASE = 5280704, DYNAMICTOP_PTR = 37616;

var INITIAL_TOTAL_MEMORY = Module["TOTAL_MEMORY"] || 16777216;

if (Module["wasmMemory"]) {
 wasmMemory = Module["wasmMemory"];
} else {
 wasmMemory = new WebAssembly.Memory({
  "initial": INITIAL_TOTAL_MEMORY / WASM_PAGE_SIZE,
  "maximum": INITIAL_TOTAL_MEMORY / WASM_PAGE_SIZE
 });
}

if (wasmMemory) {
 buffer = wasmMemory.buffer;
}

INITIAL_TOTAL_MEMORY = buffer.byteLength;

updateGlobalBufferAndViews(buffer);

HEAP32[DYNAMICTOP_PTR >> 2] = DYNAMIC_BASE;

function callRuntimeCallbacks(callbacks) {
 while (callbacks.length > 0) {
  var callback = callbacks.shift();
  if (typeof callback == "function") {
   callback();
   continue;
  }
  var func = callback.func;
  if (typeof func === "number") {
   if (callback.arg === undefined) {
    Module["dynCall_v"](func);
   } else {
    Module["dynCall_vi"](func, callback.arg);
   }
  } else {
   func(callback.arg === undefined ? null : callback.arg);
  }
 }
}

var __ATPRERUN__ = [];

var __ATINIT__ = [];

var __ATMAIN__ = [];

var __ATPOSTRUN__ = [];

var runtimeInitialized = false;

function preRun() {
 if (Module["preRun"]) {
  if (typeof Module["preRun"] == "function") Module["preRun"] = [ Module["preRun"] ];
  while (Module["preRun"].length) {
   addOnPreRun(Module["preRun"].shift());
  }
 }
 callRuntimeCallbacks(__ATPRERUN__);
}

function initRuntime() {
 runtimeInitialized = true;
 callRuntimeCallbacks(__ATINIT__);
}

function preMain() {
 callRuntimeCallbacks(__ATMAIN__);
}

function postRun() {
 if (Module["postRun"]) {
  if (typeof Module["postRun"] == "function") Module["postRun"] = [ Module["postRun"] ];
  while (Module["postRun"].length) {
   addOnPostRun(Module["postRun"].shift());
  }
 }
 callRuntimeCallbacks(__ATPOSTRUN__);
}

function addOnPreRun(cb) {
 __ATPRERUN__.unshift(cb);
}

function addOnPostRun(cb) {
 __ATPOSTRUN__.unshift(cb);
}

var runDependencies = 0;

var runDependencyWatcher = null;

var dependenciesFulfilled = null;

function addRunDependency(id) {
 runDependencies++;
 if (Module["monitorRunDependencies"]) {
  Module["monitorRunDependencies"](runDependencies);
 }
}

function removeRunDependency(id) {
 runDependencies--;
 if (Module["monitorRunDependencies"]) {
  Module["monitorRunDependencies"](runDependencies);
 }
 if (runDependencies == 0) {
  if (runDependencyWatcher !== null) {
   clearInterval(runDependencyWatcher);
   runDependencyWatcher = null;
  }
  if (dependenciesFulfilled) {
   var callback = dependenciesFulfilled;
   dependenciesFulfilled = null;
   callback();
  }
 }
}

Module["preloadedImages"] = {};

Module["preloadedAudios"] = {};

function abort(what) {
 if (Module["onAbort"]) {
  Module["onAbort"](what);
 }
 what += "";
 out(what);
 err(what);
 ABORT = true;
 EXITSTATUS = 1;
 throw "abort(" + what + "). Build with -s ASSERTIONS=1 for more info.";
}

var dataURIPrefix = "data:application/octet-stream;base64,";

function isDataURI(filename) {
 return String.prototype.startsWith ? filename.startsWith(dataURIPrefix) : filename.indexOf(dataURIPrefix) === 0;
}

var wasmBinaryFile = "decoderWorker.wasm";

if (!isDataURI(wasmBinaryFile)) {
 wasmBinaryFile = locateFile(wasmBinaryFile);
}

function getBinary() {
 try {
  if (wasmBinary) {
   return new Uint8Array(wasmBinary);
  }
  if (readBinary) {
   return readBinary(wasmBinaryFile);
  } else {
   throw "both async and sync fetching of the wasm failed";
  }
 } catch (err) {
  abort(err);
 }
}

function getBinaryPromise() {
 if (!wasmBinary && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) && typeof fetch === "function") {
  return fetch(wasmBinaryFile, {
   credentials: "same-origin"
  }).then(function(response) {
   if (!response["ok"]) {
    throw "failed to load wasm binary file at '" + wasmBinaryFile + "'";
   }
   return response["arrayBuffer"]();
  }).catch(function() {
   return getBinary();
  });
 }
 return new Promise(function(resolve, reject) {
  resolve(getBinary());
 });
}

function createWasm() {
 var info = {
  "env": asmLibraryArg,
  "wasi_unstable": asmLibraryArg,
  "global": {
   "NaN": NaN,
   Infinity: Infinity
  },
  "global.Math": Math,
  "asm2wasm": asm2wasmImports
 };
 function receiveInstance(instance, module) {
  var exports = instance.exports;
  Module["asm"] = exports;
  removeRunDependency("wasm-instantiate");
 }
 addRunDependency("wasm-instantiate");
 function receiveInstantiatedSource(output) {
  receiveInstance(output["instance"]);
 }
 function instantiateArrayBuffer(receiver) {
  return getBinaryPromise().then(function(binary) {
   return WebAssembly.instantiate(binary, info);
  }).then(receiver, function(reason) {
   err("failed to asynchronously prepare wasm: " + reason);
   abort(reason);
  });
 }
 function instantiateAsync() {
  if (!wasmBinary && typeof WebAssembly.instantiateStreaming === "function" && !isDataURI(wasmBinaryFile) && typeof fetch === "function") {
   fetch(wasmBinaryFile, {
    credentials: "same-origin"
   }).then(function(response) {
    var result = WebAssembly.instantiateStreaming(response, info);
    return result.then(receiveInstantiatedSource, function(reason) {
     err("wasm streaming compile failed: " + reason);
     err("falling back to ArrayBuffer instantiation");
     instantiateArrayBuffer(receiveInstantiatedSource);
    });
   });
  } else {
   return instantiateArrayBuffer(receiveInstantiatedSource);
  }
 }
 if (Module["instantiateWasm"]) {
  try {
   var exports = Module["instantiateWasm"](info, receiveInstance);
   return exports;
  } catch (e) {
   err("Module.instantiateWasm callback failed with error: " + e);
   return false;
  }
 }
 instantiateAsync();
 return {};
}

Module["asm"] = createWasm;

var PATH = {
 splitPath: function(filename) {
  var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
  return splitPathRe.exec(filename).slice(1);
 },
 normalizeArray: function(parts, allowAboveRoot) {
  var up = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
   var last = parts[i];
   if (last === ".") {
    parts.splice(i, 1);
   } else if (last === "..") {
    parts.splice(i, 1);
    up++;
   } else if (up) {
    parts.splice(i, 1);
    up--;
   }
  }
  if (allowAboveRoot) {
   for (;up; up--) {
    parts.unshift("..");
   }
  }
  return parts;
 },
 normalize: function(path) {
  var isAbsolute = path.charAt(0) === "/", trailingSlash = path.substr(-1) === "/";
  path = PATH.normalizeArray(path.split("/").filter(function(p) {
   return !!p;
  }), !isAbsolute).join("/");
  if (!path && !isAbsolute) {
   path = ".";
  }
  if (path && trailingSlash) {
   path += "/";
  }
  return (isAbsolute ? "/" : "") + path;
 },
 dirname: function(path) {
  var result = PATH.splitPath(path), root = result[0], dir = result[1];
  if (!root && !dir) {
   return ".";
  }
  if (dir) {
   dir = dir.substr(0, dir.length - 1);
  }
  return root + dir;
 },
 basename: function(path) {
  if (path === "/") return "/";
  var lastSlash = path.lastIndexOf("/");
  if (lastSlash === -1) return path;
  return path.substr(lastSlash + 1);
 },
 extname: function(path) {
  return PATH.splitPath(path)[3];
 },
 join: function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return PATH.normalize(paths.join("/"));
 },
 join2: function(l, r) {
  return PATH.normalize(l + "/" + r);
 }
};

var SYSCALLS = {
 buffers: [ null, [], [] ],
 printChar: function(stream, curr) {
  var buffer = SYSCALLS.buffers[stream];
  if (curr === 0 || curr === 10) {
   (stream === 1 ? out : err)(UTF8ArrayToString(buffer, 0));
   buffer.length = 0;
  } else {
   buffer.push(curr);
  }
 },
 varargs: 0,
 get: function(varargs) {
  SYSCALLS.varargs += 4;
  var ret = HEAP32[SYSCALLS.varargs - 4 >> 2];
  return ret;
 },
 getStr: function() {
  var ret = UTF8ToString(SYSCALLS.get());
  return ret;
 },
 get64: function() {
  var low = SYSCALLS.get(), high = SYSCALLS.get();
  return low;
 },
 getZero: function() {
  SYSCALLS.get();
 }
};

function _fd_close(fd) {
 try {
  return 0;
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return e.errno;
 }
}

function ___wasi_fd_close() {
 return _fd_close.apply(null, arguments);
}

function _fd_seek(fd, offset_low, offset_high, whence, newOffset) {
 try {
  return 0;
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return e.errno;
 }
}

function ___wasi_fd_seek() {
 return _fd_seek.apply(null, arguments);
}

function _fd_write(fd, iov, iovcnt, pnum) {
 try {
  var num = 0;
  for (var i = 0; i < iovcnt; i++) {
   var ptr = HEAP32[iov + i * 8 >> 2];
   var len = HEAP32[iov + (i * 8 + 4) >> 2];
   for (var j = 0; j < len; j++) {
    SYSCALLS.printChar(fd, HEAPU8[ptr + j]);
   }
   num += len;
  }
  HEAP32[pnum >> 2] = num;
  return 0;
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return e.errno;
 }
}

function ___wasi_fd_write() {
 return _fd_write.apply(null, arguments);
}

function _abort() {
 abort();
}

function _emscripten_get_heap_size() {
 return HEAP8.length;
}

function abortOnCannotGrowMemory(requestedSize) {
 abort("OOM");
}

function _emscripten_resize_heap(requestedSize) {
 abortOnCannotGrowMemory(requestedSize);
}

function _llvm_stackrestore(p) {
 var self = _llvm_stacksave;
 var ret = self.LLVM_SAVEDSTACKS[p];
 self.LLVM_SAVEDSTACKS.splice(p, 1);
 stackRestore(ret);
}

function _llvm_stacksave() {
 var self = _llvm_stacksave;
 if (!self.LLVM_SAVEDSTACKS) {
  self.LLVM_SAVEDSTACKS = [];
 }
 self.LLVM_SAVEDSTACKS.push(stackSave());
 return self.LLVM_SAVEDSTACKS.length - 1;
}

function _emscripten_memcpy_big(dest, src, num) {
 HEAPU8.set(HEAPU8.subarray(src, src + num), dest);
}

var asmGlobalArg = {};

var asmLibraryArg = {
 "j": ___wasi_fd_close,
 "f": ___wasi_fd_seek,
 "i": ___wasi_fd_write,
 "__memory_base": 1024,
 "__table_base": 0,
 "h": _abort,
 "d": _emscripten_get_heap_size,
 "g": _emscripten_memcpy_big,
 "c": _emscripten_resize_heap,
 "a": _llvm_stackrestore,
 "b": _llvm_stacksave,
 "e": abort,
 "memory": wasmMemory,
 "table": wasmTable
};

var asm = Module["asm"](asmGlobalArg, asmLibraryArg, buffer);

Module["asm"] = asm;

var _free = Module["_free"] = function() {
 return Module["asm"]["k"].apply(null, arguments);
};

var _malloc = Module["_malloc"] = function() {
 return Module["asm"]["l"].apply(null, arguments);
};

var _opus_decode_float = Module["_opus_decode_float"] = function() {
 return Module["asm"]["m"].apply(null, arguments);
};

var _opus_decoder_create = Module["_opus_decoder_create"] = function() {
 return Module["asm"]["n"].apply(null, arguments);
};

var _opus_decoder_destroy = Module["_opus_decoder_destroy"] = function() {
 return Module["asm"]["o"].apply(null, arguments);
};

var _speex_resampler_destroy = Module["_speex_resampler_destroy"] = function() {
 return Module["asm"]["p"].apply(null, arguments);
};

var _speex_resampler_init = Module["_speex_resampler_init"] = function() {
 return Module["asm"]["q"].apply(null, arguments);
};

var _speex_resampler_process_interleaved_float = Module["_speex_resampler_process_interleaved_float"] = function() {
 return Module["asm"]["r"].apply(null, arguments);
};

var stackRestore = Module["stackRestore"] = function() {
 return Module["asm"]["s"].apply(null, arguments);
};

var stackSave = Module["stackSave"] = function() {
 return Module["asm"]["t"].apply(null, arguments);
};

Module["asm"] = asm;

var calledRun;

function ExitStatus(status) {
 this.name = "ExitStatus";
 this.message = "Program terminated with exit(" + status + ")";
 this.status = status;
}

dependenciesFulfilled = function runCaller() {
 if (!calledRun) run();
 if (!calledRun) dependenciesFulfilled = runCaller;
};

function run(args) {
 args = args || arguments_;
 if (runDependencies > 0) {
  return;
 }
 preRun();
 if (runDependencies > 0) return;
 function doRun() {
  if (calledRun) return;
  calledRun = true;
  if (ABORT) return;
  initRuntime();
  preMain();
  if (Module["onRuntimeInitialized"]) Module["onRuntimeInitialized"]();
  postRun();
 }
 if (Module["setStatus"]) {
  Module["setStatus"]("Running...");
  setTimeout(function() {
   setTimeout(function() {
    Module["setStatus"]("");
   }, 1);
   doRun();
  }, 1);
 } else {
  doRun();
 }
}

Module["run"] = run;

if (Module["preInit"]) {
 if (typeof Module["preInit"] == "function") Module["preInit"] = [ Module["preInit"] ];
 while (Module["preInit"].length > 0) {
  Module["preInit"].pop()();
 }
}

noExitRuntime = true;

run();
