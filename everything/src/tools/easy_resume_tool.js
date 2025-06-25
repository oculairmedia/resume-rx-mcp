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
const DEFAULT_RX_BASE_URL = process.env.RX_RESUME_BASE_URL || "https://resume.emmanuelu.com/api";
const DEFAULT_RX_PUBLIC_URL = process.env.RX_RESUME_PUBLIC_URL || "https://resume.emmanuelu.com";

/**
 * A simplified tool to update a resume with minimal input
 *
 * @param {object} params - Parameters object
 * @param {string} params.resume_id - Required. The UUID of the resume to update
 * @param {string} [params.name] - Optional. The name for the resume owner
 * @param {string} [params.email] - Optional. The email for the resume owner
 * @param {string} [params.phone] - Optional. The phone number for the resume owner
 * @param {string} [params.website] - Optional. The website URL for the resume owner
 * @param {string} [params.summary] - Optional. Professional summary
 * @param {string} [params.location] - Optional. Location (city, state, country)
 * @param {string|string[]} [params.skills] - Optional. Skills to add (string or array of strings)
 * @param {object} [params.profile] - Optional. Social profile to add/update
 * @param {string} [params.profile.network] - Network name (e.g., LinkedIn, GitHub)
 * @param {string} [params.profile.username] - Username on the network
 * @param {string} [params.profile.url] - Profile URL
 * @returns {Promise<object>} - Promise resolving to result object
 */
// Generate a simple ID
const generateId = () => {
    return `clid${Date.now()}${Math.floor(Math.random() * 10000)}`;
};

export async function easyResume(params = {}) {
    // Create a cookie jar for this execution
    const cookieJar = new CookieJar();
    // Create an axios instance that uses the cookie jar
    const axiosInstance = axiosCookiejarSupport(axios.create({ jar: cookieJar }));

    try {
        // --- Validate Inputs ---
        if (!params.resume_id) throw new Error("Resume ID (resume_id) is required");

        // --- Apply Defaults ---
        const resumeId = params.resume_id;

        console.log(`Updating resume ${resumeId}`);

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
        if (!updatePayload.data.basics) updatePayload.data.basics = {};

        // --- Update Basic Information ---
        let updatedFields = [];

        if (params.name) {
            updatePayload.data.basics.name = params.name;
            updatedFields.push("name");
        }

        if (params.email) {
            updatePayload.data.basics.email = params.email;
            updatedFields.push("email");
        }

        if (params.phone) {
            updatePayload.data.basics.phone = params.phone;
            updatedFields.push("phone");
        }

        if (params.website) {
            const website = params.website;
            updatePayload.data.basics.website = website.startsWith("http://") || website.startsWith("https://")
                ? website : `https://${website}`;
            updatedFields.push("website");
        }

        if (params.summary) {
            updatePayload.data.basics.summary = params.summary;
            updatedFields.push("summary");
        }

        if (params.location) {
            if (!updatePayload.data.basics.location) updatePayload.data.basics.location = {};
            updatePayload.data.basics.location.address = params.location;
            updatedFields.push("location");
        }

        // --- Update Skills ---
        if (params.skills) {
            if (!updatePayload.data.sections) updatePayload.data.sections = {};

            // Ensure skills section exists
            if (!updatePayload.data.sections.skills) {
                updatePayload.data.sections.skills = {
                    name: "Skills",
                    id: "skills",
                    columns: 2,
                    visible: true,
                    items: []
                };
            }

            // Convert single skill to array
            const skillsToAdd = Array.isArray(params.skills) ? params.skills : [params.skills];

            // Add each skill
            skillsToAdd.forEach(skillName => {
                // Skip if skill already exists
                const existingSkill = updatePayload.data.sections.skills.items.find(
                    item => item.name === skillName
                );

                if (!existingSkill) {
                    // Create new skill
                    const newSkill = {
                        id: generateId(),
                        name: skillName,
                        level: 0,
                        keywords: [],
                        visible: true
                    };

                    updatePayload.data.sections.skills.items.push(newSkill);
                    console.log(`Added skill: ${skillName}`);
                }
            });

            updatedFields.push("skills");
        }

        // --- Update Profile ---
        if (params.profile && params.profile.network) {
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

            // Use the generateId function

            // Determine the appropriate icon based on the network name
            let icon = "link"; // Default icon
            const networkLower = params.profile.network.toLowerCase();

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
            } else if (networkLower.includes("website") || networkLower.includes("web")) {
                icon = "link";
            }

            // Find existing profile or create a new one
            let existingProfile = updatePayload.data.sections.profiles.items.find(
                item => item.network === params.profile.network
            );

            if (!existingProfile) {
                // Create new profile
                existingProfile = {
                    id: generateId(),
                    network: params.profile.network,
                    username: params.profile.username || "",
                    icon: icon,
                    visible: true
                };
                updatePayload.data.sections.profiles.items.push(existingProfile);
            } else {
                // Update existing profile
                if (params.profile.username) existingProfile.username = params.profile.username;
                existingProfile.icon = existingProfile.icon || icon;
            }

            // Update URL
            if (params.profile.url) {
                const url = params.profile.url;
                const formattedUrl = url.startsWith("http://") || url.startsWith("https://")
                    ? url : `https://${url}`;

                existingProfile.url = {
                    label: params.profile.network,
                    href: formattedUrl
                };
            }

            updatedFields.push("profile");
            console.log(`Prepared profile:`, JSON.stringify(existingProfile, null, 2));
        }

        // Check if any fields were updated
        if (updatedFields.length === 0) {
            return {
                success: false,
                message: "No fields to update were provided",
                resume_id: resumeId
            };
        }

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
            message: `Resume updated successfully. Updated fields: ${updatedFields.join(", ")}`,
            id: updatedResume.id,
            title: updatedResume.title,
            slug: updatedResume.slug,
            public_url: publicUrl,
            updated_fields: updatedFields
        };

    } catch (error) {
        console.error(`Error in easyResume:`, error.message);

        // Enhanced error details
        if (error.response) {
            console.error(`Response status:`, error.response.status);
            console.error(`Response headers:`, JSON.stringify(error.response.headers, null, 2));
            console.error(`Response data:`, JSON.stringify(error.response.data, null, 2));

            // Log validation details if available
            if (error.response.data && error.response.data.errors) {
                console.error(`Validation errors:`, JSON.stringify(error.response.data.errors, null, 2));
            }
        }

        return {
            success: false,
            error: `Error: ${error.message}`
        };
    }
}

// --- Tool Definition ---
export const easyResumeTool = {
    name: "easy_resume",
    description: "A simplified tool to update a resume with minimal input",
    execute: easyResume,
    inputSchema: {
        type: "object",
        properties: {
            resume_id: {
                type: "string",
                description: "ID of the resume to update (Required)"
            },
            name: {
                type: "string",
                description: "Name of the resume owner (Optional)"
            },
            email: {
                type: "string",
                description: "Email of the resume owner (Optional)"
            },
            phone: {
                type: "string",
                description: "Phone number of the resume owner (Optional)"
            },
            website: {
                type: "string",
                description: "Website URL of the resume owner (Optional)"
            },
            summary: {
                type: "string",
                description: "Professional summary (Optional)"
            },
            location: {
                type: "string",
                description: "Location (city, state, country) (Optional)"
            },
            skills: {
                oneOf: [
                    { type: "string", description: "Single skill to add" },
                    {
                        type: "array",
                        description: "List of skills to add",
                        items: { type: "string" }
                    }
                ],
                description: "Skills to add (Optional)"
            },
            profile: {
                type: "object",
                description: "Social profile to add/update (Optional)",
                properties: {
                    network: {
                        type: "string",
                        description: "Network name (e.g., LinkedIn, GitHub, Website)"
                    },
                    username: {
                        type: "string",
                        description: "Username on the network"
                    },
                    url: {
                        type: "string",
                        description: "Profile URL"
                    }
                }
            }
        },
        required: ["resume_id"]
    }
};
