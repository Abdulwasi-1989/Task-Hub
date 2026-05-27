/**
 * Task Flow Google Drive Storage
 * --------------------------------
 * IMPORTANT:
 * 1) Go to Google Cloud Console.
 * 2) Create OAuth Client ID type: Web application.
 * 3) Add your local origin, for example:
 *    http://127.0.0.1:5500
 *    http://localhost:5500
 * 4) Paste your Client ID below.
 */

const GOOGLE_DRIVE_CLIENT_ID = "753309074197-183qlapkfmpsfbv795ktujfjkr4nbanl.apps.googleusercontent.com";
const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const DRIVE_FILE_NAME = "taskflow_data.json";
const LOCAL_STORAGE_KEY = "task-flow-data-v1";
const TOKEN_STORAGE_KEY = "task-flow-google-access-token";

const TaskFlowStorage = {
  accessToken: sessionStorage.getItem(TOKEN_STORAGE_KEY) || "",
  fileId: "",
  tokenClient: null,
  data: null,

  today() {
    return new Date().toISOString().slice(0, 10);
  },

  defaultData() {
    const today = this.today();

    return {
      categories: ["عمل", "عملاء", "تمويل", "تسويق", "إيميلات", "اتصالات", "مستندات", "شخصي"],
      tasks: [
        {
          id: 1001,
          title: "متابعة مستندات عميل تمويل",
          category: "مستندات",
          priority: "عاجلة جدًا",
          status: "بانتظار رد",
          deadline: today,
          createdAt: today,
          desc: "ناقص تقرير سمة وكشف حساب آخر 3 أشهر وخطاب تعريف بالراتب."
        },
        {
          id: 1002,
          title: "تجهيز رد رسمي لإيميل شريك",
          category: "إيميلات",
          priority: "عالية",
          status: "قيد التنفيذ",
          deadline: "",
          createdAt: today,
          desc: "صياغة رد مختصر واحترافي مع توضيح الخدمات المطلوبة وآلية التعاون."
        }
      ],
      clients: [
        {
          id: 1,
          name: "عميل تمويل شخصي",
          phone: "0512345678",
          type: "تمويل شخصي",
          date: today,
          next: "انتظار إرسال المستندات ثم رفع الطلب."
        }
      ],
      notes: [
        {
          id: 1,
          title: "فكرة تطوير",
          content: "إضافة تنبيه للمهام المتأخرة وربطها لاحقًا بتليجرام.",
          date: today
        }
      ]
    };
  },

  normalize(data) {
    const fallback = this.defaultData();

    return {
      categories: Array.isArray(data?.categories) ? data.categories : fallback.categories,
      tasks: Array.isArray(data?.tasks) ? data.tasks : [],
      clients: Array.isArray(data?.clients) ? data.clients : [],
      notes: Array.isArray(data?.notes) ? data.notes : []
    };
  },

  loadLocal() {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      return raw ? this.normalize(JSON.parse(raw)) : this.defaultData();
    } catch (error) {
      console.error("Local storage load error:", error);
      return this.defaultData();
    }
  },

  saveLocal(data) {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(this.normalize(data)));
  },

  async init() {
    this.data = this.loadLocal();
    this.updateDriveUI(false);

    // If token still exists in current browser session, try to load Drive data.
    if (this.accessToken) {
      try {
        await this.loadFromDrive();
        this.updateDriveUI(true);
      } catch (error) {
        console.warn("Could not restore Google Drive session:", error);
        this.accessToken = "";
        sessionStorage.removeItem(TOKEN_STORAGE_KEY);
        this.updateDriveUI(false);
      }
    }

    return this.data;
  },

  isConfigured() {
    return GOOGLE_DRIVE_CLIENT_ID && !GOOGLE_DRIVE_CLIENT_ID.includes("PASTE_YOUR");
  },

  async signIn() {
    if (!this.isConfigured()) {
      alert("لازم تضيف Google OAuth Client ID داخل ملف data/drive-storage.js أولاً.");
      return this.data;
    }

    await this.waitForGoogleIdentity();

    return new Promise((resolve, reject) => {
      this.tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_DRIVE_CLIENT_ID,
        scope: GOOGLE_DRIVE_SCOPE,
        prompt: "",
        callback: async (response) => {
          if (response.error) {
            reject(response);
            return;
          }

          this.accessToken = response.access_token;
          sessionStorage.setItem(TOKEN_STORAGE_KEY, this.accessToken);

          try {
            await this.loadFromDrive();
            this.updateDriveUI(true);
            resolve(this.data);
          } catch (error) {
            reject(error);
          }
        }
      });

      this.tokenClient.requestAccessToken();
    });
  },

  signOut() {
    this.accessToken = "";
    this.fileId = "";
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    this.updateDriveUI(false);
  },

  waitForGoogleIdentity() {
    return new Promise((resolve, reject) => {
      let tries = 0;
      const timer = setInterval(() => {
        tries += 1;

        if (window.google?.accounts?.oauth2) {
          clearInterval(timer);
          resolve();
          return;
        }

        if (tries > 50) {
          clearInterval(timer);
          reject(new Error("Google Identity Services failed to load."));
        }
      }, 100);
    });
  },

  async request(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        ...(options.headers || {})
      }
    });

    if (!res.ok) {
      const text = await res.text();

      if (res.status === 401) {
        this.signOut();
        throw new Error("انتهت صلاحية تسجيل الدخول. سجّل دخول Google Drive مرة ثانية.");
      }

      throw new Error(`Google Drive Error ${res.status}: ${text}`);
    }

    return res;
  },

  async findFile() {
    const query = encodeURIComponent(`name='${DRIVE_FILE_NAME}' and trashed=false`);
    const fields = encodeURIComponent("files(id,name,modifiedTime)");
    const url = `https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive&fields=${fields}`;

    const res = await this.request(url);
    const json = await res.json();

    const file = json.files?.[0] || null;
    this.fileId = file?.id || "";

    return this.fileId;
  },

  async createFile(initialData) {
    const boundary = "taskflow_boundary_" + Date.now();

    const metadata = {
      name: DRIVE_FILE_NAME,
      mimeType: "application/json"
    };

    const body =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(initialData, null, 2)}\r\n` +
      `--${boundary}--`;

    const res = await this.request("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
      method: "POST",
      headers: {
        "Content-Type": `multipart/related; boundary=${boundary}`
      },
      body
    });

    const json = await res.json();
    this.fileId = json.id;

    return this.fileId;
  },

  async downloadFile() {
    if (!this.fileId) throw new Error("Drive file ID not found.");

    const res = await this.request(`https://www.googleapis.com/drive/v3/files/${this.fileId}?alt=media`);
    const json = await res.json();

    return this.normalize(json);
  },

  async uploadFile(data) {
    if (!this.fileId) {
      await this.findFile();
    }

    if (!this.fileId) {
      await this.createFile(this.normalize(data));
      return;
    }

    await this.request(`https://www.googleapis.com/upload/drive/v3/files/${this.fileId}?uploadType=media`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json; charset=UTF-8"
      },
      body: JSON.stringify(this.normalize(data), null, 2)
    });
  },

  async loadFromDrive() {
    if (!this.accessToken) return this.data;

    let fileId = await this.findFile();

    if (!fileId) {
      const localData = this.loadLocal();
      await this.createFile(localData);
      this.data = localData;
      this.saveLocal(this.data);
      return this.data;
    }

    this.data = await this.downloadFile();
    this.saveLocal(this.data);

    return this.data;
  },

  async save(data) {
    this.data = this.normalize(data);
    this.saveLocal(this.data);

    if (!this.accessToken) {
      this.updateDriveUI(false);
      return;
    }

    await this.uploadFile(this.data);
    this.updateDriveUI(true, "تم الحفظ في Google Drive");
  },

  reset() {
    this.data = this.defaultData();
    this.save(this.data);
    return this.data;
  },

  clear() {
    this.data = {
      categories: this.defaultData().categories,
      tasks: [],
      clients: [],
      notes: []
    };
    this.save(this.data);
    return this.data;
  },

  updateDriveUI(isConnected, message = "") {
    const loginBtn = document.getElementById("driveLoginBtn");
    const logoutBtn = document.getElementById("driveLogoutBtn");
    const sidebarStatus = document.getElementById("driveSidebarStatus");

    if (loginBtn) loginBtn.classList.toggle("hidden", isConnected);
    if (logoutBtn) logoutBtn.classList.toggle("hidden", !isConnected);
    if (logoutBtn) logoutBtn.classList.toggle("flex", isConnected);

    if (sidebarStatus) {
      sidebarStatus.textContent = isConnected
        ? (message || "متصل بـ Google Drive ويتم الحفظ تلقائيًا.")
        : "سجّل دخول Google Drive لتفعيل الحفظ السحابي التلقائي.";
    }
  }
};
