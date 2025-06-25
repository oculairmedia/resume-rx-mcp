import axios from 'axios';
import { wrapper as axiosCookiejarSupport } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

// Load environment variables from .env file in the root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') }); // Go up three levels

// --- Configuration ---
const DEFAULT_RX_EMAIL = process.env.RX_EMAIL || "emanuvaderland@gmail.com";
const DEFAULT_RX_PASSWORD = process.env.RX_PASSWORD || "E4YSj9UiVuSB3uJ";
const DEFAULT_RX_BASE_URL = process.env.RX_BASE_URL || "https://resume.emmanuelu.com/api";

// Deep clone utility (simple version)
function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    if (obj instanceof Date) {
        return new Date(obj.getTime());
    }
    if (Array.isArray(obj)) {
        const clonedArr = [];
        for (let i = 0; i < obj.length; i++) {
            clonedArr[i] = deepClone(obj[i]);
        }
        return clonedArr;
    }
    const clonedObj = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            clonedObj[key] = deepClone(obj[key]);
        }
    }
    return clonedObj;
}

/**
 * Updates the profiles section of an existing resume in Reactive Resume.
 * Supports adding and removing social/professional profiles with flat fields.
 *
 * @param {object} params - Parameters object.
 * @param {string} params.resume_id - Required. The UUID of the resume to update.
 * @param {string} params.operation - Required. One of: "add", "remove".
 * @param {string} params.network - Social network name (e.g., LinkedIn, GitHub).
 * @param {string} params.username - Username/handle for the profile.
 * @param {string} params.icon - Optional icon name (e.g., linkedin, github).
 * @param {string} params.url_label - Optional display text for URL.
 * @param {string} params.url_href - The actual URL of the profile.
 * @param {boolean} params.visible - Optional. Default true.
 * @param {string} params.item_id - Required for remove operations.
 * @param {string} params.email - Optional. Override default email.
 * @param {string} params.password - Optional. Override default password.
 * @param {string} params.base_url - Optional. Override default API URL.
 * @returns {Promise<object>} - Promise resolving to result object or error object.
 */
export async function updateProfiles(params = {}) {
    // Configuration
    const apiEmail = params.email || DEFAULT_RX_EMAIL;
    const apiPassword = params.password || DEFAULT_RX_PASSWORD;
    const apiUrl = params.base_url || DEFAULT_RX_BASE_URL;
    
    console.log("Using authentication with email:", apiEmail);
    console.log("Using base URL:", apiUrl);
    
    // Create axios instance with cookie support
    const jar = new CookieJar();
    const axiosInstance = axiosCookiejarSupport(axios.create({ jar }));
    
    try {
        // --- Validate Inputs ---
        if (!params.resume_id) throw new Error("Resume ID (resume_id) is required");
        if (!params.operation) throw new Error("Operation (operation) is required");

        const validOperations = ["add", "remove"];
        if (!validOperations.includes(params.operation)) {
            throw new Error(`Invalid operation '${params.operation}'. Must be one of: ${validOperations.join(', ')}`);
        }

        if (params.operation === "add") {
            if (!params.network) throw new Error("network is required for adding a profile");
            if (!params.username) throw new Error("username is required for adding a profile");
            if (!params.url_href) throw new Error("url_href is required for adding a profile");
        } else if (params.operation === "remove") {
            if (!params.item_id) throw new Error("item_id is required for remove operation");
        }

        // Authenticate
        const authUrl = `${apiUrl}/auth/login`;
        const authPayload = {
            identifier: apiEmail,
            password: apiPassword
        };
        const authHeaders = {
            "Content-Type": "application/json"
        };
        
        console.log("Authenticating with:", JSON.stringify(authPayload, null, 2));
        console.log("Auth URL:", authUrl);
        const authResponse = await axiosInstance.post(authUrl, authPayload, { headers: authHeaders });
        
        if (authResponse.status !== 200) {
            throw new Error(`Authentication failed with status code ${authResponse.status}`);
        }

        // Get current resume data
        const resumeUrl = `${apiUrl}/resume/${params.resume_id}`;
        console.log("Fetching resume from:", resumeUrl);
        const { data: resume } = await axiosInstance.get(resumeUrl);

        // Initialize profiles section if it doesn't exist
        if (!resume.data.sections.profiles) {
            resume.data.sections.profiles = {
                name: "Profiles",
                columns: 1,
                separateLinks: true,
                visible: true,
                id: "profiles",
                items: []
            };
        }

        // Create a deep copy of the resume object
        const updatePayload = deepClone(resume);
        const profilesSection = updatePayload.data.sections.profiles;

        if (params.operation === "add") {
            // Generate a CUID2-like ID that will pass validation
            const generateCuid2 = () => {
                return `${Array.from({length: 24}, () => 
                    "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]
                ).join('')}`;
            };

            // Create new profile item
            const profileItem = {
                id: generateCuid2(),
                visible: params.visible !== false,
                network: params.network,
                username: params.username,
                icon: params.icon || params.network.toLowerCase(),
                url: {
                    label: params.url_label || `${params.network} Profile`,
                    href: params.url_href
                }
            };
            
            console.log("Adding profile item:", JSON.stringify(profileItem, null, 2));
            profilesSection.items.push(profileItem);
        } else if (params.operation === "remove") {
            // Remove profile item by ID
            const originalLength = profilesSection.items.length;
            profilesSection.items = profilesSection.items.filter(item => item.id !== params.item_id);
            
            if (profilesSection.items.length === originalLength) {
                console.warn(`Profile with ID '${params.item_id}' not found or already removed.`);
            }
        }

        // Update the resume
        console.log("Updating resume with profiles section:", JSON.stringify(profilesSection, null, 2));
        const updateResponse = await axiosInstance.patch(resumeUrl, updatePayload, { 
            headers: { "Content-Type": "application/json" }
        });
        
        if (updateResponse.status !== 200) {
            throw new Error(`Failed to update resume: ${updateResponse.status}`);
        }

        // Verify the update
        console.log("Verifying update...");
        const verifyResponse = await axiosInstance.get(resumeUrl);
        const updatedProfiles = verifyResponse.data.data.sections.profiles;
        
        if (params.operation === "add") {
            const addedProfile = updatedProfiles.items.find(item => 
                item.network === params.network && 
                item.username === params.username
            );
            
            if (!addedProfile) {
                console.warn("Warning: Profile may not have been added successfully!");
            } else {
                console.log("Profile added successfully:", addedProfile);
            }
        }

        return {
            message: `Profile ${params.operation === 'remove' ? 'removed' : 'added'} successfully.`,
            resume_id: updateResponse.data.id,
            operation: params.operation,
            timestamp: updateResponse.data.updatedAt
        };

    } catch (error) {
        console.error(`Error in updateProfiles: ${error.message}`);
        return { 
            success: false,
            error: `Error: ${error.message}` 
        };
    }
}

// --- Tool Definition ---
export const updateProfilesTool = {
    name: "update_profiles",
    description: "Updates ('add', 'remove') social/professional profiles in the profiles section of an existing resume. Uses flat fields.",
    execute: updateProfiles,
    inputSchema: {
        type: "object",
        properties: {
            resume_id: { type: "string", description: "ID of the resume to update" },
            operation: { type: "string", enum: ["add", "remove"], description: "Operation to perform" },
            network: { type: "string", description: "Social network name (e.g., LinkedIn, GitHub)" },
            username: { type: "string", description: "Username/handle for the profile" },
            icon: { type: "string", description: "Optional icon name (e.g., linkedin, github)" },
            url_label: { type: "string", description: "Optional display text for URL" },
            url_href: { type: "string", description: "The actual URL of the profile" },
            visible: { type: "boolean", description: "Item visibility (default: true)" },
            item_id: { type: "string", description: "Item ID (required for remove operations)" },
            email: { type: "string", description: "Optional: Override default email" },
            password: { type: "string", description: "Optional: Override default password" },
            base_url: { type: "string", description: "Optional: Override default API URL" }
        },
        required: ["resume_id", "operation"],
        allOf: [
            {
                if: { properties: { operation: { const: "remove" } } },
                then: { required: ["item_id"] }
            },
            {
                if: { properties: { operation: { const: "add" } } },
                then: { required: ["network", "username", "url_href"] }
            }
        ]
    }
};