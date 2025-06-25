import axios from 'axios';
import { wrapper as axiosCookiejarSupport } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

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
 * Test full CRUD operations on resumes
 *
 * @param {object} params - Parameters object
 * @param {boolean} [params.save_schema] - Whether to save the schema to a file
 * @param {boolean} [params.create_resume] - Whether to create a new resume
 * @param {boolean} [params.update_resume] - Whether to update the resume
 * @param {boolean} [params.delete_resume] - Whether to delete the resume at the end
 * @param {string} [params.resume_id] - Optional. The UUID of an existing resume to test with
 * @returns {Promise<object>} - Promise resolving to result object
 */
export async function testResumeCrud(params = {}) {
    // Create a cookie jar for this execution
    const cookieJar = new CookieJar();
    // Create an axios instance that uses the cookie jar
    const axiosInstance = axiosCookiejarSupport(axios.create({ jar: cookieJar }));

    // Results to return
    const results = {
        success: true,
        steps: [],
        resume_id: params.resume_id || null
    };

    try {
        // --- Step 1: Authentication ---
        const email = DEFAULT_RX_EMAIL;
        const password = DEFAULT_RX_PASSWORD;
        const baseUrl = DEFAULT_RX_BASE_URL;

        console.log(`Using authentication with email: ${email}`);
        console.log(`Using base URL: ${baseUrl}`);

        const authUrl = `${baseUrl}/auth/login`;
        const authPayload = { identifier: email, password: password };

        console.log(`Authenticating...`);
        const authResponse = await axiosInstance.post(authUrl, authPayload, {
            headers: { 'Content-Type': 'application/json' }
        });

        if (authResponse.status !== 200) {
            throw new Error(`Authentication failed with status code ${authResponse.status}`);
        }

        results.steps.push({
            step: "Authentication",
            success: true,
            message: "Successfully authenticated"
        });

        // --- Step 2: Get Resume Schema ---
        console.log(`Fetching resume schema...`);
        const schemaUrl = `${baseUrl}/resume/schema`;
        const schemaResponse = await axiosInstance.get(schemaUrl, {
            headers: { 'Content-Type': 'application/json' }
        });

        if (schemaResponse.status !== 200) {
            throw new Error(`Failed to get schema with status code ${schemaResponse.status}`);
        }

        const schema = schemaResponse.data;
        results.steps.push({
            step: "Get Schema",
            success: true,
            message: "Successfully retrieved schema",
            schema_size: JSON.stringify(schema).length
        });

        // Save schema to file if requested
        if (params.save_schema) {
            const schemaPath = path.resolve(__dirname, '../../../rx_resume_schema.json');
            fs.writeFileSync(schemaPath, JSON.stringify(schema, null, 2));
            console.log(`Schema saved to ${schemaPath}`);
            results.steps.push({
                step: "Save Schema",
                success: true,
                message: `Schema saved to ${schemaPath}`
            });
        }

        // --- Step 3: Create Resume (if requested) ---
        let resumeId = params.resume_id;

        if (params.create_resume && !resumeId) {
            console.log(`Creating a new resume...`);

            // Generate a unique slug with timestamp
            const timestamp = Date.now();
            const randomId = uuidv4().substring(0, 8);
            const slug = `test-resume-${randomId}-${timestamp}`;

            const createResumePayload = {
                title: "Test Resume for CRUD Operations",
                slug: slug,
                visibility: "private"
            };

            const createUrl = `${baseUrl}/resume`;
            const createResponse = await axiosInstance.post(createUrl, createResumePayload, {
                headers: { 'Content-Type': 'application/json' }
            });

            if (createResponse.status !== 201) {
                throw new Error(`Failed to create resume with status code ${createResponse.status}`);
            }

            resumeId = createResponse.data.id;
            results.resume_id = resumeId;

            results.steps.push({
                step: "Create Resume",
                success: true,
                message: `Successfully created resume with ID: ${resumeId}`,
                resume_id: resumeId,
                slug: slug
            });
        } else if (!resumeId) {
            throw new Error("No resume_id provided and create_resume is false");
        }

        // --- Step 4: Get Resume ---
        console.log(`Fetching resume with ID: ${resumeId}`);
        const getUrl = `${baseUrl}/resume/${resumeId}`;
        const getResponse = await axiosInstance.get(getUrl, {
            headers: { 'Content-Type': 'application/json' }
        });

        if (getResponse.status !== 200) {
            throw new Error(`Failed to get resume with status code ${getResponse.status}`);
        }

        const resumeData = getResponse.data;
        results.steps.push({
            step: "Get Resume",
            success: true,
            message: `Successfully retrieved resume with ID: ${resumeId}`,
            title: resumeData.title,
            slug: resumeData.slug
        });

        // --- Step 5: Update Resume (if requested) ---
        if (params.update_resume) {
            console.log(`Updating resume with ID: ${resumeId}`);

            // Create a deep copy of the current resume
            const updatePayload = JSON.parse(JSON.stringify(resumeData));

            // Ensure data and sections exist
            if (!updatePayload.data) updatePayload.data = {};
            if (!updatePayload.data.basics) updatePayload.data.basics = {};

            // Update basic information
            updatePayload.data.basics.name = "Test User";
            updatePayload.data.basics.email = "test@example.com";
            updatePayload.data.basics.summary = "This is a test summary for CRUD operations testing.";

            // Add a skill
            if (!updatePayload.data.sections) updatePayload.data.sections = {};
            if (!updatePayload.data.sections.skills) {
                updatePayload.data.sections.skills = {
                    name: "Skills",
                    id: "skills",
                    columns: 2,
                    visible: true,
                    items: []
                };
            }

            // Generate a simple ID
            const skillId = `clid${Date.now()}${Math.floor(Math.random() * 10000)}`;

            // Add a test skill
            updatePayload.data.sections.skills.items.push({
                id: skillId,
                name: "Test Skill",
                level: 3,
                keywords: ["testing", "automation"],
                description: "A test skill for CRUD operations",
                visible: true
            });

            // Update the resume
            const updateUrl = `${baseUrl}/resume/${resumeId}`;
            const updateResponse = await axiosInstance.patch(updateUrl, updatePayload, {
                headers: { 'Content-Type': 'application/json' }
            });

            if (updateResponse.status !== 200) {
                throw new Error(`Failed to update resume with status code ${updateResponse.status}`);
            }

            results.steps.push({
                step: "Update Resume",
                success: true,
                message: `Successfully updated resume with ID: ${resumeId}`,
                updated_fields: ["name", "email", "summary", "skills"]
            });

            // Verify the update
            console.log(`Verifying update for resume with ID: ${resumeId}`);
            const verifyResponse = await axiosInstance.get(getUrl, {
                headers: { 'Content-Type': 'application/json' }
            });

            if (verifyResponse.status !== 200) {
                throw new Error(`Failed to verify update with status code ${verifyResponse.status}`);
            }

            const verifiedData = verifyResponse.data;
            const verificationSuccess =
                verifiedData.data.basics.name === "Test User" &&
                verifiedData.data.basics.email === "test@example.com" &&
                verifiedData.data.sections.skills.items.some(skill => skill.name === "Test Skill");

            results.steps.push({
                step: "Verify Update",
                success: verificationSuccess,
                message: verificationSuccess
                    ? "Successfully verified update"
                    : "Failed to verify update - data mismatch"
            });
        }

        // --- Step 6: Delete Resume (if requested) ---
        if (params.delete_resume) {
            console.log(`Deleting resume with ID: ${resumeId}`);
            const deleteUrl = `${baseUrl}/resume/${resumeId}`;
            const deleteResponse = await axiosInstance.delete(deleteUrl, {
                headers: { 'Content-Type': 'application/json' }
            });

            if (deleteResponse.status !== 200) {
                throw new Error(`Failed to delete resume with status code ${deleteResponse.status}`);
            }

            results.steps.push({
                step: "Delete Resume",
                success: true,
                message: `Successfully deleted resume with ID: ${resumeId}`
            });

            // Verify deletion
            try {
                await axiosInstance.get(getUrl, {
                    headers: { 'Content-Type': 'application/json' }
                });

                // If we get here, the resume still exists
                results.steps.push({
                    step: "Verify Deletion",
                    success: false,
                    message: "Failed to verify deletion - resume still exists"
                });
            } catch (error) {
                if (error.response && error.response.status === 404) {
                    results.steps.push({
                        step: "Verify Deletion",
                        success: true,
                        message: "Successfully verified deletion - resume no longer exists"
                    });
                } else {
                    throw error;
                }
            }
        }

        return results;

    } catch (error) {
        console.error(`Error in testResumeCrud:`, error.message);

        // Enhanced error details
        if (error.response) {
            console.error(`Response status:`, error.response.status);
            console.error(`Response headers:`, JSON.stringify(error.response.headers, null, 2));
            console.error(`Response data:`, JSON.stringify(error.response.data, null, 2));
        }

        return {
            success: false,
            error: `Error: ${error.message}`,
            steps: results.steps,
            resume_id: results.resume_id
        };
    }
}

// --- Tool Definition ---
export const testResumeCrudTool = {
    name: "test_resume_crud",
    description: "Test full CRUD operations on resumes",
    execute: testResumeCrud,
    inputSchema: {
        type: "object",
        properties: {
            save_schema: {
                type: "boolean",
                description: "Whether to save the schema to a file (Optional, default: false)"
            },
            create_resume: {
                type: "boolean",
                description: "Whether to create a new resume (Optional, default: false)"
            },
            update_resume: {
                type: "boolean",
                description: "Whether to update the resume (Optional, default: false)"
            },
            delete_resume: {
                type: "boolean",
                description: "Whether to delete the resume at the end (Optional, default: false)"
            },
            resume_id: {
                type: "string",
                description: "The UUID of an existing resume to test with (Optional)"
            }
        }
    }
};
