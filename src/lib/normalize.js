export const normalize_query = (q) => {
  return (q || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // bỏ dấu tiếng Việt
    .replace(/\s+/g, " ")            // gom nhiều space thành 1
    .trim();
};
