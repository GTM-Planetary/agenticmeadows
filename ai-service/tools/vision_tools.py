"""
AgenticMeadows Vision Tools
Handles Qwen 3.5 multimodal photo analysis for job site images.
"""

import base64
import os
import httpx
from typing import Optional


OLLAMA_URL = os.getenv("OLLAMA_URL", "http://ollama:11434")
BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:4000")


def _get_model_name() -> str:
    """Read the currently loaded Ollama model from the shared volume file."""
    photos_dir = os.getenv("PHOTOS_DIR", "/app/photos")
    model_file = os.path.join(photos_dir, "current_model.txt")
    try:
        with open(model_file) as f:
            return f.read().strip()
    except FileNotFoundError:
        return "qwen3.5:9b"


async def analyze_job_site(image_url: str, prompt: str) -> dict:
    """
    Send a job site photo to Qwen 3.5 for visual analysis.

    Args:
        image_url: Either a full URL or a /photos/<filename> path from the backend
        prompt: User's question or analysis request about the image

    Returns:
        dict with keys: analysis (str), suggested_services (list), estimated_price (float|None)
    """
    model = _get_model_name()

    # Resolve image URL — if it's a relative path, fetch from backend
    if image_url.startswith("/photos/"):
        full_url = f"{BACKEND_URL}{image_url}"
    elif image_url.startswith("http"):
        full_url = image_url
    else:
        full_url = f"{BACKEND_URL}/photos/{image_url}"

    # Fetch and base64-encode the image
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            img_resp = await client.get(full_url)
            img_resp.raise_for_status()
            img_b64 = base64.b64encode(img_resp.content).decode("utf-8")
        except Exception as e:
            return {
                "analysis": f"Could not fetch the image: {str(e)}",
                "suggested_services": [],
                "estimated_price": None,
                "error": True,
            }

        # Build the vision prompt with landscaping-specific guidance
        system_message = (
            "You are a professional landscaper analyzing a job site photo. "
            "Describe what you see in detail: lawn condition, plant health, "
            "overgrowth, bare spots, estimated area sizes, and specific services needed. "
            "Provide realistic cost estimates based on typical landscaping rates ($50-80/hr labor). "
            "Format your response with: 1) What I see, 2) Recommended services, 3) Estimated cost range."
        )

        payload = {
            "model": model,
            "messages": [
                {
                    "role": "user",
                    "content": f"{system_message}\n\nUser request: {prompt}",
                    "images": [img_b64],
                }
            ],
            "stream": False,
            "options": {"temperature": 0.3},
        }

        try:
            resp = await client.post(
                f"{OLLAMA_URL}/api/chat",
                json=payload,
                timeout=120.0,
            )
            resp.raise_for_status()
            data = resp.json()
            analysis_text = data["message"]["content"]
        except Exception as e:
            return {
                "analysis": f"Vision analysis failed: {str(e)}",
                "suggested_services": [],
                "estimated_price": None,
                "error": True,
            }

    # Parse suggested services from analysis (simple keyword extraction)
    services = _extract_services(analysis_text)
    price_estimate = _extract_price_estimate(analysis_text)

    return {
        "analysis": analysis_text,
        "suggested_services": services,
        "estimated_price": price_estimate,
        "model_used": model,
        "error": False,
    }


def _extract_services(text: str) -> list[str]:
    """Extract service names from analysis text based on common landscaping keywords."""
    service_keywords = [
        ("mow", "Lawn Mowing"),
        ("trim", "Trimming & Edging"),
        ("prune", "Pruning"),
        ("shrub", "Shrub Maintenance"),
        ("weed", "Weed Control"),
        ("mulch", "Mulching"),
        ("aerat", "Lawn Aeration"),
        ("seed", "Overseeding"),
        ("fertil", "Fertilization"),
        ("cleanup", "Yard Cleanup"),
        ("clean up", "Yard Cleanup"),
        ("leaf", "Leaf Removal"),
        ("dead", "Dead Plant Removal"),
        ("bed", "Garden Bed Maintenance"),
        ("irrigat", "Irrigation Check"),
        ("water", "Irrigation Check"),
    ]
    found = []
    text_lower = text.lower()
    seen = set()
    for keyword, service_name in service_keywords:
        if keyword in text_lower and service_name not in seen:
            found.append(service_name)
            seen.add(service_name)
    return found


def _extract_price_estimate(text: str) -> Optional[float]:
    """Try to extract a mid-point price estimate from the analysis text."""
    import re
    # Look for patterns like "$150-300", "$200", "150 to 300 dollars"
    patterns = [
        r"\$(\d+)\s*[-–to]+\s*\$?(\d+)",  # $150-300 or $150 to $300
        r"\$(\d+)",                           # $200
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            groups = match.groups()
            if len(groups) == 2:
                return (float(groups[0]) + float(groups[1])) / 2
            return float(groups[0])
    return None
