import os
import re
from pathlib import Path
from typing import List, Optional, Tuple
from backend.config import settings

WINDOWS_RESERVED_NAMES = {
    "CON", "PRN", "AUX", "NUL",
    "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
    "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"
}

ALLOWED_CATEGORIES = [
    "Documents",
    "Education",
    "Work",
    "Finance",
    "Projects",
    "Images",
    "Notes",
    "Other"
]

class SecurityService:
    def __init__(self, allowed_roots: Optional[List[str]] = None):
        if allowed_roots is None:
            self.allowed_roots = [os.path.realpath(r) for r in settings.ALLOWED_ROOTS]
        else:
            self.allowed_roots = [os.path.realpath(r) for r in allowed_roots]

    def add_allowed_root(self, root_path: str) -> str:
        real_root = os.path.realpath(root_path)
        if real_root not in self.allowed_roots:
            self.allowed_roots.append(real_root)
        return real_root

    def get_allowed_roots(self) -> List[str]:
        return list(self.allowed_roots)

    def is_path_within_allowed_roots(self, target_path: str) -> Tuple[bool, Optional[str]]:
        """
        Validates if target_path resolves strictly inside one of the allowed roots.
        Prevents path traversal, directory escapes, and symbolic link trickery.
        """
        try:
            # Reject null bytes or traversal characters in raw string
            if "\0" in target_path:
                return False, "Path contains invalid null byte"
            
            resolved_path = os.path.realpath(target_path)
            
            for allowed_root in self.allowed_roots:
                # Target is allowed if it is identical to allowed_root or a subpath of it
                if resolved_path == allowed_root or resolved_path.startswith(allowed_root + os.sep):
                    return True, None
                    
            return False, f"Path '{target_path}' is outside configured allowed roots"
        except Exception as e:
            return False, f"Invalid path resolution: {str(e)}"

    def validate_folder(self, folder_path: str) -> Tuple[bool, str, Optional[str]]:
        """
        Validates that a folder exists, is a directory, not a symlink, and inside allowed roots.
        Returns: (is_valid, canonical_path, error_message)
        """
        if not folder_path or not folder_path.strip():
            return False, "", "Folder path cannot be empty"

        folder_str = folder_path.strip()
        
        # Check traversal in raw string
        if ".." in folder_str.replace("\\", "/").split("/"):
            return False, "", "Path traversal attempt detected"

        try:
            path_obj = Path(folder_str)
            if not path_obj.exists():
                return False, "", f"Directory does not exist: {folder_str}"
            
            if not path_obj.is_dir():
                return False, "", f"Path is not a directory: {folder_str}"

            if path_obj.is_symlink():
                return False, "", "Symbolic links are not permitted as scan targets"

            canonical = os.path.realpath(str(path_obj))
            within_allowed, err = self.is_path_within_allowed_roots(canonical)
            if not within_allowed:
                return False, "", err or "Directory is not within permitted allowed roots"

            return True, canonical, None
        except Exception as e:
            return False, "", f"Folder validation error: {str(e)}"

    @staticmethod
    def sanitize_filename(filename: str, fallback_ext: str = "") -> str:
        r"""
        Sanitizes a proposed filename for the host OS (Windows, Linux, macOS).
        - Strips path separators and illegal characters (/\:*?"<>|)
        - Strips control characters
        - Removes leading/trailing spaces and dots
        - Protects against reserved Windows device names (CON, NUL, AUX, etc.)
        - Ensures extension is preserved and length is capped
        """
        if not filename or not filename.strip():
            base = "unnamed_document"
            ext = fallback_ext.strip()
            if ext and not ext.startswith("."):
                ext = f".{ext}"
            return f"{base}{ext}"

        raw_name = filename.strip()
        
        # Extract extension if present
        name_path = Path(raw_name)
        ext = name_path.suffix
        stem = name_path.stem

        if not ext and fallback_ext:
            ext = fallback_ext if fallback_ext.startswith(".") else f".{fallback_ext}"

        # Clean stem and extension
        # Replace illegal characters with an underscore
        clean_stem = re.sub(r'[\\/*?:"<>|\x00-\x1f]', '_', stem)
        clean_ext = re.sub(r'[\\/*?:"<>|\x00-\x1f]', '', ext)
        
        # Replace consecutive underscores/spaces
        clean_stem = re.sub(r'[\s_]+', ' ', clean_stem).strip('. ')
        if not clean_stem:
            clean_stem = "organized_file"

        # Check for reserved Windows names
        upper_stem = clean_stem.upper()
        if upper_stem in WINDOWS_RESERVED_NAMES or any(upper_stem.startswith(res + ".") for res in WINDOWS_RESERVED_NAMES):
            clean_stem = f"file_{clean_stem}"

        # Truncate length if excessively long
        max_stem_len = 180
        if len(clean_stem) > max_stem_len:
            clean_stem = clean_stem[:max_stem_len].rstrip('. ')

        final_filename = f"{clean_stem}{clean_ext}" if clean_ext else clean_stem
        return final_filename

    def resolve_destination_path(
        self,
        base_folder: str,
        category: str,
        filename: str,
        avoid_collision: bool = True
    ) -> Tuple[str, bool]:
        """
        Constructs safe destination path within base_folder / category / filename.
        Returns (destination_path, had_collision).
        Guarantees that destination remains inside allowed roots and will not overwrite.
        """
        # Validate category
        safe_category = category if category in ALLOWED_CATEGORIES else "Other"
        safe_filename = self.sanitize_filename(filename)

        category_dir = os.path.join(base_folder, safe_category)
        candidate_path = os.path.join(category_dir, safe_filename)

        # Safety check: candidate must be within base_folder
        within, _ = self.is_path_within_allowed_roots(candidate_path)
        if not within:
            raise ValueError(f"Constructed destination '{candidate_path}' escapes allowed roots")

        had_collision = False
        if avoid_collision and os.path.exists(candidate_path):
            had_collision = True
            stem = Path(safe_filename).stem
            ext = Path(safe_filename).suffix
            counter = 1
            while os.path.exists(candidate_path):
                new_name = f"{stem} ({counter}){ext}"
                candidate_path = os.path.join(category_dir, new_name)
                counter += 1

        return candidate_path, had_collision

security_service = SecurityService()
