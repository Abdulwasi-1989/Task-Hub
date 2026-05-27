const STORAGE_KEY = "task-flow-data-v1";

const TaskFlowStorage = {
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

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return this.defaultData();

      const parsed = JSON.parse(raw);
      return {
        categories: parsed.categories || this.defaultData().categories,
        tasks: parsed.tasks || [],
        clients: parsed.clients || [],
        notes: parsed.notes || []
      };
    } catch (error) {
      console.error("Storage load error:", error);
      return this.defaultData();
    }
  },

  save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },

  reset() {
    const data = this.defaultData();
    this.save(data);
    return data;
  },

  clear() {
    const data = {
      categories: this.defaultData().categories,
      tasks: [],
      clients: [],
      notes: []
    };
    this.save(data);
    return data;
  }
};
