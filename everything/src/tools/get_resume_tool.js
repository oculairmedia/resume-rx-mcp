import axios from 'axios';
import { wrapper as axiosCookiejarSupport } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env file in the root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') }); // Go up three levels

// --- Configuration ---
const DEFAULT_RX_EMAIL = process.env.RX_RESUME_EMAIL || "emanuvaderland@gmail.com";
const DEFAULT_RX_PASSWORD = process.env.RX_RESUME_PASSWORD || "E4YSj9UiVuSB3uJ";
const DEFAULT_RX_BASE_URL = process.env.RX_RESUME_BASE_URL || "http://192.168.50.90:3050/api";

/**
 * Gets details of a specific resume by ID from Reactive Resume.
 *
 * @param {object} params - Parameters object.
 * @param {string} params.resume_id - Required. The UUID of the resume.
 * @param {string} [params.email] - Optional. Reactive Resume email (overrides env).
 * @param {string} [params.password] - Optional. Reactive Resume password (overrides env).
 * @param {string} [params.base_url] - Optional. Reactive Resume API base URL (overrides env).
 * @returns {Promise<object>} - Promise resolving to the resume details object or an error object.
 */
export async function getResume(params = {}) {
    // Create a cookie jar for this execution
    const cookieJar = new CookieJar();
    // Create an axios instance that uses the cookie jar
    const axiosInstance = axiosCookiejarSupport(axios.create({ jar: cookieJar }));

    let sessionCookie = null;

    try {
        // Validate required parameters
        if (!params.resume_id) {
            throw new Error("Resume ID (resume_id) is required");
        }

        // --- Apply Defaults and Environment Variables ---
        const resumeId = params.resume_id;
        const email = params.email || DEFAULT_RX_EMAIL;
        const password = params.password || DEFAULT_RX_PASSWORD;
        const baseUrl = params.base_url || DEFAULT_RX_BASE_URL;

        if (!email || !password || !baseUrl) {
            throw new Error("Missing required Reactive Resume authentication details (email, password, base_url) in params or environment variables.");
        }

        // --- Step 1: Authenticate with Reactive Resume ---
        const authUrl = `${baseUrl}/auth/login`;
        const authPayload = { identifier: email, password: password };
        const authHeaders = { 'Content-Type': 'application/json' };

        let sessionCookie = null; // Keep for potential debugging/other headers
        try {
            // Use the axios instance with cookie jar support
            const authResponse = await axiosInstance.post(authUrl, authPayload, { headers: authHeaders });
            if (authResponse.status !== 200) {
                throw new Error(`Authentication failed with status code ${authResponse.status}`);
            }
            // Cookie jar handles cookies automatically
            console.log("Authentication successful, cookie jar updated.");
            // Optionally extract for debugging
            const cookies = authResponse.headers['set-cookie'];
             if (cookies) {
                 sessionCookie = cookies.find(cookie => cookie.startsWith('connect.sid='))?.split(';')[0];
             }
        } catch (error) {
            const status = error.response?.status;
            const message = error.response?.data?.message || error.message;
            throw new Error(`Authentication failed${status ? ` with status ${status}` : ''}: ${message}`);
        }

        // --- Step 2: Get Resume Details ---
        const resumeUrl = `${baseUrl}/resume/${resumeId}`;
        // No need for manual cookie header, axiosInstance handles it
        const getHeaders = {};
        console.log(`Fetching resume details from: ${resumeUrl}`);

        try {
            // Use the axios instance with cookie jar support
            const resumeResponse = await axiosInstance.get(resumeUrl, { headers: getHeaders });

            if (resumeResponse.status !== 200) {
                throw new Error(`Failed to get resume with status code ${resumeResponse.status}. Response: ${JSON.stringify(resumeResponse.data)}`);
            }

            const resume = resumeResponse.data;

            // Format the response slightly for consistency if needed, or return directly
            // For now, returning the direct API response structure
            return resume;

        } catch (error) {
            const status = error.response?.status;
            const message = error.response?.data?.message || error.message;
            throw new Error(`Failed to fetch resume ${resumeId}${status ? ` with status ${status}` : ''}: ${message}`);
        }

    } catch (error) {
        console.error(`Error in getResume: ${error.message}`);
        return { error: `Error: ${error.message}` };
    }
}

// --- Tool Definition ---
export const getResumeTool = {
    name: "get_resume",
    description: "Gets the full details of a specific resume by ID from Reactive Resume. Uses env vars for auth defaults.",
    execute: getResume,
    inputSchema: {
        type: "object",
        properties: {
            resume_id: { type: "string", description: "ID of the resume to fetch (Required)" },
            email: { type: "string", description: "Reactive Resume email (Optional, overrides env)" },
            password: { type: "string", description: "Reactive Resume password (Optional, overrides env)" },
            base_url: { type: "string", description: "Reactive Resume API URL (Optional, overrides env)" }
        },
        required: ["resume_id"]
    }
};

// --- Example Usage (for testing) ---
// Note: Needs a valid resume_id from your Reactive Resume instance
async function runTest() {
     const isMain = import.meta.url.endsWith(path.basename(process.argv[1])) ||
                   import.meta.url.endsWith(path.basename(process.argv[1]) + '.js') ||
                   process.argv[1] === fileURLToPath(import.meta.url);

    if (isMain) {
        console.log("Running getResume test...");
        // --- !! Replace with a REAL resume ID from your instance !! ---
        const testResumeId = process.env.TEST_RESUME_ID || "replace-with-real-resume-id";
        // --- !! ----------------------------------------------- !! ---

        if (testResumeId === "replace-with-real-resume-id") {
             console.warn("Skipping test: TEST_RESUME_ID environment variable or default value is not set to a real ID.");
             return;
        }

        const testParams = {
            resume_id: testResumeId,
        };

        try {
            const result = await getResume(testParams);
            console.log("Get Resume Result:");
            console.log(JSON.stringify(result, null, 2));

            if (result.error) {
                 console.error("Test finished with error.");
            } else if (result.id === testResumeId) {
                 console.log("Test PASSED: Fetched resume ID matches requested ID.");
            } else {
                 console.warn("Test potentially failed: Fetched resume ID does not match requested ID (or result structure unexpected).");
            }

        } catch (error) {
            console.error("Get Resume Test Failed:");
            console.error(error);
        }
    }
}

runTest();