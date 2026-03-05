// ACTIVATE PREMIUM WHEN CHECKOUT COMPLETES
if (event.type === "checkout.session.completed") {
  const session = event.data.object;

  const userId = session.metadata?.user_id;

  console.log("Checkout completed for user:", userId);

  if (!userId) {
    console.error("No user_id found in metadata");
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
