// Group stamps theo Issue/Series trên FE
// - stamps: mảng từ API /api/stamps/country/:slug/:year
// - Mọi nơi chỉ tính trên tem gốc (API đã lọc)
import dayjs from 'dayjs';

export const is_single_issue = (issue_type, series_slug, series_name) => {
  // Ưu tiên cờ từ DB
  if (issue_type === 'single_series') return true;
  // Fallback cũ (phòng khi data chưa migrate hết)
  const slug_ok = typeof series_slug === 'string' && series_slug.startsWith('single-issues-');
  const name_ok = typeof series_name === 'string' && series_name.toLowerCase() === 'single issues';
  return slug_ok || name_ok;
};

export const issue_header_date = (stamps, issue_release_date, issue_release_date_type) => {
  const dates = (stamps || []).map(s => s?.release_date).filter(Boolean)
    .sort((a, b) => String(a).localeCompare(String(b)));
  const first = dates[0];
  if (first) return format_date_label(first, 'exact');
  if (issue_release_date) return format_date_label(issue_release_date, issue_release_date_type || 'year');
  return null;
};

export const subgroup_by_month = (stamps) => {
  const m = new Map();
  for (const s of stamps) {
    const lbl = s?.release_date ? dayjs(s.release_date).format('MMM YYYY') : 'Unknown';
    if (!m.has(lbl)) m.set(lbl, []);
    m.get(lbl).push(s);
  }
  return Array.from(m.entries())
    .sort((a, b) => a[0] > b[0] ? 1 : -1)
    .map(([label, arr]) => ({ label, stamps: arr }));
};

export const format_date_label = (d, t) => {
  if (!d) return 'Unknown date';
  const iso = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
  if (t === 'year') return iso ? d.slice(0, 4) : dayjs(d).format('YYYY');
  if (t === 'month') return dayjs(d).format('MMM YYYY');
  return iso ? d : dayjs(d).format('YYYY-MM-DD');
};

export const group_by_issue = (stamps) => {
  const map = new Map();
  for (const s of stamps) {
    const key = s.issue_id || 'unknown';
    if (!map.has(key)) {
      map.set(key, {
        issue_id: s.issue_id || null,
        issue_name: s.issue_name || 'Untitled Issue',
        issue_slug: s.issue_slug || null,

        issue_release_date: s.issue_release_date || null,
        issue_release_date_type: s.issue_release_date_type || 'year',
        issue_type: s.issue_type || 'standard',           // ✅ mang theo

        series_id: s.series_id || null,
        series_slug: s.series_slug || null,
        series_name: s.series_name || null,

        stamps: [],
      });
    }
    map.get(key).stamps.push(s);
  }
  return Array.from(map.values()).sort((a, b) =>
    (a.issue_name || '').localeCompare(b.issue_name || '')
  );
};

export const group_by_series_then_issue = (stamps) => {
  const s_map = new Map();
  for (const s of stamps) {
    const skey = s.series_id || 'unknown';
    if (!s_map.has(skey)) {
      s_map.set(skey, {
        series_id: s.series_id || null,
        series_slug: s.series_slug || null,
        series_name: s.series_name || 'Untitled Series',
        issues: new Map(),
      });
    }
    const series = s_map.get(skey);
    const ikey = s.issue_id || 'unknown';
    if (!series.issues.has(ikey)) {
      series.issues.set(ikey, {
        issue_id: s.issue_id || null,
        issue_name: s.issue_name || 'Untitled Issue',
        issue_slug: s.issue_slug || null,
        issue_release_date: s.issue_release_date || null,
        issue_release_date_type: s.issue_release_date_type || 'year',
        issue_type: s.issue_type || 'standard',           // ✅ mang theo
        stamps: [],
      });
    }
    series.issues.get(ikey).stamps.push(s);
  }
  const series_arr = Array.from(s_map.values()).sort((a, b) =>
    (a.series_name || '').localeCompare(b.series_name || '')
  );
  return series_arr.map(se => ({
    series_id: se.series_id,
    series_slug: se.series_slug,
    series_name: se.series_name,
    issues: Array.from(se.issues.values()).sort((a, b) =>
      (a.issue_name || '').localeCompare(b.issue_name || '')
    ),
  }));
};

// Sub-group trong 1 issue theo date label (YYYY-MM-DD | MMM YYYY | YYYY | Unknown)
export const subgroup_by_date_label = (stamps) => {
  const m = new Map();
  for (const s of stamps) {
    const lbl = format_date_label(s.release_date, s.release_date_type);
    if (!m.has(lbl)) m.set(lbl, []);
    m.get(lbl).push(s);
  }
  const groups = Array.from(m.entries()).map(([label, arr]) => ({ label, stamps: arr }));
  return groups.length <= 1 ? [] : groups;
};