# AI Boundary Analysis Web Application

## Goal

Build a **web application with AI-assisted analysis** that allows users to upload two survey files:

* `Vach.txt` → boundary points
* `Tru.txt` → pole points

The system must:

1. Parse uploaded files
2. Build a boundary polygon
3. Perform spatial analysis
4. Call an **AI inference step** to validate and interpret results
5. Display results in a **visual map UI**
6. Allow users to inspect which poles are **inside or outside the boundary**

---

# High-Level Architecture

```text
User Upload
     |
     v
Backend File Parser
     |
     v
Geometry Engine (Shapely)
     |
     v
Spatial Analysis
(Point-in-Polygon + Distance)
     |
     v
AI Inference Layer
     |
     v
Result Database
     |
     v
Web UI Visualization
(Map + Table)
```

---

# Technology Stack

Recommended stack:

## Backend

* Python
* FastAPI
* Shapely
* Pandas

## Frontend

* React
* Leaflet.js (map visualization)
* TailwindCSS (UI styling)

## AI Layer

Use any LLM API such as:

* OpenAI
* Claude
* local LLM

The AI layer will **review computed geometry results** and produce a **human-readable interpretation**.

---

# Input Files

## Vach.txt

Boundary points.

Example:

```
31 1290514.976 512219.411 887.380 E
30 1290514.401 512215.151 887.579 E
29 1290513.277 512209.509 887.691 E
```

Format:

```
PointID X Y Z Flag
```

Only **X and Y** are required for geometry.

---

## Tru.txt

Pole points to check.

Example:

```
126 1290234.556 511905.412 899.394 e
194 1290207.520 511870.130 897.320 E
198 1290203.810 511871.440 893.360 I
```

Format:

```
PoleID X Y Z Flag
```

---

# Backend Processing Pipeline

## Step 1 — File Upload Endpoint

Create an API endpoint:

```
POST /upload-survey
```

Accepts:

```
multipart/form-data
```

Fields:

```
vach_file
tru_file
```

---

## Step 2 — Parse Files

Example Python logic:

```python
def parse_points(file):
    points = []
    for line in file:
        parts = line.split()
        x = float(parts[1])
        y = float(parts[2])
        points.append((x,y))
    return points
```

---

## Step 3 — Create Boundary Polygon

Using Shapely:

```python
from shapely.geometry import Polygon

polygon = Polygon(boundary_points)
```

If the polygon is not closed:

```
append first point to end
```

---

## Step 4 — Spatial Analysis

For each pole:

```python
from shapely.geometry import Point

point = Point(x,y)

inside = polygon.contains(point)

distance = polygon.exterior.distance(point)
```

Result structure:

```
pole_id
x
y
status
distance
```

Where:

```
status = INSIDE or OUTSIDE
```

---

# AI Inference Step

After computing geometry results, send summary data to an AI model.

Example prompt:

```
You are a GIS analysis assistant.

Given a boundary polygon and a list of pole analysis results,
interpret the spatial relationship.

Data:
- total poles
- poles inside
- poles outside
- average distance to boundary

Explain:

1. Whether boundary violations exist
2. Which poles are critical
3. Any anomalies in spatial distribution
```

Example request:

```python
response = ai_model.generate(prompt, data)
```

Expected AI output:

```
- Summary of violations
- Observations
- Potential data errors
```

Store this output for UI display.

---

# API Endpoints

## Upload Files

```
POST /upload-survey
```

Returns:

```
analysis_id
```

---

## Get Results

```
GET /analysis/{analysis_id}
```

Returns:

```
boundary_points
pole_points
classification
ai_summary
```

---

# Frontend UI

## Main Page

Components:

```
File Upload Panel
Map Visualization
Analysis Table
AI Summary Panel
```

---

## Map Visualization

Use **Leaflet.js**

Render:

### Boundary

```
polygon layer
color: blue
```

### Pole Points

Color coding:

```
INSIDE  → green
OUTSIDE → red
```

Example markers:

```
circleMarker
radius 5
```

---

## Data Table

Columns:

```
PoleID
X
Y
Status
Distance
```

Allow:

* sorting
* filtering
* highlight violations

---

## AI Analysis Panel

Display AI-generated explanation:

```
Boundary integrity summary
Detected violations
Suggested investigation
```

---

# Example UI Layout

```
---------------------------------------
Upload Files
---------------------------------------

[ Upload Vach.txt ]
[ Upload Tru.txt ]

[ Analyze ]

---------------------------------------
Map View
---------------------------------------

Boundary Polygon
Green / Red Poles

---------------------------------------
Pole Analysis Table
---------------------------------------

---------------------------------------
AI Interpretation
---------------------------------------
```

---

# Optional Advanced Features

Future improvements:

* interactive pole selection
* export results as CSV
* export map as PNG
* tolerance zone detection (buffer analysis)
* upload shapefile support
* coordinate projection detection

---

# Deliverables

The AI agent should generate:

```
backend/
    main.py
    geometry_engine.py
    ai_inference.py

frontend/
    React UI
    Map component

outputs/
    pole_analysis.csv
    boundary_map.png
```

---

# Success Criteria

The system is successful if:

* Users can upload survey files
* The system determines pole positions relative to the boundary
* Results are visualized on a map
* AI provides interpretation of spatial results
