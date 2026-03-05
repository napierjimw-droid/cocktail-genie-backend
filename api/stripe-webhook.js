if (event.type === "checkout.session.completed") {
  const session = event.data.object;

  // retrieve full subscription from Stripe
  const subscription = await stripe.subscriptions.retrieve(session.subscription);

  const userId = subscription.metadata?.user_id;

  console.log("Stripe subscription metadata user:", userId);

  if (!userId) {
    console.error("No user_id in subscription metadata");
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
        updated_at: new Date()
      },
      { onConflict: "user_id" }
    );

  if (error) {
    console.error("Supabase error:", error);
  } else {
    console.log("User upgraded to premium:", userId);
  }
}
