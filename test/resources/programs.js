'use strict';

var chai    = require('chai'),
    expect  = chai.expect,
    RO      = require('../../lib/rewardops.js');

describe('RO.programs', function() {
  it('should be an object', function() {
    expect(RO.programs).to.be.an('object');
  });

  describe('getAll()', function() {
    it('should return an array', function(done) {
      RO.programs.getAll(function(error, programList) {
        expect(error).to.equal(null);

        expect(programList).to.be.an('array');

        done();
      });
    });
  });

  describe('get()', function() {
    it('should return an object', function(done) {
      var id = 555;

      RO.programs.get(id, function(error, data) {
        expect(error).to.equal(null);

        expect(data).to.be.an('object');

        done();
      });
    });
  });
});

