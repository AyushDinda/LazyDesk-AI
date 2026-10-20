import os
import shutil
import hashlib
import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session

from backend.config import settings
from backend.database.models import ScanSession, FileItem, OperationBatch, FileOperation
from backend.services.security_service import security_service
from backend.services.extractor_service import extractor_service
from backend.services.ai_service import ai_service

def calculate_sha256(file_path: str) -> Optional[str]:
    """Calculates SHA-256 hash of a file for integrity and undo verification."""
    try:
        sha256 = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                sha256.update(chunk)
        return sha256.hexdigest()
    except Exception:
        return None

class FilesystemService:
    def scan_directory(self, folder_path: str, db: Session) -> Tuple[ScanSession, List[FileItem], List[str]]:
        """
        Scans a directory for supported files, extracts text previews, and creates DB entries.
        Returns: (session, items, errors)
        """
        is_valid, canonical_folder, err = security_service.validate_folder(folder_path)
        if not is_valid:
            raise ValueError(err or "Invalid folder path")

        scan_session = ScanSession(
            folder_path=canonical_folder,
            status="scanning"
        )
        db.add(scan_session)
        db.commit()
        db.refresh(scan_session)

        discovered_items: List[FileItem] = []
        errors: List[str] = []

        try:
            # List entries in directory (non-recursive by default to keep user in explicit control)
            with os.scandir(canonical_folder) as entries:
                for entry in entries:
                    try:
                        # Skip hidden files or directories
                        if entry.name.startswith("."):
                            continue

                        # Skip subdirectories from top-level scan
                        if entry.is_dir():
                            continue

                        # Reject symlinks
                        if entry.is_symlink():
                            continue

                        file_path = os.path.realpath(entry.path)

                        # Re-verify path safety
                        within, path_err = security_service.is_path_within_allowed_roots(file_path)
                        if not within:
                            errors.append(f"Skipped {entry.name}: {path_err}")
                            continue

                        # Check supported extension
                        ext = Path(file_path).suffix.lower()
                        if not extractor_service.is_supported(file_path):
                            continue

                        file_size = entry.stat().st_size
                        if file_size > settings.MAX_FILE_SIZE_BYTES:
                            errors.append(f"Skipped {entry.name}: Exceeds size limit ({file_size // (1024*1024)}MB)")
                            continue

                        # Extract preview and metadata
                        preview, mime_type, _ = extractor_service.extract_preview(file_path)

                        file_item = FileItem(
                            scan_session_id=scan_session.id,
                            original_path=file_path,
                            original_filename=entry.name,
                            file_extension=ext,
                            file_size_bytes=file_size,
                            mime_type=mime_type,
                            extracted_text_preview=preview,
                            analysis_status="pending",
                            is_approved=True
                        )
                        db.add(file_item)
                        discovered_items.append(file_item)

                    except Exception as item_err:
                        errors.append(f"Error reading {entry.name}: {str(item_err)}")

            scan_session.total_files = len(discovered_items)
            scan_session.scanned_files = len(discovered_items)
            scan_session.status = "scanned"
            db.commit()

            return scan_session, discovered_items, errors

        except Exception as scan_err:
            scan_session.status = "failed"
            db.commit()
            raise RuntimeError(f"Scan failed: {str(scan_err)}")

    async def analyze_scan_session(
        self,
        session_id: int,
        db: Session,
        force_mock: bool = False
    ) -> List[FileItem]:
        """
        Runs AI analysis on all pending file items in a scan session.
        Constructs safe destination categories and suggested filenames.
        """
        session = db.query(ScanSession).filter(ScanSession.id == session_id).first()
        if not session:
            raise ValueError(f"Scan session {session_id} not found")

        file_items = db.query(FileItem).filter(FileItem.scan_session_id == session_id).all()
        session.status = "analyzing"
        db.commit()

        for item in file_items:
            try:
                ai_res = await ai_service.analyze_document(
                    filename=item.original_filename,
                    file_extension=item.file_extension,
                    extracted_text=item.extracted_text_preview or "",
                    force_mock=force_mock
                )

                item.proposed_category = ai_res.category
                item.reason = ai_res.reason
                
                # Compose safe proposed filename with extension
                sanitized_name = security_service.sanitize_filename(
                    ai_res.suggested_filename,
                    fallback_ext=item.file_extension
                )
                item.proposed_filename = sanitized_name

                # Construct safe destination path inside the scanned folder
                dest_path, _ = security_service.resolve_destination_path(
                    base_folder=session.folder_path,
                    category=ai_res.category,
                    filename=sanitized_name,
                    avoid_collision=True
                )
                item.proposed_destination_path = dest_path
                item.analysis_status = "analyzed"

            except Exception as e:
                item.analysis_status = "failed"
                item.error_message = str(e)
                # Fallback proposal
                fallback_name = security_service.sanitize_filename(item.original_filename)
                item.proposed_filename = fallback_name
                item.proposed_category = "Other"
                dest_path, _ = security_service.resolve_destination_path(
                    base_folder=session.folder_path,
                    category="Other",
                    filename=fallback_name,
                    avoid_collision=True
                )
                item.proposed_destination_path = dest_path

        session.status = "completed"
        db.commit()
        return file_items

    def generate_preview(self, session_id: int, db: Session) -> List[Dict[str, Any]]:
        """
        Generates pre-execution action table verifying live source file existence,
        detecting conflicts, and providing exact preview before mutations.
        """
        session = db.query(ScanSession).filter(ScanSession.id == session_id).first()
        if not session:
            raise ValueError(f"Scan session {session_id} not found")

        file_items = db.query(FileItem).filter(
            FileItem.scan_session_id == session_id,
            FileItem.is_approved == True,
            FileItem.analysis_status != "excluded"
        ).all()

        preview_rows = []
        for item in file_items:
            source_exists = os.path.exists(item.original_path)
            
            # Recalculate destination path to ensure live conflict detection
            dest_path, had_collision = security_service.resolve_destination_path(
                base_folder=session.folder_path,
                category=item.proposed_category or "Other",
                filename=item.proposed_filename or item.original_filename,
                avoid_collision=True
            )

            # Check if source and destination are identical (no-op)
            is_noop = os.path.realpath(item.original_path) == os.path.realpath(dest_path)

            status = "ready"
            if not source_exists:
                status = "source_missing"
            elif is_noop:
                status = "no_change_needed"
            elif had_collision:
                status = "renamed_to_avoid_collision"

            preview_rows.append({
                "file_item_id": item.id,
                "original_filename": item.original_filename,
                "original_path": item.original_path,
                "proposed_filename": Path(dest_path).name,
                "proposed_category": item.proposed_category,
                "proposed_destination_path": dest_path,
                "operation": "Move & Organize",
                "source_exists": source_exists,
                "status": status,
                "had_collision": had_collision
            })

        return preview_rows

    def execute_batch_operations(self, session_id: int, db: Session) -> OperationBatch:
        """
        Executes approved file moves safely, records hashes and DB operations,
        and prepares undo records.
        """
        session = db.query(ScanSession).filter(ScanSession.id == session_id).first()
        if not session:
            raise ValueError(f"Scan session {session_id} not found")

        approved_items = db.query(FileItem).filter(
            FileItem.scan_session_id == session_id,
            FileItem.is_approved == True,
            FileItem.analysis_status != "excluded"
        ).all()

        batch = OperationBatch(
            scan_session_id=session.id,
            total_operations=len(approved_items),
            status="pending"
        )
        db.add(batch)
        db.commit()
        db.refresh(batch)

        success_count = 0
        failed_count = 0

        for item in approved_items:
            source = item.original_path
            target_cat = item.proposed_category or "Other"
            target_name = item.proposed_filename or item.original_filename

            op = FileOperation(
                batch_id=batch.id,
                file_item_id=item.id,
                source_path=source,
                destination_path="",
                operation_type="move_rename",
                status="pending"
            )
            db.add(op)
            db.commit()

            try:
                # 1. Verify source exists
                if not os.path.exists(source):
                    raise FileNotFoundError(f"Source file does not exist: {source}")

                # 2. Verify source is inside allowed root
                within_src, src_err = security_service.is_path_within_allowed_roots(source)
                if not within_src:
                    raise PermissionError(src_err or "Source outside permitted roots")

                # 3. Reject symlink
                if os.path.islink(source):
                    raise PermissionError("Symbolic links cannot be moved")

                # 4. Resolve destination path safely (avoid overwrite)
                dest_path, _ = security_service.resolve_destination_path(
                    base_folder=session.folder_path,
                    category=target_cat,
                    filename=target_name,
                    avoid_collision=True
                )
                op.destination_path = dest_path

                # 5. Verify destination is inside allowed root
                within_dest, dest_err = security_service.is_path_within_allowed_roots(dest_path)
                if not within_dest:
                    raise PermissionError(dest_err or "Destination outside permitted roots")

                # If source is already at destination, mark complete
                if os.path.realpath(source) == os.path.realpath(dest_path):
                    op.status = "success"
                    op.executed_at = datetime.datetime.utcnow()
                    success_count += 1
                    db.commit()
                    continue

                # 6. Calculate source hash before move
                hash_before = calculate_sha256(source)
                op.file_hash_before = hash_before

                # 7. Ensure destination folder exists
                dest_dir = os.path.dirname(dest_path)
                os.makedirs(dest_dir, exist_ok=True)

                # 8. Perform safe atomic move / replace
                shutil.move(source, dest_path)

                # 9. Verify destination hash after move
                hash_after = calculate_sha256(dest_path)
                op.file_hash_after = hash_after
                op.status = "success"
                op.executed_at = datetime.datetime.now(datetime.timezone.utc)
                success_count += 1

            except Exception as e:
                op.status = "failed"
                op.error_message = str(e)
                failed_count += 1

            db.commit()

        batch.successful_operations = success_count
        batch.failed_operations = failed_count
        batch.status = "completed" if failed_count == 0 else "partially_failed"
        db.commit()
        db.refresh(batch)

        return batch

    def undo_operation(self, operation_id: int, db: Session) -> Tuple[bool, str]:
        """
        Safely reverts a file move operation.
        Verifies destination file exists, checks hash/integrity, ensures source
        path is available without overwriting, and moves it back.
        """
        op = db.query(FileOperation).filter(FileOperation.id == operation_id).first()
        if not op:
            return False, f"Operation {operation_id} not found"

        if op.status == "undone":
            return False, "Operation has already been undone"

        if op.status != "success":
            return False, f"Cannot undo operation with status '{op.status}'"

        current_path = op.destination_path
        original_path = op.source_path

        # 1. Verify current path exists
        if not os.path.exists(current_path):
            op.status = "undo_failed"
            op.error_message = f"File to undo no longer exists at: {current_path}"
            db.commit()
            return False, op.error_message

        # 2. Check integrity if hash was recorded
        if op.file_hash_after:
            current_hash = calculate_sha256(current_path)
            if current_hash != op.file_hash_after:
                op.status = "undo_failed"
                op.error_message = "File content has changed since it was organized; refusing to overwrite or move back blindly"
                db.commit()
                return False, op.error_message

        # 3. Check if original source path is already occupied
        if os.path.exists(original_path):
            op.status = "undo_failed"
            op.error_message = f"Original location is already occupied by another file: {original_path}"
            db.commit()
            return False, op.error_message

        # 4. Ensure original parent directory exists
        os.makedirs(os.path.dirname(original_path), exist_ok=True)

        try:
            # 5. Move back
            shutil.move(current_path, original_path)
            op.status = "undone"
            op.undone_at = datetime.datetime.now(datetime.timezone.utc)
            
            # Update batch count
            if op.batch:
                op.batch.undone_operations = (op.batch.undone_operations or 0) + 1
                if op.batch.undone_operations == op.batch.successful_operations:
                    op.batch.status = "undone"
                else:
                    op.batch.status = "partially_undone"

            db.commit()
            return True, f"Successfully restored {Path(original_path).name}"
        except Exception as e:
            op.status = "undo_failed"
            op.error_message = str(e)
            db.commit()
            return False, f"Undo failed: {str(e)}"

    def undo_batch(self, batch_id: int, db: Session) -> Dict[str, Any]:
        """Undoes all successful operations in a batch."""
        batch = db.query(OperationBatch).filter(OperationBatch.id == batch_id).first()
        if not batch:
            raise ValueError(f"Batch {batch_id} not found")

        successful_ops = db.query(FileOperation).filter(
            FileOperation.batch_id == batch_id,
            FileOperation.status == "success"
        ).all()

        undone = 0
        failed = 0
        messages = []

        for op in successful_ops:
            ok, msg = self.undo_operation(op.id, db)
            if ok:
                undone += 1
            else:
                failed += 1
            messages.append(msg)

        return {
            "batch_id": batch_id,
            "total_attempted": len(successful_ops),
            "successfully_undone": undone,
            "failed_to_undo": failed,
            "details": messages
        }

filesystem_service = FilesystemService()
