import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// IMPORTANT: Stripe requires raw body
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  const chunks = [];

  req.on("data", (chunk) => {
    chunks.push(chunk);
  });

  req.on("end", async () => {
    const buf = Buffer.concat(chunks);
    const sig = req.headers["stripe-signature"];

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        buf,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {

      // 1️⃣ USER COMPLETES CHECKOUT (start trial / activate premium)
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;

        const userId = session.metadata?.user_id;

        console.log("Checkout completed for user:", userId);

        if (!userId) {
          console.error("Missing user_id metadata");
          return res.status(200).json({ received: true });
        }

        const { error } = await supabase
          .from("user_subscriptions")
          .upsert(
            {
              user_id: userId,
              subscription_tier: "premium",
              subscription_status: "active",
              started_at: new Date(),
              updated_at: new Date(),
            },
            { onConflict: "user_id" }
          );

        if (error) {
          console.error("Supabase update failed:", error);
        } else {
          console.log("Premium activated:", userId);
        }
      }

      // 2️⃣ PAYMENT SUCCEEDED (after trial or renewals)
      if (event.type === "invoice.payment_succeeded") {
        const invoice = event.data.object;

        console.log("Invoice payment succeeded:", invoice.id);
      }

      // 3️⃣ USER CANCELLED SUBSCRIPTION
      if (event.type === "customer.subscription.deleted") {
        const subscription = event.data.object;

        const userId = subscription.metadata?.user_id;

        console.log("Subscription cancelled for user:", userId);

        if (!userId) return;

        const { error } = await supabase
          .from("user_subscriptions")
          .update({
            subscription_tier: "free",
            subscription_status: "cancelled",
            updated_at: new Date(),
          })
          .eq("user_id", userId);

        if (error) {
          console.error("Failed to downgrade user:", error);
        } else {
          console.log("User downgraded to free:", userId);
        }
      }

      res.status(200).json({ received: true });

    } catch (err) {
      console.error("Webhook handler error:", err);
      res.status(500).json({ error: "Webhook handler failed" });
    }
  });
}
