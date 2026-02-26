import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  // ✅ CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*"); 
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // ✅ Handle preflight requests
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { email } = req.body;

const session = await stripe.checkout.sessions.create({
  mode: "subscription",
  payment_method_types: ["card"],
  customer_email: email,
  line_items: [
    {
      price: process.env.STRIPE_PRICE_ID,
      quantity: 1,
    },
  ],
  success_url: `${process.env.APP_URL}/upgrade-success`,
  cancel_url: `${process.env.APP_URL}/profile`,
});
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      success_url: "https://cocktail-genie-ai-bar.lovable.app/success",
      cancel_url: "https://cocktail-genie-ai-bar.lovable.app/cancel",
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Stripe error" });
  }
}
