const $ = (id) => document.getElementById(id);
let recipients = [];
let fileContents = "";

function showAlert(message, type = "error") {
  const el = $("alert");
  el.textContent = message;
  el.className = `alert ${type}`;
}
function hideAlert() { $("alert").className = "alert hidden"; }

function extractEmails(text, filename) {
  let candidates = [];
  if (filename.toLowerCase().endsWith(".csv")) {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length) {
      const first = lines[0].split(/[,;\t]/).map(v => v.trim().replace(/^["']|["']$/g, ""));
      const emailColumn = first.findIndex(v => /^(e-?mail|email address)$/i.test(v));
      const col = emailColumn >= 0 ? emailColumn : -1;
      const rows = col >= 0 ? lines.slice(1) : lines;
      for (const line of rows) {
        const cells = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)|;|\t/).map(v => v.trim().replace(/^["']|["']$/g, ""));
        if (col >= 0 && cells[col]) candidates.push(cells[col]);
        else candidates.push(...cells);
      }
    }
  } else {
    candidates = text.split(/[\r\n,;\t ]+/);
  }

  // Also extract email-like tokens from cells that contain labels or extra text.
  const found = [];
  for (const value of candidates) {
    const matches = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
    if (matches) found.push(...matches);
  }
  const unique = [];
  const seen = new Set();
  let duplicates = 0, invalid = 0;
  const rawTokens = candidates.length;
  for (const email of found) {
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) { invalid++; continue; }
    if (seen.has(normalized)) { duplicates++; continue; }
    seen.add(normalized);
    unique.push(normalized);
  }
  // Count entries that did not yield an email address.
  invalid += Math.max(0, rawTokens - found.length);
  return { unique, duplicates, invalid };
}

function renderRecipients(result, name) {
  recipients = result.unique;
  $("fileLine").classList.remove("hidden");
  $("fileName").textContent = name;
  $("stats").classList.remove("hidden");
  $("previewWrap").classList.remove("hidden");
  $("validCount").textContent = recipients.length;
  $("duplicateCount").textContent = result.duplicates;
  $("invalidCount").textContent = result.invalid;
  $("overviewCount").textContent = recipients.length;
  $("previewLabel").textContent = `Showing ${Math.min(5, recipients.length)} of ${recipients.length}`;
  $("recipientPreview").innerHTML = "";
  recipients.slice(0, 5).forEach(email => {
    const li = document.createElement("li");
    li.textContent = email;
    $("recipientPreview").appendChild(li);
  });
  if (recipients.length > 5) {
    const li = document.createElement("li");
    li.textContent = `+ ${recipients.length - 5} more recipients`;
    li.style.color = "#84909d";
    $("recipientPreview").appendChild(li);
  }
  hideAlert();
}

async function handleFile(file) {
  if (!file) return;
  if (!/\.(txt|csv)$/i.test(file.name)) return showAlert("Please upload a .txt or .csv file.");
  if (file.size > 2 * 1024 * 1024) return showAlert("File is larger than 2 MB.");
  fileContents = await file.text();
  const result = extractEmails(fileContents, file.name);
  if (!result.unique.length) return showAlert("No valid email addresses were found. Check the file format.");
  renderRecipients(result, file.name);
}

$("fileInput").addEventListener("change", e => handleFile(e.target.files[0]));
$("removeFile").addEventListener("click", () => clearRecipients());
function clearRecipients() {
  recipients = []; fileContents = ""; $("fileInput").value = "";
  ["fileLine","stats","previewWrap"].forEach(id => $(id).classList.add("hidden"));
  $("overviewCount").textContent = "0"; hideAlert();
}
$("dropzone").addEventListener("dragover", e => { e.preventDefault(); $("dropzone").classList.add("dragover"); });
$("dropzone").addEventListener("dragleave", () => $("dropzone").classList.remove("dragover"));
$("dropzone").addEventListener("drop", e => {
  e.preventDefault(); $("dropzone").classList.remove("dragover");
  handleFile(e.dataTransfer.files[0]);
});
$("message").addEventListener("input", () => $("charCount").textContent = `${$("message").value.length.toLocaleString()} / 10,000`);

$("sendButton").addEventListener("click", async () => {
  hideAlert();
  const subject = $("subject").value.trim();
  const message = $("message").value.trim();
  const password = $("appPassword").value;
  if (!recipients.length) return showAlert("Upload a contact file with at least one valid email address.");
  if (recipients.length > 100) return showAlert("This first version supports up to 100 recipients per campaign. Split larger lists into smaller files.");
  if (!subject) return showAlert("Please enter an email subject.");
  if (!message) return showAlert("Please write your message.");
  if (!password) return showAlert("Enter your app access password.");
  if (!$("consent").checked) return showAlert("Please confirm that recipients have consented to receive your emails.");

  const button = $("sendButton");
  button.disabled = true;
  button.innerHTML = "<span>Submitting campaign…</span>";
  try {
    const response = await fetch("/api/send", {
      method: "POST",
      headers: {"Content-Type":"application/json", "X-App-Password":password},
      body: JSON.stringify({recipients, subject, message, consent_confirmed:true})
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "The email service returned an error.");
    showAlert(`Resend accepted ${data.submitted} individual email(s). This means they were submitted, not necessarily delivered. Check your Resend dashboard for delivery and bounce status.`, "success");
  } catch (err) {
    showAlert(err.message || "Something went wrong. Please try again.");
  } finally {
    button.disabled = false;
    button.innerHTML = "<span>Send campaign</span><span aria-hidden='true'>↗</span>";
  }
});

$("resetButton").addEventListener("click", () => {
  clearRecipients();
  $("subject").value = ""; $("message").value = ""; $("appPassword").value = "";
  $("consent").checked = false; $("charCount").textContent = "0 / 10,000";
});
