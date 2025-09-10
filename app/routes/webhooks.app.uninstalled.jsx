import shopify,{ authenticate } from "../shopify.server";
import db from "../mongo.server";

export const action = async ({ request }) => {
  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Webhook requests can trigger multiple times and after an app has already been uninstalled.
  // If this webhook already ran, the session may have been deleted previously.
  if (session) {
    //! delete sessions from database
      const shopSessions = await shopify.sessionStorage.findSessionsByShop(
        shop
      );
      console.log(shopSessions);
      try {
        await shopify.sessionStorage.deleteSession(shopSessions[0].id);
      } catch (error) {
        console.log(`session not found in DB: ${error}`);
      }
  }

  return new Response();
};
