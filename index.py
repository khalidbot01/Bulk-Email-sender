import os
import re
import uuid
from typing import List

import httpx
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, EmailStr, Field

app = FastAPI(title="Bulk Email Sender API", version="1.0.0")

RESEND_URL = "https://api.resend.com/emails/batch"
MAX_RECIPIENTS = 100


class SendRequest(BaseModel):
    recipients: List[EmailStr] = Field(min_length=1, max_length=MAX_RECIPIENTS)
    subject: str = Field(min_length=1, max_length=200)
    message: str = Field(min_length=1, max_length=10000)
    consent_confirmed: bool


def check_access(password: str | None):
    expected = os.getenv("APP_PASSWORD")
    if not expected:
        raise HTTPException(
            status_code=503,
            detail="The app is not configured yet. Set APP_PASSWORD in Vercel environment variables."
        )
    if not password or password != expected:
        raise HTTPException(status_code=401, detail="Incorrect access password.")


@app.get("/api/health")
async def health():
    return {"ok": True, "service": "bulk-email-sender"}


@app.post("/api/send")
async def send_emails(payload: SendRequest, x_app_password: str | None = Header(default=None)):
    check_access(x_app_password)

    api_key = os.getenv("RESEND_API_KEY")
    from_email = os.getenv("FROM_EMAIL")
    if not api_key or not from_email:
        raise HTTPException(
            status_code=503,
            detail="Missing RESEND_API_KEY or FROM_EMAIL environment variable."
        )

    if payload.consent_confirmed is not True:
        raise HTTPException(
            status_code=400,
            detail="Please confirm that every recipient has agreed to receive these emails."
        )

    # Normalize and de-duplicate again on the server.
    recipients = list(dict.fromkeys(email.strip().lower() for email in payload.recipients))
    if not recipients:
        raise HTTPException(status_code=400, detail="No valid recipients were provided.")
    if len(recipients) > MAX_RECIPIENTS:
        raise HTTPException(
            status_code=400,
            detail=f"This first version supports up to {MAX_RECIPIENTS} recipients per send."
        )

    # Resend's batch endpoint accepts up to 100 individual email messages.
    messages = [
        {
            "from": from_email,
            "to": [email],
            "subject": payload.subject.strip(),
            "text": payload.message,
        }
        for email in recipients
    ]

    request_id = str(uuid.uuid4())
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Idempotency-Key": f"bulk-email-{request_id}",
    }

    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            response = await client.post(RESEND_URL, headers=headers, json=messages)
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Resend timed out. Check your Resend dashboard before retrying to avoid duplicates.")
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Could not connect to Resend. Please try again.")

    if response.status_code >= 400:
        try:
            detail = response.json().get("message") or response.json().get("name") or "Resend rejected the request."
        except Exception:
            detail = "Resend rejected the request."
        raise HTTPException(status_code=response.status_code, detail=detail)

    result = response.json()
    data = result.get("data", []) if isinstance(result, dict) else []
    return {
        "ok": True,
        "request_id": request_id,
        "submitted": len(recipients),
        "resend_results": data,
        "message": "Resend accepted the batch. Delivery is not guaranteed; check your Resend dashboard for delivery and bounce events."
    }
