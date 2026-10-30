import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const $ = (selector) => document.querySelector(selector);
const clientReady = /^https:\/\/[\w-]+\.supabase\.co$/.test(SUPABASE_URL) && !SUPABASE_ANON_KEY.startsWith("YOUR_");
const supabase = clientReady ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const state = { mode: "signin", records: [], editingId: null, user: null };

const authScreen = $("#auth-screen");
const appScreen = $("#app-screen");

function setMessage(element, message = "", type = "") {
  element.textContent = message;
  element.className = `message${type ? ` ${type}` : ""}`;
}

function setBusy(button, busy, label) {
  button.disabled = busy;
  button.classList.toggle("loading", busy);
  if (label) button.querySelector("span:first-child").textContent = label;
}

function initials(name = "Instructor") {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "I";
}

function profileName(user) {
  return user.user_metadata?.full_name || user.email?.split("@")[0] || "Instructor";
}

function switchAuthMode(mode) {
  state.mode = mode;
  const isSignup = mode === "signup";
  const isReset = mode === "reset";
  $(".auth-tabs").classList.toggle("hidden", isReset);
  $("#signin-tab").classList.toggle("active", !isSignup);
  $("#signup-tab").classList.toggle("active", isSignup);
  $("#signin-tab").setAttribute("aria-selected", String(!isSignup));
  $("#signup-tab").setAttribute("aria-selected", String(isSignup));
  $("#name-field").classList.toggle("hidden", !isSignup);
  $("#confirm-field").classList.toggle("hidden", !isSignup && !isReset);
  $("#confirm-label").textContent = isReset ? "Confirm new password" : "Confirm password";
  $("#confirm-password").placeholder = isReset ? "Enter your new password again" : "Enter your password again";
  $("#signin-options").classList.toggle("hidden", isSignup || isReset);
  $("#full-name").required = isSignup;
  $("#confirm-password").required = isSignup || isReset;
  $("#password").placeholder = isReset ? "New password (at least 8 characters)" : "At least 8 characters";
  $("#password").autocomplete = isSignup || isReset ? "new-password" : "current-password";
  $("#auth-title").textContent = isSignup ? "Start with a fresh page." : isReset ? "Choose a new password." : "Good to have you back.";
  $("#auth-subtitle").textContent = isSignup ? "Create your instructor account to set up your gradebook." : isReset ? "Use at least 8 characters for your new password." : "Sign in to pick up where your class left off.";
  $("#auth-submit span:first-child").textContent = isSignup ? "Create account" : isReset ? "Update password" : "Sign in";
  setMessage($("#auth-message"));
}

function showApp(user) {
  state.user = user;
  authScreen.classList.add("hidden");
  appScreen.classList.remove("hidden");
  const name = profileName(user);
  $("#user-name").textContent = name;
  $("#user-email").textContent = user.email || "";
  $("#user-avatar").textContent = initials(name);
  $("#greeting-name").textContent = name.split(/\s+/)[0];
  loadRecords();
}

function showAuth() {
  state.user = null;
  state.records = [];
  appScreen.classList.add("hidden");
  authScreen.classList.remove("hidden");
}

async function handleAuth(event) {
  event.preventDefault();
  if (!supabase) return;
  const button = $("#auth-submit");
  const email = $("#email").value.trim();
  const password = $("#password").value;
  const isSignup = state.mode === "signup";
  const isReset = state.mode === "reset";
  setMessage($("#auth-message"));
  if ((isSignup || isReset) && password !== $("#confirm-password").value) {
    setMessage($("#auth-message"), "Those passwords don’t match yet.", "error");
    return;
  }
  setBusy(button, true, isSignup ? "Creating account…" : isReset ? "Updating password…" : "Signing in…");
  try {
    const result = isReset
      ? await supabase.auth.updateUser({ password })
      : isSignup
      ? await supabase.auth.signUp({ email, password, options: { data: { full_name: $("#full-name").value.trim() } } })
      : await supabase.auth.signInWithPassword({ email, password });
    if (result.error) throw result.error;
    if (isReset) {
      await supabase.auth.signOut();
      switchAuthMode("signin");
      setMessage($("#auth-message"), "Password updated. Sign in with your new password.", "success");
      return;
    }
    if (isSignup && !result.data.session) {
      setMessage($("#auth-message"), "Account created. Check your email to confirm your address, then sign in.", "success");
      return;
    }
    if (result.data.user) showApp(result.data.user);
  } catch (error) {
    setMessage($("#auth-message"), error.message || "We couldn’t complete that request. Please try again.", "error");
  } finally {
    setBusy(button, false, isSignup ? "Create account" : isReset ? "Update password" : "Sign in");
  }
}

async function requestPasswordReset() {
  if (!supabase) return;
  const email = $("#email").value.trim();
  if (!email) {
    $("#email").focus();
    setMessage($("#auth-message"), "Enter your email address first, and we’ll send a reset link.", "error");
    return;
  }
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.href.split("#")[0] });
  setMessage($("#auth-message"), error ? error.message : "If an account exists for that email, a password reset link is on its way.", error ? "error" : "success");
}

async function loadRecords() {
  const { data, error } = await supabase.from("student_marks").select("id, name, math, science, created_at").order("created_at", { ascending: false });
  if (error) {
    state.records = [];
    renderRecords(error.message.includes("student_marks") ? "Set up the gradebook table using schema.sql, then refresh." : "We couldn’t load the gradebook. Please refresh.");
    return;
  }
  state.records = data || [];
  renderRecords();
}

function renderRecords(emptyMessage) {
  const term = $("#search-input").value.trim().toLowerCase();
  const filtered = state.records.filter((item) => item.name.toLowerCase().includes(term));
  const body = $("#gradebook-body");
  body.replaceChildren();
  if (!filtered.length) {
    const row = document.createElement("tr");
    row.innerHTML = `<td class="empty-state" colspan="6"><span class="empty-mark">✳</span><strong>${state.records.length ? "No matching students" : "Your gradebook is ready"}</strong><span>${emptyMessage || (state.records.length ? "Try a different name." : "Add a student to start recording marks.")}</span></td>`;
    body.append(row);
  } else {
    for (const record of filtered) {
      const row = $("#student-row-template").content.firstElementChild.cloneNode(true);
      const average = Math.round((record.math + record.science) / 2);
      row.querySelector(".student-avatar").textContent = initials(record.name);
      row.querySelector(".student-name").textContent = record.name;
      row.querySelector(".math-score").textContent = record.math;
      row.querySelector(".science-score").textContent = record.science;
      row.querySelector(".average-score").textContent = `${average}%`;
      const status = row.querySelector(".grade-status");
      status.textContent = average >= 50 ? "On track" : "Needs support";
      status.classList.add(average >= 50 ? "status-pass" : "status-support");
      row.querySelector(".row-delete").addEventListener("click", () => deleteRecord(record.id));
      row.querySelector(".student-name").addEventListener("click", () => openDialog(record));
      row.querySelector(".student-name").classList.add("editable-name");
      body.append(row);
    }
  }
  updateSummary();
  $("#record-count").textContent = state.records.length;
  $("#table-summary").textContent = `${filtered.length} ${filtered.length === 1 ? "student" : "students"}${term ? " found" : " shown"}`;
}

function updateSummary() {
  const total = state.records.length;
  const math = total ? state.records.reduce((sum, record) => sum + record.math, 0) / total : 0;
  const science = total ? state.records.reduce((sum, record) => sum + record.science, 0) / total : 0;
  const average = (math + science) / 2;
  const passing = total ? state.records.filter((record) => (record.math + record.science) / 2 >= 50).length / total * 100 : 0;
  $("#student-count").textContent = total;
  $("#class-average").textContent = total ? Math.round(average) : "—";
  $("#pass-rate").textContent = total ? Math.round(passing) : "—";
  $("#top-subject").textContent = total ? (math >= science ? "Mathematics" : "Science") : "—";
  $("#subject-caption").textContent = total ? `${Math.round(Math.max(math, science))}% class average` : "Waiting for marks";
  $("#math-average").textContent = `${Math.round(math)}%`;
  $("#science-average").textContent = `${Math.round(science)}%`;
  $("#math-bar").style.height = `${math}%`;
  $("#science-bar").style.height = `${science}%`;
  if (total) {
    const diff = Math.round(Math.abs(math - science));
    $("#insight-text").textContent = diff < 5 ? "Your class is performing at a similar level across both subjects." : `${math > science ? "Mathematics" : "Science"} is leading by ${diff} points. A little extra practice in the other subject could help close the gap.`;
  } else {
    $("#insight-text").textContent = "Add your first student to see how your class is growing.";
  }
}

function openDialog(record = null) {
  state.editingId = record?.id || null;
  $("#dialog-title").textContent = record ? "Update student marks" : "Add a student";
  $("#student-name").value = record?.name || "";
  $("#student-math").value = record?.math ?? "";
  $("#student-science").value = record?.science ?? "";
  setMessage($("#student-message"));
  $("#student-dialog").showModal();
}

async function saveRecord(event) {
  event.preventDefault();
  const name = $("#student-name").value.trim();
  const math = Number($("#student-math").value);
  const science = Number($("#student-science").value);
  if (!name || !Number.isInteger(math) || !Number.isInteger(science) || math < 0 || math > 100 || science < 0 || science > 100) {
    setMessage($("#student-message"), "Enter a name and whole-number marks from 0 to 100.", "error");
    return;
  }
  const button = $("#save-student");
  setBusy(button, true, "Saving…");
  const query = state.editingId
    ? supabase.from("student_marks").update({ name, math, science }).eq("id", state.editingId)
    : supabase.from("student_marks").insert({ name, math, science, user_id: state.user.id });
  const { error } = await query;
  setBusy(button, false, "Save student");
  if (error) {
    setMessage($("#student-message"), error.message || "We couldn’t save this record.", "error");
    return;
  }
  $("#student-dialog").close();
  await loadRecords();
}

async function deleteRecord(id) {
  if (!window.confirm("Remove this student from your gradebook?")) return;
  const { error } = await supabase.from("student_marks").delete().eq("id", id);
  if (error) window.alert("We couldn’t remove that record. Please try again.");
  else await loadRecords();
}

function configure() {
  $("#signin-tab").addEventListener("click", () => switchAuthMode("signin"));
  $("#signup-tab").addEventListener("click", () => switchAuthMode("signup"));
  $("#auth-form").addEventListener("submit", handleAuth);
  $("#forgot-password").addEventListener("click", requestPasswordReset);
  $("#search-input").addEventListener("input", () => renderRecords());
  $("#add-student-top").addEventListener("click", () => openDialog());
  $("#add-student-table").addEventListener("click", () => openDialog());
  $("#close-dialog").addEventListener("click", () => $("#student-dialog").close());
  $("#cancel-dialog").addEventListener("click", () => $("#student-dialog").close());
  $("#student-form").addEventListener("submit", saveRecord);
  $("#signout-button").addEventListener("click", async () => { await supabase.auth.signOut(); showAuth(); });
  if (!clientReady) setMessage($("#auth-message"), "Add your Supabase project URL and publishable key in config.js to connect your account.", "setup");
}

configure();
if (supabase) {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") {
      showAuth();
      switchAuthMode("reset");
      if (session?.user?.email) $("#email").value = session.user.email;
    } else if (session && state.mode !== "reset") showApp(session.user);
    else showAuth();
  });
}
