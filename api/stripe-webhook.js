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

    try {
      // 🔥 HANDLE SUBSCRIPTION PAYMENT CONFIRMATION
      if (event.type === "invoice_payment.paid") {
        const invoicePayment = event.data.object;

        console.log("Invoice payment received:", invoicePayment.id);

        // 1️⃣ Retrieve full invoice
        const invoice = await stripe.invoices.retrieve(
          invoicePayment.invoice
        );

        // 2️⃣ Retrieve subscription to access metadata
        const subscription = await stripe.subscriptions.retrieve(
          invoice.subscription
        );

        const userId = subscription?.metadata?.user_id;

        console.log("Activating premium for user:", userId);

        if (!userId) {
          console.error("No user_id found in subscription metadata");
          return res.status(200).json({ received: true });
        }

        // 3️⃣ Upsert into Supabase
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
    } catch (err) {
      console.error("Webhook processing error:", err);
      res.status(500).json({ error: "Webhook handler failed" });
    }
  });
}
