# SkillSync – Backend ⚙️

This is the backend of **SkillSync**, an AI-powered resume analysis platform that identifies user skills, gaps, and generates personalized roadmaps using the Cohere API.

🌐 **Live API**: [https://skillsync-backend-xqs0.onrender.com]
🔗 **Frontend**: [https://skillsync-frontend-nhny.onrender.com]

---

## 🧠 What This Backend Does

- Accepts uploaded resume PDFs or LinkedIn URLs
- Uses **Cohere's Generate API** to analyze and extract:
  - Role, experience, and key skills
  - Missing skills and career roadmap
- Returns structured data for display in frontend dashboard

---

## ⚙️ Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **File Upload**: Multer
- **Middleware**: CORS, Body-parser
- **AI Integration**: Cohere API

---

## 📁 Project Structure

skillsync-backend-temp/
├── index.js
├── package.json
├── .env
├── routes/
│ └── analysis.js
├── middleware/
├── models/
└── ...

yaml
Copy
Edit

---

## 🚀 Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/ashutosh-2403/skillsync-backend.git
cd skillsync-backend-temp
