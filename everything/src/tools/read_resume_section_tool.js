 import axios from 'axios';
import { wrapper as axiosCookiejarSupport } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env file in the root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// --- Configuration ---
const DEFAULT_RX_EMAIL = process.env.RX_RESUME_EMAIL || "emanuvaderland@gmail.com";
const DEFAULT_RX_PASSWORD = process.env.RX_RESUME_PASSWORD || "E4YSj9UiVuSB3uJ";
const DEFAULT_RX_BASE_URL = process.env.RX_RESUME_BASE_URL || "http://192.168.50.90:3050/api";

/**
 * Reads a specific section from a resume with minimal but informative content.
 *
 * @param {object} params - Parameters object.
 * @param {string} params.resume_id - Required. The UUID of the resume.
 * @param {string} params.section_name - Required. The name of the section to read (e.g., 'education', 'experience').
 * @param {string} [params.email] - Optional. Reactive Resume email (overrides env).
 * @param {string} [params.password] - Optional. Reactive Resume password (overrides env).
 * @param {string} [params.base_url] - Optional. Reactive Resume API base URL (overrides env).
 * @returns {Promise<object>} - Promise resolving to the section summary or an error object.
 */
// Maximum number of retries for API calls
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

/**
 * Sleep function for retry delays
 * @param {number} ms - Milliseconds to sleep
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Retry wrapper for API calls
 * @param {Function} fn - Async function to retry
 * @param {number} retries - Number of retries remaining
 * @param {number} delay - Delay between retries in ms
 */
async function withRetry(fn, retries = MAX_RETRIES, delay = RETRY_DELAY) {
    try {
        return await fn();
    } catch (error) {
        if (retries === 0) throw error;
        console.log(`Retrying... (${retries} attempts remaining)`);
        await sleep(delay);
        return withRetry(fn, retries - 1, delay * 1.5);
    }
}

export async function readResumeSection(params = {}) {
    const cookieJar = new CookieJar();
    const axiosInstance = axiosCookiejarSupport(axios.create({
        jar: cookieJar,
        timeout: 5000 // 5 second timeout
    }));

    try {
        // Validate required parameters
        if (!params.resume_id) {
            throw new Error("Resume ID (resume_id) is required");
        }
        if (!params.section_name) {
            throw new Error("Section name (section_name) is required");
        }

        // Apply defaults
        const resumeId = params.resume_id;
        const sectionName = params.section_name.toLowerCase();
        const email = params.email || DEFAULT_RX_EMAIL;
        const password = params.password || DEFAULT_RX_PASSWORD;
        const baseUrl = params.base_url || DEFAULT_RX_BASE_URL;

        if (!email || !password || !baseUrl) {
            throw new Error("Missing required authentication details in params or environment variables.");
        }

        // Authenticate with retry
        const authUrl = `${baseUrl}/auth/login`;
        const authResponse = await withRetry(async () => {
            const response = await axiosInstance.post(authUrl, {
                identifier: email,
                password: password
            });
            if (response.status !== 200) {
                throw new Error(`Authentication failed with status ${response.status}`);
            }
            return response;
        });

        if (authResponse.status !== 200) {
            throw new Error(`Authentication failed with status code ${authResponse.status}`);
        }

        // Get resume with retry
        const resumeUrl = `${baseUrl}/resume/${resumeId}`;
        const resumeResponse = await withRetry(async () => {
            const response = await axiosInstance.get(resumeUrl);
            if (response.status !== 200) {
                throw new Error(`Failed to get resume with status ${response.status}`);
            }
            return response;
        });

        if (resumeResponse.status !== 200) {
            throw new Error(`Failed to get resume with status code ${resumeResponse.status}`);
        }

        const resume = resumeResponse.data;
        const section = resume.data.sections[sectionName];

        if (!section) {
            return { error: `Section '${sectionName}' not found in resume` };
        }

        // Create a minimal summary based on section type
        let summary;
        switch (sectionName) {
            case 'summary':
                summary = {
                    type: 'text',
                    content: section.content ? section.content.substring(0, 150) + '...' : ''
                };
                break;

            case 'experience':
            case 'education':
            case 'certifications':
            case 'projects':
                summary = {
                    type: 'list',
                    count: section.items.length,
                    items: section.items.map(item => {
                        // Return all fields for complete information
                        const itemData = {
                            id: item.id,
                            visible: item.visible,
                            name: item.name || item.company || item.institution || '',
                            date: item.date || '',
                            summary: item.summary || '',
                            url: item.url || { label: '', href: '' }
                        };

                        // Add section-specific fields
                        if (sectionName === 'experience') {
                            itemData.position = item.position;
                            itemData.location = item.location;
                        }
                        if (sectionName === 'education') {
                            itemData.degree = item.degree;
                            itemData.area = item.area;
                            itemData.score = item.score;
                            itemData.studyType = item.studyType;
                        }
                        if (sectionName === 'certifications') {
                            itemData.issuer = item.issuer;
                        }
                        if (sectionName === 'projects') {
                            itemData.description = item.description;
                            itemData.keywords = item.keywords;
                        }
                        return itemData;
                    })
                };
                break;

            case 'skills':
                summary = {
                    type: 'list',
                    count: section.items.length,
                    items: section.items.map(item => ({
                        id: item.id,
                        visible: item.visible,
                        name: item.name,
                        level: item.level,
                        description: item.description,
                        keywords: item.keywords
                    }))
                };
                break;

            default:
                if (section.items) {
                    summary = {
                        type: 'list',
                        count: section.items.length,
                        items: section.items.map(item => ({
                            id: item.id,
                            visible: item.visible,
                            name: item.name || '',
                            date: item.date || '',
                            summary: item.summary || '',
                            url: item.url || { label: '', href: '' }
                        }))
                    };
                } else {
                    summary = {
                        type: 'unknown',
                        hasContent: Boolean(section.content),
                        itemCount: section.items?.length || 0
                    };
                }
        }

        return {
            success: true,
            section_name: sectionName,
            visible: section.visible,
            summary,
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error(`Error in readResumeSection: ${error.message}`);
        return {
            success: false,
            error: `Error: ${error.message}`,
            timestamp: new Date().toISOString(),
            retryable: error.message.includes('timeout') || error.message.includes('network')
        };
    }
}

// --- Tool Definition ---
export const readResumeSectionTool = {
    name: "read_resume_section",
    description: "Read a specific section from a resume with minimal but informative content. Returns a condensed view of the section.",
    execute: readResumeSection,
    inputSchema: {
        type: "object",
        properties: {
            resume_id: { type: "string", description: "ID of the resume to read from (Required)" },
            section_name: { type: "string", description: "Name of the section to read (e.g., 'education', 'experience') (Required)" },
            email: { type: "string", description: "Reactive Resume email (Optional, overrides env)" },
            password: { type: "string", description: "Reactive Resume password (Optional, overrides env)" },
            base_url: { type: "string", description: "Reactive Resume API URL (Optional, overrides env)" }
        },
        required: ["resume_id", "section_name"]
    }
};

// Test function
async function runTest() {
    const isMain = import.meta.url.endsWith(path.basename(process.argv[1])) ||
                  import.meta.url.endsWith(path.basename(process.argv[1]) + '.js') ||
                  process.argv[1] === fileURLToPath(import.meta.url);

    if (isMain) {
        console.log("Running readResumeSection test...");
        const testResumeId = process.env.TEST_RESUME_ID;
        
        if (!testResumeId) {
            console.warn("Skipping test: TEST_RESUME_ID environment variable not set");
            return;
        }

        const sections = ['summary', 'experience', 'education', 'skills'];
        
        for (const section of sections) {
            try {
                const result = await readResumeSection({
                    resume_id: testResumeId,
                    section_name: section
                });
                console.log(`\nSection: ${section}`);
                console.log(JSON.stringify(result, null, 2));
            } catch (error) {
                console.error(`Test failed for section ${section}:`, error);
            }
        }
    }
}

runTest();