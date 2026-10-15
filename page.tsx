 "use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Profile = {
  id: string; first_name: string; last_name: string; cin: string; section: string;
  photo_path: string | null; status: string; role: string; rank: string | null;
  skills: string[] | null; languages: string[] | null; bio: string | null;
};
type Notice = { id: string; title: string; body: string; image_path: string | null; created_at: string };
type Complaint = { id: string; subject: string; body: string; status: string; created_at: string; user_id: string };
type SkillProof = { id: string; title: string; description: string; file_path: string; status: string; user_id: string };

export default function Home() {
  const [mode, setMode] = useState("home");
  const [userId, setUserId] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [notice, setNotice] = useState<Notice[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [proofs, setProofs] = useState<SkillProof[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const say = (s: string) => setMsg(s);
  async function refresh(uid?: string) {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    const id = uid || user?.id;
    if (!id) return;
    setUserId(id);
    const { data: p } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
    setProfile(p as Profile | null);
    const { data: n } = await supabase.from("announcements").select("*").order("created_at", { ascending: false }).limit(30);
    setNotice((n || []) as Notice[]);
    if (p?.role === "admin") {
      const { data: m } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      setMembers((m || []) as Profile[]);
      const { data: c } = await supabase.from("complaints").select("*").order("created_at", { ascending: false });
      setComplaints((c || []) as Complaint[]);
      const { data: s } = await supabase.from("skill_proofs").select("*").order("created_at", { ascending: false });
      setProofs((s || []) as SkillProof[]);
    } else {
      const { data: c } = await supabase.from("complaints").select("*").eq("user_id", id).order("created_at", { ascending: false });
      setComplaints((c || []) as Complaint[]);
      const { data: s } = await supabase.from("skill_proofs").select("*").eq("user_id", id).order("created_at", { ascending: false });
      setProofs((s || []) as SkillProof[]);
    }
  }
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => { if (data.session) refresh(data.session.user.id); });
  }, []);

  async function register(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!supabase) return say("أضف مفاتيح Supabase في إعدادات Vercel أولاً.");
    setBusy(true); const f = new FormData(e.currentTarget);
    const email = String(f.get("email")); const password = String(f.get("password"));
    const first_name = String(f.get("first_name")); const last_name = String(f.get("last_name"));
    const cin = String(f.get("cin")).trim().toUpperCase(); const section = String(f.get("section"));
    const photo = f.get("photo") as File;
    if (!photo || !photo.type.startsWith("image/") || photo.size > 3 * 1024 * 1024) {
      setBusy(false); return say("الصورة يجب أن تكون PNG/JPG وأقل من 3MB.");
    }
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error || !data.user) { setBusy(false); return say(error?.message || "تعذر إنشاء الحساب."); }
    let photo_path: string | null = null;
    const path = `${data.user.id}/profile-${Date.now()}.${photo.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "jpg"}`;
    const upload = await supabase.storage.from("cad-private").upload(path, photo, { upsert: false });
    if (upload.error) { setBusy(false); return say("تم إنشاء الحساب لكن فشل رفع الصورة: " + upload.error.message); }
    photo_path = path;
    const { error: pe } = await supabase.from("profiles").insert({
      id: data.user.id, first_name, last_name, cin, section, photo_path,
      status: "pending", role: "trainee", rank: "D", skills: [], languages: []
    });
    setBusy(false);
    if (pe) return say("الحساب أنشئ لكن تعذر حفظ الملف: " + pe.message);
    say("تم إرسال طلب التسجيل. لن تتمكن من استعمال لوحة المتدرب حتى يوافق المشرف.");
    setMode("login");
  }

  async function login(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!supabase) return say("أضف مفاتيح Supabase في إعدادات Vercel أولاً.");
    setBusy(true); const f = new FormData(e.currentTarget);
    const { data, error } = await supabase.auth.signInWithPassword({ email: String(f.get("email")), password: String(f.get("password")) });
    setBusy(false); if (error) return say(error.message);
    await refresh(data.user.id); setMode("dashboard"); say("تم تسجيل الدخول.");
  }
  async function signOut() { if (supabase) await supabase.auth.signOut(); setProfile(null); setUserId(""); setMode("home"); say("تم تسجيل الخروج."); }
  async function sendComplaint(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!supabase || !userId) return;
    const f = new FormData(e.currentTarget);
    const { error } = await supabase.from("complaints").insert({ user_id: userId, subject: String(f.get("subject")), body: String(f.get("body")) });
    say(error ? error.message : "تم إرسال الشكاية بسرية إلى اللجنة."); if (!error) { e.currentTarget.reset(); refresh(); }
  }
  async function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!supabase || !profile) return;
    const f = new FormData(e.currentTarget);
    const { error } = await supabase.from("profiles").update({
      bio: String(f.get("bio")), skills: String(f.get("skills")).split(",").map(x => x.trim()).filter(Boolean),
      languages: String(f.get("languages")).split(",").map(x => x.trim()).filter(Boolean)
    }).eq("id", profile.id);
    say(error ? error.message : "تم تحديث ملفك الشخصي."); refresh();
  }
  async function sendSkillProof(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!supabase || !userId) return;
    const f = new FormData(e.currentTarget); const file = f.get("proof") as File;
    if (!file || !file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) return say("أرسل صورة PNG/JPG أقل من 5MB.");
    const path = `${userId}/skills-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "")}`;
    const up = await supabase.storage.from("cad-private").upload(path, file);
    if (up.error) return say(up.error.message);
    const { error } = await supabase.from("skill_proofs").insert({ user_id: userId, title: String(f.get("title")), description: String(f.get("description")), file_path: path });
    say(error ? error.message : "تم إرسال إثبات المهارة للمشرفين للمراجعة."); if (!error) { e.currentTarget.reset(); refresh(); }
  }
  async function adminAction(id: string, patch: Record<string, unknown>, table = "profiles") {
    if (!supabase) return;
    const { error } = await supabase.from(table).update(patch).eq("id", id);
    say(error ? error.message : "تم حفظ التغيير."); refresh();
  }
  async function addNotice(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!supabase) return;
    const f = new FormData(e.currentTarget); const file = f.get("image") as File;
    let image_path: string | null = null;
    if (file?.size) {
      if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) return say("الصورة يجب أن تكون أقل من 5MB.");
      image_path = `announcements/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "")}`;
      const up = await supabase.storage.from("cad-private").upload(image_path, file);
      if (up.error) return say(up.error.message);
    }
    const { error } = await supabase.from("announcements").insert({ title: String(f.get("title")), body: String(f.get("body")), image_path, created_by: userId });
    say(error ? error.message : "تم نشر الإعلان."); if (!error) { e.currentTarget.reset(); refresh(); }
  }
  if (!supabase) return <main className="shell"><header><div className="logo">CAD</div><div><h1>لجنة الانضباط الذاتي</h1><p>OFPPT · بوابة المتدربين</p></div></header><section className="panel"><h2>إعدادات الموقع ناقصة</h2><p>أضف NEXT_PUBLIC_SUPABASE_URL و NEXT_PUBLIC_SUPABASE_ANON_KEY في Vercel → Settings → Environment Variables، ثم أعد النشر.</p></section></main>;

  return <main className="shell">
    <header><div className="logo">CAD</div><div><h1>لجنة الانضباط الذاتي</h1><p>OFPPT · الاحترام، الالتزام، المسؤولية</p></div><span className="headerTag">البوابة الرسمية للجنة</span></header>
    <nav>
      <button onClick={() => setMode("home")}>الرئيسية</button>
      <button onClick={() => setMode("register")}>تسجيل جديد</button>
      <button onClick={() => setMode("login")}>تسجيل الدخول</button>
      {profile && <button onClick={() => setMode("dashboard")}>فضاء المتدرب</button>}
      {profile?.role === "admin" && <button onClick={() => setMode("admin")}>فضاء المشرفين</button>}
    </nav>
    {msg && <div className="message" role="status">{msg}<button className="close" onClick={() => setMsg("")}>×</button></div>}

    {mode === "home" && <><section className="hero"><div><span className="eyebrow">CAD · OFPPT</span><h2>الانضباط يبدأ منّا جميعاً</h2><p>منصة لتنظيم التواصل بين المتدربين ولجنة الانضباط الذاتي، وتثمين السلوك الإيجابي والمهارات.</p><button className="primary" onClick={() => setMode("register")}>ابدأ التسجيل</button></div><div className="heroMark">C<span>A</span>D</div></section>
      <section className="panel"><h2>القوانين والمعايير</h2><div className="rules"><article><b>01</b><h3>الاحترام</h3><p>احترام المتدربين والأطر الإدارية والتكوينية وتجنب الإهانة والتنمر.</p></article><article><b>02</b><h3>الالتزام</h3><p>الالتزام بمواعيد الدراسة، تعليمات المؤسسة، والمحافظة على الممتلكات.</p></article><article><b>03</b><h3>المسؤولية</h3><p>تقديم معلومات صحيحة، واحترام خصوصية الآخرين وعدم إساءة استعمال المنصة.</p></article><article><b>04</b><h3>التبليغ المسؤول</h3><p>تقديم شكايات واضحة وبحسن نية، وتجنب الاتهامات الكاذبة أو نشر المعلومات الخاصة.</p></article></div><p className="muted">تُطبّق هذه المعايير وفق النظام الداخلي للمؤسسة وتحت إشراف الجهات المختصة؛ المنصة لا تعوّض المساطر الرسمية.</p></section>
      <section className="panel"><h2>آخر الإعلانات</h2>{notice.length ? notice.slice(0,3).map(n => <article className="notice" key={n.id}><h3>{n.title}</h3><p>{n.body}</p><small>{new Date(n.created_at).toLocaleString("fr-MA")}</small></article>) : <p className="muted">ستظهر إعلانات اللجنة هنا.</p>}</section></>}

    {mode === "register" && <section className="panel narrow"><h2>تسجيل متدرب جديد</h2><p className="muted">سيبقى الحساب قيد المراجعة حتى يقبله المشرف. لا ترفع وثائق إضافية غير مطلوبة.</p><form onSubmit={register}>
      <label>الاسم<input name="first_name" required maxLength={80}/></label><label>النسب<input name="last_name" required maxLength={80}/></label>
      <label>رقم البطاقة الوطنية CIN<input name="cin" required maxLength={20} autoComplete="off"/></label><label>القسم / الشعبة<input name="section" required maxLength={100}/></label>
      <label>البريد الإلكتروني<input name="email" type="email" required autoComplete="email"/></label><label>كلمة المرور<input name="password" type="password" required minLength={10} autoComplete="new-password"/><small>استعمل كلمة مرور قوية من 10 أحرف على الأقل.</small></label>
      <label>الصورة الشخصية (JPG أو PNG، 3MB كحد أقصى)<input name="photo" type="file" accept="image/png,image/jpeg" required/></label>
      <button className="primary" disabled={busy}>{busy ? "جارٍ التسجيل..." : "إرسال طلب التسجيل"}</button></form></section>}

    {mode === "login" && <section className="panel narrow"><h2>تسجيل الدخول</h2><form onSubmit={login}><label>البريد الإلكتروني<input name="email" type="email" required/></label><label>كلمة المرور<input name="password" type="password" required/></label><button className="primary" disabled={busy}>{busy ? "جارٍ الدخول..." : "دخول"}</button></form></section>}

    {mode === "dashboard" && profile && <><section className="panel"><div className="dashHead"><div><span className="eyebrow">فضاء المتدرب</span><h2>مرحباً {profile.first_name} {profile.last_name}</h2><p>القسم: {profile.section} · الرتبة: <b>{profile.rank || "D"}</b></p></div><button onClick={signOut}>تسجيل الخروج</button></div>{profile.status !== "approved" ? <div className="warning">حسابك قيد مراجعة اللجنة. ستظهر الخدمات بعد الموافقة.</div> : <><h3>إعلانات اللجنة</h3>{notice.map(n => <article className="notice" key={n.id}><h3>{n.title}</h3><p>{n.body}</p><small>{new Date(n.created_at).toLocaleString("fr-MA")}</small></article>)}</>}</section>
      {profile.status === "approved" && <><div className="twoCol"><section className="panel"><h2>ملفي الشخصي</h2><form onSubmit={saveProfile}><label>نبذة عني<textarea name="bio" defaultValue={profile.bio || ""} maxLength={1000}/></label><label>المهارات (افصل بينها بفاصلة)<input name="skills" defaultValue={(profile.skills || []).join(", ")}/></label><label>اللغات (افصل بينها بفاصلة)<input name="languages" defaultValue={(profile.languages || []).join(", ")}/></label><button className="primary">حفظ الملف</button></form></section>
      <section className="panel"><h2>إرسال شكاية</h2><form onSubmit={sendComplaint}><label>موضوع الشكاية<input name="subject" required maxLength={160}/></label><label>التفاصيل<textarea name="body" required minLength={10} maxLength={5000}/></label><button className="primary">إرسال سري</button></form><h3>شكاياتي</h3>{complaints.map(c => <article className="notice" key={c.id}><b>{c.subject}</b><p>{c.body}</p><small>الحالة: {c.status}</small></article>)}</section></div>
      <div className="twoCol"><section className="panel"><h2>إثبات مهارة</h2><form onSubmit={sendSkillProof}><label>اسم المهارة<input name="title" required maxLength={120}/></label><label>وصف مختصر<textarea name="description" maxLength={1000}/></label><label>صورة إثبات المهارة<input name="proof" type="file" accept="image/png,image/jpeg" required/></label><button className="primary">إرسال للمراجعة</button></form><h3>طلباتي</h3>{proofs.map(p => <article className="notice" key={p.id}><b>{p.title}</b><p>{p.description}</p><small>الحالة: {p.status}</small></article>)}</section>
      <section className="panel"><h2>نجم الشهر والترتيب</h2><p>ستظهر هنا شارة نجم الشهر والترتيب بعد اعتمادها من المشرفين.</p><div className="badgeSample">★ CAD · متدرب ملتزم</div><h3>المسابقات</h3><p className="muted">تعلن اللجنة عن المسابقات والنتائج في الإعلانات الرسمية.</p></section></div></>}
    </>}

    {mode === "admin" && profile?.role === "admin" && <><section className="panel"><div className="dashHead"><div><span className="eyebrow">إدارة CAD</span><h2>لوحة المشرفين</h2></div><button onClick={signOut}>تسجيل الخروج</button></div><h3>نشر إعلان نصي</h3><form className="inlineForm" onSubmit={addNotice}><label>العنوان<input name="title" required maxLength={160}/></label><label>النص<textarea name="body" required maxLength={5000}/></label><label>صورة اختيارية<input name="image" type="file" accept="image/png,image/jpeg"/></label><button className="primary">نشر الإعلان</button></form></section>
      <section className="panel"><h2>طلبات التسجيل ({members.filter(m => m.status === "pending").length})</h2>{members.map(m => <article className="adminItem" key={m.id}><div><b>{m.first_name} {m.last_name}</b><p>القسم: {m.section} · CIN: {m.cin} · الحالة: {m.status}</p><small>لا تشارك بيانات البطاقة خارج اللجنة المخولة.</small></div><div className="actions"><button onClick={() => adminAction(m.id, {status:"approved"})}>قبول</button><button className="danger" onClick={() => adminAction(m.id, {status:"rejected"})}>رفض</button><select aria-label="رتبة المتدرب" value={m.rank || "D"} onChange={e => adminAction(m.id, {rank:e.target.value})}><option>A</option><option>B</option><option>C</option><option>D</option></select><button onClick={() => adminAction(m.id, {monthly_star:true})}>نجم الشهر ★</button><button onClick={() => adminAction(m.id, {monthly_star:false})}>إزالة النجمة</button></div></article>)}</section>
      <section className="panel"><h2>الشكايات</h2>{complaints.map(c => { const p = members.find(m => m.id === c.user_id); return <article className="adminItem" key={c.id}><div><b>{c.subject}</b><p>{c.body}</p><small>المشتكي: {p ? `${p.first_name} ${p.last_name} · ${p.cin} · ${p.section}` : "غير متاح"} · {new Date(c.created_at).toLocaleString("fr-MA")}</small></div><div className="actions"><select value={c.status} onChange={e => adminAction(c.id, {status:e.target.value}, "complaints")}><option value="new">جديدة</option><option value="reviewing">قيد الدراسة</option><option value="resolved">تمت المعالجة</option><option value="closed">مغلقة</option></select></div></article>})}</section>
      <section className="panel"><h2>إثباتات المهارات</h2>{proofs.map(p => { const m = members.find(x => x.id === p.user_id); return <article className="adminItem" key={p.id}><div><b>{p.title}</b><p>{p.description}</p><small>المتدرب: {m ? `${m.first_name} ${m.last_name}` : p.user_id}</small></div><div className="actions"><button onClick={() => adminAction(p.id, {status:"approved"}, "skill_proofs")}>اعتماد</button><button className="danger" onClick={() => adminAction(p.id, {status:"rejected"}, "skill_proofs")}>رفض</button></div></article>})}</section></>}
    <footer>CAD OFPPT · منصة داخلية لخدمة المتدربين · احترموا خصوصية الجميع</footer>
  </main>;
}