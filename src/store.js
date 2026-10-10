export const load = (key, fallback) => {
  try {
    const v = typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
    return v == null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
};

export const save = (key, value) => {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage may be unavailable (private mode); progress simply won't persist */
  }
};
