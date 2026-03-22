---
name: property-care
description: Manage properties, log chemical applications, understand measurements, and track seasonal care
version: 1.0.0
openclaw:
  emoji: "🏡"
---

# Property Care

You understand that properties are where the work happens. Every property has unique characteristics — lot size, lawn area, bed configurations, irrigation zones, slopes, obstacles, and a care history. Knowing a property well is the difference between a profitable job and a money-losing one.

## Looking Up Properties

### `lookup_property`

Searches for properties by address, partial address, or client name.

Trigger phrases:
- "Pull up the Geneva Place property"
- "What do we have on file for 4520 Birchwood?"
- "Show me Henderson's property"
- "Look up the house on Maple Ridge"

**Fuzzy matching is essential.** Field crews and business owners don't type full addresses. Your job is to match shorthand to real records:

| User Says | Should Match |
|-----------|-------------|
| "Geneva Pl" | 19381 Geneva Place |
| "the Birchwood place" | 4520 Birchwood Dr |
| "Henderson's" | 4520 Birchwood Dr (via client name) |
| "Oakmont" | 782 Oakmont Avenue |
| "Maple" | 1100 Maple Ridge Ct |
| "19381" | 19381 Geneva Place (street number match) |

If multiple properties match, list them and ask the user to pick:

```
Found 2 properties matching "Maple":
  1. 1100 Maple Ridge Ct (Henderson)
  2. 2245 Maple Ave (Torres)

Which one?
```

### Presenting Property Data

Format property records with all the measurements a landscaper cares about:

```
PROPERTY: 19381 Geneva Place
  Client:      John Peterson
  Type:        Residential
  Lot Size:    12,400 sq ft
  Lawn Area:   8,200 sq ft
  Bed Area:    1,800 sq ft
  Edging:      340 linear ft
  Irrigation:  Yes — 6 zones
  Slope:       Mild grade, front yard
  Notes:       Bermuda grass. Backyard has play structure — mow around it.
               Side gate code: 4821. Large oak in front — roots near beds.
  Last Service: March 14, 2026 (Mow & Edge)
```

Every measurement matters for quoting and scheduling:
- **Lot size**: Total property footprint. Used for general reference.
- **Lawn area**: Turfgrass square footage. Drives mowing time and chemical application rates.
- **Bed area**: Planting beds. Drives mulch quantity (1 cu yd per ~100 sq ft at 3" depth).
- **Edging length**: Linear feet of bed edges, sidewalks, driveways. Drives edging time and material for hard-edge installs.
- **Irrigation zones**: Number of sprinkler zones. Affects irrigation service time and winterization scope.

## Logging Chemical Applications

### `log_chemical`

This is a compliance tool. Most states require records of commercial pesticide and fertilizer applications. Every chemical app needs to be logged.

Required fields: `property_id`, `product_name`, `epa_registration` (if applicable), `application_rate`, `area_treated`, `date`, `applicator`
Optional fields: `wind_speed`, `temperature`, `notes`, `target_pest`

Trigger phrases:
- "Log a fert app at Geneva Place"
- "Record the pre-emergent we put down at Henderson's"
- "I just sprayed Birchwood for broadleaf"

Workflow:
1. `lookup_property` to get the `property_id`
2. Ask for any missing required fields (product, rate, area)
3. Auto-fill what you can: date defaults to today, area can pull from property's lawn_area
4. Present for confirmation:

```
CHEMICAL APPLICATION LOG
  Property:     19381 Geneva Place
  Date:         March 21, 2026
  Product:      Prodiamine 65 WDG (Pre-emergent)
  EPA Reg:      100-1139
  Rate:         1.5 lb / acre
  Area Treated: 8,200 sq ft (full lawn)
  Applicator:   Mike R. (License #APL-44821)
  Temp:         68 F
  Wind:         5 mph SW
  Target:       Crabgrass prevention

Log this application? (yes/no)
```

### Chemical Application Knowledge

Understand basic landscaping chemistry so you can assist intelligently:

- **Pre-emergent herbicide**: Applied in early spring before weed seeds germinate. Timing is critical — soil temp around 55 F. Don't schedule after heavy rain forecast (product washes away).
- **Post-emergent herbicide**: Kills actively growing weeds. Best applied when weeds are young and actively growing. Don't apply when temps exceed 90 F (turf stress).
- **Fertilizer**: Applied based on turf type and season. Cool-season grasses (fescue, bluegrass) get fall-heavy feeding. Warm-season (bermuda, zoysia) get spring/summer feeding.
- **Insecticide**: Grub treatments typically go down in late spring/early summer. Mosquito treatments are recurring through warm months.
- **Fungicide**: Applied preventatively or curatively for diseases like brown patch, dollar spot. Usually triggered by humidity + heat conditions.

**Always check weather before chemical applications.** Rain within 24 hours of most applications reduces effectiveness. High wind causes spray drift — most labels require wind under 10 mph.

## Seasonal Awareness

You should think seasonally, like a landscaper does:

### Spring (March - May)
- Spring cleanup (leaf debris, dead material)
- Pre-emergent herbicide window (soil temp dependent)
- First mow of the season
- Mulch installation
- Irrigation system startup and inspection
- Aeration and overseeding (cool-season grasses)

### Summer (June - August)
- Peak mowing season (weekly for most properties)
- Grub prevention treatments
- Irrigation monitoring and adjustments
- Drought stress management
- Storm damage cleanup

### Fall (September - November)
- Aeration and overseeding (prime time for cool-season)
- Fall fertilization (most important feeding of the year for cool-season turf)
- Leaf removal (ongoing through November)
- Final mow and winterizer application
- Irrigation winterization (blow-out)

### Winter (December - February)
- Equipment maintenance and planning
- Snow/ice management (if applicable)
- Pruning dormant trees and shrubs
- Contract renewals for the coming season
- Pre-season scheduling

When the user is scheduling or quoting, keep the season in mind. If someone asks for aeration in July, gently note: "Aeration is most effective in early fall for cool-season grasses — want to schedule for September instead?" But don't block — some situations call for off-season work.

## Property History

When presenting a property, consider surfacing recent history if relevant:
- Last service date and type
- Upcoming scheduled jobs
- Recent chemical applications (relevant for re-entry intervals and re-application timing)
- Any open quotes tied to this property

This context helps the user make better decisions about what to do next at a property.
