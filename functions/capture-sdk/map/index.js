// capture-sdk/map/index.js
const { dropPin } = require('./dropPin.js');
const { getNearbyPins } = require('./getNearbyPins.js');
const { claimPin } = require('./claimPin.js');

module.exports = {
  dropPin,
  getNearbyPins,
  claimPin
};