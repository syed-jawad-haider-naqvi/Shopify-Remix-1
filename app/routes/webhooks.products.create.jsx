import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  const { payload, shop, topic, webhookId } = await authenticate.webhook(request);

  console.log(`WEBHOOK_TOPIC: ${topic} webhook received from SHOP: ${shop} with payload:`, JSON.stringify(payload));
  
  // Here you can add your custom logic when an order is created
  // For example: send confirmation emails, update inventory, etc.

  return new Response("OK", { status: 200 });
};