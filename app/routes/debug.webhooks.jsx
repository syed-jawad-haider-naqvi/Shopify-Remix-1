// Create a new route to check your registered webhooks
// app/routes/debug.webhooks.jsx

import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  
  try {
    const response = await admin.rest.resources.Webhook.all({
      session: admin.session,
    });
    
    return json({
      webhooks: response.data,
      success: true
    });
  } catch (error) {
    return json({
      error: error.message,
      success: false
    });
  }
};

export default function DebugWebhooks() {
  const data = useLoaderData();
  
  if (!data.success) {
    return (
      <div>
        <h1>Error loading webhooks</h1>
        <p>{data.error}</p>
      </div>
    );
  }
  
  return (
    <div style={{ padding: "20px" }}>
      <h1>Registered Webhooks</h1>
      {data.webhooks.length === 0 ? (
        <p>❌ No webhooks registered</p>
      ) : (
        <div>
          <p>✅ Found {data.webhooks.length} webhook(s):</p>
          {data.webhooks.map((webhook, index) => (
            <div key={index} style={{ 
              border: "1px solid #ccc", 
              padding: "15px", 
              margin: "10px 0",
              borderRadius: "5px",
              backgroundColor: webhook.topic === "orders/create" ? "#e8f5e8" : "#f9f9f9"
            }}>
              <h3>🎯 Topic: {webhook.topic} {webhook.topic === "orders/create" ? "✅" : ""}</h3>
              <p><strong>🌐 URL:</strong> <code>{webhook.address}</code></p>
              <p><strong>📝 Format:</strong> {webhook.format}</p>
              <p><strong>🆔 ID:</strong> {webhook.id}</p>
              <p><strong>📅 Created:</strong> {webhook.created_at}</p>
              <p><strong>🔄 Updated:</strong> {webhook.updated_at}</p>
              {webhook.api_version && <p><strong>🔢 API Version:</strong> {webhook.api_version}</p>}
            </div>
          ))}
        </div>
      )}
      <hr />
      <h2>Raw Response:</h2>
      <pre style={{ 
        background: "#f5f5f5", 
        padding: "10px", 
        borderRadius: "5px",
        overflow: "auto",
        maxHeight: "400px"
      }}>
        {JSON.stringify(data.webhooks, null, 2)}
      </pre>
    </div>
  );
}