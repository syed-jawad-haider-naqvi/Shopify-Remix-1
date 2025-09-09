import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  TextField,
  Button,
} from "@shopify/polaris";
import { BlockStack as VerticalStack } from '@shopify/polaris';
import { authenticate } from "../shopify.server";
import db from "../mongo.server";
import { useState } from 'react';

// The action function runs on the server when the form is submitted
export async function action({ request }) {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const title = formData.get("title");
  const price = parseFloat(formData.get("price"));

  if (!title || !price) {
    return json({ errors: { title: "Title is required", price: "Price is required" } });
  }

  // Step 1: Create the product with just the title.
  const createProductResponse = await admin.graphql(
    `#graphql
      mutation productCreate($product: ProductCreateInput!) {
        productCreate(product: $product) {
          product {
            id
            title
            variants(first: 1) {
              edges {
                node {
                  id
                }
              }
            }
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
        product: {
          title: title,
        },
      },
    }
  );

  const createProductData = await createProductResponse.json();
  const newProduct = createProductData.data.productCreate.product;
  const userErrors = createProductData.data.productCreate.userErrors;

  if (userErrors && userErrors.length > 0) {
    const errors = userErrors.reduce((acc, error) => {
      acc[error.field[1]] = error.message;
      return acc;
    }, {});
    return json({ errors });
  }

  // Get the ID of the default variant that was just created.
  const defaultVariantId = newProduct.variants.edges[0].node.id;

  // Step 2: Update the default variant's price.
  const updateVariantResponse = await admin.graphql(
    `#graphql
      mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
        productVariantsBulkUpdate(productId: $productId, variants: $variants) {
          productVariants {
            id
            price
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
        productId: newProduct.id,
        variants: [
          {
            id: defaultVariantId,
            price: price,
          },
        ],
      },
    }
  );

  const updateVariantData = await updateVariantResponse.json();
  const updateErrors = updateVariantData.data.productVariantsBulkUpdate.userErrors;

  if (updateErrors && updateErrors.length > 0) {
    const errors = updateErrors.reduce((acc, error) => {
      acc[error.field[1]] = error.message;
      return acc;
    }, {});
    return json({ errors });
  }

  // Save to MongoDB and redirect after both API calls are successful
  await db.collection("products").insertOne({
    shopifyId: newProduct.id,
    title: newProduct.title,
    price: price,
    createdAt: new Date(),
  });
    
  return redirect("/app");
}


// The loader function runs on the server to get data for the page.
// For a creation page, it's often empty or just handles authentication.
export async function loader({ request }) {
  await authenticate.admin(request);
  return null;
}

// The default component is the page's UI
export default function ProductCreatePage() {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const navigation = useNavigation();
  const actionData = useActionData();
  const isSubmitting = navigation.state === "submitting";

  return (
    <Page>
      <Layout>
        <Layout.Section>
          <VerticalStack gap="5">
            <Text as="h1" variant="headingLg">
              Create a New Product
            </Text>
            <Form method="post">
              <VerticalStack gap="5">
                <TextField
                  id="title"
                  name="title"
                  label="Product Title"
                  value={title}
                  onChange={setTitle}
                  helpText="Enter the name of the product"
                  error={actionData?.errors?.title}
                />
                <TextField
                  id="price"
                  name="price"
                  type="number"
                  label="Product Price"
                  value={price}
                  onChange={setPrice}
                  helpText="Enter the price of the product"
                  error={actionData?.errors?.price}
                />
                <Button submit disabled={isSubmitting}>
                  {isSubmitting ? "Creating..." : "Create Product"}
                </Button>
              </VerticalStack>
            </Form>
          </VerticalStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}