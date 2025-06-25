import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import { v4 as uuidv4 } from 'uuid';

/**
 * Updates the publications section of an existing resume in Reactive Resume.
 * Supports adding and removing publications with flat fields.
 * 
 * @param {object} params - Parameters object
 * @returns {Promise<object>} - Promise resolving to result object
 */
export async function updatePublications({
  resume_id,
  operation,
  name,
  publisher,
  date,
  summary,
  url_label,
  url_href,
  visible = true,
  item_id,
  email,
  password,
  base_url
}) {
  // Configuration
  const apiEmail = email || process.env.RX_EMAIL || "emanuvaderland@gmail.com";
  const apiPassword = password || process.env.RX_PASSWORD || "E4YSj9UiVuSB3uJ";
  const apiUrl = base_url || process.env.RX_BASE_URL || "https://resume.emmanuelu.com/api";
  
  console.log("Using authentication with email:", apiEmail);
  console.log("Using base URL:", apiUrl);
  
  // Create axios instance with cookie support
  const jar = new CookieJar();
  const axiosInstance = wrapper(axios.create({ jar }));
  
  try {
    // Validate inputs
    if (!resume_id) throw new Error("Resume ID is required");
    if (!operation) throw new Error("Operation is required");
    
    const validOperations = ["add", "remove"];
    if (!validOperations.includes(operation)) {
      throw new Error(`Invalid operation '${operation}'. Must be one of: ${validOperations.join(', ')}`);
    }

    if (operation === "add") {
      if (!name) throw new Error("Name is required for adding a publication");
      if (!publisher) throw new Error("Publisher is required for adding a publication");
      if (!date) throw new Error("Date is required for adding a publication");
    } else if (operation === "remove") {
      if (!item_id) throw new Error("Item ID is required for removing a publication");
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

    // Create a deep copy of the resume object
    const updatePayload = JSON.parse(JSON.stringify(resume));
    
    // Ensure the publications section exists with proper structure
    if (!updatePayload.data.sections.publications) {
      updatePayload.data.sections.publications = {
        name: "Publications",
        columns: 1,
        separateLinks: true,
        visible: true,
        id: "publications",
        items: []
      };
    }

    // Generate a CUID2-like ID
    const generateCuid2 = () => {
      return `c${Array.from({length: 23}, () => 
        "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]
      ).join('')}`;
    };

    if (operation === "add") {
      // Create new publication item
      const newItem = {
        id: generateCuid2(),
        visible: visible !== false,
        name: name,
        publisher: publisher,
        date: date,
        summary: summary ? (summary.startsWith("<p>") ? summary : `<p>${summary}</p>`) : "",
        url: (url_label || url_href) ? {
          label: url_label || "",
          href: url_href || ""
        } : { label: "", href: "" }
      };
      
      console.log("Adding publication item:", JSON.stringify(newItem, null, 2));
      updatePayload.data.sections.publications.items.push(newItem);
    } else if (operation === "remove") {
      // Remove publication with matching item_id
      const originalLength = updatePayload.data.sections.publications.items.length;
      updatePayload.data.sections.publications.items = updatePayload.data.sections.publications.items.filter(item => item.id !== item_id);
      
      if (updatePayload.data.sections.publications.items.length === originalLength) {
        console.warn(`Publication with ID '${item_id}' not found or already removed.`);
      }
    }

    // Update the resume
    console.log("Updating resume with publications section:", JSON.stringify(updatePayload.data.sections.publications, null, 2));
    const updateResponse = await axiosInstance.patch(resumeUrl, updatePayload, { 
      headers: { "Content-Type": "application/json" }
    });
    
    if (updateResponse.status !== 200) {
      throw new Error(`Failed to update resume: ${updateResponse.status}`);
    }

    // Verify the update
    console.log("Verifying update...");
    const verifyResponse = await axiosInstance.get(resumeUrl);
    const updatedPublications = verifyResponse.data.data.sections.publications;
    
    if (operation === "add") {
      const addedPublication = updatedPublications.items.find(item => 
        item.name === name && 
        item.publisher === publisher
      );
      
      if (!addedPublication) {
        console.warn("Warning: Publication may not have been added successfully!");
      } else {
        console.log("Publication added successfully:", addedPublication);
      }
    }

    return {
      success: true,
      message: operation === 'add' ? 
        'Publication added successfully' : 
        'Publication removed successfully',
      resume_id: resume_id,
      operation: operation,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('Error in updatePublications:', error);
    return {
      success: false,
      message: `Failed to ${operation} publication: ${error.message}`
    };
  }
}

export const updatePublicationsTool = {
  name: 'update_publications',
  description: "Updates ('add', 'remove') publications in the publications section of an existing resume. Uses flat fields.",
  execute: updatePublications,
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
        description: 'Operation to perform'
      },
      name: {
        type: 'string',
        description: 'Name/title of the publication'
      },
      publisher: {
        type: 'string',
        description: 'Publisher of the work'
      },
      date: {
        type: 'string',
        description: 'Publication date (YYYY or YYYY-MM)'
      },
      summary: {
        type: 'string',
        description: 'Optional description or summary of the publication'
      },
      url_label: {
        type: 'string',
        description: 'Optional label for the URL'
      },
      url_href: {
        type: 'string',
        description: 'Optional URL to the publication'
      },
      visible: {
        type: 'boolean',
        description: 'Item visibility (default: true)'
      },
      item_id: {
        type: 'string',
        description: 'Item ID (required for remove operations)'
      },
      email: {
        type: 'string',
        description: 'Optional: Override default email'
      },
      password: {
        type: 'string',
        description: 'Optional: Override default password'
      },
      base_url: {
        type: 'string',
        description: 'Optional: Override default API URL'
      }
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
          required: ['name', 'publisher', 'date']
        }
      }
    ]
  }
};