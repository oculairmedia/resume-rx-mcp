import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import { v4 as uuidv4 } from 'uuid';

/**
 * Updates awards in a resume
 * @param {Object} args - Tool arguments
 * @returns {Promise<Object>} Result of the operation
 */
async function updateAwards(args) {
    const {
        resume_id,
        operation,
        title,
        date,
        awarder,
        summary,
        url_label,
        url_href,
        visible = true,
        item_id,
        email,
        password,
        base_url
    } = args;

    // Configuration
    const apiEmail = email || process.env.RX_EMAIL || "emanuvaderland@gmail.com";
    const apiPassword = password || process.env.RX_PASSWORD || "E4YSj9UiVuSB3uJ";
    const apiUrl = base_url || process.env.RX_BASE_URL || "https://resume.emmanuelu.com/api";
    
    console.log("Using authentication with email:", apiEmail);
    console.log("Using base URL:", apiUrl);

    try {
        // Setup axios instance with cookie support
        const jar = new CookieJar();
        const axiosInstance = wrapper(axios.create({ jar }));

        // Validate inputs
        if (!resume_id) throw new Error("Resume ID is required");
        if (!operation) throw new Error("Operation is required");
        
        const validOperations = ["add", "remove"];
        if (!validOperations.includes(operation)) {
            throw new Error(`Invalid operation '${operation}'. Must be one of: ${validOperations.join(', ')}`);
        }

        if (operation === "add") {
            if (!title) throw new Error("Title is required for adding an award");
            if (!date) throw new Error("Date is required for adding an award");
            if (!awarder) throw new Error("Awarder is required for adding an award");
        } else if (operation === "remove") {
            if (!item_id) throw new Error("Item ID is required for removing an award");
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
        const resumeUrl = `${apiUrl}/resume/${resume_id}`;
        console.log("Fetching resume from:", resumeUrl);
        const { data: resume } = await axiosInstance.get(resumeUrl);

        // Initialize awards section if it doesn't exist
        if (!resume.data.sections.awards) {
            resume.data.sections.awards = {
                name: "Awards",
                columns: 1,
                separateLinks: true,
                visible: true,
                id: "awards",
                items: []
            };
        }

        // Create a deep copy of the resume object
        const updatePayload = JSON.parse(JSON.stringify(resume));
        const awardsSection = updatePayload.data.sections.awards;

        if (operation === "add") {
            // Generate a CUID2-like ID
            const generateCuid2 = () => {
                return `c${uuidv4().replace(/-/g, '').substring(0, 23)}`;
            };

            // Create new award item
            const awardItem = {
                id: generateCuid2(),
                visible: visible !== false,
                title: title,
                date: date,
                awarder: awarder,
                summary: summary || "",
                url: url_label || url_href ? {
                    label: url_label || "",
                    href: url_href || ""
                } : null
            };
            
            console.log("Adding award item:", JSON.stringify(awardItem, null, 2));
            awardsSection.items.push(awardItem);
        } else if (operation === "remove") {
            // Remove award with matching item_id
            const originalLength = awardsSection.items.length;
            awardsSection.items = awardsSection.items.filter(item => item.id !== item_id);
            
            if (awardsSection.items.length === originalLength) {
                console.warn(`Award with ID '${item_id}' not found or already removed.`);
            }
        }

        // Update the resume
        console.log("Updating resume with awards section:", JSON.stringify(awardsSection, null, 2));
        const updateResponse = await axiosInstance.patch(resumeUrl, updatePayload, { 
            headers: { "Content-Type": "application/json" }
        });
        
        if (updateResponse.status !== 200) {
            throw new Error(`Failed to update resume: ${updateResponse.status}`);
        }

        // Verify the update
        console.log("Verifying update...");
        const verifyResponse = await axiosInstance.get(resumeUrl);
        const updatedAwards = verifyResponse.data.data.sections.awards;
        
        if (operation === "add") {
            const addedAward = updatedAwards.items.find(item => 
                item.title === title && 
                item.awarder === awarder
            );
            
            if (!addedAward) {
                console.warn("Warning: Award may not have been added successfully!");
            } else {
                console.log("Award added successfully:", addedAward);
            }
        }

        return {
            success: true,
            message: `Award ${operation === 'remove' ? 'removed' : 'added'} successfully.`,
            resume_id: resume_id,
            operation: operation,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error('Error updating awards:', error);
        return {
            success: false,
            message: `Failed to ${operation} award: ${error.message}`
        };
    }
}

const updateAwardsTool = {
    name: 'update_awards',
    description: "Updates ('add', 'remove') awards in the awards section of an existing resume. Uses flat fields.",
    inputSchema: {
        type: 'object',
        properties: {
            resume_id: {
                type: 'string',
                description: 'ID of the resume to update'
            },
            operation: {
                type: 'string',
                enum: ['add', 'remove'],
                description: "Operation to perform ('add' or 'remove')"
            },
            title: {
                type: 'string',
                description: 'Title of the award'
            },
            date: {
                type: 'string',
                description: 'Date the award was received'
            },
            awarder: {
                type: 'string',
                description: 'Organization that gave the award'
            },
            summary: {
                type: 'string',
                description: 'Description of the award'
            },
            url_label: {
                type: 'string',
                description: 'Label for the award URL'
            },
            url_href: {
                type: 'string',
                description: 'URL link for the award'
            },
            visible: {
                type: 'boolean',
                description: 'Whether the award is visible on the resume',
                default: true
            },
            item_id: {
                type: 'string',
                description: 'ID of the award to remove (required for remove operation)'
            },
            email: {
                type: 'string',
                description: 'Reactive Resume email (Optional, uses env var)'
            },
            password: {
                type: 'string',
                description: 'Reactive Resume password (Optional, uses env var)'
            },
            base_url: {
                type: 'string',
                description: 'Reactive Resume API URL (Optional)',
                default: 'https://resume.emmanuelu.com/api'
            }
        },
        required: ['resume_id', 'operation'],
        allOf: [
            {
                if: { properties: { operation: { const: 'remove' } } },
                then: { required: ['item_id'] }
            },
            {
                if: { properties: { operation: { const: 'add' } } },
                then: { required: ['title', 'date', 'awarder'] }
            }
        ]
    },
    execute: updateAwards
};

export { updateAwards, updateAwardsTool };