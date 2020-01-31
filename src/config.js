const path = require('path');

module.exports = { path: { public: path.join(__dirname, '/../public') }, port: process.env.PORT || 3000 };
