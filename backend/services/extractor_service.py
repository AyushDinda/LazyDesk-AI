import os
from pathlib import Path
from typing import Dict, Any, Tuple
import pymupdf  # PyMuPDF
import docx
from PIL import Image
from backend.config import settings

class ExtractorService:
    SUPPORTED_DOCUMENTS = {".pdf", ".docx", ".txt", ".md", ".csv"}
    SUPPORTED_IMAGES = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"}
    ALL_SUPPORTED = SUPPORTED_DOCUMENTS | SUPPORTED_IMAGES

    def is_supported(self, file_path: str) -> bool:
        ext = Path(file_path).suffix.lower()
        return ext in self.ALL_SUPPORTED

    def extract_preview(self, file_path: str) -> Tuple[str, str, Dict[str, Any]]:
        """
        Extracts bounded document text or image metadata.
        Returns: (extracted_text, mime_type, metadata_dict)
        """
        ext = Path(file_path).suffix.lower()
        max_chars = settings.MAX_EXTRACT_CHARS

        try:
            file_stat = os.stat(file_path)
            file_size = file_stat.st_size

            if file_size > settings.MAX_FILE_SIZE_BYTES:
                return f"[File size exceeds limit: {file_size // (1024*1024)}MB]", "application/octet-stream", {"size": file_size}

            if ext == ".pdf":
                return self._extract_pdf(file_path, max_chars)
            elif ext == ".docx":
                return self._extract_docx(file_path, max_chars)
            elif ext in {".txt", ".md", ".csv"}:
                return self._extract_text(file_path, ext, max_chars)
            elif ext in self.SUPPORTED_IMAGES:
                return self._extract_image_metadata(file_path, ext, file_size)
            else:
                return "[Unsupported file format]", "application/octet-stream", {"size": file_size}

        except Exception as e:
            return f"[Extraction Error: {str(e)}]", "application/octet-stream", {"error": str(e)}

    def _extract_pdf(self, file_path: str, max_chars: int) -> Tuple[str, str, Dict[str, Any]]:
        text_parts = []
        page_count = 0
        try:
            with pymupdf.open(file_path) as doc:
                page_count = len(doc)
                if doc.is_encrypted:
                    return "[Encrypted PDF document]", "application/pdf", {"pages": page_count, "encrypted": True}

                for page in doc:
                    page_text = page.get_text()
                    if page_text:
                        text_parts.append(page_text.strip())
                    if sum(len(p) for p in text_parts) >= max_chars:
                        break

            combined = "\n".join(text_parts)[:max_chars].strip()
            if not combined:
                combined = "[PDF contains no selectable text (possibly scanned)]"

            return combined, "application/pdf", {"pages": page_count}
        except Exception as e:
            return f"[Error parsing PDF: {str(e)}]", "application/pdf", {"error": str(e)}

    def _extract_docx(self, file_path: str, max_chars: int) -> Tuple[str, str, Dict[str, Any]]:
        try:
            doc = docx.Document(file_path)
            text_parts = []
            for p in doc.paragraphs:
                if p.text and p.text.strip():
                    text_parts.append(p.text.strip())
                if sum(len(t) for t in text_parts) >= max_chars:
                    break

            combined = "\n".join(text_parts)[:max_chars].strip()
            if not combined:
                combined = "[Empty DOCX document]"
            return combined, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", {"paragraphs": len(doc.paragraphs)}
        except Exception as e:
            return f"[Error parsing DOCX: {str(e)}]", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", {"error": str(e)}

    def _extract_text(self, file_path: str, ext: str, max_chars: int) -> Tuple[str, str, Dict[str, Any]]:
        mime_map = {
            ".txt": "text/plain",
            ".md": "text/markdown",
            ".csv": "text/csv"
        }
        mime = mime_map.get(ext, "text/plain")
        
        # Read with UTF-8 first, fallback to latin-1
        try:
            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                content = f.read(max_chars * 2)[:max_chars].strip()
        except Exception:
            with open(file_path, "r", encoding="latin-1", errors="replace") as f:
                content = f.read(max_chars * 2)[:max_chars].strip()

        if not content:
            content = "[Empty text file]"

        return content, mime, {"lines": content.count("\n") + 1}

    def _extract_image_metadata(self, file_path: str, ext: str, file_size: int) -> Tuple[str, str, Dict[str, Any]]:
        mime_map = {
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".gif": "image/gif",
            ".webp": "image/webp",
            ".svg": "image/svg+xml"
        }
        mime = mime_map.get(ext, "image/jpeg")

        if ext == ".svg":
            summary = f"Vector Image (SVG), Size: {file_size} bytes"
            return summary, mime, {"format": "SVG", "size": file_size}

        try:
            with Image.open(file_path) as img:
                width, height = img.size
                format_name = img.format or ext.upper().lstrip(".")
                mode = img.mode
                summary = (
                    f"Image format: {format_name}, Resolution: {width}x{height} px, "
                    f"Color Mode: {mode}, File Size: {file_size} bytes. "
                    f"(Classified by image metadata; no OCR applied)"
                )
                return summary, mime, {
                    "width": width,
                    "height": height,
                    "format": format_name,
                    "mode": mode,
                    "size": file_size
                }
        except Exception as e:
            return f"Image file (metadata extraction error: {str(e)})", mime, {"error": str(e)}

extractor_service = ExtractorService()
