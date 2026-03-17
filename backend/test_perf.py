import time
import pandas as pd
from shapely.geometry import Point
import alphashape

print("Loading test data...")
try:
    df_bound = pd.read_csv("vach.csv")
    df_pole = pd.read_csv("tru.csv")
except Exception as e:
    print("Could not load local dataset:", e)
    df_bound = pd.DataFrame()

if not df_bound.empty:
    pts = [Point(r['X'], r['Y']) for idx, r in df_bound.iterrows()]
    print(f"Loaded {len(pts)} boundary points.")
    start = time.time()
    poly = alphashape.alphashape(pts, 0.05)
    print(f"Alphashape in {time.time()-start:.2f}s")
    
    start2 = time.time()
    for idx, r in df_pole.iterrows():
        pt = Point(r['X'], r['Y'])
        _ = pt.distance(poly)
    print(f"Distance calculation for {len(df_pole)} poles took {time.time()-start2:.2f}s")
