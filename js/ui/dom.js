// Tiny DOM helper. Centralised here so the entry-point isn't littered with
// document.getElementById micro-helpers.
export const $ = (id) => document.getElementById(id);
