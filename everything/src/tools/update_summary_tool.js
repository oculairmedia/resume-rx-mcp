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
 * Updates the summary section of an existing resume in Reactive Resume.
 * Handles only the summary section with a flat field structure.
 *
 * @param {object} params - Parameters object.
 * @param {string} params.resume_id - Required. The UUID of the resume to update.
 * @param {string} params.content - Required. The new content for the summary section.
 * @param {string} [params.email] - Optional. Override default email.
 * @param {string} [params.password] - Optional. Override default password.
 * @param {string} [params.base_url] - Optional. Override default API URL.
 *
 * Example:
 * ```javascript
 * {
 *   resume_id: "your-resume-id",
 *   content: "A passionate software engineer with 5 years of experience..."
 * }
 * ```
 *
 * @returns {Promise<object>} - Promise resolving to result object or error object.
 */
export async function updateSummary(params = {}) {
    const cookieJar = new CookieJar();
    const axiosInstance = axiosCookiejarSupport(axios.create({ jar: cookieJar }));

    try {
        // --- Validate Inputs ---
        if (!params.resume_id) throw new Error("Resume ID (resume_id) is required");
        if (params.content === undefined) throw new Error("Content (content) is required");

        // --- Process Authentication Parameters ---
        const email = params.email?.trim() || DEFAULT_RX_EMAIL;
        const password = params.password?.trim() || DEFAULT_RX_PASSWORD;
        const baseUrl = params.base_url?.trim() || DEFAULT_RX_BASE_URL;

        if (!email || !password || !baseUrl) {
            throw new Error("Missing required Reactive Resume authentication details (email, password, base_url).");
        }

        // --- Step 1: Authenticate ---
        const authUrl = `${baseUrl}/auth/login`;
        const authPayload = { identifier: email, password: password };
        const authHeaders = { 'Content-Type': 'application/json' };

        let sessionCookie = null;
        try {
            const authResponse = await axiosInstance.post(authUrl, authPayload, { headers: authHeaders });
            if (authResponse.status !== 200) throw new Error(`Authentication failed: ${authResponse.status}`);
            const cookies = authResponse.headers['set-cookie'];
            if (cookies) {
                sessionCookie = cookies.find(cookie => cookie.startsWith('connect.sid='))?.split(';')[0];
            }
        } catch (error) {
            throw new Error(`Authentication failed: ${error.response?.data?.message || error.message}`);
        }

        const requestHeaders = {
            'Content-Type': 'application/json',
            ...(sessionCookie && { 'Cookie': sessionCookie })
        };

        // --- Step 2: Get Current Resume Data ---
        const resumeUrl = `${baseUrl}/resume/${params.resume_id}`;
        let currentResume;
        try {
            const resumeResponse = await axiosInstance.get(resumeUrl, { headers: requestHeaders });
            if (resumeResponse.status !== 200) throw new Error(`Failed to get resume: ${resumeResponse.status}`);
            currentResume = resumeResponse.data;
        } catch (error) {
            throw new Error(`Failed to fetch current resume ${params.resume_id}: ${error.response?.data?.message || error.message}`);
        }

        // --- Step 3: Prepare Update Data ---
        const updatePayload = JSON.parse(JSON.stringify(currentResume)); // Deep clone
        if (!updatePayload.data) updatePayload.data = {};
        if (!updatePayload.data.sections) updatePayload.data.sections = {};

        // Ensure the summary section exists with proper structure
        if (!updatePayload.data.sections.summary) {
            updatePayload.data.sections.summary = {
                name: "Summary",
                id: "summary",
                visible: true,
                columns: 1,
                separateLinks: true
            };
        }

        // Update the summary content
        updatePayload.data.sections.summary.content = params.content;

        // --- Step 4: Update Resume ---
        try {
            const updateResponse = await axiosInstance.patch(resumeUrl, updatePayload, { headers: requestHeaders });
            if (updateResponse.status !== 200) {
                throw new Error(`Failed to update resume: ${updateResponse.status}`);
            }

            return {
                message: "Summary updated successfully.",
                resume_id: updateResponse.data.id,
                timestamp: updateResponse.data.updatedAt
            };

        } catch (error) {
            throw new Error(`Failed to update resume ${params.resume_id}: ${error.response?.data?.message || error.message}`);
        }

    } catch (error) {
        console.error(`Error in updateSummary: ${error.message}`);
        return { error: `Error: ${error.message}` };
    }
}

// --- Tool Definition ---
export const updateSummaryTool = {
    name: "update_summary",
    description: "Updates the summary section of an existing resume.",
    execute: updateSummary,
    inputSchema: {
        type: "object",
        properties: {
            resume_id: {
                type: "string",
                description: "ID of the resume to update"
            },
            content: {
                type: "string",
                description: "New content for the summary section"
            },
            email: {
                type: "string",
                description: "Optional: Override default email"
            },
            password: {
                type: "string",
                description: "Optional: Override default password"
            },
            base_url: {
                type: "string",
                description: "Optional: Override default API URL"
            }
        },
        required: ["resume_id", "content"]
    }
};