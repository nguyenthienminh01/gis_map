# Fix Distance Calculation & Coordinate Handling (TXT + CSV)

## Problem Summary

When analyzing the same dataset:

* TXT files return **Avg Distance ≈ 22.7424 m**
* CSV files return **Avg Distance ≈ 0.0002**

The discrepancy happens because:

* CSV calculations are performed directly on **WGS84 coordinates (latitude/longitude)** measured in **degrees**
* TXT calculations are performed in **projected coordinates (meters)**

Therefore the system mixes **degree-based distance** and **meter-based distance**.

Example:

```
0.0002 degree ≈ 22.2 meters
```

The system must **standardize all spatial calculations in meters**.

---

# Goal

Ensure both **TXT and CSV inputs produce identical results** by:

1. Parsing coordinates correctly
2. Converting all coordinates to a **projected coordinate system**
3. Performing **distance and geometry calculations in meters**
4. Fixing map rendering if lat/lon order is reversed

---

# Step 1 — Detect Coordinate System

Input files contain coordinates:

```
X = longitude
Y = latitude
```

Example:

```
108.613867 , 11.669531
```

These coordinates are:

```
EPSG:4326 (WGS84)
Unit: Degree
```

Before performing geometry calculations they must be **projected to a metric system**.

---

# Step 2 — Convert Coordinates to Meter Projection

Use a projection such as:

```
EPSG:3857 (Web Mercator)
```

or

```
UTM zone based on location
```

Recommended approach: **EPSG:3857** (simpler and compatible with web maps).

---

# Step 3 — Implement Coordinate Transformation

### Python Example

```
from pyproj import Transformer
from shapely.geometry import Point

transformer = Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)

def convert_to_meter(lon, lat):
    x, y = transformer.transform(lon, lat)
    return x, y
```

All coordinates must pass through this function before analysis.

---

# Step 4 — Normalize Input Parsing

The system must support:

```
vach.txt
vach.csv
tru.txt
tru.csv
```

Parsing logic:

```
1. Detect file extension
2. Extract X,Y coordinates
3. Convert coordinates to float
4. Transform to meter projection
```

Output structure:

```
[
 {x: meter_x, y: meter_y},
 {x: meter_x, y: meter_y}
]
```

---

# Step 5 — Build Boundary Polygon

Boundary coordinates come from **Vach file**.

```
boundary_points = [
 (x1,y1),
 (x2,y2),
 (x3,y3)
]
```

Ensure polygon is closed:

```
if boundary_points[0] != boundary_points[-1]:
    boundary_points.append(boundary_points[0])
```

Create polygon:

```
polygon = Polygon(boundary_points)
```

---

# Step 6 — Pole Analysis

For each pole:

```
if pole_point.within(polygon):
    pole.status = "INSIDE"
else:
    pole.status = "OUTSIDE"
```

---

# Step 7 — Distance Calculation

Distance must be computed **after projection to meters**.

```
distance = pole_point.distance(polygon)
```

Now distance is automatically in **meters**.

Compute average:

```
avg_distance = total_distance / total_poles
```

Expected output:

```
Avg Distance ≈ 22.7 m
```

for the provided dataset.

TXT and CSV must return **the same value**.

---

# Step 8 — Map Rendering Fix

Ensure correct coordinate order for mapping libraries.

Mapping libraries usually require:

```
[latitude, longitude]
```

But internal geometry calculations use:

```
[longitude, latitude]
```

Therefore when sending data to the map:

```
map_lat = y
map_lon = x
```

---

# Step 9 — Visualization Rules

Boundary polygon:

```
color: blue
```

Poles:

```
green = inside boundary
red = outside boundary
```

Each pole marker should show:

```
Pole ID
Coordinates
Status
Distance to boundary (meters)
```

---

# Step 10 — Verification Test

Run the analysis on the provided dataset.

Expected result:

```
Total Poles: 3325
Inside Boundary: 10
Outside Boundary: 3315
Avg Distance: ~22.7 meters
```

TXT and CSV results must be identical.

---

# Final Expected Behavior

After implementing this fix:

* TXT and CSV files produce the **same analysis result**
* Distance is always reported in **meters**
* Map visualization correctly displays poles and boundary
* Avg distance value matches geometry calculations
