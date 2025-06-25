#!/usr/bin/env node

import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import fs from 'fs';

async function getBuzzardResume() {
    // Configuration
    const email = "emanuvaderland@gmail.com";
    const password = "E4YSj9UiVuSB3uJ";
    const baseUrl = "https://resume.emmanuelu.com/api";
    const resumeId = "cm98n39l60001cun2mhkh2v8j"; // Vocational Diplomatic Buzzard

    // Create a cookie jar and axios instance with cookie support
    const jar = new CookieJar();
    const axiosInstance = wrapper(axios.create({ jar }));

    try {
        // Step 1: Authenticate
        console.log("Authenticating...");
        const authUrl = `${baseUrl}/auth/login`;
        const authPayload = {
            identifier: email,
            password: password
        };
        const authHeaders = {
            "Content-Type": "application/json"
        };

        await axiosInstance.post(authUrl, authPayload, { headers: authHeaders });

        // Step 2: Get the resume
        console.log(`Fetching resume with ID: ${resumeId}`);
        const resumeUrl = `${baseUrl}/resume/${resumeId}`;
        const resumeResponse = await axiosInstance.get(resumeUrl);

        if (resumeResponse.status !== 200) {
            throw new Error(`Failed to get resume with status code ${resumeResponse.status}`);
        }

        const resume = resumeResponse.data;

        // Save the resume to a file
        const outputFile = "buzzard_resume.json";
        fs.writeFileSync(outputFile, JSON.stringify(resume, null, 2));

        console.log(`Resume saved to ${outputFile}`);

        // Print the structure of key sections
        console.log("\nExperience Section Structure:");
        console.log(JSON.stringify(resume.data.sections.experience, null, 2));

        console.log("\nEducation Section Structure:");
        console.log(JSON.stringify(resume.data.sections.education, null, 2));

        console.log("\nSkills Section Structure:");
        console.log(JSON.stringify(resume.data.sections.skills, null, 2));

        console.log("\nProjects Section Structure:");
        if (resume.data.sections.projects) {
            console.log(JSON.stringify(resume.data.sections.projects, null, 2));
        } else {
            console.log("No projects section found");
        }

        // Print some key information
        console.log("\nResume Overview:");
        console.log(`Title: ${resume.title}`);
        console.log(`Slug: ${resume.slug}`);
        console.log(`Visibility: ${resume.visibility}`);
        console.log(`Name: ${resume.data.basics.name}`);
        console.log(`Headline: ${resume.data.basics.headline}`);
        console.log(`Summary: ${resume.data.sections.summary.content}`);

        console.log("\nSkills:");
        if (resume.data.sections.skills && resume.data.sections.skills.items) {
            resume.data.sections.skills.items.forEach(skill => {
                console.log(`- ${skill.name} (Level: ${skill.level || 'N/A'})`);
            });
        } else {
            console.log("No skills found");
        }

        console.log("\nExperience:");
        if (resume.data.sections.work && resume.data.sections.work.items) {
            resume.data.sections.work.items.forEach(job => {
                console.log(`- ${job.position} at ${job.company} (${job.date})`);
            });
        } else if (resume.data.sections.experience && resume.data.sections.experience.items) {
            resume.data.sections.experience.items.forEach(job => {
                console.log(`- ${job.position} at ${job.company} (${job.date})`);
            });
        } else {
            console.log("No work experience found");
        }

        console.log("\nEducation:");
        if (resume.data.sections.education && resume.data.sections.education.items) {
            resume.data.sections.education.items.forEach(edu => {
                console.log(`- ${edu.degree} in ${edu.area || ''} from ${edu.institution} (${edu.date})`);
            });
        } else {
            console.log("No education found");
        }

        return resume;
    } catch (error) {
        console.error("Error getting resume:", error);
        throw error;
    }
}

// Run the function
getBuzzardResume()
    .catch(error => {
        console.error("Unhandled error:", error);
    });
