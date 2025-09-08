import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  const { webhook } = await authenticate.webhook(request);

  console.log("Product created webhook received:", {
    id: webhook.payload.id,
    title: webhook.payload.title,
    handle: webhook.payload.handle,
    created_at: webhook.payload.created_at
  });

  // Here you can add your custom logic when a product is created
  // For example: send email notifications, update database, etc.

  return new Response("OK", { status: 200 });
};