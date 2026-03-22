"""
AgenticMeadows Service Tools
Provides service catalog lookups and AI-driven service recommendations.
"""

import os
import httpx
from typing import Optional


BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:4000")


async def get_service_catalog(
    category: Optional[str] = None,
    auth_token: str = "",
) -> list[dict]:
    """
    Fetches the service catalog from the backend.

    Args:
        category: Optional category filter (e.g., "lawn", "landscape", "irrigation")
        auth_token: Bearer token for backend auth

    Returns:
        List of service records
    """
    params = {}
    if category:
        params["category"] = category

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"{BACKEND_URL}/api/services",
            params=params,
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        resp.raise_for_status()
        return resp.json()


async def suggest_services(
    property_id: Optional[str] = None,
    season: Optional[str] = None,
    photo_analysis: Optional[dict] = None,
    auth_token: str = "",
) -> dict:
    """
    Recommend services based on property data, season, and photo analysis.

    Workflow:
    1. Get property measurements if property_id provided
    2. Get service catalog
    3. Filter by season appropriateness
    4. Calculate prices based on measurements
    5. If photo_analysis provided, prioritize suggested_services from it

    Args:
        property_id: Optional property for area-based pricing
        season: Optional current season for filtering
        photo_analysis: Optional photo analysis result from vision_tools
        auth_token: Bearer token for backend auth

    Returns:
        dict with suggestions (list of {service_name, reason, estimated_price})
    """
    # 1. Get property measurements if property_id provided
    property_data = None
    if property_id:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    f"{BACKEND_URL}/api/properties/{property_id}",
                    headers={"Authorization": f"Bearer {auth_token}"},
                )
                if resp.status_code == 200:
                    property_data = resp.json()
        except Exception:
            pass

    # 2. Get service catalog
    try:
        catalog = await get_service_catalog(auth_token=auth_token)
    except Exception:
        catalog = []

    # 3. Filter by season appropriateness
    season_upper = (season or "").upper()
    if season_upper and catalog:
        catalog = [
            svc for svc in catalog
            if not svc.get("season") or svc["season"] == "ALL_YEAR" or svc["season"] == season_upper
        ]

    # 4. Calculate prices based on property area
    area_sqft = None
    if property_data:
        area_sqft = property_data.get("lotSizeSqft") or property_data.get("lawnAreaSqft")

    suggestions = []

    # 5. If photo_analysis provided, prioritize those suggestions
    if photo_analysis and photo_analysis.get("suggested_services"):
        for svc_name in photo_analysis["suggested_services"]:
            # Try to find matching catalog service for pricing
            catalog_match = next(
                (s for s in catalog if s.get("name", "").lower() in svc_name.lower() or svc_name.lower() in s.get("name", "").lower()),
                None,
            )
            estimated_price = None
            if catalog_match:
                base_price = catalog_match.get("basePrice", 0)
                per_sqft = catalog_match.get("pricePerSqft", 0)
                if area_sqft and per_sqft:
                    estimated_price = base_price + (per_sqft * area_sqft)
                elif base_price:
                    estimated_price = base_price

            suggestions.append({
                "service_name": svc_name,
                "reason": "Identified from job site photo analysis",
                "estimated_price": estimated_price,
            })
    else:
        # General seasonal suggestions from catalog
        for svc in catalog[:5]:
            base_price = svc.get("basePrice", 0)
            per_sqft = svc.get("pricePerSqft", 0)
            estimated_price = None
            if area_sqft and per_sqft:
                estimated_price = base_price + (per_sqft * area_sqft)
            elif base_price:
                estimated_price = base_price

            suggestions.append({
                "service_name": svc.get("name", "Service"),
                "reason": svc.get("description", "Recommended for this season"),
                "estimated_price": estimated_price,
            })

    return {"suggestions": suggestions}


def format_service_suggestions(suggestions: list[dict]) -> str:
    """Format service suggestions for chat display."""
    if not suggestions:
        return "No service suggestions available at this time."

    lines = ["Recommended Services:"]
    for i, s in enumerate(suggestions, 1):
        line = f"  {i}. {s['service_name']}"
        if s.get("estimated_price"):
            line += f" -- est. ${s['estimated_price']:,.2f}"
        if s.get("reason"):
            line += f"\n     Reason: {s['reason']}"
        lines.append(line)

    return "\n".join(lines)
