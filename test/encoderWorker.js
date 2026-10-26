var chai = require('chai');
var sinon = require('sinon');
var sinonChai = require("sinon-chai");

chai.use(sinonChai);
var expect = chai.expect;


describe('encoderWorker', function() {

  var Module = require('../dist/encoderWorker.min');
  var _opus_encoder_create_spy;
  var _opus_encoder_destroy_spy;
  var _opus_encoder_ctl_spy;
  var _speex_resampler_process_interleaved_float_spy;
  var _speex_resampler_init_spy;
  var _speex_resampler_destroy_spy;
  var _opus_encode_float_spy;
  var _malloc_spy;
  var _free_spy;

  function getEncoder(config){
    return Module.mainReady.then(function(){
      _opus_encoder_create_spy = sinon.spy(Module, '_opus_encoder_create');
      _opus_encoder_destroy_spy = sinon.spy(Module, '_opus_encoder_destroy');
      _opus_encoder_ctl_spy = sinon.spy(Module, '_opus_encoder_ctl');
      _speex_resampler_process_interleaved_float_spy = sinon.spy(Module, '_speex_resampler_process_interleaved_float');
      _speex_resampler_init_spy = sinon.spy(Module, '_speex_resampler_init');
      _speex_resampler_destroy_spy = sinon.spy(Module, '_speex_resampler_destroy');
      _opus_encode_float_spy = sinon.spy(Module, '_opus_encode_float');
      _malloc_spy = sinon.spy(Module, '_malloc');
      _free_spy = sinon.spy(Module, '_free');
      config = Object.assign({streamOpusPackets: false}, config);
      const encoder = new Module.OggOpusEncoder(config, Module);
      encoder.generateIdPage();
      encoder.generateCommentPage();
      return encoder;
    });
  };

  function getPacket(page, packetNumber){
    var dataView = new DataView(page.buffer);
    var packetTableLength = dataView.getUint8( 26, true );
    var packetLength = dataView.getUint8( 27 + packetNumber, true );
    return page.slice(27 + packetTableLength, 27 + packetTableLength + packetLength);
  }

  function getUTF8String(data) {
    return String.fromCharCode.apply(null, data);
  }

  beforeEach(function(){
    global.postMessage = sinon.stub();
    global.close = sinon.stub();
  });

  afterEach(function () {
    sinon.restore();
  });

  it('should initialize config', function () {
    return getEncoder().then(function(encoder){
      expect(encoder.config).to.have.property('numberOfChannels', 1);
      expect(encoder.config).to.have.property('encoderSampleRate', 48000);
      expect(encoder.config).to.have.property('maxFramesPerPage', 40);
      expect(encoder.config).to.have.property('encoderApplication', 2049);
      expect(encoder.config).to.have.property('encoderFrameSize', 20);
      expect(encoder.config).to.have.property('bufferLength', 4096);
      expect(encoder.config).to.have.property('resampleQuality', 3);
      expect(encoder.config).to.have.property('originalSampleRate', 44100);
    });
  });

  it('should initialize encoder', function () {
    return getEncoder().then(function(encoder){
      expect(_opus_encoder_create_spy).to.have.been.calledOnce;
    });
  });

  it('should configure encoderBitRate', function () {
   return getEncoder({
      encoderBitRate: 16000
    }).then(function(encoder){
      expect(_opus_encoder_ctl_spy).to.have.been.calledWith(encoder.encoder, 4002, sinon.match.any);
    });
  });

  it('should configure complexity', function () {
    return getEncoder({
      encoderComplexity: 10
    }).then(function(encoder){
      expect(_opus_encoder_ctl_spy).to.have.been.calledWith(encoder.encoder, 4010, sinon.match.any)
    });
  });

  it('should default input sample rate field to originalSampleRate', function (done) {
    var pageBufferCount = 0;
    global.postMessage = function(message){
      pageBufferCount++;

      // First Page
      if (pageBufferCount == 1) {
        var pageData = getPacket(message.page);
        var dataView = new DataView(pageData.buffer);
        expect(dataView.getUint32(12, true)).to.equal(44100);
        done();
      }
    }

    getEncoder();
  });

  it('should override input sample rate field', function (done) {
    var pageBufferCount = 0;
    global.postMessage = function(message){
      pageBufferCount++;

      // First Page
      if (pageBufferCount == 1) {
        var pageData = getPacket(message.page, 1);
        var dataView = new DataView(pageData.buffer);
        expect(dataView.getUint32(12, true)).to.equal(16000);
        done();
      }
    }

    getEncoder({
      originalSampleRateOverride: 16000
    });

  });

  it('should have vendor \'RecorderJS\' in the second page', function (done) {
    var pageBufferCount = 0;
    global.postMessage = function(message){
      pageBufferCount++;

      // Second Page
      if (pageBufferCount == 2) {
        var pageData = getPacket(message.page, 1);
        var dataView = new DataView(pageData.buffer);
        var vendorLength = dataView.getUint8(8, true);
        var vendorData = pageData.subarray(12, 12 + vendorLength);
        expect(getUTF8String(vendorData)).to.equal('RecorderJS');
        done();
      }
    }

    getEncoder();
  });

  it('should set granule position to 0', function (done) {
    var pageBufferCount = 0;

    global.postMessage = function(message) {
      pageBufferCount++;

      if (pageBufferCount == 3) {
        var dataView = new DataView(message.page.buffer);
        expect(dataView.getUint32(6, true)).to.equal(0);
        expect(dataView.getInt32(10, true)).to.equal(0);
        done();
      }
    };

    getEncoder().then(function(encoder) {
      encoder.lastPositiveGranulePosition = 1;
      encoder.granulePosition = 0;
      encoder.generatePage();
    });
  });

  it('should set granule position to -1', function (done) {
    var pageBufferCount = 0;

    global.postMessage = function(message) {
      pageBufferCount++;

      if (pageBufferCount == 3) {
        var dataView = new DataView(message.page.buffer);
        expect(dataView.getUint32(6, true)).to.equal(4294967295);
        expect(dataView.getInt32(10, true)).to.equal(-1);
        done();
      }
    };

    getEncoder().then(function(encoder) {
      encoder.lastPositiveGranulePosition = 1;
      encoder.granulePosition = -1;
      encoder.generatePage();
    });
  });

  it('should set granule position to -2^32', function (done) {
    var pageBufferCount = 0;

    global.postMessage = function(message) {
      pageBufferCount++;

      if (pageBufferCount == 3) {
        var dataView = new DataView(message.page.buffer);
        expect(dataView.getUint32(6, true)).to.equal(0);
        expect(dataView.getInt32(10, true)).to.equal(-1);
        done();
      }
    };

    getEncoder().then(function(encoder) {
      encoder.lastPositiveGranulePosition = 1;
      encoder.granulePosition = -4294967296;
      encoder.generatePage();
    });
  });

  it('should set granule position to -2^32 - 1', function (done) {
    var pageBufferCount = 0;

    global.postMessage = function(message) {
      pageBufferCount++;

      if (pageBufferCount == 3) {
        var dataView = new DataView(message.page.buffer);
        expect(dataView.getUint32(6, true)).to.equal(4294967295);
        expect(dataView.getInt32(10, true)).to.equal(-2);
        done();
      }
    };

    getEncoder().then(function(encoder) {
      encoder.lastPositiveGranulePosition = 1;
      encoder.granulePosition = -4294967297;
      encoder.generatePage();
    });
  });

  it('should set granule position to 2^32 - 1', function (done) {
    var pageBufferCount = 0;

    global.postMessage = function(message) {
      pageBufferCount++;

      if (pageBufferCount == 3) {
        var dataView = new DataView(message.page.buffer);
        expect(dataView.getUint32(6, true)).to.equal(4294967295);
        expect(dataView.getInt32(10, true)).to.equal(0);
        done();
      }
    };

    getEncoder().then(function(encoder) {
      encoder.lastPositiveGranulePosition = 1;
      encoder.granulePosition = 4294967295;
      encoder.generatePage();
    });
  });

  it('should set granule position to 2^32', function (done) {
    var pageBufferCount = 0;

    global.postMessage = function(message) {
      pageBufferCount++;

      if (pageBufferCount == 3) {
        var dataView = new DataView(message.page.buffer);
        expect(dataView.getUint32(6, true)).to.equal(0);
        expect(dataView.getInt32(10, true)).to.equal(1);
        done();
      }
    };

    getEncoder().then(function(encoder) {
      encoder.lastPositiveGranulePosition = 1;
      encoder.granulePosition = 4294967296;
      encoder.generatePage();
    });
  });

  it('should set serial minimum value as 0', function (done) {
    sinon.stub(Math, 'random').returns(0);
    var messageRecieved = false;

    global.postMessage = function(message){
      if (!messageRecieved) {
        messageRecieved = true;
        var dataView = new DataView(message.page.buffer);
        expect(dataView.getUint32(14, true)).to.equal(0);
        done();
      }
    }

    getEncoder();
  });

  it('should set serial maximum value as 2^32 - 1', function (done) {
    sinon.stub(Math, 'random').returns(0.9999999999999);
    var messageRecieved = false;

    global.postMessage = function(message){
      if (!messageRecieved) {
        messageRecieved = true;
        var dataView = new DataView(message.page.buffer);
        expect(dataView.getUint32(14, true)).to.equal(4294967295);
        done();
      }
    }

    getEncoder();
  });

  const testingFrameSize = 50;

  function bufferForFrames(amount) {
    return [new Float32Array(Math.ceil(amount * testingFrameSize * 44.1))];
  }

  function getEncoderWithMaxFramesPerPage(value) {
    const options = {
      maxFramesPerPage: value,
      encoderFrameSize: testingFrameSize,
      encoderSampleRate: 48000,
      originalSampleRate: 44100
    };
    return getEncoder(options);
  }

  it('should emit page when enough buffers are collected for a frame', function (done) {
    getEncoderWithMaxFramesPerPage(1).then((encoder) => {
      let pages = 0;
      global.postMessage = function(message){
        if ( message.message === 'page' ) pages++;
      };

      expect(pages).to.equal(0);
      encoder.encode(bufferForFrames(0.5));
      expect(pages).to.equal(0);
      encoder.encode(bufferForFrames(0.5));
      expect(pages).to.equal(1);
      done();
    });
  });

  it('should break pages when buffer is too long', function (done) {
    getEncoderWithMaxFramesPerPage(1).then((encoder) => {
      let pages = 0;
      global.postMessage = function(message){
        if ( message.message === 'page' ) pages++;
      };

      expect(pages).to.equal(0);
      encoder.encode(bufferForFrames(2));
      expect(pages).to.equal(2);
      done();
    });
  });

  it('should combines multiple frames per page', function (done) {
    getEncoderWithMaxFramesPerPage(2).then((encoder) => {
      let pages = 0;
      global.postMessage = function(message){
        if ( message.message === 'page' ) pages++;
      };

      expect(pages).to.equal(0);
      encoder.encode(bufferForFrames(2));
      expect(pages).to.equal(1);
      encoder.encode(bufferForFrames(4));
      expect(pages).to.equal(3);
      done();
    });
  });

  it('should cleanup when destroyed', function (done) {
    getEncoder().then((encoder) => {
      var enc = encoder.encoder;
      var resampler = encoder.resampler;
      encoder.destroy();
      expect(_opus_encoder_destroy_spy).to.have.been.calledWith(enc);
      expect(_speex_resampler_destroy_spy).to.have.been.calledWith(resampler);

      expect(encoder).not.to.have.key('encoder');
      expect(encoder).not.to.have.key('resampler');

      expect(_free_spy).to.have.been.called;
      expect(_free_spy.callCount).to.equal(_malloc_spy.callCount);
      var freedPointers = _free_spy.args.map(( args ) => args[0] );
      expect(_malloc_spy.returnValues).to.have.members(freedPointers);
      done();
    });
  });
});

// The unminified build carries the current worker source; dist/encoderWorker.min.js
// needs an emscripten rebuild (`make`) to pick these changes up.
describe('encoderWorker final frame and input buffers', function() {

  var Module = require('../dist-unminified/encoderWorker');

  function streamingEncoder(config) {
    return Module.mainReady.then(function() {
      return new Module.OggOpusEncoder(Object.assign({
        streamOpusPackets: true,
        encoderFrameSize: 20,
        encoderSampleRate: 16000,
        originalSampleRate: 16000,
        bufferLength: 128
      }, config), Module);
    });
  }

  var packets;

  beforeEach(function() {
    packets = 0;
    global.postMessage = function(message) {
      if (message && message.type === 'opus') packets++;
    };
    global.close = sinon.stub();
  });

  afterEach(function() {
    sinon.restore();
  });

  it('accepts buffers shorter than bufferLength and completes the pending frame on done', function() {
    return streamingEncoder().then(function(encoder) {
      var encode = sinon.spy(encoder, 'encode');
      // 3 x 128 = 384 samples: one 320-sample frame, 64 pending
      for (var i = 0; i < 3; i++) encoder.encode([new Float32Array(128)]);
      expect(packets).to.equal(1);
      encoder.encodeFinalFrame();
      expect(packets).to.equal(2);
      // padded with exactly the 256 samples the frame was missing
      var padding = encode.lastCall.args[0][0];
      expect(padding.length).to.equal(256);
      encoder.destroy();
    });
  });

  it('adds no silent frame when the input ended on a frame boundary', function() {
    return streamingEncoder().then(function(encoder) {
      encoder.encode([new Float32Array(320)]);
      expect(packets).to.equal(1);
      encoder.encodeFinalFrame();
      expect(packets).to.equal(1);
      encoder.destroy();
    });
  });

  it('pads to the frame, not to bufferLength, with the default buffer size', function() {
    return streamingEncoder({ bufferLength: 4096 }).then(function(encoder) {
      encoder.encode([new Float32Array(100)]);
      encoder.encodeFinalFrame();
      // one completed frame, not several frames of silence
      expect(packets).to.equal(1);
      encoder.destroy();
    });
  });

  it('interleaves stereo buffers of any length', function() {
    return streamingEncoder({ numberOfChannels: 2 }).then(function(encoder) {
      // 128-sample render quanta: 3 of them make 384 samples per channel, one 320-sample frame
      for (var i = 0; i < 3; i++) encoder.encode([new Float32Array(128), new Float32Array(128)]);
      expect(packets).to.equal(1);
      // a buffer longer than bufferLength grows the scratch space instead of truncating
      encoder.encode([new Float32Array(1024).fill(0.5), new Float32Array(1024).fill(-0.5)]);
      expect(encoder.interleavedBuffers.length).to.be.at.least(2048);
      expect(packets).to.equal(4);
      encoder.encodeFinalFrame();
      expect(packets).to.equal(5);
      encoder.destroy();
    });
  });

  it('returns the scratch buffer itself once same-size stereo buffers fit it exactly', function() {
    return streamingEncoder({ numberOfChannels: 2, bufferLength: 128 }).then(function(encoder) {
      var left = new Float32Array(128), right = new Float32Array(128);
      // exact fit: no view allocated, the scratch buffer comes back as-is
      expect(encoder.interleave([left, right])).to.equal(encoder.interleavedBuffers);
      // smaller input: a view over the prefix, not the whole buffer
      var view = encoder.interleave([new Float32Array(32), new Float32Array(32)]);
      expect(view).to.not.equal(encoder.interleavedBuffers);
      expect(view.length).to.equal(64);
      expect(view.buffer).to.equal(encoder.interleavedBuffers.buffer);
      encoder.destroy();
    });
  });
});
