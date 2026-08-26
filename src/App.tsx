import { HashRouter, Route, Routes } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Dashboard } from "@/pages/Dashboard";
import { Standings } from "@/pages/Standings";
import { MatchupDetail } from "@/pages/MatchupDetail";
import { TeamPage } from "@/pages/TeamPage";
import { Teams } from "@/pages/Teams";
import { PowerRankings } from "@/pages/PowerRankings";
import { RecordBook } from "@/pages/RecordBook";

// HashRouter is used so the site works cleanly as a static GitHub Pages
// project site (no server-side rewrites needed for deep links).
export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/week/:week" element={<Dashboard />} />
          <Route path="/matchup/:matchupId" element={<MatchupDetail />} />
          <Route path="/standings" element={<Standings />} />
          <Route path="/teams" element={<Teams />} />
          <Route path="/team/:teamId" element={<TeamPage />} />
          <Route path="/power-rankings" element={<PowerRankings />} />
          <Route path="/records" element={<RecordBook />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
