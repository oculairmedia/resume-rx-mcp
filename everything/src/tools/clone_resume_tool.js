import axios from 'axios';
import { wrapper as axiosCookiejarSupport } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import { v4 as uuidv4 } from 'uuid';
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
const DEFAULT_RX_PUBLIC_URL = process.env.RX_RESUME_PUBLIC_URL || "http://192.168.50.90:3000"; // For constructing public URL

/**
 * Clones an existing resume in Reactive Resume using a three-stage process:
 * 1. Creates a new empty resume with just the title.
 * 2. Fetches the full data (basics, sections, metadata) of the source resume.
 * 3. Updates the new empty resume with the fetched source data.
 *
 * @param {object} params - Parameters object.
 * @param {string} params.source_resume_id - Required. The UUID of the resume to clone.
 * @param {string} [params.new_title] - Optional. The title for the new cloned resume. Defaults to "Source Title - Copy".
 * @param {object} [params.auth] - Optional. Authentication details (email, password, base_url). Uses env vars if not provided.
 * @returns {Promise<object>} - Promise resolving to an object with the final cloned resume details or error info.
 */
async function cloneResume(params = {}) {
    // Create a cookie jar for this execution
    const cookieJar = new CookieJar();
    // Create an axios instance that uses the cookie jar
    const axiosInstance = axiosCookiejarSupport(axios.create({ jar: cookieJar }));

    try {
        // Validate required parameters
        if (!params.source_resume_id) {
            throw new Error("Source Resume ID (source_resume_id) is required");
        }

        // Configuration from params or environment variables
        const authParams = params.auth || {};
        const EMAIL = authParams.email || DEFAULT_RX_EMAIL;
        const PASSWORD = authParams.password || DEFAULT_RX_PASSWORD;
        const BASE_URL = authParams.base_url || DEFAULT_RX_BASE_URL;
        const PUBLIC_BASE_URL = DEFAULT_RX_PUBLIC_URL; // Use default/env for public URL

        if (!EMAIL || !PASSWORD || !BASE_URL) {
            throw new Error("Missing required authentication environment variables (RX_RESUME_EMAIL, RX_RESUME_PASSWORD, RX_RESUME_BASE_URL) or auth parameters.");
        }

        // --- Step 1: Authenticate ---
        const authUrl = `${BASE_URL}/auth/login`;
        const authPayload = { identifier: EMAIL, password: PASSWORD };
        const authHeaders = { 'Content-Type': 'application/json' };

        try {
            const authResponse = await axiosInstance.post(authUrl, authPayload, { headers: authHeaders });
            if (authResponse.status !== 200) {
                throw new Error(`Authentication failed with status code ${authResponse.status}`);
            }
            console.log("Authentication successful for clone operation.");
        } catch (error) {
            const status = error.response?.status;
            const message = error.response?.data?.message || error.message;
            throw new Error(`Authentication failed${status ? ` with status ${status}` : ''}: ${message}`);
        }

        // --- Step 2: Get Source Resume Details ---
        const sourceResumeId = params.source_resume_id;
        const getResumeUrl = `${BASE_URL}/resume/${sourceResumeId}`;
        const getHeaders = {}; // Cookie jar handles auth
        console.log(`Fetching source resume details from: ${getResumeUrl}`);

        let sourceResumeData;
        try {
            const resumeResponse = await axiosInstance.get(getResumeUrl, { headers: getHeaders });
            if (resumeResponse.status !== 200) {
                throw new Error(`Failed to get source resume with status code ${resumeResponse.status}. Response: ${JSON.stringify(resumeResponse.data)}`);
            }
            sourceResumeData = resumeResponse.data;
            if (!sourceResumeData || !sourceResumeData.data || !sourceResumeData.data.basics || !sourceResumeData.data.sections) {
                 throw new Error("Fetched source resume data is missing expected structure (basics or sections).");
            }
            console.log(`Successfully fetched source resume: ${sourceResumeData.data.title || 'Untitled'}`);
        } catch (error) {
            const status = error.response?.status;
            const message = error.response?.data?.message || error.message;
            // Add response data to error for better debugging
            throw new Error(`Failed to fetch source resume ${sourceResumeId}${status ? ` with status ${status}` : ''}: ${message}. Response data: ${JSON.stringify(error.response?.data)}`);
        }

        // --- Step 3: Create Empty Resume ---
        const newTitle = params.new_title || `${sourceResumeData.data.title || 'Untitled'} - Copy`;
        // Slug is often generated server-side on create, but we can suggest one
        // Let's omit slug for creation and let the server handle it, then update if needed.
        const createPayload = {
            title: newTitle,
            // slug: `resume-${uuidv4().substring(0, 8)}` // Optional: Server might ignore/override
        };
        const createUrl = `${BASE_URL}/resume`;
        const createHeaders = { 'Content-Type': 'application/json' }; // Cookie jar handles auth
        console.log(`Creating empty resume with title: ${newTitle}`);

        let newResumeId;
        let initialSlug;
        try {
            const createResponse = await axiosInstance.post(createUrl, createPayload, { headers: createHeaders });
            if (createResponse.status !== 201 || !createResponse.data?.id) {
                throw new Error(`Failed to create empty resume. Status: ${createResponse.status}. Response: ${JSON.stringify(createResponse.data)}`);
            }
            newResumeId = createResponse.data.id;
            initialSlug = createResponse.data.slug; // Capture the slug assigned by the server
            console.log(`Successfully created empty resume with ID: ${newResumeId} and Slug: ${initialSlug}`);
        } catch (error) {
            const status = error.response?.status;
            const message = error.response?.data?.message || error.message;
            throw new Error(`Failed to create empty resume${status ? ` with status ${status}` : ''}: ${message}. Payload sent: ${JSON.stringify(createPayload)}`);
        }

        // --- Step 4: Prepare Update Payload ---
        // Extract data from the fetched source resume
        const sourceBasics = sourceResumeData.data?.basics || {};
        const sourceSections = sourceResumeData.data?.sections || {};
        const sourceMetadata = sourceResumeData.metadata || {}; // Include metadata

        const updatePayload = {
            // title: newTitle, // Title is already set
            // slug: initialSlug, // Slug is already set
            basics: sourceBasics,
            sections: sourceSections,
            metadata: sourceMetadata, // Add metadata to the update payload
            // Note: We don't need to wrap these in a 'data' object for PATCH /resume/{id}
        };
        console.log(`Preparing update payload for resume ID: ${newResumeId}`);
        // console.log("DEBUG: Update Payload:", JSON.stringify(updatePayload, null, 2)); // Optional: Log update payload

        // --- Step 5: Update the New Resume ---
        const updateUrl = `${BASE_URL}/resume/${newResumeId}`;
        const updateHeaders = { 'Content-Type': 'application/json' }; // Cookie jar handles auth
        console.log(`Updating resume ${newResumeId} with source data...`);

        try {
            const updateResponse = await axiosInstance.patch(updateUrl, updatePayload, { headers: updateHeaders });

            if (updateResponse.status !== 200) {
                throw new Error(`Failed to update cloned resume with status code ${updateResponse.status}. Response: ${JSON.stringify(updateResponse.data)}`);
            }

            const updatedResume = updateResponse.data;

            // Format the successful response based on the *updated* resume
            return {
                message: `Successfully cloned resume '${sourceResumeData.data.title || 'Untitled'}' to '${updatedResume.title}' (ID: ${updatedResume.id})`,
                id: updatedResume.id,
                title: updatedResume.title,
                slug: updatedResume.slug, // Use the final slug from the update response
                public_url: `${PUBLIC_BASE_URL}/r/${updatedResume.slug}`
            };
        } catch (error) {
            const status = error.response?.status;
            const message = error.response?.data?.message || error.message;
            // Provide more context in the error message
            throw new Error(`Resume cloning (update step) failed for ID ${newResumeId}${status ? ` with status ${status}` : ''}: ${message}. Payload sent: ${JSON.stringify(updatePayload)}`);
        }

    } catch (error) {
        console.error(`Error in cloneResume: ${error.message}`);
        return { error: `Error: ${error.message}` }; // Return error object
    }
}

// --- Tool Definition ---
const cloneResumeTool = {
    name: "clone_resume",
    description: "Clones an existing resume in Reactive Resume using a 3-step process (create empty, fetch source, update new). Requires 'source_resume_id'. Optional: 'new_title', 'auth'.",
    execute: cloneResume,
    inputSchema: {
        type: "object",
        properties: {
            source_resume_id: { type: "string", description: "ID of the resume to clone (Required)" },
            new_title: { type: "string", description: "Title for the new cloned resume (Optional, defaults to 'Source Title - Copy')" },
            auth: {
                type: "object",
                properties: {
                    email: { type: "string" },
                    password: { type: "string" },
                    base_url: { type: "string" }
                },
                description: "Auth details (Optional, overrides env)"
            }
        },
        required: ["source_resume_id"]
    }
};

export { cloneResumeTool, cloneResume };

// --- Example Usage (for testing) ---
// Note: Needs a valid source_resume_id from your Reactive Resume instance
async function runTest() {
     const isMain = import.meta.url.endsWith(path.basename(process.argv[1])) ||
                   import.meta.url.endsWith(path.basename(process.argv[1]) + '.js') ||
                   process.argv[1] === fileURLToPath(import.meta.url);

    if (isMain) {
        console.log("Running cloneResume test...");
        // --- !! Replace with a REAL resume ID from your instance !! ---
        const testSourceResumeId = process.env.TEST_RESUME_ID || "replace-with-real-resume-id"; // Reuse TEST_RESUME_ID for convenience
        // --- !! ----------------------------------------------- !! ---

        if (testSourceResumeId === "replace-with-real-resume-id") {
             console.warn("Skipping test: TEST_RESUME_ID environment variable or default value is not set to a real ID.");
             return;
        }

        const testParams = {
            source_resume_id: testSourceResumeId,
            // new_title: "My Cloned Test Resume" // Optional: uncomment to test custom title
        };

        try {
            const result = await cloneResume(testParams);
            console.log("Clone Resume Result:");
            console.log(JSON.stringify(result, null, 2));

            if (result.error) {
                 console.error("Test finished with error.");
            } else if (result.id) {
                 console.log(`Test PASSED: Successfully cloned resume, new ID: ${result.id}`);
            } else {
                 console.warn("Test potentially failed: Result structure unexpected.");
            }

        } catch (error) {
            console.error("Clone Resume Test Failed:");
            console.error(error);
        }
    }
}

// runTest(); // Removed direct execution