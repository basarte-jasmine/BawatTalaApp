import CalendarScheduling from "./CalendarScheduling";

export default function PeerCounselors({ onLogout, session }) {
  return (
    <CalendarScheduling
      onLogout={onLogout}
      session={session}
      supportType="PEER"
      title="Peer Counselor Scheduling"
      subtitle="Manage talk-to-peer sessions, peer counselor schedules, and admin approvals."
    />
  );
}
