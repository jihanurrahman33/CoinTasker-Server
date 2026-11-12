const { Router } = require("express");
const config = require("../config");
const stripe = require("../config/stripe");
const { getCollections } = require("../config/db");
const { verifyFirebaseToken } = require("../middleware/auth");

const router = Router();

router.post("/create-checkout-session", async (req, res) => {
  const { cost, packageName, buyerEmail, coinAmount } = req.body;

  if (!cost || !buyerEmail || !coinAmount) {
    return res.status(400).send({ message: "Invalid payment data" });
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    customer_email: buyerEmail,
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: Number(cost) * 100, // cents
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
    return res.status(400).send({ message: "Session ID missing" });
  }

  const session = await stripe.checkout.sessions.retrieve(session_id);
  if (session.payment_status !== "paid") {
    return res.status(400).send({ message: "Payment not completed" });
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

router.get("/payments", verifyFirebaseToken, async (req, res) => {
  const { email } = req.query;
  const query = {};
  if (email) {
    query.buyerEmail = email;
    if (email != req.decoded_email) {
      res.status(403).send({ message: "forbidden access" });
    }
  }
  const result = await getCollections()
    .payments.find(query)
    .sort({ paidAt: -1 })
    .toArray();
  res.send(result);
});

module.exports = router;
