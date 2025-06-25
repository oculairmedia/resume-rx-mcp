// Letta-specific imports removed
// Crawl4AI Tools (Removed)
// import { handleCrawl4aiBasicCrawl, crawl4aiBasicCrawlDefinition } from './crawl4ai-basic-crawl.js';
// import { handleCrawl4aiAdvancedCrawl, crawl4aiAdvancedCrawlDefinition } from './crawl4ai-advanced-crawl.js';
// import { handleCrawl4aiExtractLinks, crawl4aiExtractLinksDefinition } from './crawl4ai-extract-links.js';
// import { handleCrawl4aiExtractMedia, crawl4aiExtractMediaDefinition } from './crawl4ai-extract-media.js';
// import { handleCrawl4aiMultiCrawl, crawl4aiMultiCrawlDefinition } from './crawl4ai-multi-crawl.js';
// Resume Tools
import { downloadResumePdfTool, downloadResumePdf } from './download_resume_pdf_tool.js';
import { updateLanguagesTool, updateLanguages } from './update_languages_tool.js';
import { updateInterestsTool, updateInterests } from './update_interests_tool.js';
import { updateAwardsTool, updateAwards } from './update_awards_tool.js';
import { updateProfilesTool, updateProfiles } from './update_profiles_tool.js';
import { updateVolunteerTool, updateVolunteer } from './update_volunteer_tool.js';
import { updateEducationTool, updateEducation } from './update_education_tool.js';
import { getResumeTool, getResume } from './get_resume_tool.js';
import { readResumeSectionTool, readResumeSection } from './read_resume_section_tool.js';
import { listResumesTool, listResumes } from './list_resumes_tool.js';
import { updateSkillsTool, updateSkills } from './update_skills_tool.js';
import { updateCertificationsTool, updateCertifications } from './update_certifications_tool.js';
import { updateSummaryTool, updateSummary } from './update_summary_tool.js';
import { createAndUpdateResumeTool, createAndUpdateResume } from './create_and_update_resume_tool.js';
import { updateExperienceTool, updateExperience } from './update_experience_tool.js';
import { updateProjectsTool, updateProjects } from './update_projects_tool.js';
import { updatePublicationsTool, updatePublications } from './update_publications_tool.js';
import { updateReferencesTool, updateReferences } from './update_references_tool.js';
// import { cloneResumeTool, cloneResume } from './clone_resume_tool.js'; // Added import
// Removed import for add-mcp-tool-to-letta.js
import { CallToolRequestSchema, ListToolsRequestSchema, McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

/**
 * Register all tool handlers with the server
 * @param {Object} server - The LettaServer instance (should likely be typed more specifically if possible)
 */
export function registerToolHandlers(server) {
    // Register tool definitions
    server.server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: [
            // Letta-specific tool definitions removed
            // Crawl4AI Tools (Removed)
            // crawl4aiBasicCrawlDefinition,
            // crawl4aiAdvancedCrawlDefinition,
            // crawl4aiExtractLinksDefinition,
            // crawl4aiExtractMediaDefinition,
            // crawl4aiMultiCrawlDefinition,
            // Resume Tools
            downloadResumePdfTool,
            updateInterestsTool,
            getResumeTool,
            readResumeSectionTool,
            listResumesTool,
            updateSkillsTool,
            updateCertificationsTool,
            updateSummaryTool,
            createAndUpdateResumeTool,
            updateExperienceTool,
            updateEducationTool,
            updateProjectsTool,
            updateProfilesTool,
            updateAwardsTool,
            updateVolunteerTool,
            updateLanguagesTool,
            updatePublicationsTool,
            updateReferencesTool,
            // cloneResumeTool, // Added tool definition
            // Removed addMcpToolToLettaDefinition from list
        ],
    }));

    // Helper function to wrap tool results/errors in MCP format
    async function executeAndFormat(toolFunction, args) {
        try {
            const result = await toolFunction(args);
            // Check if the result itself indicates an error (as returned by the tool functions)
            if (result && result.error) {
                 console.error(`Tool execution failed: ${result.error}`);
                 // Format the tool's error message for MCP response
                 return {
                     content: [{ type: 'text', text: JSON.stringify({ success: false, error: result.error }) }],
                     isError: true // Indicate it's an error response
                 };
            }
            // Format successful result for MCP response
            return {
                content: [{ type: 'text', text: JSON.stringify(result) }]
            };
        } catch (error) {
            // Catch unexpected errors during execution
            console.error(`Unexpected error executing tool: ${error.message}`);
            // Format unexpected error for MCP response
            return {
                content: [{ type: 'text', text: JSON.stringify({ success: false, error: `Unexpected error: ${error.message}` }) }],
                isError: true
            };
        }
    }

    server.server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const args = request.params.arguments;
        switch (request.params.name) {
            // Letta-specific tool cases removed
            // Crawl4AI Tools (Removed)

            // Resume Tools
            case 'download_resume_pdf':
                return executeAndFormat(downloadResumePdf, args);
            case 'update_interests':
                return executeAndFormat(updateInterests, args);
            case 'get_resume':
                return executeAndFormat(getResume, args);
            case 'read_resume_section':
                return executeAndFormat(readResumeSection, args);
            case 'list_resumes':
                return executeAndFormat(listResumes, args);
            case 'update_skills':
                return executeAndFormat(updateSkills, args);
            case 'update_certifications':
                return executeAndFormat(updateCertifications, args);
            case 'update_summary':
                return executeAndFormat(updateSummary, args);
            case 'update_experience':
                return executeAndFormat(updateExperience, args);
            case 'create_and_update_resume':
                return executeAndFormat(createAndUpdateResume, args);
            case 'update_education':
                return executeAndFormat(updateEducation, args);
            case 'update_projects':
                return executeAndFormat(updateProjects, args);
            case 'update_profiles':
                return executeAndFormat(updateProfiles, args);
            case 'update_awards':
                return executeAndFormat(updateAwards, args);
            case 'update_volunteer':
                return executeAndFormat(updateVolunteer, args);
            case 'update_languages':
                return executeAndFormat(updateLanguages, args);
            case 'update_publications':
                return executeAndFormat(updatePublications, args);
            case 'update_references':
                return executeAndFormat(updateReferences, args);
            // case 'clone_resume': // Added case for clone_resume
            //     return executeAndFormat(cloneResume, args);

            // Removed case 'add_mcp_tool_to_letta'
            default:
                // Use the helper to format the MethodNotFound error correctly
                return {
                     content: [{ type: 'text', text: JSON.stringify({ success: false, error: `Unknown tool: ${request.params.name}` }) }],
                     isError: true,
                     // Optionally include McpError details if needed by the client,
                     // but the basic structure above is usually sufficient.
                     // errorDetails: new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`)
                };
                // Original throw:
                // throw new McpError(
                //     ErrorCode.MethodNotFound,
                //     `Unknown tool: ${request.params.name}`
                // );
        }
    });
}

// Export all tool definitions
export const toolDefinitions = [
    // Letta-specific definitions removed
    // Crawl4AI Tools (Removed)
    // crawl4aiBasicCrawlDefinition,
    // crawl4aiAdvancedCrawlDefinition,
    // crawl4aiExtractLinksDefinition,
    // crawl4aiExtractMediaDefinition,
    // crawl4aiMultiCrawlDefinition,
    // Resume Tools
    downloadResumePdfTool,
    updateInterestsTool,
    getResumeTool,
    readResumeSectionTool,
    listResumesTool,
    updateSkillsTool,
    updateCertificationsTool,
    updateSummaryTool,
    createAndUpdateResumeTool,
    updateExperienceTool,
    updateEducationTool,
    updateProjectsTool,
    updateProfilesTool,
    updateAwardsTool,
    updateVolunteerTool,
    updateLanguagesTool,
    updatePublicationsTool,
    updateReferencesTool,
    // cloneResumeTool, // Added tool definition to export
    // Removed addMcpToolToLettaDefinition from export
];

// Export all tool handlers
export const toolHandlers = {
    // Letta-specific handlers removed
    // Crawl4AI Tools (Removed)
    // handleCrawl4aiBasicCrawl,
    // handleCrawl4aiAdvancedCrawl,
    // handleCrawl4aiExtractLinks,
    // handleCrawl4aiExtractMedia,
    // handleCrawl4aiMultiCrawl,
    // Resume Tools
    downloadResumePdf,
    updateInterests,
    getResume,
    readResumeSection,
    listResumes,
    updateSkills,
    updateCertifications,
    updateSummary,
    createAndUpdateResume,
    updateExperience,
    updateEducation,
    updateProjects,
    updateProfiles,
    updateAwards,
    updateVolunteer,
    updateLanguages,
    updatePublications,
    updateReferences,
    // cloneResume, // Added tool handler to export
    // Removed handleAddMcpToolToLetta from export
};