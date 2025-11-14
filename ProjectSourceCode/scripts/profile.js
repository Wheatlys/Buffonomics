document.addEventListener("DOMContentLoaded", () => {
  const emailToggle = document.getElementById("emailToggle");

  // Restore saved state
  const saved = localStorage.getItem("emailNotifications");
  if (saved === "on") {
    emailToggle.checked = true;
  }

  // Save changes
  emailToggle.addEventListener("change", () => {
    localStorage.setItem(
      "emailNotifications",
      emailToggle.checked ? "on" : "off"
    );
  });
});
