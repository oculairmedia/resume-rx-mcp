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
 * A simplified tool to create and update resumes with minimal input
 * 
 * @param {object} params - Parameters object
 * @param {string} [params.resume_id] - Optional. The UUID of an existing resume to update. If not provided, a new resume will be created.
 * @param {string} [params.title] - Optional. The title of the resume (defaults to "My Professional Resume")
 * @param {string} [params.name] - Optional. The name for the resume owner
 * @param {string} [params.email] - Optional. The email for the resume owner
 * @param {string} [params.phone] - Optional. The phone number for the resume owner
 * @param {string} [params.website] - Optional. The website URL for the resume owner
 * @param {string} [params.summary] - Optional. Professional summary
 * @param {string} [params.objective] - Optional. Career objective
 * @param {string} [params.location] - Optional. Location (city, state, country)
 * @param {object[]} [params.experience] - Optional. Array of work experiences
 * @param {object[]} [params.education] - Optional. Array of education entries
 * @param {string[]} [params.skills] - Optional. Array of skills
 * @param {object[]} [params.projects] - Optional. Array of projects
 * @param {object[]} [params.certifications] - Optional. Array of certifications
 * @param {object[]} [params.profiles] - Optional. Array of social profiles
 * @returns {Promise<object>} - Promise resolving to result object
 */
export async function simpleResumeManager(params = {}) {
    // Create a cookie jar for this execution
    const cookieJar = new CookieJar();
    // Create an axios instance that uses the cookie jar
    const axiosInstance = axiosCookiejarSupport(axios.create({ jar: cookieJar }));

    try {
        // --- Authentication ---
        const email = DEFAULT_RX_EMAIL;
        const password = DEFAULT_RX_PASSWORD;
        const baseUrl = DEFAULT_RX_BASE_URL;
        const publicBaseUrl = DEFAULT_RX_PUBLIC_URL;

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

        // --- Helper Functions ---
        // Generate a simple ID
        const generateId = () => {
            return `clid${Date.now()}${Math.floor(Math.random() * 10000)}`;
        };

        // Format a date to human-readable format
        const formatDate = (dateStr) => {
            if (!dateStr) return "";
            try {
                const date = new Date(dateStr);
                return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
            } catch (e) {
                return dateStr;
            }
        };

        // Determine icon for social profile
        const getProfileIcon = (networkName) => {
            const networkLower = (networkName || "").toLowerCase();
            if (networkLower.includes("linkedin")) return "linkedin";
            if (networkLower.includes("github")) return "github";
            if (networkLower.includes("twitter") || networkLower.includes("x.com")) return "twitter";
            if (networkLower.includes("facebook")) return "facebook";
            if (networkLower.includes("instagram")) return "instagram";
            if (networkLower.includes("youtube")) return "youtube";
            if (networkLower.includes("medium")) return "medium";
            if (networkLower.includes("dribbble")) return "dribbble";
            if (networkLower.includes("behance")) return "behance";
            if (networkLower.includes("gitlab")) return "gitlab";
            if (networkLower.includes("stackoverflow")) return "stackoverflow";
            return "link"; // Default icon
        };

        // Format URL to object format
        const formatUrl = (url) => {
            if (!url) return { label: "", href: "" };
            if (typeof url === "string") {
                const href = url.startsWith("http://") || url.startsWith("https://") ? url : `https://${url}`;
                return { label: "", href };
            }
            return url;
        };

        // --- Create or Update Resume ---
        let resumeId = params.resume_id;
        let resumeData;

        if (resumeId) {
            // Update existing resume
            console.log(`Updating existing resume with ID: ${resumeId}`);
            
            // Get current resume data
            const resumeUrl = `${baseUrl}/resume/${resumeId}`;
            console.log(`Fetching current resume data from: ${resumeUrl}`);
            
            const resumeResponse = await axiosInstance.get(resumeUrl, {
                headers: { 'Content-Type': 'application/json' }
            });

            if (resumeResponse.status !== 200) {
                throw new Error(`Failed to get resume with status code ${resumeResponse.status}`);
            }

            resumeData = resumeResponse.data;
        } else {
            // Create a new resume
            console.log(`Creating a new resume`);
            
            // Generate a unique slug with timestamp
            const timestamp = Date.now();
            const randomId = uuidv4().substring(0, 8);
            const slug = `resume-${randomId}-${timestamp}`;
            
            const title = params.title || "My Professional Resume";
            const visibility = "public";
            
            const simpleResumeData = {
                title: title,
                slug: slug,
                visibility: visibility
            };
            
            const resumeUrl = `${baseUrl}/resume`;
            console.log(`Creating resume with data:`, JSON.stringify(simpleResumeData, null, 2));
            
            const resumeResponse = await axiosInstance.post(resumeUrl, simpleResumeData, {
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (resumeResponse.status !== 201) {
                throw new Error(`Failed to create resume with status code ${resumeResponse.status}`);
            }
            
            resumeData = resumeResponse.data;
            resumeId = resumeData.id;
            
            console.log(`Created new resume with ID: ${resumeId}`);
        }

        // --- Prepare Update Payload ---
        // Create a deep copy of the current resume
        const updatePayload = JSON.parse(JSON.stringify(resumeData));
        
        // Ensure data and sections exist
        if (!updatePayload.data) updatePayload.data = {};
        if (!updatePayload.data.basics) updatePayload.data.basics = {};
        if (!updatePayload.data.sections) updatePayload.data.sections = {};
        
        // --- Update Basic Information ---
        if (params.name) updatePayload.data.basics.name = params.name;
        if (params.email) updatePayload.data.basics.email = params.email;
        if (params.phone) updatePayload.data.basics.phone = params.phone;
        if (params.website) {
            const website = params.website;
            updatePayload.data.basics.website = website.startsWith("http://") || website.startsWith("https://") 
                ? website : `https://${website}`;
        }
        if (params.summary) updatePayload.data.basics.summary = params.summary;
        if (params.objective) updatePayload.data.basics.objective = params.objective;
        if (params.location) {
            if (!updatePayload.data.basics.location) updatePayload.data.basics.location = {};
            updatePayload.data.basics.location.address = params.location;
        }

        // --- Update Profiles ---
        if (params.profiles && params.profiles.length > 0) {
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
            
            // Process each profile
            params.profiles.forEach(profile => {
                if (!profile.network) return; // Skip if no network name
                
                // Find existing profile or create a new one
                let existingProfile = updatePayload.data.sections.profiles.items.find(
                    item => item.network === profile.network
                );
                
                if (!existingProfile) {
                    // Create new profile
                    existingProfile = {
                        id: generateId(),
                        network: profile.network,
                        username: profile.username || "",
                        icon: profile.icon || getProfileIcon(profile.network),
                        visible: true
                    };
                    updatePayload.data.sections.profiles.items.push(existingProfile);
                } else {
                    // Update existing profile
                    if (profile.username) existingProfile.username = profile.username;
                    if (profile.icon) existingProfile.icon = profile.icon;
                    else if (!existingProfile.icon) existingProfile.icon = getProfileIcon(profile.network);
                }
                
                // Update URL
                if (profile.url) {
                    existingProfile.url = formatUrl(profile.url);
                }
            });
        }

        // --- Update Skills ---
        if (params.skills && params.skills.length > 0) {
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
            
            // Process each skill
            params.skills.forEach(skill => {
                let skillName = "";
                let skillLevel = 0;
                let skillKeywords = [];
                
                // Handle different input formats
                if (typeof skill === "string") {
                    skillName = skill;
                } else if (typeof skill === "object") {
                    skillName = skill.name || "";
                    skillLevel = skill.level !== undefined ? skill.level : 0;
                    skillKeywords = skill.keywords || [];
                }
                
                if (!skillName) return; // Skip if no skill name
                
                // Find existing skill or create a new one
                let existingSkill = updatePayload.data.sections.skills.items.find(
                    item => item.name === skillName
                );
                
                if (!existingSkill) {
                    // Create new skill
                    existingSkill = {
                        id: generateId(),
                        name: skillName,
                        level: skillLevel,
                        keywords: skillKeywords,
                        visible: true
                    };
                    updatePayload.data.sections.skills.items.push(existingSkill);
                } else {
                    // Update existing skill
                    if (skillLevel !== 0) existingSkill.level = skillLevel;
                    if (skillKeywords.length > 0) existingSkill.keywords = skillKeywords;
                }
            });
        }

        // --- Update Education ---
        if (params.education && params.education.length > 0) {
            // Ensure education section exists
            if (!updatePayload.data.sections.education) {
                updatePayload.data.sections.education = {
                    name: "Education",
                    id: "education",
                    columns: 1,
                    visible: true,
                    items: []
                };
            }
            
            // Process each education entry
            params.education.forEach(edu => {
                if (!edu.institution) return; // Skip if no institution
                
                // Find existing education or create a new one
                let existingEdu = updatePayload.data.sections.education.items.find(
                    item => item.institution === edu.institution && item.degree === edu.degree
                );
                
                // Format dates
                let startDate = "";
                let endDate = "";
                
                if (edu.startDate) startDate = formatDate(edu.startDate);
                if (edu.endDate) endDate = formatDate(edu.endDate);
                
                // Handle date as a string (e.g., "2018 - 2022")
                let dateStr = "";
                if (edu.date) dateStr = edu.date;
                else if (startDate || endDate) {
                    dateStr = startDate && endDate ? `${startDate} - ${endDate}` : (startDate || endDate);
                }
                
                if (!existingEdu) {
                    // Create new education entry
                    existingEdu = {
                        id: generateId(),
                        institution: edu.institution,
                        degree: edu.degree || "",
                        area: edu.area || "",
                        score: edu.score || "",
                        date: dateStr,
                        url: formatUrl(edu.url),
                        summary: edu.summary || "",
                        studyType: edu.studyType || "Full-time",
                        visible: true
                    };
                    updatePayload.data.sections.education.items.push(existingEdu);
                } else {
                    // Update existing education entry
                    if (edu.degree) existingEdu.degree = edu.degree;
                    if (edu.area) existingEdu.area = edu.area;
                    if (edu.score) existingEdu.score = edu.score;
                    if (dateStr) existingEdu.date = dateStr;
                    if (edu.url) existingEdu.url = formatUrl(edu.url);
                    if (edu.summary) existingEdu.summary = edu.summary;
                    if (edu.studyType) existingEdu.studyType = edu.studyType;
                }
            });
        }

        // --- Update Experience ---
        if (params.experience && params.experience.length > 0) {
            // Ensure experience section exists
            if (!updatePayload.data.sections.experience) {
                updatePayload.data.sections.experience = {
                    name: "Experience",
                    id: "experience",
                    columns: 1,
                    visible: true,
                    items: []
                };
            }
            
            // Process each experience entry
            params.experience.forEach(exp => {
                if (!exp.company) return; // Skip if no company
                
                // Find existing experience or create a new one
                let existingExp = updatePayload.data.sections.experience.items.find(
                    item => item.company === exp.company && item.position === exp.position
                );
                
                // Format dates
                let startDate = "";
                let endDate = "";
                
                if (exp.startDate) startDate = formatDate(exp.startDate);
                if (exp.endDate) endDate = formatDate(exp.endDate);
                
                // Handle date as a string (e.g., "Jan 2018 - Present")
                let dateStr = "";
                if (exp.date) dateStr = exp.date;
                else if (startDate || endDate) {
                    dateStr = startDate && endDate ? `${startDate} - ${endDate}` : (startDate || endDate);
                }
                
                // Format summary to HTML if needed
                let summary = exp.summary || "";
                if (summary && !summary.includes("<p>") && !summary.includes("<ul>")) {
                    // Convert plain text to HTML paragraphs
                    summary = `<p>${summary.replace(/\\n/g, "</p><p>")}</p>`;
                }
                
                if (!existingExp) {
                    // Create new experience entry
                    existingExp = {
                        id: generateId(),
                        company: exp.company,
                        position: exp.position || "",
                        date: dateStr,
                        location: exp.location || "",
                        url: formatUrl(exp.url),
                        summary: summary,
                        visible: true
                    };
                    updatePayload.data.sections.experience.items.push(existingExp);
                } else {
                    // Update existing experience entry
                    if (exp.position) existingExp.position = exp.position;
                    if (dateStr) existingExp.date = dateStr;
                    if (exp.location) existingExp.location = exp.location;
                    if (exp.url) existingExp.url = formatUrl(exp.url);
                    if (summary) existingExp.summary = summary;
                }
            });
        }

        // --- Update Projects ---
        if (params.projects && params.projects.length > 0) {
            // Ensure projects section exists
            if (!updatePayload.data.sections.projects) {
                updatePayload.data.sections.projects = {
                    name: "Projects",
                    id: "projects",
                    columns: 1,
                    visible: true,
                    items: []
                };
            }
            
            // Process each project
            params.projects.forEach(project => {
                if (!project.name) return; // Skip if no project name
                
                // Find existing project or create a new one
                let existingProject = updatePayload.data.sections.projects.items.find(
                    item => item.name === project.name
                );
                
                // Format dates
                let startDate = "";
                let endDate = "";
                
                if (project.startDate) startDate = formatDate(project.startDate);
                if (project.endDate) endDate = formatDate(project.endDate);
                
                // Handle date as a string (e.g., "2018 - 2022")
                let dateStr = "";
                if (project.date) dateStr = project.date;
                else if (startDate || endDate) {
                    dateStr = startDate && endDate ? `${startDate} - ${endDate}` : (startDate || endDate);
                }
                
                // Format summary to HTML if needed
                let summary = project.summary || "";
                if (summary && !summary.includes("<p>") && !summary.includes("<ul>")) {
                    // Convert plain text to HTML paragraphs
                    summary = `<p>${summary.replace(/\\n/g, "</p><p>")}</p>`;
                }
                
                if (!existingProject) {
                    // Create new project
                    existingProject = {
                        id: generateId(),
                        name: project.name,
                        description: project.description || "",
                        date: dateStr,
                        url: formatUrl(project.url),
                        summary: summary,
                        visible: true
                    };
                    updatePayload.data.sections.projects.items.push(existingProject);
                } else {
                    // Update existing project
                    if (project.description) existingProject.description = project.description;
                    if (dateStr) existingProject.date = dateStr;
                    if (project.url) existingProject.url = formatUrl(project.url);
                    if (summary) existingProject.summary = summary;
                }
            });
        }

        // --- Update Certifications ---
        if (params.certifications && params.certifications.length > 0) {
            // Ensure certifications section exists
            if (!updatePayload.data.sections.certifications) {
                updatePayload.data.sections.certifications = {
                    name: "Certifications",
                    id: "certifications",
                    columns: 1,
                    visible: true,
                    items: []
                };
            }
            
            // Process each certification
            params.certifications.forEach(cert => {
                if (!cert.name) return; // Skip if no certification name
                
                // Find existing certification or create a new one
                let existingCert = updatePayload.data.sections.certifications.items.find(
                    item => item.name === cert.name
                );
                
                // Handle issuer/authority field
                const issuer = cert.issuer || cert.authority || "";
                
                // Format date
                const dateStr = cert.date ? formatDate(cert.date) : "";
                
                if (!existingCert) {
                    // Create new certification
                    existingCert = {
                        id: generateId(),
                        name: cert.name,
                        issuer: issuer,
                        date: dateStr,
                        url: formatUrl(cert.url),
                        summary: cert.summary || "",
                        visible: true
                    };
                    updatePayload.data.sections.certifications.items.push(existingCert);
                } else {
                    // Update existing certification
                    if (issuer) existingCert.issuer = issuer;
                    if (dateStr) existingCert.date = dateStr;
                    if (cert.url) existingCert.url = formatUrl(cert.url);
                    if (cert.summary) existingCert.summary = cert.summary;
                }
            });
        }

        // --- Update Resume ---
        console.log(`Updating resume with prepared data...`);
        
        const updateUrl = `${baseUrl}/resume/${resumeId}`;
        const updateResponse = await axiosInstance.patch(updateUrl, updatePayload, {
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (updateResponse.status !== 200) {
            throw new Error(`Failed to update resume with status code ${updateResponse.status}`);
        }
        
        const updatedResume = updateResponse.data;
        
        // --- Format Success Response ---
        const publicUrl = updatedResume.visibility === "public" && updatedResume.slug
            ? `${publicBaseUrl}/r/${updatedResume.slug}`
            : null;
            
        return {
            success: true,
            message: resumeId ? `Resume updated successfully` : `Resume created and updated successfully`,
            id: updatedResume.id,
            title: updatedResume.title,
            slug: updatedResume.slug,
            public_url: publicUrl,
            timestamp: new Date().toISOString()
        };
        
    } catch (error) {
        console.error(`Error in simpleResumeManager:`, error.message);
        
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
export const simpleResumeManagerTool = {
    name: "simple_resume_manager",
    description: "A simplified tool to create and update resumes with minimal input",
    execute: simpleResumeManager,
    inputSchema: {
        type: "object",
        properties: {
            resume_id: { 
                type: "string", 
                description: "ID of an existing resume to update (Optional, if not provided a new resume will be created)" 
            },
            title: { 
                type: "string", 
                description: "Title of the resume (Optional)" 
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
            objective: { 
                type: "string", 
                description: "Career objective (Optional)" 
            },
            location: { 
                type: "string", 
                description: "Location (city, state, country) (Optional)" 
            },
            experience: { 
                type: "array", 
                description: "Array of work experiences (Optional)",
                items: {
                    type: "object",
                    properties: {
                        company: { type: "string", description: "Company name" },
                        position: { type: "string", description: "Job title" },
                        startDate: { type: "string", description: "Start date (ISO format)" },
                        endDate: { type: "string", description: "End date (ISO format)" },
                        date: { type: "string", description: "Date range as string (alternative to startDate/endDate)" },
                        location: { type: "string", description: "Job location" },
                        url: { type: "string", description: "Company website URL" },
                        summary: { type: "string", description: "Job description" }
                    }
                }
            },
            education: { 
                type: "array", 
                description: "Array of education entries (Optional)",
                items: {
                    type: "object",
                    properties: {
                        institution: { type: "string", description: "School/university name" },
                        degree: { type: "string", description: "Degree obtained" },
                        area: { type: "string", description: "Field of study" },
                        score: { type: "string", description: "GPA or grade" },
                        startDate: { type: "string", description: "Start date (ISO format)" },
                        endDate: { type: "string", description: "End date (ISO format)" },
                        date: { type: "string", description: "Date range as string (alternative to startDate/endDate)" },
                        url: { type: "string", description: "Institution website URL" },
                        summary: { type: "string", description: "Additional information" },
                        studyType: { type: "string", description: "Type of study (e.g., Full-time)" }
                    }
                }
            },
            skills: { 
                type: "array", 
                description: "Array of skills (can be strings or objects) (Optional)",
                items: {
                    oneOf: [
                        { type: "string" },
                        { 
                            type: "object",
                            properties: {
                                name: { type: "string", description: "Skill name" },
                                level: { type: "number", description: "Skill level (0-5)" },
                                keywords: { 
                                    type: "array", 
                                    description: "Related keywords",
                                    items: { type: "string" }
                                }
                            }
                        }
                    ]
                }
            },
            projects: { 
                type: "array", 
                description: "Array of projects (Optional)",
                items: {
                    type: "object",
                    properties: {
                        name: { type: "string", description: "Project name" },
                        description: { type: "string", description: "Short description" },
                        startDate: { type: "string", description: "Start date (ISO format)" },
                        endDate: { type: "string", description: "End date (ISO format)" },
                        date: { type: "string", description: "Date range as string (alternative to startDate/endDate)" },
                        url: { type: "string", description: "Project URL" },
                        summary: { type: "string", description: "Detailed description" }
                    }
                }
            },
            certifications: { 
                type: "array", 
                description: "Array of certifications (Optional)",
                items: {
                    type: "object",
                    properties: {
                        name: { type: "string", description: "Certification name" },
                        issuer: { type: "string", description: "Issuing organization" },
                        authority: { type: "string", description: "Alternative field for issuer" },
                        date: { type: "string", description: "Date obtained" },
                        url: { type: "string", description: "Certification URL" },
                        summary: { type: "string", description: "Additional information" }
                    }
                }
            },
            profiles: { 
                type: "array", 
                description: "Array of social profiles (Optional)",
                items: {
                    type: "object",
                    properties: {
                        network: { type: "string", description: "Network name (e.g., LinkedIn, GitHub)" },
                        username: { type: "string", description: "Username on the network" },
                        url: { type: "string", description: "Profile URL" },
                        icon: { type: "string", description: "Icon name (Optional, will be auto-detected)" }
                    }
                }
            }
        }
    }
};
