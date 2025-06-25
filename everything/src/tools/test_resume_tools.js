#!/usr/bin/env node

import { createResumeTool } from './create_resume_tool.js';
import { updateResumeSectionTool } from './update_resume_section_tool.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env file
dotenv.config();

// Get the directory name of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Default auth parameters
const DEFAULT_AUTH = {
    email: process.env.RX_EMAIL,
    password: process.env.RX_PASSWORD,
    base_url: process.env.RX_BASE_URL || "https://resume.emmanuelu.com/api"
};

// Test functions
async function testCreateResume() {
    console.log("\n=== Testing Create Resume Tool ===");

    const params = {
        title: `Test Resume ${new Date().toLocaleString()}`,
        slug: `test-resume-${Date.now()}`,
        auth: DEFAULT_AUTH
    };

    try {
        console.log("Creating resume with params:", JSON.stringify(params, null, 2));
        const result = await createResumeTool.execute(params);
        console.log("Result:", JSON.stringify(result, null, 2));

        // Return the resume ID for further testing
        return result.id;
    } catch (error) {
        console.error("Error creating resume:", error);
        return null;
    }
}

async function testUpdateSummary(resumeId) {
    console.log("\n=== Testing Update Summary Section ===");

    const params = {
        resume_id: resumeId,
        section_name: "summary",
        operation: "update",
        data: {
            content: `This is a test summary created at ${new Date().toLocaleString()}`
        },
        auth: DEFAULT_AUTH
    };

    try {
        console.log("Updating summary with params:", JSON.stringify(params, null, 2));
        const result = await updateResumeSectionTool.execute(params);
        console.log("Result:", JSON.stringify(result, null, 2));
        return true;
    } catch (error) {
        console.error("Error updating summary:", error);
        return false;
    }
}

async function testUpdateSkills(resumeId) {
    console.log("\n=== Testing Update Skills Section ===");

    const params = {
        resume_id: resumeId,
        section_name: "skills",
        operation: "update",
        data: {
            content: "JavaScript, Node.js, React, TypeScript, HTML, CSS, Docker"
        },
        auth: DEFAULT_AUTH
    };

    try {
        console.log("Updating skills with params:", JSON.stringify(params, null, 2));
        const result = await updateResumeSectionTool.execute(params);
        console.log("Result:", JSON.stringify(result, null, 2));
        return true;
    } catch (error) {
        console.error("Error updating skills:", error);
        return false;
    }
}

async function testUpdateExperience(resumeId) {
    console.log("\n=== Testing Update Experience Section ===");

    const params = {
        resume_id: resumeId,
        section_name: "work",
        operation: "update",
        data: {
            content: "Senior Developer, Acme Inc. (2020-2023)\nLed development of key products and managed a team of 5 engineers.\n\nJunior Developer, Tech Corp (2018-2020)\nDeveloped web applications using React and Node.js."
        },
        auth: DEFAULT_AUTH
    };

    try {
        console.log("Updating experience with params:", JSON.stringify(params, null, 2));

        // Add debug logging
        console.log("DEBUG: Before calling execute");

        // Add debug logging to see what's happening with the sections
        console.log("DEBUG: Importing updateResumeSection function directly");
        const { updateResumeSection } = await import('./update_resume_section_tool.js');

        // Call the function directly with debug mode
        process.env.DEBUG = "true";
        const result = await updateResumeSectionTool.execute(params);

        console.log("DEBUG: After calling execute");
        console.log("Result:", JSON.stringify(result, null, 2));

        // Fetch the resume to check if items were actually created
        console.log("\nDEBUG: Fetching resume to check work section items");

        // Create axios instance with auth
        const axios = (await import('axios')).default;
        const { CookieJar } = await import('tough-cookie');
        const { wrapper } = await import('axios-cookiejar-support');

        // Create a cookie jar
        const jar = new CookieJar();
        const axiosInstance = wrapper(axios.create({ jar }));

        try {
            // First authenticate to get cookies
            console.log("DEBUG: Authenticating...");
            const authResponse = await axiosInstance.post(`${DEFAULT_AUTH.base_url}/auth/login`, {
                email: DEFAULT_AUTH.email,
                password: DEFAULT_AUTH.password
            });
            console.log("DEBUG: Authentication successful");

            // Now fetch the resume
            console.log(`DEBUG: Fetching resume ${resumeId}`);
            const resumeResponse = await axiosInstance.get(`${DEFAULT_AUTH.base_url}/resume/${resumeId}`);
            const resumeData = resumeResponse.data;

            // Check if work section exists and has items
            if (resumeData.data && resumeData.data.sections && resumeData.data.sections.work) {
                const workSection = resumeData.data.sections.work;
                console.log("DEBUG: Work section found");
                console.log("DEBUG: Work section content:", workSection.content);
                console.log("DEBUG: Work section items:", JSON.stringify(workSection.items || [], null, 2));
                console.log("DEBUG: Work section items count:", (workSection.items || []).length);
            } else {
                console.log("DEBUG: Work section not found in resume data");
            }
        } catch (fetchError) {
            console.error("DEBUG: Error fetching resume:", fetchError.message);
        }

        return true;
    } catch (error) {
        console.error("Error updating experience:", error);
        return false;
    }
}

async function testUpdateEducation(resumeId) {
    console.log("\n=== Testing Update Education Section ===");

    const params = {
        resume_id: resumeId,
        section_name: "education",
        operation: "update",
        data: {
            content: "Master of Computer Science, University of Technology (2016-2018)\n\nBachelor of Science, Computer Engineering, State University (2012-2016)"
        },
        auth: DEFAULT_AUTH
    };

    try {
        console.log("Updating education with params:", JSON.stringify(params, null, 2));
        const result = await updateResumeSectionTool.execute(params);
        console.log("Result:", JSON.stringify(result, null, 2));
        return true;
    } catch (error) {
        console.error("Error updating education:", error);
        return false;
    }
}

// Main function to run tests
async function runTests() {
    // Check if we have auth credentials
    if (!DEFAULT_AUTH.email || !DEFAULT_AUTH.password) {
        console.error("Error: Missing RX_EMAIL or RX_PASSWORD environment variables");
        console.log("Please create a .env file with RX_EMAIL and RX_PASSWORD");
        return;
    }

    // Get command line arguments
    const args = process.argv.slice(2);
    const testToRun = args[0];
    const resumeId = args[1];

    if (testToRun === "create") {
        await testCreateResume();
    } else if (testToRun === "summary" && resumeId) {
        await testUpdateSummary(resumeId);
    } else if (testToRun === "skills" && resumeId) {
        await testUpdateSkills(resumeId);
    } else if (testToRun === "experience" && resumeId) {
        await testUpdateExperience(resumeId);
    } else if (testToRun === "education" && resumeId) {
        await testUpdateEducation(resumeId);
    } else if (testToRun === "all") {
        // Run all tests in sequence
        const newResumeId = await testCreateResume();
        if (newResumeId) {
            await testUpdateSummary(newResumeId);
            await testUpdateSkills(newResumeId);
            await testUpdateExperience(newResumeId);
            await testUpdateEducation(newResumeId);
            console.log(`\nAll tests completed. Resume ID: ${newResumeId}`);
            console.log(`View your resume at: https://resume.emmanuelu.com/r/${newResumeId}`);
        }
    } else {
        console.log("Usage:");
        console.log("  node test_resume_tools.js create");
        console.log("  node test_resume_tools.js summary <resume_id>");
        console.log("  node test_resume_tools.js skills <resume_id>");
        console.log("  node test_resume_tools.js experience <resume_id>");
        console.log("  node test_resume_tools.js education <resume_id>");
        console.log("  node test_resume_tools.js all");
    }
}

// Run the tests
runTests();
