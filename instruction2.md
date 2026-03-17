# Pole Boundary Analysis System (TXT + CSV Support)

## Objective

Build a system that allows users to upload **boundary files (Vach)** and **pole files (Tru)** in **TXT or CSV format**, analyze whether poles are **inside or outside the boundary**, call an **AI inference step**, and render a **visual UI with statistics and map visualization**.

The system must support:

* Upload `.txt` or `.csv`
* Parse coordinates
* Construct boundary polygon
* Run **Point-in-Polygon** analysis
* Call **AI inference**
* Render **interactive visualization**

---

# 1 Supported File Types

Two input files:

### Boundary file

```
vach.txt
vach.csv
```

### Pole file

```
tru.txt
tru.csv
```

Validation rule:

```
allowedExtensions = ["txt","csv"]

if extension not in allowedExtensions:
    reject upload
```

---

# 2 File Data Format

Both TXT and CSV contain coordinate data.

### CSV format

Example:

```
PointID,Z,X,Y
31,887.380,108.613867,11.669531
30,887.579,108.613828,11.669526
```

Field meaning:

| Field   | Meaning                  |
| ------- | ------------------------ |
| PointID | identifier               |
| Z       | elevation (not required) |
| X       | longitude                |
| Y       | latitude                 |

For analysis we only use:

```
X
Y
```

---

# 3 File Parsing Logic

The system must automatically detect the file type.

Pseudo logic:

```
function parseFile(file):

    if file.extension == "csv":
        data = parseCSV(file)

    if file.extension == "txt":
        data = parseTXT(file)

    coordinates = []

    for row in data:
        x = float(row.X)
        y = float(row.Y)

        coordinates.append({
            "x": x,
            "y": y
        })

    return coordinates
```

Output structure:

```
[
 {x:108.613867,y:11.669531},
 {x:108.613828,y:11.669526}
]
```

---

# 4 Boundary Polygon Construction

The **Vach file** defines the boundary polygon.

Example:

```
boundaryPoints = [
 [108.613867,11.669531],
 [108.613828,11.669526],
 [108.613776,11.669516]
]
```

Before building the polygon:

```
if firstPoint != lastPoint:
    append firstPoint
```

Then construct polygon:

```
polygon = Polygon(boundaryPoints)
```

---

# 5 Pole Data

The **Tru file** defines pole locations.

Example:

```
poles = [
 {id:1,x:108.610986,y:11.666997},
 {id:2,x:108.610662,y:11.666753}
]
```

---

# 6 Geospatial Analysis

For each pole determine whether it lies inside the boundary polygon.

Use **Point-In-Polygon algorithm**.

Recommended libraries:

### Python

```
shapely
```

### Javascript

```
turf.js
```

Pseudo logic:

```
insideCount = 0
outsideCount = 0

for pole in poles:

    if point_in_polygon(pole, polygon):
        pole.status = "INSIDE"
        insideCount += 1
    else:
        pole.status = "OUTSIDE"
        outsideCount += 1
```

---

# 7 Distance Calculation

Optionally calculate distance from each pole to the nearest boundary edge.

Example:

```
distance = distance_to_polygon(pole, polygon)
```

Compute average distance:

```
avgDistance = totalDistance / totalPoles
```

---

# 8 AI Inference Step

After geometry analysis call an AI model.

Purpose:

* summarize results
* detect unusual patterns
* explain violations

Example prompt:

```
Analyze boundary and pole data.

Inputs:
total_poles
inside_count
outside_count
avg_distance

Return:
summary
risk_level
recommendations
```

Example response:

```
{
 "summary":"Most poles are outside the defined boundary.",
 "risk_level":"LOW",
 "recommendations":[
   "Check boundary definition",
   "Verify pole dataset source"
 ]
}
```

---

# 9 UI Layout

## Upload Section

Two upload components:

```
Upload Boundary File (Vach)
Upload Pole File (Tru)
Analyze Button
```

Accepted formats:

```
TXT
CSV
```

---

# 10 Dashboard Statistics

After analysis show summary cards:

```
Total Poles
Inside Boundary
Outside Boundary
Average Distance
```

Example:

```
Total Poles: 3325
Inside Boundary: 10
Outside Boundary: 3315
Average Distance: 22.74m
```

---

# 11 Map Visualization

Render an interactive map.

Recommended libraries:

```
Leaflet
Mapbox
Deck.gl
```

Display elements:

### Boundary polygon

```
blue outline
```

### Poles

```
green = inside
red = outside
```

Each pole should be clickable.

Popup should display:

```
Pole ID
Coordinates
Status
Distance to boundary
```

---

# 12 Error Handling

The system must detect invalid files.

Possible errors:

### Missing columns

```
CSV must contain X and Y columns
```

### Invalid coordinates

```
X or Y is NaN
```

### Empty file

```
No coordinates found
```

Return clear error messages to the UI.

---

# 13 Full Workflow

```
User uploads files
        ↓
System detects TXT or CSV
        ↓
Parse coordinates
        ↓
Build boundary polygon
        ↓
Run point-in-polygon analysis
        ↓
Calculate statistics
        ↓
Call AI inference
        ↓
Render UI + map visualization
```

---

# Final Expected Behavior

Users can upload:

```
vach.txt
vach.csv
tru.txt
tru.csv
```

The system will:

* parse coordinates
* detect inside/outside poles
* calculate distance
* call AI for analysis
* display statistics
* render interactive map

```
```
