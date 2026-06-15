const rateLimit = require("express-rate-limit");

// Create a rate limiter with a maximum of 3 requests per 2 seconds
const limiter = rateLimit({
  windowMs: 3000, // 3 seconds
  max: 1, // 1 requests per 3 seconds
  message: {
    status: false,
    message: "Too many requests for this, please try again after few minute.",
    data: null,
  },
});

module.exports = limiter;
