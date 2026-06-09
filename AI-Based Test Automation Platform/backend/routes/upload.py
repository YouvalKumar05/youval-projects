import os
from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import List
from schemas.api_models import StandardResponse

router = APIRouter(prefix="/api/upload", tags=["upload"])

# Ensure upload directory exists
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOAD_DIR = os.path.join(BASE_DIR, "data", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("", response_model=StandardResponse)
async def upload_files(files: List[UploadFile] = File(...)):
    try:
        results = []
        for file in files:
            file_path = os.path.join(UPLOAD_DIR, file.filename)
            content = await file.read()
            with open(file_path, "wb") as f:
                f.write(content)
            
            results.append({
                "filename": file.filename,
                "size": len(content),
                "content_type": file.content_type
            })
        
        return StandardResponse(
            status="success",
            message=f"Uploaded {len(results)} files successfully",
            data={"files": results}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
