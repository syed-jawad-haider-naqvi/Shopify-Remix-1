import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-remix/server";
import { MongoDBSessionStorage } from "@shopify/shopify-app-session-storage-mongodb";
import { DeliveryMethod, shopifyApp } from "@shopify/shopify-app-remix/server";

console.log("APP_URL: ", process.env.SHOPIFY_APP_URL);

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.January25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new MongoDBSessionStorage(process.env.DATABASE_URL, 'ShopifyScaffoldRemix1', {
    sessionCollectionName: "sessions",
  }),
  distribution: AppDistribution.AppStore,
  webhooks: {
    ORDERS_CREATE: {
      deliveryMethod: DeliveryMethod.Http,
      callbackUrl: "/webhooks/orders/create",
    },
  },
  hooks: {
    afterAuth: async ({ session }) => {
      // Register webhooks for the shop
      // In this example, every shop will have these webhooks
      // You could wrap this in some custom shop specific conditional logic if needed
      shopify.registerWebhooks({ session });
    },
  },
  future: {
    unstable_newEmbeddedAuthStrategy: true,
    removeRest: true,

  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.January25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;



// const shopify = shopifyApp({
//   webhooks: {
//     PRODUCTS_CREATE: {
//       deliveryMethod: DeliveryMethod.Http,
//       callbackUrl: "/webhooks/products/create",
//     },
//   },
//   hooks: {
//     afterAuth: async ({ session }) => {
//       // Register webhooks for the shop
//       // In this example, every shop will have these webhooks
//       // You could wrap this in some custom shop specific conditional logic if needed
//       shopify.registerWebhooks({ session });
//     },
//   },
//   // ...etc
// });