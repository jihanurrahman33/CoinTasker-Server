const Stripe = require("stripe");
const config = require("./index");

module.exports = new Stripe(config.stripeSecretKey);
