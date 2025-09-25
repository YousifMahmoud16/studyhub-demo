// app.js — الجزء 1/2
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// 🔑 بيانات مشروعك - تأكد أنها من نفس مشروع Supabase في Dashboard
const supabaseUrl = "https://olrxxztgyjnnkzzpizdd.supabase.co";
const supabaseAnonKey =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9scnh4enRneWpubmt6enBpemRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxOTQxOTYsImV4cCI6MjA3Mzc3MDE5Nn0.hFB0alR0L8Ch2s6DznORCIVSLgktcKIHyachDjgsFso";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// --------------------
// عناصر DOM
// --------------------
const signupBtn = document.getElementById("signup");
const signinBtn = document.getElementById("signin");
const logoutBtn = document.getElementById("logout");
const authMsg = document.getElementById("auth-msg");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const appSection = document.getElementById("app-section");
const authSection = document.getElementById("auth-section");

const addCourseBtn = document.getElementById("add-course");
const courseTitleInput = document.getElementById("course-title");
const coursesList = document.getElementById("courses-list");

const statsCourses = document.getElementById("stats-courses");
const statsTasks = document.getElementById("stats-tasks");
const statsDone = document.getElementById("stats-done");

// مهام
const tasksSection = document.getElementById("tasks-section");
const tasksList = document.getElementById("tasks-list");
const courseName = document.getElementById("course-name");
const addTaskBtn = document.getElementById("add-task");
const taskTitleInput = document.getElementById("task-title");
const taskDescInput = document.getElementById("task-desc");
const taskPriorityInput = document.getElementById("task-priority");
const taskDeadlineInput = document.getElementById("task-deadline");
const backBtn = document.getElementById("back");
const filterSelect = document.getElementById("filter");

// ملخصات (notes)
const notesList = document.getElementById("notes-list");
const noteTitleInput = document.getElementById("note-title");
const noteContentInput = document.getElementById("note-content");
const noteFileInput = document.getElementById("note-file");
const addNoteBtn = document.getElementById("add-note");

// فيديوهات (new)
const videosList = document.getElementById("videos-list");
const videoTitleInput = document.getElementById("video-title");
const videoFileInput = document.getElementById("video-file");
const addVideoBtn = document.getElementById("add-video");

// Buckets (تأكد من وجودهم في لوحة Supabase)
const NOTES_BUCKET = "summaries";
const VIDEOS_BUCKET = "videos";

let currentUser = null;
let currentCourseId = null;
let currentFilter = "all";
let taskChannel = null;

// --------------------
// Check User Session
// --------------------
async function checkUser() {
    const res = await supabase.auth.getUser();
    const user = res.data?.user ?? null;
    console.log("checkUser:", user?.email ?? "no user");
    if (user) {
        currentUser = user;
        authSection.classList.add("hidden");
        appSection.classList.remove("hidden");
        logoutBtn.classList.remove("hidden");
        await loadCourses();
        await updateStats();
    } else {
        currentUser = null;
        authSection.classList.remove("hidden");
        appSection.classList.add("hidden");
        tasksSection.classList.add("hidden");
        logoutBtn.classList.add("hidden");
    }
}
checkUser();

// --------------------
// Auth handlers
// --------------------
signupBtn.addEventListener("click", async () => {
    authMsg.textContent = "";
    const email = emailInput.value.trim();
    const pass = passwordInput.value;
    if (!email || !pass) {
        authMsg.textContent = "ادخل البريد وكلمة المرور";
        return;
    }
    const { error } = await supabase.auth.signUp({ email, password: pass });
    authMsg.textContent = error ? error.message : "افتح بريدك لتأكيد الحساب!";
});

signinBtn.addEventListener("click", async () => {
    authMsg.textContent = "";
    const email = emailInput.value.trim();
    const pass = passwordInput.value;
    if (!email || !pass) {
        authMsg.textContent = "ادخل البريد وكلمة المرور";
        return;
    }
    const { error } = await supabase.auth.signInWithPassword({
        email,
        password: pass,
    });
    if (error) authMsg.textContent = error.message;
    else await checkUser();
});

logoutBtn.addEventListener("click", async () => {
    await supabase.auth.signOut();
    await checkUser();
});

// --------------------
// Courses
// --------------------
// إضافة كورس جديد
addCourseBtn.addEventListener("click", async () => {
    if (!currentUser) return;
    const title = courseTitleInput.value.trim();
    if (!title) return;

    try {
        // إنشاء الكورس أولاً
        const { data: newCourse, error } = await supabase
            .from("courses")
            .insert([{ title, owner: currentUser.id, created_at: new Date().toISOString() }])
            .select()
            .single(); // أخذ الكورس الذي تم إنشاؤه

        if (error) {
            alert("خطأ عند إنشاء الكورس: " + error.message);
            return;
        }

        // إضافة المالك تلقائيًا كعضو
        const { error: memberError } = await supabase
            .from("course_members")
            .insert([{ course_id: newCourse.id, user_id: currentUser.id, joined_at: new Date().toISOString() }]);
        if (memberError) console.error("خطأ عند إضافة المالك كعضو:", memberError);

        courseTitleInput.value = "";
        await loadCourses();
        await updateStats();
    } catch (err) {
        console.error("addCourse exception:", err);
        alert("حدث خطأ أثناء إنشاء الكورس. تحقق من Console.");
    }
});

// تحميل الكورسات وعرضها
async function loadCourses() {
    if (!currentUser) return;

    try {
        // جلب كل الكورسات
        const { data: allCourses, error } = await supabase
            .from("courses")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) throw error;

        // جلب IDs الكورسات التي انضم إليها المستخدم
        const { data: memberLinks, error: memberError } = await supabase
            .from("course_members")
            .select("course_id")
            .eq("user_id", currentUser.id);

        if (memberError) throw memberError;

        const memberCourseIds = memberLinks ? memberLinks.map(m => m.course_id) : [];

        coursesList.innerHTML = "";
        if (!allCourses || allCourses.length === 0) {
            coursesList.innerHTML = `<li class="p-4 bg-white rounded shadow text-center">لا توجد كورسات بعد</li>`;
            return;
        }

        allCourses.forEach((c) => {
            const li = document.createElement("li");
            li.className = "flex items-center justify-between p-3 bg-white rounded shadow mb-2";

            // عنوان الكورس
            const titleSpan = document.createElement("span");
            titleSpan.textContent = `${c.title} (ID: ${c.id})`;
            titleSpan.style.cursor = "pointer";
            titleSpan.addEventListener("click", () => openCourse(c));
            li.appendChild(titleSpan);

            // تحقق إذا كان المالك أو عضو
            const isOwner = c.owner === currentUser.id;
            const isMember = memberCourseIds.includes(c.id) || isOwner;

            // زر الانضمام
            if (!isOwner && !isMember) {
                const joinBtn = document.createElement("button");
                joinBtn.textContent = "انضم للكورس";
                joinBtn.className = "join-btn px-2 py-1 rounded text-white bg-green-500 ml-2";
                joinBtn.addEventListener("click", async (e) => {
                    e.stopPropagation();
                    const { error } = await supabase.from("course_members").insert([
                        { course_id: c.id, user_id: currentUser.id, joined_at: new Date().toISOString() },
                    ]);
                    if (error) return alert("خطأ عند الانضمام: " + error.message);
                    alert("تم الانضمام للكورس بنجاح!");
                    await loadCourses();
                });
                li.appendChild(joinBtn);
            }

            // زر الحذف للمالك فقط
            if (isOwner) {
                const delBtn = document.createElement("button");
                delBtn.textContent = "🗑";
                delBtn.className = "delete-btn px-2 py-1 rounded text-white bg-red-500 ml-2";
                delBtn.addEventListener("click", async (e) => {
                    e.stopPropagation();
                    const { error } = await supabase
                        .from("courses")
                        .delete()
                        .eq("id", c.id)
                        .eq("owner", currentUser.id);
                    if (error) return alert("خطأ عند حذف الكورس: " + error.message);
                    await loadCourses();
                    await updateStats();
                });
                li.appendChild(delBtn);
            }

            coursesList.appendChild(li);
        });
    } catch (err) {
        console.error("loadCourses error:", err);
        coursesList.innerHTML = `<li class="p-4 bg-white rounded shadow text-center">حدث خطأ أثناء تحميل الكورسات</li>`;
    }
}

// --------------------
// Tasks
// --------------------
async function openCourse(course) {
    if (!currentUser) return;

    // التحقق من الاشتراك أولاً
    const { data: membership, error: checkError } = await supabase
        .from("course_members")
        .select("*")
        .eq("course_id", course.id)
        .eq("user_id", currentUser.id)
        .limit(1);

    if (checkError) {
        console.error("Error checking membership:", checkError);
        alert("حدث خطأ أثناء التحقق من الاشتراك");
        return;
    }

    if (!membership || membership.length === 0) {
        alert("عذراً، يجب أن تكون مشتركاً في الكورس لفتح المهام!");
        return; // لا تفتح الكورس إذا لم يكن المستخدم مشتركًا
    }

    // المستخدم مشترك، تابع فتح الكورس
    currentCourseId = course.id;
    courseName.textContent = "المهام: " + course.title;
    appSection.classList.add("hidden");
    tasksSection.classList.remove("hidden");
    await loadTasks();
    await loadNotes();
    await loadVideos();
    subscribeToTasks(course.id);
}

backBtn.addEventListener("click", () => {
    tasksSection.classList.add("hidden");
    appSection.classList.remove("hidden");
    if (taskChannel) supabase.removeChannel(taskChannel);
    currentCourseId = null;
});

addTaskBtn.addEventListener("click", async () => {
    if (!currentCourseId || !currentUser) return;
    const title = taskTitleInput.value.trim();
    if (!title) return;

    const desc = taskDescInput.value.trim();
    const priority = taskPriorityInput.value;
    const deadline = taskDeadlineInput.value
        ? new Date(taskDeadlineInput.value).toISOString()
        : null;

    const { error } = await supabase.from("tasks").insert([
        {
            course_id: currentCourseId,
            user_id: currentUser.id,
            title,
            description: desc,
            priority,
            deadline,
            status: "todo",
        },
    ]);

    if (error) alert("خطأ عند إضافة المهمة: " + error.message);
    else {
        taskTitleInput.value = "";
        taskDescInput.value = "";
        taskPriorityInput.value = "medium";
        taskDeadlineInput.value = "";
        await loadTasks();
        await updateStats();
    }
});

async function loadTasks() {
    if (!currentCourseId || !currentUser) return;

    let query = supabase
        .from("tasks")
        .select("*")
        .eq("course_id", currentCourseId) // فقط الكورس، لا حاجة لفلترة المستخدم
        .order("created_at", { ascending: true });
    if (currentFilter !== "all") query = query.eq("status", currentFilter);

    const { data, error } = await query;
    tasksList.innerHTML = "";
    if (error) {
        console.error("loadTasks error:", error);
        tasksList.innerHTML = `<li class="p-4 bg-white rounded shadow text-center">حدث خطأ أثناء تحميل المهام</li>`;
        return;
    }
    if (!data || data.length === 0) {
        tasksList.innerHTML = `<li class="p-4 bg-white rounded shadow text-center">لا توجد مهام</li>`;
        return;
    }

    data.forEach((t) => {
        const li = document.createElement("li");
        li.className = "flex justify-between items-center p-3 bg-white rounded shadow";

        const leftDiv = document.createElement("div");
        leftDiv.className = "flex flex-col";
        const titleEl = document.createElement("span");
        titleEl.textContent = t.title;
        const meta = document.createElement("div");
        meta.className = "meta";
        const priorityBadge = document.createElement("span");
        priorityBadge.className =
            "badge " +
            (t.priority === "low"
                ? "p-low"
                : t.priority === "medium"
                    ? "p-medium"
                    : "p-high");
        priorityBadge.textContent = t.priority || "medium";
        const deadlineEl = document.createElement("span");
        deadlineEl.textContent = t.deadline
            ? "🗓 " + new Date(t.deadline).toLocaleDateString("ar-EG")
            : "بدون تاريخ";
        meta.appendChild(priorityBadge);
        meta.appendChild(deadlineEl);
        leftDiv.appendChild(titleEl);
        leftDiv.appendChild(meta);

        const rightDiv = document.createElement("div");
        rightDiv.className = "flex gap";

        const statusBtn = document.createElement("button");
        statusBtn.textContent =
            t.status === "todo" ? "⏳" : t.status === "in-progress" ? "🚧" : "✅";
        statusBtn.className = "delete-btn px-2 py-1 rounded text-white bg-blue-500";
        statusBtn.addEventListener("click", async () => {
            const nextStatus =
                t.status === "todo"
                    ? "in-progress"
                    : t.status === "in-progress"
                        ? "done"
                        : "todo";
            const { error } = await supabase
                .from("tasks")
                .update({ status: nextStatus })
                .eq("id", t.id)
                .eq("user_id", currentUser.id);
            if (error) {
                console.error("toggle status error:", error);
                alert("خطأ عند تغيير حالة المهمة: " + error.message);
            } else {
                await loadTasks();
                await updateStats();
            }
        });

        const delBtn = document.createElement("button");
        delBtn.textContent = "🗑";
        delBtn.className = "delete-btn px-2 py-1 rounded text-white bg-red-500";
        delBtn.addEventListener("click", async () => {
            const { error } = await supabase
                .from("tasks")
                .delete()
                .eq("id", t.id)
                .eq("user_id", currentUser.id);
            if (error) {
                console.error("delete task error:", error);
                alert("خطأ عند حذف المهمة: " + error.message);
            } else {
                await loadTasks();
                await updateStats();
            }
        });

        rightDiv.appendChild(statusBtn);
        rightDiv.appendChild(delBtn);
        li.appendChild(leftDiv);
        li.appendChild(rightDiv);
        tasksList.appendChild(li);
    });
}

// --------------------
// Realtime (subscribe to tasks for the course)
// --------------------
function subscribeToTasks(courseId) {
    if (taskChannel) supabase.removeChannel(taskChannel);
    taskChannel = supabase
        .channel("tasks-realtime")
        .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "tasks", filter: `course_id=eq.${courseId}` },
            () => {
                loadTasks();
                updateStats();
            }
        )
        .subscribe();
}
// app.js — الجزء 2/2 (يكمل الجزء الأول)

// --------------------
// Stats
// --------------------
async function updateStats() {
    if (!currentUser) return;
    const { count: coursesCount } = await supabase
        .from("courses")
        .select("*", { count: "exact", head: true })
        .eq("owner", currentUser.id);
    const { count: tasksCount } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("user_id", currentUser.id);
    const { count: doneCount } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("user_id", currentUser.id)
        .eq("status", "done");
    statsCourses.textContent = coursesCount ?? 0;
    statsTasks.textContent = tasksCount ?? 0;
    statsDone.textContent = doneCount ?? 0;
}

// --------------------
// Filter Select
// --------------------
if (filterSelect) {
    filterSelect.addEventListener("change", async (e) => {
        currentFilter = e.target.value;
        await loadTasks();
    });
}

// --------------------
// Helpers: safe filename (يحاول تنظيف اسم الملف وإلا يستخدم تشفير كبديل)
// --------------------
function makeSafeName(filename) {
    try {
        // استبدال المسافات + إزالة رموز غير آمنة
        let safe = filename.replace(/\s+/g, "_").normalize("NFKD").replace(/[^\w.-]/g, "");
        if (!safe || safe.length === 0) {
            // fallback: ترميز الاسم (يحول % إلى _ لأن % في بعض الأحيان قد يسبب مشاكل)
            safe = encodeURIComponent(filename).replace(/%/g, "_");
        }
        return safe;
    } catch (e) {
        return Date.now() + "-file";
    }
}

// --------------------
// Notes (ملخصات) مع رفع ملفات
// --------------------
if (addNoteBtn) {
    addNoteBtn.addEventListener("click", async () => {
        if (!currentCourseId || !currentUser) {
            alert("اختر كورسًا أو سجّل الدخول أولًا");
            return;
        }

        const title = (noteTitleInput?.value || "").trim();
        const content = (noteContentInput?.value || "").trim();
        const file = noteFileInput?.files?.[0] ?? null;

        let file_path = null;
        let file_url = null;

        if (file) {
            const safeName = makeSafeName(file.name);
            const safePath = `${currentCourseId}/${Date.now()}-${safeName}`;

            try {
                // رفع الملف
                const { error: uploadError } = await supabase.storage
                    .from(NOTES_BUCKET)
                    .upload(safePath, file, { cacheControl: '3600', upsert: false });

                if (uploadError) throw uploadError;

                file_path = safePath;

                // **الحصول على رابط عام صحيح**
                const { data: { publicUrl } } = supabase.storage.from(NOTES_BUCKET).getPublicUrl(safePath);
                file_url = publicUrl;

            } catch (err) {
                console.error("Upload error:", err);
                alert("خطأ أثناء رفع الملف: " + err.message);
                return;
            }
        }

        // إدخال الملخص في جدول notes
        const { error } = await supabase.from("notes").insert([
            {
                course_id: currentCourseId,
                user_id: currentUser.id,  // ✅ هذا هو الحل
                title: title || null,
                content: content || null,
                file_path,
                file_url,
            },
        ]);

        if (error) {
            console.error("Insert note error:", error);
            alert("خطأ عند إضافة الملخص: " + error.message);
            if (file_path) await supabase.storage.from(NOTES_BUCKET).remove([file_path]);
            return;
        }

        // تنظيف المدخلات
        if (noteTitleInput) noteTitleInput.value = "";
        if (noteContentInput) noteContentInput.value = "";
        if (noteFileInput) noteFileInput.value = "";
        await loadNotes();
    });
}

async function loadNotes() {
    if (!currentCourseId) return;

    const { data, error } = await supabase
        .from("notes")
        .select("*")
        .eq("course_id", currentCourseId)
        .order("created_at", { ascending: false });

    notesList.innerHTML = "";
    if (error) {
        console.error("loadNotes error:", error);
        notesList.innerHTML = `<li class="p-4 bg-white rounded shadow text-center">حدث خطأ أثناء تحميل الملخصات</li>`;
        return;
    }
    if (!data || data.length === 0) {
        notesList.innerHTML = `<li class="p-4 bg-white rounded shadow text-center">لا توجد ملخصات</li>`;
        return;
    }

    data.forEach((n) => {
        const li = document.createElement("li");
        li.className = "flex flex-col gap-2 p-3 bg-white rounded shadow";

        const topRow = document.createElement("div");
        topRow.className = "flex justify-between items-center";

        const left = document.createElement("div");
        left.className = "flex flex-col";
        const titleEl = document.createElement("strong");
        titleEl.textContent = n.title || "(بدون عنوان)";
        const contentEl = document.createElement("div");
        contentEl.className = "muted";
        contentEl.textContent = n.content || "";
        left.appendChild(titleEl);
        left.appendChild(contentEl);

        const right = document.createElement("div");
        right.className = "flex gap-2";

        if (n.file_url) {
            console.log("Displaying file URL for note:", n.id, n.file_url);
            const fileA = document.createElement("a");
            fileA.href = n.file_url;
            fileA.target = "_blank";
            fileA.rel = "noopener";
            fileA.className = "btn bg-gray-200 px-2 py-1 rounded";
            fileA.textContent = "📂 عرض الملف";
            right.appendChild(fileA);
        }

        const delBtn = document.createElement("button");
        delBtn.textContent = "🗑";
        delBtn.className = "delete-btn px-2 py-1 rounded text-white bg-red-500";
        delBtn.addEventListener("click", async () => {
            try {
                if (n.file_path)
                    await supabase.storage.from(NOTES_BUCKET).remove([n.file_path]);
            } catch (err) {
                console.warn("Could not delete file from storage:", err);
            }
            const { error } = await supabase.from("notes").delete().eq("id", n.id);
            if (error) console.error("delete note error:", error);
            else await loadNotes();
        });

        right.appendChild(delBtn);

        topRow.appendChild(left);
        topRow.appendChild(right);

        const smallMeta = document.createElement("small");
        smallMeta.className = "muted";
        smallMeta.textContent = `أضيف في: ${new Date(n.created_at).toLocaleString("ar-EG")}`;

        li.appendChild(topRow);
        li.appendChild(smallMeta);
        notesList.appendChild(li);
    });
}

// --------------------
// Videos (فيديوهات) - إضافة + تحميل + حذف
// --------------------
if (addVideoBtn) {
    addVideoBtn.addEventListener("click", async () => {
        if (!currentCourseId || !currentUser) {
            alert("اختر كورسًا أو سجّل الدخول أولًا");
            return;
        }
        const title = (videoTitleInput?.value || "").trim();
        const file = videoFileInput?.files?.[0] ?? null;
        if (!file) {
            alert("اختر ملف فيديو أولاً");
            return;
        }

        console.log("Uploading video to bucket:", VIDEOS_BUCKET, "file:", file.name);

        const safeName = makeSafeName(file.name);
        const safePath = `${currentCourseId}/${Date.now()}-${safeName}`;

        try {
            const { error: uploadError } = await supabase.storage.from(VIDEOS_BUCKET).upload(safePath, file);
            if (uploadError) {
                console.error("video upload error:", uploadError);
                if (/bucket not found/i.test(String(uploadError.message).toLowerCase())) {
                    alert("فشل رفع الفيديو: الـ bucket غير موجود. اذهب إلى Supabase → Storage وتأكد من وجود bucket اسمه: '" + VIDEOS_BUCKET + "' بالضبط.");
                } else {
                    alert("فشل رفع الفيديو: " + uploadError.message);
                }
                return;
            }
        } catch (err) {
            console.error("Upload exception:", err);
            alert("خطأ أثناء رفع الفيديو. افتح Console للحصول على تفاصيل.");
            return;
        }

        // الحصول على رابط عام
        const { data: urlData } = supabase.storage.from(VIDEOS_BUCKET).getPublicUrl(safePath);
        const file_url = urlData?.publicUrl || null;

        // إدخال الفيديو في جدول videos
        const { error } = await supabase.from("videos").insert([
            {
                course_id: currentCourseId,
                user_id: currentUser.id,
                title: title || null,
                file_path: safePath,
                file_url,
            },
        ]);

        if (error) {
            console.error("Insert video error:", error);
            alert("خطأ عند إضافة الفيديو: " + error.message);
            // حاول حذف الملف من التخزين إن أدخلت شيء بشكل جزئي
            try { await supabase.storage.from(VIDEOS_BUCKET).remove([safePath]); } catch (e) { console.warn("Could not remove video after failed insert:", e); }
            return;
        }

        if (videoTitleInput) videoTitleInput.value = "";
        if (videoFileInput) videoFileInput.value = "";
        await loadVideos();
    });
}

async function loadVideos() {
    if (!currentCourseId || !currentUser) return;

    const { data, error } = await supabase
        .from("videos")
        .select("*")
        .eq("course_id", currentCourseId)
        .order("created_at", { ascending: false });

    videosList.innerHTML = "";
    if (error) {
        console.error("loadVideos error:", error);
        videosList.innerHTML = `<li class="p-4 bg-white rounded shadow text-center">حدث خطأ أثناء تحميل الفيديوهات</li>`;
        return;
    }
    if (!data || data.length === 0) {
        videosList.innerHTML = `<li class="p-4 bg-white rounded shadow text-center">لا توجد فيديوهات</li>`;
        return;
    }

    // helper: خمن الـ MIME من امتداد الملف
    function guessMimeFromPath(path) {
        if (!path) return "video/mp4";
        const ext = String(path).split(".").pop().split(/\?|#/)[0].toLowerCase();
        if (ext === "mp4") return "video/mp4";
        if (ext === "webm") return "video/webm";
        if (ext === "ogv" || ext === "ogg") return "video/ogg";
        if (ext === "mov") return "video/quicktime";
        // fallback
        return "video/mp4";
    }

    data.forEach((v) => {
        const li = document.createElement("li");
        li.className = "flex flex-col gap-2 p-3 bg-white rounded shadow w-full overflow-hidden";

        const titleEl = document.createElement("strong");
        titleEl.textContent = v.title || "(فيديو بدون عنوان)";
        titleEl.className = "break-words"; // يمنع النص الطويل من تمديد الصفحة
        li.appendChild(titleEl);

        if (v.file_url) {
            const videoEl = document.createElement("video");
            videoEl.controls = true;
            videoEl.className = "w-full rounded";
            videoEl.setAttribute("playsinline", "");
            videoEl.setAttribute("webkit-playsinline", "");

            // حاول الحصول على نوع MIME من file_path أو من رابط الملف
            const mime = guessMimeFromPath(v.file_path || v.file_url);

            const sourceEl = document.createElement("source");
            sourceEl.src = v.file_url;
            sourceEl.type = mime;
            videoEl.appendChild(sourceEl);

            videoEl.appendChild(document.createTextNode("متصفحك لا يدعم تشغيل الفيديو."));

            videoEl.addEventListener("error", (ev) => {
                console.warn("Video playback error for:", v.file_url, ev);
            });

            li.appendChild(videoEl);
        }

        videosList.appendChild(li);
    });
}

// نهاية الملف — الآن عند فتح أي كورس سيتم تحميل المهام والملخصات والفيديوهات تلقائياً (openCourse يستدعي loadTasks/loadNotes/loadVideos).
