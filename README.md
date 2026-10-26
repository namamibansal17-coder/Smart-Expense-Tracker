# Smart Expense Tracker

A personal finance website with a landing page and a tracker app. Record income and expenses, categorise them, set monthly budgets and review your spending through summaries and tables.

## Pages
- `index.html`: landing page (hero, features, how it works, budgets, FAQ)
- `app.html`: the tracker app (Dashboard, Transactions, Budgets, Reports, Settings)

## Features
- Add, edit and delete income and expense transactions
- Default and custom categories
- Monthly budget per category with status labels: On track, Near limit (80%), Over budget (100%)
- Dashboard with balance, income, expenses, savings rate and spending by category
- Reports with a 12-month summary table, biggest expenses and income sources
- Search and filter by text, type, category and month
- Currency choice (INR, USD, EUR, GBP)
- Light and dark theme (follows your system, with a toggle)
- Copy all data as CSV for backup
- Works on phone, tablet and desktop

## Tech stack
Plain HTML, CSS and JavaScript. No build step and no libraries. Fonts come from Google Fonts, so use an internet connection the first time.

## Run it in VS Code
1. Put all the files in one folder, for example `smart-expense-tracker`.
2. Open the folder in VS Code (File > Open Folder).
3. Install the **Live Server** extension.
4. Right-click `index.html` and choose **Open with Live Server**.

## Files
```
index.html   landing page
app.html     tracker app
base.css     colour tokens, buttons, forms, light/dark theme
site.css     landing page styles
app.css      tracker app styles
common.js    theme toggle and mobile menu (used by both pages)
app.js       data, calculations and rendering for the tracker
```

## How data is stored
Everything is saved in your browser under the key `smart-expense-tracker-v2` in `localStorage`. The first visit loads example data, which you can remove from the banner or Settings.

## Ideas for next steps
- Node.js and Express backend with a database (SQLite or MongoDB)
- User login with JWT and bcrypt
- Recurring transactions
- Downloadable CSV or PDF reports
