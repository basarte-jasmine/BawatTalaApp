import { PropsWithChildren, useCallback, useEffect, useState } from "react";
import { AppNoticeModal } from "../components/ui/AppNoticeModal";

export type AppNotice = {
  message: string;
  onOk?: () => void;
  title: string;
};

type NoticeListener = (notice: AppNotice | null) => void;

let noticeListener: NoticeListener | null = null;
let pendingNotice: AppNotice | null = null;

export function setAppNoticeListener(listener: NoticeListener | null) {
  noticeListener = listener;
  if (listener && pendingNotice) {
    listener(pendingNotice);
    pendingNotice = null;
  }
}

/** Themed in-app notice — replaces Alert.alert / window.alert. */
export function showAppNotice(title: string, message: string, onOk?: () => void) {
  const notice: AppNotice = {
    title: String(title || "Notice"),
    message: String(message || ""),
    onOk,
  };
  if (noticeListener) {
    noticeListener(notice);
    return;
  }
  pendingNotice = notice;
}

export function AppNoticeProvider({ children }: PropsWithChildren) {
  const [notice, setNotice] = useState<AppNotice | null>(null);

  useEffect(() => {
    setAppNoticeListener(setNotice);
    return () => setAppNoticeListener(null);
  }, []);

  const handleOk = useCallback(() => {
    const callback = notice?.onOk;
    setNotice(null);
    callback?.();
  }, [notice]);

  return (
    <>
      {children}
      <AppNoticeModal
        visible={Boolean(notice)}
        title={notice?.title || ""}
        message={notice?.message || ""}
        onOk={handleOk}
      />
    </>
  );
}
