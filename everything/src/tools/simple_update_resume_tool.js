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
const DEFAULT_RX_BASE_URL = process.env.RX_RESUME_BASE_URL || "https://resume.emmanuelu.com/api";
const DEFAULT_RX_PUBLIC_URL = process.env.RX_RESUME_PUBLIC_URL || "https://resume.emmanuelu.com";

/**
 * A simplified tool to update a resume's website URL
 *
 * @param {object} params - Parameters object
 * @param {string} params.resume_id - Required. The UUID of the resume to update
 * @param {string} params.website_url - Required. The website URL to add/update
 * @param {string} [params.website_name] - Optional. The name for the website (defaults to "Website")
 * @param {string} [params.website_username] - Optional. The username for the website (defaults to "Personal Website")
 * @returns {Promise<object>} - Promise resolving to result object
 */
export async function simpleUpdateResume(params = {}) {
    // Create a cookie jar for this execution
    const cookieJar = new CookieJar();
    // Create an axios instance that uses the cookie jar
    const axiosInstance = axiosCookiejarSupport(axios.create({ jar: cookieJar }));

    try {
        // --- Validate Inputs ---
        if (!params.resume_id) throw new Error("Resume ID (resume_id) is required");
        if (!params.website_url) throw new Error("Website URL (website_url) is required");

        // --- Apply Defaults ---
        const resumeId = params.resume_id;
        const websiteUrl = params.website_url;
        const websiteName = params.website_name || "Website";
        const websiteUsername = params.website_username || "Personal Website";

        // Ensure URL has https:// prefix
        const formattedUrl = websiteUrl.startsWith('http://') || websiteUrl.startsWith('https://')
            ? websiteUrl
            : `https://${websiteUrl}`;

        console.log(`Updating resume ${resumeId} with website URL: ${formattedUrl}`);

        // --- Step 1: Authenticate ---
        const email = DEFAULT_RX_EMAIL;
        const password = DEFAULT_RX_PASSWORD;
        const baseUrl = DEFAULT_RX_BASE_URL;

        console.log(`Using authentication with email: ${email}`);
        console.log(`Using base URL: ${baseUrl}`);

        const authUrl = `${baseUrl}/auth/login`;
        const authPayload = { identifier: email, password: password };
        console.log(`Authenticating with:`, JSON.stringify(authPayload, null, 2));
        console.log(`Auth URL: ${authUrl}`);

        const authResponse = await axiosInstance.post(authUrl, authPayload, {
            headers: { 'Content-Type': 'application/json' }
        });

        if (authResponse.status !== 200) {
            throw new Error(`Authentication failed with status code ${authResponse.status}`);
        }

        // --- Step 2: Get Current Resume Data ---
        const resumeUrl = `${baseUrl}/resume/${resumeId}`;
        console.log(`Fetching current resume data from: ${resumeUrl}`);

        const resumeResponse = await axiosInstance.get(resumeUrl, {
            headers: { 'Content-Type': 'application/json' }
        });

        if (resumeResponse.status !== 200) {
            throw new Error(`Failed to get resume with status code ${resumeResponse.status}`);
        }

        const currentResume = resumeResponse.data;

        // --- Step 3: Prepare Update Payload ---
        // Create a deep copy of the current resume
        const updatePayload = JSON.parse(JSON.stringify(currentResume));

        // Ensure data and sections exist
        if (!updatePayload.data) updatePayload.data = {};
        if (!updatePayload.data.sections) updatePayload.data.sections = {};

        // Ensure profiles section exists
        if (!updatePayload.data.sections.profiles) {
            updatePayload.data.sections.profiles = {
                name: "Profiles",
                id: "profiles",
                columns: 1,
                visible: true,
                items: []
            };
        }

        // Generate a simple ID
        const generateId = () => {
            return `clid${Date.now()}${Math.floor(Math.random() * 10000)}`;
        };

        // Find existing website profile or create a new one
        let websiteProfile = updatePayload.data.sections.profiles.items.find(
            item => item.network === websiteName
        );

        // Determine the appropriate icon based on the website name
        let icon = "link"; // Default icon

        // Check for common networks and assign appropriate icons
        const networkLower = websiteName.toLowerCase();
        if (networkLower.includes("linkedin")) {
            icon = "linkedin";
        } else if (networkLower.includes("github")) {
            icon = "github";
        } else if (networkLower.includes("twitter") || networkLower.includes("x.com")) {
            icon = "twitter";
        } else if (networkLower.includes("facebook")) {
            icon = "facebook";
        } else if (networkLower.includes("instagram")) {
            icon = "instagram";
        } else if (networkLower.includes("youtube")) {
            icon = "youtube";
        } else if (networkLower.includes("medium")) {
            icon = "medium";
        } else if (networkLower.includes("dribbble")) {
            icon = "dribbble";
        } else if (networkLower.includes("behance")) {
            icon = "behance";
        } else if (networkLower.includes("gitlab")) {
            icon = "gitlab";
        } else if (networkLower.includes("stackoverflow")) {
            icon = "stackoverflow";
        }

        if (!websiteProfile) {
            // Create new profile
            websiteProfile = {
                id: generateId(),
                network: websiteName,
                username: websiteUsername,
                icon: icon,
                visible: true
            };
            updatePayload.data.sections.profiles.items.push(websiteProfile);
        } else {
            // Make sure the existing profile has an icon
            websiteProfile.icon = websiteProfile.icon || icon;
        }

        // Update the URL in the correct format
        websiteProfile.url = {
            label: websiteName,
            href: formattedUrl
        };

        console.log(`Prepared profile:`, JSON.stringify(websiteProfile, null, 2));

        // --- Step 4: Update Resume ---
        console.log(`Updating resume with prepared data...`);

        const updateResponse = await axiosInstance.patch(resumeUrl, updatePayload, {
            headers: { 'Content-Type': 'application/json' }
        });

        if (updateResponse.status !== 200) {
            throw new Error(`Failed to update resume with status code ${updateResponse.status}`);
        }

        const updatedResume = updateResponse.data;

        // --- Step 5: Format Success Response ---
        const publicUrl = updatedResume.visibility === "public" && updatedResume.slug
            ? `${DEFAULT_RX_PUBLIC_URL}/r/${updatedResume.slug}`
            : null;

        return {
            success: true,
            message: `Resume updated with website URL: ${formattedUrl}`,
            id: updatedResume.id,
            title: updatedResume.title,
            slug: updatedResume.slug,
            public_url: publicUrl,
            website_url: formattedUrl
        };

    } catch (error) {
        console.error(`Error in simpleUpdateResume:`, error.message);

        // Enhanced error details
        if (error.response) {
            console.error(`Response status:`, error.response.status);
            console.error(`Response headers:`, JSON.stringify(error.response.headers, null, 2));
            console.error(`Response data:`, JSON.stringify(error.response.data, null, 2));

            // Log validation details if available
            if (error.response.data && error.response.data.details) {
                console.error(`Validation details:`, JSON.stringify(error.response.data.details, null, 2));
            }

            // Return more detailed error information
            return {
                success: false,
                error: `Error: ${error.message}`,
                status: error.response.status,
                data: error.response.data,
                details: error.response.data?.details || []
            };
        }

        return {
            success: false,
            error: `Error: ${error.message}`
        };
    }
}

// --- Tool Definition ---
export const simpleUpdateResumeTool = {
    name: "simple_update_resume",
    description: "A simplified tool to update a resume's website URL",
    execute: simpleUpdateResume,
    inputSchema: {
        type: "object",
        properties: {
            resume_id: {
                type: "string",
                description: "ID of the resume to update (Required)"
            },
            website_url: {
                type: "string",
                description: "The website URL to add/update (Required)"
            },
            website_name: {
                type: "string",
                description: "The name for the website (Optional, defaults to 'Website')"
            },
            website_username: {
                type: "string",
                description: "The username for the website (Optional, defaults to 'Personal Website')"
            }
        },
        required: ["resume_id", "website_url"]
    }
};
