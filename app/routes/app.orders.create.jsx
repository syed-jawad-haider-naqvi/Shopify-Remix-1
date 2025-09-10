import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  TextField,
  Button,
  Select,
} from "@shopify/polaris";
import { BlockStack as VerticalStack } from '@shopify/polaris';
import { useState,useEffect } from 'react';

import { authenticate } from "../shopify.server";
import db from "../mongo.server";

export async function loader({ request }) {
  await authenticate.admin(request);
    // Fetch all products from MongoDB
  const productsCursor = db.collection("products").find({});
  const products = await productsCursor.toArray();

  // Shape the data for the <Select> component:
  // [{ label: "Product A", value: "gid://shopify/Product/12345" }, …]
  const productOptions = products.map((p) => ({
    label:
       (p.title ?? "Untitled product") +
       (p.price ? ` ($${p.price})` : " (no price)"),
     value: p.shopifyId ?? p._id.toString(),
     price: p.price ?? 0, // <-- ★ we expose the price for the UI
   }));

  // Return the options (empty array is fine – UI will handle it)
  return json({ productOptions });
}


// The action function handles the form submission on the server
export async function action({ request }) {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

  const orderName = formData.get("orderName");
  const productId = formData.get("productId"); // <-- new field

  // Basic validation
  if (!orderName || !totalPrice || !productId) {
    return json({
      errors: {
        orderName: !orderName && "Order name is required",
        totalPrice: !totalPrice && "Total price is required",
        productId: !productId && "Select a product",
      },
    });
  }
  const product = await db
    .collection("products")
    .findOne({
      $or: [
        { shopifyId: productId },
        { _id: new (require("mongodb").ObjectId)(productId) },
      ],
    })
    .catch(() => null);

  if (!product) {
    return json({
      errors: { productId: "Selected product could not be found" },
    });
  }

  const totalPrice = product.price ?? 0;

  // Build line item using the selected product
  const lineItem = {
    // Assuming you stored the Shopify product GID in the dropdown value
    // If you stored a custom DB _id, you may need an extra query to fetch the GID
    productId,
    title: orderName, // you could also fetch the real title from DB if desired
    priceSet: {
      shopMoney: {
        amount: totalPrice,
        currencyCode: "USD",
      },
    },
    quantity: 1,
  };

  // GraphQL mutation (same as before, but using the selected product)
  const orderResponse = await admin.graphql(
    `#graphql
      mutation orderCreate($order: OrderCreateOrderInput!) {
        orderCreate(order: $order) {
          order {
            id
            name
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
    {
      variables: {
        order: {
          currency: "USD",
          lineItems: [lineItem],
        },
      },
    }
  );

  const orderData = await orderResponse.json();
  const newOrder = orderData.data.orderCreate.order;
  const userErrors = orderData.data.orderCreate.userErrors;

  if (userErrors && userErrors.length > 0) {
    const errors = userErrors.reduce((acc, err) => {
      // GraphQL returns field as an array, e.g. ["order", "lineItems"]
      const fieldKey = err.field?.[1] ?? "general";
      acc[fieldKey] = err.message;
      return acc;
    }, {});
    return json({ errors });
  }

  if (newOrder) {
    await db.collection("orders").insertOne({
      shopifyId: newOrder.id,
      name: newOrder.name,
      totalPrice,
      productId,
      createdAt: new Date(),
    });
    return redirect("/app");
  }

  return json({ errors: { general: "Something went wrong" } });
}

// The default component is the page's UI
export default function OrderCreatePage() {

  const { productOptions } = useLoaderData(); // <-- new data
  const [orderName, setOrderName] = useState("");
  const [totalPrice, setTotalPrice] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");

  const navigation = useNavigation();
  const actionData = useActionData();
  const isSubmitting = navigation.state === "submitting";

  useEffect(() => {
    if (!selectedProduct) {
      setTotalPrice(""); // nothing selected → clear field
      return;
    }
    const opt = productOptions.find((o) => o.value === selectedProduct);
    if (opt) {
      // Keep it as a string so the TextField stays controlled
      setTotalPrice(String(opt.price));
    }
  }, [selectedProduct, productOptions]);

  return (
    <Page>
      <Layout>
        <Layout.Section>
          <VerticalStack gap="5">
            <Text as="h1" variant="headingLg">
              Create a New Order
            </Text>
            <Form method="post">
              <VerticalStack gap="5">
                <TextField
                  id="orderName"
                  name="orderName"
                  label="Order Name"
                  helpText="Enter a name for the order"
                  error={actionData?.errors?.orderName}
                  value={orderName}
                  onChange={setOrderName}
                />
                 <TextField
                  id="totalPrice"
                  name="totalPrice"
                  type="number"
                  label="Total Price"
                  value={totalPrice}
                  onChange={setTotalPrice}
                  helpText="Price is taken from the selected product"
                  error={actionData?.errors?.totalPrice}
                  disabled // ★ optional – remove if you want merchants to edit
                />
                <Select
                  label="Product"
                  name="productId"
                  placeholder="Select a product"
                  options={productOptions.map((o) => ({
                    label: o.label,
                    value: o.value,
                  }))}
                  value={selectedProduct}
                  onChange={setSelectedProduct}
                  error={actionData?.errors?.productId}
                />


                <Button submit disabled={isSubmitting}>
                  {isSubmitting ? "Creating..." : "Create Order"}
                </Button>
              </VerticalStack>
            </Form>
          </VerticalStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}