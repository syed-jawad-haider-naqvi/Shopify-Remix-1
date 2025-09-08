import { json, redirect } from "@remix-run/node";
import { useActionData, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Form,
  TextField,
  Button,
} from "@shopify/polaris";
import { BlockStack as VerticalStack } from '@shopify/polaris';

import { authenticate } from "../shopify.server";
import db from "../mongo.server";

// The action function handles the form submission on the server
export async function action({ request }) {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const orderName = formData.get("orderName");
  const totalPrice = parseFloat(formData.get("totalPrice"));

  if (!orderName || !totalPrice) {
    return json({ errors: { orderName: "Order name is required", totalPrice: "Total price is required" } });
  }

  // Use the admin client to create an order in Shopify via GraphQL
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
          lineItems: [
            {
              title: orderName,
              priceSet: {
                shopMoney: {
                  amount: totalPrice,
                  currencyCode: "USD"
                }
              },
              quantity: 1
            }
          ]
        }
      }
    }
  );

  const orderData = await orderResponse.json();
  const newOrder = orderData.data.orderCreate.order;
  const userErrors = orderData.data.orderCreate.userErrors;

  if (userErrors && userErrors.length > 0) {
    const errors = userErrors.reduce((acc, error) => {
      acc[error.field[1]] = error.message;
      return acc;
    }, {});
    return json({ errors });
  }

  if (newOrder) {
    // Save the new order's details to MongoDB using Prisma
    await db.collection("orders").insertOne({
      shopifyId: newOrder.id,
      name: newOrder.name,
      totalPrice: totalPrice,
      createdAt: new Date(),
    });
    
    // Redirect to the app's homepage after successful creation
    return redirect("/app");
  }

  return json({ errors: { general: "Something went wrong" } });
}

// The loader function handles authentication for the page
export async function loader({ request }) {
  await authenticate.admin(request);
  return null;
}

// The default component is the page's UI
export default function OrderCreatePage() {
  const navigation = useNavigation();
  const actionData = useActionData();
  const isSubmitting = navigation.state === "submitting";

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
                />
                <TextField
                  id="totalPrice"
                  name="totalPrice"
                  type="number"
                  label="Total Price"
                  helpText="Enter the total price of the order"
                  error={actionData?.errors?.totalPrice}
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