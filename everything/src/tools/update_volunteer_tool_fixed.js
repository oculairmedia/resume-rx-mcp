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
const DEFAULT_RX_EMAIL = process.env.RX_RESUME_EMAIL || "emanuvaderland@gmail.com";
const DEFAULT_RX_PASSWORD = process.env.RX_RESUME_PASSWORD || "E4YSj9UiVuSB3uJ";
const DEFAULT_RX_BASE_URL = process.env.RX_RESUME_BASE_URL || "http://192.168.50.90:3050/api";

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
 * Updates the volunteer section of an existing resume in Reactive Resume.
 * Supports adding and removing volunteer experience entries with flat fields.
 *
 * @param {object} params - Parameters object.
 * @param {string} params.resume_id - Required. The UUID of the resume to update.
 * @param {string} params.operation - Required. One of: "add", "remove".
 * @param {string} params.organization - Organization name (required for add).
 * @param {string} params.position - Volunteer position/role (required for add).
 * @param {string} params.date - Single date string in YYYY-MM format (alternative to startDate/endDate).
 * @param {string} params.startDate - Start date in YYYY-MM format.
 * @param {string} params.endDate - End date in YYYY-MM format.
 * @param {string} params.summary - Description of volunteer work.
 * @param {string} params.url_label - URL label for organization website.
 * @param {string} params.url_href - URL for organization website.
 * @param {boolean} params.visible - Optional. Default true.
 * @param {string} params.item_id - Required for remove operations.
 *
 * Examples:
 *
 * 1. Adding a volunteer entry:
 * ```javascript
 * {
 *   resume_id: "your-resume-id",
 *   operation: "add",
 *   organization: "Red Cross",
 *   position: "Disaster Response Volunteer",
 *   startDate: "2023-01",
 *   endDate: "2024-03",
 *   summary: "Assisted in emergency response..."
 * }
 * ```
 *
 * 2. Removing a volunteer entry:
 * ```javascript
 * {
 *   resume_id: "your-resume-id",
 *   operation: "remove",
 *   item_id: "existing-volunteer-id"
 * }
 * ```
 *
 * @param {object} [params.auth] - Optional. Auth details (overrides env).
 * @returns {Promise<object>} - Promise resolving to result object or error object.
 */
export async function updateVolunteer(params = {}) {
    const cookieJar = new CookieJar();
    const axiosInstance = axiosCookiejarSupport(axios.create({ jar: cookieJar }));

    try {
        // --- Helper: Generate CUID2-like ID ---
        function generateCuid2() {
            // Use crypto for better randomness if available, fallback to uuidv4 parts
            const randomPart = typeof crypto !== 'undefined' && crypto.randomUUID
                ? crypto.randomUUID().replace(/-/g, '')
                : uuidv4().replace(/-/g, '');
            return `c${randomPart.substring(0, 23)}`; // Standard Cuid2 length is 24 starting with 'c'
        }

        // --- Helper: Format Date Range ---
        const formatDateRange = (startDateStr, endDateStr) => {
            try {
                // Expect YYYY or YYYY-MM or YYYY-MM-DD
                const parseDate = (dateStr) => {
                    if (!dateStr) return null;
                    // Add day if only YYYY-MM is provided
                    const fullDateStr = /^\d{4}-\d{2}$/.test(dateStr) ? `${dateStr}-01` : dateStr;
                    // Add month/day if only YYYY is provided
                    const finalDateStr = /^\d{4}$/.test(fullDateStr) ? `${fullDateStr}-01-01` : fullDateStr;
                    const date = new Date(finalDateStr);
                    // Check if the date is valid after parsing
                    if (isNaN(date.getTime())) {
                        console.warn(`Invalid date string encountered: ${dateStr}`);
                        return null; // Return null for invalid dates
                    }
                    return date;
                };

                const startDate = parseDate(startDateStr);
                const endDate = parseDate(endDateStr);

                if (!startDate) return ""; // Cannot format without a start date

                const formatMonthYear = (date) => date ? `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][date.getUTCMonth()]} ${date.getUTCFullYear()}` : "";

                const startFormatted = formatMonthYear(startDate);
                const endFormatted = endDate ? formatMonthYear(endDate) : "Present";

                return `${startFormatted}${endDate || endDateStr?.toLowerCase() === 'present' ? ` – ${endFormatted}` : (startDate ? " – Present" : "")}`; // Use en dash '–'
            } catch (e) {
                console.error("Error formatting date range:", e);
                // Fallback to original strings if formatting fails
                return `${startDateStr || ''}${endDateStr ? ` – ${endDateStr}` : (startDateStr ? ' – Present' : '')}`;
            }
        };

        // --- Validate Inputs ---
        if (!params.resume_id) throw new Error("Resume ID (resume_id) is required");
        if (!params.operation) throw new Error("Operation (operation) is required");

        const validOperations = ["add", "remove"];
        if (!validOperations.includes(params.operation)) {
            throw new Error(`Invalid operation '${params.operation}'. Must be one of: ${validOperations.join(', ')}`);
        }

        // Build section data
        let sectionData = { items: [] };

        if (params.operation === "add") {
            if (!params.organization) throw new Error("organization is required for adding a volunteer entry");
            if (!params.position) throw new Error("position is required for adding a volunteer entry");
            
            // Create a date string if not provided directly
            let dateString = params.date || "";
            if (!dateString && (params.startDate || params.endDate)) {
                dateString = formatDateRange(params.startDate, params.endDate);
            }

            const volunteerItem = {
                id: generateCuid2(), // Use Cuid2-like generator
                visible: params.visible !== false,
                organization: params.organization,
                position: params.position,
                location: params.location || "", // Add location field even if empty
                date: dateString,
                summary: `<p>${params.summary || ""}</p>`, // Ensure summary exists, wrap in <p>
                url: { // Always include URL object
                    label: params.url_label || "",
                    href: params.url_href || ""
                }
            };

            sectionData.items.push(volunteerItem);
        } else if (params.operation === "remove") {
            if (!params.item_id) throw new Error("item_id is required for remove operation");
            sectionData.items.push({ id: params.item_id });
        }

        const authParams = params.auth || {};
        const email = (params.email && params.email.trim()) ? params.email.trim() : 
                     (authParams.email && authParams.email.trim()) ? authParams.email.trim() : DEFAULT_RX_EMAIL;
        const password = (params.password && params.password.trim()) ? params.password.trim() : 
                        (authParams.password && authParams.password.trim()) ? authParams.password.trim() : DEFAULT_RX_PASSWORD;
        const baseUrl = (params.base_url && params.base_url.trim()) ? params.base_url.trim() : 
                       (authParams.base_url && authParams.base_url.trim()) ? authParams.base_url.trim() : DEFAULT_RX_BASE_URL;

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
        // Verify fetched ID matches requested ID
        if (currentResume.id !== params.resume_id) {
            throw new Error(`Fetched resume ID (${currentResume.id}) does not match requested ID (${params.resume_id}).`);
        }

        // Get the current volunteer section or initialize if it doesn't exist
        let volunteerSection = currentResume.data?.sections?.volunteer;
        if (!volunteerSection) {
            volunteerSection = {
                name: "Volunteering",
                id: "volunteer",
                visible: true,
                columns: 1,
                separateLinks: true,
                items: []
            };
        } else {
            // Deep clone to avoid modifying the original
            volunteerSection = deepClone(volunteerSection);
            if (!volunteerSection.items) {
                volunteerSection.items = []; // Ensure items array exists
            }
        }

        const inputItems = sectionData.items; // These are the items to add/remove

        // --- Normalize ALL items (existing and new) before sending ---
        const normalizedItems = (volunteerSection.items || []).map(item => {
            // Ensure item is an object
            if (typeof item !== 'object' || item === null) return null; // Skip invalid items

            const normalizedItem = deepClone(item); // Clone to avoid modifying original

            // 1. Normalize Date: Ensure 'date' field exists
            normalizedItem.date = normalizedItem.date || "";

            // 2. Normalize Organization Field: Ensure 'organization' is used
            if (normalizedItem.name && !normalizedItem.organization) {
                normalizedItem.organization = normalizedItem.name;
                delete normalizedItem.name;
            }
            normalizedItem.organization = normalizedItem.organization || ""; // Ensure exists

            // 3. Normalize Summary: Ensure <p> tags and existence
            normalizedItem.summary = normalizedItem.summary || "";
            if (!normalizedItem.summary.includes("<p>")) {
                normalizedItem.summary = `<p>${normalizedItem.summary.replace(/<[^>]*>/g, '')}</p>`;
            }

            // 4. Normalize URL: Ensure 'url' object exists
            normalizedItem.url = normalizedItem.url || { label: "", href: "" };
            normalizedItem.url.label = normalizedItem.url.label || "";
            normalizedItem.url.href = normalizedItem.url.href || "";

            // 5. Ensure other required fields exist (based on schema)
            normalizedItem.visible = normalizedItem.visible !== undefined ? normalizedItem.visible : true;
            normalizedItem.position = normalizedItem.position || "";
            normalizedItem.location = normalizedItem.location || ""; // Add location field
            normalizedItem.id = normalizedItem.id || generateCuid2(); // Generate ID if missing

            return normalizedItem;
        }).filter(item => item !== null); // Remove any null items from failed processing

        volunteerSection.items = normalizedItems; // Assign the fully normalized array

        // --- Apply Add/Remove Operation ---
        if (params.operation === "add") {
            for (const volItem of inputItems) { // inputItems are already formatted correctly
                if (!volunteerSection.items.some(item => item.id === volItem.id)) {
                    volunteerSection.items.push(volItem);
                }
            }
        } else if (params.operation === "remove") {
            const removeIds = inputItems.map(item => item.id);
            const originalLength = volunteerSection.items.length;
            volunteerSection.items = volunteerSection.items.filter(item => !removeIds.includes(item.id));
            if (volunteerSection.items.length === originalLength) {
                console.warn(`Volunteer entry with ID '${removeIds[0]}' not found or already removed.`);
                // Return success if the item is already gone
                return {
                    message: `Volunteer entry with ID '${removeIds[0]}' already removed or not found.`,
                    resume_id: params.resume_id,
                    operation: params.operation,
                    timestamp: new Date().toISOString() // Use current time
                };
            }
        }

        // --- Step 4: Modify the Full Resume Object ---
        // Ensure the section object itself has all necessary properties before assigning back
        volunteerSection = {
            name: "Volunteering",
            id: "volunteer",
            visible: true,
            columns: 1,
            separateLinks: true,
            ...volunteerSection, // Keep existing properties like items
            items: volunteerSection.items, // Explicitly assign normalized items
        };

        currentResume.data.sections.volunteer = volunteerSection; // Put the modified section back

        // The patchPayload IS the entire modified currentResume object
        const patchPayload = currentResume;

        // --- Step 5: Update Resume ---
        try {
            // Send the *entire* modified resume object
            const updateResponse = await axiosInstance.patch(resumeUrl, patchPayload, { headers: requestHeaders });
            if (updateResponse.status !== 200) {
                console.error("Update failed. Response status:", updateResponse.status);
                console.error("Update failed. Response data:", updateResponse.data);
                throw new Error(`Failed to update resume: ${updateResponse.status}`);
            }

            return {
                message: `Volunteer entry ${params.operation === 'remove' ? 'removed' : 'added'} successfully.`,
                resume_id: updateResponse.data.id,
                operation: params.operation,
                timestamp: updateResponse.data.updatedAt
            };

        } catch (error) {
            throw new Error(`Failed to update resume ${params.resume_id}: ${error.response?.data?.message || error.message}`);
        }

    } catch (error) {
        console.error(`Error in updateVolunteer: ${error.message}`);
        return { 
            success: false,
            error: `Error: ${error.message}`,
            details: error.stack
        };
    }
}

// --- Tool Definition ---
export const updateVolunteerTool = {
    name: "update_volunteer",
    description: "Updates ('add', 'remove') volunteer experience in the volunteer section of an existing resume. Uses flat fields.",
    execute: updateVolunteer,
    inputSchema: {
        type: "object",
        properties: {
            resume_id: { type: "string", description: "ID of the resume to update" },
            operation: { type: "string", enum: ["add", "remove"], description: "Operation to perform" },
            organization: { type: "string", description: "Organization name" },
            position: { type: "string", description: "Volunteer position/role" },
            date: { type: "string", description: "Single date string in YYYY-MM format (alternative to startDate/endDate)" },
            startDate: { type: "string", description: "Start date in YYYY-MM format" },
            endDate: { type: "string", description: "End date in YYYY-MM format" },
            summary: { type: "string", description: "Description of volunteer work" },
            url_label: { type: "string", description: "URL label for organization website" },
            url_href: { type: "string", description: "URL for organization website" },
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
                then: { required: ["organization", "position"] }
            }
        ]
    }
};