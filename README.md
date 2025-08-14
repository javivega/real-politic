<<<<<<< HEAD
# Real Politic

A comprehensive political data analysis and visualization platform that processes legislative data from Spanish Congress and Senate, providing insights into political trends and legislative activities.

## 🚀 Features

- **Legislative Data Processing**: Automated processing of XML data from Spanish Congress and Senate
- **Real-time Data Analysis**: Live analysis of legislative initiatives, proposals, and reforms
- **Interactive Dashboard**: Modern React-based UI with Tailwind CSS
- **Supabase Backend**: Robust database backend with real-time capabilities
- **Data Visualization**: Comprehensive charts and analytics for political insights

## 🏗️ Architecture

### Frontend
- **React 18** with TypeScript
- **Tailwind CSS** for modern, responsive design
- **Context API** for state management
- **Component-based architecture** for maintainability

### Backend
- **Node.js** with TypeScript
- **Knex.js** for database operations
- **Supabase** for database and authentication
- **XML processing** for legislative data ingestion

### Database
- **PostgreSQL** via Supabase
- **Real-time subscriptions**
- **Row Level Security (RLS)** for data protection

## 📁 Project Structure

```
real-politic/
├── src/                    # Frontend React application
│   ├── components/         # React components
│   ├── context/           # React context providers
│   └── index.tsx          # Main entry point
├── backend/               # Backend Node.js application
│   ├── laws/             # Legislative data processing
│   │   ├── congress/     # Congress data handling
│   │   └── senat/        # Senate data handling
│   ├── src/              # Backend source code
│   └── supabase/         # Database migrations
├── public/                # Static assets
└── package.json           # Project dependencies
```

## 🛠️ Installation

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Git

### Setup

1. **Clone the repository**
   ```bash
   git clone <your-github-repo-url>
   cd real-politic
   ```

2. **Install dependencies**
   ```bash
   # Install frontend dependencies
   npm install
   
   # Install backend dependencies
   cd backend
   npm install
   cd ..
   ```

3. **Environment Setup**
   - Copy `.env.example` to `.env` (if available)
   - Configure your Supabase credentials
   - Set up database connection

4. **Database Setup**
   ```bash
   cd backend
   npm run migrate
   npm run seed
   ```

5. **Start Development Servers**
   ```bash
   # Frontend (in one terminal)
   npm start
   
   # Backend (in another terminal)
   cd backend
   npm run dev
   ```

## 🔧 Configuration

### Supabase Setup
1. Create a new Supabase project
2. Configure environment variables
3. Run database migrations
4. Set up authentication providers

### Legislative Data Sources
- **Congress**: XML feeds from Spanish Congress
- **Senate**: XML feeds from Spanish Senate
- **Update Frequency**: Configurable via cron jobs

## 📊 Data Processing

The platform processes various types of legislative data:

- **Iniciativas Legislativas**: Legislative initiatives
- **Proposiciones de Ley**: Law proposals
- **Propuestas de Reforma**: Reform proposals
- **Proyectos de Ley**: Law projects

## 🚀 Deployment

### Frontend
- Build the production bundle: `npm run build`
- Deploy to your preferred hosting service (Vercel, Netlify, etc.)

### Backend
- Deploy to your preferred Node.js hosting service
- Configure environment variables
- Set up database connections

### Database
- Use Supabase production instance
- Configure backups and monitoring

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Spanish Congress and Senate for providing legislative data
- Supabase team for the excellent backend platform
- React and Tailwind CSS communities for the amazing tools

## 📞 Support

For support and questions:
- Open an issue on GitHub
- Contact the development team
- Check the documentation

---

**Real Politic** - Making political data accessible and understandable for everyone. 
=======
# real-politic
>>>>>>> 6744995f3f206e9dcfab0c712d233f0383b34a5a
