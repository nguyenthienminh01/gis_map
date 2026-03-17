import os
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from geometry_engine import parse_file, compute_analysis
from ai_inference import generate_ai_summary
import uvicorn
from dotenv import load_dotenv

load_dotenv()

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

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
