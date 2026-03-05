import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {

  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {

    const { email, userId } = req.body;

    console.log("Incoming userId:", userId);

    if (!email || !userId) {
      return res.status(400).json({ error: "Missing email or userId" });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",

      payment_method_types: ["card"],

      customer_email: email,

      // THIS IS THE CRITICAL PART
      metadata: {
        user_id: userId
      },

      subscription_data: {
        metadata: {
          user_id: userId
        }
      },

      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1
        }
      ],

      success_url: `${process.env.APP_URL}/upgrade-success`,
      cancel_url: `${process.env.APP_URL}/profile`
    });

    return res.status(200).json({ url: session.url });

  } catch (error) {
    console.error("Stripe error:", error);
    return res.status(500).json({ error: "Stripe error" });
  }
}
