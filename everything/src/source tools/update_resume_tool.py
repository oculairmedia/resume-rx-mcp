import json
import requests
import os
import datetime

def update_resume(params_json: str = "{}") -> str:
    """
    Update an existing resume in Reactive Resume.
    
    Args:
        params_json: A JSON string containing update details:
            {
                "resume_id": "uuid-of-resume",  # Required
                "title": "Updated Title",       # Optional
                "slug": "updated-slug",         # Optional
                "visibility": "public|private", # Optional
                "basics": {                     # Optional
                    "name": "Full Name",
                    "headline": "Job Title",
                    "email": "user@example.com",
                    "phone": "+1234567890",
                    "location": "City, Country"
                },
                "sections": {                   # Optional
                    "summary": {
                        "content": "Updated professional summary"
                    },
                    "skills": {
                        "items": [
                            {
                                "id": "existing-skill-id",  # Required for updating existing items
                                "name": "Updated Skill Name",
                                "level": 5,
                                "keywords": ["keyword1", "keyword2"]
                            }
                        ]
                    },
                    "education": {
                        "items": [
                            {
                                "id": "existing-education-id",  # Required for updating existing items
                                "institution": "Updated University Name",
                                "degree": "Updated Degree Name",
                                "area": "Updated Field of Study",
                                "date": "2018 - 2022"
                            }
                        ]
                    },
                    "experience": {
                        "items": [
                            {
                                "id": "existing-experience-id",  # Required for updating existing items
                                "company": "Updated Company Name",
                                "position": "Updated Job Title",
                                "date": "2022 - Present",
                                "summary": "Updated job description"
                            }
                        ]
                    }
                },
                "auth": {                       # Optional, uses env vars if not provided
                    "email": "user@example.com",
                    "password": "password",
                    "base_url": "http://example.com/api"
                }
            }
    
    Returns:
        str: JSON string containing the updated resume details or error message
    
    Example:
        >>> update_resume('{"resume_id": "abc123", "title": "Updated Resume Title"}')
        "Resume updated: Updated Resume Title (ID: abc123)"
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
        
        # Step 2: Get current resume data
        resume_url = f"{BASE_URL}/resume/{params['resume_id']}"
        resume_response = session.get(resume_url)
        
        if resume_response.status_code != 200:
            return f"Error: Failed to get resume with status code {resume_response.status_code}"
        
        current_resume = resume_response.json()
        
        # Step 3: Prepare update data
        update_data = {
            "title": current_resume.get("title"),
            "slug": current_resume.get("slug"),
            "visibility": current_resume.get("visibility"),
            "data": current_resume.get("data", {})
        }
        
        # Update title if provided
        if params.get("title"):
            update_data["title"] = params["title"]
        
        # Update slug if provided
        if params.get("slug"):
            update_data["slug"] = params["slug"]
        
        # Update visibility if provided
        if params.get("visibility"):
            update_data["visibility"] = params["visibility"]
        
        # Update basics if provided
        if params.get("basics"):
            for key, value in params["basics"].items():
                update_data["data"]["basics"][key] = value
        
        # Update sections if provided
        if params.get("sections"):
            for section_key, section_value in params["sections"].items():
                if section_key in update_data["data"]["sections"]:
                    # For summary section
                    if section_key == "summary" and "content" in section_value:
                        update_data["data"]["sections"]["summary"]["content"] = section_value["content"]
                    
                    # For sections with items
                    elif "items" in section_value and "items" in update_data["data"]["sections"][section_key]:
                        # Create a map of existing items by ID for easy lookup
                        existing_items = {item.get("id"): item for item in update_data["data"]["sections"][section_key]["items"]}
                        
                        # Process each item in the update
                        for item in section_value["items"]:
                            item_id = item.get("id")
                            
                            # If item has an ID and exists, update it
                            if item_id and item_id in existing_items:
                                for key, value in item.items():
                                    existing_items[item_id][key] = value
                            # Otherwise, add it as a new item
                            else:
                                # Ensure the item has required fields based on section type
                                if section_key == "skills":
                                    if not item.get("visible"):
                                        item["visible"] = True
                                    if not item.get("description"):
                                        item["description"] = ""
                                elif section_key in ["education", "experience"]:
                                    if not item.get("visible"):
                                        item["visible"] = True
                                    if not item.get("url"):
                                        item["url"] = {"label": "", "href": ""}
                                
                                update_data["data"]["sections"][section_key]["items"].append(item)
        
        # Step 4: Update resume
        update_headers = {
            "Content-Type": "application/json"
        }
        
        update_response = session.patch(resume_url, headers=update_headers, json=update_data)
        
        if update_response.status_code != 200:
            return f"Error: Failed to update resume with status code {update_response.status_code}. Response: {update_response.text}"
        
        updated_resume = update_response.json()
        
        # Format the response
        result = {
            "message": f"Resume updated: {updated_resume.get('title')}",
            "id": updated_resume.get("id"),
            "title": updated_resume.get("title"),
            "slug": updated_resume.get("slug"),
            "visibility": updated_resume.get("visibility"),
            "public_url": f"http://192.168.50.90:3000/r/{updated_resume.get('slug')}" if updated_resume.get("visibility") == "public" else None
        }
        
        return json.dumps(result, indent=2)
    
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
            print(f"Testing with resume ID: {first_resume_id}")
            
            # Example usage with minimal parameters
            test_params = json.dumps({
                "resume_id": first_resume_id,
                "title": "Updated Resume Title - " + datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "visibility": "public"
            })
        else:
            print("No resumes found. Using example resume ID.")
            test_params = json.dumps({
                "resume_id": "your-resume-id-here",
                "title": "Updated Resume Title",
                "visibility": "public"
            })
    except Exception as e:
        print(f"Error getting resume list: {str(e)}")
        test_params = json.dumps({
            "resume_id": "your-resume-id-here",
            "title": "Updated Resume Title",
            "visibility": "public"
        })
    
    result = update_resume(test_params)
    print(result)