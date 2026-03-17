from shapely.geometry import Polygon, Point
import pandas as pd
import io
import alphashape
from pyproj import Transformer

transformer = Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)

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
                    x = float(parts[1])
                    y = float(parts[2])
                    x, y = convert_to_meter(x, y)
                    points.append({
                        "id": point_id,
                        "x": x,
                        "y": y
                    })
                except ValueError:
                    raise ValueError(f"File {filename} contains invalid coordinates (NaN or non-numeric).")
        if not points:
            raise ValueError(f"No coordinates found in {filename}.")
        return points
    else:
        raise ValueError(f"Unsupported file extension for {filename}")

def compute_analysis(boundary_points, pole_points):
    if not boundary_points:
        return {"poles": [], "summary": {"total": 0, "inside": 0, "outside": 0, "avg_distance": 0, "min_distance": 0, "max_distance": 0}, "boundary_hull": []}
        
    poly_coords = [(p["x"], p["y"]) for p in boundary_points]
    
    if len(poly_coords) < 3:
        return {"poles": [], "summary": {"total": len(pole_points), "inside": 0, "outside": len(pole_points), "avg_distance": 0, "min_distance": 0, "max_distance": 0}, "boundary_hull": []}
        
    if poly_coords[0] != poly_coords[-1]:
        poly_coords.append(poly_coords[0])
        
    polygon = Polygon(poly_coords)

    hull_coords = [{"x": x, "y": y} for x, y in polygon.exterior.coords]
    
    results = []
    inside_count = 0
    outside_count = 0
    
    all_distances = []
    
    for p in pole_points:
        pt = Point(p["x"], p["y"])
        is_inside = polygon.contains(pt)
        distance = pt.distance(polygon)
        
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
        
    outside_distances = [d for d in all_distances if d > 0]
    min_dist = min(outside_distances) if outside_distances else 0
    max_dist = max(all_distances) if all_distances else 0
    avg_distance = (sum(all_distances) / len(all_distances)) if all_distances else 0

    for r in results:
        r["is_min_violation"] = (r["status"] == "OUTSIDE" and r["raw_distance"] == min_dist and min_dist > 0)
        r["is_max_violation"] = (r["status"] == "OUTSIDE" and r["raw_distance"] == max_dist and max_dist > 0)
        del r["raw_distance"]
    
    return {
        "poles": results,
        "boundary_hull": hull_coords,
        "summary": {
            "total": len(pole_points),
            "inside": inside_count,
            "outside": outside_count,
            "min_distance": round(min_dist, 4),
            "max_distance": round(max_dist, 4),
            "avg_distance": round(avg_distance, 4)
        }
    }
