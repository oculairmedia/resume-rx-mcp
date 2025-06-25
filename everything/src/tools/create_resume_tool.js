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
dotenv.config({ path: path.resolve(__dirname, '../../../.env') }); // Go up three levels to the project root

/**
 * Creates a new resume in Reactive Resume via API.
 *
 * Internally, this function uses a two-stage process to ensure all data is properly saved:
 * 1. Create a basic resume with minimal information (title, slug, visibility)
 * 2. Update the resume with detailed content (basics, sections, etc.)
 *
 * This two-stage approach is transparent to the caller and ensures compatibility with
 * the RX Resume API's schema requirements.
 *
 * @param {object} params - Object containing resume details.
 * @param {string} params.title - Required. The title of the resume.
 * @param {string} [params.slug] - Optional. URL slug for the resume. Generated if not provided.
 * @param {string} [params.visibility] - Optional. Resume visibility ("public" or "private"). Defaults to "private".
 * @param {object} [params.basics] - Optional. Basic resume information.
 * @param {string} [params.basics.name] - Full name of the resume owner.
 * @param {string} [params.basics.headline] - Professional headline/title.
 * @param {string} [params.basics.email] - Contact email address.
 * @param {string} [params.basics.phone] - Contact phone number.
 * @param {string} [params.basics.location] - Location (city, country, etc.).
 * @param {object} [params.basics.url] - Personal website or portfolio.
 * @param {string} [params.basics.url.label] - Label for the URL (e.g., "Portfolio").
 * @param {string} [params.basics.url.href] - The actual URL (e.g., "https://example.com").
 *
 * @param {object} [params.sections] - Optional. Resume sections.
 * @param {object} [params.sections.summary] - Summary section.
 * @param {string} [params.sections.summary.content] - Summary text content.
 *
 * @param {object} [params.sections.skills] - Skills section.
 * @param {Array} [params.sections.skills.items] - Array of skill items.
 * @param {string} [params.sections.skills.items[].name] - Skill name.
 * @param {number} [params.sections.skills.items[].level] - Skill level (0-5).
 * @param {Array<string>} [params.sections.skills.items[].keywords] - Keywords related to the skill.
 * @param {string} [params.sections.skills.items[].description] - Description of the skill.
 *
 * @param {object} [params.sections.education] - Education section.
 * @param {Array} [params.sections.education.items] - Array of education items.
 * @param {string} [params.sections.education.items[].institution] - Name of the institution.
 * @param {string} [params.sections.education.items[].degree] - Degree obtained.
 * @param {string} [params.sections.education.items[].area] - Field of study.
 * @param {string} [params.sections.education.items[].score] - GPA or other score.
 * @param {string} [params.sections.education.items[].date] - Date range (e.g., "2018 - 2022").
 * @param {string} [params.sections.education.items[].studyType] - Type of study (e.g., "Full-time").
 * @param {string} [params.sections.education.items[].summary] - Additional details about the education.
 *
 * @param {object} [params.sections.experience] - Experience section.
 * @param {Array} [params.sections.experience.items] - Array of experience items.
 * @param {string} [params.sections.experience.items[].company] - Company name.
 * @param {string} [params.sections.experience.items[].position] - Job title/position.
 * @param {string} [params.sections.experience.items[].location] - Job location.
 * @param {string} [params.sections.experience.items[].date] - Date range (e.g., "2020 - Present").
 * @param {string} [params.sections.experience.items[].summary] - Job description and achievements.
 *
 * @param {object} [params.sections.certifications] - Certifications section.
 * @param {Array} [params.sections.certifications.items] - Array of certification items.
 * @param {string} [params.sections.certifications.items[].name] - Certification name.
 * @param {string} [params.sections.certifications.items[].issuer] - Issuing organization.
 * @param {string} [params.sections.certifications.items[].date] - Date obtained.
 * @param {string} [params.sections.certifications.items[].summary] - Additional details.
 *
 * @param {object} [params.sections.projects] - Projects section.
 * @param {Array} [params.sections.projects.items] - Array of project items.
 * @param {string} [params.sections.projects.items[].name] - Project name.
 * @param {string} [params.sections.projects.items[].description] - Project description.
 * @param {string} [params.sections.projects.items[].date] - Date range.
 * @param {string} [params.sections.projects.items[].summary] - Additional details.
 *
 * @param {object} [params.auth] - Optional. Authentication details. Uses env vars if not provided.
 * @param {string} [params.auth.email] - Email for authentication. Overrides RX_RESUME_EMAIL env var.
 * @param {string} [params.auth.password] - Password for authentication. Overrides RX_RESUME_PASSWORD env var.
 * @param {string} [params.auth.base_url] - Base URL for the API. Overrides RX_RESUME_BASE_URL env var.
 *
 * @returns {Promise<object>} - Promise resolving to an object with the following properties:
 *   - message {string}: Success message
 *   - id {string}: The ID of the created resume
 *   - title {string}: The title of the resume
 *   - slug {string}: The URL slug of the resume
 *   - public_url {string}: The public URL of the resume (if visibility is "public")
 *   - error {string}: Error message (only present if an error occurred)
 */
async function createResume(params = {}) {
    // Create a cookie jar for this execution
    const cookieJar = new CookieJar();
    // Create an axios instance that uses the cookie jar
    const axiosInstance = axiosCookiejarSupport(axios.create({ jar: cookieJar }));
    try {
        // Validate required parameters
        if (!params.title) {
            throw new Error("Resume title is required");
        }

        // Configuration from params or environment variables
        const authParams = params.auth || {};
        // Only use params if they are non-empty strings
        const EMAIL = (authParams.email && authParams.email.trim()) ? authParams.email.trim() : (process.env.RX_RESUME_EMAIL || "emanuvaderland@gmail.com");
        const PASSWORD = (authParams.password && authParams.password.trim()) ? authParams.password.trim() : (process.env.RX_RESUME_PASSWORD || "E4YSj9UiVuSB3uJ");
        const BASE_URL = (authParams.base_url && authParams.base_url.trim()) ? authParams.base_url.trim() : (process.env.RX_RESUME_BASE_URL || "http://192.168.50.90:3050/api");
        const PUBLIC_BASE_URL = process.env.RX_RESUME_PUBLIC_URL || "http://192.168.50.90:3000"; // For constructing public URL

        if (!EMAIL || !PASSWORD || !BASE_URL) {
            throw new Error("Missing required authentication environment variables (RX_RESUME_EMAIL, RX_RESUME_PASSWORD, RX_RESUME_BASE_URL) or auth parameters.");
        }

        // Step 1: Authenticate
        const authUrl = `${BASE_URL}/auth/login`;
        const authPayload = { identifier: EMAIL, password: PASSWORD };
        const authHeaders = { 'Content-Type': 'application/json' };

        let sessionCookie = null; // Keep this variable, might be useful for debugging or specific headers if needed later, though jar handles main auth
        try {
            // Use the axios instance with cookie jar support
            const authResponse = await axiosInstance.post(authUrl, authPayload, { headers: authHeaders });
            if (authResponse.status !== 200) {
                throw new Error(`Authentication failed with status code ${authResponse.status}`);
            }
            // Cookie jar handles cookies automatically
            if (process.env.DEBUG) console.log("Authentication successful, cookie jar updated.");
            // Optionally try to extract for debugging/other uses if needed
            const cookies = authResponse.headers['set-cookie'];
            if (cookies && process.env.DEBUG) {
                sessionCookie = cookies.find(cookie => cookie.startsWith('connect.sid='))?.split(';')[0];
            }

        } catch (error) {
            const status = error.response?.status;
            const message = error.response?.data?.message || error.message;
            throw new Error(`Authentication failed${status ? ` with status ${status}` : ''}: ${message}`);
        }

        // Step 2: Create a basic resume (Stage 1)
        // Use debug level logging that won't clutter normal operation
        if (process.env.DEBUG) console.log("Stage 1: Creating basic resume with minimal information...");
        const basicResumeData = {
            title: params.title,
            slug: params.slug || `resume-${uuidv4().substring(0, 8)}`,
            visibility: params.visibility || "private"
        };

        const createUrl = `${BASE_URL}/resume`;
        const createHeaders = {
            'Content-Type': 'application/json'
        };

        let createdResumeId;
        let createdResumeSlug;

        try {
            // Log the basic resume data for debugging if DEBUG is enabled
            if (process.env.DEBUG) {
                console.log("Creating basic resume with data:", JSON.stringify(basicResumeData, null, 2));
            }

            // Use the axios instance with cookie jar support
            const createResponse = await axiosInstance.post(createUrl, basicResumeData, { headers: createHeaders });

            if (createResponse.status !== 201) {
                throw new Error(`Failed to create basic resume with status code ${createResponse.status}. Response: ${JSON.stringify(createResponse.data)}`);
            }

            const createdResume = createResponse.data;
            createdResumeId = createdResume.id;
            createdResumeSlug = createdResume.slug;

            if (process.env.DEBUG) console.log(`Basic resume created successfully with ID: ${createdResumeId}`);
        } catch (error) {
            // Enhanced error handling with more details
            const status = error.response?.status;
            const message = error.response?.data?.message || error.message;
            const details = error.response?.data?.details || [];

            // Create a detailed error message
            let errorMessage = `Resume creation (Stage 1) failed${status ? ` with status ${status}` : ''}: ${message}`;

            // Add validation details if available
            if (details && details.length > 0) {
                errorMessage += `\nValidation errors:\n${details.map(d => `- ${d.path}: ${d.message}`).join('\n')}`;
            }

            // Log the full error object if DEBUG is enabled
            if (process.env.DEBUG) {
                console.error("Creation error details:", error.response?.data);
            }

            throw new Error(errorMessage);
        }

        // Step 3: Get the current resume data
        if (process.env.DEBUG) console.log("Getting current resume data for update...");
        const getResumeUrl = `${BASE_URL}/resume/${createdResumeId}`;

        let currentResumeData;
        try {
            const getResponse = await axiosInstance.get(getResumeUrl);

            if (getResponse.status !== 200) {
                throw new Error(`Failed to get resume data with status code ${getResponse.status}`);
            }

            currentResumeData = getResponse.data;
        } catch (error) {
            const status = error.response?.status;
            const message = error.response?.data?.message || error.message;
            throw new Error(`Failed to get resume data${status ? ` with status ${status}` : ''}: ${message}`);
        }

        // Step 4: Prepare update data (Stage 2)
        if (process.env.DEBUG) console.log("Stage 2: Updating resume with detailed information...");

        // Create a deep copy of the current resume data to avoid reference issues
        const updateData = JSON.parse(JSON.stringify(currentResumeData));

        // Helper function to generate valid CUID2-like IDs
        const generateCuid2 = () => {
            // Generate a random string that looks like a CUID2
            // Format: "clid" followed by 20 lowercase hexadecimal characters
            const randomHex = uuidv4().replace(/-/g, '').toLowerCase().substring(0, 20);
            return `clid${randomHex}`;
        };

        // Update basics if provided
        if (params.basics) {
            // Handle special case for profiles in basics
            if (params.basics.profiles && Array.isArray(params.basics.profiles)) {
                // We need to move profiles from basics to the profiles section
                if (!updateData.data.sections.profiles) {
                    updateData.data.sections.profiles = {
                        name: "Profiles",
                        columns: 1,
                        separateLinks: true,
                        visible: true,
                        id: "profiles",
                        items: []
                    };
                }

                // Clear existing profiles and add new ones
                updateData.data.sections.profiles.items = [];

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

                    updateData.data.sections.profiles.items.push(profileItem);
                }

                // Remove profiles from basics to avoid duplication
                delete params.basics.profiles;
            }

            // Update the rest of the basics fields
            for (const key in params.basics) {
                updateData.data.basics[key] = params.basics[key];
            }
        }

        // Update sections if provided
        if (params.sections) {
            for (const sectionKey in params.sections) {
                if (updateData.data.sections[sectionKey]) {
                    const sourceSection = params.sections[sectionKey];
                    const targetSection = updateData.data.sections[sectionKey];

                    // Handle summary section (content only)
                    if (sectionKey === "summary" && sourceSection.content !== undefined) {
                        targetSection.content = sourceSection.content;
                    }
                    // Handle sections with items arrays
                    else if (sourceSection.items && Array.isArray(sourceSection.items) && targetSection.items) {
                        // Clear existing items and add new ones with proper IDs
                        targetSection.items = [];

                        // Process each item based on section type
                        for (const item of sourceSection.items) {
                            const newItem = { ...item };

                            // Ensure each item has a valid CUID2-like ID
                            newItem.id = generateCuid2();
                            newItem.visible = item.visible !== undefined ? item.visible : true;

                            // Handle special case for skills if it's an array of strings
                            if (sectionKey === "skills" && Array.isArray(item)) {
                                // Convert string to proper skill object
                                newItem = {
                                    id: generateCuid2(),
                                    name: item,
                                    level: 3, // Default level
                                    keywords: [],
                                    description: "",
                                    visible: true
                                };
                            }
                            // Handle special case for skills if it's a string
                            else if (sectionKey === "skills" && typeof item === "string") {
                                // Convert string to proper skill object
                                newItem = {
                                    id: generateCuid2(),
                                    name: item,
                                    level: 3, // Default level
                                    keywords: [],
                                    description: "",
                                    visible: true
                                };
                            }
                            // Handle special case for languages if level is a string
                            else if (sectionKey === "languages" && item.level && typeof item.level === "string") {
                                // Convert string level to numeric level
                                let numericLevel = 3; // Default level
                                const levelMap = {
                                    "native": 5,
                                    "fluent": 4,
                                    "proficient": 3,
                                    "intermediate": 2,
                                    "basic": 1
                                };

                                const levelLower = item.level.toLowerCase();
                                if (levelMap[levelLower] !== undefined) {
                                    numericLevel = levelMap[levelLower];
                                }

                                newItem.level = numericLevel;
                            }
                            // Handle special case for experience with title/organization instead of position/company
                            else if (sectionKey === "experience") {
                                // Map title to position if position is not provided
                                if (item.title && !item.position) {
                                    newItem.position = item.title;
                                }

                                // Map organization to company if company is not provided
                                if (item.organization && !item.company) {
                                    newItem.company = item.organization;
                                }

                                // Combine startDate and endDate into date if date is not provided
                                if ((item.startDate || item.endDate) && !item.date) {
                                    const startDate = item.startDate || "";
                                    const endDate = item.endDate || "Present";
                                    newItem.date = `${startDate} - ${endDate}`;
                                }
                            }
                            // Handle special case for projects with description/date
                            else if (sectionKey === "projects") {
                                // Ensure description is set
                                if (item.description) {
                                    newItem.description = item.description;
                                } else if (item.summary) {
                                    newItem.description = item.summary;
                                }
                            }

                            // Add section-specific required fields
                            if (sectionKey === "skills") {
                                newItem.name = newItem.name || item.name || "";
                                newItem.level = newItem.level !== undefined ? newItem.level : (item.level || 0);
                                newItem.keywords = newItem.keywords || item.keywords || [];
                                newItem.description = newItem.description || item.description || "";
                            } else if (sectionKey === "education") {
                                newItem.institution = item.institution || "";
                                newItem.degree = item.degree || "";
                                newItem.area = item.area || "";
                                newItem.score = item.score || "";
                                newItem.date = item.date || "";
                                newItem.studyType = item.studyType || "Full-time";
                                newItem.summary = item.summary || "";
                                newItem.url = item.url || { label: "", href: "" };
                            } else if (sectionKey === "experience") {
                                newItem.company = newItem.company || item.company || "";
                                newItem.position = newItem.position || item.position || "";
                                newItem.location = item.location || "";
                                newItem.date = newItem.date || item.date || "";
                                newItem.summary = item.summary || "";
                                newItem.url = item.url || { label: "", href: "" };
                            } else if (sectionKey === "certifications") {
                                newItem.name = item.name || "";
                                newItem.issuer = item.issuer || "";
                                newItem.date = item.date || "";
                                newItem.url = item.url || { label: "", href: "" };
                                newItem.summary = item.summary || "";
                            } else if (sectionKey === "projects") {
                                newItem.name = item.name || "";
                                newItem.description = newItem.description || item.description || "";
                                newItem.date = item.date || "";
                                newItem.url = item.url || { label: "", href: "" };
                                newItem.summary = item.summary || "";
                            } else if (sectionKey === "languages") {
                                newItem.name = item.name || "";
                                newItem.level = newItem.level !== undefined ? newItem.level : (item.level || 0);
                                // No additional fields needed for languages
                            } else if (sectionKey === "interests") {
                                newItem.name = item.name || "";
                                newItem.keywords = item.keywords || [];
                            } else if (sectionKey === "awards") {
                                newItem.title = item.title || "";
                                newItem.awarder = item.awarder || "";
                                newItem.date = item.date || "";
                                newItem.summary = item.summary || "";
                                newItem.url = item.url || { label: "", href: "" };
                            } else if (sectionKey === "publications") {
                                newItem.name = item.name || "";
                                newItem.publisher = item.publisher || "";
                                newItem.date = item.date || "";
                                newItem.summary = item.summary || "";
                                newItem.url = item.url || { label: "", href: "" };
                            } else if (sectionKey === "volunteer") {
                                newItem.organization = item.organization || "";
                                newItem.position = item.position || "";
                                newItem.location = item.location || "";
                                newItem.date = item.date || "";
                                newItem.summary = item.summary || "";
                                newItem.url = item.url || { label: "", href: "" };
                            } else if (sectionKey === "references") {
                                newItem.name = item.name || "";
                                newItem.relationship = item.relationship || "";
                                newItem.summary = item.summary || "";
                                newItem.url = item.url || { label: "", href: "" };
                            } else if (sectionKey === "profiles") {
                                newItem.network = item.network || "";
                                newItem.username = item.username || "";
                                newItem.url = item.url || { label: "", href: "" };
                            }

                            targetSection.items.push(newItem);
                        }
                    }
                }
                // Add new sections if they don't exist in the current data
                else if (params.sections[sectionKey]) {
                    updateData.data.sections[sectionKey] = params.sections[sectionKey];
                }
            }
        }

        // Step 5: Update the resume with detailed information
        const updateUrl = `${BASE_URL}/resume/${createdResumeId}`;
        const updateHeaders = {
            'Content-Type': 'application/json'
        };

        try {
            // Log the update data for debugging if DEBUG is enabled
            if (process.env.DEBUG) {
                console.log("Updating resume with data:", JSON.stringify(updateData, null, 2));
            }

            const updateResponse = await axiosInstance.patch(updateUrl, updateData, { headers: updateHeaders });

            if (updateResponse.status !== 200) {
                throw new Error(`Failed to update resume with status code ${updateResponse.status}. Response: ${JSON.stringify(updateResponse.data)}`);
            }

            const updatedResume = updateResponse.data;

            // Format the response
            return {
                message: `Resume created and updated: ${updatedResume.title}`,
                id: updatedResume.id,
                title: updatedResume.title,
                slug: updatedResume.slug,
                visibility: updatedResume.visibility,
                public_url: updatedResume.visibility === "public" ? `${PUBLIC_BASE_URL}/r/${updatedResume.slug}` : null
            };
        } catch (error) {
            // Enhanced error handling with more details
            const status = error.response?.status;
            const message = error.response?.data?.message || error.message;
            const details = error.response?.data?.details || [];

            // Create a detailed error message
            let errorMessage = `Resume update (Stage 2) failed${status ? ` with status ${status}` : ''}: ${message}`;

            // Add validation details if available
            if (details && details.length > 0) {
                errorMessage += `\nValidation errors:\n${details.map(d => `- ${d.path}: ${d.message}`).join('\n')}`;
            }

            // Log the full error object if DEBUG is enabled
            if (process.env.DEBUG) {
                console.error("Update error details:", error.response?.data);
            }

            throw new Error(errorMessage);
        }

    } catch (error) {
        console.error("Error in createResume:", error);
        return { error: `Error: ${error.message}` }; // Return error object
    }
}

// Tool definition for registration
const createResumeTool = {
    name: "create_resume",
    description: "Create a new resume in Reactive Resume with comprehensive information. Requires 'title'. Optional parameters include 'slug', 'visibility', 'basics' (personal information), and 'sections' (skills, education, experience, etc.). Authentication uses RX_RESUME_EMAIL, RX_RESUME_PASSWORD, RX_RESUME_BASE_URL environment variables by default, which can be overridden with the 'auth' parameter.",
    execute: createResume,
    // Define input schema for validation and documentation
    inputSchema: {
        type: "object",
        properties: {
            title: {
                type: "string",
                description: "Resume Title (Required)"
            },
            slug: {
                type: "string",
                description: "URL slug for the resume (Optional, auto-generated if not provided)"
            },
            visibility: {
                type: "string",
                enum: ["private", "public"],
                description: "Resume visibility - 'private' (default) or 'public'"
            },
            basics: {
                type: "object",
                description: "Basic personal information including name, headline, email, phone, location, and URL",
                properties: {
                    name: { type: "string", description: "Full name" },
                    headline: { type: "string", description: "Professional headline/title" },
                    email: { type: "string", description: "Contact email address" },
                    phone: { type: "string", description: "Contact phone number" },
                    location: { type: "string", description: "Location (city, country)" },
                    url: {
                        type: "object",
                        description: "Personal website or portfolio",
                        properties: {
                            label: { type: "string", description: "Label for the URL (e.g., 'Portfolio')" },
                            href: { type: "string", description: "The actual URL (e.g., 'https://example.com')" }
                        }
                    }
                }
            },
            sections: {
                type: "object",
                description: "Resume sections including summary, skills, education, experience, certifications, and projects",
                properties: {
                    summary: {
                        type: "object",
                        description: "Professional summary section",
                        properties: {
                            content: { type: "string", description: "Summary text content" }
                        }
                    },
                    skills: {
                        type: "object",
                        description: "Skills section",
                        properties: {
                            items: {
                                type: "array",
                                description: "Array of skill items",
                                items: {
                                    type: "object",
                                    properties: {
                                        name: { type: "string", description: "Skill name" },
                                        level: { type: "number", description: "Skill level (0-5)" },
                                        keywords: { type: "array", items: { type: "string" }, description: "Keywords related to the skill" },
                                        description: { type: "string", description: "Description of the skill" }
                                    }
                                }
                            }
                        }
                    },
                    education: {
                        type: "object",
                        description: "Education section",
                        properties: {
                            items: {
                                type: "array",
                                description: "Array of education items",
                                items: {
                                    type: "object",
                                    properties: {
                                        institution: { type: "string", description: "Name of the institution" },
                                        degree: { type: "string", description: "Degree obtained" },
                                        area: { type: "string", description: "Field of study" },
                                        score: { type: "string", description: "GPA or other score" },
                                        date: { type: "string", description: "Date range (e.g., '2018 - 2022')" },
                                        studyType: { type: "string", description: "Type of study (e.g., 'Full-time')" },
                                        summary: { type: "string", description: "Additional details about the education" }
                                    }
                                }
                            }
                        }
                    },
                    experience: {
                        type: "object",
                        description: "Work experience section",
                        properties: {
                            items: {
                                type: "array",
                                description: "Array of experience items",
                                items: {
                                    type: "object",
                                    properties: {
                                        company: { type: "string", description: "Company name" },
                                        position: { type: "string", description: "Job title/position" },
                                        location: { type: "string", description: "Job location" },
                                        date: { type: "string", description: "Date range (e.g., '2020 - Present')" },
                                        summary: { type: "string", description: "Job description and achievements" }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            auth: {
                type: "object",
                properties: {
                    email: { type: "string", description: "Email for authentication (overrides RX_RESUME_EMAIL env var)" },
                    password: { type: "string", description: "Password for authentication (overrides RX_RESUME_PASSWORD env var)" },
                    base_url: { type: "string", description: "Base URL for the API (overrides RX_RESUME_BASE_URL env var)" }
                },
                description: "Authentication details (optional, overrides environment variables)"
            }
        },
        required: ["title"]
    }
};

// Export the tool definition and the function
export { createResumeTool, createResume };

// Example usage (for testing)
// Example usage (for testing) - Keep using async IIFE
// Note: require.main === module check doesn't work directly with ES modules in the same way.
// This block will run if the script is executed directly (e.g., `node create_resume_tool.js`)
// For simplicity in this context, we'll assume direct execution implies testing.
// A more robust check might involve command-line arguments.
(async () => {
    // Check if the script is the main module being run.
    // This is a common pattern, but might need adjustment depending on execution context.
    // We'll assume direct execution means testing for this example.
    const isMain = import.meta.url.endsWith(path.basename(process.argv[1])) ||
                   import.meta.url.endsWith(path.basename(process.argv[1]) + '.js') || // Handle cases with/without extension
                   process.argv[1] === fileURLToPath(import.meta.url);

    if (isMain) {
        const testParams = {
            title: "JS Test Resume " + new Date().toISOString(),
            visibility: "private",
            basics: {
                name: "Jane JS Doe",
                headline: "JavaScript Developer",
                email: "jane.js@example.com",
                phone: "+1 (555) 123-4567",
                location: "San Francisco, CA",
                url: {
                    label: "Portfolio",
                    href: "https://janedoe.dev"
                },
                // Test profiles handling
                profiles: [
                    {
                        network: "LinkedIn",
                        username: "janedoe",
                        url: "https://linkedin.com/in/janedoe"
                    },
                    {
                        network: "GitHub",
                        username: "janedoe",
                        url: "https://github.com/janedoe"
                    }
                ]
            },
            sections: {
                summary: {
                    content: "Experienced JavaScript developer with expertise in React, Node.js, and modern web technologies. Passionate about creating user-friendly applications and solving complex problems."
                },
                // Test different formats of skills
                skills: {
                    items: [
                        { name: "Node.js", level: 4, keywords: ["Express", "NestJS"] },
                        { name: "React", level: 5, keywords: ["Redux", "Next.js"] },
                        "TypeScript",  // String format
                        "GraphQL"      // String format
                    ]
                },
                // Test education with all required fields
                education: {
                    items: [
                        {
                            institution: "University of California, Berkeley",
                            degree: "Master of Science",
                            area: "Computer Science",
                            date: "2018 - 2020",
                            studyType: "Full-time",
                            score: "3.9 GPA",
                            summary: "Focus on web technologies and distributed systems"
                        }
                    ]
                },
                // Test experience with title/organization format
                experience: {
                    items: [
                        {
                            title: "Senior Frontend Developer",  // Using title instead of position
                            organization: "Tech Innovations Inc.",  // Using organization instead of company
                            startDate: "2020-01",  // Using startDate/endDate instead of date
                            endDate: "Present",
                            location: "San Francisco, CA",
                            summary: "Lead frontend development for enterprise SaaS products. Implemented component library and design system."
                        },
                        {
                            company: "Digital Solutions",  // Using standard company field
                            position: "Frontend Developer",  // Using standard position field
                            date: "2018 - 2020",  // Using standard date field
                            location: "San Francisco, CA",
                            summary: "Developed responsive web applications using React and TypeScript."
                        }
                    ]
                },
                // Test languages with string levels
                languages: {
                    items: [
                        { name: "English", level: "Native" },  // String level
                        { name: "Spanish", level: "Fluent" },  // String level
                        { name: "French", level: 3 }           // Numeric level
                    ]
                },
                // Test projects
                projects: {
                    items: [
                        {
                            name: "Personal Portfolio",
                            description: "Responsive portfolio website built with Next.js and Tailwind CSS",
                            date: "2022",
                            summary: "Implemented animations and dark mode"
                        }
                    ]
                }
            }
            // auth: { // Optionally override env vars here
            //     email: "...",
            //     password: "...",
            //     base_url: "..."
            // }
        };
        try {
            console.log("Running test execution...");
            const result = await createResume(testParams);
            console.log("Resume Creation Result:");
            console.log(JSON.stringify(result, null, 2));
        } catch (error) {
            console.error("Resume Creation Failed:");
            console.error(error);
        }
    }
})();