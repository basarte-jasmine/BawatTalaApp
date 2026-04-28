import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Edit2, Shield, Trash2, Users, X } from "lucide-react";
import ConfirmActionModal from "../components/ConfirmActionModal";
import Layout from "../components/Layout";
import Modal from "../components/Modal";
import {
  deleteAdminRoleMember,
  fetchAdminRoleAssignments,
  updateAdminRoleMember,
} from "../lib/admin-api";

const PERMISSIONS = [
  { feature: "View all student profiles", admin: true, counselor: true, peer: false },
  { feature: "Review flagged entries", admin: true, counselor: true, peer: false },
  { feature: "Access counseling tools", admin: true, counselor: true, peer: false },
  { feature: "Manage system settings", admin: true, counselor: false, peer: false },
  { feature: "Manage team roles", admin: true, counselor: false, peer: false },
  { feature: "Export compliance reports", admin: true, counselor: true, peer: false },
  { feature: "Basic student messaging", admin: true, counselor: true, peer: false },
];

const ROLE_SUMMARY_CARDS = [
  {
    key: "superAdminCount",
    title: "Super Admin",
    icon: Shield,
    iconClass: "text-emerald-800",
    bgClass: "bg-emerald-100",
    borderClass: "border-emerald-200",
  },
  {
    key: "counselorCount",
    title: "School Counselor",
    icon: Users,
    iconClass: "text-green-700",
    bgClass: "bg-green-50",
    borderClass: "border-green-200",
  },
  {
    key: "peerAdvisorCount",
    title: "Peer Counselor",
    icon: AlertTriangle,
    iconClass: "text-amber-700",
    bgClass: "bg-amber-50",
    borderClass: "border-amber-200",
  },
];

const INITIAL_FORM_STATE = {
  email: "",
  fullName: "",
  gender: "Prefer not to say",
  isActive: true,
  role: "COUNSELOR",
};

function getInitials(name) {
  return String(name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

export default function RoleAssignments({ onLogout, session }) {
  const [summary, setSummary] = useState({
    superAdminCount: 0,
    counselorCount: 0,
    peerAdvisorCount: 0,
  });
  const [members, setMembers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [pendingDeleteMember, setPendingDeleteMember] = useState(null);
  const [formState, setFormState] = useState(INITIAL_FORM_STATE);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState("");

  async function loadRoleAssignments() {
    try {
      setLoading(true);
      const data = await fetchAdminRoleAssignments();
      setMembers(Array.isArray(data?.members) ? data.members : []);
      setSummary({
        superAdminCount: Number(data?.summary?.superAdminCount || 0),
        counselorCount: Number(data?.summary?.counselorCount || 0),
        peerAdvisorCount: Number(data?.summary?.peerAdvisorCount || 0),
      });
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load role assignments.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRoleAssignments();
  }, []);

  const filteredMembers = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    return members.filter((member) => {
      const matchesRole = roleFilter === "ALL" || member.role === roleFilter;
      const matchesSearch = !normalized || [member.fullName, member.email, member.roleLabel, member.department, member.program, member.studentNumber]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
      return matchesRole && matchesSearch;
    });
  }, [members, roleFilter, searchTerm]);

  function getStatusClasses(member) {
    const status = String(member.status || "").toUpperCase();
    if (status === "PENDING") return "border-amber-200 bg-amber-50 text-amber-700";
    if (member.isActive) return "border-emerald-200 bg-emerald-50 text-emerald-700";
    return "border-slate-200 bg-slate-100 text-slate-600";
  }

  function resetFormState() {
    setFormState(INITIAL_FORM_STATE);
    setFormError("");
    setEditingMemberId("");
  }

  function handleOpenEditModal(member) {
    setFormState({
      email: member.email || "",
      fullName: member.fullName || "",
      gender: member.gender || "Prefer not to say",
      isActive: Boolean(member.isActive),
      role: member.role || "COUNSELOR",
    });
    setFormError("");
    setEditingMemberId(member.id);
    setIsEditModalOpen(true);
  }

  async function handleSubmitEdit(event) {
    event.preventDefault();
    if (!editingMemberId) return;

    if (formState.role === "PEER_ADVISOR") {
      setFormError("Peer counselors are managed from the Peer Counselors page.");
      return;
    }

    try {
      setIsSubmitting(true);
      await updateAdminRoleMember(editingMemberId, {
        fullName: formState.fullName,
        gender: formState.gender,
        isActive: Boolean(formState.isActive),
        role: formState.role,
      });
      setIsEditModalOpen(false);
      resetFormState();
      await loadRoleAssignments();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to update member.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleConfirmDelete() {
    if (!pendingDeleteMember?.id) return;
    try {
      await deleteAdminRoleMember(pendingDeleteMember.id);
      setPendingDeleteMember(null);
      await loadRoleAssignments();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to remove member.");
    }
  }

  return (
    <Layout title="Role & Permission Management" subtitle="Manage team access and system capabilities." onLogout={onLogout} session={session}>
      <div className="mx-auto max-w-[1200px] space-y-6 pb-12">
        {errorMessage ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {errorMessage}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {ROLE_SUMMARY_CARDS.map((role) => {
            const Icon = role.icon;
            const count = Number(summary?.[role.key] || 0);
            return (
              <div key={role.title} className={`rounded-xl border bg-white p-6 shadow-sm ${role.borderClass}`}>
                <div className="mb-4 flex items-center gap-3">
                  <div className={`rounded-lg p-2 ${role.bgClass}`}>
                    <Icon className={`h-5 w-5 ${role.iconClass}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{role.title}</h3>
                    {role.key === "peerAdvisorCount" ? (
                      <div className="text-xs text-amber-700">Peer support roster</div>
                    ) : null}
                  </div>
                </div>
                <div className="text-2xl font-bold text-gray-900">{count}</div>
                <div className="text-sm text-gray-500">
                  {role.key === "peerAdvisorCount" ? `Active peer counselor${count !== 1 ? "s" : ""}` : `Active user${count !== 1 ? "s" : ""}`}
                </div>
              </div>
            );
          })}
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-gray-200 bg-gray-50/50 p-5 lg:flex-row lg:items-center lg:justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Team Members</h2>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 sm:w-52"
              >
                <option value="ALL">All roles</option>
                <option value="HEAD_COUNSELOR">Super Admin</option>
                <option value="COUNSELOR">School Counselor</option>
                <option value="PEER_ADVISOR">Peer Counselor</option>
              </select>
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search members..."
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 sm:w-64"
              />
            </div>
          </div>

          {loading ? (
            <div className="px-6 py-10 text-sm text-gray-500">Loading team members...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-gray-200 bg-white text-xs uppercase tracking-wider text-gray-500">
                    <th className="px-6 py-4 font-semibold">Team Member</th>
                    <th className="px-6 py-4 font-semibold">Role</th>
                    <th className="px-6 py-4 font-semibold">Department</th>
                    <th className="px-6 py-4 text-center font-semibold">Students Assigned</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white text-sm">
                  {filteredMembers.length ? (
                    filteredMembers.map((member) => (
                      <tr key={member.id} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap px-6 py-4">
                          <div className="flex items-center gap-3">
                            {member.profilePictureUrl ? (
                              <img
                                src={member.profilePictureUrl}
                                alt={member.fullName}
                                className="h-9 w-9 rounded-full border border-gray-200 object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-xs font-medium text-emerald-700">
                                {getInitials(member.fullName)}
                              </div>
                            )}
                            <div>
                              <div className="font-medium text-gray-900">{member.fullName}</div>
                              <div className="text-xs text-gray-400">{member.email}</div>
                              {member.role === "PEER_ADVISOR" ? (
                                <div className="text-xs text-gray-400">{[member.studentNumber, member.program].filter(Boolean).join(" - ")}</div>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-gray-600">{member.roleLabel}</td>
                        <td className="whitespace-nowrap px-6 py-4 text-gray-500">{member.department}</td>
                        <td className="whitespace-nowrap px-6 py-4 text-center font-medium text-gray-700">{member.assignedStudents}</td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
                              getStatusClasses(member)
                            }`}
                          >
                            {member.status}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 text-gray-400">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(member)}
                              disabled={!member.canEdit}
                              title={member.canEdit ? "Edit member" : "Manage peer counselors from the Peer Counselors page"}
                              className="p-1 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-35"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setPendingDeleteMember(member)}
                              disabled={!member.canDelete}
                              title={member.canDelete ? "Remove member" : "Manage peer counselors from the Peer Counselors page"}
                              className="p-1 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-35"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">
                        No team members matched your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 bg-gray-50/50 p-5">
            <h2 className="text-lg font-semibold text-gray-900">Permission Matrix</h2>
            <p className="mt-1 text-sm text-gray-500">Detailed breakdown of access levels by role and current peer counselor status.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-gray-200 bg-white text-xs uppercase tracking-wider text-gray-500">
                  <th className="w-1/3 px-6 py-4 font-semibold">Permission</th>
                  <th className="px-6 py-4 text-center font-semibold">Super Admin</th>
                  <th className="px-6 py-4 text-center font-semibold">School Counselor</th>
                  <th className="px-6 py-4 text-center font-semibold">Peer Counselor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white text-sm">
                {PERMISSIONS.map((permission) => (
                  <tr key={permission.feature} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-700">{permission.feature}</td>
                    <td className="px-6 py-4 text-center">{permission.admin ? <Check className="mx-auto h-5 w-5 text-emerald-600" /> : <X className="mx-auto h-5 w-5 text-gray-300" />}</td>
                    <td className="px-6 py-4 text-center">{permission.counselor ? <Check className="mx-auto h-5 w-5 text-emerald-600" /> : <X className="mx-auto h-5 w-5 text-gray-300" />}</td>
                    <td className="px-6 py-4 text-center">{permission.peer ? <Check className="mx-auto h-5 w-5 text-emerald-600" /> : <X className="mx-auto h-5 w-5 text-gray-300" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Team Member">
          <form onSubmit={(event) => void handleSubmitEdit(event)} className="space-y-4">
            {formError ? <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{formError}</div> : null}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Full Name</label>
              <input
                type="text"
                value={formState.fullName}
                onChange={(event) => setFormState((current) => ({ ...current, fullName: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Email Address</label>
              <input type="email" value={formState.email} disabled className="w-full rounded-lg border border-gray-200 bg-slate-50 px-3 py-2 text-sm text-gray-500" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Assign Role</label>
                <select
                  value={formState.role}
                  onChange={(event) => setFormState((current) => ({ ...current, role: event.target.value }))}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="HEAD_COUNSELOR">Super Admin</option>
                  <option value="COUNSELOR">School Counselor</option>
                  <option value="PEER_ADVISOR">Peer Counselor</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Gender</label>
                <select
                  value={formState.gender}
                  onChange={(event) => setFormState((current) => ({ ...current, gender: event.target.value }))}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>
            </div>
            <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={Boolean(formState.isActive)}
                onChange={(event) => setFormState((current) => ({ ...current, isActive: event.target.checked }))}
              />
              Keep this member active
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setIsEditModalOpen(false)} className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100">
                Cancel
              </button>
              <button type="submit" disabled={isSubmitting} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60">
                {isSubmitting ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </Modal>

        <ConfirmActionModal
          isOpen={Boolean(pendingDeleteMember)}
          onClose={() => setPendingDeleteMember(null)}
          onConfirm={() => void handleConfirmDelete()}
          title="Remove Team Member"
          description={`Mark ${pendingDeleteMember?.fullName || "this member"} as inactive and remove them from the active team list?`}
          cancelLabel="Keep"
          confirmLabel="Remove"
          confirmTone="rose"
        />
      </div>
    </Layout>
  );
}
