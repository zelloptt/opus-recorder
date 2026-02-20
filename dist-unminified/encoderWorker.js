var Module = typeof Module != "undefined" ? Module : {};

(function webpackUniversalModuleDefinition(root, factory) {
 if (typeof exports === "object" && typeof module === "object") module.exports = factory(); else if (typeof define === "function" && define.amd) define([], factory); else if (typeof exports === "object") exports["EncoderWorker"] = factory(); else root["EncoderWorker"] = factory();
})(typeof self !== "undefined" ? self : this, () => {
 return (() => {
  null;
  var __webpack_modules__ = {
   "./src/encoderWorker.js": (module, __unused_webpack_exports, __webpack_require__) => {
    eval("\n\nvar encoder;\nvar mainReadyResolve;\nvar mainReady = new Promise(function(resolve){ mainReadyResolve = resolve; });\n\n__webpack_require__.g['onmessage'] = function( e ){\n  mainReady.then(function(){\n    switch( e['data']['command'] ){\n\n      case 'encode':\n        if (encoder){\n          encoder.encode( e['data']['buffers'] );\n        }\n        break;\n\n      case 'getHeaderPages':\n        if (encoder){\n          encoder.generateIdPage();\n          encoder.generateCommentPage();\n        }\n        break;\n\n      case 'done':\n        if (encoder) {\n          encoder.encodeFinalFrame();\n          __webpack_require__.g['postMessage']( {message: 'done'} );\n        }\n        break;\n\n      case 'close':\n        if (encoder) {\n          encoder.destroy();\n          encoder = null;\n        }\n        __webpack_require__.g['postMessage']( {message: 'close'} );\n        __webpack_require__.g['close']();\n        break;\n\n      case 'flush':\n        if (encoder) {\n          encoder.flush();\n        }\n        break;\n\n      case 'destroy':\n        if (encoder) {\n          encoder.destroy();\n          encoder = null;\n        }\n        break;\n\n      case 'init':\n        if ( encoder ) {\n          encoder.destroy();\n        }\n        encoder = new OggOpusEncoder( e['data'], Module );\n        __webpack_require__.g['postMessage']( {message: 'ready'} );\n        break;\n\n      default:\n        // Ignore any unknown commands and continue receiving commands\n    }\n  });\n};\n\n\nvar OggOpusEncoder = function( config, Module ){\n\n  if ( !Module ) {\n    throw new Error('Module with exports required to initialize an encoder instance');\n  }\n\n  this.config = Object.assign({\n    bufferLength: 4096, // Define size of incoming buffer\n    encoderApplication: 2049, // 2048 = Voice (Lower fidelity)\n                              // 2049 = Full Band Audio (Highest fidelity)\n                              // 2051 = Restricted Low Delay (Lowest latency)\n    encoderFrameSize: 20, // Specified in ms.\n    encoderSampleRate: 48000, // Desired encoding sample rate. Audio will be resampled\n    maxFramesPerPage: 40, // Tradeoff latency with overhead\n    numberOfChannels: 1,\n    originalSampleRate: 44100,\n    resampleQuality: 3, // Value between 0 and 10 inclusive. 10 being highest quality.\n    serial: Math.floor(Math.random() * 4294967296),\n    streamOpusPackets: true\n  }, config );\n\n  this._opus_encoder_create = Module._opus_encoder_create;\n  this._opus_encoder_destroy = Module._opus_encoder_destroy;\n  this._opus_encoder_ctl = Module._opus_encoder_ctl;\n  this._speex_resampler_process_interleaved_float = Module._speex_resampler_process_interleaved_float;\n  this._speex_resampler_init = Module._speex_resampler_init;\n  this._speex_resampler_destroy = Module._speex_resampler_destroy;\n  this._opus_encode_float = Module._opus_encode_float;\n  this._free = Module._free;\n  this._malloc = Module._malloc;\n  this.HEAPU8 = Module.HEAPU8;\n  this.HEAP32 = Module.HEAP32;\n  this.HEAPF32 = Module.HEAPF32;\n\n  this.pageIndex = 0;\n  this.granulePosition = 0;\n  this.segmentData = new Uint8Array( 65025 ); // Maximum length of oggOpus data\n  this.segmentDataIndex = 0;\n  this.segmentTable = new Uint8Array( 255 ); // Maximum data segments\n  this.segmentTableIndex = 0;\n  this.framesInPage = 0;\n\n  this.initChecksumTable();\n  this.initCodec();\n  this.initResampler();\n\n  if ( this.config.numberOfChannels === 1 ) {\n    this.interleave = function( buffers ) { return buffers[0]; };\n  }\n  else {\n    this.interleavedBuffers = new Float32Array( this.config.bufferLength * this.config.numberOfChannels );\n  }\n\n};\n\nOggOpusEncoder.prototype.encode = function( buffers ) {\n  var samples = this.interleave( buffers );\n  var sampleIndex = 0;\n\n  while ( sampleIndex < samples.length ) {\n\n    var lengthToCopy = Math.min( this.resampleBufferLength - this.resampleBufferIndex, samples.length - sampleIndex );\n    this.resampleBuffer.set( samples.subarray( sampleIndex, sampleIndex+lengthToCopy ), this.resampleBufferIndex );\n    sampleIndex += lengthToCopy;\n    this.resampleBufferIndex += lengthToCopy;\n\n    if ( this.resampleBufferIndex === this.resampleBufferLength ) {\n      this._speex_resampler_process_interleaved_float( this.resampler, this.resampleBufferPointer, this.resampleSamplesPerChannelPointer, this.encoderBufferPointer, this.encoderSamplesPerChannelPointer );\n      var packetLength = this._opus_encode_float( this.encoder, this.encoderBufferPointer, this.encoderSamplesPerChannel, this.encoderOutputPointer, this.encoderOutputMaxLength );\n      this.segmentPacket( packetLength );\n      this.resampleBufferIndex = 0;\n\n      this.framesInPage++;\n      if ( this.framesInPage >= this.config.maxFramesPerPage ) {\n        this.generatePage();\n      }\n    }\n  }\n};\n\nOggOpusEncoder.prototype.destroy = function() {\n  if ( this.encoder ) {\n    this._free(this.encoderSamplesPerChannelPointer);\n    delete this.encoderSamplesPerChannelPointer;\n    this._free(this.encoderBufferPointer);\n    delete this.encoderBufferPointer;\n    this._free(this.encoderOutputPointer);\n    delete this.encoderOutputPointer;\n    this._free(this.resampleSamplesPerChannelPointer);\n    delete this.resampleSamplesPerChannelPointer;\n    this._free(this.resampleBufferPointer);\n    delete this.resampleBufferPointer;\n    this._speex_resampler_destroy(this.resampler);\n    delete this.resampler;\n    this._opus_encoder_destroy(this.encoder);\n    delete this.encoder;\n  }\n};\n\nOggOpusEncoder.prototype.flush = function() {\n  if ( this.framesInPage ) {\n    this.generatePage();\n  }\n  // discard any pending data in resample buffer (only a few ms worth)\n  this.resampleBufferIndex = 0;\n  __webpack_require__.g['postMessage']( {message: 'flushed'} );\n};\n\nOggOpusEncoder.prototype.encodeFinalFrame = function() {\n  if ( this.resampleBufferIndex > 0 ) {\n    var finalFrameBuffers = [];\n    for ( var i = 0; i < this.config.numberOfChannels; ++i ) {\n      finalFrameBuffers.push( new Float32Array( this.config.bufferLength - (this.resampleBufferIndex / this.config.numberOfChannels) ));\n    }\n    this.encode( finalFrameBuffers );\n  }\n  this.headerType += 4;\n  this.generatePage();\n};\n\nOggOpusEncoder.prototype.getChecksum = function( data ){\n  var checksum = 0;\n  for ( var i = 0; i < data.length; i++ ) {\n    checksum = (checksum << 8) ^ this.checksumTable[ ((checksum>>>24) & 0xff) ^ data[i] ];\n  }\n  return checksum >>> 0;\n};\n\nOggOpusEncoder.prototype.generateCommentPage = function(){\n  if ( this.config.streamOpusPackets ) { return; }\n  var segmentDataView = new DataView( this.segmentData.buffer );\n  segmentDataView.setUint32( 0, 1937076303, true ) // Magic Signature 'Opus'\n  segmentDataView.setUint32( 4, 1936154964, true ) // Magic Signature 'Tags'\n  segmentDataView.setUint32( 8, 10, true ); // Vendor Length\n  segmentDataView.setUint32( 12, 1868784978, true ); // Vendor name 'Reco'\n  segmentDataView.setUint32( 16, 1919247474, true ); // Vendor name 'rder'\n  segmentDataView.setUint16( 20, 21322, true ); // Vendor name 'JS'\n  segmentDataView.setUint32( 22, 0, true ); // User Comment List Length\n  this.segmentTableIndex = 1;\n  this.segmentDataIndex = this.segmentTable[0] = 26;\n  this.headerType = 0;\n  this.generatePage();\n};\n\nOggOpusEncoder.prototype.generateIdPage = function(){\n  if ( this.config.streamOpusPackets ) { return; }\n  var segmentDataView = new DataView( this.segmentData.buffer );\n  segmentDataView.setUint32( 0, 1937076303, true ) // Magic Signature 'Opus'\n  segmentDataView.setUint32( 4, 1684104520, true ) // Magic Signature 'Head'\n  segmentDataView.setUint8( 8, 1, true ); // Version\n  segmentDataView.setUint8( 9, this.config.numberOfChannels, true ); // Channel count\n  segmentDataView.setUint16( 10, 3840, true ); // pre-skip (80ms)\n  segmentDataView.setUint32( 12, this.config.originalSampleRateOverride || this.config.originalSampleRate, true ); // original sample rate\n  segmentDataView.setUint16( 16, 0, true ); // output gain\n  segmentDataView.setUint8( 18, 0, true ); // channel map 0 = mono or stereo\n  this.segmentTableIndex = 1;\n  this.segmentDataIndex = this.segmentTable[0] = 19;\n  this.headerType = 2;\n  this.generatePage();\n};\n\nOggOpusEncoder.prototype.generatePage = function(){\n  if ( this.config.streamOpusPackets ) { return; }\n  var granulePosition = ( this.lastPositiveGranulePosition === this.granulePosition) ? -1 : this.granulePosition;\n  var pageBuffer = new ArrayBuffer(  27 + this.segmentTableIndex + this.segmentDataIndex );\n  var pageBufferView = new DataView( pageBuffer );\n  var page = new Uint8Array( pageBuffer );\n\n  pageBufferView.setUint32( 0, 1399285583, true); // Capture Pattern starts all page headers 'OggS'\n  pageBufferView.setUint8( 4, 0, true ); // Version\n  pageBufferView.setUint8( 5, this.headerType, true ); // 1 = continuation, 2 = beginning of stream, 4 = end of stream\n\n  // Number of samples upto and including this page at 48000Hz, into signed 64 bit Little Endian integer\n  // Javascript Number maximum value is 53 bits or 2^53 - 1\n  pageBufferView.setUint32( 6, granulePosition, true );\n  if (granulePosition < 0) {\n    pageBufferView.setInt32( 10, Math.ceil(granulePosition/4294967297) - 1, true );\n  }\n  else {\n    pageBufferView.setInt32( 10, Math.floor(granulePosition/4294967296), true );\n  }\n\n  pageBufferView.setUint32( 14, this.config.serial, true ); // Bitstream serial number\n  pageBufferView.setUint32( 18, this.pageIndex++, true ); // Page sequence number\n  pageBufferView.setUint8( 26, this.segmentTableIndex, true ); // Number of segments in page.\n  page.set( this.segmentTable.subarray(0, this.segmentTableIndex), 27 ); // Segment Table\n  page.set( this.segmentData.subarray(0, this.segmentDataIndex), 27 + this.segmentTableIndex ); // Segment Data\n  pageBufferView.setUint32( 22, this.getChecksum( page ), true ); // Checksum\n\n  __webpack_require__.g['postMessage']( {message: 'page', page: page, samplePosition: this.granulePosition}, [page.buffer] );\n  this.segmentTableIndex = 0;\n  this.segmentDataIndex = 0;\n  this.framesInPage = 0;\n  if ( granulePosition > 0 ) {\n    this.lastPositiveGranulePosition = granulePosition;\n  }\n};\n\nOggOpusEncoder.prototype.initChecksumTable = function(){\n  this.checksumTable = [];\n  for ( var i = 0; i < 256; i++ ) {\n    var r = i << 24;\n    for ( var j = 0; j < 8; j++ ) {\n      r = ((r & 0x80000000) != 0) ? ((r << 1) ^ 0x04c11db7) : (r << 1);\n    }\n    this.checksumTable[i] = (r & 0xffffffff);\n  }\n};\n\nOggOpusEncoder.prototype.setOpusControl = function( control, value ){\n  var location = this._malloc( 4 );\n  this.HEAP32[ location >> 2 ] = value;\n  this._opus_encoder_ctl( this.encoder, control, location );\n  this._free( location );\n};\n\nOggOpusEncoder.prototype.initCodec = function() {\n  var errLocation = this._malloc( 4 );\n  this.encoder = this._opus_encoder_create( this.config.encoderSampleRate, this.config.numberOfChannels, this.config.encoderApplication, errLocation );\n  this._free( errLocation );\n\n  if ( this.config.encoderBitRate ) {\n    this.setOpusControl( 4002, this.config.encoderBitRate );\n  }\n\n  if ( this.config.encoderComplexity ) {\n    this.setOpusControl( 4010, this.config.encoderComplexity );\n  }\n\n  this.encoderSamplesPerChannel = this.config.encoderSampleRate * this.config.encoderFrameSize / 1000;\n  this.encoderSamplesPerChannelPointer = this._malloc( 4 );\n  this.HEAP32[ this.encoderSamplesPerChannelPointer >> 2 ] = this.encoderSamplesPerChannel;\n\n  this.encoderBufferLength = this.encoderSamplesPerChannel * this.config.numberOfChannels;\n  this.encoderBufferPointer = this._malloc( this.encoderBufferLength * 4 ); // 4 bytes per sample\n  this.encoderBuffer = this.HEAPF32.subarray( this.encoderBufferPointer >> 2, (this.encoderBufferPointer >> 2) + this.encoderBufferLength );\n\n  this.encoderOutputMaxLength = 4000;\n  this.encoderOutputPointer = this._malloc( this.encoderOutputMaxLength );\n  this.encoderOutputBuffer = this.HEAPU8.subarray( this.encoderOutputPointer, this.encoderOutputPointer + this.encoderOutputMaxLength );\n};\n\nOggOpusEncoder.prototype.initResampler = function() {\n  var errLocation = this._malloc( 4 );\n  this.resampler = this._speex_resampler_init( this.config.numberOfChannels, this.config.originalSampleRate, this.config.encoderSampleRate, this.config.resampleQuality, errLocation );\n  this._free( errLocation );\n\n  this.resampleBufferIndex = 0;\n  this.resampleSamplesPerChannel = this.config.originalSampleRate * this.config.encoderFrameSize / 1000;\n  this.resampleSamplesPerChannelPointer = this._malloc( 4 );\n  this.HEAP32[ this.resampleSamplesPerChannelPointer >> 2 ] = this.resampleSamplesPerChannel;\n\n  this.resampleBufferLength = this.resampleSamplesPerChannel * this.config.numberOfChannels;\n  this.resampleBufferPointer = this._malloc( this.resampleBufferLength * 4 ); // 4 bytes per sample\n  this.resampleBuffer = this.HEAPF32.subarray( this.resampleBufferPointer >> 2, (this.resampleBufferPointer >> 2) + this.resampleBufferLength );\n};\n\nOggOpusEncoder.prototype.interleave = function( buffers ) {\n  for ( var i = 0; i < this.config.bufferLength; i++ ) {\n    for ( var channel = 0; channel < this.config.numberOfChannels; channel++ ) {\n      this.interleavedBuffers[ i * this.config.numberOfChannels + channel ] = buffers[ channel ][ i ];\n    }\n  }\n\n  return this.interleavedBuffers;\n};\n\nOggOpusEncoder.prototype.segmentPacket = function( packetLength ) {\n  if ( this.config.streamOpusPackets ) {\n    if ( packetLength > 0 ) {\n      var packet = new Uint8Array( this.HEAPU8.subarray(this.encoderOutputPointer, this.encoderOutputPointer + packetLength) );\n      __webpack_require__.g['postMessage']({ type: 'opus', data: packet }, [packet.buffer]);\n    }\n    return;\n  }\n\n  var packetIndex = 0;\n\n  while ( packetLength >= 0 ) {\n\n    if ( this.segmentTableIndex === 255 ) {\n      this.generatePage();\n      this.headerType = 1;\n    }\n\n    var segmentLength = Math.min( packetLength, 255 );\n    this.segmentTable[ this.segmentTableIndex++ ] = segmentLength;\n    var segment = this.encoderOutputBuffer.subarray( packetIndex, packetIndex + segmentLength );\n\n    this.segmentData.set( segment, this.segmentDataIndex );\n    this.segmentDataIndex += segmentLength;\n    packetIndex += segmentLength;\n    packetLength -= 255;\n  }\n\n  this.granulePosition += ( 48 * this.config.encoderFrameSize );\n  if ( this.segmentTableIndex === 255 ) {\n    this.generatePage();\n    this.headerType = 0;\n  }\n};\n\n\nif (!Module) {\n  Module = {};\n}\n\nModule['mainReady'] = mainReady;\nModule['OggOpusEncoder'] = OggOpusEncoder;\nModule['onRuntimeInitialized'] = mainReadyResolve;\n\nmodule.exports = Module;\n\n\n//# sourceURL=webpack://EncoderWorker/./src/encoderWorker.js?");
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

var moduleOverrides = Object.assign({}, Module);

var arguments_ = [];

var thisProgram = "./this.program";

var quit_ = (status, toThrow) => {
 throw toThrow;
};

var ENVIRONMENT_IS_WEB = typeof window == "object";

var ENVIRONMENT_IS_WORKER = typeof importScripts == "function";

var ENVIRONMENT_IS_NODE = typeof process == "object" && typeof process.versions == "object" && typeof process.versions.node == "string";

var scriptDirectory = "";

function locateFile(path) {
 if (Module["locateFile"]) {
  return Module["locateFile"](path, scriptDirectory);
 }
 return scriptDirectory + path;
}

var read_, readAsync, readBinary, setWindowTitle;

function logExceptionOnExit(e) {
 if (e instanceof ExitStatus) return;
 let toLog = e;
 err("exiting due to exception: " + toLog);
}

var fs;

var nodePath;

var requireNodeFS;

if (ENVIRONMENT_IS_NODE) {
 if (ENVIRONMENT_IS_WORKER) {
  scriptDirectory = require("path").dirname(scriptDirectory) + "/";
 } else {
  scriptDirectory = __dirname + "/";
 }
 requireNodeFS = () => {
  if (!nodePath) {
   fs = require("fs");
   nodePath = require("path");
  }
 };
 read_ = function shell_read(filename, binary) {
  requireNodeFS();
  filename = nodePath["normalize"](filename);
  return fs.readFileSync(filename, binary ? undefined : "utf8");
 };
 readBinary = filename => {
  var ret = read_(filename, true);
  if (!ret.buffer) {
   ret = new Uint8Array(ret);
  }
  return ret;
 };
 readAsync = (filename, onload, onerror) => {
  requireNodeFS();
  filename = nodePath["normalize"](filename);
  fs.readFile(filename, function(err, data) {
   if (err) onerror(err); else onload(data.buffer);
  });
 };
 if (process["argv"].length > 1) {
  thisProgram = process["argv"][1].replace(/\\/g, "/");
 }
 arguments_ = process["argv"].slice(2);
 if (typeof module != "undefined") {
  module["exports"] = Module;
 }
 process["on"]("uncaughtException", function(ex) {
  if (!(ex instanceof ExitStatus)) {
   throw ex;
  }
 });
 process["on"]("unhandledRejection", function(reason) {
  throw reason;
 });
 quit_ = (status, toThrow) => {
  if (keepRuntimeAlive()) {
   process["exitCode"] = status;
   throw toThrow;
  }
  logExceptionOnExit(toThrow);
  process["exit"](status);
 };
 Module["inspect"] = function() {
  return "[Emscripten Module object]";
 };
} else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
 if (ENVIRONMENT_IS_WORKER) {
  scriptDirectory = self.location.href;
 } else if (typeof document != "undefined" && document.currentScript) {
  scriptDirectory = document.currentScript.src;
 }
 if (scriptDirectory.indexOf("blob:") !== 0) {
  scriptDirectory = scriptDirectory.substr(0, scriptDirectory.replace(/[?#].*/, "").lastIndexOf("/") + 1);
 } else {
  scriptDirectory = "";
 }
 {
  read_ = url => {
   var xhr = new XMLHttpRequest();
   xhr.open("GET", url, false);
   xhr.send(null);
   return xhr.responseText;
  };
  if (ENVIRONMENT_IS_WORKER) {
   readBinary = url => {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, false);
    xhr.responseType = "arraybuffer";
    xhr.send(null);
    return new Uint8Array(xhr.response);
   };
  }
  readAsync = (url, onload, onerror) => {
   var xhr = new XMLHttpRequest();
   xhr.open("GET", url, true);
   xhr.responseType = "arraybuffer";
   xhr.onload = () => {
    if (xhr.status == 200 || xhr.status == 0 && xhr.response) {
     onload(xhr.response);
     return;
    }
    onerror();
   };
   xhr.onerror = onerror;
   xhr.send(null);
  };
 }
 setWindowTitle = title => document.title = title;
} else {}

var out = Module["print"] || console.log.bind(console);

var err = Module["printErr"] || console.warn.bind(console);

Object.assign(Module, moduleOverrides);

moduleOverrides = null;

if (Module["arguments"]) arguments_ = Module["arguments"];

if (Module["thisProgram"]) thisProgram = Module["thisProgram"];

if (Module["quit"]) quit_ = Module["quit"];

var wasmBinary;

if (Module["wasmBinary"]) wasmBinary = Module["wasmBinary"];

var noExitRuntime = Module["noExitRuntime"] || true;

if (typeof WebAssembly != "object") {
 abort("no native wasm support detected");
}

var wasmMemory;

var ABORT = false;

var EXITSTATUS;

var UTF8Decoder = typeof TextDecoder != "undefined" ? new TextDecoder("utf8") : undefined;

function UTF8ArrayToString(heapOrArray, idx, maxBytesToRead) {
 var endIdx = idx + maxBytesToRead;
 var endPtr = idx;
 while (heapOrArray[endPtr] && !(endPtr >= endIdx)) ++endPtr;
 if (endPtr - idx > 16 && heapOrArray.buffer && UTF8Decoder) {
  return UTF8Decoder.decode(heapOrArray.subarray(idx, endPtr));
 }
 var str = "";
 while (idx < endPtr) {
  var u0 = heapOrArray[idx++];
  if (!(u0 & 128)) {
   str += String.fromCharCode(u0);
   continue;
  }
  var u1 = heapOrArray[idx++] & 63;
  if ((u0 & 224) == 192) {
   str += String.fromCharCode((u0 & 31) << 6 | u1);
   continue;
  }
  var u2 = heapOrArray[idx++] & 63;
  if ((u0 & 240) == 224) {
   u0 = (u0 & 15) << 12 | u1 << 6 | u2;
  } else {
   u0 = (u0 & 7) << 18 | u1 << 12 | u2 << 6 | heapOrArray[idx++] & 63;
  }
  if (u0 < 65536) {
   str += String.fromCharCode(u0);
  } else {
   var ch = u0 - 65536;
   str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023);
  }
 }
 return str;
}

function UTF8ToString(ptr, maxBytesToRead) {
 return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : "";
}

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

var INITIAL_MEMORY = Module["INITIAL_MEMORY"] || 16777216;

var wasmTable;

var __ATPRERUN__ = [];

var __ATINIT__ = [];

var __ATPOSTRUN__ = [];

var runtimeInitialized = false;

function keepRuntimeAlive() {
 return noExitRuntime;
}

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

function addOnInit(cb) {
 __ATINIT__.unshift(cb);
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

function abort(what) {
 {
  if (Module["onAbort"]) {
   Module["onAbort"](what);
  }
 }
 what = "Aborted(" + what + ")";
 err(what);
 ABORT = true;
 EXITSTATUS = 1;
 what += ". Build with -sASSERTIONS for more info.";
 var e = new WebAssembly.RuntimeError(what);
 throw e;
}

var dataURIPrefix = "data:application/octet-stream;base64,";

function isDataURI(filename) {
 return filename.startsWith(dataURIPrefix);
}

function isFileURI(filename) {
 return filename.startsWith("file://");
}

var wasmBinaryFile;

wasmBinaryFile = "encoderWorker.wasm";

if (!isDataURI(wasmBinaryFile)) {
 wasmBinaryFile = locateFile(wasmBinaryFile);
}

function getBinary(file) {
 try {
  if (file == wasmBinaryFile && wasmBinary) {
   return new Uint8Array(wasmBinary);
  }
  if (readBinary) {
   return readBinary(file);
  }
  throw "both async and sync fetching of the wasm failed";
 } catch (err) {
  abort(err);
 }
}

function getBinaryPromise() {
 if (!wasmBinary && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER)) {
  if (typeof fetch == "function" && !isFileURI(wasmBinaryFile)) {
   return fetch(wasmBinaryFile, {
    credentials: "same-origin"
   }).then(function(response) {
    if (!response["ok"]) {
     throw "failed to load wasm binary file at '" + wasmBinaryFile + "'";
    }
    return response["arrayBuffer"]();
   }).catch(function() {
    return getBinary(wasmBinaryFile);
   });
  } else {
   if (readAsync) {
    return new Promise(function(resolve, reject) {
     readAsync(wasmBinaryFile, function(response) {
      resolve(new Uint8Array(response));
     }, reject);
    });
   }
  }
 }
 return Promise.resolve().then(function() {
  return getBinary(wasmBinaryFile);
 });
}

function createWasm() {
 var info = {
  "a": asmLibraryArg
 };
 function receiveInstance(instance, module) {
  var exports = instance.exports;
  Module["asm"] = exports;
  wasmMemory = Module["asm"]["g"];
  updateGlobalBufferAndViews(wasmMemory.buffer);
  wasmTable = Module["asm"]["r"];
  addOnInit(Module["asm"]["h"]);
  removeRunDependency("wasm-instantiate");
 }
 addRunDependency("wasm-instantiate");
 function receiveInstantiationResult(result) {
  receiveInstance(result["instance"]);
 }
 function instantiateArrayBuffer(receiver) {
  return getBinaryPromise().then(function(binary) {
   return WebAssembly.instantiate(binary, info);
  }).then(function(instance) {
   return instance;
  }).then(receiver, function(reason) {
   err("failed to asynchronously prepare wasm: " + reason);
   abort(reason);
  });
 }
 function instantiateAsync() {
  if (!wasmBinary && typeof WebAssembly.instantiateStreaming == "function" && !isDataURI(wasmBinaryFile) && !isFileURI(wasmBinaryFile) && !ENVIRONMENT_IS_NODE && typeof fetch == "function") {
   return fetch(wasmBinaryFile, {
    credentials: "same-origin"
   }).then(function(response) {
    var result = WebAssembly.instantiateStreaming(response, info);
    return result.then(receiveInstantiationResult, function(reason) {
     err("wasm streaming compile failed: " + reason);
     err("falling back to ArrayBuffer instantiation");
     return instantiateArrayBuffer(receiveInstantiationResult);
    });
   });
  } else {
   return instantiateArrayBuffer(receiveInstantiationResult);
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

function ExitStatus(status) {
 this.name = "ExitStatus";
 this.message = "Program terminated with exit(" + status + ")";
 this.status = status;
}

function callRuntimeCallbacks(callbacks) {
 while (callbacks.length > 0) {
  callbacks.shift()(Module);
 }
}

function _abort() {
 abort("");
}

function _emscripten_memcpy_big(dest, src, num) {
 HEAPU8.copyWithin(dest, src, src + num);
}

function abortOnCannotGrowMemory(requestedSize) {
 abort("OOM");
}

function _emscripten_resize_heap(requestedSize) {
 var oldSize = HEAPU8.length;
 requestedSize = requestedSize >>> 0;
 abortOnCannotGrowMemory(requestedSize);
}

var SYSCALLS = {
 varargs: undefined,
 get: function() {
  SYSCALLS.varargs += 4;
  var ret = HEAP32[SYSCALLS.varargs - 4 >> 2];
  return ret;
 },
 getStr: function(ptr) {
  var ret = UTF8ToString(ptr);
  return ret;
 }
};

function _fd_close(fd) {
 return 52;
}

function _fd_seek(fd, offset_low, offset_high, whence, newOffset) {
 return 70;
}

var printCharBuffers = [ null, [], [] ];

function printChar(stream, curr) {
 var buffer = printCharBuffers[stream];
 if (curr === 0 || curr === 10) {
  (stream === 1 ? out : err)(UTF8ArrayToString(buffer, 0));
  buffer.length = 0;
 } else {
  buffer.push(curr);
 }
}

function _fd_write(fd, iov, iovcnt, pnum) {
 var num = 0;
 for (var i = 0; i < iovcnt; i++) {
  var ptr = HEAPU32[iov >> 2];
  var len = HEAPU32[iov + 4 >> 2];
  iov += 8;
  for (var j = 0; j < len; j++) {
   printChar(fd, HEAPU8[ptr + j]);
  }
  num += len;
 }
 HEAPU32[pnum >> 2] = num;
 return 0;
}

var asmLibraryArg = {
 "e": _abort,
 "d": _emscripten_memcpy_big,
 "c": _emscripten_resize_heap,
 "f": _fd_close,
 "b": _fd_seek,
 "a": _fd_write
};

var asm = createWasm();

var ___wasm_call_ctors = Module["___wasm_call_ctors"] = function() {
 return (___wasm_call_ctors = Module["___wasm_call_ctors"] = Module["asm"]["h"]).apply(null, arguments);
};

var _opus_encoder_create = Module["_opus_encoder_create"] = function() {
 return (_opus_encoder_create = Module["_opus_encoder_create"] = Module["asm"]["i"]).apply(null, arguments);
};

var _opus_encode_float = Module["_opus_encode_float"] = function() {
 return (_opus_encode_float = Module["_opus_encode_float"] = Module["asm"]["j"]).apply(null, arguments);
};

var _opus_encoder_ctl = Module["_opus_encoder_ctl"] = function() {
 return (_opus_encoder_ctl = Module["_opus_encoder_ctl"] = Module["asm"]["k"]).apply(null, arguments);
};

var _opus_encoder_destroy = Module["_opus_encoder_destroy"] = function() {
 return (_opus_encoder_destroy = Module["_opus_encoder_destroy"] = Module["asm"]["l"]).apply(null, arguments);
};

var _speex_resampler_init = Module["_speex_resampler_init"] = function() {
 return (_speex_resampler_init = Module["_speex_resampler_init"] = Module["asm"]["m"]).apply(null, arguments);
};

var _speex_resampler_destroy = Module["_speex_resampler_destroy"] = function() {
 return (_speex_resampler_destroy = Module["_speex_resampler_destroy"] = Module["asm"]["n"]).apply(null, arguments);
};

var _speex_resampler_process_interleaved_float = Module["_speex_resampler_process_interleaved_float"] = function() {
 return (_speex_resampler_process_interleaved_float = Module["_speex_resampler_process_interleaved_float"] = Module["asm"]["o"]).apply(null, arguments);
};

var _malloc = Module["_malloc"] = function() {
 return (_malloc = Module["_malloc"] = Module["asm"]["p"]).apply(null, arguments);
};

var _free = Module["_free"] = function() {
 return (_free = Module["_free"] = Module["asm"]["q"]).apply(null, arguments);
};

var calledRun;

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
 if (runDependencies > 0) {
  return;
 }
 function doRun() {
  if (calledRun) return;
  calledRun = true;
  Module["calledRun"] = true;
  if (ABORT) return;
  initRuntime();
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

if (Module["preInit"]) {
 if (typeof Module["preInit"] == "function") Module["preInit"] = [ Module["preInit"] ];
 while (Module["preInit"].length > 0) {
  Module["preInit"].pop()();
 }
}

run();
