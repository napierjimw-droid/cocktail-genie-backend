import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const sig = req.headers["stripe-signature"];

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === "invoice_payment.paid") {
      const invoicePayment = event.data.object;

      const invoice = await stripe.invoices.retrieve(invoicePayment.invoice);
      const subscription = await stripe.subscriptions.retrieve(invoice.subscription);

      const userId = subscription.metadata?.user_id;

      console.log("User ID from Stripe metadata:", userId);

      if (!userId) {
        return res.status(200).json({ received: true });
      }

      const { error } = await supabase
        .from("user_subscriptions")
        .upsert(
          {
            user_id: userId,
            subscription_tier: "premium",
            subscription_status: "active",
            updated_at: new Date(),
          },
          { onConflict: "user_id" }
        );

      if (error) {
        console.error("Supabase update failed:", error);
      } else {
        console.log("User upgraded to premium:", userId);
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("Webhook handler error:", err);
    return res.status(500).json({ error: "Webhook failed" });
  }
}
