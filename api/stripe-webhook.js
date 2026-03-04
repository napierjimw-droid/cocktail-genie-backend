if (event.type === "invoice_payment.paid") {
  const invoicePayment = event.data.object;

  // retrieve invoice
  const invoice = await stripe.invoices.retrieve(invoicePayment.invoice);

  // retrieve subscription to access metadata
  const subscription = await stripe.subscriptions.retrieve(invoice.subscription);

  const userId = subscription.metadata?.user_id;

  console.log("Invoice payment received for user:", userId);

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
