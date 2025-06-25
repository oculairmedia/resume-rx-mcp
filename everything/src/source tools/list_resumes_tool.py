import json
import requests
import os

def list_resumes(params_json: str = "{}") -> str:
    """
    List all resumes for the authenticated user in Reactive Resume.
    
    Args:
        params_json: A JSON string containing optional parameters:
            {
                "email": "user@example.com",  # Optional, uses env var if not provided
                "password": "password",       # Optional, uses env var if not provided
                "base_url": "http://example.com/api",  # Optional, uses env var if not provided
                "include_public_urls": true   # Optional, whether to include public URLs for public resumes
            }
    
    Returns:
        str: JSON string containing the list of resumes or error message
    
    Example:
        >>> list_resumes('{}')
        "Found 2 resumes: [{"id": "123", "title": "My Resume", "public_url": "http://..."}, {...}]"
    """
    try:
        # Parse parameters
        try:
            params = json.loads(params_json) if params_json else {}
        except json.JSONDecodeError:
            return "Error: Invalid JSON parameters"
        
        # Configuration
        EMAIL = params.get("email") or os.environ.get("RX_RESUME_EMAIL", "emanuvaderland@gmail.com")
        PASSWORD = params.get("password") or os.environ.get("RX_RESUME_PASSWORD", "E4YSj9UiVuSB3uJ")
        BASE_URL = params.get("base_url") or os.environ.get("RX_RESUME_BASE_URL", "http://192.168.50.90:3050/api")
        INCLUDE_PUBLIC_URLS = params.get("include_public_urls", True)
        
        # Extract the base domain for public URLs (remove /api from the end if present)
        PUBLIC_BASE_URL = BASE_URL.replace("/api", "") if BASE_URL.endswith("/api") else BASE_URL
        
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
        
        # Get user profile to get username
        username = None
        if INCLUDE_PUBLIC_URLS:
            user_url = f"{BASE_URL}/user/me"
            user_response = session.get(user_url)
            
            if user_response.status_code == 200:
                user_data = user_response.json()
                username = user_data.get("username")
            else:
                return f"Error: Failed to get user profile with status code {user_response.status_code}"
        
        # Step 2: Get resumes
        resumes_url = f"{BASE_URL}/resume"
        resumes_response = session.get(resumes_url)
        
        if resumes_response.status_code != 200:
            return f"Error: Failed to get resumes with status code {resumes_response.status_code}"
        
        resumes = resumes_response.json()
        
        # Format the response
        result = {
            "count": len(resumes),
            "resumes": []
        }
        
        for resume in resumes:
            resume_data = {
                "id": resume.get("id"),
                "title": resume.get("title"),
                "slug": resume.get("slug"),
                "visibility": resume.get("visibility"),
                "created_at": resume.get("createdAt"),
                "updated_at": resume.get("updatedAt")
            }
            
            # Add public URL if resume is public and username is available
            if INCLUDE_PUBLIC_URLS and resume.get("visibility") == "public" and username:
                # Extract the short ID from the full ID (first 8 characters)
                short_id = resume.get("id", "")[:8]
                public_url = f"{PUBLIC_BASE_URL}/{username}/resume-{short_id}"
                resume_data["public_url"] = public_url
            
            result["resumes"].append(resume_data)
        
        return json.dumps(result, indent=2)
    
    except requests.RequestException as e:
        return f"Error: Network error - {str(e)}"
    except Exception as e:
        return f"Error: Unexpected error - {str(e)}"

# For testing
if __name__ == "__main__":
    result = list_resumes()
    print(result)