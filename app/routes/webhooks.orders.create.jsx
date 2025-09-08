import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  const { webhook } = await authenticate.webhook(request);

  console.log("Order created webhook received:", {
    id: webhook.payload.id,
    name: webhook.payload.name,
    email: webhook.payload.email,
    total_price: webhook.payload.total_price,
    created_at: webhook.payload.created_at
  });

  // Here you can add your custom logic when an order is created
  // For example: send confirmation emails, update inventory, etc.

  return new Response("OK", { status: 200 });
};