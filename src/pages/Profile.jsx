// src/pages/Profile.jsx — the signed-in user's profile (renders inside AccountLayout).
// Stored with the account in this browser (AuthContext `local_users`); there is
// no auth backend yet, so there is no password to change here.
import React, { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FiCamera, FiTrash2, FiCheck, FiAlertTriangle } from "react-icons/fi";
import Dropdown from "../components/Dropdown";
import { useAuth } from "../contexts/AuthContext";
import { Avatar } from "../components/ui/UserMenu";
import { getSettings, saveSettings } from "../utils/appSettings";

const CARD = "bg-white dark:bg-[#1f2937] rounded-xl border border-[#e2e8f0] dark:border-[#334155] shadow-sm";
const MAIN = "text-[#0F172A] dark:text-white";
const SUB = "text-[#64748b] dark:text-[#94a3b8]";
const TITLE = "text-[13px] font-bold uppercase tracking-wide text-[#0A2F44] dark:text-[#66a4c2]";
const LABEL = "block text-xs font-medium text-[#475569] dark:text-[#94a3b8] mb-1";
const INPUT = "w-full rounded-lg border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#0b0f19] px-3 py-2 text-sm text-[#0F172A] dark:text-white focus:border-[#0A2F44] dark:focus:border-[#66a4c2] focus:outline-none";
const BTN = `flex items-center gap-2 rounded-lg border border-[#e2e8f0] dark:border-[#334155] px-4 py-2 text-sm ${MAIN} hover:bg-[#f1f5f9] dark:hover:bg-[#334155] transition-colors`;

const PROFESSIONS = [
  { value: "structural_engineer", label: "Structural Engineer" },
  { value: "civil_engineer", label: "Civil Engineer" },
  { value: "architect", label: "Architect" },
  { value: "project_manager", label: "Project Manager" },
  { value: "quantity_surveyor", label: "Quantity Surveyor" },
  { value: "analyst", label: "Analyst" },
  { value: "contractor", label: "Contractor" },
  { value: "student", label: "Student" },
  { value: "other", label: "Other" },
];

const FIELDS = ["name", "email", "username", "profession", "job_title", "qualifications", "company", "phone", "location", "bio"];
const pick = (u) => Object.fromEntries(FIELDS.map((k) => [k, u?.[k] || ""]));
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_UPLOAD = 8 * 1024 * 1024;

// Square-crop and shrink to 256 px so the photo fits in browser storage.
function resizeImage(file, size = 256) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(img.width, img.height);
      const canvas = document.createElement("canvas");
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That file could not be read as an image.")); };
    img.src = url;
  });
}

export default function Profile() {
  const { user, updateProfile } = useAuth();
  const [form, setForm] = useState(() => pick(user));
  const [avatar, setAvatar] = useState(user?.avatar || null);
  const [errors, setErrors] = useState({});
  const [msg, setMsg] = useState(null); // { ok, text }
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));
  const dirty = JSON.stringify(pick(user)) !== JSON.stringify(form) || (user?.avatar || null) !== avatar;

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { setMsg({ ok: false, text: "Choose an image file (JPG, PNG, WebP...)." }); return; }
    if (file.size > MAX_UPLOAD) { setMsg({ ok: false, text: "That image is over 8 MB. Choose a smaller one." }); return; }
    try { setAvatar(await resizeImage(file)); setMsg(null); }
    catch (err) { setMsg({ ok: false, text: err.message }); }
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Enter your name.";
    if (!form.email.trim()) e.email = "Enter your email.";
    else if (!EMAIL_RE.test(form.email.trim())) e.email = "That does not look like an email address.";
    if (form.username && !/^[A-Za-z0-9._-]{2,30}$/.test(form.username)) e.username = "2-30 letters, numbers, dots, dashes or underscores.";
    if (form.phone && !/^[+()\d\s-]{6,20}$/.test(form.phone)) e.phone = "Digits, spaces, +, - and brackets only.";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const save = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    setSaving(true);
    const clean = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v]));
    const res = await updateProfile({ ...clean, avatar });
    setSaving(false);
    if (res.success) { setForm(pick(res.user)); setMsg({ ok: true, text: "Profile saved." }); }
    else setMsg({ ok: false, text: res.error || "The profile could not be saved." });
  };

  const useOnReports = () => {
    const s = getSettings();
    saveSettings({
      ...s,
      designerName: form.name.trim() || s.designerName,
      designerQualifications: form.qualifications.trim() || s.designerQualifications,
      company: form.company.trim() || s.company,
    });
    setMsg({ ok: true, text: "Your name, qualifications and company will now fill the Designed by and company fields on new designs and PDF covers." });
  };

  const field = (k, label, props = {}) => (
    <div>
      <label className={LABEL} htmlFor={`pf-${k}`}>{label}</label>
      <input id={`pf-${k}`} className={INPUT} value={form[k]} onChange={set(k)} {...props} />
      {errors[k] && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors[k]}</p>}
    </div>
  );

  return (
    <form onSubmit={save} noValidate className="mx-auto max-w-3xl space-y-6">
      <section className={`${CARD} p-6`}>
        <h2 className={TITLE}>Photo</h2>
        <div className="mt-4 flex flex-wrap items-center gap-5">
          <Avatar user={{ ...user, ...form, avatar }} size="xl" />
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <button type="button" className={BTN} onClick={() => fileRef.current?.click()}>
                <FiCamera /> {avatar ? "Change photo" : "Upload photo"}
              </button>
              {avatar && (
                <button type="button" className={`${BTN} text-red-600 dark:text-red-400`} onClick={() => setAvatar(null)}>
                  <FiTrash2 /> Remove
                </button>
              )}
            </div>
            <p className={`text-xs ${SUB}`}>JPG, PNG or WebP up to 8 MB. Cropped to a square. Without a photo your initials are shown.</p>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
        </div>
      </section>

      <section className={`${CARD} p-6`}>
        <h2 className={TITLE}>Personal details</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {field("name", "Full name", { autoComplete: "name" })}
          {field("email", "Email", { type: "email", autoComplete: "email" })}
          {field("username", "Username", { autoComplete: "username" })}
          {field("phone", "Phone", { type: "tel", autoComplete: "tel" })}
          {field("location", "Location", { placeholder: "e.g. London, UK" })}
        </div>
      </section>

      <section className={`${CARD} p-6`}>
        <h2 className={TITLE}>Professional details</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={LABEL}>Profession</label>
            <Dropdown value={form.profession} onChange={set("profession")} options={PROFESSIONS} placeholder="Select your profession" />
          </div>
          {field("job_title", "Job title", { placeholder: "e.g. Senior Structural Engineer" })}
          {field("qualifications", "Qualifications", { placeholder: "e.g. BEng, CEng MIStructE" })}
          {field("company", "Company", { autoComplete: "organization" })}
          <div className="sm:col-span-2">
            <label className={LABEL} htmlFor="pf-bio">About</label>
            <textarea id="pf-bio" rows={3} className={INPUT} value={form.bio} onChange={set("bio")} maxLength={500} />
          </div>
        </div>
        <div className={`mt-4 flex flex-wrap items-center gap-3 border-t border-[#e2e8f0] dark:border-[#334155] pt-4 text-xs ${SUB}`}>
          <button type="button" className={BTN} onClick={useOnReports}>Use on reports</button>
          <span>Copies your name, qualifications and company into <Link to="/settings" className="underline">Settings</Link> (Designed by, PDF cover).</span>
        </div>
      </section>

      <section className={`${CARD} p-6`}>
        <h2 className={TITLE}>Account</h2>
        <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <div><dt className={SUB}>Member since</dt><dd className={MAIN}>{user?.created_at ? new Date(user.created_at).toLocaleDateString() : "Not recorded"}</dd></div>
          <div><dt className={SUB}>Last updated</dt><dd className={MAIN}>{user?.updated_at ? new Date(user.updated_at).toLocaleString() : "Never"}</dd></div>
        </dl>
        <p className={`mt-3 text-xs ${SUB}`}>Password changes are not available yet: sign-in has no server behind it, so accounts live in this browser only.</p>
      </section>

      {msg && (
        <div className={`flex items-start gap-2 rounded-lg px-4 py-3 text-sm ${msg.ok ? "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300" : "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300"}`}>
          {msg.ok ? <FiCheck className="mt-0.5" /> : <FiAlertTriangle className="mt-0.5" />} <span>{msg.text}</span>
        </div>
      )}

      <div className="flex justify-end gap-3 pb-6">
        <button type="button" className={BTN} disabled={!dirty || saving}
          onClick={() => { setForm(pick(user)); setAvatar(user?.avatar || null); setErrors({}); setMsg(null); }}>
          Discard changes
        </button>
        <button type="submit" disabled={!dirty || saving}
          className="rounded-lg bg-[#0A2F44] px-5 py-2 text-sm font-medium text-white hover:bg-[#082636] disabled:opacity-50 disabled:cursor-not-allowed">
          {saving ? "Saving..." : "Save profile"}
        </button>
      </div>
    </form>
  );
}
