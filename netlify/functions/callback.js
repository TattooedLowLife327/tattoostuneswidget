// netlify/functions/callback.js
import axios from "axios"; // We need axios for making HTTP requests

// These values will be loaded from Netlify's environment variables for security.
// They are NOT hardcoded here directly for production.
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

// This REDIRECT_URI must match exactly what you set in Spotify Developer Dashboard!
// It's also stored as an environment variable on Netlify for deployment.
// For local testing (before Netlify variables are set), it falls back to the local address.
const REDIRECT_URI =
  process.env.SPOTIFY_REDIRECT_URI ||
  "http://127.0.0.1:8888/.netlify/functions/callback";

// This is the main function that Netlify will run when it receives a request
exports.handler = async function (event, context) {
  // Ensure this function only responds to GET requests from Spotify's redirect
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405, // Method Not Allowed
      body: "Method Not Allowed",
    };
  }

  // Extract the authorization 'code' and 'state' from Spotify's redirect URL
  const code = event.queryStringParameters.code || null;
  const state = event.queryStringParameters.state || null; // 'state' is for security, good practice to use it but not critical for this basic demo

  // If Spotify didn't give us a code, something went wrong
  if (!code) {
    console.error("Error: Missing authorization code from Spotify redirect.");
    return {
      statusCode: 400, // Bad Request
      // Redirect user back to the main app with an error message
      headers: {
        Location: `https://tattoostuneswidget.netlify.app/#error=missing_code`,
      },
    };
  }

  try {
    // This is the secure server-to-server request to Spotify to exchange the code for tokens.
    const response = await axios.post(
      "https://accounts.spotify.com/api/token", // The actual Spotify Accounts Service URL for token exchange
      new URLSearchParams({
        // Correctly formats the body as x-www-form-urlencoded
        grant_type: "authorization_code",
        code: code,
        redirect_uri: REDIRECT_URI, // Must match what was sent in the initial request and configured in Spotify app
      }).toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          // Your client ID and client secret are sent here, securely from your serverless function
          Authorization: `Basic ${Buffer.from(
            `${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`
          ).toString("base64")}`,
        },
      }
    );

    // Extract the tokens from Spotify's response
    const { access_token, refresh_token, expires_in } = response.data;

    // For this basic example, we're passing the tokens back to the client in the URL fragment.
    // In a production app, you would securely store these tokens (e.g., in a database like Supabase
    // tied to the user's session, or in secure HTTP-only cookies).
    // Passing in URL fragment is good for seeing it work, but less secure for persistent use.

    // Redirect the user's browser back to your main application URL,
    // passing the tokens as URL fragment parameters.
    return {
      statusCode: 302, // HTTP 302 for a temporary redirect
      headers: {
        Location: `https://tattoostuneswidget.netlify.app/#access_token=<span class="math-inline">\{access\_token\}&refresh\_token\=</span>{refresh_token}&expires_in=${expires_in}`,
        // IMPORTANT: If testing locally with `netlify dev`, change the Location header to:
        // 'Location': `http://127.0.0.1:8888/#access_token=<span class="math-inline">\{access\_token\}&refresh\_token\=</span>{refresh_token}&expires_in=${expires_in}`,
      },
    };
  } catch (error) {
    console.error(
      "Error during token exchange:",
      error.response?.data || error.message
    );
    // Log full Spotify error response if available for debugging
    if (axios.isAxiosError(error) && error.response?.data) {
      console.error(
        "Spotify Token Exchange Error Details:",
        error.response.data
      );
    }
    // Redirect back to the main app with an error message in the URL
    return {
      statusCode: 302,
      headers: {
        Location: `https://tattoostuneswidget.netlify.app/#error=token_exchange_failed`,
      },
    };
  }
};
