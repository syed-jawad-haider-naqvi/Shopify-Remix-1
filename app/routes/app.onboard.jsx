import { Button, Box, Text, Page, Layout, BlockStack } from '@shopify/polaris';
import { useFetcher } from "@remix-run/react";
import { useState, useEffect } from 'react';
import axios from 'axios';
import db from '../mongo.server';
import { json } from "@remix-run/node";
import { authenticate } from '../shopify.server';
import { useAppBridge } from '@shopify/app-bridge-react';

export async function action({ request }) {
    const { session, admin } = await authenticate.admin(request);
    const shop = session.shop;

    try {
        // --- Step 1: Get data from Shopify GraphQL API ---
        const shopQuery = `#graphql
            query {
                shop {
                    email
                    shopOwnerName
                    currencyCode
                }
            }
        `;
        const shopResponse = await admin.graphql(shopQuery);
        const shopData = await shopResponse.json();

        if (!shopData?.data?.shop) {
            throw new Error("Failed to retrieve shop data from Shopify.");
        }

        const { email, shopOwnerName, currencyCode } = shopData.data.shop;

        // Auto-generate a unique realm name based on shop domain
        // This is safe to use as a unique ID and is deterministic
        const realmName = shop.split('.')[0].replace(/-/g, '_');

        // Extract first and last name from shop owner name
        let firstName = '';
        let lastName = '';
        const nameParts = shopOwnerName?.split(/\s+/);
        if (nameParts?.length > 0) {
            firstName = nameParts[0];
            if (nameParts.length > 1) {
                lastName = nameParts[1];
            }
        }
        
        // --- Step 2: Call the first API (Realm Creation) ---
        const createRealmPayload = {
            realm: realmName,
            username: email,
            email: email,
            firstName: firstName,
            lastName: lastName,
            realmRoles: ["oe", "logistics-admin"],
            userRoles: ["oe", "logistics-admin"],
        };

        const realmCreationConfig = {
            method: 'post',
            url: 'https://api-copilot-stage-local.xstak.com/v1/realm/create',
            headers: { 'Content-Type': 'application/json' },
            data: JSON.stringify(createRealmPayload),
        };
        
        try {
            await axios.request(realmCreationConfig);
        } catch (error) {
            // Check for the specific "realm already exists" error
            // The error message is within the HTML response. A better way would be to check a specific error code.
            const errorMessage = error.response?.data?.toString() || '';
            
            if (errorMessage.includes("The realm already exists")) {
                 console.log(`Realm '${realmName}' already exists. Continuing to next step.`);
            } else {
                // If it's a different error, throw it
                throw error;
            }
        }


        // --- Step 3: Call the second API (Get Realm Account ID) ---
        const getAccountIdConfig = {
            method: 'get',
            url: `https://api-copilot-stage-local.xstak.com/v1/realms/${realmName}/account-id`,
            headers: {},
        };
        const accountIdResponse = await axios.request(getAccountIdConfig);
        const accountIdData = accountIdResponse.data;

        if (accountIdData.error || !accountIdData.accountId) {
            throw new Error("Failed to retrieve account ID from realm API.");
        }
        
        const accountId = accountIdData.accountId;

        // --- Step 4: Save the realm to MongoDB ---
        await db.collection("realms").insertOne({
            id: accountId,
            name: realmName,
            email: email,
            shop: shop,
            createdAt: new Date(),
        });

        // --- Step 5: Call the third API (Brand Onboarding) ---
        // You'll need to fetch the shop's access token from the session storage
        // This is the most complex part as it requires calling a custom method
        // in your shopify.server.js to retrieve a session object from the DB
        // by shop domain. Let's assume you have a function to do this.
        // For simplicity, let's use the session.accessToken
        const accessToken = session.accessToken;

        const onboardBrandPayload = {
            "name": `${shop.split('.')[0]} Test Brand`, // Generate a name from shop domain
            "company_code": accountId,
            "email": email,
            "shop_type": "Fabrics",
            "currency": currencyCode,
            "channel_type": "shopify",
            "time_zone": "-05:00",
            // Will need to dynamically fetch locations using the Shopify Admin API
            // For now, using hardcoded data as requested
            "locations": [
                {
                    "name": "Shop location test 21",
                    "address": "Gulberg",
                    "phone": "+923184948635",
                    "city": "Lahore",
                    "country": "PK",
                    "channel_location_id": 72754430000
                }
            ],
            "stores": [
                {
                    "base_url": shop,
                    "access_token": accessToken,
                    "currency": currencyCode
                }
            ]
        };

        const onboardBrandConfig = {
            method: 'post',
            url: 'https://api-oe-local-stage.xstak.com/configs/brands/onboard',
            headers: {
                'token': process.env.OE_ONBOARD_TOKEN,
                'Content-Type': 'application/json',
            },
            data: JSON.stringify(onboardBrandPayload),
        };

        await axios.request(onboardBrandConfig);

        return json({ success: true, message: "Onboarding successful!" });

    } catch (error) {
        console.error('API chain failed:', error.response?.data || error.message);
        return json({
            success: false,
            message: "Onboarding failed. Please try again.",
            error: error.response?.data || error.message
        });
    }
}

// This is the client-side component. It will only render in the browser.
export default function OnboardBrandComponent() {
    const fetcher = useFetcher();
    const [isProcessCompleted, setIsProcessCompleted] = useState(false);
    
    const toggleToastActive = () => setToastActive((active) => !active);
    
    useEffect(() => {
        if (fetcher.data) {
            const app = useAppBridge();
            const { toast } = app;
            if (fetcher.data.success) {
                setIsProcessCompleted(true);
                // Show a success toast using App Bridge API
                toast.show(fetcher.data.message);
            } else {
                // Show an error toast using App Bridge API
                toast.show(fetcher.data.message, { isError: true });
            }
        }
    }, [fetcher.data]);

    const handleOnboardClick = () => {
        fetcher.submit({}, { method: "post" });
    };

    // Determine if the button should be disabled
    const isButtonDisabled = isProcessCompleted || fetcher.state === "submitting" || fetcher.state === "loading";


    return (
        <Page>
            <Layout>
                <Layout.Section>
                    <BlockStack gap="500">
                        <Text as="h1" variant="headingLg">
                            Onboard Your Brand
                        </Text>
                        <Text as="h3" variant="bodyLg">
                            To get started, please click the button below to onboard your brand with us. This will help us tailor the experience to your needs. All your order-related changes will be reflected in our provided OMS.
                        </Text>
                        <Box>
                            <Button
                                variant="primary"
                                tone="success"
                                onClick={handleOnboardClick}
                                loading={fetcher.state === "submitting"}
                                 disabled={isButtonDisabled} // Use the new state variable here
                            >
                                Onboard
                            </Button>
                        </Box>
                    </BlockStack>
                </Layout.Section>
            </Layout>
        </Page>
    );
}
