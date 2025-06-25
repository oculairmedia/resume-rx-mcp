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

// Validation helper functions
const validateDate = (date) => {
    if (!date) return true; // Optional
    const dateRegex = /^\d{4}(-\d{2}(-\d{2})?)?$/;
    return dateRegex.test(date);
};

const validateUrl = (url) => {
    if (!url) return true; // URLs are optional
    if (typeof url === 'string') {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    } else if (typeof url === 'object') {
        // More lenient URL validation - just check if it's an object with the expected structure
        // This allows empty href values which is ok for many use cases
        return typeof url === 'object' && 'href' in url && 'label' in url;
    }
    return false;
};

// Section-specific validation functions
const validateSection = {
    skills: (items) => {
        if (!Array.isArray(items)) {
            return { valid: false, error: "Skills must be an array" };
        }
        
        const errors = [];
        items.forEach((item, index) => {
            if (typeof item === 'string') return; // Simple string skills are always valid
            
            if (!item.name) {
                errors.push(`Skill at index ${index} is missing required 'name' field`);
            }
            if (item.level && (item.level < 0 || item.level > 5)) {
                errors.push(`Skill '${item.name}' has invalid level (must be 0-5)`);
            }
            // Check for required description if it's an object and description is missing
            if (typeof item === 'object' && item.description === undefined) {
                errors.push(`Skill '${item.name || index}' is missing required 'description' field`);
            }
        });

        return {
            valid: errors.length === 0,
            errors
        };
    },
    
    experience: (items) => {
        if (!Array.isArray(items)) {
            return { valid: false, error: "Experience must be an array" };
        }
        
        const errors = [];
        items.forEach((item, index) => {
            if (!item.company) {
                errors.push(`Experience at index ${index} is missing required 'company' field`);
            }
            if (!item.position) {
                errors.push(`Experience at index ${index} is missing required 'position' field`);
            }
            if (!item.date && !item.startDate) {
                errors.push(`Experience '${item.company}' requires either 'date' or 'startDate'`);
            }
            if (item.startDate && !validateDate(item.startDate)) {
                errors.push(`Experience '${item.company}' has invalid startDate format (use YYYY-MM-DD)`);
            }
            if (item.endDate && !validateDate(item.endDate)) {
                errors.push(`Experience '${item.company}' has invalid endDate format (use YYYY-MM-DD)`);
            }
            if (item.url && !validateUrl(item.url)) {
                errors.push(`Experience '${item.company}' has invalid URL format`);
            }
        });
        
        return {
            valid: errors.length === 0,
            errors
        };
    },
    
    education: (items) => {
        if (!Array.isArray(items)) {
            return { valid: false, error: "Education must be an array" };
        }
        
        const errors = [];
        items.forEach((item, index) => {
            if (!item.institution) {
                errors.push(`Education at index ${index} is missing required 'institution' field`);
            }
            // Skip degree check if we'll handle it in sanitizeSection
            // if (!item.degree) {
            //     errors.push(`Education at index ${index} is missing required 'degree' field`);
            // }
            // Check for either date or startDate
            if (!item.date && !item.startDate) {
                errors.push(`Education '${item.institution || index}' requires either 'date' or 'startDate'`);
            }
            if (item.startDate && !validateDate(item.startDate)) {
                errors.push(`Education '${item.institution || index}' has invalid startDate format (use YYYY-MM-DD)`);
            }
            if (item.endDate && !validateDate(item.endDate)) {
                errors.push(`Education '${item.institution || index}' has invalid endDate format (use YYYY-MM-DD)`);
            }
            // More lenient URL validation to allow empty href values
            if (item.url && typeof item.url !== 'object' && typeof item.url !== 'string') {
                errors.push(`Education '${item.institution || index}' has invalid URL format (must be string URL or object with label and href)`);
            }
        });
        
        return {
            valid: errors.length === 0,
            errors
        };
    },
    
    certifications: (items) => {
        if (!Array.isArray(items)) {
            return { valid: false, error: "Certifications must be an array" };
        }
        
        const errors = [];
        items.forEach((item, index) => {
            if (!item.name) {
                errors.push(`Certification at index ${index} is missing required 'name' field`);
            }
            if (!item.issuer) {
                errors.push(`Certification '${item.name || index}' is missing required 'issuer' field`);
            }
            if (!item.date && !item.startDate) {
                errors.push(`Certification '${item.name || index}' requires either 'date' or 'startDate'`);
            }
            if (item.startDate && !validateDate(item.startDate)) {
                errors.push(`Certification '${item.name}' has invalid startDate format (use YYYY-MM-DD)`);
            }
            if (item.endDate && !validateDate(item.endDate)) {
                errors.push(`Certification '${item.name}' has invalid endDate format (use YYYY-MM-DD)`);
            }
        });
        
        return {
            valid: errors.length === 0,
            errors
        };
    },
    
    profiles: (items) => {
        if (!Array.isArray(items)) {
            return { valid: false, error: "Profiles must be an array" };
        }
        
        const errors = [];
        items.forEach((item, index) => {
            if (!item.network) {
                errors.push(`Profile at index ${index} is missing required 'network' field`);
            }
            if (!item.username) {
                errors.push(`Profile '${item.network || index}' is missing required 'username' field`);
            }
            if (item.url && !validateUrl(item.url)) {
                errors.push(`Profile '${item.network}' has invalid URL format`);
            }
            // Check for required icon field
            if (!item.icon) {
                errors.push(`Profile '${item.network || index}' is missing required 'icon' field`);
            }
        });

        return {
            valid: errors.length === 0,
            errors
        };
    },

    languages: (items) => {
        if (!Array.isArray(items)) {
            return { valid: false, error: "Languages must be an array" };
        }
        const errors = [];
        items.forEach((item, index) => {
            if (!item.name) {
                errors.push(`Language at index ${index} is missing required 'name' field`);
            }
            if (item.description === undefined) {
                errors.push(`Language '${item.name || index}' is missing required 'description' field`);
            }
        });
        return { valid: errors.length === 0, errors };
    },

    awards: (items) => {
        if (!Array.isArray(items)) {
            return { valid: false, error: "Awards must be an array" };
        }
        const errors = [];
        items.forEach((item, index) => {
            if (!item.title) {
                errors.push(`Award at index ${index} is missing required 'title' field`);
            }
            if (!item.awarder) {
                errors.push(`Award '${item.title || index}' is missing required 'awarder' field`);
            }
            if (!item.date) { // Assuming date is required based on Python test
                errors.push(`Award '${item.title || index}' is missing required 'date' field`);
            }
            if (item.url && !validateUrl(item.url)) {
                errors.push(`Award '${item.title}' has invalid URL format`);
            }
        });
        return { valid: errors.length === 0, errors };
    },

    interests: (items) => {
        if (!Array.isArray(items)) {
            return { valid: false, error: "Interests must be an array" };
        }
        const errors = [];
        items.forEach((item, index) => {
            if (!item.name) {
                errors.push(`Interest at index ${index} is missing required 'name' field`);
            }
            if (item.keywords && !Array.isArray(item.keywords)) {
                errors.push(`Interest '${item.name || index}' keywords must be an array`);
            }
        });
        return { valid: errors.length === 0, errors };
    },

    projects: (items) => {
        if (!Array.isArray(items)) {
            return { valid: false, error: "Projects must be an array" };
        }
        const errors = [];
        items.forEach((item, index) => {
            if (!item.name) {
                errors.push(`Project at index ${index} is missing required 'name' field`);
            }
            // Skip date/startDate check as we'll handle it in sanitizeSection
            // if (!item.date && !item.startDate) {
            //     errors.push(`Project '${item.name || index}' requires either 'date' or 'startDate'`);
            // }
            if (item.startDate && !validateDate(item.startDate)) {
                errors.push(`Project '${item.name || index}' has invalid startDate format (use YYYY-MM-DD)`);
            }
            if (item.endDate && !validateDate(item.endDate)) {
                errors.push(`Project '${item.name || index}' has invalid endDate format (use YYYY-MM-DD)`);
            }
            // More lenient URL validation to allow empty href values
            if (item.url && typeof item.url !== 'object' && typeof item.url !== 'string') {
                errors.push(`Project '${item.name || index}' has invalid URL format (must be string URL or object with label and href)`);
            }
            if (item.keywords && !Array.isArray(item.keywords)) {
                errors.push(`Project '${item.name || index}' keywords must be an array`);
            }
        });
        return { valid: errors.length === 0, errors };
    },

    publications: (items) => {
        if (!Array.isArray(items)) {
            return { valid: false, error: "Publications must be an array" };
        }
        const errors = [];
        items.forEach((item, index) => {
            if (!item.name) {
                errors.push(`Publication at index ${index} is missing required 'name' field`);
            }
            if (!item.publisher) {
                errors.push(`Publication '${item.name || index}' is missing required 'publisher' field`);
            }
            if (!item.date) { // Assuming date is required
                errors.push(`Publication '${item.name || index}' is missing required 'date' field`);
            }
            if (item.url && !validateUrl(item.url)) {
                errors.push(`Publication '${item.name}' has invalid URL format`);
            }
        });
        return { valid: errors.length === 0, errors };
    },

    volunteer: (items) => {
        if (!Array.isArray(items)) {
            return { valid: false, error: "Volunteer must be an array" };
        }
        const errors = [];
        items.forEach((item, index) => {
            if (!item.organization) {
                errors.push(`Volunteer entry at index ${index} is missing required 'organization' field`);
            }
            if (!item.position) {
                errors.push(`Volunteer entry '${item.organization || index}' is missing required 'position' field`);
            }
            if (!item.location) { // Check for required location
                errors.push(`Volunteer entry '${item.organization || index}' is missing required 'location' field`);
            }
            if (!item.date && !item.startDate) { // Assuming one is required
                errors.push(`Volunteer entry '${item.organization || index}' requires either 'date' or 'startDate'`);
            }
            if (item.startDate && !validateDate(item.startDate)) {
                errors.push(`Volunteer entry '${item.organization}' has invalid startDate format (use YYYY-MM-DD)`);
            }
            if (item.endDate && !validateDate(item.endDate)) {
                errors.push(`Volunteer entry '${item.organization}' has invalid endDate format (use YYYY-MM-DD)`);
            }
            if (item.url && !validateUrl(item.url)) {
                errors.push(`Volunteer entry '${item.organization}' has invalid URL format`);
            }
        });
        return { valid: errors.length === 0, errors };
    },

    references: (items) => {
        if (!Array.isArray(items)) {
            return { valid: false, error: "References must be an array" };
        }
        const errors = [];
        items.forEach((item, index) => {
            if (!item.name) {
                errors.push(`Reference at index ${index} is missing required 'name' field`);
            }
            if (item.url && !validateUrl(item.url)) {
                errors.push(`Reference '${item.name}' has invalid URL format`);
            }
        });
        return { valid: errors.length === 0, errors };
    }
};

// Data sanitization helper
const sanitizeSection = (sectionData, sectionType) => {
    if (!Array.isArray(sectionData)) return [];
    
    const defaultValues = {
        education: {
            institution: "",
            degree: "", // Added missing required degree field
            area: "",
            summary: "",
            score: "",
            studyType: "",
            url: { label: "Institution Website", href: "" }
        },
        projects: {
            summary: "",
            description: "",
            date: "Present", // Add default date to ensure validation passes
            keywords: [],
            url: { label: "Project Link", href: "" }
        }
    };

    return sectionData.map(item => {
        // Remove null/undefined values
        const cleaned = Object.fromEntries(
            Object.entries(item).filter(([_, v]) => v != null)
        );
        
        // Ensure required common fields
        if (!cleaned.visible) cleaned.visible = true;
        if (!cleaned.url) cleaned.url = defaultValues[sectionType]?.url || { label: "", href: "" };
        
        // Add section-specific optional fields and ensure required fields
        if (defaultValues[sectionType]) {
            const defaults = defaultValues[sectionType];
            for (const [key, value] of Object.entries(defaults)) {
                if ((cleaned[key] === undefined || cleaned[key] === "") && key !== 'url') { // Skip URL as it's handled above
                    cleaned[key] = value;
                }
            }
            
            // Special handling for critical fields
            if (sectionType === 'education') {
                // For education entries, ensure degree is populated - use studyType if available
                if (!cleaned.degree || cleaned.degree === "") {
                    cleaned.degree = cleaned.studyType || defaults.degree || "Degree";
                }
            }
            
            if (sectionType === 'projects') {
                // For projects, ensure date is populated
                if (!cleaned.date && !cleaned.startDate) {
                    cleaned.date = defaults.date || "Present";
                }
            }
        }
        
        // Handle date field - only if startDate is provided and date isn't
        if (!cleaned.date && cleaned.startDate) {
            cleaned.date = `${cleaned.startDate.substring(0,4)}-${cleaned.endDate ? cleaned.endDate.substring(0,4) : 'Present'}`;
        }
        
        return cleaned;
    });
};

// --- Configuration ---
const DEFAULT_RX_EMAIL = process.env.RX_RESUME_EMAIL || "emanuvaderland@gmail.com";
const DEFAULT_RX_PASSWORD = process.env.RX_RESUME_PASSWORD || "E4YSj9UiVuSB3uJ";
const DEFAULT_RX_BASE_URL = process.env.RX_RESUME_BASE_URL || "https://resume.emmanuelu.com/api";
const DEFAULT_RX_PUBLIC_URL = process.env.RX_RESUME_PUBLIC_URL || "https://resume.emmanuelu.com";

/**
 * Creates a new resume or updates an existing one with detailed information.
 * If resume_id is provided, it updates the existing resume.
 *
 * @param {object} params - Parameters object
 * @param {string} [params.resume_id] - Optional ID of resume to update. If omitted, a new resume will be created.
 * @param {string} [params.title] - Title of the resume (used for creation or update)
 * @param {string} [params.slug] - Slug for the resume URL (used for creation, ignored for update)
 * @param {string} [params.visibility] - Visibility of the resume (used for creation or update)
 * @param {string} [params.name] - Full name for the resume
 * @param {string} [params.headline] - Professional headline
 * @param {string} [params.email] - Email address
 * @param {string} [params.phone] - Phone number
 * @param {string} [params.location] - Location (city, state)
 * @param {string} [params.summary] - Professional summary (can include HTML)
 * @param {array|object} [params.skills] - List of skills (can be array of strings or objects)
 * @param {array|object} [params.education] - List of education entries
 * @param {array|object} [params.experience] - List of work experience entries
 * @param {array|object} [params.certifications] - List of certifications
 * @param {array|object} [params.projects] - List of projects
 * @param {array|object} [params.volunteer] - List of volunteer experience entries
 * @param {array|object} [params.profiles] - List of social profiles
 * @param {array|object} [params.languages] - List of languages spoken
 * @param {array|object} [params.awards] - List of awards received
 * @param {array|object} [params.interests] - List of interests
 * @param {array|object} [params.publications] - List of publications
 * @param {array|object} [params.references] - List of references
 * @param {object} [params.auth] - Authentication parameters (optional)
 * @returns {Promise<object>} - Promise resolving to result object
 */
export async function createAndUpdateResume(params = {}) {
    const cookieJar = new CookieJar();
    const axiosInstance = axiosCookiejarSupport(axios.create({ jar: cookieJar }));

    try {
        // --- Step 1: Validate Input Parameters ---
        const validationErrors = [];
        const isUpdateOperation = Boolean(params.resume_id);
        const resumeId = params.resume_id;

        // Basic validation
        if (isUpdateOperation && !resumeId) {
            validationErrors.push("Resume ID (resume_id) is required for update operations");
        }
        if (!isUpdateOperation && !params.title) {
            validationErrors.push("Title is required for resume creation");
        }

        // Section-specific validation
        const sectionsToValidate = {
            skills: params.skills,
            experience: params.experience,
            education: params.education,
            certifications: params.certifications,
            profiles: params.profiles,
            languages: params.languages,
            awards: params.awards,
            interests: params.interests,
            projects: params.projects, // Make sure projects is included
            publications: params.publications,
            volunteer: params.volunteer, // Make sure volunteer is included
            references: params.references
        };

        // Sanitize and validate each provided section
        Object.entries(sectionsToValidate).forEach(([sectionName, sectionData]) => {
            // Ensure sectionData is not null/undefined before validating
            if (sectionData != null && validateSection[sectionName]) {
                // First sanitize the data
                const sanitizedData = sanitizeSection(sectionData, sectionName);
                // Then validate
                const validation = validateSection[sectionName](sanitizedData);
                if (!validation.valid) {
                    validationErrors.push(
                        `${sectionName.charAt(0).toUpperCase() + sectionName.slice(1)} section validation errors:`,
                        ...validation.errors.map(err => `  - ${err}`)
                    );
                }
            }
        });

        if (validationErrors.length > 0) {
            const errorMessage = [
                "Resume validation failed with the following errors:",
                "",
                ...validationErrors
            ].join("\n");
            throw new Error(errorMessage);
        }

        // --- Step 2: Process Auth Parameters & Authenticate ---
        const authParams = params.auth || {};
        const email = (authParams.email && authParams.email.trim()) ? authParams.email.trim() : DEFAULT_RX_EMAIL;
        const password = (authParams.password && authParams.password.trim()) ? authParams.password.trim() : DEFAULT_RX_PASSWORD;
        const baseUrl = (authParams.base_url && authParams.base_url.trim()) ? authParams.base_url.trim() : DEFAULT_RX_BASE_URL;
        const publicBaseUrl = (authParams.public_url && authParams.public_url.trim()) ? authParams.public_url.trim() : DEFAULT_RX_PUBLIC_URL;

        if (!email || !password || !baseUrl) {
            throw new Error("Missing required Reactive Resume authentication details");
        }

        // Authenticate
        const authUrl = `${baseUrl}/auth/login`;
        const authPayload = { identifier: email, password: password };
        const authHeaders = { 'Content-Type': 'application/json' };

        let sessionCookie = null;
        let username = null;
        try {
            const authResponse = await axiosInstance.post(authUrl, authPayload, { headers: authHeaders });
            if (authResponse.status !== 200) throw new Error(`Authentication failed: ${authResponse.status}`);
            const cookies = authResponse.headers['set-cookie'];
            if (cookies) {
                sessionCookie = cookies.find(cookie => cookie.startsWith('connect.sid='))?.split(';')[0];
            }

            // Set up request headers for subsequent API calls
            const requestHeaders = {
                'Content-Type': 'application/json',
                ...(sessionCookie && { 'Cookie': sessionCookie })
            };

            // Fetch user profile to get the correct username
            try {
                const userProfileResponse = await axiosInstance.get(`${baseUrl}/user/me`, { headers: requestHeaders });
                if (userProfileResponse.status === 200 && userProfileResponse.data) {
                    username = userProfileResponse.data.username;
                    console.log(`Found username: ${username}`);
                }
            } catch (profileError) {
                console.warn("Could not fetch user profile:", profileError.message);
                // Fall back to email-based username if profile fetch fails
                username = email.split('@')[0];
            }
        } catch (error) {
            throw new Error(`Authentication failed: ${error.response?.data?.message || error.message}`);
        }

        // Set up request headers for subsequent API calls
        const requestHeaders = {
            'Content-Type': 'application/json',
            ...(sessionCookie && { 'Cookie': sessionCookie })
        };

        let currentResume = null;
        let getResumeUrl = '';
        let updateUrl = '';
        let updateHeaders = requestHeaders;

        // --- Step 3: Create New Resume or Fetch Existing One ---
        if (!isUpdateOperation) {
            // This is a CREATE operation
            const createUrl = `${baseUrl}/resume`;
            const createPayload = {
                title: params.title,
                slug: params.slug || params.title.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, '-') + "-" + Date.now(),
                visibility: params.visibility || "private"
            };

            let createResponse;
            try {
                createResponse = await axiosInstance.post(createUrl, createPayload, { headers: requestHeaders });
            } catch (error) {
                console.error("Resume creation API call failed:", error.response?.data || error.message); // Added console.error
                throw new Error(`Resume creation failed: ${error.response?.data?.message || error.message}`);
            }

            if (createResponse.status !== 201) {
                throw new Error(`Resume creation failed with status ${createResponse.status}`);
            }

            console.log(`Created new resume with ID: ${createResponse.data.id}`);
            
            // Wait a bit for the resume to be fully created before proceeding
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Set up for update
            getResumeUrl = `${baseUrl}/resume/${createResponse.data.id}`;
            updateUrl = getResumeUrl;
            
            // Get the newly created resume
            try {
                const getResponse = await axiosInstance.get(getResumeUrl, { headers: requestHeaders });
                currentResume = getResponse.data;
            } catch (error) {
                console.error("Failed to fetch newly created resume:", error.response?.data || error.message); // Added console.error
                throw new Error(`Failed to fetch newly created resume: ${error.response?.data?.message || error.message}`);
            }

        } else {
            // This is an UPDATE operation
            getResumeUrl = `${baseUrl}/resume/${resumeId}`;
            updateUrl = getResumeUrl;
            
            try {
                const getResponse = await axiosInstance.get(getResumeUrl, { headers: requestHeaders });
                currentResume = getResponse.data;
            } catch (error) {
                console.error("Failed to fetch resume for update:", error.response?.data || error.message); // Added console.error
                throw new Error(`Failed to fetch resume for update: ${error.response?.data?.message || error.message}`);
            }
        }

        // --- Step 4: Prepare data for update (if needed) ---
        if (!params.name && !params.headline && !params.email && !params.phone && !params.location &&
            !params.summary && !params.skills && !params.education && !params.experience &&
            !params.certifications && !params.projects && !params.volunteer && !params.profiles &&
            !params.languages && !params.awards && !params.interests && !params.publications && !params.references && // Ensure all sections checked
            !(params.title && isUpdateOperation) && !(params.visibility && isUpdateOperation)) {

            // No updates required
            console.log("No update parameters provided.");
            
            return {
                message: isUpdateOperation ? `Resume fetched (no updates needed): ${currentResume.title}` : `Resume created: ${currentResume.title}`,
                id: currentResume.id,
                title: currentResume.title,
                slug: currentResume.slug,
                visibility: currentResume.visibility,
                public_url: currentResume.visibility === "public" ? `${publicBaseUrl}/${username || email.split('@')[0]}/${currentResume.slug}` : null,
                timestamp: currentResume.updatedAt
            };
        }

        // --- Step 5: Build Update Data ---
        
        // The updateData object mirrors the structure of the current resume
        const updateData = JSON.parse(JSON.stringify(currentResume));
        
        // Initialize data structure if it doesn't exist
        if (!updateData.data) updateData.data = {};
        if (!updateData.data.basics) updateData.data.basics = {};
        if (!updateData.data.sections) updateData.data.sections = {};
        
        // Top level fields
        if (params.title) updateData.title = params.title;
        if (params.visibility) updateData.visibility = params.visibility;
        
        // Basic information
        if (params.name) updateData.data.basics.name = params.name;
        if (params.headline) updateData.data.basics.headline = params.headline;
        if (params.email) updateData.data.basics.email = params.email;
        if (params.phone) updateData.data.basics.phone = params.phone;
        if (params.location) updateData.data.basics.location = params.location;
        
        // Ensure required fields exist in the basics section
        if (!updateData.data.basics.url) updateData.data.basics.url = { label: "", href: "" };
        if (!updateData.data.basics.customFields) updateData.data.basics.customFields = [];
        if (!updateData.data.basics.picture) {
            updateData.data.basics.picture = {
                url: "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png",
                size: 64,
                aspectRatio: 1,
                borderRadius: 0,
                effects: { hidden: false, border: false, grayscale: false }
            };
        }
        
        // Summary section
        if (params.summary !== undefined) {
            // Ensure the summary section exists
            if (!updateData.data.sections.summary) {
                updateData.data.sections.summary = {
                    name: "Summary",
                    id: "summary",
                    visible: true,
                    columns: 1,
                    separateLinks: true
                };
            }
            updateData.data.sections.summary.content = params.summary;
        }
        
        // Skills section
        if (params.skills) {
            // Ensure the skills section exists
            if (!updateData.data.sections.skills) {
                updateData.data.sections.skills = {
                    name: "Skills",
                    id: "skills",
                    visible: true,
                    columns: 1,
                    separateLinks: true,
                    items: []
                };
            }
            
            // Process each skill
            const skillItems = [];
            for (const skillItem of params.skills) {
                if (typeof skillItem === 'string') {
                    // Simple string skill
                    skillItems.push({
                        // Don't specify ID, let the API generate one
                        name: skillItem,
                        level: 3,
                        description: "", // Required field
                        keywords: [],
                        visible: true
                    });
                } else {
                    // Object skill with properties
                    skillItems.push({
                        // Only include ID if it's provided and valid
                        ...(skillItem.id && { id: skillItem.id }),
                        name: skillItem.name,
                        level: skillItem.level || 3,
                        description: skillItem.description || "",
                        keywords: Array.isArray(skillItem.keywords) ? skillItem.keywords : [],
                        visible: skillItem.visible !== false
                    });
                }
            }
            updateData.data.sections.skills.items = skillItems;
        }
        
        // Education section with improved processing
        if (params.education) {
            if (!updateData.data.sections.education) {
                updateData.data.sections.education = {
                    name: "Education",
                    id: "education",
                    visible: true,
                    columns: 1,
                    separateLinks: true,
                    items: []
                };
            }
            
            // Process each education item to ensure all required fields
            const educationItems = params.education.map(item => {
                return {
                    // If provided ID, include it
                    ...(item.id && { id: item.id }),
                    
                    // Required fields with proper defaults
                    institution: item.institution || "Institution",
                    // Use studyType as degree if degree is missing
                    degree: item.degree || item.studyType || "Degree",
                    date: item.date || (item.startDate ? `${item.startDate.substring(0,4)}-${item.endDate ? item.endDate.substring(0,4) : 'Present'}` : "Present"),
                    
                    // Optional fields with defaults
                    area: item.area || "",
                    summary: item.summary || "",
                    score: item.score || "",
                    studyType: item.studyType || "",
                    visible: item.visible !== false,
                    
                    // Ensure URL is properly formatted
                    url: typeof item.url === 'object' ?
                         { label: item.url?.label || "Institution Website", href: item.url?.href || "" } :
                         { label: "Institution Website", href: typeof item.url === 'string' ? item.url : "" }
                };
            });
            
            updateData.data.sections.education.items = educationItems;
        }
        
        // Experience section
        if (params.experience) {
            if (!updateData.data.sections.experience) {
                updateData.data.sections.experience = {
                    name: "Experience",
                    id: "experience",
                    visible: true,
                    columns: 1,
                    separateLinks: true,
                    items: []
                };
            }
            
            // Process each experience item to ensure required fields
            const experienceItems = params.experience.map(item => {
                return {
                    // If provided ID, include it
                    ...(item.id && { id: item.id }),
                    
                    // Required fields with proper defaults
                    company: item.company || "Company",
                    position: item.position || "Position",
                    date: item.date || (item.startDate ? `${item.startDate.substring(0,4)}-${item.endDate ? item.endDate.substring(0,4) : 'Present'}` : ""),
                    
                    // Optional fields with defaults
                    location: item.location || "",
                    summary: item.summary || "",
                    visible: item.visible !== false,
                    
                    // Ensure URL is properly formatted
                    url: typeof item.url === 'object' ?
                         { label: item.url?.label || "Company Website", href: item.url?.href || "" } :
                         { label: "Company Website", href: typeof item.url === 'string' ? item.url : "" }
                };
            });
            
            updateData.data.sections.experience.items = experienceItems;
        }
        
        // Certifications section
        if (params.certifications) {
            if (!updateData.data.sections.certifications) {
                updateData.data.sections.certifications = {
                    name: "Certifications",
                    id: "certifications",
                    visible: true,
                    columns: 1,
                    separateLinks: true,
                    items: []
                };
            }
            
            // Process each certification item to ensure required fields
            const certificationItems = params.certifications.map(item => {
                return {
                    // If provided ID, include it
                    ...(item.id && { id: item.id }),
                    
                    // Required fields with proper defaults
                    name: item.name || "Certification",
                    issuer: item.issuer || item.authority || "Issuer",
                    date: item.date || (item.startDate ? `${item.startDate.substring(0,4)}-${item.endDate ? item.endDate.substring(0,4) : 'Present'}` : ""),
                    
                    // Optional fields with defaults
                    summary: item.summary || "",
                    authority: item.authority || item.issuer || "",
                    visible: item.visible !== false,
                    
                    // Ensure URL is properly formatted
                    url: typeof item.url === 'object' ?
                         { label: item.url?.label || "Verify Certification", href: item.url?.href || "" } :
                         { label: "Verify Certification", href: typeof item.url === 'string' ? item.url : "" }
                };
            });
            
            updateData.data.sections.certifications.items = certificationItems;
        }
        
        // Projects section
        if (params.projects) {
            if (!updateData.data.sections.projects) {
                updateData.data.sections.projects = {
                    name: "Projects",
                    id: "projects",
                    visible: true,
                    columns: 1,
                    separateLinks: true,
                    items: []
                };
            }
            
            // Process each project item to ensure required fields
            const projectItems = params.projects.map(item => {
                return {
                    // If provided ID, include it
                    ...(item.id && { id: item.id }),
                    
                    // Required fields with proper defaults
                    name: item.name || "Project",
                    description: item.description || "",
                    date: item.date || (item.startDate ? `${item.startDate.substring(0,4)}-${item.endDate ? item.endDate.substring(0,4) : 'Present'}` : "Present"),
                    
                    // Optional fields with defaults
                    summary: item.summary || "",
                    keywords: item.keywords || [],
                    visible: item.visible !== false,
                    
                    // Ensure URL is properly formatted
                    url: typeof item.url === 'object' ?
                         { label: item.url?.label || "Project Link", href: item.url?.href || "" } :
                         { label: "Project Link", href: typeof item.url === 'string' ? item.url : "" }
                };
            });
            
            updateData.data.sections.projects.items = projectItems;
        }
        
        // Volunteer section
        if (params.volunteer) {
            if (!updateData.data.sections.volunteer) {
                updateData.data.sections.volunteer = {
                    name: "Volunteering",
                    id: "volunteer",
                    visible: true,
                    columns: 1,
                    separateLinks: true,
                    items: []
                };
            }
            
            // Process each volunteer item to ensure required fields
            const volunteerItems = params.volunteer.map(item => {
                return {
                    // If provided ID, include it
                    ...(item.id && { id: item.id }),
                    
                    // Required fields with proper defaults
                    organization: item.organization || "Organization",
                    position: item.position || "Position",
                    date: item.date || (item.startDate ? `${item.startDate.substring(0,4)}-${item.endDate ? item.endDate.substring(0,4) : 'Present'}` : ""),
                    
                    // Optional fields with defaults
                    location: item.location || "",
                    summary: item.summary || "",
                    visible: item.visible !== false,
                    
                    // Ensure URL is properly formatted
                    url: typeof item.url === 'object' ?
                         { label: item.url?.label || "Organization Website", href: item.url?.href || "" } :
                         { label: "Organization Website", href: typeof item.url === 'string' ? item.url : "" }
                };
            });
            
            updateData.data.sections.volunteer.items = volunteerItems;
        }
        
        // Profiles section
        if (params.profiles) {
            if (!updateData.data.sections.profiles) {
                updateData.data.sections.profiles = {
                    name: "Profiles",
                    id: "profiles",
                    visible: true,
                    columns: 1,
                    separateLinks: true,
                    items: []
                };
            }
            
            // Process each profile item to ensure required fields
            const profileItems = params.profiles.map(item => {
                return {
                    // If provided ID, include it
                    ...(item.id && { id: item.id }),
                    
                    // Required fields with proper defaults
                    network: item.network || "Other",
                    username: item.username || "",
                    icon: item.icon || (item.network ? item.network.toLowerCase() : ""),
                    visible: item.visible !== false,
                    
                    // Ensure URL is properly formatted
                    url: typeof item.url === 'object' ?
                         { label: item.url?.label || item.network || "Profile", href: item.url?.href || "" } :
                         { label: item.network || "Profile", href: typeof item.url === 'string' ? item.url : "" }
                };
            });
            
            updateData.data.sections.profiles.items = profileItems;
        }
        
        // Awards section (if provided)
        if (params.awards) {
            if (!updateData.data.sections.awards) {
                updateData.data.sections.awards = {
                    name: "Awards",
                    id: "awards",
                    visible: true,
                    columns: 1,
                    separateLinks: true,
                    items: []
                };
            }
            
            // Process each award item to ensure required fields
            const awardItems = params.awards.map(item => {
                return {
                    // If provided ID, include it
                    ...(item.id && { id: item.id }),
                    
                    // Required fields with proper defaults
                    title: item.title || "Award",
                    awarder: item.awarder || "Organization",
                    date: item.date || "Present",
                    
                    // Optional fields with defaults
                    summary: item.summary || "",
                    visible: item.visible !== false,
                    
                    // Ensure URL is properly formatted
                    url: typeof item.url === 'object' ?
                         { label: item.url?.label || "Award Details", href: item.url?.href || "" } :
                         { label: "Award Details", href: typeof item.url === 'string' ? item.url : "" }
                };
            });
            
            updateData.data.sections.awards.items = awardItems;
        }

        // Languages section
        if (params.languages) {
            if (!updateData.data.sections.languages) {
                updateData.data.sections.languages = {
                    name: "Languages",
                    id: "languages",
                    visible: true,
                    columns: 1,
                    separateLinks: true,
                    items: []
                };
            }
            const languageItems = params.languages.map(item => {
                return {
                    // If provided ID, include it
                    ...(item.id && { id: item.id }),
                    
                    // Required fields with proper defaults
                    language: item.language || "Language",
                    fluency: item.fluency || "",
                    
                    // Optional fields with defaults
                    description: item.description || "",
                    visible: item.visible !== false
                };
            });
            updateData.data.sections.languages.items = languageItems;
        }

        // Interests section
        if (params.interests) {
            if (!updateData.data.sections.interests) {
                updateData.data.sections.interests = {
                    name: "Interests",
                    id: "interests",
                    visible: true,
                    columns: 1,
                    separateLinks: true,
                    items: []
                };
            }
            const interestItems = params.interests.map(item => {
                return {
                    // If provided ID, include it
                    ...(item.id && { id: item.id }),
                    
                    // Required fields with proper defaults
                    name: item.name || "Interest",
                    
                    // Optional fields with defaults
                    keywords: Array.isArray(item.keywords) ? item.keywords : [],
                    visible: item.visible !== false
                };
            });
            updateData.data.sections.interests.items = interestItems;
        }

        // Publications section
        if (params.publications) {
            if (!updateData.data.sections.publications) {
                updateData.data.sections.publications = {
                    name: "Publications",
                    id: "publications",
                    visible: true,
                    columns: 1,
                    separateLinks: true,
                    items: []
                };
            }
            const publicationItems = params.publications.map(item => {
                return {
                    // If provided ID, include it
                    ...(item.id && { id: item.id }),
                    
                    // Required fields with proper defaults
                    name: item.name || "Publication",
                    publisher: item.publisher || "Publisher",
                    date: item.date || "Present",
                    
                    // Optional fields with defaults
                    summary: item.summary || "",
                    visible: item.visible !== false,
                    
                    // Ensure URL is properly formatted
                    url: typeof item.url === 'object' ?
                         { label: item.url?.label || "Publication Link", href: item.url?.href || "" } :
                         { label: "Publication Link", href: typeof item.url === 'string' ? item.url : "" }
                };
            });
            updateData.data.sections.publications.items = publicationItems;
        }

        // References section
        if (params.references) {
            if (!updateData.data.sections.references) {
                updateData.data.sections.references = {
                    name: "References",
                    id: "references",
                    visible: true,
                    columns: 1,
                    separateLinks: true,
                    items: []
                };
            }
            const referenceItems = params.references.map(item => {
                return {
                    // If provided ID, include it
                    ...(item.id && { id: item.id }),
                    
                    // Required fields with proper defaults
                    name: item.name || "Reference",
                    
                    // Optional fields with defaults
                    description: item.description || "",
                    summary: item.summary || "",
                    visible: item.visible !== false,
                    
                    // Ensure URL is properly formatted
                    url: typeof item.url === 'object' ?
                         { label: item.url?.label || "Reference", href: item.url?.href || "" } :
                         { label: "Reference", href: typeof item.url === 'string' ? item.url : "" }
                };
            });
            updateData.data.sections.references.items = referenceItems;
        }

        // --- Step 6: Send a single comprehensive update ---

        // --- Step 6: Send a single comprehensive update ---
        console.log(`Updating resume with ID: ${currentResume.id}`);
        let finalTimestamp = currentResume.updatedAt;
        let updateSuccess = true;
        
        try {
            const updateResponse = await axiosInstance.patch(updateUrl, updateData, { headers: updateHeaders });
            if (updateResponse.status !== 200) {
                throw new Error(`Resume update failed with status ${updateResponse.status}`);
            }
            console.log("Resume update successful");
            finalTimestamp = updateResponse.data?.updatedAt || finalTimestamp;
        } catch (error) {
            updateSuccess = false;
            
            // Enhanced error handling with detailed feedback
            const errorDetails = [];
            
            // Process API validation errors
            if (error.response?.data?.errors) {
                const apiErrors = error.response.data.errors;
                errorDetails.push("API Validation Errors:");
                
                if (Array.isArray(apiErrors)) {
                    apiErrors.forEach(err => {
                        const fieldName = err.field || 'Unknown field';
                        const message = err.message;
                        errorDetails.push(`  - ${fieldName}: ${message}`);
                    });
                } else if (typeof apiErrors === 'object') {
                    Object.entries(apiErrors).forEach(([field, message]) => {
                        errorDetails.push(`  - ${field}: ${message}`);
                    });
                }
            }

            // Add contextual help based on error type
            if (error.response?.status === 400) {
                errorDetails.push("\nCommon causes of validation errors:");
                errorDetails.push("  - Missing required fields like company name or degree");
                errorDetails.push("  - Incorrect date formats (use YYYY-MM-DD)");
                errorDetails.push("  - Invalid URL formats");
                errorDetails.push("\nTip: Check the schema documentation for field requirements and examples");
            } else if (error.response?.status === 401) {
                errorDetails.push("\nAuthentication failed:");
                errorDetails.push("  - Verify your credentials in the auth parameters");
                errorDetails.push("  - Check that your session hasn't expired");
            } else if (error.response?.status === 404) {
                errorDetails.push("\nResume not found:");
                errorDetails.push("  - Verify the resume_id is correct");
                errorDetails.push("  - Ensure you have access to this resume");
            } else if (error.response?.status === 413) {
                errorDetails.push("\nPayload too large:");
                errorDetails.push("  - Try reducing the size of summary or description fields");
                errorDetails.push("  - Remove any unnecessary HTML formatting");
            }
            
            const errorMessage = [
                `Resume update failed: ${error.response?.data?.message || error.message}`,
                "",
                ...errorDetails
            ].join("\n");
            
            console.error("Update error:", errorMessage);
            throw new Error(errorMessage);
        }
        
        // --- Step 7: Fetch the final state for accurate return data ---
        let finalResumeState = currentResume;
        try {
            const finalGetResponse = await axiosInstance.get(getResumeUrl, { headers: requestHeaders });
            if (finalGetResponse.status === 200) {
                finalResumeState = finalGetResponse.data;
                finalTimestamp = finalResumeState.updatedAt;
            }
        } catch (fetchError) {
            console.warn("Could not fetch final resume state after updates:", fetchError.message);
        }
        
        // Return final state
        return {
            message: isUpdateOperation ? `Resume updated: ${finalResumeState.title}` : `Resume created and updated: ${finalResumeState.title}`,
            id: finalResumeState.id,
            title: finalResumeState.title,
            slug: finalResumeState.slug,
            visibility: finalResumeState.visibility,
            // Fix URL format to use /username/slug instead of /r/slug
            public_url: finalResumeState.visibility === "public" ? `${publicBaseUrl}/${username || email.split('@')[0]}/${finalResumeState.slug}` : null,
            timestamp: finalTimestamp
        };
        
    } catch (error) {
        console.error("Error in createAndUpdateResume:", error);
        throw error;
    }
}

// --- Tool Definition ---
export const createAndUpdateResumeTool = {
    name: "create_and_update_resume",
    description: "Create a new resume or update an existing one with detailed information. If resume_id is provided, it updates the existing resume.",
    execute: createAndUpdateResume,
    inputSchema: {
        type: "object",
        properties: {
            resume_id: {
                type: "string",
                description: "Optional ID of the resume to update. If omitted, a new resume will be created."
            },
            title: {
                type: "string",
                description: "Title of the resume (used for creation or update)"
            },
            slug: {
                type: "string",
                description: "Slug for the resume URL (used for creation, ignored for update)"
            },
            visibility: {
                type: "string",
                enum: ["private", "public"],
                description: "Visibility of the resume (used for creation or update)"
            },
            name: {
                type: "string",
                description: "Full name for the resume"
            },
            headline: {
                type: "string",
                description: "Professional headline"
            },
            email: {
                type: "string",
                description: "Email address"
            },
            phone: {
                type: "string",
                description: "Phone number"
            },
            location: {
                type: "string",
                description: "Location (city, state)"
            },
            summary: {
                type: "string",
                description: "Professional summary (can include HTML)"
            },
            skills: {
                type: "array",
                description: "List of skills (can be array of strings or objects). Replaces the entire skills section.",
                items: {
                    oneOf: [
                        {
                            type: "string"
                        },
                        {
                            type: "object",
                            properties: {
                                id: {
                                    type: "string",
                                    description: "Optional ID for existing items (ignored on add)"
                                },
                                name: {
                                    type: "string"
                                },
                                level: {
                                    type: "number"
                                },
                                description: {
                                    type: "string"
                                },
                                keywords: {
                                    type: "array",
                                    items: {
                                        type: "string"
                                    }
                                },
                                visible: {
                                    type: "boolean"
                                }
                            }
                        }
                    ]
                }
            },
            education: {
                type: "array",
                description: "List of educational qualifications and academic achievements. Each entry represents a degree, certificate, or course of study.",
                examples: [
                    [{
                        "institution": "Stanford University",
                        "studyType": "Bachelor's",
                        "degree": "Bachelor of Science",
                        "area": "Computer Science",
                        "startDate": "2020-09-01",
                        "endDate": "2024-05-30",
                        "score": "3.8/4.0",
                        "summary": "<ul><li>Dean's List: 2020-2024</li><li>Senior Thesis: Machine Learning Applications</li></ul>",
                        "visible": true,
                        "url": {
                            "label": "Department Website",
                            "href": "https://cs.stanford.edu"
                        }
                    }]
                ],
                items: {
                    type: "object",
                    required: ["institution", "degree"],
                    properties: {
                        id: {
                            type: "string",
                            description: "Optional ID for existing items (ignored when adding new entries)"
                        },
                        institution: {
                            type: "string",
                            description: "Name of the educational institution",
                            examples: ["Stanford University", "MIT"]
                        },
                        studyType: {
                            type: "string",
                            description: "Type of degree/certification (e.g., Bachelor's, Master's, Ph.D.)",
                            examples: ["Bachelor's", "Master's", "Ph.D."]
                        },
                        degree: {
                            type: "string",
                            description: "Full name of the degree or certification earned",
                            examples: ["Bachelor of Science", "Master of Business Administration"]
                        },
                        area: {
                            type: "string",
                            description: "Field of study, major, or specialization",
                            examples: ["Computer Science", "Business Administration"]
                        },
                        date: {
                            type: "string",
                            description: "Single date string (alternative to startDate/endDate)",
                            examples: ["2020-2024", "2018 - Present"]
                        },
                        startDate: {
                            type: "string",
                            format: "date",
                            description: "When studies began (YYYY-MM-DD)",
                            examples: ["2020-09-01"]
                        },
                        endDate: {
                            type: "string",
                            format: "date",
                            description: "When studies completed (YYYY-MM-DD). Omit for ongoing education.",
                            examples: ["2024-05-30"]
                        },
                        score: {
                            type: "string",
                            description: "GPA, grade, or other performance metric",
                            examples: ["3.8/4.0", "First Class Honours", "Summa Cum Laude"]
                        },
                        summary: {
                            type: "string",
                            description: "Additional details about achievements, coursework, etc. Supports HTML formatting.",
                            examples: ["<ul><li>Dean's List: All semesters</li><li>Senior Thesis: AI Applications</li></ul>"]
                        },
                        visible: {
                            type: "boolean",
                            description: "Whether to display this entry on the resume",
                            default: true
                        },
                        url: {
                            oneOf: [
                                {
                                    type: "string",
                                    description: "Direct URL to institution or program",
                                    examples: ["https://www.stanford.edu/cs"]
                                },
                                {
                                    type: "object",
                                    description: "URL with custom display text",
                                    required: ["label", "href"],
                                    properties: {
                                        label: {
                                            type: "string",
                                            description: "Text to display for the link",
                                            examples: ["Program Website", "Department Page"]
                                        },
                                        href: {
                                            type: "string",
                                            description: "The actual URL to link to",
                                            examples: ["https://www.stanford.edu/cs"]
                                        }
                                    }
                                }
                            ]
                        }
                    }
                }
            },
            experience: {
                type: "array",
                description: "List of professional work experiences. Each entry details a position or role held at an organization.",
                examples: [
                    [{
                        "company": "Tech Innovations Inc",
                        "position": "Senior Software Engineer",
                        "location": "San Francisco, CA",
                        "startDate": "2020-01-15",
                        "endDate": "2023-06-30",
                        "summary": "<ul><li>Led development of cloud-native applications</li><li>Managed team of 5 engineers</li></ul>",
                        "visible": true,
                        "url": {
                            "label": "Company Website",
                            "href": "https://www.tech-innovations.com"
                        }
                    }]
                ],
                items: {
                    type: "object",
                    required: ["company", "position"],
                    properties: {
                        id: {
                            type: "string",
                            description: "Optional ID for existing items (ignored when adding new entries)"
                        },
                        company: {
                            type: "string",
                            description: "Name of the employer/organization",
                            examples: ["Google", "Microsoft", "Startup Inc"]
                        },
                        position: {
                            type: "string",
                            description: "Job title or role",
                            examples: ["Senior Software Engineer", "Project Manager"]
                        },
                        location: {
                            type: "string",
                            description: "Work location (city, state/country or 'Remote')",
                            examples: ["San Francisco, CA", "Remote", "London, UK"]
                        },
                        date: {
                            type: "string",
                            description: "Single date string (alternative to startDate/endDate)",
                            examples: ["2020-2023", "2021 - Present"]
                        },
                        startDate: {
                            type: "string",
                            format: "date",
                            description: "When role began (YYYY-MM-DD)",
                            examples: ["2020-01-15"]
                        },
                        endDate: {
                            type: "string",
                            format: "date",
                            description: "When role ended (YYYY-MM-DD). Omit for current positions.",
                            examples: ["2023-06-30"]
                        },
                        summary: {
                            type: "string",
                            description: "Role description, achievements, and responsibilities. Supports HTML formatting.",
                            examples: ["<ul><li>Led development of cloud infrastructure</li><li>Increased team productivity by 40%</li></ul>"]
                        },
                        visible: {
                            type: "boolean",
                            description: "Whether to display this experience on the resume",
                            default: true
                        },
                        url: {
                            oneOf: [
                                {
                                    type: "string",
                                    description: "Direct URL to company website or LinkedIn page",
                                    examples: ["https://www.company.com"]
                                },
                                {
                                    type: "object",
                                    description: "URL with custom display text",
                                    required: ["label", "href"],
                                    properties: {
                                        label: {
                                            type: "string",
                                            description: "Text to display for the link",
                                            examples: ["Company Website", "Project Page"]
                                        },
                                        href: {
                                            type: "string",
                                            description: "The actual URL to link to",
                                            examples: ["https://www.company.com"]
                                        }
                                    }
                                }
                            ]
                        }
                    }
                }
            },
            certifications: {
                type: "array",
                description: "List of certifications. Replaces the entire certifications section.",
                items: {
                    type: "object",
                    properties: {
                        id: {
                            type: "string",
                            description: "Optional ID for existing items (ignored on add)"
                        },
                        name: {
                            type: "string"
                        },
                        issuer: {
                            type: "string"
                        },
                        authority: {
                            type: "string"
                        },
                        date: {
                            type: "string"
                        },
                        startDate: {
                            type: "string",
                            format: "date"
                        },
                        endDate: {
                            type: "string",
                            format: "date"
                        },
                        summary: {
                            type: "string"
                        },
                        visible: {
                            type: "boolean"
                        },
                        url: {
                            oneOf: [
                                {
                                    type: "string"
                                },
                                {
                                    type: "object",
                                    properties: {
                                        label: {
                                            type: "string"
                                        },
                                        href: {
                                            type: "string"
                                        }
                                    }
                                }
                            ]
                        }
                    }
                }
            },
            projects: {
                type: "array",
                description: "List of projects. Replaces the entire projects section.",
                items: {
                    type: "object",
                    properties: {
                        id: {
                            type: "string",
                            description: "Optional ID for existing items (ignored on add)"
                        },
                        name: {
                            type: "string"
                        },
                        description: {
                            type: "string"
                        },
                        date: {
                            type: "string"
                        },
                        startDate: {
                            type: "string",
                            format: "date"
                        },
                        endDate: {
                            type: "string",
                            format: "date"
                        },
                        summary: {
                            type: "string"
                        },
                        keywords: {
                            type: "array",
                            items: {
                                type: "string"
                            }
                        },
                        visible: {
                            type: "boolean"
                        },
                        url: {
                            oneOf: [
                                {
                                    type: "string"
                                },
                                {
                                    type: "object",
                                    properties: {
                                        label: {
                                            type: "string"
                                        },
                                        href: {
                                            type: "string"
                                        }
                                    }
                                }
                            ]
                        }
                    }
                }
            },
            volunteer: {
                type: "array",
                description: "List of volunteer experience entries. Replaces the entire volunteer section.",
                items: {
                    type: "object",
                    properties: {
                        id: {
                            type: "string",
                            description: "Optional ID for existing items (ignored on add)"
                        },
                        organization: {
                            type: "string"
                        },
                        position: {
                            type: "string"
                        },
                        date: {
                            type: "string"
                        },
                        startDate: {
                            type: "string",
                            format: "date"
                        },
                        endDate: {
                            type: "string",
                            format: "date"
                        },
                        summary: {
                            type: "string"
                        },
                        visible: {
                            type: "boolean"
                        },
                        url: {
                            oneOf: [
                                {
                                    type: "string"
                                },
                                {
                                    type: "object",
                                    properties: {
                                        label: {
                                            type: "string"
                                        },
                                        href: {
                                            type: "string"
                                        }
                                    }
                                }
                            ]
                        }
                    }
                }
            },
            profiles: {
                type: "array",
                description: "List of social profiles. Replaces the entire profiles section.",
                items: {
                    type: "object",
                    properties: {
                        id: {
                            type: "string",
                            description: "Optional ID for existing items (ignored on add)"
                        },
                        network: {
                            type: "string"
                        },
                        username: {
                            type: "string"
                        },
                        icon: {
                            type: "string"
                        },
                        visible: {
                            type: "boolean"
                        },
                        url: {
                            oneOf: [
                                {
                                    type: "string"
                                },
                                {
                                    type: "object",
                                    properties: {
                                        label: {
                                            type: "string"
                                        },
                                        href: {
                                            type: "string"
                                        }
                                    }
                                }
                            ]
                        }
                    }
                }
            },
            auth: {
                type: ["object", "null"],
                description: "Authentication parameters (optional, will use environment variables if not provided)",
                properties: {
                    email: {
                        type: "string"
                    },
                    password: {
                        type: "string"
                    },
                    base_url: {
                        type: "string"
                    },
                    public_url: {
                        type: "string"
                    }
                }
            },
            // Add schema definitions for new sections
            languages: {
                type: "array",
                description: "List of languages spoken. Replaces the entire languages section.",
                items: {
                    type: "object",
                    properties: {
                        id: { type: "string", description: "Optional ID" },
                        name: { type: "string" },
                        fluency: { type: "string" },
                        description: { type: "string" }, // Added required description
                        visible: { type: "boolean" }
                    },
                    required: ["name", "description"] // Mark description as required
                }
            },
            awards: {
                type: "array",
                description: "List of awards received. Replaces the entire awards section.",
                items: {
                    type: "object",
                    properties: {
                        id: { type: "string", description: "Optional ID" },
                        title: { type: "string" },
                        awarder: { type: "string" },
                        date: { type: "string" },
                        summary: { type: "string" },
                        visible: { type: "boolean" },
                        url: { oneOf: [{ type: "string" }, { type: "object", properties: { label: { type: "string" }, href: { type: "string" } } }] }
                    },
                    required: ["title", "awarder", "date"] // Mark required fields
                }
            },
            interests: {
                type: "array",
                description: "List of interests. Replaces the entire interests section.",
                items: {
                    type: "object",
                    properties: {
                        id: { type: "string", description: "Optional ID" },
                        name: { type: "string" },
                        keywords: { type: "array", items: { type: "string" } },
                        visible: { type: "boolean" }
                    },
                    required: ["name"] // Mark required fields
                }
            },
            publications: {
                type: "array",
                description: "List of publications. Replaces the entire publications section.",
                items: {
                    type: "object",
                    properties: {
                        id: { type: "string", description: "Optional ID" },
                        name: { type: "string" },
                        publisher: { type: "string" },
                        date: { type: "string" },
                        summary: { type: "string" },
                        visible: { type: "boolean" },
                        url: { oneOf: [{ type: "string" }, { type: "object", properties: { label: { type: "string" }, href: { type: "string" } } }] }
                    },
                    required: ["name", "publisher", "date"] // Mark required fields
                }
            },
            references: {
                type: "array",
                description: "List of references. Replaces the entire references section.",
                items: {
                    type: "object",
                    properties: {
                        id: { type: "string", description: "Optional ID" },
                        name: { type: "string" },
                        description: { type: "string" },
                        summary: { type: "string" },
                        visible: { type: "boolean" },
                        url: { oneOf: [{ type: "string" }, { type: "object", properties: { label: { type: "string" }, href: { type: "string" } } }] }
                    },
                    required: ["name"] // Mark required fields
                }
            }
        },
        required: []
    }
};
