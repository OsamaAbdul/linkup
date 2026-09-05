import React from "react";
import { LocationPromptBanner } from "./LocationPromptBanner";
import { NotificationPromptBanner } from "./NotificationPromptBanner";

export function GlobalPermissions() {
  return (
    <>
      <LocationPromptBanner />
      <NotificationPromptBanner />
    </>
  );
}
