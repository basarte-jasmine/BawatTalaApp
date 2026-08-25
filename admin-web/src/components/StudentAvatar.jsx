import { useEffect, useState } from "react";

function getInitials(name) {
  return String(name || "Student")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default function StudentAvatar({
  className = "h-10 w-10 rounded-full",
  fallbackClassName = "bg-[#e7f1ed] text-[#0E5A3A]",
  fullName,
  profilePictureUrl,
}) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [profilePictureUrl]);

  const showImage = Boolean(profilePictureUrl) && !imageFailed;

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden font-bold ${className} ${showImage ? "bg-slate-100" : fallbackClassName}`}
    >
      {showImage ? (
        <img
          alt={`${fullName || "Student"} profile`}
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
          src={profilePictureUrl}
        />
      ) : (
        getInitials(fullName)
      )}
    </div>
  );
}
