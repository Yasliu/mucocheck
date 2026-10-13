import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "";

async function testConnection() {
  console.log("Testing Supabase connectivity to:", supabaseUrl);
  const client = createClient(supabaseUrl, supabaseKey);

  try {
    // Ping auth or public schema
    const { data, error } = await client.auth.getSession();
    console.log("Auth endpoint reachable:", error ? `Error: ${error.message}` : "Connected successfully!");

    // Ping REST / health check
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    });

    console.log("REST gateway HTTP status:", response.status);
    if (response.ok || response.status === 200 || response.status === 404) {
      console.log("Supabase gateway is live and responding!");
    }
  } catch (err: unknown) {
    console.error("Connection failed:", err);
  }
}

testConnection();
