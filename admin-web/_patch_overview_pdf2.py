from pathlib import Path

overview = Path(r"C:\Users\Jasmine Basarte\BawatTalaApp\admin-web\src\pages\Overview.jsx")
card = Path(r"C:\Users\Jasmine Basarte\BawatTalaApp\admin-web\src\components\Card.jsx")
t = overview.read_text(encoding="utf-8")

old_metric = """  if (!onSelect) {
    return <div className={className}>{content}</div>;
  }

  return (
    <button
      type=\"button\"
      onClick={() => onSelect(item.title)}
      className={className}
    >"""
new_metric = """  if (!onSelect) {
    return <div className={className} data-export-block=\"true\">{content}</div>;
  }

  return (
    <button
      type=\"button\"
      onClick={() => onSelect(item.title)}
      className={className}
      data-export-block=\"true\"
    >"""
if old_metric not in t:
    raise SystemExit("metric card block not found")
t = t.replace(old_metric, new_metric, 1)

old_sig = """function createOverviewReportPdf({
  activeUsageSeries,
  analyticsCards,
  barangayConcernData,
  genderData,
  journalEntriesData,
  moodTrendData,
  primaryConcernsData,
  riskSignalCards,
  sentimentDistributionData,
  summaryCards,
  todayLabel,
}) {"""
new_sig = """function createOverviewReportPdf({
  activeUsageSeries,
  analyticsCards,
  analyticsOverview,
  barangayConcernData,
  genderData,
  journalEntriesData,
  moodTrendData,
  primaryConcernsData,
  riskSignalCards,
  sentimentDistributionData,
  summaryCards,
  todayLabel,
}) {"""
if old_sig not in t:
    raise SystemExit("report pdf signature not found")
t = t.replace(old_sig, new_sig, 1)

old_rows = """  addChartRows(\"Top Concerns By Barangay\", barangayConcernData, (item) =>
    item.percent !== undefined ? `${item.value} (${item.percent}%)` : item.value,
  );"""
new_rows = """  addChartRows(\"Top Concerns By Barangay\", barangayConcernData, (item) =>
    item.percent !== undefined ? `${item.value} (${item.percent}%)` : item.value,
  );

  const consultationVolumeData = buildConsultationVolumeCategoryData(analyticsOverview?.charts?.consultationVolumeByCategory || []);
  const counselorWorkloadData = analyticsOverview?.charts?.counselorWorkload || [];
  const atRiskLabels = analyticsOverview?.charts?.atRiskStudentTrends?.labels || [];
  const atRiskSeries = analyticsOverview?.charts?.atRiskStudentTrends?.series || [];
  const atRiskRows = atRiskLabels.map((label, index) => ({
    label,
    value: atRiskSeries.map((item) => `${item.label || item.key}: ${Number(item.values?.[index] || 0)}`).join(\", \"),
  }));
  addChartRows(\"Consultation Volume by Category\", consultationVolumeData);
  addChartRows(\"Counselor Workload\", counselorWorkloadData);
  addChartRows(\"At-Risk Student Trends\", atRiskRows);"""
if old_rows not in t:
    raise SystemExit("barangay chart rows not found")
t = t.replace(old_rows, new_rows, 1)

old_meta = """  outputCanvas.__overviewPageBreaks = pageBreaks.filter((breakPoint) => breakPoint < outputCanvas.height - 80);

  return outputCanvas;
}"""
new_meta = """  outputCanvas.__overviewPageBreaks = pageBreaks.filter((breakPoint) => breakPoint < outputCanvas.height - 80);
  const cssBreaks = [...pageBreaks.map((breakPoint) => breakPoint / scale), renderedHeight];
  const visualBlocks = [];
  let previousBreak = 0;
  cssBreaks.forEach((point) => {
    if (point > previousBreak + 8) {
      visualBlocks.push({ top: previousBreak, height: point - previousBreak, width, left: 0 });
      previousBreak = point;
    }
  });
  outputCanvas.__overviewExportMeta = {
    scale,
    cssWidth: width,
    cssHeight: renderedHeight,
    blocks: visualBlocks,
  };

  return outputCanvas;
}"""
if old_meta not in t:
    raise SystemExit("visual canvas meta not found")
t = t.replace(old_meta, new_meta, 1)

old_export = """      let pdfBlob;
      try {
        const canvas = await captureElementCanvas(overviewExportRef.current);
        pdfBlob = createPdfFromCanvas(canvas, canvas.__overviewPageBreaks);
      } catch (snapshotError) {
        console.warn(\"Dashboard snapshot export failed; using visual PDF renderer.\", snapshotError);
        try {
          const visualCanvas = createOverviewDashboardCanvas(reportPdfOptions);
          pdfBlob = createPdfFromCanvas(visualCanvas, visualCanvas.__overviewPageBreaks);
        } catch (visualError) {
          console.warn(\"Visual dashboard PDF renderer failed; using data PDF fallback.\", visualError);
          pdfBlob = createOverviewReportPdf(reportPdfOptions);
        }
      }"""
new_export = """      let pdfBlob;
      const pdfPageOptions = {
        rangeLabel: `Analytics range: ${reportStartDate} to ${reportEndDate}`,
        todayLabel: reportPdfOptions.todayLabel,
      };
      try {
        const canvas = await captureElementCanvas(overviewExportRef.current);
        pdfBlob = createPdfFromCanvas(canvas, pdfPageOptions);
      } catch (snapshotError) {
        console.warn(\"Dashboard snapshot export failed; retrying full-page visual capture.\", snapshotError);
        try {
          const retryCanvas = await captureElementCanvasAttached(overviewExportRef.current);
          pdfBlob = createPdfFromCanvas(retryCanvas, pdfPageOptions);
        } catch (retryError) {
          console.warn(\"Attached visual capture failed; using painted dashboard snapshot.\", retryError);
          try {
            const visualCanvas = createOverviewDashboardCanvas(reportPdfOptions);
            pdfBlob = createPdfFromCanvas(visualCanvas, pdfPageOptions);
          } catch (visualError) {
            console.warn(\"Visual dashboard PDF renderer failed; using data PDF last resort.\", visualError);
            pdfBlob = createOverviewReportPdf(reportPdfOptions);
          }
        }
      }"""
if old_export not in t:
    raise SystemExit("handleExportPdf block not found")
t = t.replace(old_export, new_export, 1)

old_toolbar = """        <div className=\"flex flex-nowrap items-center justify-end gap-3 overflow-x-auto pb-1\" data-export-ignore=\"true\">"""
new_toolbar = """        <div className=\"flex flex-nowrap items-center justify-end gap-3 overflow-x-auto pb-1\" data-export-block=\"true\">"""
if old_toolbar not in t:
    raise SystemExit("toolbar not found")
t = t.replace(old_toolbar, new_toolbar, 1)

old_btn = """          <button
            type=\"button\"
            onClick={handleExportPdf}
            disabled={isExportingPdf || summaryLoading || analyticsLoading}
            className=\"flex shrink-0 items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70\"
          >"""
new_btn = """          <button
            type=\"button\"
            onClick={handleExportPdf}
            disabled={isExportingPdf || summaryLoading || analyticsLoading}
            data-export-ignore=\"true\"
            className=\"flex shrink-0 items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70\"
          >"""
if old_btn not in t:
    raise SystemExit("export button not found")
t = t.replace(old_btn, new_btn, 1)

old_heading = """        <div className=\"flex items-center gap-3 pt-2\">"""
new_heading = """        <div className=\"flex items-center gap-3 pt-2\" data-export-block=\"true\">"""
if old_heading not in t:
    raise SystemExit("heading not found")
t = t.replace(old_heading, new_heading, 1)

overview.write_text(t, encoding="utf-8")
print("overview patched")

c = card.read_text(encoding="utf-8")
old_card = """    <div
      className={`rounded-xl border border-gray-100 bg-white p-6 shadow-sm transition hover:border-emerald-200 ${className}`}
    >"""
new_card = """    <div
      data-export-block=\"true\"
      className={`rounded-xl border border-gray-100 bg-white p-6 shadow-sm transition hover:border-emerald-200 ${className}`}
    >"""
if old_card not in c:
    raise SystemExit("Card.jsx root not found")
card.write_text(c.replace(old_card, new_card, 1), encoding="utf-8")
print("card patched")
