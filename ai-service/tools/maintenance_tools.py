"""
AgenticMeadows AI Maintenance Tools
Photo-based lawn analysis, smart predictions, chat-driven logging, and proactive alerts.
"""
import os
import json
import httpx
from pathlib import Path
from datetime import datetime, timedelta

BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:4000")
KNOWLEDGE_BASE_PATH = Path(__file__).parent.parent / "knowledge" / "lawn_care.json"

# Load knowledge base at module level
_knowledge_base = None
def _get_knowledge_base():
    global _knowledge_base
    if _knowledge_base is None:
        try:
            _knowledge_base = json.loads(KNOWLEDGE_BASE_PATH.read_text())
        except Exception:
            _knowledge_base = {"diseases": [], "pests": [], "weeds": [], "treatments": []}
    return _knowledge_base


def _fuzzy_match(query: str, target: str) -> bool:
    """Simple fuzzy match: check if all words in query appear in target (case-insensitive)."""
    query_words = query.lower().split()
    target_lower = target.lower()
    return all(word in target_lower for word in query_words)


def _match_symptoms(description: str, symptoms: list[str]) -> list[str]:
    """Return list of symptoms from the knowledge base that match the description."""
    desc_lower = description.lower()
    matched = []
    for symptom in symptoms:
        # Check if symptom keywords appear in the description
        symptom_words = symptom.lower().split()
        # Require at least half of the symptom words to match
        hits = sum(1 for w in symptom_words if w in desc_lower)
        if hits >= max(1, len(symptom_words) // 2):
            matched.append(symptom)
    return matched


async def analyze_lawn_photo(image_description: str, auth_token: str = "") -> dict:
    """
    Analyze a lawn photo description to diagnose diseases, pests, weeds, and nutrient issues.
    Uses the built-in lawn care knowledge base.

    Args:
        image_description: Text description of what's visible in the lawn photo
                           (from the LLM's vision analysis or user description)
        auth_token: Bearer token (unused, kept for signature consistency)

    Returns:
        dict with diagnosis list, confidence, treatments, and urgency
    """
    kb = _get_knowledge_base()
    diagnoses = []

    # Check diseases
    for disease in kb.get("diseases", []):
        matched_symptoms = _match_symptoms(image_description, disease["symptoms"])
        if matched_symptoms:
            confidence = min(0.95, len(matched_symptoms) / max(len(disease["symptoms"]), 1))
            diagnoses.append({
                "issue": disease["name"],
                "category": "disease",
                "confidence": round(confidence, 2),
                "symptoms_matched": matched_symptoms,
                "treatments": disease.get("treatments", {}),
            })

    # Check pests
    for pest in kb.get("pests", []):
        matched_symptoms = _match_symptoms(image_description, pest["symptoms"])
        if matched_symptoms:
            confidence = min(0.95, len(matched_symptoms) / max(len(pest["symptoms"]), 1))
            diagnoses.append({
                "issue": pest["name"],
                "category": "pest",
                "confidence": round(confidence, 2),
                "symptoms_matched": matched_symptoms,
                "treatments": pest.get("treatments", {}),
            })

    # Check weeds
    for weed in kb.get("weeds", []):
        matched_symptoms = _match_symptoms(image_description, weed["symptoms"])
        if matched_symptoms:
            confidence = min(0.95, len(matched_symptoms) / max(len(weed["symptoms"]), 1))
            diagnoses.append({
                "issue": weed["name"],
                "category": "weed",
                "confidence": round(confidence, 2),
                "symptoms_matched": matched_symptoms,
                "treatments": weed.get("treatments", {}),
            })

    # Sort by confidence descending
    diagnoses.sort(key=lambda d: d["confidence"], reverse=True)

    # Determine overall confidence and urgency
    if not diagnoses:
        overall_confidence = "low"
        urgency = "monitor"
    elif diagnoses[0]["confidence"] >= 0.6:
        overall_confidence = "high"
        urgency = "immediate" if diagnoses[0]["category"] == "disease" else "soon"
    elif diagnoses[0]["confidence"] >= 0.3:
        overall_confidence = "medium"
        urgency = "soon"
    else:
        overall_confidence = "low"
        urgency = "monitor"

    # Collect unique treatments from top diagnoses
    all_treatments = []
    for d in diagnoses[:3]:
        treatments = d.get("treatments", {})
        for category, items in treatments.items():
            if isinstance(items, list):
                for item in items:
                    if isinstance(item, dict):
                        entry = f"[{category}] {item.get('product', item.get('task', str(item)))}"
                        if entry not in all_treatments:
                            all_treatments.append(entry)
                    elif isinstance(item, str):
                        entry = f"[{category}] {item}"
                        if entry not in all_treatments:
                            all_treatments.append(entry)

    return {
        "diagnosis": diagnoses[:5],  # Top 5 matches
        "confidence": overall_confidence,
        "treatments": all_treatments[:10],
        "urgency": urgency,
    }


async def get_treatment_info(issue_name: str, auth_token: str = "") -> dict:
    """
    Look up detailed treatment information for a specific disease, pest, or weed.

    Args:
        issue_name: Name of the disease, pest, or weed (fuzzy matched)
        auth_token: Bearer token (unused, kept for signature consistency)

    Returns:
        dict with full treatment info including chemical, organic, and cultural options
    """
    kb = _get_knowledge_base()

    # Search all categories
    for category_key in ["diseases", "pests", "weeds"]:
        for item in kb.get(category_key, []):
            if _fuzzy_match(issue_name, item["name"]):
                result = {
                    "name": item["name"],
                    "category": item.get("category", category_key.rstrip("s")),
                    "symptoms": item.get("symptoms", []),
                    "treatments": item.get("treatments", {}),
                }
                if "favorable_conditions" in item:
                    result["favorable_conditions"] = item["favorable_conditions"]
                if "grass_types_affected" in item:
                    result["grass_types_affected"] = item["grass_types_affected"]
                if "weed_type" in item:
                    result["weed_type"] = item["weed_type"]
                return result

    return {
        "error": f"No matching issue found for '{issue_name}'",
        "suggestion": "Try searching for common names like 'brown patch', 'grubs', 'crabgrass', 'dollar spot', etc.",
    }


async def get_seasonal_guide(
    grass_type: str = "cool_season",
    season: str = "",
    auth_token: str = "",
) -> dict:
    """
    Get seasonal lawn care guide for a given grass type and season.

    Args:
        grass_type: 'cool_season' or 'warm_season'
        season: spring/summer/fall/winter. Auto-detected from current date if not provided.
        auth_token: Bearer token (unused, kept for signature consistency)

    Returns:
        dict with tasks, timing, and tips for the season
    """
    kb = _get_knowledge_base()

    # Auto-detect season from current date if not provided
    if not season:
        month = datetime.now().month
        if month in (3, 4, 5):
            season = "spring"
        elif month in (6, 7, 8):
            season = "summer"
        elif month in (9, 10, 11):
            season = "fall"
        else:
            season = "winter"

    # Normalize grass_type
    grass_type = grass_type.lower().replace(" ", "_").replace("-", "_")
    if grass_type not in ("cool_season", "warm_season"):
        grass_type = "cool_season"

    season = season.lower().strip()
    if season not in ("spring", "summer", "fall", "winter"):
        season = "spring"

    guides = kb.get("seasonal_guides", {})
    grass_guide = guides.get(grass_type, {})
    season_guide = grass_guide.get(season, {})

    if not season_guide:
        return {
            "error": f"No seasonal guide found for {grass_type} / {season}",
            "grass_type": grass_type,
            "season": season,
        }

    return {
        "grass_type": grass_type,
        "season": season,
        "months": season_guide.get("months", []),
        "tasks": season_guide.get("tasks", []),
        "tips": season_guide.get("tips", []),
    }


async def log_maintenance_via_chat(
    equipment_name: str,
    task_name: str,
    hours: float = 0,
    mileage: float = 0,
    cost: float = 0,
    notes: str = "",
    auth_token: str = "",
) -> dict:
    """
    Log a maintenance service on equipment via chat.
    Fuzzy-matches equipment_name against the equipment list from the API.
    Returns a PendingAction for confirmation.

    Args:
        equipment_name: Name or partial name of the equipment
        task_name: What service was performed (e.g., "oil change", "blade sharpening")
        hours: Engine hours at time of service
        mileage: Mileage at time of service
        cost: Cost of the service
        notes: Additional notes
        auth_token: Bearer token for backend auth

    Returns:
        PendingAction dict with type LOG_MAINTENANCE
    """
    # Fetch equipment list to fuzzy-match
    matched_id = None
    matched_equipment_name = equipment_name

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{BACKEND_URL}/api/maintenance/equipment",
                headers={"Authorization": f"Bearer {auth_token}"},
            )
            resp.raise_for_status()
            equipment_list = resp.json()

            # Fuzzy match on name
            for equip in equipment_list:
                name = equip.get("name", "")
                if _fuzzy_match(equipment_name, name):
                    matched_id = equip["id"]
                    matched_equipment_name = name
                    break

            # If no match, try broader matching
            if not matched_id:
                query_lower = equipment_name.lower()
                for equip in equipment_list:
                    name_lower = equip.get("name", "").lower()
                    if query_lower in name_lower or name_lower in query_lower:
                        matched_id = equip["id"]
                        matched_equipment_name = equip["name"]
                        break
    except Exception:
        # If API call fails, use the name as-is and let confirm handle it
        pass

    if not matched_id:
        return {
            "error": f"Could not find equipment matching '{equipment_name}'. "
                     "Please provide a more specific equipment name.",
        }

    return {
        "type": "LOG_MAINTENANCE",
        "description": f"Log {task_name} on {matched_equipment_name} at {hours} hours",
        "payload": {
            "equipmentId": matched_id,
            "taskName": task_name,
            "hoursAtService": hours,
            "mileageAtService": mileage,
            "cost": cost,
            "notes": notes,
        },
    }


async def get_maintenance_alerts(auth_token: str = "") -> list[dict]:
    """
    Check for overdue or upcoming equipment maintenance alerts.

    Args:
        auth_token: Bearer token for backend auth

    Returns:
        list of alert dicts with human-readable summaries
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{BACKEND_URL}/api/maintenance/alerts",
                headers={"Authorization": f"Bearer {auth_token}"},
            )
            resp.raise_for_status()
            alerts = resp.json()

        # Format alerts into human-readable summaries
        formatted = []
        for alert in alerts:
            equipment_name = alert.get("equipmentName", "Unknown Equipment")
            task_name = alert.get("taskName", "maintenance")
            status = alert.get("status", "due")
            due_info = ""

            if alert.get("dueHours"):
                due_info = f" (due at {alert['dueHours']} hours"
                if alert.get("currentHours"):
                    due_info += f", currently at {alert['currentHours']} hours"
                due_info += ")"
            elif alert.get("dueDate"):
                due_info = f" (due {alert['dueDate']})"

            summary = f"{equipment_name}: {task_name} is {status}{due_info}"
            formatted.append({
                "summary": summary,
                "equipment_name": equipment_name,
                "task_name": task_name,
                "status": status,
                "raw": alert,
            })

        return formatted

    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            return [{"summary": "No maintenance alerts at this time.", "status": "ok"}]
        return [{"summary": f"Error checking maintenance alerts: {e}", "status": "error"}]
    except Exception as e:
        return [{"summary": f"Could not check maintenance alerts: {e}", "status": "error"}]


async def analyze_repair_vs_replace(equipment_id: str, auth_token: str = "") -> dict:
    """
    Analyze whether to repair or replace equipment based on repair history and costs.

    Args:
        equipment_id: Equipment ID to analyze
        auth_token: Bearer token for backend auth

    Returns:
        dict with repair cost analysis, replacement cost, recommendation, and ROI
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Fetch equipment details
            equip_resp = await client.get(
                f"{BACKEND_URL}/api/maintenance/equipment/{equipment_id}",
                headers={"Authorization": f"Bearer {auth_token}"},
            )
            equip_resp.raise_for_status()
            equipment = equip_resp.json()

            # Fetch maintenance logs
            logs_resp = await client.get(
                f"{BACKEND_URL}/api/maintenance/equipment/{equipment_id}/logs",
                headers={"Authorization": f"Bearer {auth_token}"},
            )
            logs_resp.raise_for_status()
            logs = logs_resp.json()
    except Exception as e:
        return {"error": f"Failed to fetch equipment data: {e}"}

    # Calculate repair costs this year
    current_year = datetime.now().year
    year_start = datetime(current_year, 1, 1)

    total_repair_cost_this_year = 0.0
    total_repair_cost_all_time = 0.0
    repair_count_this_year = 0

    for log_entry in logs:
        cost = float(log_entry.get("cost", 0) or 0)
        total_repair_cost_all_time += cost

        log_date_str = log_entry.get("date") or log_entry.get("createdAt", "")
        try:
            if log_date_str:
                log_date = datetime.fromisoformat(log_date_str.replace("Z", "+00:00"))
                if log_date.year == current_year:
                    total_repair_cost_this_year += cost
                    repair_count_this_year += 1
        except (ValueError, TypeError):
            pass

    purchase_price = float(equipment.get("purchasePrice", 0) or 0)
    equipment_name = equipment.get("name", "Unknown Equipment")
    equipment_age_years = 0

    purchase_date_str = equipment.get("purchaseDate", "")
    if purchase_date_str:
        try:
            purchase_date = datetime.fromisoformat(purchase_date_str.replace("Z", "+00:00"))
            equipment_age_years = max(1, (datetime.now() - purchase_date.replace(tzinfo=None)).days // 365)
        except (ValueError, TypeError):
            equipment_age_years = 1

    # Calculate recommendation
    repair_to_value_ratio = total_repair_cost_this_year / purchase_price if purchase_price > 0 else 0
    avg_annual_repair = total_repair_cost_all_time / max(equipment_age_years, 1)

    if repair_to_value_ratio > 0.5:
        recommendation = "REPLACE"
        reason = (
            f"Repair costs this year (${total_repair_cost_this_year:,.2f}) exceed 50% "
            f"of the original purchase price (${purchase_price:,.2f}). "
            "Replacement is recommended."
        )
    elif repair_to_value_ratio > 0.3:
        recommendation = "CONSIDER_REPLACING"
        reason = (
            f"Repair costs this year (${total_repair_cost_this_year:,.2f}) are approaching "
            f"a significant portion of the purchase price (${purchase_price:,.2f}). "
            "Start planning for replacement."
        )
    else:
        recommendation = "REPAIR"
        reason = (
            f"Repair costs this year (${total_repair_cost_this_year:,.2f}) are reasonable "
            f"relative to the purchase price (${purchase_price:,.2f}). "
            "Continue maintaining this equipment."
        )

    # Estimate ROI months (months until repair costs exceed replacement)
    monthly_repair_rate = total_repair_cost_this_year / max(datetime.now().month, 1)
    remaining_to_replacement = max(0, purchase_price - total_repair_cost_this_year)
    roi_months = int(remaining_to_replacement / monthly_repair_rate) if monthly_repair_rate > 0 else 999

    return {
        "equipment_name": equipment_name,
        "equipment_id": equipment_id,
        "purchase_price": purchase_price,
        "equipment_age_years": equipment_age_years,
        "repair_cost_this_year": total_repair_cost_this_year,
        "repair_count_this_year": repair_count_this_year,
        "total_repair_cost_all_time": total_repair_cost_all_time,
        "avg_annual_repair_cost": round(avg_annual_repair, 2),
        "repair_to_value_ratio": round(repair_to_value_ratio, 2),
        "recommendation": recommendation,
        "reason": reason,
        "roi_months": roi_months,
    }
