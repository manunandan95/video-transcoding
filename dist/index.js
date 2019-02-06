'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _fs = require('fs');

var _path = require('path');

var _ffmpegLambdaBinary = require('ffmpeg-lambda-binary');

var _ffmpegLambdaBinary2 = _interopRequireDefault(_ffmpegLambdaBinary);

var _fsExtra = require('fs-extra');

var _fsExtra2 = _interopRequireDefault(_fsExtra);

var _lambdaState = require('lambda-state');

var _lambdaState2 = _interopRequireDefault(_lambdaState);

var _awsSdk = require('aws-sdk');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var stackTrace = function stackTrace(e) {
  return (e.stack || '').split('\n').slice(1).map(function (l) {
    return l.trim().replace(/^at /, '');
  });
};

var decodeKey = function decodeKey(key) {
  return decodeURIComponent(key).replace(/\+/g, ' ');
};

var dlPath = function dlPath(key) {
  var parts = key.split('/');
  return (0, _path.join)(_path.sep, 'tmp', parts[parts.length - 1]);
};

var convertObject = function convertObject(object) {
  return (0, _ffmpegLambdaBinary2.default)(['-i', dlPath(object.movKey), '-c', 'libvpx', '-vf', 'scale=1280:720', '-b:v', '5M', '-maxrate', '5M', '-bufsize', '1M', '-auto-alt-ref', '0', '-y', dlPath(object.mp4Key)]).then(function () {
    return object;
  });
};

var S3Object = function () {
  function S3Object(bucket, key) {
    _classCallCheck(this, S3Object);

    this.bucket = bucket;
    this.movKey = decodeKey(key);
    this.mp4Key = this.movKey.replace(/\.mov$/, '.webm');
  }

  _createClass(S3Object, [{
    key: 'deleteFiles',
    value: function deleteFiles() {
      var _this = this;

      return _fsExtra2.default.remove(dlPath(this.movKey)).then(function () {
        return _fsExtra2.default.remove(dlPath(_this.mp4Key));
      });
    }
  }]);

  return S3Object;
}();

var MovToMp4 = function () {
  function MovToMp4(_ref) {
    var records = _ref.Records;

    _classCallCheck(this, MovToMp4);

    this.s3 = new _awsSdk.S3();
    this.records = records;
  }

  _createClass(MovToMp4, [{
    key: 'handle',
    value: function handle(callback) {
      return _lambdaState2.default.init().then(_lambdaState2.default.info('S3 records', this.records)).then(this.getS3Records.bind(this)).then(_lambdaState2.default.info('S3 objects to process')).then(this.processObjects.bind(this)).catch(function (e) {
        return _lambdaState2.default.error(e.name || 'Unknown error', { error: e.toString(), stack: stackTrace(e) })();
      }).then(function () {
        return _lambdaState2.default.finalize(callback);
      });
    }
  }, {
    key: 'getS3Records',
    value: function getS3Records() {
      var _this2 = this;

      return new Promise(function (resolve) {
        resolve(_this2.records.filter(function (rec) {
          return (/\.mov$/.test(decodeKey(rec.s3.object.key))
          );
        }).map(function (rec) {
          return new S3Object(rec.s3.bucket.name, rec.s3.object.key);
        }));
      });
    }
  }, {
    key: 'processObjects',
    value: function processObjects(objects) {
      var _this3 = this;

      return Promise.all(objects.map(function (object) {
        return _lambdaState2.default.info('Starting download', { object: object, path: dlPath(object.movKey) })(object).then(_this3.downloadObject.bind(_this3)).then(_lambdaState2.default.info('Converting object')).then(convertObject).then(_lambdaState2.default.info('Uploading converted object')).then(_this3.uploadConvertedObject.bind(_this3)).then(_lambdaState2.default.info('Removing object files')).then(object.deleteFiles.bind(object)).catch(function (e) {
          return _lambdaState2.default.error(e.name || 'Unknown error', { error: e.toString(), stack: stackTrace(e) })();
        });
      }));
    }
  }, {
    key: 'downloadObject',
    value: function downloadObject(object) {
      var _this4 = this;

      return new Promise(function (resolve, reject) {
        return _this4.s3.getObject({ Bucket: object.bucket, Key: object.movKey }).on('error', reject).createReadStream().on('end', function () {
          return resolve(object);
        }).on('error', reject).pipe((0, _fs.createWriteStream)(dlPath(object.movKey)));
      });
    }
  }, {
    key: 'uploadConvertedObject',
    value: function uploadConvertedObject(object) {
      return this.s3.putObject({
        Bucket: 'output24gbucket',
        Key: 'webm/' + '720/' + object.mp4Key,
        Body: (0, _fs.createReadStream)(dlPath(object.mp4Key)),
        ContentType: 'video/webm'
      }).promise().then(function () {
        return object;
      });
    }
  }]);

  return MovToMp4;
}();

exports.MovToMp4 = MovToMp4;
exports.handler = function (event, context, callback) {
  return new MovToMp4(event).handle(callback);
};