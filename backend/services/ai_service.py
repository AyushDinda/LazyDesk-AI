import json
import re
import httpx
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from backend.config import settings
from backend.services.security_service import ALLOWED_CATEGORIES, security_service

class AIAnalysisResult(BaseModel):
    description: str = Field(..., description="Concise description of the file's purpose")
    suggested_filename: str = Field(..., description="Descriptive base filename without extension")
    category: str = Field(..., description="Suggested destination folder category")
    reason: str = Field(..., description="Brief reason for the categorization")
    is_mock: bool = Field(default=False, description="Whether the result was produced by mock AI")


class AIService:
    def __init__(self):
        self.base_url = settings.OLLAMA_BASE_URL.rstrip("/")
        self.model_name = settings.OLLAMA_MODEL
        self.mock_mode = settings.MOCK_AI

    async def check_status(self) -> Dict[str, Any]:
        """
        Queries Ollama /api/version and /api/tags to verify connectivity and model availability.
        """
        if self.mock_mode:
            return {
                "running": True,
                "active_model": f"{self.model_name} (Mock Mode)",
                "model_available": True,
                "mock_mode": True,
                "available_models": ["mock-model"],
                "message": "LazyDesk AI is running in deterministic Mock AI mode."
            }

        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                # Check version
                version_resp = await client.get(f"{self.base_url}/api/version")
                if version_resp.status_code != 200:
                    return {
                        "running": False,
                        "active_model": self.model_name,
                        "model_available": False,
                        "mock_mode": False,
                        "available_models": [],
                        "message": f"Ollama responded with status {version_resp.status_code}"
                    }

                # Check available models
                tags_resp = await client.get(f"{self.base_url}/api/tags")
                models_data = tags_resp.json().get("models", [])
                available_names = [m.get("name", "") for m in models_data]

                # Check if configured model or variant is installed
                model_found = any(
                    self.model_name in name or name.startswith(self.model_name)
                    for name in available_names
                )

                # If requested model not found but another model is available, note it
                fallback_model = self.model_name
                if not model_found and available_names:
                    fallback_model = available_names[0]

                return {
                    "running": True,
                    "active_model": self.model_name if model_found else fallback_model,
                    "model_available": model_found or len(available_names) > 0,
                    "mock_mode": False,
                    "available_models": available_names,
                    "message": "Ollama service is reachable and responsive." if model_found else f"Model '{self.model_name}' not found locally. Available models: {', '.join(available_names) if available_names else 'None'}"
                }
        except httpx.ConnectError:
            return {
                "running": False,
                "active_model": self.model_name,
                "model_available": False,
                "mock_mode": False,
                "available_models": [],
                "message": f"Cannot connect to Ollama at {self.base_url}. Ensure 'ollama serve' is running."
            }
        except Exception as e:
            return {
                "running": False,
                "active_model": self.model_name,
                "model_available": False,
                "mock_mode": False,
                "available_models": [],
                "message": f"Ollama status error: {str(e)}"
            }

    async def analyze_document(
        self,
        filename: str,
        file_extension: str,
        extracted_text: str,
        force_mock: bool = False
    ) -> AIAnalysisResult:
        """
        Analyzes document context and produces structured categorization.
        Uses Ollama if reachable and not mock_mode, else falls back cleanly to deterministic mock.
        """
        if self.mock_mode or force_mock:
            return self._mock_analyze(filename, file_extension, extracted_text)

        status = await self.check_status()
        if not status.get("running"):
            # Provide clear mock fallback or error
            # If Ollama is offline, we fallback to mock with an explicit mock label
            result = self._mock_analyze(filename, file_extension, extracted_text)
            result.reason = f"[Offline Fallback] {result.reason}"
            return result

        model_to_use = status.get("active_model", self.model_name)

        system_prompt = (
            "You are LazyDesk AI, a local file classification specialist. "
            "Analyze the file name and snippet below. Suggest a descriptive, clean filename "
            "(letters, numbers, underscores, or hyphens only, without extension) and choose the best matching category from: "
            f"{', '.join(ALLOWED_CATEGORIES)}. "
            "You MUST respond ONLY with a JSON object matching this schema:\n"
            "{\n"
            '  "description": "<concise 1-sentence summary of document purpose>",\n'
            '  "suggested_filename": "<descriptive_filename_without_extension>",\n'
            '  "category": "<one category from the allowed list>",\n'
            '  "reason": "<short justification based on content>"\n'
            "}"
        )

        user_prompt = (
            f"Original Filename: {filename}\n"
            f"File Extension: {file_extension}\n"
            f"Extracted Content Preview:\n"
            f"{extracted_text[:2500]}\n"
        )

        try:
            payload = {
                "model": model_to_use,
                "prompt": f"{system_prompt}\n\n{user_prompt}",
                "format": "json",
                "stream": False,
                "options": {
                    "temperature": 0.2
                }
            }

            async with httpx.AsyncClient(timeout=12.0) as client:
                resp = await client.post(f"{self.base_url}/api/generate", json=payload)
                if resp.status_code != 200:
                    raise RuntimeError(f"Ollama returned HTTP {resp.status_code}: {resp.text}")

                data = resp.json()
                raw_response = data.get("response", "{}")

                # Parse JSON
                parsed = json.loads(raw_response)
                
                # Sanitize and validate
                category = parsed.get("category", "Other")
                if category not in ALLOWED_CATEGORIES:
                    category = "Other"

                suggested_fn = parsed.get("suggested_filename", "")
                if not suggested_fn:
                    suggested_fn = filename

                # Ensure filename is clean
                clean_name = security_service.sanitize_filename(suggested_fn)
                clean_stem = re.sub(r'\.[^.]+$', '', clean_name)

                return AIAnalysisResult(
                    description=parsed.get("description", "Analyzed document")[:250],
                    suggested_filename=clean_stem,
                    category=category,
                    reason=parsed.get("reason", "Categorized based on document content")[:250],
                    is_mock=False
                )

        except Exception as e:
            # Fallback to deterministic mock analysis on inference failure
            res = self._mock_analyze(filename, file_extension, extracted_text)
            res.reason = f"[AI Analysis error: {str(e)[:60]}... Defaulted to heuristic] {res.reason}"
            return res

    def _mock_analyze(self, filename: str, file_extension: str, extracted_text: str) -> AIAnalysisResult:
        """
        Deterministic, smart heuristic analysis for development, tests, and offline use.
        Inspects content and filename to assign reasonable categories and names.
        """
        fn_lower = filename.lower()
        text_lower = (extracted_text or "").lower()
        combined = f"{fn_lower} {text_lower}"

        category = "Documents"
        description = "Standard document"
        suggested_stem = ""
        reason = "Classified based on document structure."

        # Heuristic rules
        if file_extension.lower() in {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"}:
            category = "Images"
            description = "Image or media asset"
            reason = "Classified by file type and image metadata."
            suggested_stem = re.sub(r'[^a-zA-Z0-9_-]', '_', filename.split('.')[0])
            if not suggested_stem:
                suggested_stem = "media_asset"
            suggested_stem = f"image_{suggested_stem}"

        elif any(k in combined for k in ["invoice", "receipt", "tax", "billing", "expense", "bank", "payment", "payroll", "budget", "financial", "salary"]):
            category = "Finance"
            description = "Financial or billing statement"
            reason = "Detected financial terms and monetary keywords in document content."
            suggested_stem = "Financial_Statement"
            if "invoice" in combined:
                suggested_stem = "Invoice_Record"
            elif "receipt" in combined:
                suggested_stem = "Purchase_Receipt"
            elif "tax" in combined:
                suggested_stem = "Tax_Document"

        elif any(k in combined for k in ["syllabus", "lecture", "homework", "exam", "course", "assignment", "quiz", "university", "school", "curriculum", "study"]):
            category = "Education"
            description = "Academic course material or coursework"
            reason = "Identified academic coursework, syllabus, or lecture keywords."
            suggested_stem = "Academic_Coursework"
            if "syllabus" in combined:
                suggested_stem = "Course_Syllabus"
            elif "assignment" in combined or "homework" in combined:
                suggested_stem = "Course_Assignment"

        elif any(k in combined for k in ["resume", "cv", "curriculum vitae", "contract", "meeting minutes", "agreement", "nda", "proposal", "client", "quarterly"]):
            category = "Work"
            description = "Professional or business document"
            reason = "Contains corporate, contract, or career-related terminology."
            suggested_stem = "Business_Document"
            if "resume" in combined or "cv" in combined:
                suggested_stem = "Professional_Resume"
            elif "contract" in combined or "agreement" in combined:
                suggested_stem = "Executed_Agreement"
            elif "meeting" in combined:
                suggested_stem = "Meeting_Summary"

        elif any(k in combined for k in ["todo", "notes", "checklist", "scratchpad", "journal", "diary", "reminder", "ideas"]):
            category = "Notes"
            description = "Personal or planning notes"
            reason = "Text reflects personal notes, checklist, or journal entries."
            suggested_stem = "Organized_Notes"

        elif any(k in combined for k in ["readme", "code", "api", "architecture", "algorithm", "python", "javascript", "react", "fastapi", "git", "hacktober"]):
            category = "Projects"
            description = "Software or technical project document"
            reason = "Technical syntax and software development terminology detected."
            suggested_stem = "Project_Documentation"

        else:
            category = "Documents"
            description = "General text document"
            reason = "General document without domain-specific keywords."
            clean_base = re.sub(r'[^a-zA-Z0-9_-]', '_', filename.split('.')[0])
            suggested_stem = clean_base if clean_base else "Document"

        # Refine suggested stem using date or title if present
        clean_stem = security_service.sanitize_filename(suggested_stem)
        clean_stem = re.sub(r'\.[^.]+$', '', clean_stem)

        return AIAnalysisResult(
            description=description,
            suggested_filename=clean_stem,
            category=category,
            reason=reason,
            is_mock=True
        )

ai_service = AIService()
