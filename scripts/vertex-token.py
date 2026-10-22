"""Read existing ADC without changing its file, account, or APAC quota project."""
import json
import sys

import google.auth
from google.auth.transport.requests import Request

config = json.load(open(sys.argv[1], encoding="utf-8"))
if config["projectId"] != "supply-yard-pilot-261021":
    raise SystemExit("Unexpected pilot project")
credentials, _ = google.auth.load_credentials_from_file(
    config["adcPath"],
    scopes=["https://www.googleapis.com/auth/cloud-platform"],
    quota_project_id=config["projectId"],
)
credentials.refresh(Request())
# Captured privately by the Node adapter; never include in a report or UI.
sys.stdout.write(credentials.token)
