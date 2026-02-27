import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

    // 🔥 ACTIVATE PREMIUM WHEN PAYMENT IS CONFIRMED
    if (event.type === "invoice.paid") {
      const invoice = event.data.object;

      // Get user_id from Stripe metadata
      const userId =
        invoice.lines.data[0]?.metadata?.user_id ||
        invoice.metadata?.user_id;

      console.log("Activating premium for user:", userId);

      if (!userId) {
        console.error("No user_id found in Stripe metadata");
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
        console.log("User upgraded successfully:", userId);
      }
    }

    res.status(200).json({ received: true });
  });
}
