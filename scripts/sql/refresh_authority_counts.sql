-- CẬP NHẬT TỔNG HỢP CHO BẢNG authority_counts
-- - Đếm stamp theo issuing_authority
-- - Đếm FDC & Souvenir sheet dựa trên bảng con với khóa item_id
REPLACE INTO authority_counts (
  authority_id,
  stamp_count,
  fdc_count,
  souvenir_count
)
SELECT
  ia.id AS authority_id,
  /* Tổng số tem (issue -> stamp) */
  COUNT(DISTINCT s.id) AS stamp_count,
  /* Số FDC: nối bảng con bằng item_id */
  COUNT(
    DISTINCT CASE
      WHEN f.item_id IS NOT NULL THEN pi.id
    END
  ) AS fdc_count,
  /* Số Souvenir sheet: nối bảng con bằng item_id */
  COUNT(
    DISTINCT CASE
      WHEN sh.item_id IS NOT NULL THEN pi.id
    END
  ) AS souvenir_count
FROM
  issuing_authority AS ia
  LEFT JOIN issue AS i ON i.issuing_authority_id = ia.id
  LEFT JOIN stamp AS s ON s.issue_id = i.id
  /* Liên kết item phát hành -> issue */
  LEFT JOIN philatelic_item_issue AS pii ON pii.issue_id = i.id
  /* Bảng mẹ item: LƯU Ý dùng pii.item_id (không phải philatelic_item_id) */
  LEFT JOIN philatelic_item AS pi ON pi.id = pii.item_id
  /* Bảng con: đều dùng item_id theo schema thật */
  LEFT JOIN philatelic_item_fdc AS f ON f.item_id = pi.id
  LEFT JOIN philatelic_item_sheet AS sh ON sh.item_id = pi.id
GROUP BY
  ia.id;