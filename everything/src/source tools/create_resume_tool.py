import json
import requests
import os
import uuid

def create_resume(params_json: str = "{}") -> str:
    """
    Create a new resume in Reactive Resume.
    
    Args:
        params_json: A JSON string containing resume details:
            {
                "title": "Resume Title",  # Required
                "slug": "resume-slug",    # Optional, generated if not provided
                "basics": {               # Optional
                    "name": "Full Name",
                    "headline": "Job Title",
                    "email": "user@example.com",
                    "phone": "+1234567890",
                    "location": "City, Country"
                },
                "sections": {             # Optional
                    "summary": {
                        "content": "Professional summary"
                    },
                    "skills": {
                        "items": [
                            {
                                "name": "Skill Name",
                                "level": 5,
                                "keywords": ["keyword1", "keyword2"]
                            }
                        ]
                    },
                    "education": {
                        "items": [
                            {
                                "institution": "University Name",
                                "degree": "Degree Name",
                                "area": "Field of Study",
                                "date": "2018 - 2022"
                            }
                        ]
                    },
                    "experience": {
                        "items": [
                            {
                                "company": "Company Name",
                                "position": "Job Title",
                                "date": "2022 - Present",
                                "summary": "Job description"
                            }
                        ]
                    }
                },
                "auth": {                 # Optional, uses env vars if not provided
                    "email": "user@example.com",
                    "password": "password",
                    "base_url": "http://example.com/api"
                }
            }
    
    Returns:
        str: JSON string containing the created resume details or error message
    
    Example:
        >>> create_resume('{"title": "My Professional Resume"}')
        "Resume created: My Professional Resume (ID: abc123)"
    """
    try:
        # Parse parameters
        try:
            params = json.loads(params_json) if params_json else {}
        except json.JSONDecodeError:
            return "Error: Invalid JSON parameters"
        
        # Validate required parameters
        if not params.get("title"):
            return "Error: Resume title is required"
        
        # Configuration
        auth_params = params.get("auth", {})
        EMAIL = auth_params.get("email") or os.environ.get("RX_RESUME_EMAIL", "emanuvaderland@gmail.com")
        PASSWORD = auth_params.get("password") or os.environ.get("RX_RESUME_PASSWORD", "E4YSj9UiVuSB3uJ")
        BASE_URL = auth_params.get("base_url") or os.environ.get("RX_RESUME_BASE_URL", "http://192.168.50.90:3050/api")
        
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
        
        # Step 2: Prepare resume data
        resume_data = {
            "title": params["title"],
            "slug": params.get("slug", f"resume-{uuid.uuid4().hex[:8]}"),
            "data": {
                "basics": {
                    "name": "",
                    "headline": "",
                    "email": "",
                    "phone": "",
                    "location": "",
                    "url": {
                        "label": "",
                        "href": ""
                    },
                    "customFields": [],
                    "picture": {
                        "url": "",
                        "size": 64,
                        "aspectRatio": 1,
                        "borderRadius": 0,
                        "effects": {
                            "hidden": False,
                            "border": False,
                            "grayscale": False
                        }
                    }
                },
                "sections": {
                    "summary": {
                        "name": "Summary",
                        "columns": 1,
                        "visible": True,
                        "content": ""
                    },
                    "skills": {
                        "name": "Skills",
                        "columns": 1,
                        "visible": True,
                        "items": []
                    },
                    "education": {
                        "name": "Education",
                        "columns": 1,
                        "visible": True,
                        "items": []
                    },
                    "experience": {
                        "name": "Experience",
                        "columns": 1,
                        "visible": True,
                        "items": []
                    }
                }
            }
        }
        
        # Update with provided basics if any
        if params.get("basics"):
            for key, value in params["basics"].items():
                resume_data["data"]["basics"][key] = value
        
        # Update with provided sections if any
        if params.get("sections"):
            for section_key, section_value in params["sections"].items():
                if section_key in resume_data["data"]["sections"]:
                    # For summary section
                    if section_key == "summary" and "content" in section_value:
                        resume_data["data"]["sections"]["summary"]["content"] = section_value["content"]
                    
                    # For sections with items
                    elif "items" in section_value and "items" in resume_data["data"]["sections"][section_key]:
                        # Process each item to ensure it has required fields
                        processed_items = []
                        for item in section_value["items"]:
                            if section_key == "skills":
                                processed_item = {
                                    "id": item.get("id", f"{section_key}-{uuid.uuid4().hex[:8]}"),
                                    "name": item.get("name", ""),
                                    "level": item.get("level", 0),
                                    "keywords": item.get("keywords", []),
                                    "visible": True,
                                    "description": item.get("description", "")
                                }
                            elif section_key == "education":
                                processed_item = {
                                    "id": item.get("id", f"{section_key}-{uuid.uuid4().hex[:8]}"),
                                    "institution": item.get("institution", ""),
                                    "degree": item.get("degree", ""),
                                    "area": item.get("area", ""),
                                    "score": item.get("score", ""),
                                    "date": item.get("date", ""),
                                    "studyType": item.get("studyType", "Full-time"),
                                    "visible": True,
                                    "summary": item.get("summary", ""),
                                    "url": item.get("url", {"label": "", "href": ""})
                                }
                            elif section_key == "experience":
                                processed_item = {
                                    "id": item.get("id", f"{section_key}-{uuid.uuid4().hex[:8]}"),
                                    "company": item.get("company", ""),
                                    "position": item.get("position", ""),
                                    "location": item.get("location", ""),
                                    "date": item.get("date", ""),
                                    "visible": True,
                                    "summary": item.get("summary", ""),
                                    "url": item.get("url", {"label": "", "href": ""})
                                }
                            else:
                                processed_item = item
                            
                            processed_items.append(processed_item)
                        
                        resume_data["data"]["sections"][section_key]["items"] = processed_items
        
        # Step 3: Create resume
        resume_url = f"{BASE_URL}/resume"
        resume_headers = {
            "Content-Type": "application/json"
        }
        
        resume_response = session.post(resume_url, headers=resume_headers, json=resume_data)
        
        if resume_response.status_code != 201:
            return f"Error: Failed to create resume with status code {resume_response.status_code}. Response: {resume_response.text}"
        
        created_resume = resume_response.json()
        
        # Format the response
        result = {
            "message": f"Resume created: {created_resume.get('title')}",
            "id": created_resume.get("id"),
            "title": created_resume.get("title"),
            "slug": created_resume.get("slug"),
            "public_url": f"http://192.168.50.90:3000/r/{created_resume.get('slug')}"
        }
        
        return json.dumps(result, indent=2)
    
    except requests.RequestException as e:
        return f"Error: Network error - {str(e)}"
    except Exception as e:
        return f"Error: Unexpected error - {str(e)}"

# For testing
if __name__ == "__main__":
    # Example usage with minimal parameters
    test_params = json.dumps({
        "title": "Test Resume",
        "basics": {
            "name": "John Doe",
            "headline": "Software Engineer"
        }
    })
    result = create_resume(test_params)
    print(result)