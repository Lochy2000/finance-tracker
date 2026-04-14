import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount, currency = 'GBP') {
  const localeMap = { GBP: 'en-GB', USD: 'en-US', EUR: 'de-DE' };
  const locale = localeMap[currency] || 'en-GB';
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
}

export function formatDate(dateString, format = 'short') {
  const date = new Date(dateString);
  if (format === 'short') {
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  if (format === 'long') {
    return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
  return date.toISOString().split('T')[0];
}

export function formatApiErrorDetail(detail) {
  if (detail == null) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e?.msg ? e.msg : JSON.stringify(e))).filter(Boolean).join(" ");
  if (detail?.msg) return detail.msg;
  return String(detail);
}

export function getCategoryColor(category) {
  const colors = {
    'Groceries': '#6A7A62', 'Transport': '#4A90A4', 'Dining': '#C86A58',
    'Shopping': '#9B59B6', 'Entertainment': '#E74C3C', 'Bills': '#3498DB',
    'Health': '#1ABC9C', 'Subscriptions': '#F39C12', 'Travel': '#8E44AD',
    'Income': '#27AE60', 'Other': '#95A5A6',
  };
  return colors[category] || '#68736E';
}

export function getMonthName(month) {
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return months[month - 1] || '';
}
