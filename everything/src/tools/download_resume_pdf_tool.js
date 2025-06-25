import axios from 'axios';
import { wrapper as axiosCookiejarSupport } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import https from 'https';
import FormData from 'form-data'; // Need to install form-data: npm install form-data

// Load environment variables from .env file in the root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') }); // Go up three levels

// --- Configuration ---
const DEFAULT_RX_EMAIL = process.env.RX_RESUME_EMAIL || "emanuvaderland@gmail.com";
const DEFAULT_RX_PASSWORD = process.env.RX_RESUME_PASSWORD || "E4YSj9UiVuSB3uJ";
const DEFAULT_RX_BASE_URL = process.env.RX_RESUME_BASE_URL || "http://192.168.50.90:3050/api";
const DEFAULT_XBACKBONE_URL = process.env.XBACKBONE_URL || "https://100.80.70.44";
const DEFAULT_XBACKBONE_TOKEN = process.env.XBACKBONE_TOKEN || "token_2ec2bee6249c1c7a9b363f7925768127";

// Agent for handling self-signed certificates (use with caution)
const httpsAgent = new https.Agent({
    rejectUnauthorized: false, // Allow self-signed certs for XBackbone if needed
});

/**
 * Downloads a resume PDF from Reactive Resume and optionally uploads to XBackbone.
 *
 * @param {object} params - Parameters object.
 * @param {string} params.resume_id - Required. The UUID of the resume.
 * @param {string} [params.output_path="resume.pdf"] - Optional. Path to save the PDF.
 * @param {boolean} [params.return_base64=false] - Optional. Return PDF as base64 string.
 * @param {string} [params.email] - Optional. Reactive Resume email (overrides env).
 * @param {string} [params.password] - Optional. Reactive Resume password (overrides env).
 * @param {string} [params.base_url] - Optional. Reactive Resume API base URL (overrides env).
 * @param {boolean} [params.upload_to_xbackbone=true] - Optional. Upload to XBackbone.
 * @param {string} [params.xbackbone_url] - Optional. XBackbone URL (overrides env/default).
 * @param {string} [params.xbackbone_token] - Optional. XBackbone token (overrides env/default).
 * @returns {Promise<object>} - Promise resolving to result object or error object.
 */
export async function downloadResumePdf(params = {}) {
    // Create a cookie jar for this execution
    const cookieJar = new CookieJar();
    // Create an axios instance that uses the cookie jar
    const axiosInstance = axiosCookiejarSupport(axios.create({ jar: cookieJar }));

    let sessionCookie = null; // Keep for potential debugging/other headers
    let tempFilePath = null; // Keep track of the file if created

    try {
        // Validate required parameters
        if (!params.resume_id) {
            throw new Error("Resume ID (resume_id) is required");
        }

        // --- Apply Defaults and Environment Variables ---
        const resumeId = params.resume_id;
        const outputPath = path.resolve(params.output_path || `resume-${resumeId}.pdf`); // Ensure absolute path
        const returnBase64 = params.return_base64 === true;
        const uploadToXbackbone = params.upload_to_xbackbone !== false; // Default true

        const email = params.email || DEFAULT_RX_EMAIL;
        const password = params.password || DEFAULT_RX_PASSWORD;
        const baseUrl = params.base_url || DEFAULT_RX_BASE_URL;
        const xbackboneUrl = params.xbackbone_url || DEFAULT_XBACKBONE_URL;
        const xbackboneToken = params.xbackbone_token || DEFAULT_XBACKBONE_TOKEN;

        if (!email || !password || !baseUrl) {
            throw new Error("Missing required Reactive Resume authentication details (email, password, base_url) in params or environment variables.");
        }
        if (uploadToXbackbone && (!xbackboneUrl || !xbackboneToken)) {
            throw new Error("Missing required XBackbone details (xbackbone_url, xbackbone_token) for upload in params or environment variables.");
        }

        // Ensure output directory exists
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        tempFilePath = outputPath; // Mark file path for potential cleanup

        // --- Step 1: Authenticate with Reactive Resume ---
        const authUrl = `${baseUrl}/auth/login`;
        const authPayload = { identifier: email, password: password };
        const authHeaders = { 'Content-Type': 'application/json' };

        try {
            const authResponse = await axiosInstance.post(authUrl, authPayload, {
                headers: authHeaders,
                responseType: 'json' // Login response is JSON
            });
            if (authResponse.status !== 200) {
                throw new Error(`Authentication failed with status code ${authResponse.status}`);
            }
            console.log("Authentication successful, cookie jar updated.");
            const cookies = authResponse.headers['set-cookie'];
             if (cookies) {
                 sessionCookie = cookies.find(cookie => cookie.startsWith('connect.sid='))?.split(';')[0];
             }
        } catch (error) {
            const status = error.response?.status;
            const message = error.response?.data?.message || error.message;
            throw new Error(`Authentication failed${status ? ` with status ${status}` : ''}: ${message}`);
        }

        // --- Step 2: Download PDF ---
        let pdfDataBuffer = null;
        const downloadHeaders = {}; // Headers for download requests (cookie jar handles cookies)

        // --- Attempt 1: Try /print/{id}/preview endpoint ---
        const previewUrl = `${baseUrl}/resume/print/${resumeId}/preview`;
        console.log(`Attempting download from: ${previewUrl}`);
        try {
            const previewResponse = await axiosInstance.get(previewUrl, {
                headers: downloadHeaders,
                responseType: 'arraybuffer' // Expect PDF directly
            });
            if (previewResponse.status === 200 && (previewResponse.headers['content-type'] || '').includes('application/pdf')) {
                pdfDataBuffer = Buffer.from(previewResponse.data);
                console.log("Successfully downloaded PDF from preview endpoint.");
            } else {
                console.warn(`Preview endpoint did not return PDF. Status: ${previewResponse.status}, Type: ${previewResponse.headers['content-type']}`);
            }
        } catch (error) {
            console.warn(`Error fetching from preview endpoint: ${error.message}`);
        }

        // --- Attempt 2: Try /print/{id} endpoint (Mirroring Python Logic) ---
        if (!pdfDataBuffer) {
            const printUrl = `${baseUrl}/resume/print/${resumeId}`;
            console.log(`Attempting download from: ${printUrl}`);
            let printResponse;
            try {
                // Fetch initially as text to check content type without parsing errors
                 printResponse = await axiosInstance.get(printUrl, {
                    headers: downloadHeaders,
                    responseType: 'text',
                    transformResponse: [(data) => data] // Prevent auto-parsing
                });

                if (printResponse.status === 200) {
                    const contentType = printResponse.headers['content-type'] || '';
                    if (contentType.includes('application/json')) {
                        // Handle JSON URL case
                        try {
                            const jsonResponse = JSON.parse(printResponse.data);
                            if (jsonResponse.url) {
                                console.log(`Print endpoint returned JSON, downloading from: ${jsonResponse.url}`);
                                const directPdfResponse = await axiosInstance.get(jsonResponse.url, {
                                    headers: downloadHeaders, // Jar handles cookies
                                    responseType: 'arraybuffer' // Expect PDF now
                                });
                                if (directPdfResponse.status === 200 && (directPdfResponse.headers['content-type'] || '').includes('application/pdf')) {
                                    pdfDataBuffer = Buffer.from(directPdfResponse.data);
                                    console.log("Successfully downloaded PDF from JSON URL.");
                                } else {
                                    console.warn(`Failed to download PDF from JSON URL. Status: ${directPdfResponse.status}`);
                                }
                            } else {
                                console.warn("Print endpoint returned JSON, but no 'url' field found.");
                            }
                        } catch (parseError) {
                             console.warn(`Failed to parse JSON response from print endpoint: ${parseError.message}`);
                        }
                    } else if (contentType.includes('application/pdf')) {
                         // Handle direct PDF case
                         console.log("Print endpoint returned PDF directly. Re-fetching as buffer...");
                         const pdfDirectResponse = await axiosInstance.get(printUrl, {
                             headers: downloadHeaders,
                             responseType: 'arraybuffer'
                         });
                          if (pdfDirectResponse.status === 200 && (pdfDirectResponse.headers['content-type'] || '').includes('application/pdf')) {
                              pdfDataBuffer = Buffer.from(pdfDirectResponse.data);
                              console.log("Successfully downloaded PDF directly from print endpoint.");
                          } else {
                               console.warn("Failed to get PDF directly from print endpoint on second attempt.");
                          }
                    } else {
                        // --- Attempt 3: Try /export/{id} ONLY if /print was 200 but wrong type ---
                        console.warn(`Print endpoint returned unexpected content type: ${contentType}. Trying /export...`);
                        const exportUrl = `${baseUrl}/resume/export/${resumeId}`;
                        console.log(`Attempting download from: ${exportUrl}`);
                        try {
                            const exportResponse = await axiosInstance.get(exportUrl, {
                                headers: downloadHeaders,
                                responseType: 'arraybuffer' // Expect PDF
                            });
                             if (exportResponse.status === 200 && (exportResponse.headers['content-type'] || '').includes('application/pdf')) {
                                 pdfDataBuffer = Buffer.from(exportResponse.data);
                                 console.log("Successfully downloaded PDF from export endpoint.");
                             } else {
                                  console.warn(`Export endpoint failed or returned wrong type. Status: ${exportResponse.status}, Type: ${exportResponse.headers['content-type']}`);
                             }
                        } catch (exportError) {
                             console.warn(`Error fetching from export endpoint: ${exportError.message}`);
                        }
                    }
                } else {
                    // If print status is not 200, do not proceed to export (mirror Python)
                    console.warn(`Print endpoint failed with status: ${printResponse.status}. Not attempting /export.`);
                }
            } catch (error) {
                 const status = error.response?.status;
                 const message = error.response?.data || error.message;
                 console.warn(`Error fetching from print endpoint${status ? ` (status ${status})` : ''}: ${message}. Not attempting /export.`);
                 // Do not attempt export if print failed
            }
        }

        // --- Final Check ---
        if (!pdfDataBuffer) {
            throw new Error(`Failed to download PDF for resume ID ${resumeId} from all available endpoints.`);
        }

        // --- Step 3: Save PDF to File ---
        await fs.writeFile(outputPath, pdfDataBuffer);
        console.log(`PDF saved locally to: ${outputPath}`);

        // --- Step 4: Upload to XBackbone ---
        let xbackboneResult = null;
        if (uploadToXbackbone) {
            console.log(`Uploading ${outputPath} to XBackbone at ${xbackboneUrl}...`);
            const form = new FormData();
            form.append('upload', pdfDataBuffer, path.basename(outputPath)); // Use buffer directly
            form.append('token', xbackboneToken);

            try {
                // Use a separate axios instance for XBackbone if it needs different config (like httpsAgent)
                const uploadResponse = await axios.post(`${xbackboneUrl}/upload`, form, {
                    headers: form.getHeaders(),
                    httpsAgent: httpsAgent // Apply agent specifically for this request
                });

                if (uploadResponse.status === 200 || uploadResponse.status === 201) {
                    xbackboneResult = uploadResponse.data;
                    if (xbackboneResult && xbackboneResult.url) {
                         xbackboneResult.raw_url = `${xbackboneResult.url}/raw`;
                         xbackboneResult.delete_url = `${xbackboneResult.url}/delete/${xbackboneToken}`; // Construct delete URL
                         console.log(`Successfully uploaded to XBackbone: ${xbackboneResult.url}`);
                    } else {
                         console.warn("XBackbone upload succeeded but response format unexpected:", xbackboneResult);
                         // Don't throw error, just report missing URL
                         xbackboneResult = { error: "XBackbone upload response missing 'url'." };
                    }
                } else {
                    throw new Error(`XBackbone upload failed with status ${uploadResponse.status}: ${JSON.stringify(uploadResponse.data)}`);
                }
            } catch (error) {
                const message = error.response?.data || error.message;
                console.error(`XBackbone upload error: ${message}`);
                xbackboneResult = { error: `XBackbone upload failed: ${message}` };
            }
        }

        // --- Step 5: Prepare Response ---
        const finalResult = {
            message: `Resume downloaded successfully and saved to: ${outputPath}`,
            file_path: outputPath, // Absolute path
        };

        if (xbackboneResult && xbackboneResult.url) {
            finalResult.message += ` and uploaded to XBackbone.`;
            finalResult.xbackbone_url = xbackboneResult.url;
            finalResult.xbackbone_raw_url = xbackboneResult.raw_url;
            finalResult.xbackbone_delete_url = xbackboneResult.delete_url;
        } else if (xbackboneResult && xbackboneResult.error) {
             finalResult.message += `. ${xbackboneResult.error}`; // Append error message
             finalResult.xbackbone_error = xbackboneResult.error;
        }

        if (returnBase64) {
            finalResult.base64_data = pdfDataBuffer.toString('base64');
            finalResult.mime_type = "application/pdf";
            finalResult.message = finalResult.message.replace("saved to", "returned as base64 from");
        }

        return finalResult;

    } catch (error) {
        console.error(`Error in downloadResumePdf: ${error.message}`);
        // Clean up saved file if an error occurred after saving but before completion
        if (tempFilePath) {
            try {
                await fs.unlink(tempFilePath);
                console.log(`Cleaned up temporary file: ${tempFilePath}`);
            } catch (cleanupError) {
                // Ignore cleanup error if file wasn't created (e.g., download failed early)
                if (cleanupError.code !== 'ENOENT') {
                    console.error(`Failed to cleanup temporary file ${tempFilePath}: ${cleanupError.message}`);
                }
            }
        }
        return { error: `Error: ${error.message}` };
    }
}

// --- Tool Definition ---
export const downloadResumePdfTool = {
    name: "download_resume_pdf",
    description: "Downloads a resume PDF from Reactive Resume, saves it locally, optionally uploads to XBackbone, and optionally returns base64 data. Uses env vars for defaults.",
    execute: downloadResumePdf,
    inputSchema: {
        type: "object",
        properties: {
            resume_id: { type: "string", description: "ID of the resume to download (Required)" },
            output_path: { type: "string", description: "Local path to save the PDF (Optional, defaults to resume-<id>.pdf)" },
            return_base64: { type: "boolean", description: "Return PDF as base64 string (Optional, default: false)" },
            email: { type: "string", description: "Reactive Resume email (Optional, overrides env)" },
            password: { type: "string", description: "Reactive Resume password (Optional, overrides env)" },
            base_url: { type: "string", description: "Reactive Resume API URL (Optional, overrides env)" },
            upload_to_xbackbone: { type: "boolean", description: "Upload to XBackbone (Optional, default: true)" },
            xbackbone_url: { type: "string", description: "XBackbone URL (Optional, overrides env/default)" },
            xbackbone_token: { type: "string", description: "XBackbone token (Optional, overrides env/default)" }
        },
        required: ["resume_id"]
    }
};

// --- Example Usage (for testing) ---
// Note: Needs a valid resume_id from your Reactive Resume instance
async function runTest() {
     const isMain = import.meta.url.endsWith(path.basename(process.argv[1])) ||
                   import.meta.url.endsWith(path.basename(process.argv[1]) + '.js') ||
                   process.argv[1] === fileURLToPath(import.meta.url);

    if (isMain) {
        console.log("Running downloadResumePdf test...");
        // --- !! Replace with a REAL resume ID from your instance !! ---
        const testResumeId = process.env.TEST_RESUME_ID || "replace-with-real-resume-id";
        // --- !! ----------------------------------------------- !! ---

        if (testResumeId === "replace-with-real-resume-id") {
             console.warn("Skipping test: TEST_RESUME_ID environment variable or default value is not set to a real ID.");
             return;
        }

        const testParams = {
            resume_id: testResumeId,
            output_path: `./test_download_${testResumeId}.pdf`, // Save in current dir for test
            // return_base64: true, // Uncomment to test base64 return
            upload_to_xbackbone: false // Set to true to test XBackbone upload
        };

        try {
            const result = await downloadResumePdf(testParams);
            console.log("Download Result:");
            console.log(JSON.stringify(result, null, 2));

            // Basic check: Does the file exist if not returning base64?
            if (!result.error && !testParams.return_base64) {
                try {
                    await fs.access(result.file_path);
                    console.log(`File check PASSED: ${result.file_path} exists.`);
                    // Optional: Clean up the test file
                    // await fs.unlink(result.file_path);
                    // console.log(`Cleaned up test file: ${result.file_path}`);
                } catch (fileError) {
                    console.error(`File check FAILED: ${result.file_path} not found.`);
                }
            } else if (result.error) {
                 console.error("Test finished with error.");
            } else if (testParams.return_base64 && result.base64_data) {
                 console.log("Base64 data received (length):", result.base64_data.length);
            }

        } catch (error) {
            console.error("Download Test Failed:");
            console.error(error);
        }
    }
}

runTest();