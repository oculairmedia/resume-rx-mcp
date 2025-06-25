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
 * Updates the projects section of an existing resume in Reactive Resume.
 * Supports adding and removing projects with flat fields.
 *
 * @param {object} params - Parameters object.
 * @param {string} params.resume_id - Required. The UUID of the resume to update.
 * @param {string} params.operation - Required. One of: "add", "remove".
 * @param {string} params.name - Project name (required for add).
 * @param {string} params.description - Optional project description.
 * @param {string} params.date - Project date (required for add if startDate not provided).
 * @param {string} params.startDate - Project start date (required for add if date not provided).
 * @param {string} params.endDate - Optional project end date.
 * @param {string} params.summary - Optional project summary.
 * @param {string} params.keywords - Optional comma-separated list of project keywords.
 * @param {string} params.url_label - Optional URL label.
 * @param {string} params.url_href - Optional URL href.
 * @param {boolean} params.visible - Optional. Default true.
 * @param {string} params.item_id - Required for remove operations.
 *
 * Examples:
 *
 * 1. Adding a project:
 * ```javascript
 * {
 *   resume_id: "your-resume-id",
 *   operation: "add",
 *   name: "E-commerce Platform",
 *   description: "Built a modern e-commerce platform",
 *   date: "2023-01 - 2023-06",
 *   keywords: "React, Node.js, MongoDB"
 * }
 * ```
 *
 * 2. Removing a project:
 * ```javascript
 * {
 *   resume_id: "your-resume-id",
 *   operation: "remove",
 *   item_id: "existing-project-id"
 * }
 * ```
 *
 * @param {object} [params.auth] - Optional. Auth details (overrides env).
 * @returns {Promise<object>} - Promise resolving to result object or error object.
 */
export async function updateProjects(params = {}) {
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
            if (!params.name) throw new Error("name is required for adding a project");
            if (!params.date && !params.startDate) throw new Error("Either date or startDate is required for adding a project");

            const projectItem = {
                visible: params.visible !== false,
                name: params.name,
                description: params.description || "",
                date: params.date || "",
                startDate: params.startDate || "",
                endDate: params.endDate || "",
                summary: params.summary || "",
                keywords: params.keywords ? params.keywords.split(',').map(k => k.trim()) : []
            };

            // Handle URL if provided
            if (params.url_label || params.url_href) {
                projectItem.url = {
                    label: params.url_label || "",
                    href: params.url_href || ""
                };
            }

            sectionData.items.push(projectItem);
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

        // Ensure the projects section exists
        if (!sections.projects) {
            sections.projects = {
                name: "Projects",
                id: "projects",
                visible: true,
                items: []
            };
        }

        const currentItems = sections.projects.items;
        const inputItems = sectionData.items;

        if (params.operation === "add") {
            // Process each project item
            for (const projectItem of inputItems) {
                currentItems.push(projectItem);
            }
        } else if (params.operation === "remove") {
            const removeIds = inputItems.map(item => item.id);
            const originalLength = currentItems.length;
            sections.projects.items = currentItems.filter(item => !removeIds.includes(item.id));
            if (sections.projects.items.length === originalLength) {
                throw new Error(`Project with ID '${removeIds[0]}' not found.`);
            }
        }

        // --- Step 4: Update Resume ---
        try {
            const updateResponse = await axiosInstance.patch(resumeUrl, updatePayload, { headers: requestHeaders });
            if (updateResponse.status !== 200) {
                throw new Error(`Failed to update resume: ${updateResponse.status}`);
            }

            return {
                message: `Project ${params.operation === 'remove' ? 'removed' : 'added'} successfully.`,
                resume_id: updateResponse.data.id,
                operation: params.operation,
                timestamp: updateResponse.data.updatedAt
            };

        } catch (error) {
            throw new Error(`Failed to update resume ${params.resume_id}: ${error.response?.data?.message || error.message}`);
        }

    } catch (error) {
        console.error(`Error in updateProjects: ${error.message}`);
        return { error: `Error: ${error.message}` };
    }
}

// --- Tool Definition ---
export const updateProjectsTool = {
    name: "update_projects",
    description: "Updates ('add', 'remove') projects in the projects section of an existing resume. Uses flat fields.",
    execute: updateProjects,
    inputSchema: {
        type: "object",
        properties: {
            resume_id: { type: "string", description: "ID of the resume to update" },
            operation: { type: "string", enum: ["add", "remove"], description: "Operation to perform" },
            name: { type: "string", description: "Project name" },
            description: { type: "string", description: "Project description" },
            date: { type: "string", description: "Project date (e.g., '2023-01 - 2023-06')" },
            startDate: { type: "string", description: "Project start date (YYYY-MM-DD)" },
            endDate: { type: "string", description: "Project end date (YYYY-MM-DD)" },
            summary: { type: "string", description: "Project summary or details" },
            keywords: { type: "string", description: "Comma-separated list of project keywords/technologies" },
            url_label: { type: "string", description: "URL label (e.g., 'Project Website')" },
            url_href: { type: "string", description: "URL href (e.g., 'https://project.com')" },
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
                then: { required: ["name"], anyOf: [{ required: ["date"] }, { required: ["startDate"] }] }
            }
        ]
    }
};