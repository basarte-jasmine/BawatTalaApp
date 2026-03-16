import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Calendar, Mail, Search, UserCircle2 } from "lucide-react";
import Layout from "../components/Layout";
import Modal from "../components/Modal";
import { fetchAdminStudentProfile, fetchAdminStudents } from "../lib/admin-api";

function getInitials(name) {
  return String(name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

function formatRelativeTime(value) {
  if (!value) return "No entries yet";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "No entries yet";
  const diffMs = Date.now() - parsed.getTime();
  const minutes = Math.max(1, Math.floor(diffMs / (1000 * 60)));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function formatDate(value) {
  if (!value) return "Not available";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value) {
  if (!value) return "Not available";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getStatusClasses(status) {
  if (status === "Flagged") return "border-rose-100 bg-rose-50 text-rose-700";
  if (status === "Inactive") return "border-slate-200 bg-slate-100 text-slate-600";
  return "border-emerald-100 bg-emerald-50 text-emerald-700";
}

export default function StudentDirectory({ onLogout, session }) {
  const [students, setStudents] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProgram, setSelectedProgram] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedStudentNumber, setSelectedStudentNumber] = useState("");
  const [studentProfile, setStudentProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");

  async function loadStudents(nextSearch = searchTerm, nextProgram = selectedProgram) {
    try {
      setLoading(true);
      const data = await fetchAdminStudents({
        search: nextSearch.trim(),
        program: nextProgram,
      });
      setStudents(Array.isArray(data?.students) ? data.students : []);
      setPrograms(Array.isArray(data?.programs) ? data.programs : []);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load student directory.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStudents();
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadStudents(searchTerm, selectedProgram);
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [searchTerm, selectedProgram]);

  async function handleViewProfile(studentNumber) {
    try {
      setSelectedStudentNumber(studentNumber);
      setProfileLoading(true);
      const data = await fetchAdminStudentProfile(studentNumber);
      setStudentProfile(data);
      setProfileError("");
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Failed to load student profile.");
    } finally {
      setProfileLoading(false);
    }
  }

  const profileEntries = useMemo(
    () => (Array.isArray(studentProfile?.entries) ? studentProfile.entries : []),
    [studentProfile],
  );

  return (
    <Layout title="Student Directory" subtitle="Manage and view enrolled student profiles and journal history." onLogout={onLogout} session={session}>
      <div className="mx-auto max-w-[1200px] space-y-6 pb-12">
        {errorMessage ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row">
          <div className="relative w-full lg:w-96">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search students by name, ID, or course..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="w-full lg:w-auto">
            <select
              value={selectedProgram}
              onChange={(event) => setSelectedProgram(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 lg:min-w-[280px]"
            >
              <option value="">All Courses</option>
              {programs.map((program) => (
                <option key={program} value={program}>
                  {program}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? <div className="rounded-2xl border border-slate-200 bg-white px-5 py-12 text-sm text-slate-500 shadow-sm">Loading students...</div> : null}

        {!loading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {students.length ? (
              students.map((student) => (
                <div key={student.studentNumber} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
                  <div className="p-6 pb-4">
                    <div className="mb-4 flex items-start justify-between">
                      <div className={`flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold ${student.status === "Flagged" ? "bg-rose-100 text-rose-700" : student.status === "Inactive" ? "bg-slate-100 text-slate-700" : "bg-emerald-100 text-emerald-700"}`}>
                        {getInitials(student.fullName)}
                      </div>
                      {student.flaggedEntries > 0 ? <AlertTriangle className="h-5 w-5 text-rose-500" /> : null}
                    </div>

                    <div className="mb-4">
                      <h3 className="text-lg font-semibold text-slate-900 group-hover:text-emerald-700">{student.fullName}</h3>
                      <div className="text-sm font-medium text-slate-500">{student.studentNumber}</div>
                    </div>

                    <div className="mb-5 flex flex-wrap gap-2">
                      <span className="inline-flex rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {student.program || "Unspecified"}
                      </span>
                      <span className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-medium ${getStatusClasses(student.status)}`}>
                        {student.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs">
                      <div>
                        <div className="mb-1 flex items-center gap-1 text-slate-500">
                          <Calendar className="h-3 w-3" />
                          Last Active
                        </div>
                        <div className="font-medium text-slate-900">{formatRelativeTime(student.lastEntryAt)}</div>
                      </div>
                      <div>
                        <div className="mb-1 flex items-center gap-1 text-slate-500">
                          <Mail className="h-3 w-3" />
                          Entries
                        </div>
                        <div className="font-medium text-slate-900">{student.totalEntries} total</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-4">
                    <button
                      type="button"
                      disabled
                      className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-400"
                    >
                      Message
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleViewProfile(student.studentNumber)}
                      className="flex-1 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 shadow-sm hover:bg-emerald-100"
                    >
                      View Profile
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center text-sm text-slate-500 shadow-sm">
                No students matched the current search.
              </div>
            )}
          </div>
        ) : null}

        <Modal
          isOpen={Boolean(selectedStudentNumber)}
          onClose={() => {
            setSelectedStudentNumber("");
            setStudentProfile(null);
            setProfileError("");
          }}
          title={studentProfile?.profile?.fullName || "Student Profile"}
          maxWidth="max-w-5xl"
        >
          {profileLoading ? <div className="py-10 text-sm text-slate-500">Loading student profile...</div> : null}
          {profileError ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{profileError}</div> : null}

          {!profileLoading && studentProfile?.profile ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr,2fr]">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-xl font-bold text-emerald-700">
                      {getInitials(studentProfile.profile.fullName)}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-lg font-semibold text-slate-900">{studentProfile.profile.fullName}</div>
                      <div className="text-sm text-slate-500">{studentProfile.profile.studentNumber}</div>
                      <div className={`mt-2 inline-flex rounded-lg border px-2.5 py-1 text-xs font-medium ${getStatusClasses(studentProfile.profile.status)}`}>
                        {studentProfile.profile.status}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 space-y-3 text-sm">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</div>
                      <div className="mt-1 text-slate-800">{studentProfile.profile.email || "Not provided"}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Program</div>
                      <div className="mt-1 text-slate-800">{studentProfile.profile.program || "Unspecified"}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Birthdate</div>
                      <div className="mt-1 text-slate-800">{formatDate(studentProfile.profile.birthdate)}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Address</div>
                      <div className="mt-1 text-slate-800">
                        {[studentProfile.profile.street, studentProfile.profile.barangay, studentProfile.profile.city, studentProfile.profile.province, studentProfile.profile.region]
                          .filter(Boolean)
                          .join(", ") || "Not provided"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="text-sm text-slate-500">Total Entries</div>
                    <div className="mt-2 text-3xl font-bold text-slate-900">{studentProfile.profile.totalEntries}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="text-sm text-slate-500">Flagged Entries</div>
                    <div className="mt-2 text-3xl font-bold text-rose-600">{studentProfile.profile.flaggedEntries}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="text-sm text-slate-500">Joined</div>
                    <div className="mt-2 text-lg font-semibold text-slate-900">{formatDate(studentProfile.profile.createdAt)}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white">
                <div className="border-b border-slate-200 px-5 py-4">
                  <div className="text-lg font-semibold text-slate-900">Journal Entries</div>
                  <div className="mt-1 text-sm text-slate-500">Complete journal history with summaries, tags, insights, and risk flags.</div>
                </div>

                <div className="space-y-4 px-5 py-5">
                  {profileEntries.length ? (
                    profileEntries.map((entry) => (
                      <div key={entry.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="text-lg font-semibold text-slate-900">{entry.title || "Untitled journal entry"}</div>
                            <div className="mt-1 text-sm text-slate-500">
                              {formatDate(entry.entryDate)} · Updated {formatDateTime(entry.updatedAt)}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-medium ${["HIGH", "CRITICAL"].includes(String(entry.riskLevel || "").toUpperCase()) ? "border-rose-100 bg-rose-50 text-rose-700" : "border-slate-200 bg-white text-slate-600"}`}>
                              {entry.riskLevel}
                            </span>
                            {entry.primaryConcern ? (
                              <span className="inline-flex rounded-lg border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                                {entry.primaryConcern}
                              </span>
                            ) : null}
                            {entry.supportResponse ? (
                              <span className="inline-flex rounded-lg border border-amber-100 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                                {entry.supportResponse}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr,1fr]">
                          <div className="space-y-4">
                            <div>
                              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Summary</div>
                              <div className="rounded-xl bg-white px-4 py-3 text-sm leading-6 text-slate-700">
                                {entry.summary || "No generated summary for this entry."}
                              </div>
                            </div>

                            <div>
                              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Conversation</div>
                              <div className="space-y-2">
                                {Array.isArray(entry.messages) && entry.messages.length ? (
                                  entry.messages.map((message) => (
                                    <div
                                      key={message.id}
                                      className={`rounded-xl px-4 py-3 text-sm leading-6 ${
                                        message.role === "assistant"
                                          ? "bg-emerald-50 text-emerald-900"
                                          : "bg-white text-slate-700"
                                      }`}
                                    >
                                      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        {message.role === "assistant" ? "Assistant" : "Student"} · {formatDateTime(message.createdAt)}
                                      </div>
                                      <div>{message.text}</div>
                                    </div>
                                  ))
                                ) : (
                                  <div className="rounded-xl bg-white px-4 py-3 text-sm text-slate-500">No messages recorded for this entry.</div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div>
                              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Concern Tags</div>
                              <div className="flex flex-wrap gap-2 rounded-xl bg-white px-4 py-3">
                                {entry.concernTags.length ? (
                                  entry.concernTags.map((tag) => (
                                    <span key={tag} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                                      {tag}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-sm text-slate-500">No tags saved.</span>
                                )}
                              </div>
                            </div>

                            <div>
                              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Insights</div>
                              <div className="rounded-xl bg-white px-4 py-3">
                                {entry.insights.length ? (
                                  <ul className="space-y-2 text-sm leading-6 text-slate-700">
                                    {entry.insights.map((insight, index) => (
                                      <li key={`${entry.id}-insight-${index}`}>• {insight}</li>
                                    ))}
                                  </ul>
                                ) : (
                                  <div className="text-sm text-slate-500">No insights generated.</div>
                                )}
                              </div>
                            </div>

                            <div>
                              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Flag Details</div>
                              <div className="rounded-xl bg-white px-4 py-3 text-sm leading-6 text-slate-700">
                                {entry.adminFlagReason || "No admin flag reason recorded."}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                      This student does not have journal entries yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </Modal>
      </div>
    </Layout>
  );
}
