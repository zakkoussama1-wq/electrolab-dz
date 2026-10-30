import { useMemo, useState } from "react";
import progressMarkdown from "../COURSE_PROGRESS.md?raw";
import { parseProgress, progressStatuses } from "./courseProgress";
export function CourseProgressPage() {
  const data = useMemo(() => parseProgress(progressMarkdown), []);
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState("all");
  const visible = data.items.filter(
    (r) =>
      (status === "all" || r.status === status) &&
      `${r.id} ${r.name} ${r.source} ${r.laws} ${r.gap}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const main = data.items.filter((r) => /^S-\d{2}$/.test(r.id)).length,
    additional = data.items.filter((r) => /^A-\d{2}$/.test(r.id)).length,
    named = data.items.filter((r) => /^C[24]-(EX|PR)-\d{2}$/.test(r.id)).length,
    passed = data.items.filter((r) => r.status === "اجتاز الاختبارات").length;
  return (
    <section className="course-page">
      <div className="eyebrow">مرجع المقرر · المرحلة الأولى</div>
      <h1>حالة تطوير المختبر</h1>
      <p>لوحة المطور: توثيق التغطية والاختبارات والنواقص. للشرح العلمي والتجارب التعليمية افتح «الدروس والتجارب».</p>
      <p>
        الحالات مأخوذة مباشرة من COURSE_PROGRESS.md. نجاح الاختبارات العامة لا
        يعني أن دارة تمرين من PDF أصبحت مدعومة. الصفوف التفصيلية لا تُحسب تمارين
        أصلية جديدة.
      </p>
      {data.errors.length > 0 && (
        <p className="message error" role="alert">
          تعذر اعتماد بيانات المتابعة: {data.errors.join("، ")}
        </p>
      )}
      <details className="status-guide"><summary>معنى حالات المتابعة</summary><dl><dt>غير منفذ</dt><dd>لم تُنشأ الوظيفة التعليمية بعد.</dd><dt>قيد التطوير</dt><dd>يجري بناء المحاكاة أو الشرح أو التفاعل، ولم يعتمد النشاط بعد.</dd><dt>يحتاج اختبار</dt><dd>توجد إمكانية أولية، لكن مطابقة الدارة والنتائج والشرح والتفاعل لم تكتمل.</dd><dt>اجتاز الاختبارات</dt><dd>نجحت اختبارات الدارة والحسابات والمعادلات والشرح والتفاعل للنشاط المحدد. لا تعني اكتمال كل موضوع أو كل المقرر.</dd><dt>غير مدعوم</dt><dd>تحتاج الدارة قدرة لا يوفّرها المحرك حاليًا؛ السبب موثق لكل نشاط.</dd></dl></details>
      <div className="course-counts">
        {[
          [main, "تمرينًا رئيسيًا بالسلسلة"],
          [additional, "تمارين إضافية"],
          [named, "مثالًا ومسألة بالمحاضرة"],
          [passed, "سجلات اجتازت اختبارات النشاط"],
        ].map(([v, label]) => (
          <div key={label}>
            <strong>{v}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <p className="message">
        المرفقان: Chapter 1.pdf (49 صفحة) وSeries 1.pdf (4 صفحات). لا RC أو RL
        أو RLC في هذين الملفين؛ الوظائف القديمة لا تُنسب إلى المقرر.
      </p>
      <h2>الوحدات الموجودة فعلًا في المرفقات</h2>
      <div className="course-topic-grid">
        {data.topics.map((t) => (
          <article key={t.id}>
            <h3>{t.name}</h3>
            <small>
              {t.source} · ص {t.pages}
            </small>
            <p>{t.coverage}</p>
            <span className="course-status">{t.status}</span>
          </article>
        ))}
      </div>
      <h2>جميع سجلات التمارين والأمثلة والأنشطة</h2>
      <div className="course-filters">
        <label>
          بحث
          <input
            aria-label="بحث في تقدم المقرر"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Exercise 7 أو Kennelly أو مصدر تيار"
          />
        </label>
        <label>
          الحالة
          <select
            aria-label="تصفية حالات التقدم"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">كل الحالات</option>
            {progressStatuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <span>
          {visible.length} من {data.items.length} سجل متابعة
        </span>
      </div>
      <div className="table-scroll">
        <table className="course-table">
          <thead>
            <tr>
              <th>النشاط</th>
              <th>مرجع المصدر</th>
              <th>القوانين</th>
              <th>الحالة</th>
              <th>اختبارات النشاط</th>
              <th>النقص أو المراجعة</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id}>
                <td>
                  <strong dir="ltr">{r.id}</strong>
                  <span>{r.name}</span>
                </td>
                <td>
                  {r.source}
                  <br />
                  PDF ص {r.pages}
                  <br />
                  مطبوعة {r.printed}
                  <br />
                  {r.figure}
                </td>
                <td>{r.laws}</td>
                <td>
                  <span className="course-status">{r.status}</span>
                </td>
                <td>{r.tests}</td>
                <td>{r.gap}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted">
        نجاح نشاط واحد لا يثبت اكتمال كل الوحدة. راجع دليل كل نشاط، بما فيه صحة الشرح والتفاعل، قبل تغيير حالته.
      </p>
    </section>
  );
}
export function AboutPage() {
  return (
    <section className="course-page about-page">
      <div className="eyebrow">About ElectroLab DZ</div>
      <h1>حول المختبر</h1>
      <div className="about-card">
        <span className="about-monogram">EL</span>
        <h2>ElectroLab DZ</h2>
        <p className="creator-title">
          المؤسس والمنشئ والمطور: <b dir="ltr">Oussama Azzouz</b>
        </p>
        <p>
          تطوير مختبر كهربائي افتراضي تفاعلي يساعد طلبة الهندسة والإلكتروميكانيك
          على فهم الدوائر الكهربائية والقوانين والتجارب من خلال المحاكاة
          والتعليم خطوة بخطوة.
        </p>
        <p dir="ltr" className="creator-credit">
          Created &amp; Developed by Oussama Azzouz
        </p>
        <p>
          تصميم وتطوير: <b dir="ltr">Oussama Azzouz</b>
        </p>
      </div>
      <p className="message">
        نطاق المقرر المعتمد هو الملفات الدراسية المرفقة فقط. صفحة التقدم تميّز
        الأنشطة غير المنفذة وغير المختبرة؛ لا تعلن اكتمال تغطية المقرر.
      </p>
    </section>
  );
}
export function CreatorFooter() {
  return (
    <footer className="creator-footer">
      <div>
        <strong>ElectroLab DZ</strong>
        <span>مختبر كهربائي تعليمي تفاعلي</span>
      </div>
      <div className="creator-lines">
        <span dir="ltr">
          Created &amp; Developed by <b>Oussama Azzouz</b>
        </span>
        <span>
          تصميم وتطوير: <b dir="ltr">Oussama Azzouz</b>
        </span>
      </div>
    </footer>
  );
}
