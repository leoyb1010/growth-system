<div align="center">

# LeoBMS

### Growth Department Management System

<p>
  <em>"Run growth data in one place. A weekly review lands ready to ship."</em><br />
  <em>「把业务数据放进一个系统，把每周复盘变成可交付。」</em>
</p>

<p>
  <a href="../README.md"><img alt="README: Chinese First" src="https://img.shields.io/badge/README-Chinese%20First-2563EB?labelColor=555&style=flat" /></a>
  <img alt="License: Personal Use Only" src="https://img.shields.io/badge/License-Personal%20Use%20Only-EF6C2F?labelColor=555&style=flat" />
  <img alt="Agent: Agnostic" src="https://img.shields.io/badge/Agent-Agnostic-7C3AED?labelColor=555&style=flat" />
  <img alt="Mobile: Ready" src="https://img.shields.io/badge/Mobile-Ready-16A34A?labelColor=555&style=flat" />
</p>

</div>

---

> English companion README. The primary project README remains Chinese: [Chinese README](../README.md).

**Languages**: [Chinese (default)](../README.md) | English

## Screenshots

<table>
  <tr>
    <td align="center"><b>Management Dashboard</b></td>
    <td align="center"><b>Weekly Management</b></td>
  </tr>
  <tr>
    <td><img src="screenshot-dashboard.png" alt="Management Dashboard" width="520" /></td>
    <td><img src="screenshot-week.png" alt="Weekly Management" width="520" /></td>
  </tr>
  <tr>
    <td align="center"><b>Project Tracking</b></td>
    <td align="center"><b>Weekly Report on Mobile</b></td>
  </tr>
  <tr>
    <td><img src="screenshot-projects.png" alt="Project Tracking" width="520" /></td>
    <td align="center"><img src="screenshot-weekly-mobile.png" alt="Weekly Report on Mobile" width="260" /></td>
  </tr>
</table>

## Overview

LeoBMS is a web-based operating system for a growth department. It brings quarterly KPIs, project progress, business performance, monthly tasks, quarterly achievements, AI assistance, and weekly reporting into one management workspace.

The system is designed around a weekly operating rhythm: teams update project progress once, dashboards and weekly views aggregate the work automatically, and the weekly report page turns the same source data into an editable review artifact.

## Tech Stack

- **Frontend**: React 18, Ant Design 5, ECharts, html-to-image
- **Backend**: Node.js, Express 4, Sequelize ORM
- **Database**: PostgreSQL 14+ or SQLite for local development
- **Auth**: JWT, bcrypt, token version validation
- **AI**: DeepSeek Chat plus rule-based risk and review engines
- **Deployment**: Docker Compose, local Mac service mode, or Cloudflare Tunnel

## Quick Start

### Docker

```bash
docker-compose up -d
docker-compose ps
```

Then open:

- Frontend: `http://localhost`
- Backend API: `http://localhost:3001`
- Health check: `http://localhost:3001/health`

### Local Development

```bash
cd backend && npm install
cd ../frontend && npm install
cd ../frontend && npm run build
cd ..
./start.sh
```

Open `http://localhost:3001`.

## Core Modules

- **Dashboard**: current-quarter KPI completion, risk alerts, stale-project reminders, and quick operating entry points.
- **Weekly Management**: weekly summary, today updates, risk projects, due-soon projects, and next-week focus.
- **Project Tracking**: the single source of truth for project status, progress, risks, next actions, and decision needs.
- **Weekly Reports**: generated review reports with editable conclusions, export support, and mobile-friendly report cards.
- **Business Modules**: KPIs, business performance, monthly work, quarterly achievements, CPS delivery, and ASO optimization.
- **System Management**: departments, users, audit logs, archive management, and role-based access.

## Mobile Support

The weekly report experience includes a dedicated mobile layout. Dense tables are converted into readable cards on phone-sized viewports, so long Chinese text no longer collapses into narrow one-character columns.

## Production Notes

- Do not use default passwords in production.
- Set a strong `JWT_SECRET`.
- Prefer PostgreSQL for production data.
- Keep exported reports and uploaded files behind authenticated routes.
- Use the health check endpoint before deployment handoff.
