import json
import requests
import os
import base64
import urllib3

# Disable SSL warnings for self-signed certificates
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

def download_resume_pdf(params_json: str = "{}") -> str:
    """
    Download a resume as a PDF file from Reactive Resume and optionally upload to XBackbone.
    
    Args:
        params_json: A JSON string containing parameters:
            {
                "resume_id": "uuid-of-resume",  # Required
                "output_path": "path/to/save.pdf",  # Optional, defaults to "resume.pdf"
                "return_base64": true|false,  # Optional, defaults to false
                "email": "user@example.com",  # Optional, uses env var if not provided
                "password": "password",       # Optional, uses env var if not provided
                "base_url": "http://example.com/api",  # Optional, uses env var if not provided
                "upload_to_xbackbone": true|false,  # Optional, defaults to true
                "xbackbone_url": "http://xbackbone.example.com",  # Optional, uses default if not provided
                "xbackbone_token": "your_token"  # Optional, uses default if not provided
            }
    
    Returns:
        str: Success message with file path or base64 encoded PDF data, or error message
    
    Example:
        >>> download_resume_pdf('{"resume_id": "abc123", "output_path": "my_resume.pdf"}')
        "Resume downloaded and uploaded to XBackbone: http://xbackbone.example.com/FudA7/filename.pdf"
    """
    try:
        # Parse parameters
        try:
            params = json.loads(params_json) if params_json else {}
        except json.JSONDecodeError:
            return "Error: Invalid JSON parameters"
        
        # Validate required parameters
        if not params.get("resume_id"):
            return "Error: Resume ID is required"
        
        # Configuration
        EMAIL = params.get("email") or os.environ.get("RX_RESUME_EMAIL", "emanuvaderland@gmail.com")
        PASSWORD = params.get("password") or os.environ.get("RX_RESUME_PASSWORD", "E4YSj9UiVuSB3uJ")
        BASE_URL = params.get("base_url") or os.environ.get("RX_RESUME_BASE_URL", "http://192.168.50.90:3050/api")
        OUTPUT_PATH = params.get("output_path", "resume.pdf")
        RETURN_BASE64 = params.get("return_base64", False)
        
        # XBackbone configuration
        UPLOAD_TO_XBACKBONE = params.get("upload_to_xbackbone", True)  # Default to True
        XBACKBONE_URL = params.get("xbackbone_url", "https://100.80.70.44")
        XBACKBONE_TOKEN = params.get("xbackbone_token", "token_2ec2bee6249c1c7a9b363f7925768127")
        
        # Step 1: Authenticate
        auth_url = f"{BASE_URL}/auth/login"
        auth_payload = {
            "identifier": EMAIL,
            "password": PASSWORD
        }
        auth_headers = {
            "Content-Type": "application/json"
        }
        
        session = requests.Session()
        auth_response = session.post(auth_url, headers=auth_headers, json=auth_payload)
        
        if auth_response.status_code != 200:
            return f"Error: Authentication failed with status code {auth_response.status_code}"
        
        # Step 2: Get PDF URL
        pdf_url = f"{BASE_URL}/resume/print/{params['resume_id']}"
        pdf_response = session.get(pdf_url)
        
        if pdf_response.status_code != 200:
            return f"Error: Failed to get PDF URL with status code {pdf_response.status_code}"
        
        # Check if the response is JSON (contains a URL) or a PDF
        content_type = pdf_response.headers.get('Content-Type', '')
        pdf_data = None
        
        if 'application/json' in content_type:
            # Extract the PDF URL from the JSON response
            try:
                json_response = pdf_response.json()
                if 'url' in json_response:
                    pdf_download_url = json_response['url']
                else:
                    return f"Error: PDF URL not found in response: {json_response}"
            except ValueError:
                return "Error: Failed to parse JSON response"
            
            # Download the PDF from the URL
            pdf_download_response = session.get(pdf_download_url, stream=True)
            
            if pdf_download_response.status_code != 200:
                return f"Error: Failed to download PDF with status code {pdf_download_response.status_code}"
            
            # Save the PDF content
            pdf_data = pdf_download_response.content
            
            # Save to file if needed
            with open(OUTPUT_PATH, 'wb') as f:
                f.write(pdf_data)
            
        elif 'application/pdf' in content_type:
            # The response is already a PDF
            pdf_data = pdf_response.content
            
            # Save to file if needed
            with open(OUTPUT_PATH, 'wb') as f:
                f.write(pdf_data)
            
        else:
            # Try alternative export URL
            export_url = f"{BASE_URL}/resume/export/{params['resume_id']}"
            export_response = session.get(export_url, stream=True)
            
            if export_response.status_code != 200:
                return f"Error: Failed to export resume with status code {export_response.status_code}"
            
            # Save the PDF content
            pdf_data = export_response.content
            
            # Save to file if needed
            with open(OUTPUT_PATH, 'wb') as f:
                f.write(pdf_data)
        
        # Step 3: Upload to XBackbone if requested
        xbackbone_url = None
        if UPLOAD_TO_XBACKBONE:
            try:
                # Upload the file to XBackbone
                upload_url = f"{XBACKBONE_URL}/upload"
                
                # Prepare the upload
                files = {'upload': (os.path.basename(OUTPUT_PATH), open(OUTPUT_PATH, 'rb'))}
                data = {'token': XBACKBONE_TOKEN}
                
                # Disable SSL verification for self-signed certificates
                upload_response = requests.post(upload_url, files=files, data=data, verify=False)
                
                if upload_response.status_code in [200, 201]:
                    try:
                        result = upload_response.json()
                        xbackbone_url = result.get('url')
                        xbackbone_raw_url = f"{xbackbone_url}/raw"
                        xbackbone_delete_url = f"{xbackbone_url}/delete/{XBACKBONE_TOKEN}"
                    except:
                        return f"Error: Failed to parse XBackbone upload response: {upload_response.text[:200]}"
                else:
                    return f"Error: Failed to upload to XBackbone with status code {upload_response.status_code}: {upload_response.text[:200]}"
            except Exception as e:
                return f"Error: XBackbone upload failed - {str(e)}"
        
        # Step 4: Return the appropriate response
        if RETURN_BASE64:
            base64_data = base64.b64encode(pdf_data).decode('utf-8')
            response_data = {
                "message": "Resume downloaded successfully as base64",
                "base64_data": base64_data,
                "mime_type": "application/pdf",
                "file_path": os.path.abspath(OUTPUT_PATH)
            }
            
            if xbackbone_url:
                response_data["xbackbone_url"] = xbackbone_url
                response_data["xbackbone_raw_url"] = xbackbone_raw_url
                response_data["xbackbone_delete_url"] = xbackbone_delete_url
                response_data["message"] += f" and uploaded to XBackbone"
            
            return json.dumps(response_data)
        else:
            response_data = {
                "message": f"Resume downloaded successfully and saved to: {OUTPUT_PATH}",
                "file_path": os.path.abspath(OUTPUT_PATH)
            }
            
            if xbackbone_url:
                response_data["xbackbone_url"] = xbackbone_url
                response_data["xbackbone_raw_url"] = xbackbone_raw_url
                response_data["xbackbone_delete_url"] = xbackbone_delete_url
                response_data["message"] += f" and uploaded to XBackbone"
            
            return json.dumps(response_data)
    
    except requests.RequestException as e:
        return f"Error: Network error - {str(e)}"
    except Exception as e:
        return f"Error: Unexpected error - {str(e)}"

# For testing
if __name__ == "__main__":
    # Get the first resume ID from list_resumes_tool
    try:
        import list_resumes_tool
        resumes_json = list_resumes_tool.list_resumes()
        resumes_data = json.loads(resumes_json)
        
        if resumes_data.get("count", 0) > 0 and "resumes" in resumes_data:
            first_resume_id = resumes_data["resumes"][0]["id"]
            first_resume_title = resumes_data["resumes"][0]["title"]
            safe_title = "".join(c if c.isalnum() else "_" for c in first_resume_title)
            
            print(f"Testing with resume ID: {first_resume_id}")
            
            # Example usage (XBackbone upload is enabled by default)
            test_params = json.dumps({
                "resume_id": first_resume_id,
                "output_path": f"{safe_title}.pdf"
            })
        else:
            print("No resumes found. Using example resume ID.")
            test_params = json.dumps({
                "resume_id": "your-resume-id-here",
                "output_path": "downloaded_resume.pdf"
            })
    except Exception as e:
        print(f"Error getting resume list: {str(e)}")
        test_params = json.dumps({
            "resume_id": "your-resume-id-here",
            "output_path": "downloaded_resume.pdf"
        })
    
    result = download_resume_pdf(test_params)
    print(result)