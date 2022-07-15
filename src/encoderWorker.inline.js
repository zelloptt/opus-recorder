var Module = typeof Module !== "undefined" ? Module : {};

(function webpackUniversalModuleDefinition(root, factory) {
 if (typeof exports === "object" && typeof module === "object") module.exports = factory(); else if (typeof define === "function" && define.amd) define([], factory); else if (typeof exports === "object") exports["EncoderWorker"] = factory(); else root["EncoderWorker"] = factory();
})(typeof self !== "undefined" ? self : this, () => {
 return (() => {
  "use strict";
  var __webpack_modules__ = {
   "./src/encoderWorker.js": (module, __unused_webpack_exports, __webpack_require__) => {
    eval("\n\nvar encoder;\nvar mainReadyResolve;\nvar mainReady = new Promise(function(resolve){ mainReadyResolve = resolve; });\n\n__webpack_require__.g['onmessage'] = function( e ){\n  mainReady.then(function(){\n    switch( e['data']['command'] ){\n\n      case 'encode':\n        if (encoder){\n          encoder.encode( e['data']['buffers'] );\n        }\n        break;\n\n      case 'getHeaderPages':\n        if (encoder){\n          encoder.generateIdPage();\n          encoder.generateCommentPage();\n        }\n        break;\n\n      case 'done':\n        if (encoder) {\n          encoder.encodeFinalFrame();\n          __webpack_require__.g['postMessage']( {message: 'done'} );\n        }\n        break;\n\n      case 'close':\n        __webpack_require__.g['postMessage']( {message: 'close'} );\n        __webpack_require__.g['close']();\n        break;\n\n      case 'flush':\n        if (encoder) {\n          encoder.flush();\n        }\n        break;\n\n      case 'destroy':\n        if (encoder) {\n          encoder.destroy();\n        }\n        break;\n\n      case 'init':\n        if ( encoder ) {\n          encoder.destroy();\n        }\n        encoder = new OggOpusEncoder( e['data'], Module );\n        __webpack_require__.g['postMessage']( {message: 'ready'} );\n        break;\n\n      default:\n        // Ignore any unknown commands and continue receiving commands\n    }\n  });\n};\n\n\nvar OggOpusEncoder = function( config, Module ){\n\n  if ( !Module ) {\n    throw new Error('Module with exports required to initialize an encoder instance');\n  }\n\n  this.config = Object.assign({\n    bufferLength: 4096, // Define size of incoming buffer\n    encoderApplication: 2049, // 2048 = Voice (Lower fidelity)\n                              // 2049 = Full Band Audio (Highest fidelity)\n                              // 2051 = Restricted Low Delay (Lowest latency)\n    encoderFrameSize: 20, // Specified in ms.\n    encoderSampleRate: 48000, // Desired encoding sample rate. Audio will be resampled\n    maxFramesPerPage: 40, // Tradeoff latency with overhead\n    numberOfChannels: 1,\n    originalSampleRate: 44100,\n    resampleQuality: 3, // Value between 0 and 10 inclusive. 10 being highest quality.\n    serial: Math.floor(Math.random() * 4294967296),\n    streamOpusPackets: true\n  }, config );\n\n  this._opus_encoder_create = Module._opus_encoder_create;\n  this._opus_encoder_destroy = Module._opus_encoder_destroy;\n  this._opus_encoder_ctl = Module._opus_encoder_ctl;\n  this._speex_resampler_process_interleaved_float = Module._speex_resampler_process_interleaved_float;\n  this._speex_resampler_init = Module._speex_resampler_init;\n  this._speex_resampler_destroy = Module._speex_resampler_destroy;\n  this._opus_encode_float = Module._opus_encode_float;\n  this._free = Module._free;\n  this._malloc = Module._malloc;\n  this.HEAPU8 = Module.HEAPU8;\n  this.HEAP32 = Module.HEAP32;\n  this.HEAPF32 = Module.HEAPF32;\n\n  this.pageIndex = 0;\n  this.granulePosition = 0;\n  this.segmentData = new Uint8Array( 65025 ); // Maximum length of oggOpus data\n  this.segmentDataIndex = 0;\n  this.segmentTable = new Uint8Array( 255 ); // Maximum data segments\n  this.segmentTableIndex = 0;\n  this.framesInPage = 0;\n\n  this.initChecksumTable();\n  this.initCodec();\n  this.initResampler();\n\n  if ( this.config.numberOfChannels === 1 ) {\n    this.interleave = function( buffers ) { return buffers[0]; };\n  }\n  else {\n    this.interleavedBuffers = new Float32Array( this.config.bufferLength * this.config.numberOfChannels );\n  }\n\n};\n\nOggOpusEncoder.prototype.encode = function( buffers ) {\n  var samples = this.interleave( buffers );\n  var sampleIndex = 0;\n\n  while ( sampleIndex < samples.length ) {\n\n    var lengthToCopy = Math.min( this.resampleBufferLength - this.resampleBufferIndex, samples.length - sampleIndex );\n    this.resampleBuffer.set( samples.subarray( sampleIndex, sampleIndex+lengthToCopy ), this.resampleBufferIndex );\n    sampleIndex += lengthToCopy;\n    this.resampleBufferIndex += lengthToCopy;\n\n    if ( this.resampleBufferIndex === this.resampleBufferLength ) {\n      this._speex_resampler_process_interleaved_float( this.resampler, this.resampleBufferPointer, this.resampleSamplesPerChannelPointer, this.encoderBufferPointer, this.encoderSamplesPerChannelPointer );\n      var packetLength = this._opus_encode_float( this.encoder, this.encoderBufferPointer, this.encoderSamplesPerChannel, this.encoderOutputPointer, this.encoderOutputMaxLength );\n      this.segmentPacket( packetLength );\n      this.resampleBufferIndex = 0;\n\n      this.framesInPage++;\n      if ( this.framesInPage >= this.config.maxFramesPerPage ) {\n        this.generatePage();\n      }\n    }\n  }\n};\n\nOggOpusEncoder.prototype.destroy = function() {\n  if ( this.encoder ) {\n    this._free(this.encoderSamplesPerChannelPointer);\n    delete this.encoderSamplesPerChannelPointer;\n    this._free(this.encoderBufferPointer);\n    delete this.encoderBufferPointer;\n    this._free(this.encoderOutputPointer);\n    delete this.encoderOutputPointer;\n    this._free(this.resampleSamplesPerChannelPointer);\n    delete this.resampleSamplesPerChannelPointer;\n    this._free(this.resampleBufferPointer);\n    delete this.resampleBufferPointer;\n    this._speex_resampler_destroy(this.resampler);\n    delete this.resampler;\n    this._opus_encoder_destroy(this.encoder);\n    delete this.encoder;\n  }\n};\n\nOggOpusEncoder.prototype.flush = function() {\n  if ( this.framesInPage ) {\n    this.generatePage();\n  }\n  // discard any pending data in resample buffer (only a few ms worth)\n  this.resampleBufferIndex = 0;\n  __webpack_require__.g['postMessage']( {message: 'flushed'} );\n};\n\nOggOpusEncoder.prototype.encodeFinalFrame = function() {\n  if ( this.resampleBufferIndex > 0 ) {\n    var finalFrameBuffers = [];\n    for ( var i = 0; i < this.config.numberOfChannels; ++i ) {\n      finalFrameBuffers.push( new Float32Array( this.config.bufferLength - (this.resampleBufferIndex / this.config.numberOfChannels) ));\n    }\n    this.encode( finalFrameBuffers );\n  }\n  this.headerType += 4;\n  this.generatePage();\n};\n\nOggOpusEncoder.prototype.getChecksum = function( data ){\n  var checksum = 0;\n  for ( var i = 0; i < data.length; i++ ) {\n    checksum = (checksum << 8) ^ this.checksumTable[ ((checksum>>>24) & 0xff) ^ data[i] ];\n  }\n  return checksum >>> 0;\n};\n\nOggOpusEncoder.prototype.generateCommentPage = function(){\n  if ( this.config.streamOpusPackets ) { return; }\n  var segmentDataView = new DataView( this.segmentData.buffer );\n  segmentDataView.setUint32( 0, 1937076303, true ) // Magic Signature 'Opus'\n  segmentDataView.setUint32( 4, 1936154964, true ) // Magic Signature 'Tags'\n  segmentDataView.setUint32( 8, 10, true ); // Vendor Length\n  segmentDataView.setUint32( 12, 1868784978, true ); // Vendor name 'Reco'\n  segmentDataView.setUint32( 16, 1919247474, true ); // Vendor name 'rder'\n  segmentDataView.setUint16( 20, 21322, true ); // Vendor name 'JS'\n  segmentDataView.setUint32( 22, 0, true ); // User Comment List Length\n  this.segmentTableIndex = 1;\n  this.segmentDataIndex = this.segmentTable[0] = 26;\n  this.headerType = 0;\n  this.generatePage();\n};\n\nOggOpusEncoder.prototype.generateIdPage = function(){\n  if ( this.config.streamOpusPackets ) { return; }\n  var segmentDataView = new DataView( this.segmentData.buffer );\n  segmentDataView.setUint32( 0, 1937076303, true ) // Magic Signature 'Opus'\n  segmentDataView.setUint32( 4, 1684104520, true ) // Magic Signature 'Head'\n  segmentDataView.setUint8( 8, 1, true ); // Version\n  segmentDataView.setUint8( 9, this.config.numberOfChannels, true ); // Channel count\n  segmentDataView.setUint16( 10, 3840, true ); // pre-skip (80ms)\n  segmentDataView.setUint32( 12, this.config.originalSampleRateOverride || this.config.originalSampleRate, true ); // original sample rate\n  segmentDataView.setUint16( 16, 0, true ); // output gain\n  segmentDataView.setUint8( 18, 0, true ); // channel map 0 = mono or stereo\n  this.segmentTableIndex = 1;\n  this.segmentDataIndex = this.segmentTable[0] = 19;\n  this.headerType = 2;\n  this.generatePage();\n};\n\nOggOpusEncoder.prototype.generatePage = function(){\n  if ( this.config.streamOpusPackets ) { return; }\n  var granulePosition = ( this.lastPositiveGranulePosition === this.granulePosition) ? -1 : this.granulePosition;\n  var pageBuffer = new ArrayBuffer(  27 + this.segmentTableIndex + this.segmentDataIndex );\n  var pageBufferView = new DataView( pageBuffer );\n  var page = new Uint8Array( pageBuffer );\n\n  pageBufferView.setUint32( 0, 1399285583, true); // Capture Pattern starts all page headers 'OggS'\n  pageBufferView.setUint8( 4, 0, true ); // Version\n  pageBufferView.setUint8( 5, this.headerType, true ); // 1 = continuation, 2 = beginning of stream, 4 = end of stream\n\n  // Number of samples upto and including this page at 48000Hz, into signed 64 bit Little Endian integer\n  // Javascript Number maximum value is 53 bits or 2^53 - 1\n  pageBufferView.setUint32( 6, granulePosition, true );\n  if (granulePosition < 0) {\n    pageBufferView.setInt32( 10, Math.ceil(granulePosition/4294967297) - 1, true );\n  }\n  else {\n    pageBufferView.setInt32( 10, Math.floor(granulePosition/4294967296), true );\n  }\n\n  pageBufferView.setUint32( 14, this.config.serial, true ); // Bitstream serial number\n  pageBufferView.setUint32( 18, this.pageIndex++, true ); // Page sequence number\n  pageBufferView.setUint8( 26, this.segmentTableIndex, true ); // Number of segments in page.\n  page.set( this.segmentTable.subarray(0, this.segmentTableIndex), 27 ); // Segment Table\n  page.set( this.segmentData.subarray(0, this.segmentDataIndex), 27 + this.segmentTableIndex ); // Segment Data\n  pageBufferView.setUint32( 22, this.getChecksum( page ), true ); // Checksum\n\n  __webpack_require__.g['postMessage']( {message: 'page', page: page, samplePosition: this.granulePosition}, [page.buffer] );\n  this.segmentTableIndex = 0;\n  this.segmentDataIndex = 0;\n  this.framesInPage = 0;\n  if ( granulePosition > 0 ) {\n    this.lastPositiveGranulePosition = granulePosition;\n  }\n};\n\nOggOpusEncoder.prototype.initChecksumTable = function(){\n  this.checksumTable = [];\n  for ( var i = 0; i < 256; i++ ) {\n    var r = i << 24;\n    for ( var j = 0; j < 8; j++ ) {\n      r = ((r & 0x80000000) != 0) ? ((r << 1) ^ 0x04c11db7) : (r << 1);\n    }\n    this.checksumTable[i] = (r & 0xffffffff);\n  }\n};\n\nOggOpusEncoder.prototype.setOpusControl = function( control, value ){\n  var location = this._malloc( 4 );\n  this.HEAP32[ location >> 2 ] = value;\n  this._opus_encoder_ctl( this.encoder, control, location );\n  this._free( location );\n};\n\nOggOpusEncoder.prototype.initCodec = function() {\n  var errLocation = this._malloc( 4 );\n  this.encoder = this._opus_encoder_create( this.config.encoderSampleRate, this.config.numberOfChannels, this.config.encoderApplication, errLocation );\n  this._free( errLocation );\n\n  if ( this.config.encoderBitRate ) {\n    this.setOpusControl( 4002, this.config.encoderBitRate );\n  }\n\n  if ( this.config.encoderComplexity ) {\n    this.setOpusControl( 4010, this.config.encoderComplexity );\n  }\n\n  this.encoderSamplesPerChannel = this.config.encoderSampleRate * this.config.encoderFrameSize / 1000;\n  this.encoderSamplesPerChannelPointer = this._malloc( 4 );\n  this.HEAP32[ this.encoderSamplesPerChannelPointer >> 2 ] = this.encoderSamplesPerChannel;\n\n  this.encoderBufferLength = this.encoderSamplesPerChannel * this.config.numberOfChannels;\n  this.encoderBufferPointer = this._malloc( this.encoderBufferLength * 4 ); // 4 bytes per sample\n  this.encoderBuffer = this.HEAPF32.subarray( this.encoderBufferPointer >> 2, (this.encoderBufferPointer >> 2) + this.encoderBufferLength );\n\n  this.encoderOutputMaxLength = 4000;\n  this.encoderOutputPointer = this._malloc( this.encoderOutputMaxLength );\n  this.encoderOutputBuffer = this.HEAPU8.subarray( this.encoderOutputPointer, this.encoderOutputPointer + this.encoderOutputMaxLength );\n};\n\nOggOpusEncoder.prototype.initResampler = function() {\n  var errLocation = this._malloc( 4 );\n  this.resampler = this._speex_resampler_init( this.config.numberOfChannels, this.config.originalSampleRate, this.config.encoderSampleRate, this.config.resampleQuality, errLocation );\n  this._free( errLocation );\n\n  this.resampleBufferIndex = 0;\n  this.resampleSamplesPerChannel = this.config.originalSampleRate * this.config.encoderFrameSize / 1000;\n  this.resampleSamplesPerChannelPointer = this._malloc( 4 );\n  this.HEAP32[ this.resampleSamplesPerChannelPointer >> 2 ] = this.resampleSamplesPerChannel;\n\n  this.resampleBufferLength = this.resampleSamplesPerChannel * this.config.numberOfChannels;\n  this.resampleBufferPointer = this._malloc( this.resampleBufferLength * 4 ); // 4 bytes per sample\n  this.resampleBuffer = this.HEAPF32.subarray( this.resampleBufferPointer >> 2, (this.resampleBufferPointer >> 2) + this.resampleBufferLength );\n};\n\nOggOpusEncoder.prototype.interleave = function( buffers ) {\n  for ( var i = 0; i < this.config.bufferLength; i++ ) {\n    for ( var channel = 0; channel < this.config.numberOfChannels; channel++ ) {\n      this.interleavedBuffers[ i * this.config.numberOfChannels + channel ] = buffers[ channel ][ i ];\n    }\n  }\n\n  return this.interleavedBuffers;\n};\n\nOggOpusEncoder.prototype.segmentPacket = function( packetLength ) {\n  if ( this.config.streamOpusPackets ) {\n    if ( packetLength > 0 ) {\n      var packet = new Uint8Array( HEAPU8.subarray(this.encoderOutputPointer, this.encoderOutputPointer + packetLength) );\n      __webpack_require__.g['postMessage']({ type: 'opus', data: packet });\n    }\n    return;\n  }\n\n  var packetIndex = 0;\n\n  while ( packetLength >= 0 ) {\n\n    if ( this.segmentTableIndex === 255 ) {\n      this.generatePage();\n      this.headerType = 1;\n    }\n\n    var segmentLength = Math.min( packetLength, 255 );\n    this.segmentTable[ this.segmentTableIndex++ ] = segmentLength;\n    var segment = this.encoderOutputBuffer.subarray( packetIndex, packetIndex + segmentLength );\n\n    this.segmentData.set( segment, this.segmentDataIndex );\n    this.segmentDataIndex += segmentLength;\n    packetIndex += segmentLength;\n    packetLength -= 255;\n  }\n\n  this.granulePosition += ( 48 * this.config.encoderFrameSize );\n  if ( this.segmentTableIndex === 255 ) {\n    this.generatePage();\n    this.headerType = 0;\n  }\n};\n\n\nif (!Module) {\n  Module = {};\n}\n\nModule['mainReady'] = mainReady;\nModule['OggOpusEncoder'] = OggOpusEncoder;\nModule['onRuntimeInitialized'] = mainReadyResolve;\n\nmodule.exports = Module;\n\n\n//# sourceURL=webpack://EncoderWorker/./src/encoderWorker.js?");
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
  var __webpack_exports__ = __webpack_require__("./src/encoderWorker.js");
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
 "initial": 16,
 "maximum": 16,
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

var DYNAMIC_BASE = 5289600, DYNAMICTOP_PTR = 46512;

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

var wasmBinaryFile = "encoderWorker.wasm";

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

function _llvm_exp2_f32(x) {
 return Math.pow(2, x);
}

function _llvm_exp2_f64(a0) {
 return _llvm_exp2_f32(a0);
}

function _llvm_log10_f32(x) {
 return Math.log(x) / Math.LN10;
}

function _llvm_log10_f64(a0) {
 return _llvm_log10_f32(a0);
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
 "l": ___wasi_fd_close,
 "h": ___wasi_fd_seek,
 "k": ___wasi_fd_write,
 "__memory_base": 1024,
 "__table_base": 0,
 "j": _abort,
 "d": _emscripten_get_heap_size,
 "i": _emscripten_memcpy_big,
 "c": _emscripten_resize_heap,
 "g": _llvm_exp2_f64,
 "f": _llvm_log10_f64,
 "a": _llvm_stackrestore,
 "b": _llvm_stacksave,
 "e": abort,
 "memory": wasmMemory,
 "table": wasmTable
};

var asm = Module["asm"](asmGlobalArg, asmLibraryArg, buffer);

Module["asm"] = asm;

var _free = Module["_free"] = function() {
 return Module["asm"]["m"].apply(null, arguments);
};

var _malloc = Module["_malloc"] = function() {
 return Module["asm"]["n"].apply(null, arguments);
};

var _opus_encode_float = Module["_opus_encode_float"] = function() {
 return Module["asm"]["o"].apply(null, arguments);
};

var _opus_encoder_create = Module["_opus_encoder_create"] = function() {
 return Module["asm"]["p"].apply(null, arguments);
};

var _opus_encoder_ctl = Module["_opus_encoder_ctl"] = function() {
 return Module["asm"]["q"].apply(null, arguments);
};

var _opus_encoder_destroy = Module["_opus_encoder_destroy"] = function() {
 return Module["asm"]["r"].apply(null, arguments);
};

var _speex_resampler_destroy = Module["_speex_resampler_destroy"] = function() {
 return Module["asm"]["s"].apply(null, arguments);
};

var _speex_resampler_init = Module["_speex_resampler_init"] = function() {
 return Module["asm"]["t"].apply(null, arguments);
};

var _speex_resampler_process_interleaved_float = Module["_speex_resampler_process_interleaved_float"] = function() {
 return Module["asm"]["u"].apply(null, arguments);
};

var stackRestore = Module["stackRestore"] = function() {
 return Module["asm"]["v"].apply(null, arguments);
};

var stackSave = Module["stackSave"] = function() {
 return Module["asm"]["w"].apply(null, arguments);
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
