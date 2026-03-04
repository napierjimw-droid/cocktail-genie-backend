import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { customerId } = req.body;

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: process.env.APP_URL + "/profile",
    });

    res.status(200).json({ url: session.url });

  } catch (error) {
    console.error("Portal error:", error);
    res.status(500).json({ error: "Portal error" });
  }
}
