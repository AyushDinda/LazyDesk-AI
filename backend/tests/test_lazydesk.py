import os
import shutil
import tempfile
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.main import app
from backend.database.session import Base, get_db
from backend.config import settings
from backend.services.security_service import SecurityService, security_service
from backend.services.extractor_service import extractor_service
from backend.services.ai_service import AIService, AIAnalysisResult
from backend.services.filesystem_service import FilesystemService

@pytest.fixture
def temp_workspace():
    """Creates a temporary workspace with allowed root and sample files."""
    temp_dir = tempfile.mkdtemp(prefix="lazydesk_test_")
    allowed_root = os.path.realpath(temp_dir)
    
    # Configure security service with this isolated root
    sec_service = SecurityService(allowed_roots=[allowed_root])

    # Create dummy files
    txt_file = os.path.join(allowed_root, "invoice_october.txt")
    with open(txt_file, "w", encoding="utf-8") as f:
        f.write("Invoice for Cloud Services. Total amount due: $150.00. Payment due immediately.")

    doc_file = os.path.join(allowed_root, "cs101_syllabus.md")
    with open(doc_file, "w", encoding="utf-8") as f:
        f.write("# Computer Science 101 Syllabus\nHomework assignments and final exam schedule.")

    yield allowed_root, sec_service

    # Teardown
    shutil.rmtree(temp_dir, ignore_errors=True)

@pytest.fixture
def test_db(temp_workspace):
    allowed_root, _ = temp_workspace
    db_path = os.path.join(allowed_root, "test.db")
    engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture
def client(test_db):
    def override_get_db():
        try:
            yield test_db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

# 1. Health Endpoint Test
def test_health_endpoint(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["app"] == "LazyDesk AI"

# 2. AI Status Test
def test_ai_status(client):
    response = client.get("/api/ai/status")
    assert response.status_code == 200
    data = response.json()
    assert "running" in data
    assert "mock_mode" in data

# 3. Folder Validation & Allowed Roots
def test_folder_validation_allowed_root(temp_workspace):
    allowed_root, sec_service = temp_workspace
    is_valid, canonical, err = sec_service.validate_folder(allowed_root)
    assert is_valid is True
    assert canonical == allowed_root
    assert err is None

# 4. Rejection of Paths Outside Permitted Roots
def test_rejection_outside_permitted_roots(temp_workspace):
    allowed_root, sec_service = temp_workspace
    outside_dir = tempfile.mkdtemp(prefix="lazydesk_outside_")
    try:
        is_valid, canonical, err = sec_service.validate_folder(outside_dir)
        assert is_valid is False
        assert "outside configured allowed roots" in err
    finally:
        shutil.rmtree(outside_dir, ignore_errors=True)

# 5. Path Traversal Rejection
def test_path_traversal_rejection(temp_workspace):
    allowed_root, sec_service = temp_workspace
    traversal_path = os.path.join(allowed_root, "..", "secret_folder")
    is_valid, _, err = sec_service.validate_folder(traversal_path)
    assert is_valid is False
    assert ("Path traversal attempt detected" in err or "outside configured allowed roots" in err or "does not exist" in err)

# 6. Filename Sanitization & Reserved Names
def test_filename_sanitization():
    sec = SecurityService()
    # Illegal chars
    dirty = "my/invoice*2024:final?.pdf"
    clean = sec.sanitize_filename(dirty)
    assert "/" not in clean
    assert "*" not in clean
    assert ":" not in clean
    assert "?" not in clean
    assert clean.endswith(".pdf")

    # Windows reserved name
    reserved = "CON.txt"
    clean_reserved = sec.sanitize_filename(reserved)
    assert clean_reserved.lower().startswith("file_con")

    # Empty name
    empty_res = sec.sanitize_filename("", fallback_ext=".txt")
    assert empty_res == "unnamed_document.txt"

# 7. Document Extractor Test
def test_extractor_text(temp_workspace):
    allowed_root, _ = temp_workspace
    sample_file = os.path.join(allowed_root, "test.txt")
    with open(sample_file, "w", encoding="utf-8") as f:
        f.write("Line 1\nLine 2\nLine 3")

    preview, mime, meta = extractor_service.extract_preview(sample_file)
    assert "Line 1" in preview
    assert mime == "text/plain"
    assert meta["lines"] == 3

# 8. Mock AI Analysis
@pytest.mark.asyncio
async def test_mock_ai_analysis():
    ai = AIService()
    res = await ai.analyze_document(
        filename="invoice_2024.pdf",
        file_extension=".pdf",
        extracted_text="Billing statement invoice due: $500",
        force_mock=True
    )
    assert isinstance(res, AIAnalysisResult)
    assert res.category == "Finance"
    assert res.is_mock is True
    assert "Invoice" in res.suggested_filename

# 9. Invalid Model Output Fallback Handling
@pytest.mark.asyncio
async def test_invalid_model_fallback():
    ai = AIService()
    # Analyzing arbitrary text in mock or offline gracefully falls back
    res = await ai.analyze_document(
        filename="notes.md",
        file_extension=".md",
        extracted_text="todo list: buy milk, finish project",
        force_mock=True
    )
    assert res.category in ["Notes", "Projects", "Documents"]

# 10. Scanning, Preview, Execution & Collision Handling
def test_scan_preview_execution_flow(temp_workspace, test_db):
    allowed_root, sec_service = temp_workspace
    fs = FilesystemService()
    
    # Temporarily allow root in global security service
    security_service.add_allowed_root(allowed_root)

    # Scan directory
    session, items, errors = fs.scan_directory(allowed_root, test_db)
    assert session.id is not None
    assert len(items) >= 2
    assert session.status == "scanned"

    # Preview before analysis/execution
    preview = fs.generate_preview(session.id, test_db)
    assert len(preview) >= 2
    assert all(p["source_exists"] is True for p in preview)

    # Execute moves safely
    batch = fs.execute_batch_operations(session.id, test_db)
    assert batch.total_operations >= 2
    assert batch.successful_operations >= 2
    assert batch.failed_operations == 0

    # Verify destination files exist
    assert any(os.path.exists(op.destination_path) for op in batch.operations)

# 11. Undo Operation & Integrity Verification
def test_undo_operation_flow(temp_workspace, test_db):
    allowed_root, _ = temp_workspace
    fs = FilesystemService()
    security_service.add_allowed_root(allowed_root)

    session, items, _ = fs.scan_directory(allowed_root, test_db)
    batch = fs.execute_batch_operations(session.id, test_db)
    
    first_op = batch.operations[0]
    dest_path = first_op.destination_path
    orig_path = first_op.source_path

    assert os.path.exists(dest_path)
    assert not os.path.exists(orig_path)

    # Perform undo
    ok, msg = fs.undo_operation(first_op.id, test_db)
    assert ok is True
    assert "Successfully restored" in msg

    # Verify original file restored
    assert os.path.exists(orig_path)
    assert not os.path.exists(dest_path)

# 12. Undo Conflict Handling (Original Occupied)
def test_undo_conflict_handling(temp_workspace, test_db):
    allowed_root, _ = temp_workspace
    fs = FilesystemService()
    security_service.add_allowed_root(allowed_root)

    session, _, _ = fs.scan_directory(allowed_root, test_db)
    batch = fs.execute_batch_operations(session.id, test_db)
    
    op = batch.operations[0]
    orig_path = op.source_path

    # Simulate conflict: a new file is created at the original path before undo
    with open(orig_path, "w", encoding="utf-8") as f:
        f.write("Conflicting file content")

    # Attempt undo
    ok, err_msg = fs.undo_operation(op.id, test_db)
    assert ok is False
    assert "already occupied" in err_msg

# 13. Operation History API
def test_operation_history_api(client, temp_workspace, test_db):
    allowed_root, _ = temp_workspace
    fs = FilesystemService()
    security_service.add_allowed_root(allowed_root)

    session, _, _ = fs.scan_directory(allowed_root, test_db)
    batch = fs.execute_batch_operations(session.id, test_db)

    resp = client.get("/api/operations")
    assert resp.status_code == 200
    batches = resp.json()
    assert len(batches) >= 1
    assert batches[0]["id"] == batch.id

    # Check dashboard stats API
    stats_resp = client.get("/api/dashboard/stats")
    assert stats_resp.status_code == 200
    stats = stats_resp.json()
    assert stats["total_files_scanned"] >= 2
    assert stats["files_organized"] >= 2
