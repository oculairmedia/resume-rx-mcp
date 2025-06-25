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
 * Updates the languages section of an existing resume in Reactive Resume.
 * Supports adding and removing languages with flat fields.
 *
 * @param {object} params - Parameters object.
 * @param {string} params.resume_id - Required. The UUID of the resume to update.
 * @param {string} params.operation - Required. One of: "add", "remove".
 * @param {string} params.language - Name of the language (required for add).
 * @param {string} params.fluency - Optional fluency level (e.g., "Native", "Fluent", "Intermediate", "Basic").
 * @param {boolean} params.visible - Optional. Default true.
 * @param {string} params.item_id - Required for remove operations.
 *
 * @param {object} [params.auth] - Optional. Auth details (overrides env).
 * @returns {Promise<object>} - Promise resolving to result object or error object.
 */
export async function updateLanguages(params = {}) {
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
            if (!params.language) throw new Error("language is required for adding a language");
            
            // Map fluency string to level number
            const fluencyToLevel = {
                "Native": 5,
                "Fluent": 4,
                "Intermediate": 3,
                "Basic": 2,
                "Beginner": 1
            };
            
            const level = params.fluency && fluencyToLevel[params.fluency]
                ? fluencyToLevel[params.fluency]
                : 0;
            
            sectionData.items.push({
                id: generateCuid2(),
                visible: params.visible !== false,
                name: params.language,
                level: level,
                description: params.fluency || ""
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

        // Ensure the languages section exists
        if (!sections.languages) {
            sections.languages = {
                name: "Languages",
                id: "languages",
                visible: true,
                columns: 1,
                separateLinks: true,
                items: []
            };
        }

        const currentItems = sections.languages.items;
        const inputItems = sectionData.items;

        if (params.operation === "add") {
            // Process each language item
            for (const langItem of inputItems) {
                currentItems.push(langItem);
            }
        } else if (params.operation === "remove") {
            const removeIds = inputItems.map(item => item.id);
            const originalLength = currentItems.length;
            sections.languages.items = currentItems.filter(item => !removeIds.includes(item.id));
            if (sections.languages.items.length === originalLength) {
                throw new Error(`Language with ID '${removeIds[0]}' not found.`);
            }
        }

        // --- Step 4: Update Resume ---
        try {
            const updateResponse = await axiosInstance.patch(resumeUrl, updatePayload, { headers: requestHeaders });
            if (updateResponse.status !== 200) {
                throw new Error(`Failed to update resume: ${updateResponse.status}`);
            }

            return {
                success: true,
                message: `Language ${params.operation === 'remove' ? 'removed' : 'added'} successfully.`,
                resume_id: updateResponse.data.id,
                operation: params.operation,
                timestamp: updateResponse.data.updatedAt
            };

        } catch (error) {
            console.error(`Failed to update resume ${params.resume_id}:`, error);
            return {
                success: false,
                message: error.response?.data?.message || error.message
            };
        }

    } catch (error) {
        console.error(`Error in updateLanguages: ${error.message}`);
        return {
            success: false,
            message: error.message
        };
    }
}

// --- Tool Definition ---
export const updateLanguagesTool = {
    name: "update_languages",
    description: "Updates ('add', 'remove') languages in the languages section of an existing resume. Uses flat fields.",
    execute: updateLanguages,
    inputSchema: {
        type: "object",
        properties: {
            resume_id: { type: "string", description: "ID of the resume to update" },
            operation: { type: "string", enum: ["add", "remove"], description: "Operation to perform" },
            language: { type: "string", description: "Name of the language" },
            fluency: { type: "string", description: "Level of fluency" },
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
                then: { required: ["language"] }
            }
        ]
    }
};