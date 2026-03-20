from shapely.geometry import Polygon, Point
import pandas as pd
import io
import alphashape
from pyproj import Transformer
import math

transformer = Transformer.from_crs("EPSG:4326", "EPSG:32648", always_xy=True)

def convert_to_meter(lon, lat):
    if -180 <= lon <= 180 and -90 <= lat <= 90:
        return transformer.transform(lon, lat)
    return lon, lat

def parse_file(content, filename, point_type="vach"):
    if not content.strip():
        raise ValueError(f"File {filename} is empty.")
        
    ext = filename.lower().split('.')[-1]
    
    if ext == 'csv':
        try:
            df = pd.read_csv(io.StringIO(content))
        except Exception as e:
            raise ValueError(f"Could not parse CSV for {filename}: {str(e)}")
            
        columns = [str(c).upper() for c in df.columns]
        df.columns = columns
        
        if 'X' not in columns or 'Y' not in columns:
            raise ValueError(f"CSV file {filename} must contain X and Y columns.")
            
        points = []
        for idx, row in df.iterrows():
            if pd.isna(row['X']) or pd.isna(row['Y']):
                raise ValueError(f"File {filename} contains invalid or NaN coordinates on row {idx+1}.")
            
            p_id = row.get('POINTID', str(idx))
            if pd.isna(p_id): p_id = str(idx)
            
            x, y = convert_to_meter(float(row['X']), float(row['Y']))
            
            points.append({
                "id": str(p_id),
                "x": x,
                "y": y
            })
        if not points:
             raise ValueError(f"No coordinates found in {filename}.")
        return points

    elif ext == 'txt':
        lines = content.strip().split("\n")
        points = []
        for line in lines:
            line = line.strip()
            if not line:
                continue
            parts = line.split()
            if len(parts) >= 3:
                point_id = parts[0]
                try:
                    # VN survey TXT format: ID  Northing  Easting  Z  [code]
                    # Northing = Y axis, Easting = X axis
                    northing = float(parts[1])  # Y
                    easting  = float(parts[2])  # X
                    # If already in local metres (>500), keep as-is; else convert from lon/lat
                    x, y = convert_to_meter(easting, northing)
                    
                    if point_type == "vach":
                        # Use ONLY points marked "E" from Vach.txt
                        code = parts[-1]
                        if code != "E":
                            continue
                            
                    points.append({
                        "id": point_id,
                        "x": x,   # Easting
                        "y": y    # Northing
                    })
                except ValueError:
                    raise ValueError(f"File {filename} contains invalid coordinates (NaN or non-numeric).")
        if not points:
            raise ValueError(f"No coordinates found in {filename}.")
        return points
    else:
        raise ValueError(f"Unsupported file extension for {filename}")

def compute_analysis(boundary_points, pole_points, allow_fix=False):
    if not boundary_points:
        return {"poles": [], "summary": {"total": 0, "inside": 0, "outside": 0, "avg_distance": 0, "min_distance": 0, "max_distance": 0}, "boundary_hull": []}

    # DO NOT sort boundary points by angle or centroid.
    # Use the original order of points from Vach.txt (Code = "E") as-is.
    poly_coords = [(p["x"], p["y"]) for p in boundary_points]
    
    if len(poly_coords) < 3:
        return {"poles": [], "summary": {"total": len(pole_points), "inside": 0, "outside": len(pole_points), "avg_distance": 0, "min_distance": 0, "max_distance": 0}, "boundary_hull": []}
        
    if poly_coords[0] != poly_coords[-1]:
        poly_coords.append(poly_coords[0])
        
    polygon = Polygon(poly_coords)
    
    # Validation: check polygon validity WITHOUT auto-fixing
    if not polygon.is_valid:
        print("WARNING: Invalid boundary geometry detected. Boundary points may be ordered incorrectly or self-intersecting.")
        # Only apply buffer(0) fix if explicitly enabled by caller
        if allow_fix:
            print("INFO: allow_fix=True → Applying buffer(0) to repair geometry.")
            polygon = polygon.buffer(0)
        # else: proceed with original (potentially invalid) polygon as-is

    # Fallback gracefully if polygon is empty
    if polygon.is_empty:
        return {"poles": [], "summary": {"total": len(pole_points), "inside": 0, "outside": len(pole_points), "avg_distance": 0, "min_distance": 0, "max_distance": 0}, "boundary_hull": []}
        
    if polygon.geom_type == 'Polygon':
        hull_coords = [{"x": x, "y": y} for x, y in polygon.exterior.coords]
    else:
        # For MultiPolygon (only when allow_fix=True), return coords of the convex hull to visualize
        hull_coords = [{"x": x, "y": y} for x, y in polygon.convex_hull.exterior.coords]
    
    results = []
    inside_count = 0
    outside_count = 0
    
    all_distances = []
    
    for p in pole_points:
        pt = Point(p["x"], p["y"])
        is_inside = polygon.covers(pt)
        
        # Calculate distance to the boundary
        boundary_geom = polygon.exterior if polygon.geom_type == 'Polygon' else polygon.boundary
        distance = pt.distance(boundary_geom)
        
        status = "INSIDE" if is_inside else "OUTSIDE"
        if is_inside:
            inside_count += 1
        else:
            outside_count += 1
            
        all_distances.append(distance)
            
        results.append({
            "id": p["id"],
            "x": p["x"],
            "y": p["y"],
            "status": status,
            "raw_distance": distance,
            "distance": round(distance, 4)
        })
        
    # DO NOT exclude zero distances
    min_dist = min(all_distances) if all_distances else 0
    max_dist = max(all_distances) if all_distances else 0
    avg_distance = (sum(all_distances) / len(all_distances)) if all_distances else 0

    # Validation rules logic logging (optional logic warnings based on requirements)
    total_poles = len(pole_points)
    if total_poles > 0 and (inside_count / total_poles) < 0.05:
        print(f"WARNING: Inside count ({inside_count}) < 5% of Total ({total_poles}) -> polygon might be ordered incorrectly.")
        
    if min_dist > 0 and inside_count > 0:
        print(f"WARNING: Min Distance ({min_dist}) > 0 despite being inside -> distance might not be computed to boundary correctly.")

    for r in results:
        r["is_min_violation"] = (r["status"] == "OUTSIDE" and r["raw_distance"] == min_dist and min_dist > 0)
        r["is_max_violation"] = (r["status"] == "OUTSIDE" and r["raw_distance"] == max_dist and max_dist > 0)
        del r["raw_distance"]
    
    return {
        "poles": results,
        "boundary_hull": hull_coords,
        "summary": {
            "total": total_poles,
            "inside": inside_count,
            "outside": outside_count,
            "min_distance": round(min_dist, 4),
            "max_distance": round(max_dist, 4),
            "avg_distance": round(avg_distance, 4)
        }
    }
