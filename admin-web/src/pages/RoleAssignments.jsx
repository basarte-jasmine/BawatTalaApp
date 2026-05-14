import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Edit2, Shield, Trash2, UserPlus, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ConfirmActionModal from "../components/ConfirmActionModal";
import Layout from "../components/Layout";
import Modal from "../components/Modal";
import {
  createAdminRoleMember,
  deleteAdminRoleMember,
  fetchAdminRoleAssignments,
  updateAdminRoleMember,
} from "../lib/admin-api";

const DEFAULT_FORM = {
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

function getStatusClasses(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "active") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (normalized === "pending") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-100 text-slate-600";
}

export default function RoleAssignments({ onLogout, session }) {
  const navigate = useNavigate();
  const [members, setMembers] = useState([]);
  const [summary, setSummary] = useState({
    counselorCount: 0,
    peerAdvisorCount: 0,
    superAdminCount: 0,
  });
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [formState, setFormState] = useState(DEFAULT_FORM);

  async function loadMembers() {
    try {
      setIsLoading(true);
      const data = await fetchAdminRoleAssignments();
      setMembers(Array.isArray(data?.members) ? data.members : []);
      setSummary({
        counselorCount: Number(data?.summary?.counselorCount || 0),
        peerAdvisorCount: Number(data?.summary?.peerAdvisorCount || 0),
        superAdminCount: Number(data?.summary?.superAdminCount || 0),
      });
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load role assignments.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadMembers();
  }, []);

  const filteredMembers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return members;
    return members.filter((member) =>
      [
        member.fullName,
        member.email,
        member.roleLabel,
        member.department,
        member.status,
        member.studentNumber,
        member.program,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [members, search]);

  const roleCards = [
    {
      title: "Super Admin",
      count: summary.superAdminCount,
      icon: Shield,
      iconClass: "text-emerald-800",
      bgClass: "bg-emerald-100",
      borderClass: "border-emerald-200",
    },
    {
      title: "School Counselor",
      count: summary.counselorCount,
      icon: Users,
      iconClass: "text-green-700",
      bgClass: "bg-green-50",
      borderClass: "border-green-200",
    },
    {
      title: "Peer Advisor",
      count: summary.peerAdvisorCount,
      icon: Users,
      iconClass: "text-lime-700",
      bgClass: "bg-lime-50",
      borderClass: "border-lime-200",
    },
  ];

  function openCreateModal() {
    setEditingMember(null);
    setFormState(DEFAULT_FORM);
    setTemporaryPassword("");
    setErrorMessage("");
    setIsFormOpen(true);
  }

  function openEditModal(member) {
    if (member?.memberType === "PEER") {
      navigate("/peer-counselors");
      return;
    }
    if (!member?.canEdit) return;
    setEditingMember(member);
    setFormState({
      email: member.email || "",
      fullName: member.fullName || "",
      gender: member.gender || "Prefer not to say",
      isActive: Boolean(member.isActive),
      role: member.role || "COUNSELOR",
    });
    setTemporaryPassword("");
    setErrorMessage("");
    setIsFormOpen(true);
  }

  async function handleSaveMember() {
    if (!formState.fullName.trim()) {
      setErrorMessage("Full name is required.");
      return;
    }
    if (!editingMember && !formState.email.trim()) {
      setErrorMessage("Email address is required.");
      return;
    }

    try {
      setIsSaving(true);
      const payload = {
        email: formState.email.trim(),
        fullName: formState.fullName.trim(),
        gender: formState.gender,
        isActive: Boolean(formState.isActive),
        role: formState.role,
      };
      const data = editingMember
        ? await updateAdminRoleMember(editingMember.id, payload)
        : await createAdminRoleMember(payload);

      setSuccessMessage(data?.message || "Role assignment saved.");
      setTemporaryPassword(data?.temporaryPassword || "");
      setIsFormOpen(false);
      setEditingMember(null);
      setFormState(DEFAULT_FORM);
      await loadMembers();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save role assignment.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteMember() {
    if (!deleteTarget?.id) return;
    try {
      setIsSaving(true);
      const data = await deleteAdminRoleMember(deleteTarget.id);
      setSuccessMessage(data?.message || "Team member deactivated.");
      setDeleteTarget(null);
      await loadMembers();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to deactivate team member.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Layout
      title="Role & Permission Management"
      subtitle="Manage live counselor roles and access levels."
      onLogout={onLogout}
      session={session}
    >
      <div className="mx-auto max-w-[1200px] space-y-6 pb-12">
        {errorMessage ? (
          <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        ) : null}
        {successMessage ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {successMessage}
          </div>
        ) : null}
        {temporaryPassword ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Temporary password for the new account: <span className="font-bold">{temporaryPassword}</span>
          </div>
        ) : null}

        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Role & Permission Management</h1>
            <p className="mt-1 text-sm text-gray-500">
              Live team data from the admin role database.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800"
          >
            <UserPlus className="h-4 w-4" />
            Add Member
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {roleCards.map((role) => {
            const Icon = role.icon;
            return (
              <div
                key={role.title}
                className={`rounded-2xl border bg-white p-6 shadow-sm ${role.borderClass}`}
              >
                <div className="mb-4 flex items-center gap-3">
                  <div className={`rounded-xl p-2 ${role.bgClass}`}>
                    <Icon className={`h-5 w-5 ${role.iconClass}`} />
                  </div>
                  <h3 className="font-semibold text-gray-900">{role.title}</h3>
                </div>
                <div className="text-2xl font-bold text-gray-900">{role.count}</div>
                <div className="text-sm text-gray-500">
                  Active user{role.count !== 1 ? "s" : ""}
                </div>
              </div>
            );
          })}
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-3 border-b border-gray-200 bg-gray-50/50 p-5 sm:flex-row sm:items-center">
            <h2 className="text-lg font-semibold text-gray-900">Team Members</h2>
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search members..."
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 sm:w-80"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left">
              <thead>
                <tr className="border-b border-gray-200 bg-white text-xs uppercase tracking-wider text-gray-500">
                  <th className="px-6 py-4 font-semibold">Counselor Name</th>
                  <th className="px-6 py-4 font-semibold">Role</th>
                  <th className="px-6 py-4 font-semibold">Department</th>
                  <th className="px-6 py-4 text-center font-semibold">Students Assigned</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white text-sm">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-500">
                      Loading team members...
                    </td>
                  </tr>
                ) : filteredMembers.length ? (
                  filteredMembers.map((member) => {
                    const canOpenEdit = member.canEdit || member.memberType === "PEER";
                    return (
                    <tr key={`${member.memberType}-${member.id}`} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex items-center gap-3">
                          {member.profilePictureUrl ? (
                            <img
                              src={member.profilePictureUrl}
                              alt={member.fullName || "Team member"}
                              className="h-9 w-9 rounded-full border border-emerald-100 object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700">
                              {getInitials(member.fullName || member.email)}
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-gray-900">{member.fullName}</div>
                            <div className="text-xs text-gray-500">{member.email || member.studentNumber}</div>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-gray-600">{member.roleLabel}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-gray-500">{member.department}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-center font-medium text-gray-700">
                        {member.role === "HEAD_COUNSELOR" ? "All" : Number(member.assignedStudents || 0)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusClasses(member.status)}`}>
                          {member.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 text-gray-400">
                          <button
                            type="button"
                            onClick={() => openEditModal(member)}
                            disabled={!canOpenEdit}
                            className="rounded-lg p-1.5 hover:bg-emerald-50 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label={member.memberType === "PEER" ? `Open peer counselor editor for ${member.fullName}` : `Edit ${member.fullName}`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => member.canDelete && setDeleteTarget(member)}
                            disabled={!member.canDelete}
                            className="rounded-lg p-1.5 hover:bg-rose-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label={`Deactivate ${member.fullName}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-500">
                      No team members matched the current search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <Modal
          isOpen={isFormOpen}
          onClose={() => {
            setIsFormOpen(false);
            setEditingMember(null);
            setFormState(DEFAULT_FORM);
          }}
          title={editingMember ? "Edit Team Member" : "Add Team Member"}
        >
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Full Name</label>
              <input
                type="text"
                value={formState.fullName}
                onChange={(event) => setFormState((current) => ({ ...current, fullName: event.target.value }))}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Email Address</label>
              <input
                type="email"
                value={formState.email}
                disabled={Boolean(editingMember)}
                onChange={(event) => setFormState((current) => ({ ...current, email: event.target.value }))}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Role</label>
                <select
                  value={formState.role}
                  onChange={(event) => setFormState((current) => ({ ...current, role: event.target.value }))}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="HEAD_COUNSELOR">Super Admin</option>
                  <option value="COUNSELOR">School Counselor</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Gender</label>
                <select
                  value={formState.gender}
                  onChange={(event) => setFormState((current) => ({ ...current, gender: event.target.value }))}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>
            </div>
            {editingMember ? (
              <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <span>
                  <span className="block text-sm font-semibold text-slate-800">Active account</span>
                  <span className="block text-xs text-slate-500">Inactive members stay in history but lose active status.</span>
                </span>
                <input
                  type="checkbox"
                  checked={formState.isActive}
                  onChange={(event) => setFormState((current) => ({ ...current, isActive: event.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                />
              </label>
            ) : null}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsFormOpen(false);
                  setEditingMember(null);
                  setFormState(DEFAULT_FORM);
                }}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSaveMember()}
                disabled={isSaving}
                className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
              >
                {isSaving ? "Saving..." : "Save Member"}
              </button>
            </div>
          </div>
        </Modal>

        <ConfirmActionModal
          isOpen={Boolean(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => void handleDeleteMember()}
          title="Deactivate Team Member"
          description={`Mark ${deleteTarget?.fullName || "this member"} as inactive?`}
          cancelLabel="Keep Active"
          confirmLabel="Deactivate"
          confirmTone="rose"
        />
      </div>
    </Layout>
  );
}
