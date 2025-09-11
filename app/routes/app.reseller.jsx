import { Button, Box, Text, Page, Layout, BlockStack, Form, FormLayout, TextField } from '@shopify/polaris';
import { useFetcher } from "@remix-run/react";
import { useState, useEffect } from 'react';
import axios from 'axios';
import { json } from "@remix-run/node";
import { authenticate } from '../shopify.server';
import { useAppBridge } from '@shopify/app-bridge-react';

/**
 * Server-side action to handle reseller API call.
 * This function will be executed on the server when the form is submitted.
 */
export async function action({ request }) {
    const { session, admin } = await authenticate.admin(request);
    const shop = session.shop;

    try {
        const formData = await request.formData();
        const tokenInput = formData.get("tokenInput");
        
        if (!tokenInput || !tokenInput.includes(':')) {
            throw new Error("Invalid token format. Please use 'authorization_token:connection_token'.");
        }

        const [authToken, connectionToken] = tokenInput.split(':');

        // --- Step 1: Get dynamic data from Shopify GraphQL API ---
        const dataQuery = `#graphql
            query {
                shop {
                    currencyCode
                }
                locations(first: 1) {
                    edges {
                        node {
                            id
                            address {
                                countryCode
                            }
                        }
                    }
                }
                currentAppInstallation {
                    accessScopes {
                        handle
                    }
                }
            }
        `;
        
        const dataResponse = await admin.graphql(dataQuery);
        const data = await dataResponse.json();

        if (!data?.data?.locations?.edges?.length || !data?.data?.currentAppInstallation?.accessScopes) {
            throw new Error("Failed to retrieve essential data from Shopify.");
        }

        const locationNode = data.data.locations.edges[0].node;
        const currencyCode = data.data.shop.currencyCode;
        const scopes = data.data.currentAppInstallation.accessScopes.map(scope => scope.handle);

        // Extract the numerical ID from the Location GID
        const locationId = locationNode.id.split('/').pop();

        // --- Step 2: Prepare the payload for the reseller API call ---
        const resellerPayload = {
            "accessToken": session.accessToken,
            "baseUrl": `https://${shop}`,
            "preFix": "JAW", // Hardcoded prefix
            "currencyCode": currencyCode,
            "locationId": locationId,
            "scope": scopes,
        };

        const config = {
            method: 'post',
            url: `https://api-oe-local-stage.xstak.com/configs/connect-sales-channel?connection_token=${connectionToken}`,
            headers: {
                'content-type': 'application/json',
                'Authorization': authToken,
            },
            data: JSON.stringify(resellerPayload),
        };

        await axios.request(config);

        return json({ success: true, message: "Sales channel connected successfully!" });

    } catch (error) {
        console.error('API chain failed:', error.response?.data || error.message);
        return json({
            success: false,
            message: "Failed to connect sales channel. Please check your token and try again.",
            error: error.response?.data || error.message
        });
    }
}

/**
 * Client-side component for the Reseller page.
 */
export default function ResellerPage() {
    const fetcher = useFetcher();
    const [token, setToken] = useState("");
    const [isProcessCompleted, setIsProcessCompleted] = useState(false);

    // Use App Bridge to show toast messages
    useEffect(() => {
        if (fetcher.data) {
            const app = useAppBridge();
            const { toast } = app;
            
            if (fetcher.data.success) {
                setIsProcessCompleted(true);
                toast.show(fetcher.data.message);
            } else {
                toast.show(fetcher.data.message, { isError: true });
            }
        }
    }, [fetcher.data]);

    const isButtonDisabled = isProcessCompleted || fetcher.state === "submitting" || fetcher.state === "loading";

    return (
        <Page>
            <Layout>
                <Layout.Section>
                    <BlockStack gap="500">
                        <Text as="h1" variant="headingLg">
                            Connect Reseller Channel
                        </Text>
                        <Text as="h3" variant="bodyLg">
                            To connect your reseller channel, enter the provided authorization token below.
                        </Text>
                        <Box>
                            <fetcher.Form method="post">
                                <FormLayout>
                                    <TextField 
                                        id="tokenInput"
                                        label="Token" 
                                        name="tokenInput"
                                        type="text"
                                        value={token}
                                        placeholder="authorization_token:connection_token"
                                        autoComplete="off"
                                        onChange={setToken}
                                    />
                                    <Button
                                        variant="primary"
                                        tone="success"
                                        submit
                                        loading={fetcher.state === "submitting"}
                                        disabled={isButtonDisabled}
                                    >
                                        Connect
                                    </Button>
                                </FormLayout>
                            </fetcher.Form>
                        </Box>
                    </BlockStack>
                </Layout.Section>
            </Layout>
        </Page>
    );
}