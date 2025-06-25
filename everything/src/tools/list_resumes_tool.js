import axios from 'axios';
import { wrapper as axiosCookiejarSupport } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { URL } from 'url'; // Import URL class for parsing

// Load environment variables from .env file in the root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') }); // Go up three levels

// --- Configuration ---
const DEFAULT_RX_EMAIL = process.env.RX_RESUME_EMAIL || "emanuvaderland@gmail.com";
const DEFAULT_RX_PASSWORD = process.env.RX_RESUME_PASSWORD || "E4YSj9UiVuSB3uJ";
const DEFAULT_RX_BASE_URL = process.env.RX_RESUME_BASE_URL || "http://192.168.50.90:3050/api";
const DEFAULT_RX_PUBLIC_URL = process.env.RX_RESUME_PUBLIC_URL; // Optional env var for public base

/**
 * Lists all resumes for the authenticated user in Reactive Resume.
 *
 * @param {object} params - Parameters object.
 * @param {string} [params.email] - Optional. Reactive Resume email (overrides env).
 * @param {string} [params.password] - Optional. Reactive Resume password (overrides env).
 * @param {string} [params.base_url] - Optional. Reactive Resume API base URL (overrides env).
 * @param {boolean} [params.include_public_urls=true] - Optional. Include public URLs for public resumes.
 * @returns {Promise<object>} - Promise resolving to an object with resume list or an error object.
 */
export async function listResumes(params = {}) {
    // Create a cookie jar for this execution
    const cookieJar = new CookieJar();
    // Create an axios instance that uses the cookie jar
    const axiosInstance = axiosCookiejarSupport(axios.create({ jar: cookieJar }));

    try {
        // --- Apply Defaults and Environment Variables ---
        // Only use params if they are non-empty strings
        const email = (params.email && params.email.trim()) ? params.email.trim() : DEFAULT_RX_EMAIL;
        const password = (params.password && params.password.trim()) ? params.password.trim() : DEFAULT_RX_PASSWORD;
        const baseUrl = (params.base_url && params.base_url.trim()) ? params.base_url.trim() : DEFAULT_RX_BASE_URL;
        const includePublicUrls = params.include_public_urls !== false; // Default true

        if (!email || !password || !baseUrl) {
            throw new Error("Missing required Reactive Resume authentication details (email, password, base_url) in params or environment variables.");
        }

        // Determine public base URL
        let publicBaseUrl = DEFAULT_RX_PUBLIC_URL;
        if (!publicBaseUrl) {
            try {
                const parsedApiUrl = new URL(baseUrl);
                publicBaseUrl = `${parsedApiUrl.protocol}//${parsedApiUrl.host}`; // Derive from API URL if not set
            } catch (e) {
                 console.warn(`Could not parse RX_RESUME_BASE_URL (${baseUrl}) to derive public URL. Public URLs might be incorrect.`);
                 publicBaseUrl = baseUrl.replace("/api", ""); // Fallback attempt
            }
        }


        // --- Step 1: Authenticate with Reactive Resume ---
        const authUrl = `${baseUrl}/auth/login`;
        const authPayload = { identifier: email, password: password };
        const authHeaders = { 'Content-Type': 'application/json' };

        try {
            // Use the axios instance with cookie jar support
            const authResponse = await axiosInstance.post(authUrl, authPayload, { headers: authHeaders });
            if (authResponse.status !== 200) {
                throw new Error(`Authentication failed with status code ${authResponse.status}`);
            }
            // Cookie jar handles cookies automatically, no need to parse 'set-cookie'
            console.log("Authentication successful, cookie jar updated.");
        } catch (error) {
            const status = error.response?.status;
            const message = error.response?.data?.message || error.message;
            throw new Error(`Authentication failed${status ? ` with status ${status}` : ''}: ${message}`);
        }

        // No need to manually set Cookie header, axiosInstance handles it
        const requestHeaders = {}; // Keep empty or add other non-cookie headers if needed

        // --- Step 2: Get Username (if needed for public URLs) ---
        let username = null;
        if (includePublicUrls) {
            const userUrl = `${baseUrl}/user/me`;
            console.log(`Fetching user profile from: ${userUrl}`);
            try {
                // Use the axios instance with cookie jar support
                const userResponse = await axiosInstance.get(userUrl, { headers: requestHeaders });
                if (userResponse.status === 200 && userResponse.data) {
                    username = userResponse.data.username;
                    if (!username) {
                         console.warn("Username not found in user profile response. Public URLs cannot be generated.");
                    }
                } else {
                     console.warn(`Failed to get user profile. Status: ${userResponse.status}. Public URLs cannot be generated.`);
                }
            } catch (error) {
                 const status = error.response?.status;
                 const message = error.response?.data?.message || error.message;
                 console.warn(`Error fetching user profile${status ? ` (status ${status})` : ''}: ${message}. Public URLs cannot be generated.`);
            }
        }

        // --- Step 3: Get Resumes ---
        const resumesUrl = `${baseUrl}/resume`;
        console.log(`Fetching resumes from: ${resumesUrl}`);
        try {
            // Use the axios instance with cookie jar support
            const resumesResponse = await axiosInstance.get(resumesUrl, { headers: requestHeaders });

            if (resumesResponse.status !== 200) {
                throw new Error(`Failed to get resumes with status code ${resumesResponse.status}. Response: ${JSON.stringify(resumesResponse.data)}`);
            }

            const resumes = resumesResponse.data || []; // Ensure it's an array

            // --- Step 4: Format Response ---
            const result = {
                count: resumes.length,
                resumes: resumes.map(resume => {
                    const resumeData = {
                        id: resume.id,
                        title: resume.title,
                        slug: resume.slug,
                        visibility: resume.visibility,
                        created_at: resume.createdAt,
                        updated_at: resume.updatedAt
                    };

                    // Add public URL if applicable
                    // Note: The URL format might vary based on Reactive Resume version/config.
                    // The Python script used /r/slug, let's try that first.
                    // If that fails, try the username/resume-shortid format.
                    if (includePublicUrls && resume.visibility === "public" && resume.slug) {
                         resumeData.public_url = `${publicBaseUrl}/r/${resume.slug}`;
                         // Alternative format seen in Python script (less common?):
                         // if (username && resume.id) {
                         //    const shortId = resume.id.substring(0, 8);
                         //    resumeData.public_url_alt = `${publicBaseUrl}/${username}/resume-${shortId}`;
                         // }
                    }
                    return resumeData;
                })
            };

            return result;

        } catch (error) {
            const status = error.response?.status;
            const message = error.response?.data?.message || error.message;
            throw new Error(`Failed to fetch resumes${status ? ` with status ${status}` : ''}: ${message}`);
        }

    } catch (error) {
        console.error(`Error in listResumes: ${error.message}`);
        return { error: `Error: ${error.message}` };
    }
}

// --- Tool Definition ---
export const listResumesTool = {
    name: "list_resumes",
    description: "Lists all resumes for the authenticated user in Reactive Resume. Optionally includes public URLs. Uses env vars for auth defaults.",
    execute: listResumes,
    inputSchema: {
        type: "object",
        properties: {
            email: { type: "string", description: "Reactive Resume email (Optional, overrides env)" },
            password: { type: "string", description: "Reactive Resume password (Optional, overrides env)" },
            base_url: { type: "string", description: "Reactive Resume API URL (Optional, overrides env)" },
            include_public_urls: { type: "boolean", description: "Include public URLs for public resumes (Optional, default: true)" }
        },
        required: [] // No required params for listing
    }
};

// --- Example Usage (for testing) ---
async function runTest() {
     const isMain = import.meta.url.endsWith(path.basename(process.argv[1])) ||
                   import.meta.url.endsWith(path.basename(process.argv[1]) + '.js') ||
                   process.argv[1] === fileURLToPath(import.meta.url);

    if (isMain) {
        console.log("Running listResumes test...");

        const testParams = {
             include_public_urls: true // Explicitly test with public URLs
        };

        try {
            const result = await listResumes(testParams);
            console.log("List Resumes Result:");
            console.log(JSON.stringify(result, null, 2));

            if (result.error) {
                 console.error("Test finished with error.");
            } else {
                 console.log(`Test PASSED: Found ${result.count} resumes.`);
            }

        } catch (error) {
            console.error("List Resumes Test Failed:");
            console.error(error);
        }
    }
}

runTest();