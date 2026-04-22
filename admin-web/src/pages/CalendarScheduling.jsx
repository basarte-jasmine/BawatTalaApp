import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Plus, RefreshCw } from "lucide-react";
import ConfirmActionModal from "../components/ConfirmActionModal";
import Layout from "../components/Layout";
import {
  buildAvailabilityMap,
  buildAvailabilityOverrideMap,
  buildCalendarCells,
  COUNSELOR_COLORS,
  formatDisplayDate,
  getAvailableSlotsForDate,
  getConcernClassName,
  getWeekDatesForIso,
  getMonthKey,
  getMonthTitle,
  getStatusClassName,
  getTodayIsoDate,
  toFirstDayIso,
  WEEKDAY_HEADERS,
} from "../lib/appointment-scheduling";
import {
  confirmAdminAppointment,
  cancelAdminAppointment,
  createAdminAppointment,
  declineAdminAppointment,
  deleteAdminAppointment,
  fetchAdminAppointmentsOverview,
  updateAdminAvailability,
  updateAdminDayAvailability,
  updateAdminAppointment,
} from "../lib/admin-api";

const ACTIVITY_LOGS_PER_PAGE = 5;

export default function CalendarScheduling({ onLogout, session }) {
  const [selectedDate, setSelectedDate] = useState(getTodayIsoDate);
  const [selectedMonth, setSelectedMonth] = useState(() => new Date());
  const [selectedCounselorId, setSelectedCounselorId] = useState("");
  const [overview, setOverview] = useState(null);
  const [overviewCache, setOverviewCache] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isEditingDailySchedule, setIsEditingDailySchedule] = useState(false);
  const [isEditingCounselorAvailability, setIsEditingCounselorAvailability] = useState(false);
  const [activityFilterCounselorId, setActivityFilterCounselorId] = useState("ALL");
  const [activityLogsPage, setActivityLogsPage] = useState(1);
  const [errorMessage, setErrorMessage] = useState("");
  const [savingKey, setSavingKey] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStudentNumber, setModalStudentNumber] = useState("");
  const [modalCounselorId, setModalCounselorId] = useState("");
  const [modalDate, setModalDate] = useState("");
  const [modalTime, setModalTime] = useState("");
  const [modalConcern, setModalConcern] = useState("");
  const [modalNote, setModalNote] = useState("");
  const [modalGenderPreference, setModalGenderPreference] = useState("No Preference");
  const [editingAppointmentId, setEditingAppointmentId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");
  const [modalLoadingSlots, setModalLoadingSlots] = useState(false);
  const [cancelAppointmentId, setCancelAppointmentId] = useState("");
  const [deleteAppointmentId, setDeleteAppointmentId] = useState("");
  const [dayAvailabilityAction, setDayAvailabilityAction] = useState(null);

  useEffect(() => {
    const monthFromDate = new Date(`${selectedDate}T12:00:00+08:00`);
    if (getMonthKey(monthFromDate) !== getMonthKey(selectedMonth)) {
      setSelectedMonth(new Date(monthFromDate.getFullYear(), monthFromDate.getMonth(), 1));
    }
  }, [selectedDate, selectedMonth]);

  async function loadOverviewForMonth(monthDate, options = {}) {
    const { force = false, silent = false } = options;
    const monthKey = getMonthKey(monthDate);
    if (!force && overviewCache[monthKey]) {
      setOverview(overviewCache[monthKey]);
      setLoading(false);
      return overviewCache[monthKey];
    }

    if (silent || overview) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const data = await fetchAdminAppointmentsOverview(toFirstDayIso(monthDate));
      setOverview(data);
      setOverviewCache((current) => ({
        ...current,
        [monthKey]: data,
      }));
      setErrorMessage("");
      return data;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load appointments.");
      throw error;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadOverviewForMonth(selectedMonth);
  }, [selectedMonth]);

  useEffect(() => {
    if (!selectedCounselorId && overview?.counselors?.length) {
      const sessionEmail = String(session?.email || "").trim().toLowerCase();
      const matchingCounselor = (overview?.counselors || []).find(
        (item) => String(item.email || "").trim().toLowerCase() === sessionEmail,
      );
      setSelectedCounselorId(matchingCounselor?.id || overview?.counselors?.[0]?.id || "");
    }
  }, [overview, selectedCounselorId, session?.email]);

  const counselors = Array.isArray(overview?.counselors) ? overview.counselors : [];
  const selectedCounselor = counselors.find((item) => item.id === selectedCounselorId) || counselors[0] || null;
  const availability = Array.isArray(overview?.availability) ? overview.availability : [];
  const availabilityOverrides = Array.isArray(overview?.availabilityOverrides) ? overview.availabilityOverrides : [];
  const slotTimes = Array.isArray(overview?.slotTimes) ? overview.slotTimes : [];
  const monthAppointments = Array.isArray(overview?.monthAppointments) ? overview.monthAppointments : [];
  const recentActivity = Array.isArray(overview?.recentActivity) ? overview.recentActivity : [];
  const selectedDateAppointments = monthAppointments.filter((item) => item.appointmentDate === selectedDate);
  const upcomingAppointments = [...selectedDateAppointments]
    .sort((a, b) => String(a.slotTime || "").localeCompare(String(b.slotTime || "")))
    .slice(0, 4);
  const availabilityMap = useMemo(
    () => buildAvailabilityMap(availability, selectedCounselor?.id),
    [availability, selectedCounselor?.id],
  );
  const calendarCells = useMemo(() => buildCalendarCells(selectedMonth), [selectedMonth]);
  const weeklyAvailabilitySummary = useMemo(
    () =>
      [1, 2, 3, 4, 5].map((dayOfWeek) => {
        const openSlots = slotTimes.filter((slot) => availabilityMap.get(`${dayOfWeek}:${slot.value}`) === true);
        return {
          dayLabel: WEEKDAY_HEADERS[dayOfWeek],
          dayOfWeek,
          isWorkingDay: openSlots.length > 0,
          openSlots,
        };
      }),
    [availabilityMap, slotTimes],
  );
  const modalMonthKey = useMemo(
    () => getMonthKey(new Date(`${(modalDate || selectedDate) || getTodayIsoDate()}T12:00:00+08:00`)),
    [modalDate, selectedDate],
  );
  const modalOverview = overviewCache[modalMonthKey] || overview;
  const modalMonthAppointments = Array.isArray(modalOverview?.monthAppointments) ? modalOverview.monthAppointments : [];
  const modalAvailability = Array.isArray(modalOverview?.availability) ? modalOverview.availability : [];
  const modalSlotTimes = Array.isArray(modalOverview?.slotTimes) ? modalOverview.slotTimes : slotTimes;
  const modalAvailableSlots = useMemo(
    () =>
      getAvailableSlotsForDate({
        availability: modalAvailability,
        counselorId: modalCounselorId,
        isoDate: modalDate,
        ignoreAppointmentId: editingAppointmentId,
        monthAppointments: modalMonthAppointments,
        slotTimes: modalSlotTimes,
      }),
    [editingAppointmentId, modalAvailability, modalCounselorId, modalDate, modalMonthAppointments, modalSlotTimes],
  );

  const appointmentCountByDate = useMemo(() => {
    const counts = new Map();
    for (const item of monthAppointments.filter((entry) => ["PENDING", "CONFIRMED"].includes(String(entry.status || "").toUpperCase()))) {
      counts.set(item.appointmentDate, (counts.get(item.appointmentDate) || 0) + 1);
    }
    return counts;
  }, [monthAppointments]);

  const counselorColorMap = useMemo(
    () => new Map(counselors.map((counselor, index) => [counselor.id, COUNSELOR_COLORS[index % COUNSELOR_COLORS.length]])),
    [counselors],
  );
  const counselorDayLoad = useMemo(() => {
    const selectedWeekDates = getWeekDatesForIso(selectedDate);
    return counselors.map((counselor, index) => {
      const counselorAvailability = buildAvailabilityMap(availability, counselor.id);
      const counselorOverrideMap = buildAvailabilityOverrideMap(availabilityOverrides, counselor.id);
      const dayTotals = selectedWeekDates.map((day) => {
        const openSlots = slotTimes.filter((slot) => {
          const overrideKey = `${day.isoDate}:${slot.value}`;
          if (counselorOverrideMap.has(overrideKey)) {
            return counselorOverrideMap.get(overrideKey) === true;
          }
          return counselorAvailability.get(`${day.dayOfWeek}:${slot.value}`) === true;
        });
        return {
          dayOfWeek: day.dayOfWeek,
          dayLabel: day.dayLabel,
          isoDate: day.isoDate,
          openSlots,
          isWorkingDay: openSlots.length > 0,
          percent: slotTimes.length ? Math.round((openSlots.length / slotTimes.length) * 100) : 0,
        };
      });
      return {
        color: COUNSELOR_COLORS[index % COUNSELOR_COLORS.length],
        counselor,
        dayTotals,
      };
    });
  }, [availability, availabilityOverrides, counselors, selectedDate, slotTimes]);
  const filteredRecentActivity = useMemo(() => {
    if (activityFilterCounselorId === "ALL") {
      return recentActivity;
    }
    return recentActivity.filter((item) => item.counselorId === activityFilterCounselorId);
  }, [activityFilterCounselorId, recentActivity]);
  const totalActivityLogPages = Math.max(1, Math.ceil(filteredRecentActivity.length / ACTIVITY_LOGS_PER_PAGE));
  const paginatedRecentActivity = useMemo(() => {
    const startIndex = (activityLogsPage - 1) * ACTIVITY_LOGS_PER_PAGE;
    return filteredRecentActivity.slice(startIndex, startIndex + ACTIVITY_LOGS_PER_PAGE);
  }, [activityLogsPage, filteredRecentActivity]);

  useEffect(() => {
    setActivityLogsPage(1);
  }, [activityFilterCounselorId, recentActivity]);

  useEffect(() => {
    if (activityLogsPage > totalActivityLogPages) {
      setActivityLogsPage(totalActivityLogPages);
    }
  }, [activityLogsPage, totalActivityLogPages]);

  useEffect(() => {
    let isMounted = true;
    if (!isModalOpen || !modalDate) {
      return undefined;
    }
    const modalMonth = new Date(`${modalDate}T12:00:00+08:00`);
    if (overviewCache[getMonthKey(modalMonth)]) {
      return undefined;
    }

    async function loadModalMonth() {
      try {
        setModalLoadingSlots(true);
        await loadOverviewForMonth(modalMonth, { silent: true });
      } finally {
        if (isMounted) {
          setModalLoadingSlots(false);
        }
      }
    }

    void loadModalMonth();

    return () => {
      isMounted = false;
    };
  }, [isModalOpen, modalDate, overviewCache]);

  useEffect(() => {
    if (!modalAvailableSlots.some((slot) => slot.value === modalTime)) {
      setModalTime(modalAvailableSlots[0]?.value || "");
    }
  }, [modalAvailableSlots, modalTime]);

  async function refreshOverview() {
    try {
      await loadOverviewForMonth(selectedMonth, { force: true, silent: true });
    } catch (_error) {}
  }

  function applyAvailabilityUpdate(updateSlot) {
    if (!overview || !selectedCounselor?.id) {
      return;
    }
    const nextOverview = {
      ...overview,
      availability: availability.map((row) => ({
        ...row,
        slots: row.counselorId === selectedCounselor?.id ? row.slots.map(updateSlot) : row.slots,
      })),
    };
    setOverview(nextOverview);
    setOverviewCache((current) => ({
      ...current,
      [getMonthKey(selectedMonth)]: nextOverview,
    }));
  }

  async function handleToggleAvailability(dayOfWeek, slotTime) {
    if (!selectedCounselor?.id) return;
    const stateKey = `${dayOfWeek}:${slotTime}`;
    const nextEnabled = !availabilityMap.get(stateKey);
    try {
      setSavingKey(stateKey);
      await updateAdminAvailability({
        actorEmail: session?.email || "",
        counselorId: selectedCounselor.id,
        dayOfWeek,
        isEnabled: nextEnabled,
        slotTime,
      });
      applyAvailabilityUpdate((slot) =>
        slot.dayOfWeek === dayOfWeek && slot.slotTime === slotTime ? { ...slot, isEnabled: nextEnabled } : slot,
      );
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to update availability.");
    } finally {
      setSavingKey("");
    }
  }

  async function handleConfirmDayAvailabilityToggle() {
    if (!selectedCounselor?.id || !dayAvailabilityAction) return;
    try {
      await updateAdminDayAvailability({
        actorEmail: session?.email || "",
        counselorId: selectedCounselor.id,
        dayOfWeek: dayAvailabilityAction.dayOfWeek,
        isEnabled: dayAvailabilityAction.nextEnabled,
        targetDate: dayAvailabilityAction.targetDate,
      });
      setDayAvailabilityAction(null);
      await refreshOverview();
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to update day availability.");
    }
  }

  function handleOpenModal(appointment = null) {
    setIsModalOpen(true);
    setEditingAppointmentId(appointment?.id || "");
    setModalStudentNumber(appointment?.studentNumber || "");
    setModalCounselorId(appointment?.counselorId || selectedCounselorId || "");
    setModalDate(appointment?.appointmentDate || selectedDate || getTodayIsoDate());
    setModalTime(appointment?.slotTime || "");
    setModalConcern(appointment?.concern || "");
    setModalNote(appointment?.studentNote || "");
    setModalGenderPreference(appointment?.counselorGenderPreference || "No Preference");
    setModalError("");
  }

  async function handleCreateAppointment(e) {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setModalError("");
      const payload = {
        actorEmail: session?.email || "",
        studentNumber: modalStudentNumber,
        counselorId: modalCounselorId,
        appointmentDate: modalDate,
        slotTime: modalTime,
        concern: modalConcern,
        studentNote: modalNote,
        counselorGenderPreference: modalGenderPreference,
        bookingSource: "ADMIN_PANEL",
      };
      if (editingAppointmentId) {
        await updateAdminAppointment(editingAppointmentId, payload);
      } else {
        await createAdminAppointment(payload);
      }
      const appointmentMonth = new Date(`${modalDate}T12:00:00+08:00`);
      setSelectedMonth(new Date(appointmentMonth.getFullYear(), appointmentMonth.getMonth(), 1));
      setSelectedDate(modalDate);
      setIsModalOpen(false);
      setEditingAppointmentId("");
      await loadOverviewForMonth(appointmentMonth, { force: true, silent: true });
    } catch (error) {
      setModalError(error instanceof Error ? error.message : `Failed to ${editingAppointmentId ? "update" : "create"} appointment.`);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCancelAppointment(appointmentId) {
    try {
      await cancelAdminAppointment(appointmentId, { actorEmail: session?.email || "" });
      setCancelAppointmentId("");
      await refreshOverview();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to cancel appointment.");
    }
  }

  async function handleConfirmAppointment(appointmentId) {
    try {
      await confirmAdminAppointment(appointmentId, { actorEmail: session?.email || "" });
      await refreshOverview();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to confirm appointment.");
    }
  }

  async function handleDeclineAppointment(appointmentId) {
    try {
      await declineAdminAppointment(appointmentId, { actorEmail: session?.email || "" });
      await refreshOverview();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to decline appointment.");
    }
  }

  async function handleDeleteAppointment(appointmentId) {
    try {
      await deleteAdminAppointment(appointmentId, session?.email || "");
      setDeleteAppointmentId("");
      await refreshOverview();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to delete appointment.");
    }
  }

  function formatAvailabilityHours(openSlots) {
    if (!openSlots.length) {
      return "Unavailable all day";
    }
    if (openSlots.length === 1) {
      return openSlots[0].label;
    }
    return `${openSlots[0].label} - ${openSlots[openSlots.length - 1].label}`;
  }

  return (
    <Layout
      title="Calendar & Scheduling"
      subtitle="Manage appointments, counseling sessions, and counselor availability."
      onLogout={onLogout}
      session={session}
    >
      <div className="mx-auto max-w-[1240px] space-y-6 pb-12">
        {errorMessage ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {errorMessage}
          </div>
        ) : null}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleOpenModal}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#3DA35D] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2f8c4d]"
          >
            <Plus className="h-4 w-4" />
            Create Counselor Appointment
          </button>
        </div>

        {loading ? (
          <section className="rounded-[2rem] border border-admin-border bg-white px-6 py-12 text-center text-sm text-admin-muted shadow-sm">
            Loading schedule...
          </section>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.9fr,0.9fr]">
              <section className="rounded-[2rem] border border-admin-border bg-white p-6 shadow-sm">
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <h3 className="text-[1.15rem] font-black text-slate-800">{getMonthTitle(selectedMonth)}</h3>
                    <button
                      type="button"
                      onClick={() => setSelectedDate(getTodayIsoDate())}
                      className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"
                    >
                      Today
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const nextMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1);
                        setSelectedMonth(nextMonth);
                        setSelectedDate(toFirstDayIso(nextMonth));
                      }}
                      className="rounded-xl bg-slate-100 p-3 text-slate-600 transition hover:bg-slate-200"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const nextMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1);
                        setSelectedMonth(nextMonth);
                        setSelectedDate(toFirstDayIso(nextMonth));
                      }}
                      className="rounded-xl bg-slate-100 p-3 text-slate-600 transition hover:bg-slate-200"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mb-3 grid grid-cols-7 gap-px rounded-t-2xl bg-slate-200">
                  {WEEKDAY_HEADERS.map((label) => (
                    <div key={label} className="bg-white px-3 py-4 text-center text-sm font-semibold text-slate-500">
                      {label}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-px overflow-hidden rounded-b-2xl bg-slate-200">
                  {calendarCells.map((cell, index) => {
                    const isSelected = cell?.isoDate === selectedDate;
                    const appointmentCount = cell?.isoDate ? appointmentCountByDate.get(cell.isoDate) || 0 : 0;
                    return (
                      <button
                        key={`${cell?.isoDate || "empty"}-${index}`}
                        type="button"
                        onClick={() => cell?.isoDate && setSelectedDate(cell.isoDate)}
                        disabled={!cell?.isoDate}
                        className={`min-h-[112px] bg-white px-4 py-4 text-left transition ${
                          cell?.isoDate ? "hover:bg-emerald-50" : "cursor-default"
                        }`}
                      >
                        {cell ? (
                          <div className="flex h-full flex-col justify-between">
                            <div className="flex items-start justify-between">
                              <span
                                className={`flex h-10 w-10 items-center justify-center rounded-full text-base font-semibold ${
                                  isSelected ? "bg-[#4B82F0] text-white" : "text-slate-700"
                                }`}
                              >
                                {cell.day}
                              </span>
                              {appointmentCount ? (
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                                  {appointmentCount}
                                </span>
                              ) : null}
                            </div>

                            <div className="flex flex-wrap gap-2">
                              {appointmentCount
                                ? monthAppointments
                                    .filter(
                                      (item) =>
                                        item.appointmentDate === cell.isoDate &&
                                        ["PENDING", "CONFIRMED"].includes(String(item.status || "").toUpperCase()),
                                    )
                                    .map((item) => item.counselorId)
                                    .filter((value, index, array) => value && array.indexOf(value) === index)
                                    .slice(0, 3)
                                    .map((counselorId, counselorIndex) => (
                                      <span
                                        key={`${cell.isoDate}-${counselorId}-${counselorIndex}`}
                                        className="h-2.5 w-2.5 rounded-full"
                                        style={{ backgroundColor: counselorColorMap.get(counselorId) || COUNSELOR_COLORS[counselorIndex % COUNSELOR_COLORS.length] }}
                                      />
                                    ))
                                : null}
                            </div>
                          </div>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-6">
                <div className="rounded-[2rem] border border-admin-border bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-[1.15rem] font-black text-slate-800">Counselor Daily Schedule</h3>
                    <p className="mt-1 text-sm text-slate-500">{selectedCounselor?.fullName || "Select a counselor"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsEditingDailySchedule((current) => !current)}
                        className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                      >
                      {isEditingDailySchedule ? "Done" : "Edit"}
                      </button>
                    <button
                      type="button"
                      onClick={() => refreshOverview()}
                      className="rounded-xl bg-slate-100 p-2.5 text-slate-500 transition hover:bg-slate-200"
                    >
                      <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                    </button>
                  </div>
                </div>

                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="space-y-4">
                      {weeklyAvailabilitySummary.map((day) => (
                        <div key={day.dayOfWeek} className="rounded-2xl bg-white px-4 py-3">
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span className="font-semibold text-slate-700">{day.dayLabel}</span>
                            <span className="text-slate-500">
                              {day.openSlots.length ? `${day.openSlots[0].label} - ${day.openSlots[day.openSlots.length - 1].label}` : "Off"}
                            </span>
                          </div>

                          {isEditingDailySchedule ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {slotTimes.map((slot) => {
                                const stateKey = `${day.dayOfWeek}:${slot.value}`;
                                const enabled = availabilityMap.get(stateKey) === true;
                                const isSaving = savingKey === stateKey;
                                return (
                                  <button
                                    key={stateKey}
                                    type="button"
                                    onClick={() => handleToggleAvailability(day.dayOfWeek, slot.value)}
                                    disabled={isSaving}
                                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                                      enabled
                                        ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                    } disabled:cursor-not-allowed disabled:opacity-60`}
                                  >
                                    {isSaving ? "Saving..." : slot.label}
                                  </button>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-[2rem] border border-admin-border bg-white p-6 shadow-sm">
                  <h3 className="text-[1.15rem] font-black text-slate-800">Appointments For This Date</h3>
                  <p className="mt-1 text-sm text-slate-500">{formatDisplayDate(selectedDate)}</p>

                  <div className="mt-5 space-y-4">
                    {upcomingAppointments.length ? (
                      upcomingAppointments.map((appointment) => (
                        <div key={appointment.id} className="rounded-[1.6rem] bg-slate-50 px-4 py-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                                <Clock3 className="h-4 w-4" />
                              </span>
                              <div className="text-lg font-black text-slate-800">{appointment.slotLabel}</div>
                            </div>
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getConcernClassName(appointment.concern)}`}>
                              {appointment.concern}
                            </span>
                          </div>

                          <div className="mt-4 flex items-center justify-between gap-3 text-sm text-slate-500">
                            <div>
                              <div className="font-semibold text-slate-700">{appointment.studentName}</div>
                              <div className="mt-1">{appointment.program || appointment.studentNumber}</div>
                              {String(appointment.status || "").toUpperCase() === "PENDING" && appointment.decisionDueAt ? (
                                <div className="mt-1 text-xs font-semibold text-amber-700">
                                  Respond by {formatDisplayDate(appointment.decisionDueAt.slice(0, 10))}
                                </div>
                              ) : null}
                            </div>
                            <div className="text-right">
                              <div className="font-medium text-slate-500">{appointment.counselorName}</div>
                              <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusClassName(appointment.status)}`}>
                                {appointment.statusLabel || appointment.status}
                              </span>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap justify-end gap-2">
                            {["PENDING", "CONFIRMED", "DECLINED"].includes(String(appointment.status || "").toUpperCase()) ? (
                              <button
                                type="button"
                                onClick={() => handleOpenModal(appointment)}
                                className="rounded-full bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-300"
                              >
                                {String(appointment.status || "").toUpperCase() === "PENDING" ? "Reschedule" : "Edit"}
                              </button>
                            ) : null}
                            {String(appointment.status || "").toUpperCase() === "PENDING" ? (
                              <button
                                type="button"
                                onClick={() => void handleConfirmAppointment(appointment.id)}
                                className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-200"
                              >
                                Confirm
                              </button>
                            ) : null}
                            {String(appointment.status || "").toUpperCase() === "PENDING" ? (
                              <button
                                type="button"
                                onClick={() => void handleDeclineAppointment(appointment.id)}
                                className="rounded-full bg-rose-100 px-3 py-1.5 text-xs font-semibold text-rose-800 transition hover:bg-rose-200"
                              >
                                Decline
                              </button>
                            ) : null}
                            {String(appointment.status || "").toUpperCase() === "CONFIRMED" ? (
                              <button
                                type="button"
                                onClick={() => setCancelAppointmentId(appointment.id)}
                                className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-200"
                              >
                                Cancel
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => setDeleteAppointmentId(appointment.id)}
                              className="rounded-full bg-rose-100 px-3 py-1.5 text-xs font-semibold text-rose-800 transition hover:bg-rose-200"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                        No sessions booked for this date yet.
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </div>

            <section className="rounded-[2rem] border border-admin-border bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-[1.25rem] font-black text-slate-800">Counselor Availability</h3>
                  <p className="mt-1 text-sm text-slate-500">Weekly schedule overview for the currently selected week. Turning a day off only affects that specific date and clears its hours.</p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsEditingCounselorAvailability((current) => !current)}
                    className="rounded-xl bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                  >
                    {isEditingCounselorAvailability ? "Done" : "Edit"}
                  </button>

                  <button
                    type="button"
                    onClick={() => refreshOverview()}
                    className="rounded-xl bg-slate-100 p-2.5 text-slate-500 transition hover:bg-slate-200"
                  >
                    <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <div className="min-w-[880px] space-y-5">
                  <div className="grid grid-cols-[180px_repeat(5,minmax(0,1fr))] gap-5 text-sm font-semibold text-slate-500">
                    <div>Counselor</div>
                    <div>Mon</div>
                    <div>Tue</div>
                    <div>Wed</div>
                    <div>Thu</div>
                    <div>Fri</div>
                  </div>

                  {counselorDayLoad.map((row) => (
                    <div key={row.counselor.id} className="grid grid-cols-[180px_repeat(5,minmax(0,1fr))] items-center gap-5">
                      <div className="flex items-center gap-3">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: row.color }} />
                        <div>
                          <div className="font-semibold text-slate-700">{row.counselor.fullName}</div>
                          <div className="text-xs text-slate-400">{row.counselor.role}</div>
                        </div>
                      </div>

                      {row.dayTotals.map((day) => {
                        const isSelectedCounselor = row.counselor.id === selectedCounselor?.id;
                        const isInteractive = isEditingCounselorAvailability && isSelectedCounselor;
                        return (
                          <button
                            key={`${row.counselor.id}-${day.dayOfWeek}`}
                            type="button"
                            onClick={() => {
                              if (!isSelectedCounselor) {
                                setSelectedCounselorId(row.counselor.id);
                                return;
                              }
                              if (isInteractive) {
                                setDayAvailabilityAction({
                                  dayLabel: day.dayLabel,
                                  dayOfWeek: day.dayOfWeek,
                                  targetDate: day.isoDate,
                                  nextEnabled: !day.isWorkingDay,
                                });
                              }
                            }}
                            className={`rounded-2xl bg-slate-50 px-3 py-3 text-left transition ${
                              isInteractive ? "hover:bg-slate-100" : "hover:bg-slate-100"
                            } ${isSelectedCounselor ? "ring-2 ring-emerald-100" : ""}`}
                          >
                            {day.isWorkingDay ? (
                              <div className="space-y-2">
                                <div className="h-11 overflow-hidden rounded-xl bg-slate-100">
                                  <div
                                    className="h-full rounded-xl opacity-80"
                                    style={{
                                      width: `${Math.max(24, day.percent)}%`,
                                      backgroundColor: row.color,
                                    }}
                                  />
                                </div>
                                <div className="text-xs font-semibold text-slate-500">
                                  {isInteractive ? `${formatDisplayDate(day.isoDate)}` : formatAvailabilityHours(day.openSlots)}
                                </div>
                              </div>
                            ) : (
                              <div className="flex h-11 items-center justify-center rounded-xl bg-slate-100 text-sm font-medium text-slate-400">
                                {isInteractive ? formatDisplayDate(day.isoDate) : "Off"}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr,0.9fr]">
              <section className="rounded-[2rem] border border-admin-border bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                    <CalendarDays className="h-5 w-5" />
                  </span>
                  <div className="flex-1">
                    <h3 className="text-[1.15rem] font-black text-slate-800">Admin Activity Logs</h3>
                    <p className="mt-1 text-sm text-slate-500">Recent admin activity across scheduling and the wider admin panel.</p>
                  </div>
                  <label className="flex min-w-[220px] flex-col gap-1 text-sm font-semibold text-slate-700">
                    Filter by counselor
                    <select
                      value={activityFilterCounselorId}
                      onChange={(event) => {
                        setActivityFilterCounselorId(event.target.value);
                        setActivityLogsPage(1);
                      }}
                      className="rounded-xl border border-admin-border bg-white px-3 py-2 text-sm font-medium text-admin-ink"
                    >
                      <option value="ALL">All counselors</option>
                      {counselors.map((item) => (
                        <option key={`activity-${item.id}`} value={item.id}>
                          {item.fullName}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="space-y-3">
                  {filteredRecentActivity.length ? (
                    paginatedRecentActivity.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-800">{item.title}</div>
                            <div className="mt-1 text-sm text-slate-500">{item.description}</div>
                            <div className="mt-2 text-xs font-medium text-slate-400">
                              {item.actorName} · {item.actorRole}
                            </div>
                          </div>
                          <div className="shrink-0 text-xs font-medium text-slate-400">{item.createdAtLabel}</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                      No activity recorded for that counselor yet.
                    </div>
                  )}
                </div>

                {filteredRecentActivity.length ? (
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="text-xs font-medium text-slate-400">
                      Page {activityLogsPage} of {totalActivityLogPages}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActivityLogsPage((current) => Math.max(1, current - 1))}
                        disabled={activityLogsPage === 1}
                        className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        onClick={() => setActivityLogsPage((current) => Math.min(totalActivityLogPages, current + 1))}
                        disabled={activityLogsPage === totalActivityLogPages}
                        className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                ) : null}
              </section>

              <section className="rounded-[2rem] border border-admin-border bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                    <Clock3 className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-[1.15rem] font-black text-slate-800">Counselor & Admin List</h3>
                    <p className="mt-1 text-sm text-slate-500">Active scheduling accounts with their roles and specialties.</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {counselors.map((item, index) => (
                    <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                      <div className="flex items-start gap-3">
                        <span
                          className="mt-1 h-3 w-3 shrink-0 rounded-full"
                          style={{ backgroundColor: COUNSELOR_COLORS[index % COUNSELOR_COLORS.length] }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-sm font-semibold text-slate-800">{item.fullName}</div>
                            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-700">
                              {item.role}
                            </span>
                          </div>
                          <div className="mt-1 text-sm text-slate-500">{item.email}</div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600">
                              {item.gender || "Prefer not to say"}
                            </span>
                            {(item.specialties?.length ? item.specialties : ["General guidance"]).map((specialty) => (
                              <span key={`${item.id}-${specialty}`} className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600">
                                {specialty}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-xl font-bold text-slate-800">{editingAppointmentId ? "Edit Counselor Appointment" : "Create Counselor Appointment"}</h3>
            
            {modalError && (
              <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreateAppointment} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Student Number</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. 21-12345"
                  value={modalStudentNumber}
                  onChange={(e) => setModalStudentNumber(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-sm outline-none focus:border-[#3DA35D] focus:ring-1 focus:ring-[#3DA35D]"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Counselor</label>
                <select
                  required
                  value={modalCounselorId}
                  onChange={(e) => setModalCounselorId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-sm outline-none focus:border-[#3DA35D]"
                >
                  <option value="">Select Counselor</option>
                  {counselors.map((c) => (
                    <option key={`modal-${c.id}`} value={c.id}>{c.fullName}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Date</label>
                  <input
                    required
                    type="date"
                    min={getTodayIsoDate()}
                    value={modalDate}
                    onChange={(e) => setModalDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-sm outline-none focus:border-[#3DA35D]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Time</label>
                  <select
                    required
                    value={modalTime}
                    onChange={(e) => setModalTime(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-sm outline-none focus:border-[#3DA35D]"
                  >
                    <option value="">
                      {modalLoadingSlots ? "Loading times..." : modalAvailableSlots.length ? "Select Time" : "No open times"}
                    </option>
                    {modalAvailableSlots.map((s) => (
                      <option key={`modal-time-${s.value}`} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Concern</label>
                <select
                  required
                  value={modalConcern}
                  onChange={(e) => setModalConcern(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-sm outline-none focus:border-[#3DA35D]"
                >
                  <option value="">Select Concern</option>
                  {overview?.concernOptions?.map((opt) => (
                    <option key={`concern-${opt}`} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Note (Optional)</label>
                <textarea
                  value={modalNote}
                  onChange={(e) => setModalNote(e.target.value)}
                  placeholder="Any additional details..."
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-sm outline-none focus:border-[#3DA35D]"
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingAppointmentId("");
                  }}
                  disabled={isSubmitting}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-[#3DA35D] px-6 py-2 text-sm font-semibold text-white hover:bg-[#2f8c4d] disabled:opacity-70"
                >
                  {isSubmitting ? "Saving..." : editingAppointmentId ? "Save Changes" : "Create Counselor Appointment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmActionModal
        isOpen={Boolean(cancelAppointmentId)}
        onClose={() => setCancelAppointmentId("")}
        onConfirm={() => void handleCancelAppointment(cancelAppointmentId)}
        title="Cancel Appointment"
        description="Cancel this appointment and keep it listed as cancelled?"
        cancelLabel="Keep"
        confirmLabel="Confirm Cancel"
        confirmTone="amber"
      />

      <ConfirmActionModal
        isOpen={Boolean(deleteAppointmentId)}
        onClose={() => setDeleteAppointmentId("")}
        onConfirm={() => void handleDeleteAppointment(deleteAppointmentId)}
        title="Delete Appointment"
        description="Delete this appointment permanently from the database?"
        cancelLabel="Keep"
        confirmLabel="Delete Permanently"
        confirmTone="rose"
      />

      <ConfirmActionModal
        isOpen={Boolean(dayAvailabilityAction)}
        onClose={() => setDayAvailabilityAction(null)}
        onConfirm={() => void handleConfirmDayAvailabilityToggle()}
        title={dayAvailabilityAction?.nextEnabled ? "Set Day Available" : "Mark Day Off"}
        description={
          dayAvailabilityAction?.nextEnabled
            ? `Make ${dayAvailabilityAction?.dayLabel} available again for ${formatDisplayDate(dayAvailabilityAction?.targetDate || selectedDate)}?`
            : `Mark ${dayAvailabilityAction?.dayLabel} off for ${formatDisplayDate(dayAvailabilityAction?.targetDate || selectedDate)}? All appointments on that specific date will be cancelled, and every hour for that date will become unavailable.`
        }
        confirmTone={dayAvailabilityAction?.nextEnabled ? "emerald" : "rose"}
      />
    </Layout>
  );
}
