/*
 * ATTENTION: The "eval" devtool has been used (maybe by default in mode: "development").
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define([], factory);
	else if(typeof exports === 'object')
		exports["Recorder"] = factory();
	else
		root["Recorder"] = factory();
})(typeof self !== 'undefined' ? self : this, () => {
return /******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/recorder.js":
/*!*************************!*\
  !*** ./src/recorder.js ***!
  \*************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

eval("\n\nvar AudioContext = __webpack_require__.g.AudioContext || __webpack_require__.g.webkitAudioContext;\n\n\n// Constructor\nvar Recorder = function( config ){\n\n  if ( !Recorder.isRecordingSupported() ) {\n    throw new Error(\"Recording is not supported in this browser\");\n  }\n\n  if ( !config ) config = {};\n\n  this.state = \"inactive\";\n  this.config = Object.assign({\n    bufferLength: 4096,\n    encoderApplication: 2049,\n    encoderFrameSize: 20,\n    encoderPath: 'encoderWorker.min.js',\n    encoderSampleRate: 48000,\n    maxFramesPerPage: 40,\n    mediaTrackConstraints: true,\n    monitorGain: 0,\n    numberOfChannels: 1,\n    recordingGain: 1,\n    resampleQuality: 3,\n    streamPages: false,\n    reuseWorker: false,\n    wavBitDepth: 16,\n    streamOpusPackets: true\n  }, config );\n\n  this.encodedSamplePosition = 0;\n};\n\n\n// Static Methods\nRecorder.isRecordingSupported = function(){\n  return AudioContext && __webpack_require__.g.navigator && __webpack_require__.g.navigator.mediaDevices && __webpack_require__.g.navigator.mediaDevices.getUserMedia && __webpack_require__.g.WebAssembly;\n};\n\n\n// Instance Methods\nRecorder.prototype.clearStream = function(){\n  if ( this.stream ){\n\n    if ( this.stream.getTracks ) {\n      this.stream.getTracks().forEach( function( track ){\n        track.stop();\n      });\n    }\n\n    else {\n      this.stream.stop();\n    }\n\n    delete this.stream;\n  }\n\n  if ( this.audioContext && this.closeAudioContext ){\n    this.audioContext.close();\n    delete this.audioContext;\n  }\n};\n\nRecorder.prototype.encodeBuffers = function( inputBuffer ){\n  if ( this.state === \"recording\" ) {\n    var buffers = [];\n    for ( var i = 0; i < inputBuffer.numberOfChannels; i++ ) {\n      buffers[i] = inputBuffer.getChannelData(i);\n    }\n\n    this.encoder.postMessage({\n      command: \"encode\",\n      buffers: buffers\n    });\n  }\n};\n\nRecorder.prototype.initAudioContext = function( sourceNode ){\n  if (sourceNode && sourceNode.context) {\n    this.audioContext = sourceNode.context;\n    this.closeAudioContext = false;\n  }\n\n  else {\n    this.audioContext = new AudioContext();\n    this.closeAudioContext = true;\n  }\n\n  return this.audioContext;\n};\n\nRecorder.prototype.initAudioGraph = function(){\n\n  // First buffer can contain old data. Don't encode it.\n  this.encodeBuffers = function(){\n    delete this.encodeBuffers;\n  };\n\n  this.scriptProcessorNode = this.audioContext.createScriptProcessor( this.config.bufferLength, this.config.numberOfChannels, this.config.numberOfChannels );\n  this.scriptProcessorNode.connect( this.audioContext.destination );\n  this.scriptProcessorNode.onaudioprocess = ( e ) => {\n    this.encodeBuffers( e.inputBuffer );\n  };\n\n  this.monitorGainNode = this.audioContext.createGain();\n  this.setMonitorGain( this.config.monitorGain );\n  this.monitorGainNode.connect( this.audioContext.destination );\n\n  this.recordingGainNode = this.audioContext.createGain();\n  this.setRecordingGain( this.config.recordingGain );\n  this.recordingGainNode.connect( this.scriptProcessorNode );\n};\n\nRecorder.prototype.initSourceNode = function( sourceNode ){\n  if ( sourceNode && sourceNode.context ) {\n    return __webpack_require__.g.Promise.resolve( sourceNode );\n  }\n\n  return __webpack_require__.g.navigator.mediaDevices.getUserMedia({ audio : this.config.mediaTrackConstraints }).then( ( stream ) => {\n    this.stream = stream;\n    return this.audioContext.createMediaStreamSource( stream );\n  });\n};\n\nRecorder.prototype.loadWorker = function() {\n  if ( !this.encoder ) {\n    this.encoder = new __webpack_require__.g.Worker(this.config.encoderPath);\n  }\n};\n\nRecorder.prototype.initWorker = function(){\n  var onPage = (this.config.streamOpusPackets ? this.streamOpusPacket : (this.config.streamPages ? this.streamPage : this.storePage)).bind(this);\n\n  this.recordedPages = [];\n  this.totalLength = 0;\n  this.loadWorker();\n\n  return new Promise((resolve, reject) => {\n    var callback = (e) => {\n      switch( e['data']['message'] ){\n        case 'ready':\n          resolve();\n          break;\n        case 'page':\n          this.encodedSamplePosition = e['data']['samplePosition'];\n          var data = this.config.streamOpusPackets && typeof e['data'] === 'object' && e['data']['type'] === 'opus' ? e['data']['data'] : e['data']['page'];\n          onPage( data );\n          break;\n        case 'done':\n          this.encoder.removeEventListener( \"message\", callback );\n          this.finish();\n          break;\n      }\n    };\n\n    this.encoder.addEventListener( \"message\", callback );\n    this.encoder.postMessage( Object.assign({\n      command: 'init',\n      originalSampleRate: this.audioContext.sampleRate,\n      wavSampleRate: this.audioContext.sampleRate\n    }, this.config));\n  });\n};\n\nRecorder.prototype.pause = function( flush ) {\n  if ( this.state === \"recording\" ) {\n    this.state = \"paused\";\n    if ( flush && this.config.streamPages ) {\n      var encoder = this.encoder;\n      return new Promise((resolve, reject) => {\n        var callback = (e) => {\n          if ( e[\"data\"][\"message\"] === 'flushed' ) {\n            encoder.removeEventListener( \"message\", callback );\n            this.onpause();\n            resolve();\n          }\n        };\n        encoder.addEventListener( \"message\", callback );\n        encoder.postMessage( { command: \"flush\" } );\n      });\n    }\n    this.onpause();\n    return Promise.resolve();\n  }\n};\n\nRecorder.prototype.resume = function() {\n  if ( this.state === \"paused\" ) {\n    this.state = \"recording\";\n    this.onresume();\n  }\n};\n\nRecorder.prototype.setRecordingGain = function( gain ){\n  this.config.recordingGain = gain;\n\n  if ( this.recordingGainNode && this.audioContext ) {\n    this.recordingGainNode.gain.setTargetAtTime(gain, this.audioContext.currentTime, 0.01);\n  }\n};\n\nRecorder.prototype.setMonitorGain = function( gain ){\n  this.config.monitorGain = gain;\n\n  if ( this.monitorGainNode && this.audioContext ) {\n    this.monitorGainNode.gain.setTargetAtTime(gain, this.audioContext.currentTime, 0.01);\n  }\n};\n\nRecorder.prototype.start = function( sourceNode ){\n  if ( this.state === \"inactive\" ) {\n    this.initAudioContext( sourceNode );\n    this.initAudioGraph();\n\n    this.encodedSamplePosition = 0;\n\n    return Promise.all([this.initSourceNode(sourceNode), this.initWorker()]).then((results) => {\n      this.sourceNode = results[0];\n      this.state = \"recording\";\n      this.onstart();\n      this.encoder.postMessage({ command: 'getHeaderPages' });\n      this.sourceNode.connect( this.monitorGainNode );\n      this.sourceNode.connect( this.recordingGainNode );\n    });\n  }\n};\n\nRecorder.prototype.stop = function(){\n  if ( this.state !== \"inactive\" ) {\n    this.state = \"inactive\";\n    this.monitorGainNode.disconnect();\n    this.scriptProcessorNode.disconnect();\n    this.recordingGainNode.disconnect();\n    this.sourceNode.disconnect();\n    this.clearStream();\n\n    var encoder = this.encoder;\n    return new Promise((resolve) => {\n      var callback = (e) => {\n        if ( e[\"data\"][\"message\"] === 'done' ) {\n          encoder.removeEventListener( \"message\", callback );\n          resolve();\n        }\n      };\n      encoder.addEventListener( \"message\", callback );\n      encoder.postMessage({ command: \"done\" });\n      if ( !this.config.reuseWorker ) {\n        encoder.postMessage({ command: \"close\" });\n      }\n    });\n  }\n  return Promise.resolve();\n};\n\nRecorder.prototype.destroyWorker = function(){\n  if ( this.state === \"inactive\" ) {\n    if ( this.encoder ) {\n      this.encoder.postMessage({ command: \"close\" });\n      delete this.encoder;\n    }\n  }\n};\n\nRecorder.prototype.storePage = function( page ) {\n  this.recordedPages.push( page );\n  this.totalLength += page.length;\n};\n\nRecorder.prototype.streamPage = function( page ) {\n  this.ondataavailable( page );\n};\n\nRecorder.prototype.streamOpusPacket = function(packet) {\n  if ( packet === null ){\n    return;\n  }\n  this.onopusdataavailable(packet);\n};\n\nRecorder.prototype.finish = function() {\n  if( !this.config.streamPages ) {\n    var outputData = new Uint8Array( this.totalLength );\n    this.recordedPages.reduce( function( offset, page ){\n      outputData.set( page, offset );\n      return offset + page.length;\n    }, 0);\n\n    this.ondataavailable( outputData );\n  }\n  this.onstop();\n  if ( !this.config.reuseWorker ) {\n    delete this.encoder;\n  }\n};\n\n\n// Callback Handlers\nRecorder.prototype.ondataavailable = function(){};\nRecorder.prototype.onpause = function(){};\nRecorder.prototype.onresume = function(){};\nRecorder.prototype.onstart = function(){};\nRecorder.prototype.onstop = function(){};\nRecorder.prototype.onopusdataavailable = function(){};\n\n\nmodule.exports = Recorder;\n\n\n//# sourceURL=webpack://Recorder/./src/recorder.js?");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/global */
/******/ 	(() => {
/******/ 		__webpack_require__.g = (function() {
/******/ 			if (typeof globalThis === 'object') return globalThis;
/******/ 			try {
/******/ 				return this || new Function('return this')();
/******/ 			} catch (e) {
/******/ 				if (typeof window === 'object') return window;
/******/ 			}
/******/ 		})();
/******/ 	})();
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __webpack_require__("./src/recorder.js");
/******/ 	
/******/ 	return __webpack_exports__;
/******/ })()
;
});