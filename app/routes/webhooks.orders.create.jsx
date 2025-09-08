import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  const { payload } = await authenticate.webhook(request);

  console.log("Order created webhook received:", {
    id: payload.id, // Corrected to use `payload.id`
    name: payload.name,
    email: payload.email,
    total_price: payload.total_price,
    created_at: payload.created_at,
  });
  
  // Here you can add your custom logic when an order is created
  // For example: send confirmation emails, update inventory, etc.

  return new Response("OK", { status: 200 });
};