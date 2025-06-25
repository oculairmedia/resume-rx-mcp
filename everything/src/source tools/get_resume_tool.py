import json
import requests
import os

def get_resume(params_json: str = "{}") -> str:
    """
    Get details of a specific resume by ID from Reactive Resume.
    
    Args:
        params_json: A JSON string containing parameters:
            {
                "resume_id": "uuid-of-resume",  # Required
                "email": "user@example.com",    # Optional, uses env var if not provided
                "password": "password",         # Optional, uses env var if not provided
                "base_url": "http://example.com/api"  # Optional, uses env var if not provided
            }
    
    Returns:
        str: JSON string containing the resume details or error message
    
    Example:
        >>> get_resume('{"resume_id": "123abc"}')
        "{"id": "123abc", "title": "My Resume", ...}"
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
        
        # Step 2: Get resume details
        resume_url = f"{BASE_URL}/resume/{params['resume_id']}"
        resume_response = session.get(resume_url)
        
        if resume_response.status_code != 200:
            return f"Error: Failed to get resume with status code {resume_response.status_code}"
        
        resume = resume_response.json()
        
        # Format the response
        result = {
            "id": resume.get("id"),
            "title": resume.get("title"),
            "slug": resume.get("slug"),
            "visibility": resume.get("visibility"),
            "data": resume.get("data"),
            "created_at": resume.get("createdAt"),
            "updated_at": resume.get("updatedAt")
        }
        
        return json.dumps(result, indent=2)
    
    except requests.RequestException as e:
        return f"Error: Network error - {str(e)}"
    except Exception as e:
        return f"Error: Unexpected error - {str(e)}"

# For testing
if __name__ == "__main__":
    # Example usage with a resume ID
    # Get the first resume ID from list_resumes_tool
    try:
        import list_resumes_tool
        resumes_json = list_resumes_tool.list_resumes()
        resumes_data = json.loads(resumes_json)
        
        if resumes_data.get("count", 0) > 0 and "resumes" in resumes_data:
            first_resume_id = resumes_data["resumes"][0]["id"]
            test_params = json.dumps({"resume_id": first_resume_id})
            print(f"Testing with resume ID: {first_resume_id}")
        else:
            print("No resumes found. Using example resume ID.")
            test_params = json.dumps({"resume_id": "your-resume-id-here"})
    except Exception as e:
        print(f"Error getting resume list: {str(e)}")
        test_params = json.dumps({"resume_id": "your-resume-id-here"})
    
    result = get_resume(test_params)
    print(result)