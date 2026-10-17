import React from "react";
import type { User as FirebaseUser } from "firebase/auth";

export type AvatarMode = "custom" | "google" | "removed" | "initial";

export const getGoogleName = (user: FirebaseUser | null | undefined): string => {
  const google = user?.providerData.find((provider) => provider.providerId === "google.com");
  return google?.displayName?.trim() || user?.displayName?.trim() || user?.email?.split("@")[0] || "Cinescape member";
};

export const getGooglePhoto = (user: FirebaseUser | null | undefined): string | null => {
  const google = user?.providerData.find((provider) => provider.providerId === "google.com");
  return google?.photoURL || user?.photoURL || null;
};

interface UserAvatarProps {
  name: string;
  photo?: string | null;
  mode?: AvatarMode;
  className?: string;
  imageClassName?: string;
}

const UserAvatar: React.FC<UserAvatarProps> = ({ name, photo, mode = "initial", className = "", imageClassName = "" }) => {
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [photo, mode]);
  const src = mode === "removed" ? "/user-icon.jpg" : photo;
  const initial = Array.from(name.trim())[0]?.toLocaleUpperCase() || "C";
  return (
    <span className={`relative flex shrink-0 items-center justify-center overflow-hidden bg-gradient-to-br from-zinc-700 via-[#40161b] to-black text-white ring-1 ring-inset ring-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_4px_18px_rgba(180,25,45,0.16)] ${className}`} aria-label={`${name} avatar`} role="img">
      {src && !failed ? <img src={src} alt="" onError={() => setFailed(true)} className={`h-full w-full object-cover ${imageClassName}`} /> : <span className="select-none font-semibold leading-none tracking-tight text-[length:inherit] drop-shadow-[0_2px_12px_rgba(255,255,255,0.22)]">{initial}</span>}
    </span>
  );
};

export default UserAvatar;