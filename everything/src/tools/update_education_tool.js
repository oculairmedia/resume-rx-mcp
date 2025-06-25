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
dotenv.config({ path: path.resolve(__dirname, '../../../.env') }); // Go up three levels

// --- Configuration ---
const DEFAULT_RX_EMAIL = process.env.RX_RESUME_EMAIL || "emanuvaderland@gmail.com";
const DEFAULT_RX_PASSWORD = process.env.RX_RESUME_PASSWORD || "E4YSj9UiVuSB3uJ";
const DEFAULT_RX_BASE_URL = process.env.RX_RESUME_BASE_URL || "http://192.168.50.90:3050/api";

// --- Helper: Generate CUID2-like ID ---
function generateCuid2() {
    // Use crypto for better randomness if available, fallback to uuidv4 parts
    const randomPart = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID().replace(/-/g, '')
        : uuidv4().replace(/-/g, '');
    return `c${randomPart.substring(0, 23)}`; // Standard Cuid2 length is 24 starting with 'c'
}

// --- Helper: Format Date Range ---
function formatDateRange(startDateStr, endDateStr) {
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
}

export async function updateEducation(args) {
    const {
        resume_id,
        operation,
        institution,
        degree,
        area,
        date,
        startDate,
        endDate,
        studyType,
        score,
        summary,
        url_label,
        url_href,
        visible = true,
        item_id,
        email,
        password,
        base_url
    } = args;

    try {
        // Setup axios with cookie handling
        const cookieJar = new CookieJar();
        const axiosInstance = axiosCookiejarSupport(axios.create({ jar: cookieJar }));

        // Use environment variables or provided values
        const authParams = args.auth || {};
        const authEmail = (email && email.trim()) ? email.trim() : DEFAULT_RX_EMAIL;
        const authPassword = (password && password.trim()) ? password.trim() : DEFAULT_RX_PASSWORD;
        const baseUrl = (base_url && base_url.trim()) ? base_url.trim() : DEFAULT_RX_BASE_URL;

        if (!authEmail || !authPassword || !baseUrl) {
            throw new Error("Missing required Reactive Resume authentication details (email, password, base_url).");
        }

        // Authenticate
        const authUrl = `${baseUrl}/auth/login`;
        const authPayload = { identifier: authEmail, password: authPassword };
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

        // Fetch current resume data
        const resumeUrl = `${baseUrl}/resume/${resume_id}`;
        let currentResume;
        try {
            const resumeResponse = await axiosInstance.get(resumeUrl, { headers: requestHeaders });
            if (resumeResponse.status !== 200) throw new Error(`Failed to get resume: ${resumeResponse.status}`);
            currentResume = resumeResponse.data;
        } catch (error) {
            throw new Error(`Failed to fetch current resume ${resume_id}: ${error.response?.data?.message || error.message}`);
        }

        if (!currentResume) {
            throw new Error('Resume not found');
        }

        // Get education section
        let educationSection = currentResume.data?.sections?.education;
        if (!educationSection) {
            educationSection = {
                name: "Education",
                id: "education",
                visible: true,
                columns: 1,
                separateLinks: true,
                items: []
            };
        } else {
            // Deep clone to avoid modifying the original
            educationSection = JSON.parse(JSON.stringify(educationSection));
            if (!educationSection.items) {
                educationSection.items = []; // Ensure items array exists
            }
        }
        
        let updatedItems = [...(educationSection.items || [])];

        if (operation === 'add') {
            // Construct URL object if provided
            const url = (url_label || url_href) ? {
                label: url_label || '',
                href: url_href || ''
            } : undefined;

            // Construct education item
            const newEducation = {
                id: generateCuid2(),
                institution,
                degree,
                area,
                studyType,
                score,
                summary: `<p>${summary || ""}</p>`, // Ensure summary exists, wrap in <p>
                visible: visible !== false,
                url: { // Always include URL object
                    label: url_label || "",
                    href: url_href || ""
                }
            };

            // Handle date fields
            if (date) {
                newEducation.date = date;
            } else if (startDate || endDate) {
                // Format date range correctly
                newEducation.date = formatDateRange(startDate, endDate);
            }

            updatedItems.push(newEducation);
        } else if (operation === 'remove') {
            if (!item_id) {
                throw new Error('Item ID is required for remove operation');
            }
            updatedItems = updatedItems.filter(item => item.id !== item_id);
        } else {
            throw new Error('Invalid operation. Must be either "add" or "remove"');
        }

        // Update education section with new items
        educationSection.items = updatedItems;
        
        // Update the full resume object
        currentResume.data.sections.education = educationSection;
        
        // Update resume with new education section
        try {
            const updateResponse = await axiosInstance.patch(
                resumeUrl,
                currentResume,
                { headers: requestHeaders }
            );
            
            if (updateResponse.status !== 200) {
                throw new Error(`Failed to update resume: ${updateResponse.status}`);
            }
            
            return {
                success: true,
                message: `Successfully ${operation}ed education entry`,
                data: updateResponse.data
            };
        } catch (error) {
            throw new Error(`Failed to update resume ${resume_id}: ${error.response?.data?.message || error.message}`);
        }

    } catch (error) {
        console.error('Error in updateEducation:', error);
        return {
            success: false,
            message: error.message || 'Failed to update education section',
            error: error
        };
    }
};

export const updateEducationTool = {
    name: 'update_education',
    description: "Updates ('add', 'remove') education entries in the education section of an existing resume. Uses flat fields.",
    inputSchema: {
        type: 'object',
        properties: {
            resume_id: { type: 'string', description: 'Resume ID to update' },
            operation: { type: 'string', enum: ['add', 'remove'], description: 'Operation to perform' },
            institution: { type: 'string', description: 'Name of the educational institution' },
            degree: { type: 'string', description: 'Degree obtained or pursued' },
            area: { type: 'string', description: 'Field of study' },
            date: { type: 'string', description: 'Education date (YYYY or YYYY-MM)' },
            startDate: { type: 'string', description: 'Start date (YYYY-MM-DD format)' },
            endDate: { type: 'string', description: 'End date (YYYY-MM-DD format)' },
            studyType: { type: 'string', description: 'Type of study (e.g., Bachelor\'s, Master\'s)' },
            score: { type: 'string', description: 'Grade or GPA' },
            summary: { type: 'string', description: 'Additional details about the education' },
            url_label: { type: 'string', description: 'Label for the URL' },
            url_href: { type: 'string', description: 'URL link' },
            visible: { type: 'boolean', description: 'Item visibility' },
            item_id: { type: 'string', description: 'Item ID (required for remove operation)' },
            email: { type: 'string', description: 'Authentication email' },
            password: { type: 'string', description: 'Authentication password' },
            base_url: { type: 'string', description: 'API base URL' }
        },
        required: ['resume_id', 'operation'],
        allOf: [
            {
                if: {
                    properties: { operation: { const: 'remove' } }
                },
                then: {
                    required: ['item_id']
                }
            },
            {
                if: {
                    properties: { operation: { const: 'add' } }
                },
                then: {
                    required: ['institution', 'degree']
                }
            }
        ]
    }
};

// Remove CommonJS export