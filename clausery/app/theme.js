// Applies the saved theme before first paint to avoid a flash of the wrong colours.
try { var t = localStorage.getItem('clausery.theme'); if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; } catch (e) { /* storage unavailable */ }
