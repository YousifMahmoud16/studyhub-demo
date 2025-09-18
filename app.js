// app.js (محسّن ومصحّح) -------------------------------------
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// 🔑 بيانات مشروعك
const supabaseUrl = "https://olrxxztgyjnnkzzpizdd.supabase.co";
const supabaseAnonKey =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9scnh4enRneWpubmt6enBpemRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxOTQxOTYsImV4cCI6MjA3Mzc3MDE5Nn0.hFB0alR0L8Ch2s6DznORCIVSLgktcKIHyachDjgsFso";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// عناصر HTML
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
const joinCourseInput = document.getElementById("join-course-id");
const joinCourseBtn = document.getElementById("join-course-btn");
const joinMsg = document.getElementById("join-msg");

// إحصائيات
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
// Auth
// --------------------
signupBtn.addEventListener("click", async () => {
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
    if (error) {
        authMsg.textContent = error.message;
    } else {
        await checkUser();
    }
});

logoutBtn.addEventListener("click", async () => {
    await supabase.auth.signOut();
    await checkUser();
});

// --------------------
// Courses
// --------------------
addCourseBtn.addEventListener("click", async () => {
    if (!currentUser) return;
    const title = courseTitleInput.value.trim();
    if (!title) return;

    const { error } = await supabase
        .from("courses")
        .insert([{ title, owner: currentUser.id }]);

    if (!error) {
        courseTitleInput.value = "";
        await loadCourses();
        await updateStats();
    } else {
        alert("خطأ عند إنشاء الكورس: " + error.message);
    }
});

async function loadCourses() {
    if (!currentUser) return;
    const { data, error } = await supabase
        .from("courses")
        .select("*")
        .eq("owner", currentUser.id)
        .order("created_at", { ascending: false });

    coursesList.innerHTML = "";
    if (error) return;

    if (!data || data.length === 0) {
        coursesList.innerHTML =
            `<li class="p-4 bg-white rounded shadow text-center">لا توجد كورسات بعد</li>`;
        return;
    }

    data.forEach((c) => {
        const li = document.createElement("li");
        li.className =
            "flex items-center justify-between p-3 bg-white rounded shadow";
        li.style.cursor = "pointer";
        li.textContent = `${c.title} (ID: ${c.id})`;
        li.addEventListener("click", () => openCourse(c));
        coursesList.appendChild(li);
    });
}

// --------------------
// Tasks
// --------------------
async function openCourse(course) {
    currentCourseId = course.id;
    courseName.textContent = "المهام: " + course.title;
    appSection.classList.add("hidden");
    tasksSection.classList.remove("hidden");
    await loadTasks();
    subscribeToTasks(course.id);
}

backBtn.addEventListener("click", () => {
    tasksSection.classList.add("hidden");
    appSection.classList.remove("hidden");
    if (taskChannel) supabase.removeChannel(taskChannel);
    currentCourseId = null;
});

// إضافة مهمة
addTaskBtn.addEventListener("click", async () => {
    if (!currentCourseId || !currentUser) return;

    const title = taskTitleInput.value.trim();
    if (!title) return;

    const desc = taskDescInput.value.trim();
    const priority = taskPriorityInput.value;
    const deadline = taskDeadlineInput.value;

    const { error } = await supabase.from("tasks").insert([
        {
            course_id: currentCourseId,
            user_id: currentUser.id, // ✅ بدل owner
            title,
            description: desc,
            priority,
            deadline,
            status: "todo",
        },
    ]);

    if (!error) {
        taskTitleInput.value = "";
        taskDescInput.value = "";
        taskPriorityInput.value = "medium";
        taskDeadlineInput.value = "";
        await loadTasks();
        await updateStats();
    } else {
        alert("خطأ عند إضافة المهمة: " + error.message);
    }
});

// تحميل المهام
async function loadTasks() {
    if (!currentCourseId || !currentUser) return;

    let query = supabase
        .from("tasks")
        .select("*")
        .eq("course_id", currentCourseId)
        .eq("user_id", currentUser.id) // ✅ بدل owner
        .order("created_at", { ascending: true });

    if (currentFilter !== "all") query = query.eq("status", currentFilter);

    const { data, error } = await query;
    tasksList.innerHTML = "";
    if (error) return;

    if (!data || data.length === 0) {
        tasksList.innerHTML =
            `<li class="p-4 bg-white rounded shadow text-center">لا توجد مهام</li>`;
        return;
    }

    data.forEach((t) => {
        const li = document.createElement("li");
        li.className =
            "flex justify-between items-center p-3 bg-white rounded shadow";
        li.textContent = `${t.title} [${t.status}]`;
        li.addEventListener("click", async () => {
            const nextStatus =
                t.status === "todo"
                    ? "in-progress"
                    : t.status === "in-progress"
                        ? "done"
                        : "todo";
            await supabase
                .from("tasks")
                .update({ status: nextStatus })
                .eq("id", t.id)
                .eq("user_id", currentUser.id);
            await loadTasks();
            await updateStats();
        });
        tasksList.appendChild(li);
    });
}

// --------------------
// Realtime
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
        .eq("user_id", currentUser.id); // ✅ بدل owner

    const { count: doneCount } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("user_id", currentUser.id) // ✅ بدل owner
        .eq("status", "done");

    statsCourses.textContent = coursesCount ?? 0;
    statsTasks.textContent = tasksCount ?? 0;
    statsDone.textContent = doneCount ?? 0;
}
