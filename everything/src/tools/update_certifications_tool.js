import axios from 'axios';
import { wrapper as axiosCookiejarSupport } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

// Helper: Generate CUID2-like ID
function generateCuid2() {
    // Use crypto for better randomness if available, fallback to uuidv4 parts
    const randomPart = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID().replace(/-/g, '')
        : uuidv4().replace(/-/g, '');
    return `c${randomPart.substring(0, 23)}`; // Standard Cuid2 length is 24 starting with 'c'
}

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
 * Updates the certifications section of an existing resume in Reactive Resume.
 * Supports adding and removing certifications with flat fields.
 *
 * @param {object} params - Parameters object.
 * @param {string} params.resume_id - Required. The UUID of the resume to update.
 * @param {string} params.operation - Required. One of: "add", "remove".
 * @param {string} params.cert_name - Name of the certification (required for add).
 * @param {string} params.cert_issuer - Issuer of the certification (required for add).
 * @param {string} params.cert_date - Date of certification (required for add).
 * @param {string} params.cert_summary - Optional description or summary.
 * @param {boolean} params.visible - Optional. Default true.
 * @param {string} params.item_id - Required for remove operations.
 *
 * Examples:
 *
 * 1. Adding a certification:
 * ```javascript
 * {
 *   resume_id: "your-resume-id",
 *   operation: "add",
 *   cert_name: "AWS Solutions Architect",
 *   cert_issuer: "Amazon Web Services",
 *   cert_date: "2024-04"
 * }
 * ```
 *
 * 2. Removing a certification:
 * ```javascript
 * {
 *   resume_id: "your-resume-id",
 *   operation: "remove",
 *   item_id: "existing-certification-id"
 * }
 * ```
 *
 * @param {object} [params.auth] - Optional. Auth details (overrides env).
 * @returns {Promise<object>} - Promise resolving to result object or error object.
 */
export async function updateCertifications(params = {}) {
    const cookieJar = new CookieJar();
    const axiosInstance = axiosCookiejarSupport(axios.create({ jar: cookieJar }));

    try {
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
            if (!params.cert_name) throw new Error("cert_name is required for adding a certification");
            if (!params.cert_issuer) throw new Error("cert_issuer is required for adding a certification");
            if (!params.cert_date) throw new Error("cert_date is required for adding a certification");
            
            sectionData.items.push({
                id: generateCuid2(),
                visible: params.visible !== false,
                name: params.cert_name,
                issuer: params.cert_issuer,
                date: params.cert_date,
                summary: params.cert_summary || "",
                url: {
                    label: params.url_label || "",
                    href: params.url_href || ""
                }
            });
        } else if (params.operation === "remove") {
            if (!params.item_id) throw new Error("item_id is required for remove operation");
            sectionData.items.push({ id: params.item_id });
        }

        const authParams = params.auth || {};
        const email = (authParams.email && authParams.email.trim()) ? authParams.email.trim() : DEFAULT_RX_EMAIL;
        const password = (authParams.password && authParams.password.trim()) ? authParams.password.trim() : DEFAULT_RX_PASSWORD;
        const baseUrl = (authParams.base_url && authParams.base_url.trim()) ? authParams.base_url.trim() : DEFAULT_RX_BASE_URL;

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
        const updatePayload = deepClone(currentResume);
        if (!updatePayload.data) updatePayload.data = {};
        if (!updatePayload.data.sections) updatePayload.data.sections = {};
        const sections = updatePayload.data.sections;

        // Ensure the certifications section exists
        if (!sections.certifications) {
            sections.certifications = {
                name: "Certifications",
                id: "certifications",
                visible: true,
                items: []
            };
        }

        const currentItems = sections.certifications.items;
        const inputItems = sectionData.items;

        if (params.operation === "add") {
            // Process each certification item
            for (const certItem of inputItems) {
                currentItems.push(certItem);
            }
        } else if (params.operation === "remove") {
            const removeIds = inputItems.map(item => item.id);
            const originalLength = currentItems.length;
            sections.certifications.items = currentItems.filter(item => !removeIds.includes(item.id));
            if (sections.certifications.items.length === originalLength) {
                throw new Error(`Certification with ID '${removeIds[0]}' not found.`);
            }
        }

        // --- Step 4: Update Resume ---
        try {
            const updateResponse = await axiosInstance.patch(resumeUrl, updatePayload, { headers: requestHeaders });
            if (updateResponse.status !== 200) {
                throw new Error(`Failed to update resume: ${updateResponse.status}`);
            }

            return {
                message: `Certifications ${params.operation === 'remove' ? 'removed' : 'added'} successfully.`,
                resume_id: updateResponse.data.id,
                operation: params.operation,
                timestamp: updateResponse.data.updatedAt
            };

        } catch (error) {
            throw new Error(`Failed to update resume ${params.resume_id}: ${error.response?.data?.message || error.message}`);
        }

    } catch (error) {
        console.error(`Error in updateCertifications: ${error.message}`);
        return { error: `Error: ${error.message}` };
    }
}

// --- Tool Definition ---
export const updateCertificationsTool = {
    name: "update_certifications",
    description: "Updates ('add', 'remove') certifications in the certifications section of an existing resume. Uses flat fields.",
    execute: updateCertifications,
    inputSchema: {
        type: "object",
        properties: {
            resume_id: { type: "string", description: "ID of the resume to update" },
            operation: { type: "string", enum: ["add", "remove"], description: "Operation to perform" },
            cert_name: { type: "string", description: "Name of the certification" },
            cert_issuer: { type: "string", description: "Organization that issued the certification" },
            cert_date: { type: "string", description: "Date certification was obtained (YYYY or YYYY-MM)" },
            cert_summary: { type: "string", description: "Optional description of the certification" },
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
                then: { required: ["cert_name", "cert_issuer", "cert_date"] }
            }
        ]
    }
};