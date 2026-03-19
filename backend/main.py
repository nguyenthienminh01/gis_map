import os
import io
import base64
import tempfile
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from geometry_engine import parse_file, compute_analysis
from ai_inference import generate_ai_summary
import uvicorn
from dotenv import load_dotenv

load_dotenv()

# Try importing rasterio for TIF support
try:
    import rasterio
    from rasterio.warp import calculate_default_transform, reproject, Resampling
    from rasterio.crs import CRS
    import numpy as np
    from PIL import Image
    RASTERIO_AVAILABLE = True
except ImportError:
    RASTERIO_AVAILABLE = False

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/upload-survey")
async def upload_survey(vach_file: UploadFile = File(...), tru_file: UploadFile = File(...)):
    allowed_extensions = {'.txt', '.csv'}
    
    def get_ext(fname):
        if not fname: return ""
        _, ext = os.path.splitext(fname)
        return ext.lower()
        
    if get_ext(vach_file.filename) not in allowed_extensions:
        raise HTTPException(status_code=400, detail=f"Boundary file must be a .txt or .csv file.")
    if get_ext(tru_file.filename) not in allowed_extensions:
        raise HTTPException(status_code=400, detail=f"Pole file must be a .txt or .csv file.")
        
    try:
        # Read files
        vach_content = (await vach_file.read()).decode("utf-8")
        tru_content = (await tru_file.read()).decode("utf-8")
        
        boundary_points = parse_file(vach_content, vach_file.filename, point_type="vach")
        pole_points = parse_file(tru_content, tru_file.filename, point_type="tru")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"An error occurred: {str(e)}")
    
    analysis_results = compute_analysis(boundary_points, pole_points)
    
    # Generate an AI summary or Mock if key not set
    ai_summary = generate_ai_summary(analysis_results["summary"])
    
    return {
        "analysis_id": "test_id_123",
        "boundary_points": analysis_results["boundary_hull"],
        "classification": analysis_results["poles"],
        "summary_stats": analysis_results["summary"],
        "ai_summary": ai_summary
    }

@app.post("/upload-tif")
async def upload_tif(tif_file: UploadFile = File(...)):
    if not RASTERIO_AVAILABLE:
        raise HTTPException(status_code=500, detail="rasterio / Pillow not installed on server.")
    
    ext = os.path.splitext(tif_file.filename or "")[1].lower()
    if ext not in (".tif", ".tiff"):
        raise HTTPException(status_code=400, detail="File must be a .tif or .tiff file.")
    
    tif_bytes = await tif_file.read()
    
    try:
        with tempfile.NamedTemporaryFile(suffix=".tif", delete=False) as tmp:
            tmp.write(tif_bytes)
            tmp_path = tmp.name
        
        with rasterio.open(tmp_path) as src:
            src_crs = src.crs
            # Target: UTM Zone 48N (EPSG:32648) - matches VN2000-like survey coords ~511k, ~1290k
            dst_crs = CRS.from_epsg(32648)
            
            # Calculate reprojected transform + dimensions
            transform_dst, width_dst, height_dst = calculate_default_transform(
                src_crs, dst_crs, src.width, src.height, *src.bounds
            )
            
            # Calculate bounds in target CRS
            left   = transform_dst.c
            top    = transform_dst.f
            right  = left + transform_dst.a * width_dst
            bottom = top  + transform_dst.e * height_dst

            # Limit output resolution to max 2048 pixels to avoid memory issues
            MAX_PX = 2048
            scale = min(1.0, MAX_PX / max(width_dst, height_dst))
            out_w = max(1, int(width_dst * scale))
            out_h = max(1, int(height_dst * scale))
            
            # Adjust transform for scaled output
            from rasterio.transform import from_bounds as make_transform
            final_transform = make_transform(left, bottom, right, top, out_w, out_h)

            band_count = src.count
            out_bands = min(band_count, 3)
            dst_arrays = []

            for b in range(1, out_bands + 1):
                dst_array = np.zeros((out_h, out_w), dtype=np.float32)
                reproject(
                    source=rasterio.band(src, b),
                    destination=dst_array,
                    src_transform=src.transform,
                    src_crs=src_crs,
                    dst_transform=final_transform,
                    dst_crs=dst_crs,
                    resampling=Resampling.bilinear,
                    src_nodata=src.nodata,
                    dst_nodata=0,
                )
                
                # Normalize using percentile stretch (ignore zero/nodata)
                valid_mask = dst_array != 0
                if valid_mask.any():
                    p_min, p_max = np.percentile(dst_array[valid_mask], (2, 98))
                    if p_max > p_min:
                        norm = (dst_array - p_min) / (p_max - p_min) * 255
                    else:
                        norm = np.full_like(dst_array, 128)
                else:
                    norm = dst_array
                    
                arr_u8 = np.clip(norm, 0, 255).astype(np.uint8)
                dst_arrays.append(arr_u8)

        os.unlink(tmp_path)

        # Build RGBA
        if len(dst_arrays) == 1:
            rgb = np.stack([dst_arrays[0]] * 3, axis=-1)
        else:
            rgb = np.stack(dst_arrays, axis=-1)
        
        # Alpha: transparent where all bands are 0
        alpha = (rgb.max(axis=-1) > 0).astype(np.uint8) * 255
        rgba = np.dstack((rgb, alpha))

        img = Image.fromarray(rgba, mode='RGBA')
        buf = io.BytesIO()
        img.save(buf, format='PNG')
        img_b64 = base64.b64encode(buf.getvalue()).decode('utf-8')
        
        return JSONResponse({
            "image_b64": img_b64,
            "bounds": {
                "x_min": float(left),
                "x_max": float(right),
                "y_min": float(bottom),
                "y_max": float(top)
            },
            "crs": "EPSG:32648",
            "filename": tif_file.filename
        })
    
    except Exception as e:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"Failed to process TIF file: {str(e)}")


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
