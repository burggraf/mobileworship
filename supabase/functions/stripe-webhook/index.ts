import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe";
import { createClient } from "jsr:@supabase/supabase-js";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-04-10",
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req: Request) => {
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return new Response("No signature", { status: 400 });
  }

  try {
    const body = await req.text();
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Map Stripe status to our status
        let status: string;
        switch (subscription.status) {
          case "trialing":
            status = "trialing";
            break;
          case "active":
            status = "active";
            break;
          case "past_due":
            status = "past_due";
            break;
          case "canceled":
          case "unpaid":
            status = "canceled";
            break;
          default:
            status = subscription.status;
        }

        await supabase
          .from("churches")
          .update({ subscription_status: status })
          .eq("stripe_customer_id", customerId);

        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        await supabase
          .from("churches")
          .update({ subscription_status: "canceled" })
          .eq("stripe_customer_id", customerId);

        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        await supabase
          .from("churches")
          .update({ subscription_status: "past_due" })
          .eq("stripe_customer_id", customerId);

        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        // If payment succeeded, ensure status is active
        await supabase
          .from("churches")
          .update({ subscription_status: "active" })
          .eq("stripe_customer_id", customerId);

        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(`Webhook Error: ${err instanceof Error ? err.message : "Unknown"}`, {
      status: 400,
    });
  }
});
