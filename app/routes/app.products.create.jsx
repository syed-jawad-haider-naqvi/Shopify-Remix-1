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

// The action function runs on the server when the form is submitted
export async function action({ request }) {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const title = formData.get("title");
  const price = parseFloat(formData.get("price"));

  if (!title || !price) {
    return json({ errors: { title: "Title is required", price: "Price is required" } });
  }

  // Use the admin client to create a product in Shopify via GraphQL
  const productResponse = await admin.graphql(
    `#graphql
      mutation productCreate($product: ProductCreateInput!) {
        productCreate(product: $product) {
          product {
            id
            title
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
        input: {
          title: title,
          variants: [{ price: price }],
        },
      },
    }
  );

  const productData = await productResponse.json();
  const newProduct = productData.data.productCreate.product;
  const userErrors = productData.data.productCreate.userErrors;

  if (userErrors.length > 0) {
    const errors = userErrors.reduce((acc, error) => {
      acc[error.field[1]] = error.message;
      return acc;
    }, {});
    return json({ errors });
  }

  if (newProduct) {
    // Save the new product's details to MongoDB using Prisma
    await db.collection("products").insertOne({
      shopifyId: newProduct.id,
      title: newProduct.title,
      price: price,
      createdAt: new Date(),
    });
    
    // Redirect to the app's homepage after successful creation
    return redirect("/app");
  }

  return json({ errors: { general: "Something went wrong" } });
}

// The loader function runs on the server to get data for the page.
// For a creation page, it's often empty or just handles authentication.
export async function loader({ request }) {
  await authenticate.admin(request);
  return null;
}

// The default component is the page's UI
export default function ProductCreatePage() {
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
                  helpText="Enter the name of the product"
                  error={actionData?.errors?.title}
                />
                <TextField
                  id="price"
                  name="price"
                  type="number"
                  label="Product Price"
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