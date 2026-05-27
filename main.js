const App = {
  data: null,
  activePage: "dashboard",
  searchQuery: "",
  lastSaveTimer: null,

  async init() {
    this.applyTheme();
    this.data = await TaskFlowStorage.init();
    this.bindLayoutEvents();
    this.bindFormEvents();
    await this.loadPage("dashboard");
    this.setSaveStatus("جاهز للحفظ", "neutral");
    this.renderIcons();
  },

  renderIcons() {
    if (window.lucide) lucide.createIcons();
  },

  syncData() {
    if (TaskFlowStorage?.data) this.data = TaskFlowStorage.data;
    if (!this.data) this.data = TaskFlowStorage.loadLocal ? TaskFlowStorage.loadLocal() : { categories: [], tasks: [], clients: [], notes: [] };

    this.data.categories = Array.isArray(this.data.categories) ? this.data.categories : [];
    this.data.tasks = Array.isArray(this.data.tasks) ? this.data.tasks : [];
    this.data.clients = Array.isArray(this.data.clients) ? this.data.clients : [];
    this.data.notes = Array.isArray(this.data.notes) ? this.data.notes : [];
  },

  bindLayoutEvents() {
    const openSidebar = document.getElementById("openSidebar");
    const closeSidebar = document.getElementById("closeSidebar");
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("mobileOverlay");

    openSidebar?.addEventListener("click", () => {
      sidebar.classList.remove("translate-x-full");
      overlay.classList.remove("hidden");
    });

    const close = () => {
      sidebar.classList.add("translate-x-full");
      overlay.classList.add("hidden");
    };

    closeSidebar?.addEventListener("click", close);
    overlay?.addEventListener("click", close);

    document.querySelectorAll(".nav-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.loadPage(btn.dataset.page);
        close();
      });
    });

    document.getElementById("globalSearch")?.addEventListener("input", (e) => {
      this.searchQuery = e.target.value.trim().toLowerCase();
      this.renderCurrentPage();
    });

    document.getElementById("themeToggle")?.addEventListener("click", () => {
      document.documentElement.classList.toggle("dark");
      localStorage.setItem("task-flow-theme", document.documentElement.classList.contains("dark") ? "dark" : "light");
      this.updateThemeIcon();
      this.renderIcons();
    });

    document.getElementById("quickAddTask")?.addEventListener("click", () => this.openTaskModal());

    document.getElementById("driveLoginBtn")?.addEventListener("click", async () => {
      try {
        this.setSaveStatus("جاري الاتصال بـ Google Drive...", "saving");
        this.data = await TaskFlowStorage.signIn();
        this.setSaveStatus("تم الاتصال بـ Google Drive", "saved");
        this.renderCurrentPage();
      } catch (error) {
        console.error(error);
        this.setSaveStatus("فشل الاتصال", "error");
        alert(error.message || "تعذر الاتصال بـ Google Drive");
      }
    });

    document.getElementById("driveLogoutBtn")?.addEventListener("click", () => {
      TaskFlowStorage.signOut();
      this.setSaveStatus("غير متصل بالسحابة", "neutral");
      this.renderIcons();
    });

    document.querySelectorAll("[data-close-modal]").forEach((btn) => {
      btn.addEventListener("click", () => this.closeModal(btn.dataset.closeModal));
    });
  },

  bindFormEvents() {
    document.getElementById("taskForm")?.addEventListener("submit", (e) => {
      e.preventDefault();

      const id = document.getElementById("taskId").value;

      const task = {
        id: id || Date.now(),
        title: document.getElementById("taskTitle").value.trim(),
        category: document.getElementById("taskCategory").value,
        priority: document.getElementById("taskPriority").value,
        status: document.getElementById("taskStatus").value,
        deadline: document.getElementById("taskDeadline").value,
        createdAt: id
          ? (this.data.tasks.find((item) => String(item.id) === String(id))?.createdAt || this.today())
          : this.today(),
        desc: document.getElementById("taskDesc").value.trim()
      };

      if (id) {
        this.data.tasks = this.data.tasks.map((item) => String(item.id) === String(id) ? task : item);
      } else {
        this.data.tasks.unshift(task);
      }

      this.save();
      this.closeModal("taskModal");
      this.renderCurrentPage();
    });

    document.getElementById("clientForm")?.addEventListener("submit", (e) => {
      e.preventDefault();

      const id = document.getElementById("clientId")?.value || "";

      const client = {
        id: id || Date.now(),
        name: document.getElementById("clientName").value.trim(),
        phone: document.getElementById("clientPhone").value.trim(),
        type: document.getElementById("clientType").value.trim(),
        date: document.getElementById("clientDate").value || this.today(),
        next: document.getElementById("clientNext").value.trim()
      };

      if (id) {
        this.data.clients = this.data.clients.map((item) => String(item.id) === String(id) ? client : item);
      } else {
        this.data.clients.unshift(client);
      }

      e.target.reset();
      document.getElementById("clientId").value = "";
      document.getElementById("clientDate").value = this.today();

      this.save();
      this.closeModal("clientModal");
      this.renderCurrentPage();
    });

    document.getElementById("noteForm")?.addEventListener("submit", (e) => {
      e.preventDefault();

      this.data.notes.unshift({
        id: Date.now(),
        title: document.getElementById("noteTitle").value.trim(),
        content: document.getElementById("noteContent").value.trim(),
        date: this.today()
      });

      e.target.reset();

      this.save();
      this.closeModal("noteModal");
      this.renderCurrentPage();
    });
  },

  applyTheme() {
    if (localStorage.getItem("task-flow-theme") === "dark") document.documentElement.classList.add("dark");
    this.updateThemeIcon();
  },

  updateThemeIcon() {
    const icon = document.getElementById("themeIcon");
    if (!icon) return;
    icon.setAttribute("data-lucide", document.documentElement.classList.contains("dark") ? "sun" : "moon");
  },

  async loadPage(page) {
    this.activePage = page;

    document.querySelectorAll(".nav-item").forEach((item) => {
      item.classList.toggle("active", item.dataset.page === page);
    });

    const view = document.getElementById("appView");

    try {
      const response = await fetch(`./pages/${page}.html`);
      view.innerHTML = await response.text();
    } catch (error) {
      view.innerHTML = `<div class="card p-8 text-center text-red-600 font-bold">تعذر تحميل الصفحة. شغل المشروع عبر Live Server.</div>`;
      return;
    }

    this.renderCurrentPage();
  },

  renderCurrentPage() {
    this.syncData();

    if (this.activePage === "dashboard") this.renderDashboard();
    if (this.activePage === "tasks") this.renderTasks();
    if (this.activePage === "clients") this.renderClients();
    if (this.activePage === "notes") this.renderNotes();
    if (this.activePage === "calendar") this.renderCalendar();
    if (this.activePage === "settings") this.renderSettings();

    this.renderIcons();
  },

  async save() {
    try {
      this.setSaveStatus("جاري الحفظ...", "saving");
      TaskFlowStorage.data = this.data;
      await TaskFlowStorage.save(this.data);
      this.setSaveStatus("تم الحفظ قبل ثواني", "saved");
    } catch (error) {
      console.error("Google Drive save error:", error);
      this.setSaveStatus("فشل الحفظ", "error");
      alert(error.message || "تعذر الحفظ في Google Drive");
    }
  },

  setSaveStatus(text, type = "neutral") {
    const el = document.getElementById("saveStatusText");
    if (!el) return;

    el.textContent = text;

    const box = el.closest("div");
    if (!box) return;

    box.classList.remove(
      "text-slate-500", "dark:text-slate-300",
      "text-emerald-700", "dark:text-emerald-300",
      "text-amber-700", "dark:text-amber-300",
      "text-rose-700", "dark:text-rose-300"
    );

    if (type === "saved") box.classList.add("text-emerald-700", "dark:text-emerald-300");
    else if (type === "saving") box.classList.add("text-amber-700", "dark:text-amber-300");
    else if (type === "error") box.classList.add("text-rose-700", "dark:text-rose-300");
    else box.classList.add("text-slate-500", "dark:text-slate-300");

    if (this.lastSaveTimer) clearTimeout(this.lastSaveTimer);

    if (type === "saved") {
      this.lastSaveTimer = setTimeout(() => {
        if (el.textContent === "تم الحفظ قبل ثواني") el.textContent = "محفوظ في السحابة";
      }, 6000);
    }
  },

  today() {
    return TaskFlowStorage.today();
  },

  filter(items, fields) {
    if (!this.searchQuery) return items;
    return items.filter((item) => fields.some((field) => String(item[field] || "").toLowerCase().includes(this.searchQuery)));
  },

  renderDashboard() {
    const total = this.data.tasks.length;
    const done = this.data.tasks.filter((t) => t.status === "مكتملة").length;
    const late = this.data.tasks.filter((t) => this.getDaysLeft(t.deadline) === "متأخرة" || t.status === "متأخرة").length;
    const todayTasks = this.data.tasks.filter((t) => t.deadline === this.today() || t.createdAt === this.today()).length;
    const progress = total ? Math.round((done / total) * 100) : 0;

    this.setText("statTotalTasks", total);
    this.setText("statDoneTasks", done);
    this.setText("statLateTasks", late);
    this.setText("statTodayTasks", todayTasks);
    this.setText("statClients", this.data.clients.length);
    this.setText("statNotes", this.data.notes.length);
    this.setText("statProgress", `${progress}%`);

    const list = this.data.tasks.filter((t) => t.status !== "مكتملة").slice(0, 5);
    const box = document.getElementById("todayTasksList");
    if (box) box.innerHTML = list.length ? list.map((task) => this.taskRow(task)).join("") : this.empty("لا توجد مهام حالية");
  },

  renderTasks() {
    const statusFilter = document.getElementById("taskStatusFilter");
    const priorityFilter = document.getElementById("taskPriorityFilter");
    const categoryFilter = document.getElementById("taskCategoryFilter");

    if (categoryFilter) {
      const current = categoryFilter.value || "all";
      categoryFilter.innerHTML = `<option value="all">كل التصنيفات</option>` + this.data.categories.map((cat) => `<option value="${this.escape(cat)}">${this.escape(cat)}</option>`).join("");
      categoryFilter.value = current;
    }

    const selectedStatus = statusFilter?.value || "all";
    const selectedPriority = priorityFilter?.value || "all";
    const selectedCategory = categoryFilter?.value || "all";

    let allTasks = this.data.tasks;
    let list = this.filter(allTasks, ["title", "category", "priority", "status", "desc"]);

    list = list
      .filter((task) => selectedStatus === "all" || task.status === selectedStatus)
      .filter((task) => selectedPriority === "all" || task.priority === selectedPriority)
      .filter((task) => selectedCategory === "all" || task.category === selectedCategory);

    const tbody = document.getElementById("tasksTableBody");
    const empty = document.getElementById("tasksTableEmpty");
    const countLabel = document.getElementById("tasksCountLabel");

    if (countLabel) countLabel.textContent = `عدد المهام: ${list.length} من ${allTasks.length}`;
    if (tbody) tbody.innerHTML = list.map((task, index) => this.taskTableRow(task, index)).join("");
    if (empty) empty.classList.toggle("hidden", list.length > 0);

    document.getElementById("addTaskBtn")?.addEventListener("click", () => this.openTaskModal());
    document.getElementById("exportTasksCsvBtn")?.addEventListener("click", () => this.exportTasksCSV());

    [statusFilter, priorityFilter, categoryFilter].forEach((select) => {
      if (!select || select.dataset.bound === "true") return;
      select.dataset.bound = "true";
      select.addEventListener("change", () => this.renderTasks());
    });
  },

  renderClients() {
    const list = this.filter(this.data.clients, ["name", "phone", "type", "next", "date"]);

    const tbody = document.getElementById("clientsTableBody");
    const empty = document.getElementById("clientsTableEmpty");
    const countLabel = document.getElementById("clientsCountLabel");

    if (countLabel) countLabel.textContent = `عدد العملاء: ${list.length} من ${this.data.clients.length}`;
    if (tbody) tbody.innerHTML = list.map((client, index) => this.clientTableRow(client, index)).join("");
    if (empty) empty.classList.toggle("hidden", list.length > 0);

    document.getElementById("addClientBtn")?.addEventListener("click", () => this.openClientModal());
    document.getElementById("exportClientsCsvBtn")?.addEventListener("click", () => this.exportClientsCSV());
  },

  renderNotes() {
    const list = this.filter(this.data.notes, ["title", "content", "date"]);
    const box = document.getElementById("notesGrid");
    if (box) box.innerHTML = list.length ? list.map((note) => this.noteCard(note)).join("") : this.empty("لا توجد ملاحظات");
    document.getElementById("addNoteBtn")?.addEventListener("click", () => this.openModal("noteModal"));
  },

  renderCalendar() {
    const days = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
    const box = document.getElementById("calendarGrid");
    if (!box) return;

    box.innerHTML = days.map((day, index) => {
      const tasks = this.data.tasks.filter((t) => t.deadline && new Date(t.deadline).getDay() === index);
      return `
        <div class="card p-4 min-h-[220px]">
          <h3 class="font-black text-[#003C7D] dark:text-white mb-3">${day}</h3>
          <div class="space-y-2">
            ${
              tasks.length
                ? tasks.map((task) => `<div class="p-3 rounded-2xl bg-slate-50 dark:bg-[#11263F] border border-slate-100 dark:border-slate-800"><p class="font-bold text-sm line-clamp-2">${this.escape(task.title)}</p><span class="${this.badge(task.priority)} mt-2">${task.priority}</span></div>`).join("")
                : `<p class="text-xs text-slate-400 text-center mt-8">لا توجد مهام</p>`
            }
          </div>
        </div>
      `;
    }).join("");
  },

  renderSettings() {
    const box = document.getElementById("categoryList");
    if (box) {
      box.innerHTML = this.data.categories.map((cat) => `
        <span class="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-[#EDF5FD] dark:bg-[#11263F] text-sm font-bold border border-[#DCEBFA] dark:border-[#16324F]">
          ${this.escape(cat)}
          <button onclick="App.deleteCategory('${this.escapeQuote(cat)}')" class="text-rose-500">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </span>
      `).join("");
    }

    document.getElementById("categoryForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = document.getElementById("newCategory");
      const value = input.value.trim();
      if (!value || this.data.categories.includes(value)) return;
      this.data.categories.push(value);
      input.value = "";
      this.save();
      this.renderCurrentPage();
    });

    document.getElementById("resetDataBtn")?.addEventListener("click", () => {
      if (!confirm("استرجاع البيانات التجريبية؟")) return;
      this.data = TaskFlowStorage.reset();
      this.renderCurrentPage();
    });

    document.getElementById("clearDataBtn")?.addEventListener("click", () => {
      if (!confirm("مسح جميع البيانات؟")) return;
      this.data = TaskFlowStorage.clear();
      this.renderCurrentPage();
    });
  },

  openTaskModal(id = null) {
    this.populateTaskCategories();

    const task = id ? this.data.tasks.find((item) => String(item.id) === String(id)) : null;

    document.getElementById("taskModalTitle").textContent = task ? "تعديل المهمة" : "إضافة مهمة جديدة";
    document.getElementById("taskId").value = task?.id || "";
    document.getElementById("taskTitle").value = task?.title || "";
    document.getElementById("taskCategory").value = task?.category || this.data.categories[0];
    document.getElementById("taskPriority").value = task?.priority || "متوسطة";
    document.getElementById("taskStatus").value = task?.status || "جديدة";
    document.getElementById("taskDeadline").value = task?.deadline || "";
    document.getElementById("taskDesc").value = task?.desc || "";

    this.openModal("taskModal");
  },

  openClientModal(id = null) {
    const client = id ? this.data.clients.find((item) => String(item.id) === String(id)) : null;

    document.getElementById("clientId").value = client?.id || "";
    document.getElementById("clientName").value = client?.name || "";
    document.getElementById("clientPhone").value = client?.phone || "";
    document.getElementById("clientType").value = client?.type || "";
    document.getElementById("clientDate").value = client?.date || this.today();
    document.getElementById("clientNext").value = client?.next || "";

    this.openModal("clientModal");
  },

  populateTaskCategories() {
    const select = document.getElementById("taskCategory");
    if (!select) return;
    select.innerHTML = this.data.categories.map((cat) => `<option>${this.escape(cat)}</option>`).join("");
  },

  openModal(id) {
    document.getElementById(id)?.classList.add("show");
    this.renderIcons();
  },

  closeModal(id) {
    document.getElementById(id)?.classList.remove("show");
  },

  showTaskDetails(id) {
    const task = this.data.tasks.find((item) => String(item.id) === String(id));
    if (!task) return;

    const content = document.getElementById("taskDetailsContent");
    if (!content) return;

    content.innerHTML = `
      <div class="rounded-3xl bg-[#EDF5FD] dark:bg-[#11263F] p-5">
        <p class="text-xs text-slate-500 dark:text-slate-400 font-bold mb-2">عنوان المهمة</p>
        <h3 class="text-xl font-black text-[#003C7D] dark:text-white">${this.escape(task.title || "بدون عنوان")}</h3>
      </div>

      <div class="grid md:grid-cols-2 gap-3">
        <div class="rounded-2xl border border-slate-100 dark:border-slate-800 p-4">
          <p class="text-xs text-slate-500 font-bold mb-2">التصنيف</p>
          <span class="badge badge-slate">${this.escape(task.category || "بدون تصنيف")}</span>
        </div>

        <div class="rounded-2xl border border-slate-100 dark:border-slate-800 p-4">
          <p class="text-xs text-slate-500 font-bold mb-2">الأولوية</p>
          <span class="${this.badge(task.priority)}">${this.escape(task.priority || "متوسطة")}</span>
        </div>

        <div class="rounded-2xl border border-slate-100 dark:border-slate-800 p-4">
          <p class="text-xs text-slate-500 font-bold mb-2">الحالة</p>
          <span class="${this.badge(task.status)}">${this.escape(task.status || "جديدة")}</span>
        </div>

        <div class="rounded-2xl border border-slate-100 dark:border-slate-800 p-4">
          <p class="text-xs text-slate-500 font-bold mb-2">موعد الانتهاء</p>
          <p class="font-black">${this.escape(task.deadline || "بدون موعد")} - ${this.getDaysLeft(task.deadline)}</p>
        </div>
      </div>

      <div class="rounded-2xl border border-slate-100 dark:border-slate-800 p-4">
        <p class="text-xs text-slate-500 font-bold mb-2">الوصف</p>
        <p class="text-sm leading-relaxed text-slate-600 dark:text-slate-300">${this.escape(task.desc || "لا يوجد وصف.")}</p>
      </div>

      <div class="flex justify-end gap-2">
        <button onclick="App.closeModal('taskDetailsModal'); App.openTaskModal('${this.escapeQuote(String(task.id))}')" class="btn-primary">تعديل المهمة</button>
      </div>
    `;

    this.openModal("taskDetailsModal");
  },

  deleteTask(id) {
    if (!confirm("حذف المهمة؟")) return;
    this.data.tasks = this.data.tasks.filter((task) => String(task.id) !== String(id));
    this.save();
    this.renderCurrentPage();
  },

  deleteClient(id) {
    if (!confirm("حذف العميل؟")) return;
    this.data.clients = this.data.clients.filter((client) => String(client.id) !== String(id));
    this.save();
    this.renderCurrentPage();
  },

  deleteNote(id) {
    if (!confirm("حذف الملاحظة؟")) return;
    this.data.notes = this.data.notes.filter((note) => String(note.id) !== String(id));
    this.save();
    this.renderCurrentPage();
  },

  deleteCategory(name) {
    if (this.data.categories.length <= 1) {
      alert("يجب ترك تصنيف واحد على الأقل");
      return;
    }
    this.data.categories = this.data.categories.filter((cat) => cat !== name);
    this.save();
    this.renderCurrentPage();
  },

  updateTaskField(id, field, value) {
    this.data.tasks = this.data.tasks.map((task) => {
      if (String(task.id) !== String(id)) return task;
      return { ...task, [field]: value };
    });
    this.save();
    this.renderCurrentPage();
  },

  taskTableRow(task, index) {
    const safeId = this.escapeQuote(String(task.id));
    const statusOptions = ["جديدة", "قيد التنفيذ", "بانتظار رد", "مؤجلة", "مكتملة", "متأخرة"];

    return `
      <tr onclick="if(!event.target.closest('button, select')) App.showTaskDetails('${safeId}')" class="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition cursor-pointer">
        <td class="px-4 py-4 text-sm font-black text-slate-400">${index + 1}</td>
        <td class="px-4 py-4">
          <div class="max-w-[360px]">
            <h3 class="font-black text-slate-900 dark:text-white line-clamp-2">${this.escape(task.title || "بدون عنوان")}</h3>
            <p class="text-xs text-slate-500 mt-1 line-clamp-2">${this.escape(task.desc || "لا يوجد وصف.")}</p>
            <p class="text-[11px] text-slate-400 mt-1">ID: ${this.escape(task.id)}</p>
          </div>
        </td>
        <td class="px-4 py-4"><span class="badge badge-slate">${this.escape(task.category || "بدون تصنيف")}</span></td>
        <td class="px-4 py-4"><span class="${this.badge(task.priority)}">${this.escape(task.priority || "متوسطة")}</span></td>
        <td class="px-4 py-4">
          <select onchange="App.updateTaskField('${safeId}', 'status', this.value)" class="px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#11263F] text-xs font-black outline-none border border-slate-200 dark:border-slate-700">
            ${statusOptions.map((item) => `<option ${task.status === item ? "selected" : ""}>${item}</option>`).join("")}
          </select>
        </td>
        <td class="px-4 py-4 text-sm text-slate-600 dark:text-slate-300">${this.escape(task.deadline || "بدون موعد")}</td>
        <td class="px-4 py-4">
          <span class="badge badge-slate">
            <i data-lucide="clock" class="w-3 h-3"></i>
            ${this.getDaysLeft(task.deadline)}
          </span>
        </td>
        <td class="px-4 py-4">
          <div class="flex items-center gap-2">
            <button onclick="App.openTaskModal('${safeId}')" class="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition" title="تعديل">
              <i data-lucide="pencil" class="w-4 h-4"></i>
            </button>
            <button onclick="App.deleteTask('${safeId}')" class="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 flex items-center justify-center hover:bg-rose-100 dark:hover:bg-rose-950/50 transition" title="حذف">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  },

  clientTableRow(client, index) {
    const safeId = this.escapeQuote(String(client.id));

    return `
      <tr class="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition">
        <td class="px-4 py-4 text-sm font-black text-slate-400">${index + 1}</td>
        <td class="px-4 py-4">
          <h3 class="font-black text-slate-900 dark:text-white">${this.escape(client.name || "بدون اسم")}</h3>
          <p class="text-[11px] text-slate-400 mt-1">ID: ${this.escape(client.id)}</p>
        </td>
        <td class="px-4 py-4 ltr text-right text-sm font-bold text-slate-600 dark:text-slate-300">${this.escape(client.phone || "-")}</td>
        <td class="px-4 py-4"><span class="badge badge-blue">${this.escape(client.type || "عميل")}</span></td>
        <td class="px-4 py-4 text-sm text-slate-600 dark:text-slate-300">${this.escape(client.date || "-")}</td>
        <td class="px-4 py-4 text-sm text-slate-500 dark:text-slate-400 max-w-[320px]">
          <p class="line-clamp-2">${this.escape(client.next || "-")}</p>
        </td>
        <td class="px-4 py-4">
          <div class="flex items-center gap-2">
            <button onclick="App.openClientModal('${safeId}')" class="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition" title="تعديل">
              <i data-lucide="pencil" class="w-4 h-4"></i>
            </button>
            <button onclick="App.deleteClient('${safeId}')" class="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 flex items-center justify-center hover:bg-rose-100 dark:hover:bg-rose-950/50 transition" title="حذف">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  },

  taskCard(task) {
    return `
      <div class="card p-5 hover:shadow-soft transition">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h3 class="font-black text-slate-900 dark:text-white leading-tight line-clamp-2">${this.escape(task.title)}</h3>
            <p class="text-xs text-slate-500 mt-1">#${task.id} • ${this.escape(task.category)}</p>
          </div>
          <div class="flex gap-1 shrink-0">
            <button onclick="App.openTaskModal('${this.escapeQuote(String(task.id))}')" class="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <i data-lucide="pencil" class="w-4 h-4"></i>
            </button>
            <button onclick="App.deleteTask('${this.escapeQuote(String(task.id))}')" class="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 flex items-center justify-center">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </div>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-3 line-clamp-3 leading-relaxed">${this.escape(task.desc || "لا يوجد وصف.")}</p>
        <div class="flex flex-wrap gap-2 mt-4">
          <span class="${this.badge(task.priority)}">${task.priority}</span>
          <span class="${this.badge(task.status)}">${task.status}</span>
          <span class="badge badge-slate"><i data-lucide="clock" class="w-3 h-3"></i>${this.getDaysLeft(task.deadline)}</span>
        </div>
      </div>
    `;
  },

  taskRow(task) {
    return `
      <div class="p-4 hover:bg-slate-50 dark:hover:bg-slate-900/30 transition border-b border-slate-100 dark:border-slate-800 last:border-0">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h4 class="font-black text-slate-900 dark:text-white">${this.escape(task.title)}</h4>
            <p class="text-xs text-slate-500 mt-1">${this.escape(task.category)} • ${this.getDaysLeft(task.deadline)}</p>
          </div>
          <span class="${this.badge(task.priority)}">${task.priority}</span>
        </div>
      </div>
    `;
  },

  clientCard(client) {
    return `
      <div class="card p-5 hover:shadow-soft transition">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h3 class="font-black text-slate-900 dark:text-white">${this.escape(client.name)}</h3>
            <a href="tel:${client.phone}" class="text-xs text-slate-500 flex items-center gap-1 mt-1 ltr">${this.escape(client.phone || "")}</a>
          </div>
          <button onclick="App.deleteClient('${this.escapeQuote(String(client.id))}')" class="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 flex items-center justify-center">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>
        <div class="mt-4"><span class="badge badge-blue">${this.escape(client.type || "عميل")}</span></div>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-3 leading-relaxed line-clamp-3">${this.escape(client.next || "")}</p>
      </div>
    `;
  },

  noteCard(note) {
    return `
      <div class="card p-5 min-h-[190px] flex flex-col">
        <div class="flex items-start justify-between">
          <div class="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/20 text-amber-600 flex items-center justify-center">
            <i data-lucide="sticky-note" class="w-5 h-5"></i>
          </div>
          <button onclick="App.deleteNote(${note.id})" class="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 flex items-center justify-center">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>
        <h3 class="font-black text-slate-900 dark:text-white mt-4">${this.escape(note.title)}</h3>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed flex-1">${this.escape(note.content)}</p>
        <p class="text-xs text-slate-400 mt-4">${note.date}</p>
      </div>
    `;
  },

  exportTasksCSV() {
    const rows = this.data.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      category: task.category,
      priority: task.priority,
      status: task.status,
      deadline: task.deadline,
      createdAt: task.createdAt,
      desc: task.desc
    }));

    this.downloadCSV("task-flow-tasks.csv", rows);
  },

  exportClientsCSV() {
    const rows = this.data.clients.map((client) => ({
      id: client.id,
      name: client.name,
      phone: client.phone,
      type: client.type,
      date: client.date,
      next: client.next
    }));

    this.downloadCSV("task-flow-clients.csv", rows);
  },

  downloadCSV(filename, rows) {
    if (!rows.length) {
      alert("لا توجد بيانات للتصدير");
      return;
    }

    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(","),
      ...rows.map((row) => headers.map((key) => this.csvCell(row[key])).join(","))
    ].join("\n");

    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
  },

  csvCell(value) {
    const text = String(value ?? "").replace(/"/g, '""');
    return `"${text}"`;
  },

  badge(value) {
    if (value === "عاجلة جدًا" || value === "متأخرة") return "badge badge-red";
    if (value === "عالية") return "badge badge-orange";
    if (value === "متوسطة") return "badge badge-blue";
    if (value === "مكتملة") return "badge badge-green";
    return "badge badge-slate";
  },

  getDaysLeft(deadline) {
    if (!deadline) return "بدون موعد";
    const diff = Math.ceil((new Date(deadline).getTime() - new Date(this.today()).getTime()) / 86400000);
    if (diff < 0) return "متأخرة";
    if (diff === 0) return "اليوم";
    return `${diff} يوم`;
  },

  setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  },

  empty(text) {
    return `
      <div class="card p-10 text-center">
        <div class="w-14 h-14 mx-auto rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
          <i data-lucide="inbox" class="w-6 h-6 text-slate-400"></i>
        </div>
        <p class="font-black text-slate-500">${text}</p>
      </div>
    `;
  },

  escape(value) {
    return String(value ?? "").replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[m]));
  },

  escapeQuote(value) {
    return String(value ?? "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  }
};

window.App = App;

document.addEventListener("DOMContentLoaded", () => App.init());
