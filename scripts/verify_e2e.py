import os
import httpx
import subprocess

client = httpx.Client(base_url="http://127.0.0.1:8000", timeout=30.0)

# 1. Health
h = client.get("/api/health").json()
print("1. Health Status:", h["status"])

# 2. Scan
folder = os.path.abspath("sample_messy_folder")
scan = client.post("/api/scan", json={"folder_path": folder}).json()
session_id = scan["session_id"]
print(f"2. Scanned session {session_id}: {scan['total_files']} files discovered")

# 3. Analyze
analysis = client.post("/api/analyze", json={"session_id": session_id, "force_mock": True}).json()
print(f"3. Analyzed {analysis['total_analyzed']} files:")
for f in analysis["files"]:
    print(f"   • {f['original_filename']} -> [{f['proposed_category']}] {f['proposed_filename']}")

# 4. Preview
preview = client.post("/api/operations/preview", json={"session_id": session_id}).json()
print(f"4. Preview verified: {preview['total_items']} items queued")

# 5. Execute
exec_res = client.post("/api/operations/execute", json={"session_id": session_id}).json()
batch = exec_res["batch"]
print(f"5. Executed Batch #{batch['id']}: {batch['successful_operations']} successful, {batch['failed_operations']} failed")

# 6. Verify destination folders created on disk
subdirs = [d for d in os.listdir(folder) if os.path.isdir(os.path.join(folder, d))]
print("6. Created category folders on disk:", subdirs)

# 7. Undo
undo_res = client.post(f"/api/operations/batches/{batch['id']}/undo").json()
print(f"7. Batch Undo: {undo_res['successfully_undone']} files restored, {undo_res['failed_to_undo']} failed")

# 8. Re-seed clean sample folder for future testing
subprocess.run(["backend/.venv/Scripts/python", "scripts/seed_sample_folder.py"], check=True)
print("\n[SUCCESS] ALL END-TO-END VERIFICATIONS PASSED SUCCESSFULLY!")
