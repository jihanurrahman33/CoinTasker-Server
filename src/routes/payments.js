const { Router } = require("express");
const config = require("../config");
const stripe = require("../config/stripe");
const { getCollections } = require("../config/db");
const { verifyFirebaseToken } = require("../middleware/auth");
const { ROLES } = require("../constants");
const { HttpError } = require("../utils/httpError");
const { isPositiveNumber } = require("../utils/validate");

const router = Router();

router.post("/create-checkout-session", verifyFirebaseToken, async (req, res) => {
  const { packageName } = req.body;
  const cost = Number(req.body.cost);
  const coinAmount = Number(req.body.coinAmount);

  if (!isPositiveNumber(cost) || !isPositiveNumber(coinAmount) || !packageName) {
    throw new HttpError(400, "Invalid payment data");
  }

  // The paying account is always the authenticated one.
  const buyerEmail = req.decoded_email;

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    customer_email: buyerEmail,
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: Math.round(cost * 100), // cents
          product_data: { name: packageName },
        },
        quantity: 1,
      },
    ],
    metadata: { buyerEmail, packageName, coinAmount },
    success_url: `${config.siteDomain}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.siteDomain}/dashboard/payment-cancelled`,
  });

  res.send({ url: session.url });
});

// Called by the frontend after Stripe redirects back; idempotent per payment.
router.patch("/payment-success", async (req, res) => {
  const { session_id } = req.query;
  if (!session_id) {
    throw new HttpError(400, "Session ID missing");
  }

  const session = await stripe.checkout.sessions.retrieve(session_id);
  if (session.payment_status !== "paid") {
    throw new HttpError(400, "Payment not completed");
  }

  const { payments, users } = getCollections();
  const transactionId = session.payment_intent;
  const buyerEmail = session.metadata.buyerEmail;
  const coinAmount = Number(session.metadata.coinAmount);

  try {
    const result = await payments.updateOne(
      { transactionId },
      {
        $setOnInsert: {
          buyerEmail,
          packageName: session.metadata.packageName,
          coinAmount,
          amount: session.amount_total / 100,
          currency: session.currency,
          transactionId,
          paymentStatus: session.payment_status,
          paidAt: new Date(),
        },
      },
      { upsert: true }
    );

    if (result.upsertedCount === 1) {
      await users.updateOne({ email: buyerEmail }, { $inc: { coin: coinAmount } });
    }
    res.send({ success: true, transactionId });
  } catch (err) {
    if (err.code === 11000) {
      return res.send({
        success: true,
        message: "Payment already processed",
        transactionId,
      });
    }
    throw err;
  }
});

// Admins see all payments; everyone else only their own.
router.get("/payments", verifyFirebaseToken, async (req, res) => {
  const { users, payments } = getCollections();
  const { email } = req.query;

  const requester = await users.findOne({ email: req.decoded_email });
  const isAdmin = requester?.role === ROLES.ADMIN;

  const query = {};
  if (!isAdmin) {
    if (email && email !== req.decoded_email) {
      throw new HttpError(403, "forbidden access");
    }
    query.buyerEmail = req.decoded_email;
  } else if (email) {
    query.buyerEmail = email;
  }

  res.send(await payments.find(query).sort({ paidAt: -1 }).toArray());
});

module.exports = router;
