import {
  Check,
  Edit2,
  MoreVertical,
  Shield,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import Layout from "../components/Layout";
import Modal from "../components/Modal";

const TEAM = [
  {
    id: 1,
    name: "Dr. Maria Santos",
    role: "Super Admin",
    dept: "Administration",
    students: "All",
    status: "Active",
  },
  {
    id: 2,
    name: "Juan Cruz",
    role: "School Counselor",
    dept: "Counseling Office",
    students: "45",
    status: "Active",
  },
  {
    id: 3,
    name: "Elena Reyes",
    role: "School Counselor",
    dept: "Counseling Office",
    students: "38",
    status: "Active",
  },
  {
    id: 4,
    name: "Paolo Mendoza",
    role: "Counselor",
    dept: "Counseling Office",
    students: "24",
    status: "On Leave",
  },
  {
    id: 5,
    name: "Anna Morales",
    role: "Peer Advisor",
    dept: "Student Services",
    students: "8",
    status: "Active",
  },
];

const PERMISSIONS = [
  {
    feature: "View all student profiles",
    admin: true,
    counselor: true,
    peer: false,
  },
  {
    feature: "Review flagged entries",
    admin: true,
    counselor: true,
    peer: false,
  },
  {
    feature: "Access counseling tools",
    admin: true,
    counselor: true,
    peer: false,
  },
  {
    feature: "Manage system settings",
    admin: true,
    counselor: false,
    peer: false,
  },
  { feature: "Manage team roles", admin: true, counselor: false, peer: false },
  {
    feature: "Export compliance reports",
    admin: true,
    counselor: true,
    peer: false,
  },
  {
    feature: "Basic student messaging",
    admin: true,
    counselor: true,
    peer: true,
  },
];

export default function RoleAssignments({ onLogout }) {
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  return (
    <Layout
      title="Role & Permission Management"
      subtitle="Manage team access and system capabilities."
      onLogout={onLogout}
    >
      <div className="mx-auto max-w-[1200px] space-y-6 pb-12">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Role & Permission Management
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage counselor roles, access levels, and system permissions.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsInviteModalOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-800"
          >
            <UserPlus className="h-4 w-4" />
            Invite Member
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {[
            {
              title: "Super Admin",
              count: 1,
              icon: Shield,
              iconClass: "text-emerald-800",
              bgClass: "bg-emerald-100",
              borderClass: "border-emerald-200",
            },
            {
              title: "School Counselor",
              count: 3,
              icon: Users,
              iconClass: "text-green-700",
              bgClass: "bg-green-50",
              borderClass: "border-green-200",
            },
            {
              title: "Peer Advisor",
              count: 1,
              icon: Users,
              iconClass: "text-lime-700",
              bgClass: "bg-lime-50",
              borderClass: "border-lime-200",
            },
          ].map((role) => {
            const Icon = role.icon;
            return (
              <div
                key={role.title}
                className={`rounded-xl border bg-white p-6 shadow-sm ${role.borderClass}`}
              >
                <div className="mb-4 flex items-center gap-3">
                  <div className={`rounded-lg p-2 ${role.bgClass}`}>
                    <Icon className={`h-5 w-5 ${role.iconClass}`} />
                  </div>
                  <h3 className="font-semibold text-gray-900">{role.title}</h3>
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {role.count}
                </div>
                <div className="text-sm text-gray-500">
                  Active user{role.count !== 1 ? "s" : ""}
                </div>
              </div>
            );
          })}
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50/50 p-5">
            <h2 className="text-lg font-semibold text-gray-900">
              Team Members
            </h2>
            <input
              type="text"
              placeholder="Search members..."
              className="w-64 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-gray-200 bg-white text-xs uppercase tracking-wider text-gray-500">
                  <th className="px-6 py-4 font-semibold">Counselor Name</th>
                  <th className="px-6 py-4 font-semibold">Role</th>
                  <th className="px-6 py-4 font-semibold">Department</th>
                  <th className="px-6 py-4 text-center font-semibold">
                    Students Assigned
                  </th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 text-right font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white text-sm">
                {TEAM.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-xs font-medium text-emerald-700">
                          {member.name
                            .split(" ")
                            .map((part) => part[0])
                            .join("")
                            .replace(".", "")}
                        </div>
                        <div className="font-medium text-gray-900">
                          {member.name}
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-gray-600">
                      {member.role}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-gray-500">
                      {member.dept}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-center font-medium text-gray-700">
                      {member.students}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${member.status === "Active" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}
                      >
                        {member.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 text-gray-400">
                        <button
                          type="button"
                          className="p-1 hover:text-emerald-700"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="p-1 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="p-1 hover:text-gray-600"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 bg-gray-50/50 p-5">
            <h2 className="text-lg font-semibold text-gray-900">
              Permission Matrix
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Detailed breakdown of access levels by role.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-gray-200 bg-white text-xs uppercase tracking-wider text-gray-500">
                  <th className="w-1/3 px-6 py-4 font-semibold">Permission</th>
                  <th className="px-6 py-4 text-center font-semibold">
                    Super Admin
                  </th>
                  <th className="px-6 py-4 text-center font-semibold">
                    School Counselor
                  </th>
                  <th className="px-6 py-4 text-center font-semibold">
                    Peer Advisor
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white text-sm">
                {PERMISSIONS.map((permission) => (
                  <tr key={permission.feature} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4 font-medium text-gray-700">
                      {permission.feature}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {permission.admin ? (
                        <Check className="mx-auto h-5 w-5 text-emerald-600" />
                      ) : (
                        <X className="mx-auto h-5 w-5 text-gray-300" />
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {permission.counselor ? (
                        <Check className="mx-auto h-5 w-5 text-emerald-600" />
                      ) : (
                        <X className="mx-auto h-5 w-5 text-gray-300" />
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {permission.peer ? (
                        <Check className="mx-auto h-5 w-5 text-emerald-600" />
                      ) : (
                        <X className="mx-auto h-5 w-5 text-gray-300" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <Modal
          isOpen={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
          title="Invite Team Member"
        >
          <form className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                Email Address
              </label>
              <input
                type="email"
                placeholder="colleague@school.edu"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                Assign Role
              </label>
              <select className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option>Super Admin</option>
                <option>School Counselor</option>
                <option>Peer Advisor</option>
              </select>
            </div>
          </form>
        </Modal>
      </div>
    </Layout>
  );
}
