import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import { v4 as uuidv4 } from 'uuid';

/**
 * Updates the references section of an existing resume in Reactive Resume.
 * Supports adding and removing references with flat fields.
 *
 * @param {object} params - Parameters object.
 * @returns {Promise<object>} - Promise resolving to result object or error object.
 */
export async function updateReferences(params = {}) {
    // Configuration
    const apiEmail = params.email || process.env.RX_EMAIL || "emanuvaderland@gmail.com";
    const apiPassword = params.password || process.env.RX_PASSWORD || "E4YSj9UiVuSB3uJ";
    const apiUrl = params.base_url || process.env.RX_BASE_URL || "https://resume.emmanuelu.com/api";
    
    console.log("Using authentication with email:", apiEmail);
    console.log("Using base URL:", apiUrl);
    
    // Create axios instance with cookie support
    const jar = new CookieJar();
    const axiosInstance = wrapper(axios.create({ jar }));
    
    try {
        // Validate inputs
        if (!params.resume_id) throw new Error("Resume ID is required");
        if (!params.operation) throw new Error("Operation is required");
        
        const validOperations = ["add", "remove"];
        if (!validOperations.includes(params.operation)) {
            throw new Error(`Invalid operation '${params.operation}'. Must be one of: ${validOperations.join(', ')}`);
        }

        if (params.operation === "add") {
            if (!params.name) throw new Error("Name is required for adding a reference");
        } else if (params.operation === "remove") {
            if (!params.item_id) throw new Error("Item ID is required for removing a reference");
        }

        // Authenticate
        const authUrl = `${apiUrl}/auth/login`;
        const authPayload = {
            identifier: apiEmail,
            password: apiPassword
        };
        const authHeaders = {
            "Content-Type": "application/json"
        };
        
        console.log("Authenticating with:", JSON.stringify(authPayload, null, 2));
        console.log("Auth URL:", authUrl);
        const authResponse = await axiosInstance.post(authUrl, authPayload, { headers: authHeaders });
        
        if (authResponse.status !== 200) {
            throw new Error(`Authentication failed with status code ${authResponse.status}`);
        }

        // Get current resume data
        const resumeUrl = `${apiUrl}/resume/${params.resume_id}`;
        console.log("Fetching resume from:", resumeUrl);
        const { data: resume } = await axiosInstance.get(resumeUrl);

        // Create a deep copy of the resume object
        const updatePayload = JSON.parse(JSON.stringify(resume));
        
        // Ensure the references section exists with proper structure
        if (!updatePayload.data.sections.references) {
            updatePayload.data.sections.references = {
                name: "References",
                columns: 1,
                separateLinks: true,
                visible: true,
                id: "references",
                items: []
            };
        }

        // Generate a CUID2-like ID
        const generateCuid2 = () => {
            return `c${Array.from({length: 23}, () => 
                "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]
            ).join('')}`;
        };

        if (params.operation === "add") {
            // Create new reference item
            const newItem = {
                id: generateCuid2(),
                visible: params.visible !== false,
                name: params.name,
                description: params.description || "",
                summary: params.summary ? (params.summary.startsWith("<p>") ? params.summary : `<p>${params.summary}</p>`) : "",
                url: {
                    label: params.url_label || "",
                    href: params.url_href || ""
                }
            };
            
            console.log("Adding reference item:", JSON.stringify(newItem, null, 2));
            updatePayload.data.sections.references.items.push(newItem);
        } else if (params.operation === "remove") {
            // Remove reference with matching item_id
            const originalLength = updatePayload.data.sections.references.items.length;
            updatePayload.data.sections.references.items = updatePayload.data.sections.references.items.filter(item => item.id !== params.item_id);
            
            if (updatePayload.data.sections.references.items.length === originalLength) {
                console.warn(`Reference with ID '${params.item_id}' not found or already removed.`);
            }
        }

        // Update the resume
        console.log("Updating resume with references section:", JSON.stringify(updatePayload.data.sections.references, null, 2));
        const updateResponse = await axiosInstance.patch(resumeUrl, updatePayload, { 
            headers: { "Content-Type": "application/json" }
        });
        
        if (updateResponse.status !== 200) {
            throw new Error(`Failed to update resume: ${updateResponse.status}`);
        }

        // Verify the update
        console.log("Verifying update...");
        const verifyResponse = await axiosInstance.get(resumeUrl);
        const updatedReferences = verifyResponse.data.data.sections.references;
        
        if (params.operation === "add") {
            const addedReference = updatedReferences.items.find(item => 
                item.name === params.name
            );
            
            if (!addedReference) {
                console.warn("Warning: Reference may not have been added successfully!");
            } else {
                console.log("Reference added successfully:", addedReference);
            }
        }

        return {
            success: true,
            message: `Reference ${params.operation === 'remove' ? 'removed' : 'added'} successfully.`,
            resume_id: params.resume_id,
            operation: params.operation,
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error(`Error in updateReferences: ${error.message}`);
        return { 
            success: false,
            message: `Failed to ${params.operation} reference: ${error.message}`
        };
    }
}

// --- Tool Definition ---
export const updateReferencesTool = {
    name: "update_references",
    description: "Updates ('add', 'remove') references in the references section of an existing resume. Uses flat fields.",
    execute: updateReferences,
    inputSchema: {
        type: "object",
        properties: {
            resume_id: { type: "string", description: "ID of the resume to update" },
            operation: { type: "string", enum: ["add", "remove"], description: "Operation to perform" },
            name: { type: "string", description: "Name of the reference" },
            description: { type: "string", description: "Optional description of the reference (e.g., relationship)" },
            summary: { type: "string", description: "Optional summary/details" },
            url_label: { type: "string", description: "Optional label for the reference URL" },
            url_href: { type: "string", description: "Optional URL for the reference" },
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
                then: { required: ["name"] }
            }
        ]
    }
};