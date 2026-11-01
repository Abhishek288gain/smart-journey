import { useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  Activity, Bell, Bookmark, CalendarDays, Home, LogOut, Sun, Moon,
  MapPin, Menu, ScanLine, Search, Ticket, User, X, Sparkles, Route,
} from "lucide-react";
import TrainLiveModal from "./TrainLiveModal";
import PnrCheckModal from "./PnrCheckModal";
import BusLiveTrackModal from "./BusLiveTrackModal";
import OtpLoginModal from "./OtpLoginModal";
import { useThemeMode } from "../context/ThemeModeContext";

const linkClass = ({ isActive }) => `sj-task-link${isActive ? " active" : ""}`;

function TaskGroup({ label, children }) {
  return <div className="sj-task-group"><span className="sj-task-label">{label}</span><div className="sj-task-items">{children}</div></div>;
}

function ToolButton({ icon: Icon, children, onClick }) {
  return <button type="button" className="sj-task-link sj-task-button" onClick={onClick}><Icon size={15} /><span>{children}</span></button>;
}

export default function Navbar() {
  const { currentUser, logout } = useAuth();
  const [trainModalOpen, setTrainModalOpen] = useState(false);
  const [pnrModalOpen, setPnrModalOpen] = useState(false);
  const [busTrackModalOpen, setBusTrackModalOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { mode, toggleMode } = useThemeMode();

  return <>
    <header className="sj-header">
      <div className="sj-header-main">
        <Link to="/" className="sj-brand" aria-label="Smart Journey home">
          <span className="sj-brand-mark">SJ</span>
          <span className="sj-brand-copy"><strong>Smart<span>Journey</span></strong><small>TRAVEL, ORGANIZED</small></span>
        </Link>
        <div className="sj-header-note"><span className="sj-status-dot" />Plan, compare and book in one place</div>
        <div className="sj-account-area">
          <button type="button" className="sj-theme-toggle" onClick={toggleMode} aria-label={`Switch to ${mode === "dark" ? "light" : "dark"} theme`} title={`Switch to ${mode === "dark" ? "light" : "dark"} theme`}>
            {mode === "dark" ? <Sun size={17} /> : <Moon size={17} />}<span>{mode === "dark" ? "Light" : "Dark"}</span>
          </button>
          {currentUser ? <div className="sj-account-wrap">
            <button className="sj-account-button" onClick={() => setUserDropdownOpen((value) => !value)} aria-expanded={userDropdownOpen}>
              <span className="sj-avatar">{currentUser.fullName?.[0] || "U"}</span>
              <span className="sj-account-copy"><strong>{currentUser.fullName || "Traveler"}</strong><small>My account</small></span>
              <span className="sj-account-chevron">⌄</span>
            </button>
            {userDropdownOpen && <div className="sj-account-menu">
              <Link to="/bookings" onClick={() => setUserDropdownOpen(false)}><Ticket size={15} />Bookings & tickets</Link>
              <Link to="/trips" onClick={() => setUserDropdownOpen(false)}><Bookmark size={15} />Saved journeys</Link>
              <Link to="/alerts" onClick={() => setUserDropdownOpen(false)}><Bell size={15} />Price alerts</Link>
              <button onClick={() => { logout(); setUserDropdownOpen(false); }}><LogOut size={15} />Sign out</button>
            </div>}
          </div> : <button className="sj-login-button" onClick={() => setLoginModalOpen(true)}><User size={15} />Sign in</button>}
          <button className="sj-mobile-toggle" onClick={() => setMobileMenuOpen((value) => !value)} aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"}>{mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}</button>
        </div>
      </div>

      <div className={`sj-taskbar-wrap${mobileMenuOpen ? " mobile-open" : ""}`}>
        <nav className="sj-taskbars" aria-label="Main navigation">
          <TaskGroup label="PLAN">
            <NavLink to="/" end className={linkClass} onClick={() => setMobileMenuOpen(false)}><Home size={15} /><span>Explore</span></NavLink>
            <NavLink to="/search" className={({ isActive }) => `sj-task-link${isActive && location.pathname === "/search" ? " active" : ""}`} onClick={() => setMobileMenuOpen(false)}><Search size={15} /><span>Find journeys</span></NavLink>
            <Link to="/#planner" className="sj-task-link" onClick={() => setMobileMenuOpen(false)}><Route size={15} /><span>Plan a trip</span></Link>
            <Link to="/#assistant" className="sj-task-link" onClick={() => setMobileMenuOpen(false)}><Sparkles size={15} /><span>Trip assistant</span></Link>
          </TaskGroup>
          <span className="sj-task-divider" />
          <TaskGroup label="MY JOURNEYS">
            <NavLink to="/trips" className={linkClass} onClick={() => setMobileMenuOpen(false)}><Bookmark size={15} /><span>Saved trips</span></NavLink>
            <NavLink to="/bookings" className={linkClass} onClick={() => setMobileMenuOpen(false)}><CalendarDays size={15} /><span>Bookings</span></NavLink>
          </TaskGroup>
          <span className="sj-task-divider" />
          <TaskGroup label="MANAGE">
            <NavLink to="/alerts" className={linkClass} onClick={() => setMobileMenuOpen(false)}><Bell size={15} /><span>Price alerts</span></NavLink>
            <NavLink to="/notification" className={linkClass} onClick={() => setMobileMenuOpen(false)}><Activity size={15} /><span>Updates</span></NavLink>
          </TaskGroup>
        </nav>
        <nav className="sj-taskbars sj-tools-taskbar" aria-label="Travel tools">
          <TaskGroup label="TRAVEL TOOLS">
            <ToolButton icon={Activity} onClick={() => setTrainModalOpen(true)}>Train status</ToolButton>
            <ToolButton icon={Ticket} onClick={() => setPnrModalOpen(true)}>Booking reference</ToolButton>
            <ToolButton icon={MapPin} onClick={() => setBusTrackModalOpen(true)}>Bus tracking</ToolButton>
            <NavLink to="/verify-ticket" className={linkClass} onClick={() => setMobileMenuOpen(false)}><ScanLine size={15} /><span>Verify ticket</span></NavLink>
          </TaskGroup>
        </nav>
      </div>
    </header>
    <TrainLiveModal isOpen={trainModalOpen} onClose={() => setTrainModalOpen(false)} trainNumber="12189" />
    <PnrCheckModal isOpen={pnrModalOpen} onClose={() => setPnrModalOpen(false)} />
    <BusLiveTrackModal isOpen={busTrackModalOpen} onClose={() => setBusTrackModalOpen(false)} busId="ZG-4412" busName="Zingbus AC Sleeper" />
    <OtpLoginModal isOpen={loginModalOpen} onClose={() => setLoginModalOpen(false)} />
  </>;
}
