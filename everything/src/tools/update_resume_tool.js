import axios from 'axios';
import { wrapper as axiosCookiejarSupport } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { URL } from 'url'; // For parsing public URL base

// Load environment variables from .env file in the root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') }); // Go up three levels

// --- Configuration ---
const DEFAULT_RX_EMAIL = process.env.RX_RESUME_EMAIL || "emanuvaderland@gmail.com";
const DEFAULT_RX_PASSWORD = process.env.RX_RESUME_PASSWORD || "E4YSj9UiVuSB3uJ";
const DEFAULT_RX_BASE_URL = process.env.RX_RESUME_BASE_URL || "http://192.168.50.90:3050/api";
const DEFAULT_RX_PUBLIC_URL = process.env.RX_RESUME_PUBLIC_URL; // Optional env var for public base

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
 * Updates an existing resume in Reactive Resume, merging provided fields.
 *
 * @param {object} params - Parameters object containing updates.
 * @param {string} params.resume_id - Required. The UUID of the resume to update.
 * @param {string} [params.title] - Optional. New title for the resume.
 * @param {string} [params.slug] - Optional. New URL slug for the resume.
 * @param {string} [params.visibility] - Optional. New visibility ('public' or 'private').
 * @param {object} [params.basics] - Optional. Object with basic fields to update (e.g., name, headline).
 * @param {object} [params.sections] - Optional. Object with sections to update.
 *                                     - summary: { content: "..." }
 *                                     - skills/education/etc: { items: [{ id: "...", name: "..." }, { name: "New Item" }] }
 *                                       (Items with existing ID are updated, items without ID are added).
 * @param {object} [params.auth] - Optional. Auth details (overrides env).
 * @returns {Promise<object>} - Promise resolving to result object or error object.
 */
export async function updateResume(params = {}) {
    // Create a cookie jar for this execution
    const cookieJar = new CookieJar();
    // Create an axios instance that uses the cookie jar
    const axiosInstance = axiosCookiejarSupport(axios.create({ jar: cookieJar }));

    let sessionCookie = null;

    try {
        // --- Validate Inputs ---
        if (!params.resume_id) throw new Error("Resume ID (resume_id) is required");

        // --- Apply Defaults and Environment Variables ---
        const resumeId = params.resume_id;
        const authParams = params.auth || {};
        // Only use params if they are non-empty strings
        const email = (authParams.email && authParams.email.trim()) ? authParams.email.trim() : DEFAULT_RX_EMAIL;
        const password = (authParams.password && authParams.password.trim()) ? authParams.password.trim() : DEFAULT_RX_PASSWORD;
        const baseUrl = (authParams.base_url && authParams.base_url.trim()) ? authParams.base_url.trim() : DEFAULT_RX_BASE_URL;

        if (!email || !password || !baseUrl) {
            throw new Error("Missing required Reactive Resume authentication details (email, password, base_url).");
        }

        // Determine public base URL (for response)
        let publicBaseUrl = DEFAULT_RX_PUBLIC_URL;
        if (!publicBaseUrl) {
            try {
                const parsedApiUrl = new URL(baseUrl);
                publicBaseUrl = `${parsedApiUrl.protocol}//${parsedApiUrl.host}`;
            } catch (e) {
                 publicBaseUrl = baseUrl.replace("/api", ""); // Fallback
            }
        }

        // --- Step 1: Authenticate ---
        const authUrl = `${baseUrl}/auth/login`;
        const authPayload = { identifier: email, password: password };
        const authHeaders = { 'Content-Type': 'application/json' };

        let sessionCookie = null; // Keep for potential debugging/other headers
        try {
            // Use the axios instance with cookie jar support
            const authResponse = await axiosInstance.post(authUrl, authPayload, { headers: authHeaders });
            if (authResponse.status !== 200) throw new Error(`Authentication failed: ${authResponse.status}`);
            // Cookie jar handles cookies automatically
            if (process.env.DEBUG) console.log("Authentication successful, cookie jar updated.");
            // Optionally extract for debugging
            const cookies = authResponse.headers['set-cookie'];
             if (cookies) {
                 sessionCookie = cookies.find(cookie => cookie.startsWith('connect.sid='))?.split(';')[0];
             }
        } catch (error) {
            throw new Error(`Authentication failed: ${error.response?.data?.message || error.message}`);
        }

        // No need for manual cookie header, axiosInstance handles it
        const requestHeaders = {
            'Content-Type': 'application/json',
            ...(sessionCookie && { 'Cookie': sessionCookie })
        };

        // --- Step 2: Get Current Resume Data ---
        const resumeUrl = `${baseUrl}/resume/${resumeId}`;
        let currentResume;
        try {
            if (process.env.DEBUG) console.log(`Fetching current resume data from: ${resumeUrl}`);
            // Use the axios instance with cookie jar support
            const resumeResponse = await axiosInstance.get(resumeUrl, { headers: requestHeaders });
            if (resumeResponse.status !== 200) throw new Error(`Failed to get resume: ${resumeResponse.status}`);
            currentResume = resumeResponse.data;
        } catch (error) {
            throw new Error(`Failed to fetch current resume ${resumeId}: ${error.response?.data?.message || error.message}`);
        }

        // --- Step 3: Prepare Update Payload (Merge Updates onto Cloned Data) ---
        const updatePayload = deepClone(currentResume);

        // Update top-level fields if provided
        if (params.title !== undefined) updatePayload.title = params.title;
        if (params.slug !== undefined) updatePayload.slug = params.slug;
        if (params.visibility !== undefined) updatePayload.visibility = params.visibility;

        // Ensure 'data' exists
        if (!updatePayload.data) updatePayload.data = {};

        // Update basics if provided
        if (params.basics && typeof params.basics === 'object') {
            if (!updatePayload.data.basics) updatePayload.data.basics = {};

            // Handle special case for profiles in basics
            if (params.basics.profiles && Array.isArray(params.basics.profiles)) {
                // We need to move profiles from basics to the profiles section
                if (!updatePayload.data.sections.profiles) {
                    updatePayload.data.sections.profiles = {
                        name: "Profiles",
                        id: "profiles",
                        columns: 1,
                        separateLinks: true,
                        visible: true,
                        items: []
                    };
                }

                // Generate a valid CUID2-like ID
                const generateCuid2 = () => {
                    // Format: "clid" followed by 20 lowercase hexadecimal characters
                    const randomHex = Math.random().toString(16).substring(2, 10) +
                                     Math.random().toString(16).substring(2, 10) +
                                     Math.random().toString(16).substring(2, 4);
                    return `clid${randomHex.toLowerCase()}`;
                };

                // Clear existing profiles and add new ones
                updatePayload.data.sections.profiles.items = [];

                for (const profile of params.basics.profiles) {
                    const profileItem = {
                        id: generateCuid2(),
                        network: profile.network || "",
                        username: profile.username || "",
                        url: profile.url || "",
                        visible: true
                    };

                    // Convert url string to url object if needed
                    if (typeof profileItem.url === "string") {
                        profileItem.url = {
                            label: profile.network || "",
                            href: profileItem.url
                        };
                    }

                    updatePayload.data.sections.profiles.items.push(profileItem);
                }

                // Remove profiles from basics to avoid duplication
                const { profiles, ...restOfBasics } = params.basics;
                params.basics = restOfBasics;
            }

            // Update the rest of the basics fields
            updatePayload.data.basics = { ...updatePayload.data.basics, ...params.basics };
        }

        // Update sections if provided
        if (params.sections && typeof params.sections === 'object') {
            if (!updatePayload.data.sections) updatePayload.data.sections = {};
            const sectionsToUpdate = params.sections;
            const currentSections = updatePayload.data.sections;

            for (const sectionKey in sectionsToUpdate) {
                if (!Object.prototype.hasOwnProperty.call(sectionsToUpdate, sectionKey)) continue;

                const sectionUpdateData = sectionsToUpdate[sectionKey];
                if (!currentSections[sectionKey]) {
                    // Initialize section if it doesn't exist in current data
                     currentSections[sectionKey] = {
                         name: sectionKey.charAt(0).toUpperCase() + sectionKey.slice(1),
                         id: sectionKey,
                         visible: true,
                         ...(sectionKey !== 'summary' && { items: [] })
                     };
                     if (process.env.DEBUG) console.warn(`Section '${sectionKey}' did not exist, initialized it.`);
                }

                const currentSection = currentSections[sectionKey];

                // Handle summary update
                if (sectionKey === "summary" && sectionUpdateData.content !== undefined) {
                    currentSection.content = sectionUpdateData.content;
                    // Ensure other summary fields
                    currentSection.name = currentSection.name || "Summary";
                    currentSection.visible = currentSection.visible !== undefined ? currentSection.visible : true;
                    currentSection.columns = currentSection.columns || 1;
                }
                // Special handling for skills section with content
                else if (sectionKey === "skills" && sectionUpdateData.content !== undefined) {
                    // Store the content
                    currentSection.content = sectionUpdateData.content;

                    // Generate a valid CUID2-like ID
                    const generateCuid2 = () => {
                        // Format: "clid" followed by 20 lowercase hexadecimal characters
                        const randomHex = Math.random().toString(16).substring(2, 10) +
                                         Math.random().toString(16).substring(2, 10) +
                                         Math.random().toString(16).substring(2, 4);
                        return `clid${randomHex.toLowerCase()}`;
                    };

                    // If no items provided or empty array, try to parse content into items
                    if (!sectionUpdateData.items || !Array.isArray(sectionUpdateData.items) || sectionUpdateData.items.length === 0) {
                        // Parse the content as a list of skills
                        const skillLines = sectionUpdateData.content.split('\n').map(line => line.trim());
                        const skillItems = [];

                        for (const line of skillLines) {
                            if (line) {
                                // Remove bullet points and other common list markers
                                let skillName = line.replace(/^[•\-\*\>\◦\‣\⁃\⦿\⦾\⁌\⁍\⟡\⟐\⧫\⬝\⬦\⬧\⬨]+\s*/, '').trim();

                                if (skillName) {
                                    skillItems.push({
                                        id: generateCuid2(),
                                        name: skillName,
                                        level: 3, // Default level
                                        keywords: [],
                                        description: "",
                                        visible: true
                                    });
                                }
                            }
                        }

                        // Replace existing items with our parsed items
                        if (skillItems.length > 0) {
                            currentSection.items = skillItems;
                        }
                    }

                    // Ensure other fields
                    currentSection.name = currentSection.name || "Skills";
                    currentSection.visible = currentSection.visible !== undefined ? currentSection.visible : true;
                    currentSection.columns = currentSection.columns || 2;
                }
                // Special handling for work/experience section with content
                else if ((sectionKey === "work" || sectionKey === "experience") && sectionUpdateData.content !== undefined) {
                    // Store the content
                    currentSection.content = sectionUpdateData.content;

                    // Generate a valid CUID2-like ID
                    const generateCuid2 = () => {
                        // Format: "clid" followed by 20 lowercase hexadecimal characters
                        const randomHex = Math.random().toString(16).substring(2, 10) +
                                         Math.random().toString(16).substring(2, 10) +
                                         Math.random().toString(16).substring(2, 4);
                        return `clid${randomHex.toLowerCase()}`;
                    };

                    // Ensure other fields
                    currentSection.name = currentSection.name || (sectionKey === "work" ? "Work Experience" : "Experience");
                    currentSection.visible = currentSection.visible !== undefined ? currentSection.visible : true;
                    currentSection.columns = currentSection.columns || 1;
                }
                // Special handling for education section with content
                else if (sectionKey === "education" && sectionUpdateData.content !== undefined) {
                    // Store the content
                    currentSection.content = sectionUpdateData.content;

                    // Ensure other fields
                    currentSection.name = currentSection.name || "Education";
                    currentSection.visible = currentSection.visible !== undefined ? currentSection.visible : true;
                    currentSection.columns = currentSection.columns || 1;
                }
                // Special handling for basics section with content
                else if (sectionKey === "basics" && sectionUpdateData.content !== undefined) {
                    // Store the content in a special field
                    currentSection.content = sectionUpdateData.content;

                    // Ensure other fields
                    currentSection.name = currentSection.name || "Contact";
                    currentSection.visible = currentSection.visible !== undefined ? currentSection.visible : true;
                }
                // Handle item-based sections update/add
                else if (sectionUpdateData.items && Array.isArray(sectionUpdateData.items)) {
                    if (!currentSection.items || !Array.isArray(currentSection.items)) {
                        currentSection.items = []; // Initialize if missing
                    }
                    const existingItemsMap = new Map(currentSection.items.map(item => [item.id, item]));

                    for (const itemUpdate of sectionUpdateData.items) {
                        if (itemUpdate.id && existingItemsMap.has(itemUpdate.id)) {
                            // Update existing item
                            const existingItem = existingItemsMap.get(itemUpdate.id);
                            Object.assign(existingItem, itemUpdate); // Merge updates
                        } else {
                            // Add new item (generate ID, ensure defaults)
                            const newItem = { ...itemUpdate };

                            // Generate a valid CUID2-like ID
                            const generateCuid2 = () => {
                                // Format: "clid" followed by 20 lowercase hexadecimal characters
                                const randomHex = Math.random().toString(16).substring(2, 10) +
                                                 Math.random().toString(16).substring(2, 10) +
                                                 Math.random().toString(16).substring(2, 4);
                                return `clid${randomHex.toLowerCase()}`;
                            };

                            // Always generate a new ID
                            newItem.id = generateCuid2();
                            newItem.visible = newItem.visible !== undefined ? newItem.visible : true;

                            // Handle special case for skills if it's a string
                            if (sectionKey === "skills" && typeof itemUpdate === "string") {
                                // Convert string to proper skill object
                                Object.assign(newItem, {
                                    name: itemUpdate,
                                    level: 3, // Default level
                                    keywords: [],
                                    description: ""
                                });
                            }
                            // Handle special case for languages if level is a string
                            else if (sectionKey === "languages" && itemUpdate.level && typeof itemUpdate.level === "string") {
                                // Convert string level to numeric level
                                let numericLevel = 3; // Default level
                                const levelMap = {
                                    "native": 5,
                                    "fluent": 4,
                                    "proficient": 3,
                                    "intermediate": 2,
                                    "basic": 1
                                };

                                const levelLower = itemUpdate.level.toLowerCase();
                                if (levelMap[levelLower] !== undefined) {
                                    numericLevel = levelMap[levelLower];
                                }

                                newItem.level = numericLevel;
                            }
                            // Handle special case for experience with title/organization instead of position/company
                            else if (sectionKey === "experience") {
                                // Map title to position if position is not provided
                                if (itemUpdate.title && !itemUpdate.position) {
                                    newItem.position = itemUpdate.title;
                                    delete newItem.title;
                                }

                                // Map organization to company if company is not provided
                                if (itemUpdate.organization && !itemUpdate.company) {
                                    newItem.company = itemUpdate.organization;
                                    delete newItem.organization;
                                }

                                // Combine startDate and endDate into date if date is not provided
                                if ((itemUpdate.startDate || itemUpdate.endDate) && !itemUpdate.date) {
                                    const startDate = itemUpdate.startDate || "";
                                    const endDate = itemUpdate.endDate || "Present";
                                    newItem.date = `${startDate} - ${endDate}`;
                                    delete newItem.startDate;
                                    delete newItem.endDate;
                                }
                            }

                            // Add section-specific defaults if needed
                            if (sectionKey === "skills") {
                                newItem.name = newItem.name || "";
                                newItem.description = newItem.description || "";
                                newItem.level = newItem.level !== undefined ? newItem.level : 0;
                                newItem.keywords = newItem.keywords || [];
                            } else if (sectionKey === "education") {
                                newItem.institution = newItem.institution || "";
                                newItem.degree = newItem.degree || "";
                                newItem.area = newItem.area || "";
                                newItem.score = newItem.score || "";
                                newItem.date = newItem.date || "";
                                newItem.summary = newItem.summary || "";
                                newItem.studyType = newItem.studyType || "Full-time";

                                // Handle URL format
                                if (typeof newItem.url === "string") {
                                    let href = newItem.url;
                                    if (!href.startsWith("http://") && !href.startsWith("https://")) {
                                        href = "https://" + href;
                                    }
                                    newItem.url = { label: "", href: href };
                                } else {
                                    newItem.url = newItem.url || { label: "", href: "" };
                                }
                            } else if (sectionKey === "experience") {
                                newItem.company = newItem.company || "";
                                newItem.position = newItem.position || "";
                                newItem.summary = newItem.summary || "";
                                newItem.date = newItem.date || "";
                                newItem.location = newItem.location || "";

                                // Handle URL format
                                if (typeof newItem.url === "string") {
                                    let href = newItem.url;
                                    if (!href.startsWith("http://") && !href.startsWith("https://")) {
                                        href = "https://" + href;
                                    }
                                    newItem.url = { label: "", href: href };
                                } else {
                                    newItem.url = newItem.url || { label: "", href: "" };
                                }
                            } else if (sectionKey === "languages") {
                                newItem.name = newItem.name || "";
                                newItem.level = newItem.level !== undefined ? newItem.level : 0;
                            } else if (sectionKey === "projects") {
                                newItem.name = newItem.name || "";
                                newItem.description = newItem.description || "";
                                newItem.date = newItem.date || "";
                                newItem.summary = newItem.summary || "";

                                // Handle URL format
                                if (typeof newItem.url === "string") {
                                    let href = newItem.url;
                                    if (!href.startsWith("http://") && !href.startsWith("https://")) {
                                        href = "https://" + href;
                                    }
                                    newItem.url = { label: "", href: href };
                                } else {
                                    newItem.url = newItem.url || { label: "", href: "" };
                                }
                            } else if (sectionKey === "certifications") {
                                newItem.name = newItem.name || "";
                                newItem.issuer = newItem.issuer || "";
                                newItem.date = newItem.date || "";
                                newItem.summary = newItem.summary || "";

                                // Handle URL format
                                if (typeof newItem.url === "string") {
                                    let href = newItem.url;
                                    if (!href.startsWith("http://") && !href.startsWith("https://")) {
                                        href = "https://" + href;
                                    }
                                    newItem.url = { label: "", href: href };
                                } else {
                                    newItem.url = newItem.url || { label: "", href: "" };
                                }
                            } else if (sectionKey === "profiles") {
                                newItem.network = newItem.network || "";
                                newItem.username = newItem.username || "";

                                // Handle URL format
                                if (typeof newItem.url === "string") {
                                    let href = newItem.url;
                                    if (!href.startsWith("http://") && !href.startsWith("https://")) {
                                        href = "https://" + href;
                                    }
                                    newItem.url = { label: newItem.network || "", href: href };
                                } else {
                                    newItem.url = newItem.url || { label: "", href: "" };
                                }
                            }
                            currentSection.items.push(newItem);
                        }
                    }
                    // Update the items array with potentially modified/new items
                    // (If using Map, reconstruct array - direct modification is fine here)
                    // currentSection.items = Array.from(existingItemsMap.values()); // If map was used for updates
                }
            }
        }

        // --- Step 4: Update Resume via PATCH ---
        if (process.env.DEBUG) console.log(`Updating resume ${resumeId} with merged data...`);
        // Use the axios instance with cookie jar support for the PATCH request
        try {
            // Always log the update payload for debugging
            console.log("Updating resume with payload:", JSON.stringify(updatePayload, null, 2));

            const updateResponse = await axiosInstance.patch(resumeUrl, updatePayload, { headers: requestHeaders });
            if (updateResponse.status !== 200) {
                throw new Error(`Failed to update resume: ${updateResponse.status}. Response: ${JSON.stringify(updateResponse.data)}`);
            }

            const updatedResume = updateResponse.data;

            // --- Step 5: Format Success Response ---
            const publicUrl = updatedResume.visibility === "public" && updatedResume.slug
                ? `${publicBaseUrl}/r/${updatedResume.slug}`
                : null;

            return {
                message: `Resume updated: ${updatedResume.title}`,
                id: updatedResume.id,
                title: updatedResume.title,
                slug: updatedResume.slug,
                visibility: updatedResume.visibility,
                public_url: publicUrl,
                timestamp: updatedResume.updatedAt
            };

        } catch (error) {
            // Enhanced error handling with more details
            const status = error.response?.status;
            const message = error.response?.data?.message || error.message;
            const details = error.response?.data?.details || [];

            // Always log the full error response for debugging
            console.error("Update error response:", JSON.stringify(error.response?.data, null, 2));
            console.error("Update error status:", status);
            console.error("Update error message:", message);

            // Create a detailed error message
            let errorMessage = `Failed to PATCH resume ${resumeId}${status ? ` with status ${status}` : ''}: ${message}`;

            // Add validation details if available
            if (details && details.length > 0) {
                errorMessage += `\nValidation errors:\n${details.map(d => `- ${d.path}: ${d.message}`).join('\n')}`;
                console.error("Validation details:", JSON.stringify(details, null, 2));
            }

            // Log the full error object
            console.error("Full error object:", JSON.stringify(error, null, 2));

            throw new Error(errorMessage);
        }

    } catch (error) {
        console.error(`Error in updateResume: ${error.message}`);
        return { error: `Error: ${error.message}` };
    }
}

// --- Tool Definition ---
export const updateResumeTool = {
    name: "update_resume",
    description: "Updates an existing resume by merging provided fields (title, slug, visibility, basics, sections). Items in sections are updated if 'id' exists, otherwise added.",
    execute: updateResume,
    inputSchema: {
        type: "object",
        properties: {
            resume_id: { type: "string", description: "ID of the resume to update (Required)" },
            title: { type: "string", description: "New title (Optional)" },
            slug: { type: "string", description: "New URL slug (Optional)" },
            visibility: { type: "string", enum: ["public", "private"], description: "New visibility (Optional)" },
            basics: { type: "object", description: "Object with basic fields to update (Optional)" },
            sections: {
                type: "object",
                description: "Object with sections to update. Items with ID update existing, others add. (Optional)",
                additionalProperties: { // Allows any section key (skills, education, etc.)
                    type: "object",
                    properties: {
                        content: { type: "string", description: "Content for summary section" },
                        items: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    id: { type: "string", description: "ID of item to update (omit for new items)" }
                                },
                                additionalProperties: true // Allow other item fields
                            }
                        }
                    }
                }
            },
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
        required: ["resume_id"]
    }
};

// --- Example Usage (for testing) ---
async function runTest() {
     const isMain = import.meta.url.endsWith(path.basename(process.argv[1])) ||
                   import.meta.url.endsWith(path.basename(process.argv[1]) + '.js') ||
                   process.argv[1] === fileURLToPath(import.meta.url);

    if (isMain) {
        console.log("Running updateResume test...");
        // --- !! Replace with a REAL resume ID from your instance !! ---
        const testResumeId = process.env.TEST_RESUME_ID || "replace-with-real-resume-id";
        // --- !! ----------------------------------------------- !! ---

        if (testResumeId === "replace-with-real-resume-id") {
             console.warn("Skipping test: TEST_RESUME_ID environment variable or default value is not set to a real ID.");
             return;
        }

        try {
            // Test 1: Update title and add/update a skill
            console.log("\n--- Test 1: Update Title & Skill ---");
            let testParams = {
                resume_id: testResumeId,
                title: `JS Updated Title ${new Date().getSeconds()}`,
                visibility: "public", // Ensure public for URL check
                sections: {
                    skills: {
                        items: [
                            // Assuming a skill named 'TypeScript' might exist from previous test run
                            // If it exists, update its level. If not, it will be added.
                            { name: "TypeScript", level: 5, description: "Updated via updateResume" },
                            // Add a new skill
                            { name: "Docker", level: 3, description: "Containerization" }
                        ]
                    }
                }
            };
            let result = await updateResume(testParams);
            console.log(JSON.stringify(result, null, 2));
            if (result.error) throw new Error("Test 1 Failed");

            // Test 2: Update basics
             console.log("\n--- Test 2: Update Basics ---");
             testParams = {
                 resume_id: testResumeId,
                 basics: {
                     headline: "Senior JS Test Engineer",
                     phone: "123-456-7890"
                 }
             };
             result = await updateResume(testParams);
             console.log(JSON.stringify(result, null, 2));
             if (result.error) throw new Error("Test 2 Failed");


             console.log("\n--- All Tests Passed ---");

        } catch (error) {
            console.error("\n--- Update Resume Test Failed ---");
            console.error(error.message);
        }
    }
}

runTest();