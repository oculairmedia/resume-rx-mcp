#!/usr/bin/env node

import { createAndUpdateResumeTool } from './create_and_update_resume_tool.js';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

async function testCreateAndUpdateResume() {
    console.log("\n=== Testing Create and Update Resume Tool ===");

    const params = {
        title: `Vocational Diplomatic Buzzard Clone ${new Date().toLocaleString()}`,
        slug: `vocational-diplomatic-buzzard-clone-${Date.now()}`,
        visibility: "public",
        name: "John Doe",
        headline: "Creative and Innovative Web Developer",
        email: "john.doe@gmail.com",
        phone: "(555) 123-4567",
        location: "Pleasantville, CA 94588",
        summary: "<p>Innovative Web Developer with 5 years of experience in building impactful and user-friendly websites and applications. Specializes in <strong>front-end technologies</strong> and passionate about modern web standards and cutting-edge development techniques. Proven track record of leading successful projects from concept to deployment.</p>",
        skills: [
            { name: "Web Technologies", level: 0, description: "Advanced", keywords: ["HTML5", "JavaScript", "PHP", "Python"] },
            { name: "Web Frameworks", level: 0, description: "Intermediate", keywords: ["React.js", "Angular", "Vue.js", "Laravel", "Django"] },
            { name: "Tools", level: 0, description: "Intermediate", keywords: ["Webpack", "Git", "Jenkins", "Docker", "JIRA"] }
        ],
        education: [
            {
                institution: "University of California",
                studyType: "Bachelor's in Computer Science",
                area: "Berkeley, CA",
                date: "August 2012 to May 2016",
                score: "",
                summary: ""
            }
        ],
        experience: [
            {
                company: "Creative Solutions Inc.",
                position: "Senior Web Developer",
                location: "San Francisco, CA",
                date: "January 2019 to Present",
                summary: "<ul><li><p>Spearheaded the redesign of the main product website, resulting in a 40% increase in user engagement.</p></li><li><p>Developed and implemented a new responsive framework, improving cross-device compatibility.</p></li><li><p>Mentored a team of four junior developers, fostering a culture of technical excellence.</p></li></ul>",
                url: { label: "", href: "https://creativesolutions.inc/" }
            },
            {
                company: "TechAdvancers",
                position: "Web Developer",
                location: "San Jose, CA",
                date: "June 2016 to December 2018",
                summary: "<ul><li><p>Collaborated in a team of 10 to develop high-quality web applications using React.js and Node.js.</p></li><li><p>Managed the integration of third-party services such as Stripe for payments and Twilio for SMS services.</p></li><li><p>Optimized application performance, achieving a 30% reduction in load times.</p></li></ul>",
                url: { label: "", href: "https://techadvancers.com/" }
            }
        ],
        certifications: [
            {
                name: "Full-Stack Web Development",
                issuer: "CodeAcademy",
                date: "2020"
            },
            {
                name: "AWS Certified Developer",
                issuer: "Amazon Web Services",
                date: "2019"
            }
        ],
        projects: [
            {
                name: "E-Commerce Platform",
                description: "Project Lead",
                summary: "<p>Led the development of a full-stack e-commerce platform, improving sales conversion by 25%.</p>"
            },
            {
                name: "Interactive Dashboard",
                description: "Frontend Developer",
                summary: "<p>Created an interactive analytics dashboard for a SaaS application, enhancing data visualization for clients.</p>"
            }
        ],
        profiles: [
            {
                network: "LinkedIn",
                username: "johndoe",
                icon: "linkedin",
                url: { label: "", href: "https://linkedin.com/in/johndoe" }
            },
            {
                network: "GitHub",
                username: "johndoe",
                icon: "github",
                url: { label: "", href: "https://github.com/johndoe" }
            }
        ],
        auth: {
            email: process.env.RX_EMAIL,
            password: process.env.RX_PASSWORD,
            base_url: process.env.RX_BASE_URL,
            public_url: process.env.RX_PUBLIC_URL
        }
    };

    try {
        console.log("Creating and updating resume with params:", JSON.stringify(params, null, 2));
        const result = await createAndUpdateResumeTool.execute(params);
        console.log("Result:", JSON.stringify(result, null, 2));
        return result;
    } catch (error) {
        console.error("Error creating and updating resume:", error);
        return null;
    }
}

// Run the test
testCreateAndUpdateResume()
    .then(result => {
        if (result && result.public_url) {
            console.log(`\nView your resume at: ${result.public_url}`);
        }
    })
    .catch(error => {
        console.error("Unhandled error:", error);
    });
