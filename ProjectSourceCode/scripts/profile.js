document.addEventListener("DOMContentLoaded", () => {
  /* =======================
     EMAIL NOTIFICATION TOGGLE
     ======================= */
  const emailToggle = document.getElementById("emailToggle");

  const savedNotif = localStorage.getItem("emailNotifications");
  if (savedNotif === "on") {
    emailToggle.checked = true;
  }

  emailToggle.addEventListener("change", () => {
    localStorage.setItem(
      "emailNotifications",
      emailToggle.checked ? "on" : "off"
    );
  });

  /* =======================
     PROFILE PICTURE HANDLING
     ======================= */
  const profileImage = document.getElementById("profileImage");
  const avatarUpload = document.getElementById("avatarUpload");

  // Load saved image if available
  const savedImage = localStorage.getItem("profileImage");
  if (savedImage) {
    profileImage.src = savedImage;
  } else {
    profileImage.src = "../static/img/default-avatar.png";
  }

  // Handle uploading a new image
  avatarUpload.addEventListener("change", () => {
    const file = avatarUpload.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result;

      // Update preview
      profileImage.src = base64;

      // Save to localStorage
      localStorage.setItem("profileImage", base64);
    };

    reader.readAsDataURL(file);
  });
});
