import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import ContactsPage from './pages/ContactsPage';
import SendPage from './pages/SendPage';
import CampaignsPage from './pages/CampaignsPage';

const navClass = ({ isActive }) =>
  `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
    isActive
      ? 'bg-green-600 text-white'
      : 'text-gray-400 hover:text-white hover:bg-gray-700'
  }`;

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-950 text-white">
        <div className="fixed left-0 top-0 h-full w-56 bg-gray-900 border-r border-gray-800 flex flex-col p-4">
          <div className="mb-8 mt-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center text-white font-bold">
                W
              </div>
              <span className="font-semibold text-white">WA Sender</span>
            </div>
          </div>
          <nav className="flex flex-col gap-1">
            <NavLink to="/" className={navClass} end>Contacts</NavLink>
            <NavLink to="/send" className={navClass}>Bulk Send</NavLink>
            <NavLink to="/campaigns" className={navClass}>Campaigns</NavLink>
          </nav>
        </div>

        <div className="ml-56 p-8">
          <Routes>
            <Route path="/" element={<ContactsPage />} />
            <Route path="/send" element={<SendPage />} />
            <Route path="/campaigns" element={<CampaignsPage />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}